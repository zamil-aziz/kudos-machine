export interface Config {
  stravaSession: string;
  clubIds: string[];
  maxKudosPerRun: number;
  dryRun: boolean;
}

export function loadConfig(): Config {
  const stravaSession = process.env.STRAVA_SESSION;

  if (!stravaSession) {
    throw new Error(
      'STRAVA_SESSION environment variable is required. ' +
      'Copy the _strava4_session cookie value from Chrome DevTools.'
    );
  }

  const clubIdsEnv = process.env.CLUB_IDS;
  const clubIds = clubIdsEnv
    ? clubIdsEnv.split(',').map(id => id.trim()).filter(Boolean)
    : ['117492', '470994', '470584'];

  let maxKudosPerRun = Infinity; // No limit - script stops when rate limited
  if (process.env.MAX_KUDOS_PER_RUN) {
    const parsed = parseInt(process.env.MAX_KUDOS_PER_RUN, 10);
    if (!isNaN(parsed) && parsed > 0) {
      maxKudosPerRun = parsed;
    }
  }
  const dryRun = process.env.DRY_RUN === 'true';

  return {
    stravaSession,
    clubIds,
    maxKudosPerRun,
    dryRun,
  };
}
