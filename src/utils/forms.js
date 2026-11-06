'use strict';

/**
 * Read-only form inspection. This never fills, focuses, or submits a form.
 * It records structure, validation attributes, and basic label accessibility.
 */
async function collectForms(page, maxForms) {
  return page.evaluate((limit) => {
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

      if (element.labels && element.labels.length > 0) {
        const text = Array.from(element.labels)
          .map((label) => label.textContent || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) return text;
      }

      const title = (element.getAttribute('title') || '').trim();
      if (title) return title;

      if (element.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(element.type)) {
        return (element.value || '').trim();
      }

      const image = element.querySelector?.('img[alt]');
      if (image && image.alt.trim()) return image.alt.trim();

      return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
    }

    const forms = Array.from(document.forms);
    const inspected = forms.slice(0, limit);

    return {
      totalForms: forms.length,
      inspectedCount: inspected.length,
      forms: inspected.map((form, index) => {
        const elements = Array.from(form.elements || []);

        const controls = elements
          .filter((element) => {
            if (element.tagName === 'INPUT') {
              return !['hidden', 'submit', 'button', 'reset', 'image'].includes(element.type);
            }
            return element.tagName === 'SELECT' || element.tagName === 'TEXTAREA';
          })
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            type: element.getAttribute('type') || '',
            name: element.getAttribute('name') || '',
            id: element.getAttribute('id') || '',
            placeholder: element.getAttribute('placeholder') || '',
            required: element.required === true,
            disabled: element.disabled === true,
            visible: isVisible(element),
            label: accessibleName(element),
          }));

        const submitControls = Array.from(
          form.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"]'),
        ).map((element) => ({
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute('type') || '',
          name: accessibleName(element),
          visible: isVisible(element),
        }));

        return {
          index,
          id: form.getAttribute('id') || '',
          name: form.getAttribute('name') || '',
          action: form.getAttribute('action') || '',
          method: (form.getAttribute('method') || 'get').toLowerCase(),
          visible: isVisible(form),
          controls,
          submitControls,
          requiredCount: controls.filter((control) => control.required).length,
          inputTypes: [...new Set(controls.map((control) => control.type || control.tag))],
          hasFileUpload: controls.some((control) => control.type === 'file'),
          hasPassword: controls.some((control) => control.type === 'password'),
        };
      }),
    };
  }, maxForms);
}

module.exports = {
  collectForms,
};
