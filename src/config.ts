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
  let clubIds = clubIdsEnv
    ? clubIdsEnv.split(',').map(id => id.trim()).filter(Boolean)
    : [
        // Malaysia clubs
        '117492',  // Kuala Lumpur Strava Runners
        '286796',  // KLCC Runners
        '470584',  // Selangor Running Club
        '150558',  // Shah Alam Running Club (SARC)
        '485876',  // TwtJogging
        '949611',  // COROS Running Malaysia
        '163112',  // Kyserun Krew
        '1524029', // Kita Pelari Malaysia

        // adidas clubs
        '206162',  // adidas Running UK
        '529312',  // adidas Manchester Marathon
        '277950',  // adidas 10K Paris
        '1199487', // adidas TERREX
        '1116447', // adidas Stockholm Marathon

        // UK races
        '281345',  // Great Scottish Run
        '651748',  // Great Bristol Run
        '281325',  // Great Manchester Run
        '477501',  // Cardiff Half Marathon
        '296843',  // Edinburgh Half Marathon
        '529307',  // Manchester Half Marathon
        '266031',  // Great North Run
        '281343',  // Great South Run
        '78866',   // Marathon Talk

        // US clubs
        '1307497', // Los Angeles Marathon
        '205391',  // Boston Athletic Association
        '500780',  // The San Francisco Marathon
        '15879',   // San Francisco Running Company
        '231407',  // The Strava Club
        '267501',  // Chicago Area Runners Association
        '449075',  // Fleet Feet Running Club: Chicago
        '444924',  // lululemon run club: chicago
        '239176',  // New Balance Run Club New York City
        '269512',  // Houston Half Marathon

        // Other
        '819861',  // Copenhagen Half Marathon
        '722299',  // Unknown
        '470994',  // Unknown
        '721441',  // Strava Running Club
        '1128193', // Strava Running Club
        '1335883', // Unknown
        '1215073', // Unknown
      ];

  // Shuffle clubs to distribute kudos evenly across runs
  clubIds = clubIds.sort(() => Math.random() - 0.5);

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
