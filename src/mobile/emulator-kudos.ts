import * as adb from './adb';
import { getInternationalClubIds, getClubName } from '../config';

const STRAVA_PACKAGE = 'com.strava';
const KUDOS_DELAY_MIN_MS = 20;    // Fire-and-forget: faster tapping
const KUDOS_DELAY_MAX_MS = 40;    // Fire-and-forget: tighter range
const SCROLL_DELAY_MS = 30;       // Fire-and-forget: faster scrolling
const APP_LAUNCH_WAIT_MS = 2000;  // Wait for app UI to fully render
const NAV_DELAY_MS = 400;         // Fire-and-forget: faster nav
const CLUB_LOAD_DELAY_MS = 400;   // Fire-and-forget: faster club load
const KUDOS_PER_SESSION = 100;    // Restart emulator after this many kudos to reset rate limit

// Reference screen dimensions (emulator Pixel 8 Pro)
const REFERENCE_WIDTH = 1344;
const REFERENCE_HEIGHT = 2992;

// Safe Y range for kudos buttons (avoid header and bottom nav)
// These are the reference values for 2992 height, will be scaled dynamically
const REFERENCE_SAFE_Y_MIN = 500;   // Below header/toolbar area
const REFERENCE_SAFE_Y_MAX = 2700;  // Above bottom navigation

// Dynamic screen dimensions (initialized at runtime)
let screenWidth = REFERENCE_WIDTH;
let screenHeight = REFERENCE_HEIGHT;
let safeYMin = REFERENCE_SAFE_Y_MIN;
let safeYMax = REFERENCE_SAFE_Y_MAX;
let screenCenterX = REFERENCE_WIDTH / 2;  // 672 for emulator

export { startEmulator, killEmulator } from './adb';

