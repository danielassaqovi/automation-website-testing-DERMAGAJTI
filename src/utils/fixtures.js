'use strict';

const path = require('path');
const base = require('@playwright/test');
const config = require('../config');
const { createDiagnostics } = require('./diagnostics');
const { sanitizeFilename, timestamp } = require('./formatting');
const { ensureDir } = require('./fs');

/**
 * Shared test fixture:
 * - captures console/page errors from the start of every test;
 * - attaches browser diagnostics;
 * - saves a full-page screenshot into screenshots/ for every failed test.
 */
const test = base.test.extend({
  diagnostics: [
    async ({ page }, use, testInfo) => {
      const diagnostics = createDiagnostics(page);

      await use(diagnostics);

      await diagnostics.attachTo(testInfo);

      const failed = ['failed', 'timedOut', 'interrupted'].includes(testInfo.status);
      if (!failed) return;

      ensureDir(config.screenshotsDir);
      const title = testInfo.titlePath.slice(1).join(' - ') || testInfo.title;
      const filename = `${sanitizeFilename(title)}-${timestamp()}.png`;
      const screenshotPath = path.join(config.screenshotsDir, filename);

      try {
        await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 15000 });
      } catch {
        try {
          await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 10000 });
        } catch {
          return;
        }
      }

      await testInfo.attach('failure-screenshot', {
        path: screenshotPath,
        contentType: 'image/png',
      });
    },
    { auto: true },
  ],
});

module.exports = {
  test,
  expect: base.expect,
};
