'use strict';

const path = require('path');
const { defineConfig } = require('@playwright/test');
const config = require('./src/config');

const chromiumLaunchOptions = {
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
};

const project = {
  name: config.browser,
  use: {
    browserName: config.browser,
    ...(config.browser === 'chromium' ? { launchOptions: chromiumLaunchOptions } : {}),
  },
};

module.exports = defineConfig({
  testDir: path.join(__dirname, 'src', 'tests'),
  testMatch: '**/*.spec.js',
  outputDir: path.join(config.reportsDir, 'test-results'),

  timeout: config.testTimeoutMs,
  expect: { timeout: config.expectTimeoutMs },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,

  reporter: [
    ['list'],
    ['json', { outputFile: path.join(config.reportsDir, 'results.json') }],
    ['html', { outputFolder: path.join(config.reportsDir, 'html'), open: 'never' }],
    [path.join(__dirname, 'src', 'utils', 'summary-reporter.js')],
  ],

  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: config.ignoreHttpsErrors,
    actionTimeout: config.actionTimeoutMs,
    navigationTimeout: config.navTimeoutMs,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    locale: 'en-US',
    timezoneId: 'UTC',
    acceptDownloads: false,
  },

  projects: [project],

  metadata: {
    tool: 'Universal Website Testing Tool',
    targetUrl: config.targetUrl || '(missing TARGET_URL)',
  },
});
