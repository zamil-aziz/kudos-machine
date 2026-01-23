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
# Standard run (runs until rate limited)
STRAVA_SESSION="your_cookie" bun start

# With a limit
STRAVA_SESSION="your_cookie" MAX_KUDOS_PER_RUN=50 bun start

# Dry run (test without giving kudos)
STRAVA_SESSION="your_cookie" DRY_RUN=true bun start

# Or use npm if bun not installed
STRAVA_SESSION="your_cookie" npm start
```
