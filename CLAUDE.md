# Strava Auto-Kudos - Notes

## Rate Limit Findings (Jan 2026)

Based on testing, here's what we learned about Strava's rate limits:

### Limits

| Type | Limit | What happens |
|------|-------|--------------|
| **Burst limit** | ~100 kudos | 3 consecutive rejections |
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
- **Burst limit:** ~80-100 kudos per run
- **Between runs:** Wait 2+ hours for full recovery (1 hour may not be enough)
- **Daily potential:** ~400-500 kudos reliably, diminishing returns after ~600

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
