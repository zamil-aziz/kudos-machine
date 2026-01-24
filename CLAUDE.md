# Strava Auto-Kudos - Notes

## Rate Limit Findings (Jan 2026)

Based on testing, here's what we learned about Strava's rate limits:

### Limits

| Type | Limit | What happens |
|------|-------|--------------|
| **Burst limit (no delays)** | ~100 kudos | 3 consecutive rejections |
| **Burst limit (with delays)** | 130+ kudos | Sporadic rejections, recovers |
| **Recovery** | Sliding window | Partial recovery over time (not hard reset) |
| **Daily cap** | ~750-800 kudos | Cumulative limit, severely reduced recovery |

### Two Types of Blocks

1. **Connection close** (`net::ERR_CONNECTION_CLOSED`)
   - Strava kills the browser session
   - Can reconnect after ~10 min wait
   - Likely anti-bot detection

2. **Silent rejection** (kudos button doesn't change)
   - Strava ignores the click
   - Script detects via count verification
   - 3 consecutive = stop (rate limited)

### Delay Impact (Jan 23 Discovery)

Adding delays between kudos significantly improves throughput:

| Without delays | With delays |
|----------------|-------------|
| ~100 kudos before hard stop | 130+ kudos per run |
| 3 consecutive rejections = stop | Sporadic rejections recover |
| Rate limit is count-based | Rate limit is partially speed-based |

**Run #20 results:** 138 kudos with only 3 sporadic rejections (all recovered). No 3-consecutive block triggered.

The delays allow Strava's rate limiter to "reset" between kudos, turning the hard burst limit into a soft one.

### Club-Switching Behavior

- Switching clubs sometimes bypasses immediate blocks (worked in run #8)
- But not always reliable (failed in run #10)
- Rate limit is account-wide, not per-club
- Recovery requires time, not just club changes

### Cumulative Limit Evidence

Run #15 revealed a daily cumulative limit:
- Despite 2.5 hour wait, only got 30 kudos (vs typical ~100)
- Total for Jan 22: ~400+ kudos before #15, ~430+ after
- 3-day total: ~775 kudos
- Recovery time becomes irrelevant once cumulative cap reached
- **Confirmed:** Limit resets daily - Jan 23 run got 151 kudos after overnight wait

### Safe Operating Guidelines

- **Default limit:** None (runs until rate limited)
- **Burst limit:** ~130+ kudos per run (with delays enabled)
- **Between runs:** Wait 2+ hours for full recovery (1 hour may not be enough)
- **Daily potential:** ~500+ kudos reliably with delays

### Cookie Notes

- Cookie name: `_strava4_session`
- Expires: Every 1-2 weeks
- Get from: Chrome DevTools → Application → Cookies → strava.com

## Running the Script

```bash
# Standard run (browser + mobile fallback)
STRAVA_SESSION="your_cookie" bun start

# With a limit
STRAVA_SESSION="your_cookie" MAX_KUDOS_PER_RUN=50 bun start

# Dry run (test without giving kudos)
STRAVA_SESSION="your_cookie" DRY_RUN=true bun start

# Mobile-only mode (skip browser, use emulator only)
STRAVA_SESSION="your_cookie" MOBILE_ONLY=true bun start

# Browser-only mode (disable mobile fallback)
STRAVA_SESSION="your_cookie" SKIP_MOBILE=true bun start

# Or use npm if bun not installed
STRAVA_SESSION="your_cookie" npm start
```

## Mobile Automation Setup

The script supports dual-platform automation to maximize daily kudos:
- **Browser (Playwright):** ~130 kudos per rate limit bucket
- **Mobile (Android Emulator):** ~130 kudos per rate limit bucket
- **Combined:** ~260+ kudos per day

### Prerequisites

1. **Android Studio** with an emulator configured
2. **ADB** installed (`brew install android-platform-tools`)
3. **Strava app** installed and logged in on the emulator

### Setup Steps

```bash
# List available emulators
emulator -list-avds

# Start an emulator (use Google APIs image, not Google Play)
emulator -avd <name>

# Verify ADB can see the emulator
adb devices

# Install Strava APK if needed
adb install strava.apk
```

### How It Works

1. Browser runs first, giving kudos until rate limited
2. When browser hits rate limit, script switches to mobile emulator
3. Mobile uses ADB to control the Strava app via UI automation
4. Separate rate limit buckets mean ~2x total kudos
