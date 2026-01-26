# Strava Auto-Kudos - Technical Notes

Internal documentation for rate limit research, architecture details, and implementation notes.

## Quick Reference

| Limit | Value | Notes |
|-------|-------|-------|
| Per-club (browser) | 40 | Auto-switches to next club |
| Per-burst (browser) | ~99 | With 300-800ms delays |
| Per-burst (mobile) | 150+ | Fire-and-forget mode, still testing |
| Daily cumulative | ~750-800 | Account-wide, resets overnight |
| Recovery time | 2+ hours | For full rate limit reset |

---

## Architecture

### Dual-Platform Design

```
index.ts (orchestrator)
├── Browser Phase (Playwright)
│   ├── browser.ts    → Launch browser, inject session cookie
│   ├── kudos.ts      → Navigate clubs, click kudos buttons
│   └── config.ts     → Club IDs, env vars
│
└── Mobile Fallback (ADB)
    ├── adb.ts            → ADB commands, UI dump parsing
    └── emulator-kudos.ts → Strava app automation
```

### Browser Implementation

- **Authentication**: Injects `_strava4_session` cookie before navigation
- **Club navigation**: Shuffles clubs randomly, processes sequentially
- **Kudos detection**: XPath `svg[data-testid="unfilled_kudos"]`
- **Verification**: Polls DOM for count decrease (max 1s, 150ms intervals)
- **Rate limit detection**: 3 consecutive silent rejections = stop
- **Per-club limit**: 40 kudos, then auto-switch to next club
- **Delays**: 300-800ms random between kudos (reduces rate limit impact)

### Mobile Implementation

- **UI automation**: ADB + UIAutomator XML dumps
- **Fire-and-forget**: Taps all visible buttons (20-40ms delays), verifies in batch
- **Club discovery**: Scrolls entire list, stores names (not elements - bounds go stale)
- **Position tracking**: Remembers tapped Y-positions to avoid duplicates
- **Video handling**: Detects timeout, sends KEYCODE_MEDIA_PAUSE, retries
- **Rate limit reset**: Restarts emulator every 100 kudos
- **Safe Y-range**: 500-2700px (avoids header/footer overlap)

### Key Constants

**Browser (kudos.ts)**
```
KUDOS_DELAY_MIN_MS = 300
KUDOS_DELAY_MAX_MS = 800
MAX_KUDOS_PER_CLUB = 40
```

**Mobile (emulator-kudos.ts)**
```
KUDOS_DELAY_MIN_MS = 20
KUDOS_DELAY_MAX_MS = 40
KUDOS_PER_SESSION = 100
```

---

## Rate Limit Research (Jan 2026)

Based on empirical testing, here's what we learned about Strava's rate limits:

### Limits Summary

| Type | Limit | What happens |
|------|-------|--------------|
| **Per-club limit** | ~100 kudos | Hard cap per club, then moves to next |
| **Burst limit (no delays)** | ~100 kudos | 3 consecutive rejections |
| **Burst limit (with delays)** | ~130 kudos | Sporadic rejections, recovers |
| **Per-run limit** | **None** | Depends on recovery time between clubs |
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

### Multi-Club Architecture (Jan 25 Discovery)

Run #31 achieved **284 kudos** (272 browser + 12 mobile) by processing 17 clubs sequentially. Key findings:

| Club | Kudos | Outcome |
|------|-------|---------|
| 117492 | 100 | Hit per-club limit |
| 206162 etc | 0 | Page load timeouts |
| 1116447 | 76 | Ran out of activities |
| 722299 etc | 0 | Page load timeouts |
| 163112 | 96 | 3 consecutive = stop |

**The "Accidental Cooldown" Effect:**
- Page load timeouts (30s each) act as unintended recovery periods
- 11 clubs timed out = ~5+ minutes of implicit recovery
- Strava's sliding window rate limiter refills during these pauses
- Result: 2-3x more kudos than single-club runs

**Pattern:**
```
Club 1: 100 kudos → hit limit → move on
[timeouts = recovery time]
Club N: more kudos available
```

**Takeaway:** Don't "fix" page load timeouts - they're actually helping throughput by giving the rate limiter time to recover between active clubs.

### Cumulative Limit Evidence

Run #15 revealed a daily cumulative limit:
- Despite 2.5 hour wait, only got 30 kudos (vs typical ~100)
- Total for Jan 22: ~400+ kudos before #15, ~430+ after
- 3-day total: ~775 kudos
- Recovery time becomes irrelevant once cumulative cap reached
- **Confirmed:** Limit resets daily - Jan 23 run got 151 kudos after overnight wait

### Safe Operating Guidelines

- **Default limit:** None (runs until rate limited)
- **Per-club limit:** ~100 kudos before moving to next club
- **Burst limit:** ~130 kudos per burst (with delays enabled)
- **Per-run potential:** 200-300+ kudos with multi-club + recovery time
- **Between runs:** Wait 2+ hours for full recovery (1 hour may not be enough)
- **Daily potential:** ~500+ kudos reliably with delays

### Historical Runs

| Run | Kudos | Pattern |
|-----|-------|---------|
| #20 | 138 | Single club, delays working well |
| #28 | 163 | Multi-club success |
| #31 | 284 | Multi-club + timeouts = extra recovery |

---

## Cookie Notes

- Cookie name: `_strava4_session`
- Expires: Every 1-2 weeks
- Get from: Chrome DevTools → Application → Cookies → strava.com
