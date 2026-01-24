import * as adb from './adb';

const STRAVA_PACKAGE = 'com.strava';
const KUDOS_DELAY_MIN_MS = 1000;
const KUDOS_DELAY_MAX_MS = 2500;
const SCROLL_DELAY_MS = 400;
const APP_LAUNCH_WAIT_MS = 3000;
const NAV_DELAY_MS = 1500;
const CLUB_LOAD_DELAY_MS = 2000;

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
 * Navigate to club's activity feed (Posts tab)
 */
async function navigateToClubFeed(): Promise<boolean> {
  console.log('Looking for Posts/Activities tab...');
  const elements = await adb.dumpUi();

  // Look for Posts or Activities tab within club page
  const feedTab = elements.find(el =>
    (el.text.toLowerCase() === 'posts' ||
     el.text.toLowerCase() === 'activities' ||
     el.contentDesc.toLowerCase().includes('posts') ||
     el.contentDesc.toLowerCase().includes('activities')) &&
    el.clickable
  );

  if (feedTab) {
    await adb.tapElement(feedTab);
    await adb.delay(NAV_DELAY_MS);
    return true;
  }

  // If no explicit tab, we might already be on the feed
  console.log('No explicit Posts tab found, assuming already on feed');
  return true;
}

/**
 * Press back button to return to previous screen
 */
async function goBack(): Promise<void> {
  console.log('Going back...');
  const elements = await adb.dumpUi();

  // Look for "Navigate up" button (standard Android back in toolbar)
  const backButton = elements.find(el =>
    el.contentDesc.toLowerCase().includes('navigate up') ||
    el.contentDesc.toLowerCase().includes('back') ||
    el.resourceId.includes('back')
  );

  if (backButton) {
    await adb.tapElement(backButton);
  } else {
    // Fallback: use Android back gesture/button
    await adb.shell('input keyevent KEYCODE_BACK');
  }

  await adb.delay(NAV_DELAY_MS);
}

/**
 * Give kudos to a single activity
 * Returns true if successful, false if failed/rejected
 */
async function giveKudosToActivity(button: adb.UiElement): Promise<boolean> {
  try {
    // Tap the kudos button
    await adb.tapElement(button);
    await adb.delay(500);

    // Verify the kudos was given by checking if the button state changed
    // We re-dump the UI and check if the same area now shows "Kudos Given"
    const elements = await adb.dumpUi();

    // Look for elements near the same position
    const center = adb.getCenter(button);
    const nearbyElements = elements.filter(el => {
      const elCenter = adb.getCenter(el);
      const distance = Math.sqrt(
        Math.pow(elCenter.x - center.x, 2) +
        Math.pow(elCenter.y - center.y, 2)
      );
      return distance < 100; // Within 100 pixels
    });

    // Check if any nearby element indicates kudos was given
    // "Kudos Given" is the content-desc for filled kudos buttons
    const kudosGiven = nearbyElements.some(el => {
      return el.contentDesc === 'Kudos Given';
    });

    return kudosGiven;
  } catch (error) {
    console.error('Error tapping kudos button:', error);
    return false;
  }
}

interface FeedKudosState {
  given: number;
  errors: number;
  consecutiveErrors: number;
  rateLimited: boolean;
  processedPositions: Set<string>;
}

/**
 * Give kudos on the current feed/screen
 * Returns updated state after processing visible activities
 */
async function giveKudosOnCurrentFeed(
  state: FeedKudosState,
  maxKudos: number,
  dryRun: boolean
): Promise<FeedKudosState> {
  let noNewButtonsCount = 0;
  const maxNoNewButtons = 3; // Stop after 3 scrolls with no new buttons

  while (!state.rateLimited && state.given < maxKudos) {
    // Dump current UI
    const elements = await adb.dumpUi();

    // Find kudos buttons (findKudosButtons already filters for unfilled)
    const kudosButtons = findKudosButtons(elements)
      .filter(el => isUnfilledKudos(el));

    // Filter out already processed positions
    const newButtons = kudosButtons.filter(el => {
      const posKey = `${el.bounds.x1},${el.bounds.y1}`;
      return !state.processedPositions.has(posKey);
    });

    if (newButtons.length === 0) {
      noNewButtonsCount++;
      if (noNewButtonsCount >= maxNoNewButtons) {
        console.log('No more activities to kudos on this feed');
        break;
      }

      // Try scrolling down to find more
      console.log('No kudos buttons visible, scrolling...');
      await adb.scrollDown(600);
      await adb.delay(500);
      continue;
    }

    noNewButtonsCount = 0;

    // Take the first available button
    const button = newButtons[0];
    const posKey = `${button.bounds.x1},${button.bounds.y1}`;
    state.processedPositions.add(posKey);

    if (dryRun) {
      console.log(`[DRY RUN] Would give kudos at (${adb.getCenter(button).x}, ${adb.getCenter(button).y})`);
      state.given++;
      continue;
    }

    // Attempt to give kudos
    const success = await giveKudosToActivity(button);

    if (success) {
      state.given++;
      state.consecutiveErrors = 0;
      console.log(`✓ Gave kudos (${state.given})`);
    } else {
      state.consecutiveErrors++;
      state.errors++;
      console.log(`✗ Kudos may have been rejected (${state.consecutiveErrors} consecutive)`);

      if (state.consecutiveErrors >= 3) {
        console.log('⛔ 3 consecutive rejections - stopping (rate limited)');
        state.rateLimited = true;
        break;
      }
    }

    // Randomized delay
    await adb.delay(randomDelay(KUDOS_DELAY_MIN_MS, KUDOS_DELAY_MAX_MS));

    // Occasional longer pause
    if (Math.random() < 0.1) {
      const longPause = randomDelay(3000, 6000);
      console.log(`  ☕ Taking a ${(longPause / 1000).toFixed(1)}s break...`);
      await adb.delay(longPause);
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

      // Scroll to load content
      await scrollFeed(15); // Fewer scrolls per club

      // Give kudos on this club's feed
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
