# Strava Auto-Kudos - Notes

## Rate Limit Findings (Jan 2026)

Based on testing, here's what we learned about Strava's rate limits:

### Limits

| Type | Limit | What happens |
|------|-------|--------------|
| **Burst limit** | ~100-140 kudos | Connection closed or kudos rejected |
| **Cooldown** | ~10 minutes | Resets burst limit |
| **Daily cap** | ~200-300 kudos | 24hr ban (suspected) |

### Test Results

| Run | Kudos Given | Result |
|-----|-------------|--------|
| 1st run | 78 | Connection closed by Strava |
| After 10 min | 137 | 3 consecutive rejections (rate limited) |
| **Total** | ~215 | Likely hit 24hr ban |

### Two Types of Blocks

1. **Connection close** (`net::ERR_CONNECTION_CLOSED`)
   - Strava kills the browser session
   - Can reconnect after ~10 min wait
   - Likely anti-bot detection

2. **Silent rejection** (kudos button doesn't change)
   - Strava ignores the click
   - Script detects via count verification
   - 3 consecutive = stop (rate limited)

### Safe Operating Guidelines

- **Default limit:** 100 kudos per run
- **Frequency:** Once or twice per day
- **Between runs:** Wait 10-15 minutes minimum
- **Daily max:** Stay under ~200 to avoid 24hr ban

### Cookie Notes

- Cookie name: `_strava4_session`
- Expires: Every 1-2 weeks
- Get from: Chrome DevTools → Application → Cookies → strava.com

## Running the Script

```bash
# Standard run (100 kudos max)
STRAVA_SESSION="your_cookie" bun start

# Custom limit
STRAVA_SESSION="your_cookie" MAX_KUDOS_PER_RUN=50 bun start

# Dry run (test without giving kudos)
STRAVA_SESSION="your_cookie" DRY_RUN=true bun start

# Or use npm if bun not installed
STRAVA_SESSION="your_cookie" npm start
```
