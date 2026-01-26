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
   - Gives kudos with 300-800ms delays between clicks
   - Switches clubs after 40 kudos each, stops on rate limit

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

### 3. Run

```bash
STRAVA_SESSION="your_cookie" bun start
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRAVA_SESSION` | Yes* | - | Session cookie value (*not required if `MOBILE_ONLY=true`) |
| `CLUB_IDS` | No | 32 hardcoded clubs | Comma-separated club IDs to process |
| `MAX_KUDOS_PER_RUN` | No | Infinity | Stop after N kudos total |
| `DRY_RUN` | No | false | Test mode - logs without clicking |
| `MOBILE_ONLY` | No | false | Skip browser, use emulator only |
| `SKIP_MOBILE` | No | false | Disable mobile fallback |

### Examples

```bash
# Standard run (browser + mobile fallback)
STRAVA_SESSION="abc123" bun start

# Limit to 50 kudos
STRAVA_SESSION="abc123" MAX_KUDOS_PER_RUN=50 bun start

# Specific clubs only
STRAVA_SESSION="abc123" CLUB_IDS="117492,470584" bun start

# Dry run (test without actually giving kudos)
STRAVA_SESSION="abc123" DRY_RUN=true bun start

# Mobile-only (skip browser)
STRAVA_SESSION="abc123" MOBILE_ONLY=true bun start

# Browser-only (no mobile fallback)
STRAVA_SESSION="abc123" SKIP_MOBILE=true bun start
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

# Start emulator (script auto-starts "Pixel_8_Pro" if available)
emulator -avd Pixel_8_Pro

# Verify ADB sees the device
adb devices

# Install Strava APK if needed
adb install strava.apk
```

## Rate Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Per-club (browser) | 40 | Auto-switches to next club |
| Per-burst (browser) | ~99 | With 300-800ms delays |
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

## Cookie Expiration

The session cookie expires every 1-2 weeks. When you see "Session expired" in output, grab a fresh cookie from your browser.

## Disclaimer

This tool violates Strava's Terms of Service. Use at your own risk.

## License

MIT
