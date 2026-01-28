# Kudos Machine

Automatically give kudos to Strava club members' activities using dual-platform automation: browser (Playwright) + mobile (Android emulator). Combined potential: **300-400+ kudos per run**.

## How It Works

```
┌─────────────────┐     rate limit     ┌──────────────────┐
│  Browser Phase  │ ──────────────────▶│  Mobile Fallback │
│   (Playwright)  │                    │ (Android Emulator)│
└─────────────────┘                    └──────────────────┘
   ~130 kudos                              ~130 kudos
```

1. **Browser Phase** runs first
   - Injects session cookie, navigates your clubs (shuffled randomly)
   - Gives kudos with 2-4s delays between clicks
   - Switches clubs after 30 kudos each (with 4-7 min delay), stops on rate limit

2. **Mobile Fallback** activates when browser hits rate limit
   - Uses separate rate limit bucket
   - Fire-and-forget mode (20-40ms between taps)
   - Restarts emulator every 100 kudos to reset limits

## Setup

### 1. Install Dependencies

```bash
# Using Bun (recommended)
bun install
bunx playwright install chromium

# Or using npm
npm install
npx playwright install chromium
```

### 2. Get Your Strava Session Cookie

1. Log into [Strava](https://www.strava.com) in Chrome
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to **Application** tab → **Cookies** → `https://www.strava.com`
4. Find the `_strava4_session` cookie and copy its **Value**

### 3. Configure Environment

Create a `.env` file:

```bash
STRAVA_SESSION=your_cookie_value_here
```

### 4. Run

```bash
bun start
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRAVA_SESSION` | Yes* | - | Session cookie (set in `.env` or env var, *not required if `MOBILE_ONLY=true`) |
| `CLUB_IDS` | No | 32 hardcoded clubs | Comma-separated club IDs to process |
| `MAX_KUDOS_PER_RUN` | No | Infinity | Stop after N kudos total |
| `DRY_RUN` | No | false | Test mode - logs without clicking |
| `MOBILE_ONLY` | No | false | Skip browser, use emulator only |
| `SKIP_MOBILE` | No | false | Disable mobile fallback |

### Examples

```bash
# Standard run (browser + mobile fallback)
bun start

# Limit to 50 kudos
MAX_KUDOS_PER_RUN=50 bun start

# Specific clubs only
CLUB_IDS="117492,470584" bun start

# Dry run (test without actually giving kudos)
DRY_RUN=true bun start

# Mobile-only (skip browser)
MOBILE_ONLY=true bun start

# Browser-only (no mobile fallback)
SKIP_MOBILE=true bun start
```

## Mobile Automation Setup (Optional)

Mobile automation provides an additional ~130 kudos when browser hits rate limit.

### Prerequisites

1. **Android Studio** with an emulator configured
   - Use **Google APIs** image, NOT Google Play (Play Store blocks automation)
   - Recommended: Pixel 8 Pro API 34
2. **ADB** installed: `brew install android-platform-tools` (macOS)
3. **Strava app** installed and logged in on the emulator

### Quick Setup

```bash
# List available emulators
emulator -list-avds

# Start emulator (script auto-starts "Pixel_8_Pro" in headless mode - no window)
emulator -avd Pixel_8_Pro -no-window

# Verify ADB sees the device
adb devices

# Install Strava APK if needed
adb install strava.apk
```

## Accept Follow Requests

Bulk accept pending follow requests:

```bash
bun run follows
```

| Variable | Default | Description |
|----------|---------|-------------|
| `DRY_RUN` | false | Test mode - logs without clicking |
| `HEADLESS` | true | Set to `false` to show browser |

Processes ~2 accepts per second. Stops after 3 consecutive failures.

## GitHub Actions (Automated Runs)

Run kudos automatically on a schedule using GitHub Actions.

### Setup

1. Push to a **public** GitHub repo (unlimited free Actions minutes)
2. Add repository secret: **Settings → Secrets → Actions → New repository secret**
   - Name: `STRAVA_SESSION`
   - Value: Your `_strava4_session` cookie
3. The workflow runs automatically every 6 hours (or trigger manually from Actions tab)

### Scripts

```bash
bun start             # Kudos: browser + mobile fallback
bun run start:web     # Kudos: browser-only (used by CI)
bun run start:mobile  # Kudos: mobile-only (local use)
bun run follows       # Accept all pending follow requests
```

## Rate Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Per-club (browser) | 30 | Auto-switches to next club |
| Per-burst (browser) | ~99 | With 2-4s delays |
| Per-burst (mobile) | 150+ | Fire-and-forget mode |
| Daily cumulative | ~750-800 | Account-wide cap |

**Safe usage:** Run once or twice per day. Wait 2+ hours between runs for full recovery.

See [CLAUDE.md](CLAUDE.md) for detailed rate limit research and findings.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Session expired" | Get a fresh cookie from your browser |
| Emulator not starting | Check `ANDROID_HOME` env var, verify AVD exists with `emulator -list-avds` |
| "ADB not found" | Install: `brew install android-platform-tools` |
| Rate limited quickly | Wait 2+ hours between runs |
| Mobile automation fails | Ensure using Google APIs image (not Play Store), Strava app logged in |
| "Could not find club" | App may have updated UI - check for script updates |
| No emulator window | Expected - runs headless. Check `adb devices` to verify it's running |

## Cookie Expiration

The session cookie expires every 1-2 weeks. When you see "Session expired" in output, grab a fresh cookie from your browser.

## License

MIT
