'use strict';

const { sameOrigin, stripHash } = require('./url');
const { extractHrefs, looksLikeSoft404 } = require('./html');
const { matchesAny } = require('./formatting');

const NON_HTML_PROTOCOLS = /^(?:mailto:|tel:|sms:|javascript:|data:|blob:)/i;

function normalizeLinkValue(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Convert raw anchors from the DOM into bounded, same-origin links.
 * State-changing URL patterns are skipped by default (see SKIP_URL_PATTERNS).
 */
function prepareInternalLinks(anchors, baseUrl, { maxLinks, skipUrlRegexes }) {
  const seen = new Set([stripHash(baseUrl)]);
  const links = [];

  for (const anchor of anchors) {
    if (anchor.download) continue;
    if (!anchor.rawHref || anchor.rawHref.trim().startsWith('#')) continue;
    if (NON_HTML_PROTOCOLS.test(anchor.rawHref.trim())) continue;

    const normalized = normalizeLinkValue(anchor.href || anchor.rawHref);
    if (!normalized) continue;
    if (!sameOrigin(normalized, baseUrl)) continue;
    if (seen.has(normalized)) continue;

    const searchable = `${decodeURIComponentSafe(normalized)} ${anchor.text || ''} ${anchor.ariaLabel || ''}`;
    if (matchesAny(searchable, skipUrlRegexes)) continue;

    seen.add(normalized);
    links.push({
      url: normalized,
      text: anchor.text || '',
      source: baseUrl,
      depth: 1,
    });

    if (links.length >= maxLinks) break;
  }

  return links;
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function checkLink(request, url, { timeoutMs, detectSoft404 }) {
  try {
    const response = await request.get(url, {
      timeout: timeoutMs,
      maxRedirects: 5,
      failOnStatusCode: false,
    });

    const status = response.status();
    const contentType = response.headers()['content-type'] || '';
    const finalUrl = response.url();
    let soft404 = false;
    let html = null;

    if (contentType.includes('html')) {
      html = await response.text();
      if (detectSoft404 && status < 400) {
        soft404 = looksLikeSoft404(html);
      }
    }

    return {
      status,
      ok: status < 400 && !soft404,
      finalUrl,
      redirected: finalUrl !== url,
      contentType,
      soft404,
      error: soft404 ? 'HTTP 200 but the page looks like a soft 404/error page.' : null,
      html,
    };
  } catch (error) {
    return {
      status: null,
      ok: false,
      finalUrl: url,
      redirected: false,
      contentType: null,
      soft404: false,
      error: error.message || String(error),
      html: null,
    };
  }
}

/**
 * Bounded breadth-first crawl of internal links.
 * Link checks use Playwright's APIRequestContext (GET only, shares browser cookies).
 */
async function crawlInternalLinks({
  request,
  baseUrl,
  seedLinks,
  maxPages,
  maxDepth,
  timeoutMs,
  skipUrlRegexes,
  detectSoft404,
}) {
  const queue = [...seedLinks];
  const visited = new Set();
  const results = [];

  while (queue.length > 0 && results.length < maxPages) {
    const item = queue.shift();
    if (visited.has(item.url)) continue;
    visited.add(item.url);

    const checked = await checkLink(request, item.url, { timeoutMs, detectSoft404 });
    const { html, ...publicResult } = checked;
    results.push({ ...item, ...publicResult });

    const canCrawlDeeper =
      checked.ok &&
      !checked.soft404 &&
      item.depth < maxDepth &&
      typeof html === 'string' &&
      checked.contentType.includes('html');

    if (!canCrawlDeeper) continue;

    for (const discoveredUrl of extractHrefs(html, checked.finalUrl || item.url)) {
      const normalized = normalizeLinkValue(discoveredUrl);
      if (!normalized) continue;
      if (!sameOrigin(normalized, baseUrl)) continue;
      if (visited.has(normalized)) continue;

      const searchable = decodeURIComponentSafe(normalized);
      if (matchesAny(searchable, skipUrlRegexes)) continue;
      if (queue.some((queued) => queued.url === normalized)) continue;

      queue.push({
        url: normalized,
        text: '',
        source: item.url,
        depth: item.depth + 1,
      });
    }
  }

  return {
    results,
    truncated: queue.length > 0,
    uncheckedCount: queue.length,
  };
}

module.exports = {
  prepareInternalLinks,
  crawlInternalLinks,
};
