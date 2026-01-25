export interface Config {
  stravaSession: string;
  clubIds: string[];
  maxKudosPerRun: number;
  dryRun: boolean;
  mobileOnly: boolean;    // Skip browser, use mobile emulator only
  skipMobile: boolean;    // Disable mobile fallback
}

export function loadConfig(): Config {
  const stravaSession = process.env.STRAVA_SESSION;
  const mobileOnly = process.env.MOBILE_ONLY === 'true';

  // Only require session for browser mode
  if (!stravaSession && !mobileOnly) {
    throw new Error(
      'STRAVA_SESSION environment variable is required. ' +
      'Copy the _strava4_session cookie value from Chrome DevTools. ' +
      '(Or use MOBILE_ONLY=true to skip browser mode.)'
    );
  }

  const clubIdsEnv = process.env.CLUB_IDS;
  const clubIds = clubIdsEnv
    ? clubIdsEnv.split(',').map(id => id.trim()).filter(Boolean)
    : ['117492', '206162', '529312', '277950', '1199487', '1116447', '722299', '470584', '150558', '470994', '485876', '286796', '949611', '163112', '721441', '1128193', '1524029'];

  let maxKudosPerRun = Infinity; // No limit - script stops when rate limited
  if (process.env.MAX_KUDOS_PER_RUN) {
    const parsed = parseInt(process.env.MAX_KUDOS_PER_RUN, 10);
    if (!isNaN(parsed) && parsed > 0) {
      maxKudosPerRun = parsed;
    }
  }
  const dryRun = process.env.DRY_RUN === 'true';
  const skipMobile = process.env.SKIP_MOBILE === 'true';

  return {
    stravaSession: stravaSession || '',  // Empty string OK for mobile-only
    clubIds,
    maxKudosPerRun,
    dryRun,
    mobileOnly,
    skipMobile,
  };
}
