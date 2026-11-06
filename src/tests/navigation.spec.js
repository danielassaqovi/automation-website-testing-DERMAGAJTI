'use strict';

const { test, expect } = require('../utils/fixtures');
const config = require('../config');
const {
  gotoTarget,
  collectNavigationLinks,
  getNavigationTiming,
  getPageMetadata,
} = require('../utils/page');

function formatConsoleErrors(errors) {
  return errors
    .map((entry) => `- ${entry.text}${entry.url ? ` (${entry.url})` : ''}`)
    .join('\n');
}

function formatPageErrors(errors) {
  return errors.map((entry) => `- ${entry.name}: ${entry.message}`).join('\n');
}

test.describe('Homepage, loading, and basic performance', () => {
  test('homepage is reachable and returns a successful HTTP status', async ({ page }, testInfo) => {
    const { response, durationMs, finalUrl } = await gotoTarget(page);

    expect(
      response,
      'TARGET_URL did not produce an HTTP response. Check the URL, DNS, TLS, and network access from the container.',
    ).not.toBeNull();

    const status = response.status();
    const metadata = await getPageMetadata(page, response);

    testInfo.annotations.push({ type: 'http-status', description: String(status) });

    await testInfo.attach('homepage-metadata.json', {
      body: JSON.stringify({ status, finalUrl, durationMs, ...metadata }, null, 2),
      contentType: 'application/json',
    });

    expect(
      status,
      `Expected the homepage to return HTTP < 400, but it returned HTTP ${status}.`,
    ).toBeLessThan(400);
  });

  test('homepage has a non-empty page title', async ({ page }) => {
    await gotoTarget(page);

    const title = (await page.title()).trim();

    test.info().annotations.push({ type: 'page-title', description: title || '(empty)' });
    expect(title.length, 'The page title is empty. Every page should have a meaningful <title>.').toBeGreaterThan(0);
  });

  test('page finishes loading and renders a body', async ({ page }, testInfo) => {
    const { response } = await gotoTarget(page);

    const state = await page.evaluate(() => {
      const body = document.body;
      const rect = body ? body.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        readyState: document.readyState,
        bodyWidth: Math.round(rect.width),
        bodyHeight: Math.round(rect.height),
        textLength: (body?.innerText || '').trim().length,
      };
    });

    await testInfo.attach('load-state.json', {
      body: JSON.stringify(
        {
          readyState: state.readyState,
          bodyWidth: state.bodyWidth,
          bodyHeight: state.bodyHeight,
          bodyTextLength: state.textLength,
          httpStatus: response ? response.status() : null,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    expect(
      state.readyState,
      'document.readyState never reached "complete". A slow or blocked resource may be preventing the load event.',
    ).toBe('complete');

    expect(
      state.bodyHeight,
      'The page body has no rendered height, so nothing visible was loaded.',
    ).toBeGreaterThan(0);
  });

  test('basic navigation performance stays within configured budgets', async ({ page }, testInfo) => {
    const { durationMs } = await gotoTarget(page);
    const timing = await getNavigationTiming(page);

    if (!timing) {
      test.skip(true, 'The browser Navigation Timing API is not available on this page.');
    }

    await testInfo.attach('navigation-timing.json', {
      body: JSON.stringify({ wallClockLoadMs: durationMs, ...timing }, null, 2),
      contentType: 'application/json',
    });

    expect(timing.domContentLoadedMs, 'DOMContentLoaded timing was not recorded.').toBeGreaterThan(0);
    expect(timing.loadMs, 'The load event timing was not recorded.').toBeGreaterThan(0);
    expect(
      timing.domContentLoadedMs,
      `DOMContentLoaded took ${timing.domContentLoadedMs} ms, above the ${config.perfDomContentLoadedMaxMs} ms budget.`,
    ).toBeLessThanOrEqual(config.perfDomContentLoadedMaxMs);
    expect(
      timing.loadMs,
      `The load event took ${timing.loadMs} ms, above the ${config.perfLoadMaxMs} ms budget.`,
    ).toBeLessThanOrEqual(config.perfLoadMaxMs);
  });

  test('primary navigation exists and contains usable links', async ({ page }, testInfo) => {
    await gotoTarget(page);

    const links = await collectNavigationLinks(page);

    await testInfo.attach('navigation-links.json', {
      body: JSON.stringify(links, null, 2),
      contentType: 'application/json',
    });

    if (links.length === 0) {
      test.skip(true, 'No visible navigation links were found in <nav>, [role="navigation"], or <header>.');
    }

    const invalid = links.filter((link) => {
      const raw = (link.rawHref || '').trim();
      return (
        raw === '' ||
        raw === '#' ||
        /^javascript:/i.test(raw) ||
        (!link.text && !link.ariaLabel)
      );
    });

    expect(
      invalid,
      `Found ${invalid.length} unusable navigation link(s): ${JSON.stringify(invalid, null, 2)}`,
    ).toEqual([]);
  });

  test('no JavaScript console errors on the homepage', async ({ page, diagnostics }, testInfo) => {
    await gotoTarget(page);
    await page.waitForTimeout(1000);

    const errors = diagnostics.filteredConsoleErrors(config.consoleErrorIgnoreRegexes);

    if (!config.failOnConsoleErrors) {
      test.skip(
        true,
        `FAIL_ON_CONSOLE_ERRORS=false; ${errors.length} console error(s) were collected but are not failing this test.`,
      );
    }

    expect(
      errors,
      `Found ${errors.length} console error(s):\n${formatConsoleErrors(errors)}`,
    ).toEqual([]);

    testInfo.annotations.push({ type: 'console-errors', description: '0' });
  });

  test('no uncaught page errors on the homepage', async ({ page, diagnostics }) => {
    await gotoTarget(page);
    await page.waitForTimeout(1000);

    const errors = diagnostics.filteredPageErrors(config.pageErrorIgnoreRegexes);

    if (!config.failOnPageErrors) {
      test.skip(
        true,
        `FAIL_ON_PAGE_ERRORS=false; ${errors.length} page error(s) were collected but are not failing this test.`,
      );
    }

    expect(
      errors,
      `Found ${errors.length} uncaught page error(s):\n${formatPageErrors(errors)}`,
    ).toEqual([]);
  });
});
