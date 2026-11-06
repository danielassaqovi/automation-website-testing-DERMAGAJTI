'use strict';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Validate and normalize a user-supplied target URL.
 * - Only HTTP and HTTPS are accepted.
 * - A missing scheme defaults to HTTPS.
 * - Credentials, fragments, and non-web protocols are rejected.
 */
function normalizeTargetUrl(rawUrl) {
  const raw = rawUrl === undefined || rawUrl === null ? '' : String(rawUrl).trim();

  if (!raw) {
    throw new Error(
      'TARGET_URL is required. Example: TARGET_URL=https://example.com docker compose run --rm playwright',
    );
  }

  let candidate = raw;

  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    const schemeMatch = candidate.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    // "localhost:3000" and "example.com:8080" look like a scheme to a regex,
    // but they are host:port pairs. Only reject real non-web schemes.
    const looksLikeHostPort = schemeMatch
      ? /^\d+(?:[/?#]|$)/.test(candidate.slice(schemeMatch[0].length))
      : false;

    if (schemeMatch && !looksLikeHostPort) {
      throw new Error(`Unsupported URL scheme in TARGET_URL: "${raw}". Only HTTP and HTTPS are allowed.`);
    }
    candidate = `https://${candidate}`;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`Invalid TARGET_URL: "${raw}". Provide a valid absolute URL such as https://example.com.`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error(`Unsupported URL scheme "${url.protocol}". Only HTTP and HTTPS are allowed.`);
  }

  if (!url.hostname) {
    throw new Error(`Invalid TARGET_URL: "${raw}" has no hostname.`);
  }

  if (url.username || url.password) {
    throw new Error('TARGET_URL must not contain embedded credentials. Never put passwords in URLs.');
  }

  url.hash = '';
  return url.toString();
}

function isHttpUrl(value, baseUrl) {
  try {
    const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
    return ALLOWED_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

function stripHash(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return value;
  }
}

function sameOrigin(value, baseUrl) {
  try {
    return new URL(value).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

module.exports = {
  normalizeTargetUrl,
  isHttpUrl,
  stripHash,
  sameOrigin,
};
