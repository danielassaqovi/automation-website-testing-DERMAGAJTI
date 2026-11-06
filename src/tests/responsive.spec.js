'use strict';

const path = require('path');
const { test, expect } = require('../utils/fixtures');
const config = require('../config');
const { gotoTarget } = require('../utils/page');
const { ensureDir } = require('../utils/fs');
const { sanitizeFilename, timestamp } = require('../utils/formatting');

for (const viewport of config.viewports) {
  test.describe(`Responsive layout - ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      screen: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.hasTouch,
      ...(config.browser === 'chromium' ? { isMobile: viewport.isMobile } : {}),
    });

    test(`renders without horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await gotoTarget(page);

      const layout = await page.evaluate(() => {
        const documentElement = document.documentElement;
        const body = document.body;
        const clientWidth = documentElement.clientWidth;
        const scrollWidth = Math.max(documentElement.scrollWidth, body?.scrollWidth || 0);
        const offenders = [];

        for (const element of document.querySelectorAll('body *')) {
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') continue;

          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          if (rect.right > clientWidth + 1) {
            offenders.push({
              tag: element.tagName.toLowerCase(),
              id: element.getAttribute('id') || '',
              className:
                typeof element.className === 'string' ? element.className.slice(0, 120) : '',
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            });
            if (offenders.length >= 8) break;
          }
        }

        const viewportMeta = document.querySelector('meta[name="viewport"]');
        const bodyRect = body ? body.getBoundingClientRect() : { width: 0, height: 0 };

        return {
          clientWidth,
          scrollWidth,
          horizontalOverflow: Math.max(0, scrollWidth - clientWidth),
          offenders,
          viewportMetaContent: viewportMeta?.getAttribute('content') || null,
          bodyWidth: Math.round(bodyRect.width),
          bodyHeight: Math.round(bodyRect.height),
          devicePixelRatio: window.devicePixelRatio,
        };
      });

      await testInfo.attach('layout-metrics.json', {
        body: JSON.stringify({ viewport, ...layout }, null, 2),
        contentType: 'application/json',
      });

      ensureDir(config.screenshotsDir);
      const screenshotPath = path.join(
        config.screenshotsDir,
        `responsive-${viewport.name}-${timestamp()}.png`,
      );

      try {
        await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 20000 });
        await testInfo.attach(`responsive-${viewport.name}`, {
          path: screenshotPath,
          contentType: 'image/png',
        });
      } catch {
        testInfo.annotations.push({
          type: 'screenshot',
          description: `Could not capture the ${viewport.name} screenshot.`,
        });
      }

      expect(
        layout.bodyHeight,
        `The page body is not visible at ${viewport.width}x${viewport.height}.`,
      ).toBeGreaterThan(0);

      if (viewport.isMobile) {
        expect(
          layout.viewportMetaContent,
          'The mobile page is missing <meta name="viewport">. Real mobile browsers will scale the page incorrectly.',
        ).toBeTruthy();
        expect(
          /width\s*=\s*device-width/i.test(layout.viewportMetaContent || ''),
          `The viewport meta tag does not include width=device-width: "${layout.viewportMetaContent}".`,
        ).toBe(true);
      }

      expect(
        layout.horizontalOverflow,
        `Horizontal overflow is ${layout.horizontalOverflow}px (tolerance ${config.overflowTolerancePx}px). ` +
          `Possible offenders: ${JSON.stringify(layout.offenders, null, 2)}`,
      ).toBeLessThanOrEqual(config.overflowTolerancePx);
    });
  });
}
