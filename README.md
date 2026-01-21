# Kudos Machine

Automatically give kudos to Strava club members' activities using Playwright browser automation.

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
# Using Bun
STRAVA_SESSION="your_cookie" bun start

# Using npm
STRAVA_SESSION="your_cookie" npm start
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRAVA_SESSION` | Yes | - | The `_strava4_session` cookie value |
| `CLUB_IDS` | No | auto-fetch | Comma-separated club IDs |
| `MAX_KUDOS_PER_RUN` | No | 100 | Maximum kudos per run |
| `DRY_RUN` | No | false | Log actions without clicking |

### Examples

```bash
# Give kudos to all your clubs (auto-detected)
STRAVA_SESSION="abc123" bun start

# Limit to 50 kudos
STRAVA_SESSION="abc123" MAX_KUDOS_PER_RUN=50 bun start

# Specific clubs only
STRAVA_SESSION="abc123" CLUB_IDS="117492,470584" bun start

# Dry run (test without actually giving kudos)
STRAVA_SESSION="abc123" DRY_RUN=true bun start
```

## Rate Limits

Strava limits kudos to ~100 per burst. See [CLAUDE.md](CLAUDE.md) for detailed findings.

**Safe usage:** 100 kudos per run, once or twice per day.

## Cookie Expiration

The session cookie expires every 1-2 weeks. When it expires, you'll see "Session expired" in the output. Just grab a fresh cookie from your browser.

## Disclaimer

This tool violates Strava's Terms of Service. Use at your own risk.

## License

MIT
