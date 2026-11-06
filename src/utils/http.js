'use strict';

const { decodeEntities, extractTitle } = require('./html');

const DEFAULT_USER_AGENT = 'UniversalWebsiteTestingTool/1.0 (+read-only automated QA)';

async function readLimitedText(response, limitBytes = 512 * 1024) {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = '';
  let bytesRead = 0;

  try {
    while (bytesRead < limitBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // The stream may already be closed.
    }
  }

  return text + decoder.decode();
}

function normalizeFetchError(error) {
  if (!error) return 'Unknown network error';
  if (error.name === 'AbortError') return 'Request timed out';
  const cause = error.cause && (error.cause.code || error.cause.message);
  return cause ? `${error.message} (${cause})` : error.message || String(error);
}

/**
 * Read-only pre-flight inspection performed by runner.js before Playwright starts.
 * This is a plain HTTP GET: it never submits forms or changes site state.
 */
async function inspectTarget(targetUrl, { timeoutMs = 30000 } = {}) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': DEFAULT_USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    let title = null;
    let htmlBytes = 0;

    if (contentType.includes('html')) {
      const html = await readLimitedText(response);
      htmlBytes = Buffer.byteLength(html);
      title = extractTitle(html);
      if (title) title = decodeEntities(title);
    } else {
      try {
        await response.body?.cancel();
      } catch {
        // Nothing to release.
      }
    }

    return {
      reachable: true,
      ok: response.status >= 200 && response.status < 400,
      httpStatus: response.status,
      statusText: response.statusText || '',
      finalUrl: response.url || targetUrl,
      redirected: response.redirected,
      contentType,
      contentLength: response.headers.get('content-length') || null,
      server: response.headers.get('server') || null,
      title,
      htmlBytes,
      responseTimeMs: Date.now() - startedAt,
      error: null,
      checkedAt: new Date().toISOString(),
      targetUrl,
    };
  } catch (error) {
    return {
      reachable: false,
      ok: false,
      httpStatus: null,
      statusText: '',
      finalUrl: targetUrl,
      redirected: false,
      contentType: null,
      contentLength: null,
      server: null,
      title: null,
      htmlBytes: 0,
      responseTimeMs: Date.now() - startedAt,
      error: normalizeFetchError(error),
      checkedAt: new Date().toISOString(),
      targetUrl,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  inspectTarget,
  readLimitedText,
  DEFAULT_USER_AGENT,
};
