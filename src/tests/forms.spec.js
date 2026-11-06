'use strict';

const { test, expect } = require('../utils/fixtures');
const config = require('../config');
const { gotoTarget } = require('../utils/page');
const { collectForms } = require('../utils/forms');

function formatUnlabeled(controls) {
  return controls
    .map(
      (control) =>
        `- <${control.tag}${control.type ? ` type="${control.type}"` : ''}` +
        `${control.name ? ` name="${control.name}"` : ''}` +
        `${control.id ? ` id="${control.id}"` : ''}>` +
        `${control.placeholder ? ` placeholder="${control.placeholder}"` : ''}`,
    )
    .join('\n');
}

test.describe('Form detection and basic validation', () => {
  test('forms are detected on the homepage', async ({ page }, testInfo) => {
    await gotoTarget(page);

    const data = await collectForms(page, config.maxForms);

    await testInfo.attach('forms-inspection.json', {
      body: JSON.stringify(data, null, 2),
      contentType: 'application/json',
    });

    if (data.totalForms === 0) {
      test.skip(true, 'No <form> elements were found on the homepage.');
    }

    if (data.totalForms > data.inspectedCount) {
      testInfo.annotations.push({
        type: 'form-limit',
        description: `${data.totalForms - data.inspectedCount} form(s) were not inspected because MAX_FORMS=${config.maxForms} was reached.`,
      });
    }

    expect(data.inspectedCount).toBeGreaterThan(0);
  });

  test('visible form controls have accessible labels', async ({ page }, testInfo) => {
    await gotoTarget(page);

    const data = await collectForms(page, config.maxForms);
    const visibleForms = data.forms.filter((form) => form.visible);
    const visibleControls = visibleForms.flatMap((form) =>
      form.controls.filter((control) => control.visible),
    );

    await testInfo.attach('form-labels.json', {
      body: JSON.stringify({ visibleForms: visibleForms.length, visibleControls }, null, 2),
      contentType: 'application/json',
    });

    if (visibleForms.length === 0) {
      test.skip(true, 'No visible <form> elements were found on the homepage.');
    }

    if (visibleControls.length === 0) {
      test.skip(true, 'Visible forms contain no labelable controls.');
    }

    const unlabeled = visibleControls.filter((control) => !control.label);

    expect(
      unlabeled,
      `Found ${unlabeled.length} visible form control(s) without an accessible label:\n${formatUnlabeled(unlabeled)}`,
    ).toEqual([]);
  });
});
