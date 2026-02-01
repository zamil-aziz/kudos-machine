import { execSync, exec, spawn } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const execAsync = promisify(exec);

const ADB_TIMEOUT_MS = 5000;  // Allow time for slow emulator responses

export interface DeviceInfo {
  id: string;
  state: 'device' | 'offline' | 'unauthorized';
}

export interface UiElement {
  text: string;
  resourceId: string;
  className: string;
  contentDesc: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  clickable: boolean;
}

/**
 * Check if ADB is available
 */
export function isAdbAvailable(): boolean {
  try {
    execSync('adb version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * List connected devices
 */
export function listDevices(): DeviceInfo[] {
  try {
    const output = execSync('adb devices', { encoding: 'utf-8' });
    const lines = output.split('\n').slice(1); // Skip header

    return lines
      .filter(line => line.trim())
      .map(line => {
        const [id, state] = line.split('\t');
        return { id: id.trim(), state: state?.trim() as DeviceInfo['state'] };
      })
      .filter(d => d.id && d.state);
  } catch {
    return [];
  }
}

/**
 * Check if emulator is running and ready
 */
export function isEmulatorReady(): boolean {
  const devices = listDevices();
  return devices.some(d => d.state === 'device' && d.id.includes('emulator'));
}

/**
 * Check if any physical device is connected (not emulator)
 */
export function isPhysicalDeviceReady(): boolean {
  const devices = listDevices();
  return devices.some(d => d.state === 'device' && !d.id.includes('emulator'));
}

/**
 * Check if any device (physical or emulator) is connected and ready
 */
export function isAnyDeviceReady(): boolean {
  const devices = listDevices();
  return devices.some(d => d.state === 'device');
}

/**
 * Get the device type currently connected
 * Returns 'physical' if a physical device is connected, 'emulator' if an emulator is running, null otherwise
 * Physical devices are preferred over emulators
 */
export function getDeviceType(): 'physical' | 'emulator' | null {
  if (isPhysicalDeviceReady()) return 'physical';
  if (isEmulatorReady()) return 'emulator';
  return null;
}

/**
 * Check if the connected device is responsive (not a zombie)
 * A zombie device shows as connected but ADB commands hang
 * Works for both physical devices and emulators
 */
export function isDeviceResponsive(timeoutMs = 5000): boolean {
  try {
    execSync('adb shell echo "health_check"', {
      stdio: 'pipe',
      timeout: timeoutMs
    });
    return true;
  } catch {
    return false;
  }
}

// Alias for backward compatibility
export const isEmulatorResponsive = isDeviceResponsive;

/**
 * Get screen dimensions from connected device
 * Returns width and height in pixels
 */
export function getScreenDimensions(): { width: number; height: number } {
  try {
    const output = execSync('adb shell wm size', {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 5000
    });
    // Parse: "Physical size: 1080x2460" or "Override size: 1080x2460"
    const match = output.match(/(\d+)x(\d+)/);
    if (match) {
      return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
    }
  } catch {
    // Fall through to default
  }
  // Default to emulator dimensions if detection fails
  return { width: 1344, height: 2992 };
}

/**
 * Find the Android emulator binary path
 * Checks ANDROID_HOME, ANDROID_SDK_ROOT, and common installation locations
 */
function findEmulatorPath(): string | null {
  // Check environment variables first
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (androidHome) {
    const emulatorPath = join(androidHome, 'emulator', 'emulator');
    if (existsSync(emulatorPath)) return emulatorPath;
  }

  // Common macOS location (Android Studio default)
  const macPath = join(homedir(), 'Library', 'Android', 'sdk', 'emulator', 'emulator');
  if (existsSync(macPath)) return macPath;

  // Common Linux locations
  const linuxPaths = [
    join(homedir(), 'Android', 'Sdk', 'emulator', 'emulator'),
    '/usr/local/share/android-sdk/emulator/emulator',
  ];
  for (const p of linuxPaths) {
    if (existsSync(p)) return p;
  }

  return null;
}

/**
 * Set the emulator window position before starting
 * Modifies the emulator-user.ini file for the specified AVD
 */
function setEmulatorWindowPosition(avdName: string, x: number, y: number): void {
  const iniPath = join(homedir(), '.android', 'avd', `${avdName}.avd`, 'emulator-user.ini');

  if (!existsSync(iniPath)) {
    // Create the file if it doesn't exist
    writeFileSync(iniPath, `window.x = ${x}\nwindow.y = ${y}\n`);
    return;
  }

  let content = readFileSync(iniPath, 'utf-8');

  // Update or add window.x
  if (content.includes('window.x')) {
    content = content.replace(/window\.x\s*=\s*\d+/, `window.x = ${x}`);
  } else {
    content += `\nwindow.x = ${x}`;
  }

  // Update or add window.y
  if (content.includes('window.y')) {
    content = content.replace(/window\.y\s*=\s*\d+/, `window.y = ${y}`);
  } else {
    content += `\nwindow.y = ${y}`;
  }

  writeFileSync(iniPath, content);
}

/**
 * Start an Android emulator by AVD name
 * Returns true if started successfully
 */
export async function startEmulator(avdName: string = 'Pixel_8_Pro'): Promise<boolean> {
  const emulatorPath = findEmulatorPath();
  if (!emulatorPath) {
    console.error('Could not find Android emulator. Set ANDROID_HOME or install Android Studio.');
    return false;
  }

  // Kill any zombie emulators first
  try {
    execSync('pkill -9 -f "qemu-system-aarch64"', { stdio: 'pipe' });
    console.log('Cleaned up zombie emulator processes');
    await delay(2000);
  } catch {
    // No zombie processes to kill
  }

  // Kill ADB server to clear stale connections
  try {
    execSync('adb kill-server', { stdio: 'pipe', timeout: 5000 });
  } catch {
    // Server may already be dead
  }

  console.log(`Starting emulator: ${avdName}...`);

  // Position window on right side of screen (x=1100 for Retina point coordinates)
  setEmulatorWindowPosition(avdName, 1100, 100);

  // Start emulator in background (detached), headless mode saves ~100MB RAM
  const child = spawn(emulatorPath, ['-avd', avdName, '-no-window'], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  // Wait for emulator to boot (poll for boot_completed)
  const maxWaitMs = 120000; // 2 minutes max
  const pollInterval = 3000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await delay(pollInterval);

    // Check if device is connected
    if (!isEmulatorReady()) continue;

    // Check if boot completed
    try {
      const bootStatus = execSync('adb shell getprop sys.boot_completed', {
        encoding: 'utf-8',
        stdio: 'pipe'
      }).trim();
      if (bootStatus === '1') {
        console.log('Emulator booted successfully');

        // Wait for ADB connection to stabilize
        console.log('Waiting for ADB to stabilize...');
        await delay(2000);

        // Verify basic ADB commands work
        for (let i = 0; i < 3; i++) {
          try {
            execSync('adb shell echo "ready"', { stdio: 'pipe', timeout: 3000 });
            break;
          } catch {
            if (i < 2) await delay(1000);
            else {
              console.error('ADB connection unstable after boot');
              return false;
            }
          }
        }

        // Wait for UIAutomator service to be ready (takes longer than basic ADB)
        console.log('Waiting for UIAutomator service...');
        for (let i = 0; i < 5; i++) {
          try {
            execSync('adb shell uiautomator dump /sdcard/test_dump.xml', {
              stdio: 'pipe',
              timeout: 10000
            });
            console.log('Emulator ready');
            return true;
          } catch {
            if (i < 4) {
              console.log(`UIAutomator not ready (attempt ${i + 1}/5), waiting...`);
              await delay(2000);
            }
          }
        }

        console.error('UIAutomator service failed to initialize');
        return false;
      }
    } catch {
      // Device not ready yet
    }
  }

  console.error('Emulator failed to boot within timeout');
  return false;
}

/**
 * Run an ADB shell command
 */
export async function shell(command: string): Promise<string> {
  const { stdout } = await execAsync(`adb shell ${command}`, {
    timeout: ADB_TIMEOUT_MS,
    encoding: 'utf-8'
  });
  return stdout;
}

/**
 * Tap at coordinates
 */
export async function tap(x: number, y: number): Promise<void> {
  await shell(`input tap ${Math.round(x)} ${Math.round(y)}`);
}

/**
 * Swipe/scroll gesture
 */
export async function swipe(
  x1: number, y1: number,
  x2: number, y2: number,
  durationMs: number = 300
): Promise<void> {
  await shell(`input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${durationMs}`);
}

// Current screen dimensions for scroll calculations
let currentScreenWidth = 1344;
let currentScreenHeight = 2992;

/**
 * Set screen dimensions for scroll calculations
 * Called from emulator-kudos.ts after detecting device
 */
export function setScreenDimensions(width: number, height: number): void {
  currentScreenWidth = width;
  currentScreenHeight = height;
}

/**
 * Scroll down on the screen
 * Uses current screen dimensions (auto-detected or default 1344x2992)
 */
export async function scrollDown(distance: number = 500, durationMs: number = 100): Promise<void> {
  // Swipe from middle area to scroll down
  const centerX = Math.round(currentScreenWidth / 2);
  const startY = Math.round(currentScreenHeight * 0.6);  // 60% from top
  await swipe(centerX, startY, centerX, startY - distance, durationMs);
}

/**
 * Send media pause command to pause any playing video
 */
export async function sendMediaPause(): Promise<void> {
  await shell('input keyevent KEYCODE_MEDIA_PAUSE');
}

/**
 * Launch an app by package name
 */
export async function launchApp(packageName: string, activity?: string): Promise<void> {
  if (activity) {
    await shell(`am start -n ${packageName}/${activity}`);
  } else {
    await shell(`monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);
  }
}

/**
 * Check if an app is in foreground
 */
export async function isAppInForeground(packageName: string): Promise<boolean> {
  try {
    const output = await shell('dumpsys window | grep -E "mCurrentFocus|mFocusedApp"');
    return output.includes(packageName);
  } catch {
    return false;
  }
}

export interface DumpUiOptions {
  quickFail?: boolean;  // Use shorter timeout/retries for video detection
}

/**
 * Dump UI hierarchy and return parsed elements
 * Includes retry logic to handle UIAutomator timeouts after many rapid calls
 */
export async function dumpUi(options: DumpUiOptions = {}): Promise<UiElement[]> {
  const tmpFile = '/sdcard/window_dump.xml';
  const localFile = join(process.cwd(), '.tmp_ui_dump.xml');

  // Quick fail mode: 2 retries, 5s timeout, 200ms delay (for video detection/verification)
  // Normal mode: 4 retries, 10s timeout, 1s delay (for app launch/navigation)
  const maxRetries = options.quickFail ? 2 : 4;
  const timeoutMs = options.quickFail ? 5000 : 10000;
  const retryDelayMs = options.quickFail ? 200 : 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Dump UI hierarchy to file on device
      await execAsync(`adb shell uiautomator dump ${tmpFile}`, {
        timeout: timeoutMs,
        encoding: 'utf-8'
      });

      // Pull the file
      execSync(`adb pull ${tmpFile} "${localFile}"`, { stdio: 'pipe' });

      // Read and parse
      const xml = readFileSync(localFile, 'utf-8');
      return parseUiHierarchy(xml);
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(`⚠ UI dump failed (attempt ${attempt}/${maxRetries}), retrying...`);
        await delay(retryDelayMs);
      } else {
        throw new Error(`UI dump failed after ${maxRetries} attempts: ${error}`);
      }
    } finally {
      // Cleanup
      try {
        unlinkSync(localFile);
      } catch { /* ignore */ }
    }
  }
  return []; // Unreachable but satisfies TypeScript
}

/**
 * Parse UI hierarchy XML into structured elements
 */
function parseUiHierarchy(xml: string): UiElement[] {
  const elements: UiElement[] = [];

  // Simple regex-based parsing for node elements
  const nodeRegex = /<node([^>]+)\/?>|<node([^>]+)>/g;
  let match;

  while ((match = nodeRegex.exec(xml)) !== null) {
    const attrs = match[1] || match[2];

    const text = extractAttr(attrs, 'text');
    const resourceId = extractAttr(attrs, 'resource-id');
    const className = extractAttr(attrs, 'class');
    const contentDesc = extractAttr(attrs, 'content-desc');
    const boundsStr = extractAttr(attrs, 'bounds');
    const clickable = extractAttr(attrs, 'clickable') === 'true';

    // Parse bounds like "[0,0][1080,1920]"
    const boundsMatch = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (boundsMatch) {
      elements.push({
        text,
        resourceId,
        className,
        contentDesc,
        bounds: {
          x1: parseInt(boundsMatch[1], 10),
          y1: parseInt(boundsMatch[2], 10),
          x2: parseInt(boundsMatch[3], 10),
          y2: parseInt(boundsMatch[4], 10),
        },
        clickable,
      });
    }
  }

  return elements;
}

/**
 * Extract attribute value from XML attributes string
 */
function extractAttr(attrs: string, name: string): string {
  const regex = new RegExp(`${name}="([^"]*)"`, 'i');
  const match = attrs.match(regex);
  return match ? match[1] : '';
}

/**
 * Find elements by text (partial match)
 */
export function findByText(elements: UiElement[], text: string): UiElement[] {
  const lowerText = text.toLowerCase();
  return elements.filter(el =>
    el.text.toLowerCase().includes(lowerText) ||
    el.contentDesc.toLowerCase().includes(lowerText)
  );
}

/**
 * Find elements by resource ID (partial match)
 */
export function findByResourceId(elements: UiElement[], id: string): UiElement[] {
  return elements.filter(el => el.resourceId.includes(id));
}

/**
 * Get center coordinates of an element's bounds
 */
export function getCenter(el: UiElement): { x: number; y: number } {
  return {
    x: (el.bounds.x1 + el.bounds.x2) / 2,
    y: (el.bounds.y1 + el.bounds.y2) / 2,
  };
}

/**
 * Tap on an element
 */
export async function tapElement(el: UiElement): Promise<void> {
  const center = getCenter(el);
  await tap(center.x, center.y);
}

/**
 * Wait for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for an element to appear
 */
export async function waitForElement(
  matcher: (elements: UiElement[]) => UiElement | undefined,
  timeoutMs: number = 10000,
  pollIntervalMs: number = 500
): Promise<UiElement | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const elements = await dumpUi();
    const found = matcher(elements);
    if (found) return found;
    await delay(pollIntervalMs);
  }

  return null;
}

/**
 * Disable Android animations for faster UI automation
 * This significantly reduces wait times between UI transitions
 * Note: Requires WRITE_SECURE_SETTINGS permission, which is only available
 * on emulators or rooted devices. Fails silently on physical devices.
 */
export async function disableAnimations(): Promise<void> {
  try {
    await shell('settings put global window_animation_scale 0');
    await shell('settings put global transition_animation_scale 0');
    await shell('settings put global animator_duration_scale 0');
  } catch {
    // Physical devices don't have WRITE_SECURE_SETTINGS permission
    // This is fine - animations will just be slower
    console.log('Note: Could not disable animations (requires special permissions)');
  }
}

/**
 * Kill all running emulators and clean up orphaned processes
 * Handles zombie emulators where ADB commands hang
 */
export async function killEmulator(): Promise<void> {
  // Get all connected emulators
  const devices = listDevices();
  const emulators = devices.filter(d => d.id.includes('emulator'));

  // Kill each emulator with timeout (handles zombies that hang on ADB commands)
  for (const emu of emulators) {
    try {
      execSync(`adb -s ${emu.id} emu kill`, { stdio: 'pipe', timeout: 5000 });
      console.log(`Emulator ${emu.id} killed`);
    } catch {
      // ADB command timed out or failed - will force kill below
      console.log(`ADB kill failed for ${emu.id}, will force kill`);
    }
  }

  // Force kill any remaining emulator processes (qemu)
  // This handles zombies where ADB commands hang
  try {
    execSync('pkill -9 -f "qemu-system-aarch64"', { stdio: 'pipe' });
    console.log('Force killed emulator processes');
  } catch {
    // No emulator processes to kill
  }

  if (emulators.length > 0) {
    // Wait for emulator processes to fully terminate
    await delay(3000);
  }

  // Clean up orphaned crashpad_handler processes left by emulator
  // Run twice with delay to catch processes spawned during shutdown
  try {
    execSync('pkill -f crashpad_handler', { stdio: 'pipe' });
  } catch {
    // No crashpad processes to kill
  }

  await delay(500);

  try {
    execSync('pkill -f crashpad_handler', { stdio: 'pipe' });
  } catch {
    // No crashpad processes to kill
  }

  // Kill ADB server to clear stale connections
  try {
    execSync('adb kill-server', { stdio: 'pipe', timeout: 5000 });
  } catch {
    // Server may already be dead
  }
}
