import { loadConfig } from './config';
import { launchBrowser, closeBrowser } from './browser';
import { giveKudosToAllFeeds, fetchUserClubs } from './kudos';

async function main(): Promise<void> {
  console.log('='.repeat(50));
  console.log('Strava Auto-Kudos');
  console.log('='.repeat(50));

  // Load configuration
  const config = loadConfig();

  console.log(`\nConfiguration:`);
  console.log(`  Club IDs: ${config.clubIds.length > 0 ? config.clubIds.join(', ') : '(default feed)'}`);
  console.log(`  Max kudos per run: ${config.maxKudosPerRun === Infinity ? 'unlimited' : config.maxKudosPerRun}`);
  console.log(`  Dry run: ${config.dryRun}`);

  if (config.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No kudos will actually be given');
  }

  let session;

  try {
    // Launch browser with session cookie
    session = await launchBrowser(config.stravaSession);

    // Auto-fetch clubs if none specified
    let clubIds = config.clubIds;
    if (clubIds.length === 0) {
      clubIds = await fetchUserClubs(session.page);
    }

    // Give kudos to all configured feeds
    const result = await giveKudosToAllFeeds(
      session.page,
      clubIds,
      config.maxKudosPerRun,
      config.dryRun
    );

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('Summary');
    console.log('='.repeat(50));
    console.log(`  Kudos given: ${result.given}`);
    console.log(`  Errors: ${result.errors}`);

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
