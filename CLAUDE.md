# Strava Auto-Kudos - Notes

## Rate Limit Findings (Jan 2026)

Based on testing, here's what we learned about Strava's rate limits:

### Limits

| Type | Limit | What happens |
|------|-------|--------------|
| **Burst limit** | ~100 kudos | 3 consecutive rejections |
| **Recovery** | Sliding window | Partial recovery over time (not hard reset) |
| **Daily cap** | ~300+ kudos | Slower recovery, sporadic rejections |

### Test Results

| Date | Run | Kudos | Result |
|------|-----|-------|--------|
| Jan 20 | #1 | 78 | Connection closed by Strava |
| Jan 20 | #2 (after 10 min) | 137 | 3 consecutive rejections |
| Jan 21 | #3 (stale bug) | 26 | Killed manually - 50% lost to stale elements |
| Jan 21 | #4 (stale fix) | 99 | 3 consecutive rejections |
| Jan 21 | #5 | 0 | Immediate block |
| Jan 21 | #6 | 11 | Partial recovery - sliding window |
| Jan 22 | #7 | 0 | Immediate block (club 470584) |
| Jan 22 | #8 | 96 | Switched club → worked until ~100 limit |
| **Total** | | ~447 | |

### Two Types of Blocks

1. **Connection close** (`net::ERR_CONNECTION_CLOSED`)
   - Strava kills the browser session
   - Can reconnect after ~10 min wait
   - Likely anti-bot detection

2. **Silent rejection** (kudos button doesn't change)
   - Strava ignores the click
   - Script detects via count verification
   - 3 consecutive = stop (rate limited)

### Club-Switching Behavior

- Switching clubs may help bypass immediate blocks
- Rate limit appears to be account-wide but club-switching can reset detection
- Useful when hitting immediate blocks on one club

### Safe Operating Guidelines

- **Default limit:** None (runs until rate limited)
- **Frequency:** Once or twice per day
- **Between runs:** Wait 10-15 minutes minimum
- **Daily max:** Stay under ~200 for best recovery

### Cookie Notes

- Cookie name: `_strava4_session`
- Expires: Every 1-2 weeks
- Get from: Chrome DevTools → Application → Cookies → strava.com

## Running the Script

```bash
# Standard run (runs until rate limited)
STRAVA_SESSION="your_cookie" bun start

# With a limit
STRAVA_SESSION="your_cookie" MAX_KUDOS_PER_RUN=50 bun start

# Dry run (test without giving kudos)
STRAVA_SESSION="your_cookie" DRY_RUN=true bun start

# Or use npm if bun not installed
STRAVA_SESSION="your_cookie" npm start
```
