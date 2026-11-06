'use strict';

const config = require('../config');

/**
 * Navigate to the target using a tolerant wait strategy.
 * - Waits for DOMContentLoaded (hard timeout).
 * - Waits for the load event, but does not fail here if a third-party resource hangs.
 * - Adds a short render settle window for client-side apps.
 */
async function gotoTarget(page, options = {}) {
  const target = options.url || config.getTargetUrl();
  const startedAt = Date.now();

  const response = await page.goto(target, {
    waitUntil: options.waitUntil || 'domcontentloaded',
    timeout: options.timeout || config.navTimeoutMs,
  });

  try {
    await page.waitForLoadState('load', {
      timeout: Math.min(config.navTimeoutMs, 20000),
    });
  } catch {
    // A slow or blocked subresource can keep the load event from firing.
    // The loading test reports the actual document.readyState.
  }

  if (config.renderWaitMs > 0) {
    await page.waitForTimeout(config.renderWaitMs);
  }

  return {
    response,
    durationMs: Date.now() - startedAt,
    finalUrl: page.url(),
  };
}

async function collectAnchors(page) {
  return page.evaluate(() => {
    const seen = new Set();
    const anchors = [];

    function isVisible(element) {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    for (const anchor of document.querySelectorAll('a[href]')) {
      const rawHref = anchor.getAttribute('href') || '';
      const absoluteHref = anchor.href || rawHref;
      const key = absoluteHref.replace(/#.*$/, '');
      if (seen.has(key)) continue;
      seen.add(key);

      anchors.push({
        rawHref,
        href: absoluteHref,
        text: (anchor.innerText || anchor.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
        ariaLabel: (anchor.getAttribute('aria-label') || '').trim(),
        target: anchor.getAttribute('target') || '',
        download: anchor.hasAttribute('download'),
        visible: isVisible(anchor),
      });
    }

    return anchors;
  });
}

async function collectNavigationLinks(page) {
  return page.evaluate(() => {
    const roots = Array.from(document.querySelectorAll('nav, [role="navigation"], header'));
    // Do not fall back to all body links: that could turn a footer link into a
    // false PASS for "primary navigation exists".
    if (roots.length === 0) return [];

    const seen = new Set();
    const links = [];

    function isVisible(element) {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    for (const scope of roots) {
      for (const anchor of scope.querySelectorAll('a[href]')) {
        if (!isVisible(anchor)) continue;
        const rawHref = anchor.getAttribute('href') || '';
        const absoluteHref = anchor.href || rawHref;
        const key = absoluteHref.replace(/#.*$/, '');
        if (seen.has(key)) continue;
        seen.add(key);

        links.push({
          text: (anchor.innerText || anchor.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
          rawHref,
          href: absoluteHref,
          ariaLabel: (anchor.getAttribute('aria-label') || '').trim(),
        });

        if (links.length >= 200) return links;
      }
    }

    return links;
  });
}

async function getNavigationTiming(page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (!navigation) return null;

    return {
      type: navigation.type,
      redirectCount: navigation.redirectCount ?? null,
      responseStartMs: Math.round(navigation.responseStart || 0),
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd || 0),
      loadMs: Math.round(navigation.loadEventEnd || 0),
      durationMs: Math.round(navigation.duration || 0),
      transferSize: navigation.transferSize ?? null,
      encodedBodySize: navigation.encodedBodySize ?? null,
      decodedBodySize: navigation.decodedBodySize ?? null,
    };
  });
}

async function scrollThroughPage(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const step = Math.max(250, Math.floor(window.innerHeight * 0.8));
    const maxSteps = 60;
    let steps = 0;

    for (let y = 0; y < document.documentElement.scrollHeight && steps < maxSteps; y += step) {
      window.scrollTo(0, y);
      await sleep(120);
      steps += 1;
    }

    window.scrollTo(0, 0);
    await sleep(300);
  });
}

async function waitForImages(page, timeoutMs = 10000) {
  try {
    await page.waitForFunction(
      () => Array.from(document.images).every((image) => image.complete),
      undefined,
      { timeout: timeoutMs },
    );
  } catch {
    // Individual image status is reported by images.spec.js.
  }
}

async function getPageMetadata(page, response) {
  return page.evaluate(
    ({ status, url }) => ({
      title: document.title,
      url: window.location.href,
      requestedUrl: url,
      httpStatus: status,
      readyState: document.readyState,
      lang: document.documentElement.getAttribute('lang'),
      charset: document.characterSet,
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      bodyTextLength: (document.body?.innerText || '').trim().length,
    }),
    { status: response ? response.status() : null, url: page.url() },
  );
}

module.exports = {
  gotoTarget,
  collectAnchors,
  collectNavigationLinks,
  getNavigationTiming,
  scrollThroughPage,
  waitForImages,
  getPageMetadata,
};