export interface MobileKudosResult {
  given: number;
  errors: number;
  rateLimited: boolean;
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Initialize screen dimensions from connected device
 * Scales safe Y range and other coordinates proportionally
 */
function initScreenDimensions(): void {
  const dims = adb.getScreenDimensions();
  screenWidth = dims.width;
  screenHeight = dims.height;
  screenCenterX = screenWidth / 2;

  // Update adb.ts scroll dimensions as well
  adb.setScreenDimensions(screenWidth, screenHeight);

  // Scale safe Y range proportionally to screen height
  const heightRatio = screenHeight / REFERENCE_HEIGHT;
  safeYMin = Math.round(REFERENCE_SAFE_Y_MIN * heightRatio);
  // Keep ~300px margin from bottom for nav bar
  safeYMax = screenHeight - Math.round((REFERENCE_HEIGHT - REFERENCE_SAFE_Y_MAX) * heightRatio);

  console.log(`Screen: ${screenWidth}x${screenHeight}, safe Y: ${safeYMin}-${safeYMax}`);
}

// Re-export getDeviceType from adb for convenience
export { getDeviceType } from './adb';

/**
 * Check if mobile automation is available
 * Checks for physical device first (preferred), then emulator
 * Verifies the device is not just connected but actually responsive
 */
export function isMobileAvailable(): boolean {
  if (!adb.isAdbAvailable()) {
    return false;
  }

  // Check for physical device first (preferred)
  if (adb.isPhysicalDeviceReady()) {
    return adb.isDeviceResponsive();
  }

  // Fall back to emulator
  if (!adb.isEmulatorReady()) {
    return false;
  }
  return adb.isDeviceResponsive();
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
 *
 * Filters out Post kudos buttons by detecting nearby "gave kudos" text.
 * Posts show "X gave kudos" (e.g., "356 gave kudos") near the kudos button,
 * while Activities don't have this text pattern.
 */
function findKudosButtons(elements: adb.UiElement[]): adb.UiElement[] {
  // NOTE: Post detection filter DISABLED - was incorrectly filtering activities
  // The "X gave kudos" text appears on BOTH posts AND activities (showing kudos count).
  // Since we navigate to the Activities tab, everything there should be an activity.
  // Old filter used 200px threshold but activities have this text ~98px away.

  const result: adb.UiElement[] = [];

  for (const el of elements) {
    // Primary: content-desc = "Give Kudos" (exact match for unfilled)
    if (el.contentDesc === 'Give Kudos') {
      result.push(el);
      continue;
    }

    // Secondary: resource-id icon_1 that's clickable (but not already given)
    if (el.resourceId === 'com.strava:id/icon_1' &&
        el.clickable &&
        el.contentDesc !== 'Kudos Given') {
      result.push(el);
    }
  }

  return result;
}

/**
 * Check if a kudos button is "unfilled" (not yet given)
 * "Give Kudos" = unfilled, "Kudos Given" = filled
 */
function isUnfilledKudos(el: adb.UiElement): boolean {
  return el.contentDesc === 'Give Kudos';
}

/**
 * Check if a kudos button is in a safe Y range (not near header/footer)
 * This prevents accidental taps on overlapping UI elements
 * Uses dynamically calculated safe range based on screen dimensions
 */
function isInSafeYRange(el: adb.UiElement): boolean {
  const center = adb.getCenter(el);
  return center.y >= safeYMin && center.y <= safeYMax;
}

/**
 * Check if we're on a post detail page (accidentally navigated there)
 * Post detail pages have a "Post" title in the header
 */
function isOnPostDetailPage(elements: adb.UiElement[]): boolean {
  return elements.some(el =>
    el.text === 'Post' &&
    el.bounds.y1 < 400  // In the header area
  );
}

/**
 * Check if we're on a club detail page (not the clubs list)
 * Club detail page has Activities/Posts tabs but NO Groups bottom nav
 */
function isOnClubDetailPage(elements: adb.UiElement[]): boolean {
  const hasActivitiesTab = elements.some(el => el.text === 'Activities');
  const hasGroupsNav = elements.some(el => el.contentDesc === 'Groups');
  // Club detail page has Activities tab but no Groups bottom nav
  return hasActivitiesTab && !hasGroupsNav;
}

/**
 * Escape from unexpected views (post detail, activity detail, club detail, etc.)
 * Press back until we're on a recognizable main screen with bottom navigation
 *
 * IMPORTANT: Only trust the Groups bottom nav tab as proof we're on a main screen.
 * The "Activities" text appears on BOTH the clubs list AND the club detail page,
 * so it cannot be used as a safe indicator.
 */
async function escapeToSafeView(maxBackPresses: number = 3): Promise<void> {
  for (let i = 0; i < maxBackPresses; i++) {
    const elements = await adb.dumpUi();

    // Check if we're on post detail page
    if (isOnPostDetailPage(elements)) {
      console.log('Detected post detail page, pressing back...');
      await adb.shell('input keyevent KEYCODE_BACK');
      await adb.delay(500);
      continue;
    }

    // Check if we're on club detail page (has Activities but no Groups bottom nav)
    if (isOnClubDetailPage(elements)) {
      console.log('Detected club detail page, pressing back...');
      await adb.shell('input keyevent KEYCODE_BACK');
      await adb.delay(500);
      continue;
    }

    // Only trust the Groups bottom nav tab as proof we're on a main screen
    // This is definitive - it only appears on screens with bottom navigation
    const hasGroupsTab = elements.some(el => el.contentDesc === 'Groups');

    if (hasGroupsTab) {
      // We're definitely on a main screen with bottom nav
      return;
    }

    // Check for club cards (we're on clubs list)
    const hasClubTitles = elements.some(el =>
      el.resourceId === 'com.strava:id/title' &&
      el.text && el.text.length > 0 &&
      !['Clubs', 'Active', 'Challenges', 'Groups', 'Activities', 'Posts'].includes(el.text)
    );

    if (hasClubTitles) {
      // We can see actual club names, we're on clubs list
      return;
    }

    // Unknown screen, try pressing back
    console.log('On unknown screen, pressing back...');
    await adb.shell('input keyevent KEYCODE_BACK');
    await adb.delay(500);
  }
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
  console.log('Scrolling back to top...');
  const scrollStartY = Math.round(screenHeight * 0.2);  // 20% from top
  const scrollEndY = Math.round(screenHeight * 0.6);    // 60% from top
  for (let i = 0; i < 5; i++) {
    await adb.swipe(screenCenterX, scrollStartY, screenCenterX, scrollEndY, 200);
    await adb.delay(200);
  }
  await adb.delay(500);
}

/**
 * Navigate to a club by deep linking to its page via club ID
 * Bypasses the clubs list entirely — Strava's mobile app only shows ~50 clubs
 * in the "Your Clubs" list, making scroll-based discovery unreliable.
 */
async function navigateToClub(clubId: string): Promise<boolean> {
  const url = `https://www.strava.com/clubs/${clubId}`;
  await adb.shell(`am start -a android.intent.action.VIEW -d "${url}" com.strava`);
  await adb.delay(CLUB_LOAD_DELAY_MS);

  // Verify we landed on the club page (look for club-specific UI elements)
  const elements = await adb.dumpUi();
  const hasClubPage = elements.some(el =>
    el.text === 'Invite' || el.text === 'Share' || el.text === 'Overview' ||
    el.text === 'Activities' || el.text === 'Events'
  );

  if (!hasClubPage) {
    // Wait a bit longer and retry — might be loading
    await adb.delay(1000);
    const retry = await adb.dumpUi();
    const hasClubPageRetry = retry.some(el =>
      el.text === 'Invite' || el.text === 'Share' || el.text === 'Overview' ||
      el.text === 'Activities' || el.text === 'Events'
    );
    if (!hasClubPageRetry) {
      console.log(`WARNING: Deep link to club ${clubId} may not have loaded`);
      return false;
    }
  }

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
 * Give kudos to a single activity (just tap, no verification)
 */
async function giveKudosToActivity(button: adb.UiElement): Promise<void> {
  await adb.tapElement(button);
}

interface FeedKudosState {
  given: number;
  errors: number;
  rateLimited: boolean;
  processedPositions: Set<string>;
  consecutiveFailedTaps: number;  // Track silent rejections for rate limit detection
  consecutiveTapErrors: number;   // Track ADB tap failures (timeouts, etc.)
}

/**
 * Attempt to dump UI with media pause fallback
 * If the initial dump times out (likely due to video content), send a media
 * pause key event to pause any playing video, then retry the dump.
 * Uses quick fail mode for faster video detection (~5s vs ~40s).
 */
async function attemptDumpWithVideoPause(): Promise<adb.UiElement[]> {
  try {
    return await adb.dumpUi({ quickFail: true });
  } catch (firstError) {
    // Dump timed out - likely video playing
    console.log('⚠ UI dump timeout, sending media pause...');
    await adb.sendMediaPause();
    await adb.delay(150);

    try {
      return await adb.dumpUi({ quickFail: true });
    } catch {
      // Pause didn't help - will scroll past in caller
      throw new Error('Video not pauseable');
    }
  }
}

/**
 * Give kudos on the current feed - FIRE AND FORGET mode
 * No verification, just tap and count. Maximum speed.
 */
async function giveKudosOnCurrentFeed(
  state: FeedKudosState,
  maxKudos: number,
  dryRun: boolean
): Promise<FeedKudosState> {
  let noNewButtonsCount = 0;
  const maxNoNewButtons = 10;  // Slightly higher to account for video scrolls
  let consecutiveDumpFailures = 0;
  const maxDumpFailures = 5;  // Exit to next club after this many consecutive failures

  while (!state.rateLimited && state.given < maxKudos) {
    // Try to dump UI, with media pause fallback
    let elements: adb.UiElement[] = [];
    try {
      elements = await attemptDumpWithVideoPause();
      consecutiveDumpFailures = 0;  // Reset on success
    } catch (error) {
      consecutiveDumpFailures++;
      console.log(`⚠ Video detected, scrolling past (1000px)... (dump failure ${consecutiveDumpFailures}/${maxDumpFailures})`);

      if (consecutiveDumpFailures >= maxDumpFailures) {
        console.log('⚠ Too many consecutive dump failures, moving to next club');
        break;
      }

      try {
        await adb.scrollDown(1000, 150);
      } catch (scrollError) {
        // Scroll failed, count as another dump failure
        console.log('⚠ Scroll failed, will retry');
      }
      await adb.delay(200);
      continue;  // Next iteration of main loop
    }

    // Check for unexpected navigation
    if (isOnPostDetailPage(elements)) {
      await escapeToSafeView();
      continue;
    }

    // Find unfilled kudos buttons in safe range that we haven't processed yet
    const buttons = findKudosButtons(elements)
      .filter(isUnfilledKudos)
      .filter(isInSafeYRange)
      .filter(el => {
        const posKey = `${el.bounds.x1},${el.bounds.y1}`;
        return !state.processedPositions.has(posKey);
      });

    if (buttons.length === 0) {
      noNewButtonsCount++;
      if (noNewButtonsCount >= maxNoNewButtons) {
        console.log('No more activities to kudos on this feed');
        break;
      }
    } else {
      noNewButtonsCount = 0;

      // Tap all visible buttons - NO VERIFICATION
      for (const button of buttons) {
        if (state.given >= maxKudos) break;

        const center = adb.getCenter(button);
        const posKey = `${button.bounds.x1},${button.bounds.y1}`;
        state.processedPositions.add(posKey);

        if (dryRun) {
          console.log(`[DRY RUN] Would tap kudos at y=${Math.round(center.y)}`);
          state.given++;
        } else {
          try {
            await giveKudosToActivity(button);
            console.log(`✓ Kudos at y=${Math.round(center.y)} (total: ${state.given + 1})`);
            state.given++;
            state.consecutiveTapErrors = 0;  // Reset on success
          } catch (error) {
            // Tap failed (timeout or ADB error) - log and continue
            state.consecutiveTapErrors++;
            console.log(`⚠ Tap failed at y=${Math.round(center.y)} (${state.consecutiveTapErrors} consecutive)`);
            state.errors++;

            if (state.consecutiveTapErrors >= 3) {
              console.log('⚠ 3 consecutive tap failures, emulator may be unresponsive');
              break;  // Exit the button loop, will move to next club or end
            }
          }
        }

        // Minimal delay between taps
        await adb.delay(randomDelay(KUDOS_DELAY_MIN_MS, KUDOS_DELAY_MAX_MS));
      }

      // VERIFICATION: Check if taps worked BEFORE scrolling (same positions)
      // This adds ~1 dump per screen, not per kudos
      if (!dryRun && buttons.length > 0) {
        const tappedPositions = buttons.map(b => `${b.bounds.x1},${b.bounds.y1}`);

        try {
          const verifyElements = await adb.dumpUi({ quickFail: true });
          const stillUnfilled = findKudosButtons(verifyElements)
            .filter(isUnfilledKudos)
            .filter(el => {
              const posKey = `${el.bounds.x1},${el.bounds.y1}`;
              return tappedPositions.includes(posKey);
            });

          if (stillUnfilled.length > 0) {
            // Taps were rejected - adjust count and track failures
            state.given -= stillUnfilled.length;
            state.consecutiveFailedTaps += stillUnfilled.length;
            console.log(`⚠ ${stillUnfilled.length} tap(s) rejected (still unfilled) - adjusted total: ${state.given}, consecutive failures: ${state.consecutiveFailedTaps}`);

            if (state.consecutiveFailedTaps >= 3) {
              console.log('🛑 Rate limited: 3+ consecutive taps rejected');
              state.rateLimited = true;
              break;
            }
          } else {
            // All taps succeeded, reset failure counter
            state.consecutiveFailedTaps = 0;
          }
        } catch (verifyError) {
          // Verification dump failed, continue without verification
          console.log('⚠ Verification dump failed, continuing...');
        }
      }
    }

    // Scroll distance balanced for speed vs coverage (300px for physical devices)
    try {
      await adb.scrollDown(300, 100);
    } catch (scrollError) {
      // Scroll failed - continue anyway, will detect no new buttons if stuck
      console.log('⚠ Scroll failed, continuing...');
    }
  }

  return state;
}

/**
 * Main function to give kudos via mobile device
 * Supports both physical devices and emulators
 * Navigates through all clubs in the Groups tab
 */
export async function giveKudosMobile(
  maxKudos: number = Infinity,
  dryRun: boolean = false,
  excludeClubIds: string[] = []
): Promise<MobileKudosResult> {
  const result: MobileKudosResult = { given: 0, errors: 0, rateLimited: false };

  console.log('\n' + '='.repeat(50));
  console.log('Mobile Kudos Automation');
  console.log('='.repeat(50));

  // Detect device type (physical preferred over emulator)
  let deviceType = adb.getDeviceType();

  if (!deviceType) {
    // No device connected, try to start emulator
    console.log('No device detected, attempting to start emulator...');
    const started = await adb.startEmulator();
    if (!started) {
      console.error('Failed to start emulator automatically');
      console.log('Tip: Connect a physical device via USB with USB debugging enabled');
      console.log('     Or run `emulator -list-avds` to see available emulators');
      result.errors = 1;
      return result;
    }
    deviceType = 'emulator';
  }

  const devices = adb.listDevices();
  const deviceId = devices.find(d => d.state === 'device')?.id || 'unknown';

  if (deviceType === 'physical') {
    console.log(`📱 Physical device detected: ${deviceId}`);
  } else {
    console.log(`🖥️  Emulator connected: ${deviceId}`);
  }

  // Initialize screen dimensions from connected device
  initScreenDimensions();

  // Disable Android animations for faster automation
  console.log('Disabling animations...');
  await adb.disableAnimations();

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
    rateLimited: false,
    processedPositions: new Set<string>(),
    consecutiveFailedTaps: 0,
    consecutiveTapErrors: 0,
  };

  // Get international club IDs from config
  // Deep link navigation bypasses the clubs list entirely — Strava's mobile app
  // only shows ~50 clubs in "Your Clubs", making scroll-based discovery unreliable
  let clubIds = getInternationalClubIds()
    .filter(id => !excludeClubIds.includes(id));
  // Shuffle clubs to distribute kudos evenly across runs
  clubIds = clubIds.sort(() => Math.random() - 0.5);
  console.log(`Processing ${clubIds.length} international clubs via deep link (shuffled${excludeClubIds.length > 0 ? `, ${excludeClubIds.length} excluded` : ''})`);

  if (clubIds.length === 0) {
    // Fallback: just process whatever is on screen
    console.log('No clubs found, processing current feed...');
    await scrollFeed();
    state = await giveKudosOnCurrentFeed(state, maxKudos, dryRun);
  } else {
    // Process each club via deep link
    const processedClubs = new Set<string>();

    for (let clubIndex = 0; clubIndex < clubIds.length && !state.rateLimited; clubIndex++) {
      const clubId = clubIds[clubIndex];
      const clubName = getClubName(clubId);

      if (processedClubs.has(clubId)) {
        continue;
      }
      processedClubs.add(clubId);

      console.log(`\n--- Club ${clubIndex + 1}/${clubIds.length}: ${clubName} (${clubId}) ---`);

      // Navigate to club via deep link
      const entered = await navigateToClub(clubId);
      if (!entered) {
        console.log(`Failed to open club: ${clubName}`);
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

      // Check if we should restart emulator to reset rate limit bucket
      // Note: Only applicable to emulators - physical devices don't benefit from restart
      if (deviceType === 'emulator' && state.given > 0 && state.given % KUDOS_PER_SESSION === 0) {
        console.log(`\n🔄 Reached ${KUDOS_PER_SESSION} kudos, restarting emulator to reset rate limit...`);
        await adb.killEmulator();
        const restarted = await adb.startEmulator();
        if (!restarted) {
          console.error('Failed to restart emulator');
          break;
        }
        // Re-setup: disable animations, launch Strava
        initScreenDimensions();  // Re-initialize after restart
        await adb.disableAnimations();
        const relaunched = await launchStrava();
        if (!relaunched) {
          console.error('Failed to relaunch Strava after restart');
          break;
        }
        await adb.delay(APP_LAUNCH_WAIT_MS);
        clubIds = getInternationalClubIds()
            .filter(id => !excludeClubIds.includes(id));
        clubIds = clubIds.sort(() => Math.random() - 0.5);
        state.processedPositions.clear();
        state.consecutiveFailedTaps = 0;  // Reset rate limit detection for new session
        state.consecutiveTapErrors = 0;   // Reset ADB error tracking for new session
        // Reset club index to start from first club again
        clubIndex = -1; // Will be incremented to 0 at loop start
        processedClubs.clear();
        console.log(`Emulator restarted, continuing from ${state.given} kudos...`);
        continue;
      }

      // Clear processed positions when switching clubs (positions are screen-relative)
      // Different clubs have different activities at the same screen positions
      state.processedPositions.clear();
      state.consecutiveFailedTaps = 0;  // Reset rate limit detection for new club
      state.consecutiveTapErrors = 0;   // Reset ADB error tracking for new club
    }
  }

  // Update result from state
  result.given = state.given;
  result.errors = state.errors;
  result.rateLimited = state.rateLimited;

  console.log(`\nMobile kudos complete: ${result.given} given, ${result.errors} errors`);
  return result;
}
