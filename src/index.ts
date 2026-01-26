import { loadConfig } from './config';
import { launchBrowser, closeBrowser } from './browser';
import { giveKudosToAllFeeds, fetchUserClubs } from './kudos';
import { isMobileAvailable, giveKudosMobile } from './mobile/emulator-kudos';

async function main(): Promise<void> {
  const startTime = new Date().toLocaleString();
  console.log('='.repeat(50));
  console.log(`Strava Auto-Kudos - ${startTime}`);
  console.log('='.repeat(50));

  // Load configuration
  const config = loadConfig();

  console.log(`\nConfiguration:`);
  console.log(`  Clubs: ${config.clubIds.length} (shuffled)`);
  console.log(`  Max kudos per run: ${config.maxKudosPerRun === Infinity ? 'unlimited' : config.maxKudosPerRun}`);
  console.log(`  Dry run: ${config.dryRun}`);
  console.log(`  Mode: ${config.mobileOnly ? 'mobile only' : config.skipMobile ? 'browser only' : 'browser + mobile fallback'}`);

  if (config.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No kudos will actually be given');
  }

  let session;

  try {
    let browserResult = { given: 0, errors: 0, rateLimited: false };
    let mobileResult = { given: 0, errors: 0, rateLimited: false };

    // Run browser automation (unless mobile-only mode)
    if (!config.mobileOnly) {
      // Launch browser with session cookie
      session = await launchBrowser(config.stravaSession);

      // Auto-fetch clubs if none specified
      let clubIds = config.clubIds;
      if (clubIds.length === 0) {
        clubIds = await fetchUserClubs(session.page);
      }

      // Give kudos to all configured feeds
      browserResult = await giveKudosToAllFeeds(
        session.page,
        clubIds,
        config.maxKudosPerRun,
        config.dryRun
      );

      // Close browser before potentially switching to mobile
      await closeBrowser(session);
      session = undefined;
    }

    // Mobile automation: either in mobile-only mode or as fallback after rate limit
    const shouldRunMobile = config.mobileOnly ||
      (browserResult.rateLimited && !config.skipMobile);

    if (shouldRunMobile) {
      let mobileReady = isMobileAvailable();

      // Auto-start emulator if not running
      if (!mobileReady) {
        console.log('\n📱 No emulator detected, attempting to start...');
        const { startEmulator } = await import('./mobile/adb');
        mobileReady = await startEmulator();
      }

      if (mobileReady) {
        if (config.mobileOnly) {
          console.log('\n📱 Running in mobile-only mode...');
        } else {
          console.log('\n🔄 Browser rate limited, switching to mobile emulator...');
        }

        const remainingKudos = config.maxKudosPerRun === Infinity
          ? Infinity
          : config.maxKudosPerRun - browserResult.given;

        mobileResult = await giveKudosMobile(remainingKudos, config.dryRun);
      } else {
        console.log('\n📱 Mobile automation unavailable (emulator failed to start)');
        console.log('   Tip: Run `emulator -list-avds` to see available emulators');
        if (config.mobileOnly) {
          throw new Error('Mobile-only mode requested but no emulator available');
        }
      }
    }

    // Combine results
    const result = {
      given: browserResult.given + mobileResult.given,
      errors: browserResult.errors + mobileResult.errors,
      rateLimited: browserResult.rateLimited && (config.skipMobile || mobileResult.rateLimited),
    };

    // Print summary
    const endTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    console.log('\n' + '='.repeat(50));
    console.log(`Summary - ${endTime}`);
    console.log('='.repeat(50));
    if (browserResult.given > 0) {
      console.log(`  Browser kudos: ${browserResult.given}`);
    }
    if (mobileResult.given > 0) {
      console.log(`  Mobile kudos: ${mobileResult.given}`);
    }
    console.log(`  Total kudos: ${result.given}`);
    console.log(`  Errors: ${result.errors}`);
    console.log(`  Rate limited: ${result.rateLimited}`);

    if (result.errors > 0) {
      console.log('\n⚠️  Some errors occurred during execution');
      process.exitCode = 1;
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exitCode = 1;
  } finally {
    if (session) {
      await closeBrowser(session);
    }
  }

  console.log('\nDone!');
}

main();
