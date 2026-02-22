export interface Config {
  stravaSession: string;
  clubIds: string[];
  maxKudosPerRun: number;
  dryRun: boolean;
  mobileOnly: boolean;    // Skip browser, use mobile emulator only
  skipMobile: boolean;    // Disable mobile fallback
}

// Club ID to name mapping for logging
export const CLUB_NAMES: Record<string, string> = {
  // Malaysia clubs
  '117492': 'Kuala Lumpur Strava Runners',
  '286796': 'KLCC Runners',
  '470584': 'Selangor Running Club',
  '150558': 'Shah Alam Running Club (SARC)',
  '485876': 'TwtJogging',
  '949611': 'COROS Running Malaysia',
  '163112': 'Kyserun Krew',
  '1524029': 'Kita Pelari Malaysia',
  '1043873': 'Pacemakers Malaysia',
  // adidas clubs
  '206162': 'adidas Running UK',
  '529312': 'adidas Manchester Marathon',
  '277950': 'adidas 10K Paris',
  '1199487': 'adidas TERREX',
  '1116447': 'adidas Stockholm Marathon',
  // Brand clubs
  '198445': 'Pro Direct Run Club',
  '661081': 'SportsShoes Run Club',
  // UK races
  '281345': 'Great Scottish Run',
  '651748': 'Great Bristol Run',
  '281325': 'Great Manchester Run',
  '477501': 'Cardiff Half Marathon',
  '296843': 'Edinburgh Half Marathon',
  '529307': 'Manchester Half Marathon',
  '266031': 'Great North Run',
  '281343': 'Great South Run',
  '78866': 'Marathon Talk',
  // US clubs
  '1307497': 'Los Angeles Marathon',
  '205391': 'Boston Athletic Association',
  '500780': 'The San Francisco Marathon',
  '15879': 'San Francisco Running Company',
  // '231407': 'The Strava Club',  // No activities list — wastes a club-switch delay slot
  '267501': 'Chicago Area Runners Association',
  '449075': 'Fleet Feet Running Club: Chicago',
  '444924': 'lululemon run club: chicago',
  '239176': 'New Balance Run Club New York City',
  '269512': 'Houston Half Marathon',
  // Indonesia clubs
  '1765231': 'Strava Indonesia',
  '814943': 'Indonesia Berlari',
  '1047124': 'SALOMON INDONESIA',
  '577509': 'Kalender Lari Indonesia',
  '703061': 'BUMN RUNNERS',
  '446995': 'Indorunners Surabaya',
  '290458': 'RUN ON BALI',
  '266960': 'LariKu.info',
  '279382': 'Volt and Fast',
  '67036': 'Strava Bandung',
  '144732': 'INDORUNNERS',
  '502426': 'Playon Jogja',
  // '783336': 'INDORUNNERS MAKASSAR',  // TODO: join manually — rate limited during automation
  // Other
  '819861': 'Copenhagen Half Marathon',
  '722299': 'Red Bull',
  '470994': 'Standard Chartered KL Marathon Club',
  '721441': 'New Balance MY - Gemilang Run!',
  '1128193': 'Official Team COROS Malaysia',
  '1215073': 'AMPANG RUN',
  '479648': 'The Running Channel',
  // Joined 2026-02-21 — major world marathons
  '266219': 'London Marathon',
  '1536714': 'BMW BERLIN-MARATHON',
  '209437': 'TCS New York City Marathon',
  '227671': 'Tokyo Marathon',
  '819826': 'Copenhagen Marathon',
  '1265418': 'Antwerp Marathon',
  '1314792': 'Leuven Marathon',
  '496129': 'Austin Marathon',
  // Joined 2026-02-21 — European races
  '1510242': 'GENERALI BERLIN HALF MARATHON',
  '320457': 'London Landmarks Half Marathon',
  '296319': 'Scottish Half Marathon',
  '76005': 'Berlin Marathon',
  // Joined 2026-02-21 — brand clubs
  '184160': 'Garmin Running',
  '487293': 'Garmin Running Malaysia',
  '546990': 'Marathon Handbook',
  '1293723': 'RunningFlanClub',
  '1918358': 'Bad at Running Run Club',
  '81417': 'Brooks Running',
  '512841': 'Brooks Running Europe',
  '231696': 'New Balance Run Club',
  // TODO: join later — rate limited during automation 2026-02-21
  // '76016': 'HOKA',                        // 179,702 members
  // '1035537': 'HOKA Europe',               // 87,685 members
  // '104818': 'Saucony Run Club',           // 83,276 members
  // '146083': 'HOKA UTMB Mont-Blanc',       // 57,071 members
  // '434750': 'Paris Marathon',              // 39,014 members
  // '179962': 'Asics Running',              // 13,422 members
  // '1179093': 'Chicago Marathon',           // 13,454 members
  // '278770': 'Asics Running Club SG',      // 12,785 members
  // '1302791': 'Saucony Runs',              // 10,621 members
  // '511492': 'BOLDERBoulder 10k',          // 10,671 members
  // '1181798': 'New Balance',               // 10,603 members
  // '727131': 'Asics Running Club Raipur',  // 10,410 members
  // '488891': 'Saucony London 10K',         // 7,881 members
  // '595907': 'TriathlonMania',             // 6,323 members
  // '236209': 'Asics Running Club',         // 5,605 members
  // '550368': 'Brooks Running PH',          // 4,875 members
  // '470867': 'Asics Malaysia Running Club', // 4,252 members
  // '629112': 'HOKA Australia',             // 3,836 members
  // '281945': 'HOKA LES TEMPLIERS',         // 4,385 members
  // '1310262': '10km HOKA Paris Centre',    // 3,068 members
  // '310922': 'Garmin Running Hungary',     // 3,360 members
  // '684581': 'Garmin Century Challenge',   // 2,976 members
  // '1160964': 'Clube GARMIN Brasil',       // 2,815 members
};

