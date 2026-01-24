import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

const ADB_TIMEOUT_MS = 10000;

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

/**
 * Scroll down on the screen
 * Uses coordinates for 1344x2992 screen (center X = 672)
 */
export async function scrollDown(distance: number = 500, durationMs: number = 100): Promise<void> {
  // Swipe from middle-bottom to middle-top
  // Screen is 1344x2992, center X is 672, start from Y ~1800
  await swipe(672, 1800, 672, 1800 - distance, durationMs);
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

/**
 * Dump UI hierarchy and return parsed elements
 * Includes retry logic to handle UIAutomator timeouts after many rapid calls
 */
export async function dumpUi(): Promise<UiElement[]> {
  const tmpFile = '/sdcard/window_dump.xml';
  const localFile = join(process.cwd(), '.tmp_ui_dump.xml');

  const maxRetries = 3;
  const retryDelayMs = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Dump UI hierarchy to file on device
      await shell(`uiautomator dump ${tmpFile}`);

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
