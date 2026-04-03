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
  // Malaysian clubs
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
  // Other
  '819861': 'Copenhagen Half Marathon',
  '722299': 'Red Bull',
  '479648': 'The Running Channel',
  '470994': 'Standard Chartered KL Marathon Club',
  '721441': 'New Balance MY - Gemilang Run!',
  '1128193': 'Official Team COROS Malaysia',
  '1215073': 'AMPANG RUN',
  '487293': 'Garmin Running Malaysia',
  '1890255': 'Rise & Run Community',
  // World marathons
  '1536714': 'BMW BERLIN-MARATHON',
  '209437': 'TCS New York City Marathon',
  '227671': 'Tokyo Marathon',
  '819826': 'Copenhagen Marathon',
  '1265418': 'Antwerp Marathon',
  '1314792': 'Leuven Marathon',
  '496129': 'Austin Marathon',
  // European races
  '1510242': 'GENERALI BERLIN HALF MARATHON',
  '320457': 'London Landmarks Half Marathon',
  '296319': 'Scottish Half Marathon',
  '76005': 'Berlin Marathon',
  // Brand clubs
  '184160': 'Garmin Running',
  '546990': 'Marathon Handbook',
  '1293723': 'RunningFlanClub',
  '1918358': 'Bad at Running Run Club',
  // Brand & race clubs
  '434750': 'Paris Marathon',
  '179962': 'Asics Running',
  '1179093': 'Chicago Marathon',
  '1302791': 'Saucony Runs',
  '511492': 'BOLDERBoulder 10k',
  '1181798': 'New Balance',
  '727131': 'Asics Running Club Raipur',
  '488891': 'Saucony London 10K',
  // Previously rate limited
  '595907': 'TriathlonMania',
  '236209': 'Asics Running Club',
  '550368': 'Brooks Running PH',
  '470867': 'Asics Malaysia Running Club',
  '629112': 'HOKA Australia',
  '310922': 'Garmin Running Hungary',
  '684581': 'Garmin Century Challenge',
  '1160964': 'Clube GARMIN Brasil',
};

export function getClubName(clubId: string): string {
  return CLUB_NAMES[clubId] || clubId;
}

// All clubs: Malaysian, adidas, brand, UK races, US, Indonesia,
// world marathons, European, brand & race, previously rate-limited
export const ALL_CLUB_IDS = [
  // Malaysian clubs
  '117492',  // Kuala Lumpur Strava Runners
  '286796',  // KLCC Runners
  '470584',  // Selangor Running Club
  '150558',  // Shah Alam Running Club (SARC)
  '485876',  // TwtJogging
  '949611',  // COROS Running Malaysia
  '163112',  // Kyserun Krew
  '1524029', // Kita Pelari Malaysia
  '1043873', // Pacemakers Malaysia
  '470994',  // Standard Chartered KL Marathon Club
  '721441',  // New Balance MY - Gemilang Run!
  '1128193', // Official Team COROS Malaysia
  '1215073', // AMPANG RUN
  '487293',  // Garmin Running Malaysia
  '1890255', // Rise & Run Community
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
  // Other
  '819861',  // Copenhagen Half Marathon
  '722299',  // Red Bull
  '479648',  // The Running Channel
  // World marathons
  '1536714', // BMW BERLIN-MARATHON
  '209437',  // TCS New York City Marathon
  '227671',  // Tokyo Marathon
  '819826',  // Copenhagen Marathon
  '1265418', // Antwerp Marathon
  '1314792', // Leuven Marathon
  '496129',  // Austin Marathon
  // European races
  '1510242', // GENERALI BERLIN HALF MARATHON
  '320457',  // London Landmarks Half Marathon
  '296319',  // Scottish Half Marathon
  '76005',   // Berlin Marathon
  // Brand clubs
  '184160',  // Garmin Running
  '546990',  // Marathon Handbook
  '1293723', // RunningFlanClub
  '1918358', // Bad at Running Run Club
  // Brand & race clubs
  '434750',  // Paris Marathon
  '179962',  // Asics Running
  '1179093', // Chicago Marathon
  '1302791', // Saucony Runs
  '511492',  // BOLDERBoulder 10k
  '1181798', // New Balance
  '727131',  // Asics Running Club Raipur
  '488891',  // Saucony London 10K
  // Previously rate limited
  '595907',  // TriathlonMania
  '236209',  // Asics Running Club
  '550368',  // Brooks Running PH
  '470867',  // Asics Malaysia Running Club
  '629112',  // HOKA Australia
  '310922',  // Garmin Running Hungary
  '684581',  // Garmin Century Challenge
  '1160964', // Clube GARMIN Brasil
];

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
    : [...ALL_CLUB_IDS];

  // Shuffle for even distribution across runs
  clubIds.sort(() => Math.random() - 0.5);

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
