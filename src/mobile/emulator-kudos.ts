import * as adb from './adb';

const STRAVA_PACKAGE = 'com.strava';
const KUDOS_DELAY_MIN_MS = 100;   // Minimal delay for speed
const KUDOS_DELAY_MAX_MS = 300;   // Reduced max
const SCROLL_DELAY_MS = 100;      // Faster scrolling
const APP_LAUNCH_WAIT_MS = 2000;  // Reduced from 3000
const NAV_DELAY_MS = 1200;        // Navigation needs more time
const CLUB_LOAD_DELAY_MS = 1200;  // Club loading needs more time

export interface MobileKudosResult {
  given: number;
  errors: number;
  rateLimited: boolean;
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Check if mobile automation is available
 */
export function isMobileAvailable(): boolean {
  if (!adb.isAdbAvailable()) {
    return false;
  }
  return adb.isEmulatorReady();
}

/**
 * Launch Strava app and wait for it to be ready
 * Force stops and relaunches to ensure we're on the home screen
 */
async function launchStrava(): Promise<boolean> {
  console.log('Force stopping Strava to ensure clean start...');

  try {
    // Force stop to ensure we start fresh on home screen
    await adb.shell('am force-stop com.strava');
    await adb.delay(1000);

    console.log('Launching Strava app...');
    await adb.launchApp(STRAVA_PACKAGE);
    await adb.delay(APP_LAUNCH_WAIT_MS);

    // Verify Strava is in foreground
    const inForeground = await adb.isAppInForeground(STRAVA_PACKAGE);
    if (!inForeground) {
      console.error('Strava did not launch successfully');
      return false;
    }

    console.log('Strava launched successfully');
    return true;
  } catch (error) {
    console.error('Failed to launch Strava:', error);
    return false;
  }
}

/**
 * Find kudos buttons in the current UI
 * Strava mobile uses content-desc="Give Kudos" for unfilled buttons
 */
function findKudosButtons(elements: adb.UiElement[]): adb.UiElement[] {
  return elements.filter(el => {
    // Primary: content-desc = "Give Kudos" (exact match for unfilled)
    if (el.contentDesc === 'Give Kudos') return true;

    // Secondary: resource-id icon_1 that's clickable (but not already given)
    if (el.resourceId === 'com.strava:id/icon_1' &&
        el.clickable &&
        el.contentDesc !== 'Kudos Given') {
      return true;
    }

    return false;
  });
}

/**
 * Check if a kudos button is "unfilled" (not yet given)
 * "Give Kudos" = unfilled, "Kudos Given" = filled
 */
function isUnfilledKudos(el: adb.UiElement): boolean {
  return el.contentDesc === 'Give Kudos';
}

/**
 * Scroll through the feed to load more content
 */
async function scrollFeed(maxScrolls: number = 30): Promise<void> {
  console.log('Scrolling to load activities...');

  let scrollCount = 0;
  let previousElementCount = 0;
  let noChangeCount = 0;

  while (scrollCount < maxScrolls) {
    // Scroll down
    await adb.scrollDown(800);
    await adb.delay(SCROLL_DELAY_MS);
    scrollCount++;

    // Check if new content loaded
    const elements = await adb.dumpUi();
    const currentElementCount = elements.length;

    if (currentElementCount === previousElementCount) {
      noChangeCount++;
      if (noChangeCount >= 3) {
        console.log(`Finished scrolling after ${scrollCount} scrolls`);
        break;
      }
    } else {
      noChangeCount = 0;
    }
    previousElementCount = currentElementCount;
  }

  // Scroll back to top with multiple swipes
  // Screen is 1344x2992, so center x is 672
  console.log('Scrolling back to top...');
  for (let i = 0; i < 5; i++) {
    await adb.swipe(672, 600, 672, 1800, 200);
    await adb.delay(200);
  }
  await adb.delay(500);
}

/**
 * Navigate to Groups tab in bottom navigation
 */
async function navigateToGroupsTab(): Promise<boolean> {
  console.log('Navigating to Groups tab...');
  const elements = await adb.dumpUi();

  // Look for Groups tab by content-desc OR resource-id
  const groupsTab = elements.find(el =>
    el.contentDesc === 'Groups' ||
    el.resourceId.includes('navigation_groups')
  );

  if (groupsTab && groupsTab.clickable) {
    await adb.tapElement(groupsTab);
    await adb.delay(NAV_DELAY_MS);
    return true;
  }

  // Fallback: tap at known position for 1344x2992 screen
  // Groups tab is at center (941, 2788)
  console.log('Groups tab not found by ID, trying position-based tap...');
  await adb.tap(941, 2788);
  await adb.delay(NAV_DELAY_MS);
  return true;
}

/**
 * Navigate to Clubs sub-tab within Groups
 * Note: Clubs is selected by default when entering Groups tab
 */
async function navigateToClubsTab(): Promise<boolean> {
  console.log('Checking Clubs sub-tab...');
  const elements = await adb.dumpUi();

  // Look for Clubs tab by content-desc or text
  const clubsTab = elements.find(el =>
    el.contentDesc === 'Clubs' ||
    (el.text === 'Clubs' && el.clickable)
  );

  if (clubsTab) {
    // Tap it to ensure it's selected (Clubs is default but tap anyway to be safe)
    console.log('Clubs tab found, tapping to ensure selected...');
    await adb.tapElement(clubsTab);
    await adb.delay(NAV_DELAY_MS);
    return true;
  }

  // Clubs tab may already be showing by default
  console.log('Clubs tab not found explicitly, assuming already on Clubs view');
  return true;
}

/**
 * Get list of visible clubs from the clubs list
 */
async function getClubsList(): Promise<adb.UiElement[]> {
  const elements = await adb.dumpUi();

  // Club cards have resource-id="com.strava:id/title" with club name as text
  const clubElements = elements.filter(el => {
    // Primary: exact resource-id match for club titles
    if (el.resourceId === 'com.strava:id/title' && el.text && el.text.length > 0) {
      // Filter out tab names and navigation elements
      const lowerText = el.text.toLowerCase();
      if (lowerText === 'clubs' || lowerText === 'active' ||
          lowerText === 'challenges' || lowerText === 'groups') {
        return false;
      }
      return true;
    }
    return false;
  });

  return clubElements;
}

/**
 * Select a club from the clubs list by name
 */
async function selectClub(clubName: string): Promise<boolean> {
  console.log(`Selecting club: ${clubName}...`);
  const elements = await adb.dumpUi();

  const clubElement = elements.find(el =>
    el.text.toLowerCase().includes(clubName.toLowerCase()) ||
    el.contentDesc.toLowerCase().includes(clubName.toLowerCase())
  );

  if (clubElement) {
    await adb.tapElement(clubElement);
    await adb.delay(CLUB_LOAD_DELAY_MS);
    return true;
  }

  console.log(`Club "${clubName}" not found`);
  return false;
}

/**
 * Tap a club element directly
 */
async function tapClub(club: adb.UiElement): Promise<boolean> {
  console.log(`Entering club: ${club.text || '(unnamed)'}...`);
  await adb.tapElement(club);
  await adb.delay(CLUB_LOAD_DELAY_MS);
  return true;
}

/**
 * Navigate to club's Activities tab (member workouts, not Posts)
 *
 * The club page has tabs with icons and text labels:
 * - The icon (background_circle) is clickable, bounds around y=1193-1373
 * - The text label is NOT clickable, bounds around y=1397-1444
 * We need to tap the icon, not the text.
 */
async function navigateToClubFeed(): Promise<boolean> {
  console.log('Looking for Activities tab...');
  const elements = await adb.dumpUi();

  // Find the "Activities" text label to locate the tab
  const activitiesText = elements.find(el => el.text === 'Activities');

  if (activitiesText) {
    // The clickable icon is directly above the text at the same X position
    // Icon bounds are approximately: same X center, but Y is ~200px higher
    const textCenter = adb.getCenter(activitiesText);

    // Find the clickable background_circle icon above the text
    // It should have the same X center (within tolerance) and be above the text
    const activitiesIcon = elements.find(el =>
      el.resourceId === 'com.strava:id/background_circle' &&
      el.clickable &&
      Math.abs(adb.getCenter(el).x - textCenter.x) < 100 && // Same X column
      el.bounds.y2 < activitiesText.bounds.y1 // Above the text
    );

    if (activitiesIcon) {
      console.log('Found Activities icon, tapping...');
      await adb.tapElement(activitiesIcon);
      await adb.delay(NAV_DELAY_MS);
      return true;
    }

    // Fallback: tap above the text label where the icon should be
    // Icon center is typically ~150px above text center
    const iconY = textCenter.y - 150;
    console.log(`Activities icon not found, tapping above text at (${textCenter.x}, ${iconY})...`);
    await adb.tap(textCenter.x, iconY);
    await adb.delay(NAV_DELAY_MS);
    return true;
  }

  // If Activities text not found, the tab might be off-screen
  console.log('Activities tab not visible, trying to scroll tab bar...');

  // Tab bar is around y=1300, swipe left to reveal more tabs
  await adb.swipe(1000, 1300, 300, 1300, 200);
  await adb.delay(500);

  // Try finding it again after scroll
  const elementsAfterScroll = await adb.dumpUi();
  const activitiesTextAfterScroll = elementsAfterScroll.find(el => el.text === 'Activities');

  if (activitiesTextAfterScroll) {
    const textCenter = adb.getCenter(activitiesTextAfterScroll);
    const iconY = textCenter.y - 150;
    console.log(`Found Activities after scroll, tapping at (${textCenter.x}, ${iconY})...`);
    await adb.tap(textCenter.x, iconY);
    await adb.delay(NAV_DELAY_MS);
    return true;
  }

  console.log('WARNING: Could not find Activities tab');
  return false;
}

/**
 * Press back button to return to clubs list
 * Need to press twice: once to exit current view, once to exit club
 */
async function goBack(): Promise<void> {
  console.log('Going back to clubs list...');

  // First back: exits current view (activity detail, etc) to club page
  await adb.shell('input keyevent KEYCODE_BACK');
  await adb.delay(500);

  // Second back: exits club page to clubs list
  await adb.shell('input keyevent KEYCODE_BACK');
  await adb.delay(NAV_DELAY_MS);
}

/**
 * Give kudos to a single activity (just tap, no verification)
 * Verification is done in batches to reduce UI dump calls
 */
async function giveKudosToActivity(button: adb.UiElement): Promise<void> {
  await adb.tapElement(button);
}

interface FeedKudosState {
  given: number;
  errors: number;
  consecutiveErrors: number;
  rateLimited: boolean;
  processedPositions: Set<string>;
}

/**
 * Give kudos on the current feed/screen using batch processing
 * Taps all visible buttons quickly with deferred rate limit detection
 * (detects failures on next iteration when previously-tapped buttons are still unfilled)
 */
async function giveKudosOnCurrentFeed(
  state: FeedKudosState,
  maxKudos: number,
  dryRun: boolean
): Promise<FeedKudosState> {
  let noNewButtonsCount = 0;
  const maxNoNewButtons = 10; // Stop after 10 scrolls with no new buttons

  while (!state.rateLimited && state.given < maxKudos) {
    // Dump current UI (one dump per batch)
    const elements = await adb.dumpUi();

    // Find kudos buttons (findKudosButtons already filters for unfilled)
    const kudosButtons = findKudosButtons(elements)
      .filter(el => isUnfilledKudos(el));

    // Filter out already processed positions
    const newButtons = kudosButtons.filter(el => {
      const posKey = `${el.bounds.x1},${el.bounds.y1}`;
      return !state.processedPositions.has(posKey);
    });

    // DEFERRED RATE LIMIT DETECTION: Check if previously tapped buttons are still unfilled
    // If buttons we tapped before are still showing "Give Kudos", our taps failed
    if (!dryRun && state.processedPositions.size > 0) {
      const stillUnfilledFromPrevious = kudosButtons.filter(el => {
        const posKey = `${el.bounds.x1},${el.bounds.y1}`;
        return state.processedPositions.has(posKey);
      });

      if (stillUnfilledFromPrevious.length >= 3) {
        console.log(`⛔ ${stillUnfilledFromPrevious.length} previous kudos still unfilled - rate limited`);
        state.rateLimited = true;
        state.errors += stillUnfilledFromPrevious.length;
        state.given -= stillUnfilledFromPrevious.length;
        break;
      } else if (stillUnfilledFromPrevious.length > 0) {
        console.log(`⚠ ${stillUnfilledFromPrevious.length} previous kudos may have failed (sporadic)`);
        state.errors += stillUnfilledFromPrevious.length;
        state.given -= stillUnfilledFromPrevious.length;
        // Remove from processedPositions so we don't double-count on next iteration
        for (const el of stillUnfilledFromPrevious) {
          const posKey = `${el.bounds.x1},${el.bounds.y1}`;
          state.processedPositions.delete(posKey);
        }
      }
    }

    if (newButtons.length === 0) {
      noNewButtonsCount++;
      if (noNewButtonsCount >= maxNoNewButtons) {
        console.log('No more activities to kudos on this feed');
        break;
      }

      // Small scroll to avoid missing activities (one activity height ~400px)
      await adb.scrollDown(400, 100);
      await adb.delay(80);
      continue;
    }

    noNewButtonsCount = 0;

    // BATCH TAP: Tap all visible buttons quickly
    for (const button of newButtons) {
      if (state.given >= maxKudos) break;

      const posKey = `${button.bounds.x1},${button.bounds.y1}`;
      state.processedPositions.add(posKey);

      if (dryRun) {
        console.log(`[DRY RUN] Would give kudos at (${adb.getCenter(button).x}, ${adb.getCenter(button).y})`);
        state.given++;
        continue;
      }

      // Tap without waiting for verification
      await giveKudosToActivity(button);
      state.given++;
      console.log(`✓ Tapped kudos (${state.given})`);

      // Brief delay between taps
      await adb.delay(randomDelay(KUDOS_DELAY_MIN_MS, KUDOS_DELAY_MAX_MS));
    }
  }

  return state;
}

/**
 * Main function to give kudos via mobile emulator
 * Navigates through all clubs in the Groups tab
 */
export async function giveKudosMobile(
  maxKudos: number = Infinity,
  dryRun: boolean = false
): Promise<MobileKudosResult> {
  const result: MobileKudosResult = { given: 0, errors: 0, rateLimited: false };

  console.log('\n' + '='.repeat(50));
  console.log('Mobile Kudos Automation');
  console.log('='.repeat(50));

  // Check if emulator is ready
  if (!adb.isEmulatorReady()) {
    console.error('No Android emulator detected. Please start an emulator first.');
    console.log('Tip: Run `emulator -list-avds` to see available emulators');
    console.log('     Then `emulator -avd <name>` to start one');
    result.errors = 1;
    return result;
  }

  const devices = adb.listDevices();
  console.log(`Connected device: ${devices[0]?.id}`);

  // Launch Strava
  const launched = await launchStrava();
  if (!launched) {
    result.errors = 1;
    return result;
  }

  // Wait for app to fully load
  await adb.delay(APP_LAUNCH_WAIT_MS);

  // Initialize state
  let state: FeedKudosState = {
    given: 0,
    errors: 0,
    consecutiveErrors: 0,
    rateLimited: false,
    processedPositions: new Set<string>(),
  };

  // Navigate to Groups tab
  const groupsOk = await navigateToGroupsTab();
  if (!groupsOk) {
    console.log('Failed to navigate to Groups tab');
    result.errors = 1;
    return result;
  }

  // Navigate to Clubs sub-tab
  const clubsOk = await navigateToClubsTab();
  if (!clubsOk) {
    console.log('Could not find Clubs tab, will try to process current view');
  }

  // Get initial list of clubs
  let clubs = await getClubsList();
  console.log(`Found ${clubs.length} clubs`);

  if (clubs.length === 0) {
    // Fallback: just process whatever is on screen
    console.log('No clubs found, processing current feed...');
    await scrollFeed();
    state = await giveKudosOnCurrentFeed(state, maxKudos, dryRun);
  } else {
    // Process each club
    const processedClubs = new Set<string>();

    for (let clubIndex = 0; clubIndex < clubs.length && !state.rateLimited; clubIndex++) {
      const club = clubs[clubIndex];
      const clubKey = club.text || `club_${clubIndex}`;

      if (processedClubs.has(clubKey)) {
        continue;
      }
      processedClubs.add(clubKey);

      console.log(`\n--- Club ${clubIndex + 1}/${clubs.length}: ${clubKey} ---`);

      // Tap the club to enter it
      const entered = await tapClub(club);
      if (!entered) {
        console.log(`Failed to enter club: ${clubKey}`);
        continue;
      }

      // Navigate to the club's activity feed
      await navigateToClubFeed();

      // Give kudos on this club's feed (scrolling happens inside)
      state = await giveKudosOnCurrentFeed(state, maxKudos, dryRun);

      if (state.rateLimited) {
        console.log('Rate limited, stopping club iteration');
        break;
      }

      // Go back to clubs list
      await goBack();
      await adb.delay(NAV_DELAY_MS);

      // Re-fetch clubs list (UI may have changed)
      clubs = await getClubsList();

      // If we got kicked back too far, re-navigate
      if (clubs.length === 0) {
        console.log('Lost clubs list, re-navigating...');
        await navigateToGroupsTab();
        await navigateToClubsTab();
        clubs = await getClubsList();
      }
    }
  }

  // Update result from state
  result.given = state.given;
  result.errors = state.errors;
  result.rateLimited = state.rateLimited;

  console.log(`\nMobile kudos complete: ${result.given} given, ${result.errors} errors`);
  return result;
}
