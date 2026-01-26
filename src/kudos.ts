import { Page } from 'playwright';

const KUDOS_DELAY_MIN_MS = 300; // Aggressive: minimal delay for speed
const KUDOS_DELAY_MAX_MS = 800;
const MAX_KUDOS_PER_CLUB = 40; // Auto-switch clubs after 40 kudos for better distribution
const SCROLL_DELAY_MS = 200;
const PAGE_LOAD_DELAY_MS = 1000;

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function fetchUserClubs(page: Page): Promise<string[]> {
  console.log('\nFetching your clubs...');

  // Try the dashboard first to find clubs in the sidebar
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

  // Debug: log page URL
  console.log(`Current URL: ${page.url()}`);

  // Find all club links - they have href like "/clubs/123456"
  const clubLinks = await page.locator('a[href*="/clubs/"]').all();
  console.log(`Found ${clubLinks.length} club links on page`);

  const clubIds = new Set<string>();

  for (const link of clubLinks) {
    const href = await link.getAttribute('href');
    if (href) {
      // Extract club ID from href like "/clubs/117492" or "/clubs/117492/recent_activity"
      const match = href.match(/\/clubs\/(\d+)/);
      if (match) {
        clubIds.add(match[1]);
      }
    }
  }

  const ids = Array.from(clubIds);
  console.log(`Found ${ids.length} unique clubs: ${ids.join(', ')}`);

  return ids;
}

export interface KudosResult {
  given: number;
  errors: number;
  rateLimited: boolean;
  hitClubLimit: boolean;
}

function getFeedUrl(clubId?: string): string {
  if (clubId) {
    return `https://www.strava.com/clubs/${clubId}/recent_activity`;
  }
  return 'https://www.strava.com/dashboard';
}

