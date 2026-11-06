'use strict';

const path = require('path');
const { normalizeTargetUrl } = require('../utils/url');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const VALID_BROWSERS = new Set(['chromium', 'firefox', 'webkit']);

function readString(name, fallback = '') {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function readInt(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = readString(name);
  if (!raw) return fallback;

  if (!/^-?\d+$/.test(raw)) {
    throw new Error(`Invalid ${name}: "${raw}" is not an integer.`);
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}: ${value} must be between ${min} and ${max}.`);
  }

  return value;
}

function readBool(name, fallback) {
  const raw = readString(name).toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  throw new Error(`Invalid ${name}: "${raw}" must be true or false.`);
}

function readList(name, fallback = []) {
  const raw = readString(name);
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function compileRegexList(patterns, sourceName) {
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern, 'i');
    } catch (error) {
      throw new Error(`Invalid regular expression in ${sourceName}: "${pattern}" (${error.message}).`);
    }
  });
}

function readRegexList(name, fallback = []) {
  return compileRegexList(readList(name, fallback), name);
}

function readBrowser() {
  const browser = readString('BROWSER', 'chromium').toLowerCase();
  if (!VALID_BROWSERS.has(browser)) {
    throw new Error(`Invalid BROWSER: "${browser}". Use chromium, firefox, or webkit.`);
  }
  return browser;
}

let targetUrl = '';
let targetUrlError = null;

try {
  targetUrl = normalizeTargetUrl(process.env.TARGET_URL || '');
} catch (error) {
  targetUrlError = error;
}

const targetHostAllowlist = readList('TARGET_HOST_ALLOWLIST').map((item) => item.toLowerCase());

function matchesAllowedHost(hostname, pattern) {
  const host = hostname.toLowerCase();
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return host === pattern;
}

function getTargetUrl() {
  if (targetUrlError) throw targetUrlError;

  if (targetHostAllowlist.length > 0) {
    const hostname = new URL(targetUrl).hostname;
    if (!targetHostAllowlist.some((pattern) => matchesAllowedHost(hostname, pattern))) {
      throw new Error(
        `Target host "${hostname}" is not in TARGET_HOST_ALLOWLIST. ` +
          `Allowed: ${targetHostAllowlist.join(', ')}.`,
      );
    }
  }

  return targetUrl;
}

const reportsDir = path.resolve(PROJECT_ROOT, readString('REPORTS_DIR', 'reports'));
const screenshotsDir = path.resolve(PROJECT_ROOT, readString('SCREENSHOTS_DIR', 'screenshots'));

const config = {
  projectRoot: PROJECT_ROOT,
  targetUrl,
  targetUrlError,
  targetHostAllowlist,
  getTargetUrl,

  browser: readBrowser(),
  ignoreHttpsErrors: readBool('IGNORE_HTTPS_ERRORS', false),

  reportsDir,
  screenshotsDir,
  cleanOutput: readBool('CLEAN_OUTPUT', true),

  maxPages: readInt('MAX_PAGES', 10, { min: 1, max: 100 }),
  maxDepth: readInt('MAX_DEPTH', 1, { min: 1, max: 5 }),
  maxLinks: readInt('MAX_LINKS', 50, { min: 1, max: 500 }),
  maxImages: readInt('MAX_IMAGES', 50, { min: 1, max: 500 }),
  maxForms: readInt('MAX_FORMS', 10, { min: 1, max: 50 }),

  testTimeoutMs: readInt('TEST_TIMEOUT_MS', 120000, { min: 10000, max: 900000 }),
  navTimeoutMs: readInt('NAV_TIMEOUT_MS', 30000, { min: 3000, max: 300000 }),
  actionTimeoutMs: readInt('ACTION_TIMEOUT_MS', 10000, { min: 1000, max: 120000 }),
  expectTimeoutMs: readInt('EXPECT_TIMEOUT_MS', 7000, { min: 1000, max: 120000 }),
  linkCheckTimeoutMs: readInt('LINK_CHECK_TIMEOUT_MS', 15000, { min: 1000, max: 120000 }),
  renderWaitMs: readInt('RENDER_WAIT_MS', 500, { min: 0, max: 30000 }),

  skipUrlRegexes: readRegexList('SKIP_URL_PATTERNS', [
    'logout',
    'signout',
    'sign-out',
    'delete',
    'remove',
    'unsubscribe',
    'checkout',
    'place-order',
  ]),
  detectSoft404: readBool('DETECT_SOFT_404', false),

  failOnConsoleErrors: readBool('FAIL_ON_CONSOLE_ERRORS', true),
  failOnPageErrors: readBool('FAIL_ON_PAGE_ERRORS', true),
  consoleErrorIgnoreRegexes: readRegexList('CONSOLE_ERROR_IGNORE_PATTERNS'),
  pageErrorIgnoreRegexes: readRegexList('PAGE_ERROR_IGNORE_PATTERNS'),

  perfDomContentLoadedMaxMs: readInt('PERF_DOMCONTENTLOADED_MAX_MS', 6000, { min: 100, max: 600000 }),
  perfLoadMaxMs: readInt('PERF_LOAD_MAX_MS', 12000, { min: 100, max: 600000 }),
  overflowTolerancePx: readInt('OVERFLOW_TOLERANCE_PX', 2, { min: 0, max: 200 }),

  viewports: [
    { name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false },
    { name: 'tablet', width: 810, height: 1080, isMobile: false, hasTouch: true },
    { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
  ],
};

module.exports = config;
