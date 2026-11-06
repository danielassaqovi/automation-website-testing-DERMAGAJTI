'use strict';

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value) {
  return String(value || '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function compactText(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? compactText(match[1]) : null;
}

function extractFirstHeading(html) {
  const match = String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? compactText(match[1]) : null;
}

/**
 * Heuristic for HTTP 200 responses that actually render an error page.
 * Only used when DETECT_SOFT_404=true because it can be wrong on some sites.
 */
function looksLikeSoft404(html) {
  const title = extractTitle(html);
  const heading = extractFirstHeading(html);
  const pattern = /^\s*(404\b|not found\b|page not found\b|error 404\b|halaman tidak ditemukan\b)/i;
  return pattern.test(title || '') || pattern.test(heading || '');
}

function extractHrefs(html, baseUrl) {
  const results = [];
  const pattern = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi;
  let match;

  while ((match = pattern.exec(String(html || ''))) !== null) {
    const rawHref = decodeEntities(match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!rawHref || rawHref.startsWith('#')) continue;
    if (/^(?:mailto:|tel:|sms:|javascript:|data:|blob:)/i.test(rawHref)) continue;

    try {
      const url = new URL(rawHref, baseUrl);
      url.hash = '';
      results.push(url.toString());
    } catch {
      // Ignore malformed inline URLs while crawling.
    }
  }

  return [...new Set(results)];
}

module.exports = {
  decodeEntities,
  extractTitle,
  extractFirstHeading,
  looksLikeSoft404,
  extractHrefs,
};
