'use strict';

const { test, expect } = require('../utils/fixtures');
const config = require('../config');
const { gotoTarget, collectAnchors } = require('../utils/page');
const { prepareInternalLinks, crawlInternalLinks } = require('../utils/links');

function formatFailures(failures) {
  return failures
    .map((failure) => {
      const status = failure.status === null ? 'NO RESPONSE' : `HTTP ${failure.status}`;
      return `- ${failure.url} → ${status}${failure.error ? ` (${failure.error})` : ''}`;
    })
    .join('\n');
}

test('internal links resolve without HTTP errors', async ({ page, request }, testInfo) => {
  const baseUrl = config.getTargetUrl();

  await gotoTarget(page);
  const anchors = await collectAnchors(page);
  const links = prepareInternalLinks(anchors, baseUrl, {
    maxLinks: config.maxLinks,
    skipUrlRegexes: config.skipUrlRegexes,
  });

  await testInfo.attach('collected-links.json', {
    body: JSON.stringify(links, null, 2),
    contentType: 'application/json',
  });

  if (links.length === 0) {
    test.skip(true, 'No testable same-origin links were found on the homepage.');
  }

  const { results, truncated, uncheckedCount } = await crawlInternalLinks({
    request,
    baseUrl,
    seedLinks: links,
    maxPages: config.maxPages,
    maxDepth: config.maxDepth,
    timeoutMs: config.linkCheckTimeoutMs,
    skipUrlRegexes: config.skipUrlRegexes,
    detectSoft404: config.detectSoft404,
  });

  await testInfo.attach('link-check-results.json', {
    body: JSON.stringify(
      {
        checked: results.length,
        maxPages: config.maxPages,
        maxDepth: config.maxDepth,
        truncated,
        uncheckedCount,
        results,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  if (truncated) {
    testInfo.annotations.push({
      type: 'crawl-truncated',
      description: `${uncheckedCount} link(s) were not checked because MAX_PAGES=${config.maxPages} was reached.`,
    });
  }

  const failures = results.filter((result) => !result.ok);

  expect(
    failures,
    `Found ${failures.length} broken internal link(s):\n${formatFailures(failures)}`,
  ).toEqual([]);
});
