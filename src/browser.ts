import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function launchBrowser(sessionCookie: string): Promise<BrowserSession> {
  console.log('Launching browser...');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  // Inject the Strava session cookie before any navigation
  await context.addCookies([
    {
      name: '_strava4_session',
      value: sessionCookie,
      domain: '.strava.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  console.log('Browser launched with session cookie injected');

  return { browser, context, page };
}

export async function closeBrowser(session: BrowserSession): Promise<void> {
  console.log('Closing browser...');
  await session.browser.close();
}

