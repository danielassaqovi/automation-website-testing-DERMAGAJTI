'use strict';

async function collectImages(page) {
  return page.evaluate(() =>
    Array.from(document.images).map((image, index) => {
      const rect = image.getBoundingClientRect();
      const style = window.getComputedStyle(image);

      return {
        index,
        src: image.currentSrc || image.src || '',
        rawSrc: image.getAttribute('src') || '',
        dataSrc: image.getAttribute('data-src') || image.getAttribute('data-lazy-src') || '',
        alt: image.getAttribute('alt'),
        hasAlt: image.hasAttribute('alt'),
        loading: image.getAttribute('loading') || '',
        complete: image.complete,
        naturalWidth: image.naturalWidth || 0,
        naturalHeight: image.naturalHeight || 0,
        visible:
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0,
      };
    }),
  );
}

function isImageContentType(contentType) {
  return /^image\//i.test(String(contentType || '').trim());
}

/**
 * Inspect image loading from the browser first, then verify failures with an
 * HTTP GET. An image is only marked broken when the browser did not render it
 * AND the network request also failed or returned a non-image response.
 */
async function verifyImages({ request, images, maxImages, timeoutMs }) {
  const inspected = images.slice(0, maxImages);
  const skippedCount = Math.max(0, images.length - inspected.length);
  const requestCache = new Map();
  const results = [];

  async function fetchImage(url) {
    if (requestCache.has(url)) return requestCache.get(url);

    let value;
    try {
      const response = await request.get(url, {
        timeout: timeoutMs,
        failOnStatusCode: false,
        maxRedirects: 5,
      });
      value = {
        ok: response.status() < 400,
        status: response.status(),
        contentType: response.headers()['content-type'] || '',
        error: null,
      };
    } catch (error) {
      value = {
        ok: false,
        status: null,
        contentType: '',
        error: error.message || String(error),
      };
    }

    requestCache.set(url, value);
    return value;
  }

  for (const image of inspected) {
    const base = {
      index: image.index,
      src: image.src,
      alt: image.alt,
      visible: image.visible,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      complete: image.complete,
    };

    if (!image.src) {
      if (image.dataSrc) {
        results.push({
          ...base,
          status: 'unverified',
          reason: `Lazy image has not loaded yet (data-src="${image.dataSrc}").`,
        });
      } else {
        results.push({
          ...base,
          status: 'broken',
          reason: 'Image element has no src, currentSrc, or lazy-load data-src attribute.',
        });
      }
      continue;
    }

    if (image.complete && image.naturalWidth > 0) {
      results.push({ ...base, status: 'ok', reason: null });
      continue;
    }

    if (image.src.startsWith('data:')) {
      if (image.complete && image.naturalWidth === 0) {
        results.push({
          ...base,
          status: 'broken',
          reason: 'Data URI image could not be decoded by the browser.',
        });
      } else {
        results.push({ ...base, status: 'unverified', reason: 'Data URI image has not finished loading.' });
      }
      continue;
    }

    const network = await fetchImage(image.src);

    if (!network.ok || !isImageContentType(network.contentType)) {
      results.push({
        ...base,
        status: 'broken',
        reason: network.error
          ? `Image request failed: ${network.error}`
          : `Image request returned HTTP ${network.status} with content-type "${network.contentType || 'unknown'}".`,
      });
      continue;
    }

    if (image.complete && image.naturalWidth === 0) {
      results.push({
        ...base,
        status: 'broken',
        reason: 'Image was fetched but the browser could not decode/render it (naturalWidth = 0).',
      });
      continue;
    }

    results.push({
      ...base,
      status: 'unverified',
      reason: 'Image request succeeded but the browser has not rendered the image yet (possibly lazy-loaded).',
    });
  }

  return {
    totalImages: images.length,
    inspectedCount: inspected.length,
    skippedCount,
    broken: results.filter((item) => item.status === 'broken'),
    unverified: results.filter((item) => item.status === 'unverified'),
    results,
  };
}

module.exports = {
  collectImages,
  verifyImages,
};