export function getClubName(clubId: string): string {
  return CLUB_NAMES[clubId] || clubId;
}

// Malaysian club IDs - excluded from mobile automation
export const MALAYSIAN_CLUB_IDS = [
  '117492',   // Kuala Lumpur Strava Runners
  '286796',   // KLCC Runners
  '470584',   // Selangor Running Club
  '150558',   // Shah Alam Running Club (SARC)
  '485876',   // TwtJogging
  '949611',   // COROS Running Malaysia
  '163112',   // Kyserun Krew
  '1524029',  // Kita Pelari Malaysia
  '1043873',  // Pacemakers Malaysia
  '470994',   // Standard Chartered KL Marathon Club
  '721441',   // New Balance MY - Gemilang Run!
  '1128193',  // Official Team COROS Malaysia
  '1215073',  // AMPANG RUN
  '487293',   // Garmin Running Malaysia
];

/**
 * Get international club names (excluding Malaysian clubs)
 * Used by mobile automation to avoid processing local clubs
 */
export function getInternationalClubNames(): string[] {
  return Object.entries(CLUB_NAMES)
    .filter(([id]) => !MALAYSIAN_CLUB_IDS.includes(id))
    .map(([, name]) => name);
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
        '1043873', // Pacemakers Malaysia

        // adidas clubs
        '206162',  // adidas Running UK
        '529312',  // adidas Manchester Marathon
        '277950',  // adidas 10K Paris
        '1199487', // adidas TERREX
        '1116447', // adidas Stockholm Marathon

        // Brand clubs
        '198445',  // Pro Direct Run Club
        '661081',  // SportsShoes Run Club

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
        // '231407',  // The Strava Club — no activities list
        '267501',  // Chicago Area Runners Association
        '449075',  // Fleet Feet Running Club: Chicago
        '444924',  // lululemon run club: chicago
        '239176',  // New Balance Run Club New York City
        '269512',  // Houston Half Marathon

        // Indonesia clubs
        '1765231', // Strava Indonesia
        '814943',  // Indonesia Berlari
        '1047124', // SALOMON INDONESIA
        '577509',  // Kalender Lari Indonesia
        '703061',  // BUMN RUNNERS
        '446995',  // Indorunners Surabaya
        '290458',  // RUN ON BALI
        '266960',  // LariKu.info
        '279382',  // Volt and Fast
        '67036',   // Strava Bandung
        '144732',  // INDORUNNERS
        '502426',  // Playon Jogja
        '783336',  // INDORUNNERS MAKASSAR — TODO: join manually, rate limited during automation

        // Other
        '819861',  // Copenhagen Half Marathon
        '722299',  // Red Bull
        '470994',  // Standard Chartered KL Marathon Club
        '721441',  // New Balance MY - Gemilang Run!
        '1128193', // Official Team COROS Malaysia
        '1215073', // AMPANG RUN
        '479648',  // The Running Channel

        // Joined 2026-02-21 — major world marathons
        '266219',  // London Marathon
        '1536714', // BMW BERLIN-MARATHON
        '209437',  // TCS New York City Marathon
        '227671',  // Tokyo Marathon
        '819826',  // Copenhagen Marathon
        '1265418', // Antwerp Marathon
        '1314792', // Leuven Marathon
        '496129',  // Austin Marathon

        // Joined 2026-02-21 — European races
        '1510242', // GENERALI BERLIN HALF MARATHON
        '320457',  // London Landmarks Half Marathon
        '296319',  // Scottish Half Marathon
        '76005',   // Berlin Marathon

        // Joined 2026-02-21 — brand clubs
        '184160',  // Garmin Running
        '487293',  // Garmin Running Malaysia
        '546990',  // Marathon Handbook
        '1293723', // RunningFlanClub
        '1918358', // Bad at Running Run Club
        '81417',   // Brooks Running
        '512841',  // Brooks Running Europe
        '231696',  // New Balance Run Club

        // TODO: join later — rate limited during automation 2026-02-21
        // '76016',    // HOKA — 179,702 members
        // '1035537',  // HOKA Europe — 87,685 members
        // '104818',   // Saucony Run Club — 83,276 members
        // '146083',   // HOKA UTMB Mont-Blanc — 57,071 members
        // '434750',   // Paris Marathon — 39,014 members
        // '179962',   // Asics Running — 13,422 members
        // '1179093',  // Chicago Marathon — 13,454 members
        // '278770',   // Asics Running Club SG — 12,785 members
        // '1302791',  // Saucony Runs — 10,621 members
        // '511492',   // BOLDERBoulder 10k — 10,671 members
        // '1181798',  // New Balance — 10,603 members
        // '727131',   // Asics Running Club Raipur — 10,410 members
        // '488891',   // Saucony London 10K — 7,881 members
        // '595907',   // TriathlonMania — 6,323 members
        // '236209',   // Asics Running Club — 5,605 members
        // '550368',   // Brooks Running PH — 4,875 members
        // '470867',   // Asics Malaysia Running Club — 4,252 members
        // '629112',   // HOKA Australia — 3,836 members
        // '281945',   // HOKA LES TEMPLIERS — 4,385 members
        // '1310262',  // 10km HOKA Paris Centre — 3,068 members
        // '310922',   // Garmin Running Hungary — 3,360 members
        // '684581',   // Garmin Century Challenge — 2,976 members
        // '1160964',  // Clube GARMIN Brasil — 2,815 members
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
