import { launchBrowser, closeBrowser } from './browser';
import { acceptFollowRequests } from './follows';

function loadFollowsConfig() {
  const stravaSession = process.env.STRAVA_SESSION;

  if (!stravaSession) {
    throw new Error(
      'STRAVA_SESSION environment variable is required. ' +
      'Copy the _strava4_session cookie value from Chrome DevTools.'
    );
  }

  const dryRun = process.env.DRY_RUN === 'true';
  const headless = process.env.HEADLESS !== 'false'; // Default true, set HEADLESS=false to show browser

  return {
    stravaSession,
    dryRun,
    headless,
  };
}

async function main(): Promise<void> {
  const startTime = new Date().toLocaleString();
  console.log('='.repeat(50));
  console.log(`Strava Accept Follow Requests - ${startTime}`);
  console.log('='.repeat(50));

  // Load configuration
  const config = loadFollowsConfig();

  console.log(`\nConfiguration:`);
  console.log(`  Dry run: ${config.dryRun}`);
  console.log(`  Headless: ${config.headless}`);

  if (config.dryRun) {
    console.log('\nDRY RUN MODE - No requests will actually be accepted');
  }

  let session;

  try {
    // Launch browser with session cookie
    session = await launchBrowser(config.stravaSession, config.headless);

    // Accept all pending follow requests
    const result = await acceptFollowRequests(session.page, config.dryRun);

    // Print summary
    const endTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    console.log('\n' + '='.repeat(50));
    console.log(`Summary - ${endTime}`);
    console.log('='.repeat(50));
    console.log(`  Accepted: ${result.accepted}`);
    console.log(`  Errors: ${result.errors}`);

    if (result.errors > 0) {
      console.log('\nSome errors occurred during execution');
      process.exitCode = 1;
    }

  } catch (error) {
    console.error('\nFatal error:', error);
    process.exitCode = 1;
  } finally {
    if (session) {
      await closeBrowser(session);
    }
  }

  console.log('\nDone!');
}

main();
