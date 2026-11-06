'use strict';

const { test, expect } = require('../utils/fixtures');
const { gotoTarget } = require('../utils/page');

test.describe('Basic accessibility checks', () => {
  test('document declares a language', async ({ page }) => {
    await gotoTarget(page);

    const lang = await page.evaluate(() =>
      (document.documentElement.getAttribute('lang') || '').trim(),
    );

    expect(
      lang.length,
      'The <html> element has no lang attribute. Screen readers cannot choose the correct pronunciation.',
    ).toBeGreaterThan(0);
  });

  test('page has a top-level heading', async ({ page }, testInfo) => {
    await gotoTarget(page);

    const headings = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h1')).map((heading) =>
        (heading.innerText || heading.textContent || '').trim(),
      ),
    );

    await testInfo.attach('h1-headings.json', {
      body: JSON.stringify(headings, null, 2),
      contentType: 'application/json',
    });

    expect(headings.length, 'No <h1> heading was found on the page.').toBeGreaterThan(0);
  });

  test('images have alternative text attributes', async ({ page }, testInfo) => {
    await gotoTarget(page);

    const images = await page.evaluate(() =>
      Array.from(document.images).map((image) => ({
        src: image.currentSrc || image.src || '',
        alt: image.getAttribute('alt'),
        hasAlt: image.hasAttribute('alt'),
        visible:
          window.getComputedStyle(image).display !== 'none' &&
          image.getBoundingClientRect().width > 0,
      })),
    );

    await testInfo.attach('image-alt-check.json', {
      body: JSON.stringify(images, null, 2),
      contentType: 'application/json',
    });

    if (images.length === 0) {
      test.skip(true, 'No <img> elements were found on the homepage.');
    }

    const missingAlt = images.filter((image) => !image.hasAlt);

    expect(
      missingAlt,
      `Found ${missingAlt.length} <img> element(s) without an alt attribute. Use alt="" for decorative images:\n` +
        missingAlt.map((image) => `- ${image.src || '(missing src)'}`).join('\n'),
    ).toEqual([]);
  });

  test('element IDs are unique', async ({ page }, testInfo) => {
    await gotoTarget(page);

    const duplicates = await page.evaluate(() => {
      const counts = new Map();
      for (const element of document.querySelectorAll('[id]')) {
        const id = element.getAttribute('id');
        if (!id) continue;
        counts.set(id, (counts.get(id) || 0) + 1);
      }
      return [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([id, count]) => ({ id, count }));
    });

    await testInfo.attach('duplicate-ids.json', {
      body: JSON.stringify(duplicates, null, 2),
      contentType: 'application/json',
    });

    expect(
      duplicates,
      `Found ${duplicates.length} duplicated element ID(s): ${JSON.stringify(duplicates)}`,
    ).toEqual([]);
  });

  test('links and buttons have accessible names', async ({ page }, testInfo) => {
    await gotoTarget(page);

    const result = await page.evaluate(() => {
      function isVisible(element) {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function accessibleName(element) {
        const ariaLabel = (element.getAttribute('aria-label') || '').trim();
        if (ariaLabel) return ariaLabel;

        const labelledBy = (element.getAttribute('aria-labelledby') || '').trim();
        if (labelledBy) {
          const text = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (text) return text;
        }

        const title = (element.getAttribute('title') || '').trim();
        if (title) return title;

        if (
          element.tagName === 'INPUT' &&
          ['submit', 'button', 'reset'].includes(element.getAttribute('type'))
        ) {
          return (element.value || '').trim();
        }

        const image = element.querySelector?.('img[alt]');
        if (image && image.alt.trim()) return image.alt.trim();

        return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      }

      const elements = Array.from(
        document.querySelectorAll(
          'a[href], button, [role="button"], input[type="submit"], input[type="button"], input[type="reset"]',
        ),
      ).filter((element) => isVisible(element));

      const unnamed = elements
        .filter((element) => !accessibleName(element))
        .slice(0, 30)
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          id: element.getAttribute('id') || '',
          className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
          href: element.getAttribute('href') || '',
        }));

      return { checked: elements.length, unnamed };
    });

    await testInfo.attach('unnamed-interactive-elements.json', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });

    if (result.checked === 0) {
      test.skip(true, 'No visible links or buttons were found, so accessible names cannot be checked.');
    }

    expect(
      result.unnamed,
      `Found ${result.unnamed.length} visible link(s)/button(s) without an accessible name: ${JSON.stringify(result.unnamed, null, 2)}`,
    ).toEqual([]);
  });
});