async function scrollToLoadContent(page: Page): Promise<void> {
  const MAX_SCROLLS = 50; // Safety limit
  let previousHeight = 0;
  let scrollCount = 0;
  let noChangeCount = 0;

  console.log('Scrolling to load all activities...');

  while (scrollCount < MAX_SCROLLS) {
    // Get current page height
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(SCROLL_DELAY_MS);
    scrollCount++;

    // Check if new content loaded
    if (currentHeight === previousHeight) {
      noChangeCount++;
      // Stop if no new content after 3 consecutive scrolls
      if (noChangeCount >= 3) {
        console.log(`Finished scrolling after ${scrollCount} scrolls (no new content)`);
        break;
      }
    } else {
      noChangeCount = 0;
    }
    previousHeight = currentHeight;
  }

  if (scrollCount >= MAX_SCROLLS) {
    console.log(`Reached max scroll limit (${MAX_SCROLLS})`);
  }

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

export async function giveKudos(
  page: Page,
  clubId: string | undefined,
  maxKudos: number,
  dryRun: boolean
): Promise<KudosResult> {
  const result: KudosResult = { given: 0, errors: 0, rateLimited: false, hitClubLimit: false };

  const feedUrl = getFeedUrl(clubId);
  const feedName = clubId ? `club ${clubId}` : 'main feed';

  console.log(`\nNavigating to ${feedName}...`);
  console.log(`URL: ${feedUrl}`);

  try {
    await page.goto(feedUrl, { waitUntil: 'networkidle' });
  } catch (error) {
    const errorMsg = String(error);
    if (errorMsg.includes('ERR_CONNECTION') || errorMsg.includes('net::')) {
      console.log('⚠️  Connection closed by Strava - likely hit their limit');
      result.rateLimited = true;
      return result;
    }
    if (errorMsg.includes('Timeout') || errorMsg.includes('timeout')) {
      console.log(`⚠️  Page load timed out for ${feedName} - skipping to next club`);
      return result;
    }
    throw error;
  }
  await page.waitForTimeout(PAGE_LOAD_DELAY_MS);

  // Dismiss cookie consent banner if present
  const rejectCookiesButton = page.locator('button:has-text("Reject Non-Essential")');
  if (await rejectCookiesButton.isVisible().catch(() => false)) {
    console.log('Dismissing cookie consent banner...');
    await rejectCookiesButton.click();
    await page.waitForTimeout(500);
  }

  // Check if we landed on login page (session expired)
  if (page.url().includes('/login') || page.url().includes('/session')) {
    console.error('Session expired - redirected to login page');
    throw new Error('Session cookie expired. Please update STRAVA_SESSION with a fresh cookie.');
  }

  // Scroll to load more content
  await scrollToLoadContent(page);

  // Get initial count for logging
  const initialCount = await page.locator('svg[data-testid="unfilled_kudos"]').count();
  console.log(`Found ${initialCount} activities without kudos`);

  // Process kudos one at a time, re-querying each time to avoid stale elements
  while (true) {
    if (result.given >= maxKudos) {
      console.log(`Reached max kudos limit (${maxKudos})`);
      break;
    }

    if (result.given >= MAX_KUDOS_PER_CLUB) {
      console.log(`Reached per-club limit (${MAX_KUDOS_PER_CLUB}) - moving to next club`);
      result.hitClubLimit = true;
      break;
    }

    // Re-query for the first unfilled kudos button (fresh reference each time)
    const buttonLocator = page.locator('svg[data-testid="unfilled_kudos"]').first();
    const countBefore = await page.locator('svg[data-testid="unfilled_kudos"]').count();

    if (countBefore === 0) {
      console.log('No more activities to kudos');
      break;
    }

    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would give kudos (${result.given + 1}/${initialCount})`);
        result.given++;
        // In dry run, we need to break since we're not actually clicking
        if (result.given >= initialCount) break;
        continue;
      }

      // Click the kudos button (parent of the SVG icon)
      await buttonLocator.scrollIntoViewIfNeeded();
      const clickableParent = buttonLocator.locator('xpath=..');

      // Use JavaScript click
      await clickableParent.evaluate((el) => (el as HTMLElement).click());

      // Wait for count to decrease (poll up to 1 second)
      let countAfter = countBefore;
      const maxWaitMs = 1000;
      const pollIntervalMs = 150;
      let waited = 0;

      while (waited < maxWaitMs) {
        await page.waitForTimeout(pollIntervalMs);
        waited += pollIntervalMs;
        countAfter = await page.locator('svg[data-testid="unfilled_kudos"]').count();
        if (countAfter < countBefore) {
          break; // Count decreased, kudos worked
        }
      }

      // Verify: if count decreased, kudos was given
      if (countAfter < countBefore) {
        console.log(`✓ Gave kudos (${result.given + 1}/${initialCount})`);
        result.given++;
        result.errors = 0; // Reset consecutive errors
      } else {
        console.log(`✗ Kudos rejected (${result.given + 1}/${initialCount}) - rate limited`);
        result.errors++;

        if (result.errors >= 3) {
          console.log('⛔ 3 consecutive rejections - stopping (rate limited)');
          result.rateLimited = true;
          break;
        }
      }

      // Minimal delay between kudos for speed
      await page.waitForTimeout(randomDelay(KUDOS_DELAY_MIN_MS, KUDOS_DELAY_MAX_MS));

    } catch (error) {
      const errorMsg = String(error);
      console.error(`Error giving kudos: ${error}`);
      result.errors++;
      if (result.errors >= 3) {
        console.log('⛔ 3 consecutive errors - stopping');
        break;
      }
    }
  }

  return result;
}

export async function giveKudosToAllFeeds(
  page: Page,
  clubIds: string[],
  maxKudos: number,
  dryRun: boolean
): Promise<KudosResult> {
  const totalResult: KudosResult = { given: 0, errors: 0, rateLimited: false, hitClubLimit: false };
  let remainingKudos = maxKudos;

  // If no club IDs specified, just process the main feed
  const feedsToProcess = clubIds.length > 0 ? clubIds : [undefined];

  for (const clubId of feedsToProcess) {
    if (remainingKudos <= 0) {
      console.log('Max kudos reached, stopping');
      break;
    }

    const result = await giveKudos(page, clubId, remainingKudos, dryRun);

    totalResult.given += result.given;
    totalResult.errors += result.errors;
    remainingKudos -= result.given;

    // If rate limited, stop completely
    if (result.rateLimited) {
      console.log('\n🛑 Rate limited by Strava - stopping completely');
      console.log('   Wait 1-24 hours before trying again');
      totalResult.rateLimited = true;
      break;
    }

    // No delay between clubs - maximum speed
  }

  return totalResult;
}
