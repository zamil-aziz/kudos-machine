# Club Discovery & Management

## Selection Criteria

- Minimum **2,000 members** — smaller clubs don't generate enough daily activity
- Must have a visible "Recent Activity" feed (some clubs disable this)
- Skip clubs with no recent posts — they waste a club-switch delay slot

## How to Discover New Clubs

1. Navigate to `https://www.strava.com/clubs/search` or search within Strava
2. Look for running/cycling clubs with high member counts
3. Check the club page for recent activity before adding

To see which clubs the account is already in:
- Navigate to `https://www.strava.com/athlete/clubs`
- Extract club IDs from the href links (format: `/clubs/{club_id}`)

## How to Join or Leave a Club

1. Navigate to `https://www.strava.com/clubs/{club_id}`
2. Click the **Join** or **Leave** button on the club page
3. Update `src/config.ts` after joining/leaving

## Where Config Lives

All club configuration is in `src/config.ts`:

- `CLUB_NAMES` — maps club IDs to display names (used for logging)
- `ALL_CLUB_IDS` — unified pool of all clubs, used by both web and mobile
- `clubIds` array inside `loadConfig()` — defaults to `ALL_CLUB_IDS`, shuffled

When adding a new club, update both `CLUB_NAMES` and `ALL_CLUB_IDS`.

## URL Formats

- Club page: `https://www.strava.com/clubs/{club_id}`
- Recent activity: `https://www.strava.com/clubs/{club_id}/recent_activity`
- Club search: `https://www.strava.com/clubs/search`
- My clubs: `https://www.strava.com/athlete/clubs`
