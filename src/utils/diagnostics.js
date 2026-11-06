'use strict';

const { matchesAny } = require('./formatting');

/**
 * Collect browser diagnostics from the moment a page fixture is created.
 * Tests can assert on the arrays; the fixture also attaches them to the report.
 */
function createDiagnostics(page) {
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on('console', (message) => {
    const location = message.location();
    const entry = {
      text: message.text(),
      type: message.type(),
      url: location.url || '',
      lineNumber: location.lineNumber ?? null,
      columnNumber: location.columnNumber ?? null,
    };

    if (message.type() === 'error') consoleErrors.push(entry);
    if (message.type() === 'warning') consoleWarnings.push(entry);
  });

  page.on('pageerror', (error) => {
    pageErrors.push({
      message: error.message || String(error),
      stack: error.stack || '',
      name: error.name || 'Error',
    });
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (!failure) return;
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      errorText: failure.errorText || '',
    });
  });

  return {
    consoleErrors,
    consoleWarnings,
    pageErrors,
    requestFailures,

    filteredConsoleErrors(regexes) {
      return consoleErrors.filter(
        (entry) => !matchesAny(`${entry.text} ${entry.url}`, regexes),
      );
    },

    filteredPageErrors(regexes) {
      return pageErrors.filter(
        (entry) => !matchesAny(`${entry.message} ${entry.stack}`, regexes),
      );
    },

    toJSON() {
      return {
        consoleErrors,
        consoleWarnings,
        pageErrors,
        requestFailures,
      };
    },

    async attachTo(testInfo) {
      const hasData =
        consoleErrors.length > 0 ||
        consoleWarnings.length > 0 ||
        pageErrors.length > 0 ||
        requestFailures.length > 0;

      if (!hasData) return;

      await testInfo.attach('browser-diagnostics.json', {
        body: JSON.stringify(this.toJSON(), null, 2),
        contentType: 'application/json',
      });
    },
  };
}

module.exports = {
  createDiagnostics,
};
