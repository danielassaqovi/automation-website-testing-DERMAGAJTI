'use strict';

const { test, expect } = require('../utils/fixtures');
const config = require('../config');
const { gotoTarget, scrollThroughPage, waitForImages } = require('../utils/page');
const { collectImages, verifyImages } = require('../utils/images');

function formatBroken(broken) {
  return broken
    .map((image) => `- ${image.src || '(missing src)'} → ${image.reason}`)
    .join('\n');
}

test('images load successfully', async ({ page, request }, testInfo) => {
  await gotoTarget(page);
  await scrollThroughPage(page);
  await waitForImages(page);

  const images = await collectImages(page);

  await testInfo.attach('images-found.json', {
    body: JSON.stringify(images, null, 2),
    contentType: 'application/json',
  });

  if (images.length === 0) {
    test.skip(true, 'No <img> elements were found on the homepage.');
  }

  const verification = await verifyImages({
    request,
    images,
    maxImages: config.maxImages,
    timeoutMs: config.linkCheckTimeoutMs,
  });

  await testInfo.attach('image-check-results.json', {
    body: JSON.stringify(verification, null, 2),
    contentType: 'application/json',
  });

  if (verification.skippedCount > 0) {
    testInfo.annotations.push({
      type: 'image-limit',
      description: `${verification.skippedCount} image(s) were not inspected because MAX_IMAGES=${config.maxImages} was reached.`,
    });
  }

  if (verification.unverified.length > 0) {
    testInfo.annotations.push({
      type: 'unverified-images',
      description: `${verification.unverified.length} image(s) could not be fully verified (for example, lazy images that never loaded).`,
    });
  }

  const verifiedOk = verification.results.filter((image) => image.status === 'ok').length;

  if (verification.broken.length === 0 && verifiedOk === 0) {
    test.skip(
      true,
      `No image could be verified as loaded (${verification.unverified.length} unverified, ${verification.skippedCount} not inspected).`,
    );
  }

  expect(
    verification.broken,
    `Found ${verification.broken.length} broken image(s):\n${formatBroken(verification.broken)}`,
  ).toEqual([]);
});
