import { Page } from 'playwright';

const ACCEPT_DELAY_MIN_MS = 500;
const ACCEPT_DELAY_MAX_MS = 1000;
const PAGE_LOAD_DELAY_MS = 1000;

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface FollowResult {
  accepted: number;
  errors: number;
}

export async function getAthleteId(page: Page): Promise<string> {
  // Navigate to dashboard and find the athlete ID from profile link
  await page.goto('https://www.strava.com/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(PAGE_LOAD_DELAY_MS);

  // Dismiss cookie consent banner if present
  const rejectCookiesButton = page.locator('button:has-text("Reject Non-Essential")');
  if (await rejectCookiesButton.isVisible().catch(() => false)) {
    console.log('Dismissing cookie consent banner...');
    await rejectCookiesButton.click();
    await page.waitForTimeout(500);
  }

  // Check if logged in
  if (page.url().includes('/login') || page.url().includes('/session')) {
    throw new Error('Session cookie expired. Please update STRAVA_SESSION with a fresh cookie.');
  }

  // Find athlete ID from profile link (e.g., href="/athletes/12345")
  const profileLink = page.locator('a[href^="/athletes/"]').first();
  const href = await profileLink.getAttribute('href');

  if (!href) {
    throw new Error('Could not find athlete profile link on dashboard');
  }

  const match = href.match(/\/athletes\/(\d+)/);
  if (!match) {
    throw new Error(`Could not parse athlete ID from href: ${href}`);
  }

  return match[1];
}

export async function acceptFollowRequests(
  page: Page,
  dryRun: boolean
): Promise<FollowResult> {
  const result: FollowResult = { accepted: 0, errors: 0 };

  // Get athlete ID first
  console.log('Getting athlete ID...');
  const athleteId = await getAthleteId(page);
  console.log(`Athlete ID: ${athleteId}`);

  // Navigate to follow requests page
  const followsUrl = `https://www.strava.com/athletes/${athleteId}/follows?type=followers`;
  console.log(`\nNavigating to: ${followsUrl}`);

  try {
    await page.goto(followsUrl, { waitUntil: 'networkidle' });
  } catch (error) {
    const errorMsg = String(error);
    if (errorMsg.includes('ERR_CONNECTION') || errorMsg.includes('net::')) {
      console.log('Connection closed by Strava');
      return result;
    }
    throw error;
  }
  await page.waitForTimeout(PAGE_LOAD_DELAY_MS);

  // Dismiss cookie consent banner if present (may appear on any page)
  const rejectCookiesButton = page.locator('button:has-text("Reject Non-Essential")');
  if (await rejectCookiesButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Dismissing cookie consent banner...');
    await rejectCookiesButton.click();
    await page.waitForTimeout(500);
  }

  // Check if we landed on login page (session expired)
  if (page.url().includes('/login') || page.url().includes('/session')) {
    throw new Error('Session cookie expired. Please update STRAVA_SESSION with a fresh cookie.');
  }

  // Find all Accept buttons
  const acceptButtonLocator = page.locator('button:has-text("Accept")');
  const initialCount = await acceptButtonLocator.count();
  console.log(`Found ${initialCount} pending follow requests`);

  if (initialCount === 0) {
    console.log('No pending follow requests to accept');
    return result;
  }

  // Process accept buttons one at a time
  while (true) {
    const countBefore = await acceptButtonLocator.count();

    if (countBefore === 0) {
      console.log('No more follow requests to accept');
      break;
    }

    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would accept follow request (${result.accepted + 1}/${initialCount})`);
        result.accepted++;
        // In dry run, we need to break since we're not actually clicking
        if (result.accepted >= initialCount) break;
        continue;
      }

      // Click the first Accept button (force: true bypasses actionability checks)
      const button = acceptButtonLocator.first();
      await button.scrollIntoViewIfNeeded();
      await button.click({ force: true });

      // Wait for button to disappear (DOM update)
      await page.waitForTimeout(1500);
      const countAfter = await acceptButtonLocator.count();

      // Verify: if count decreased, accept worked
      if (countAfter < countBefore) {
        result.accepted++;
        console.log(`Accepted follow request (${result.accepted}/${initialCount})`);
        result.errors = 0; // Reset consecutive errors
      } else {
        console.log(`Accept may have failed (count unchanged)`);
        result.errors++;

        if (result.errors >= 3) {
          console.log('3 consecutive failures - stopping');
          break;
        }
      }

      // Delay between accepts
      await page.waitForTimeout(randomDelay(ACCEPT_DELAY_MIN_MS, ACCEPT_DELAY_MAX_MS));

    } catch (error) {
      console.error(`Error accepting follow request: ${error}`);
      result.errors++;
      if (result.errors >= 3) {
        console.log('3 consecutive errors - stopping');
        break;
      }
    }
  }

  return result;
}
