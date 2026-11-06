'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { readJson, writeJson, ensureDir } = require('./fs');
const {
  escapeHtml,
  formatDuration,
  truncate,
  relativeTo,
  timestamp,
} = require('./formatting');

function stripAnsi(value) {
  return String(value || '').replace(/\u001b\[[0-9;]*m/g, '');
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function attachmentHref(attachmentPath) {
  if (!attachmentPath) return null;
  const absolute = path.resolve(attachmentPath);
  if (!isInside(config.reportsDir, absolute) && !isInside(config.screenshotsDir, absolute)) {
    return null;
  }
  return encodeURI(relativeTo(config.reportsDir, absolute));
}

function statusLabel(status) {
  const labels = {
    passed: 'PASS',
    failed: 'FAIL',
    timedOut: 'TIMEOUT',
    interrupted: 'INTERRUPTED',
    skipped: 'SKIP',
  };
  return labels[status] || String(status || 'UNKNOWN').toUpperCase();
}

function statusClass(status) {
  if (status === 'passed') return 'pass';
  if (status === 'skipped') return 'skip';
  return 'fail';
}

function errorText(result) {
  return result.errors
    .map((error) => stripAnsi([error.message, error.stack].filter(Boolean).join('\n')))
    .join('\n\n');
}

class SummaryReporter {
  constructor() {
    this.rows = [];
    this.startTime = Date.now();
    this.totalExpected = 0;
  }

  onBegin(playwrightConfig, suite) {
    this.startTime = Date.now();
    this.totalExpected = suite.allTests().length;
  }

  onTestEnd(test, result) {
    const annotations = (test.annotations || []).map((annotation) => ({
      type: annotation.type,
      description: annotation.description || '',
    }));
    const skipAnnotation = annotations.find((annotation) => annotation.type === 'skip');
    const titlePath = test.titlePath().slice(1);

    this.rows.push({
      title: test.title,
      titlePath,
      fullTitle: titlePath.join(' › '),
      file: relativeTo(config.projectRoot, test.location.file),
      line: test.location.line,
      status: result.status,
      expectedStatus: test.expectedStatus,
      durationMs: result.duration,
      retry: result.retry,
      errors: result.errors.map((error) => ({
        message: stripAnsi(error.message || ''),
        stack: stripAnsi(error.stack || ''),
        location: error.location || null,
      })),
      skipReason: skipAnnotation?.description || '',
      annotations: annotations.filter((annotation) => annotation.type !== 'skip'),
      attachments: (result.attachments || []).map((attachment) => ({
        name: attachment.name,
        contentType: attachment.contentType || '',
        path: attachment.path || null,
        href: attachmentHref(attachment.path),
      })),
    });
  }

  onEnd(result) {
    const endTime = Date.now();
    const passed = this.rows.filter((row) => row.status === 'passed').length;
    const skipped = this.rows.filter((row) => row.status === 'skipped').length;
    const failed = this.rows.length - passed - skipped;
    const executed = passed + failed;
    const passRate = executed > 0 ? Math.round((passed / executed) * 1000) / 10 : 0;

    const summary = {
      tool: 'Universal Website Testing Tool',
      version: '1.0.0',
      targetUrl: config.targetUrl || '(invalid or missing TARGET_URL)',
      browser: config.browser,
      generatedAt: new Date().toISOString(),
      runStatus: result.status,
      startTime: new Date(this.startTime).toISOString(),
      durationMs: endTime - this.startTime,
      totals: {
        total: this.rows.length,
        passed,
        failed,
        skipped,
        executed,
        passRatePercent: passRate,
      },
      configuration: {
        maxPages: config.maxPages,
        maxDepth: config.maxDepth,
        maxLinks: config.maxLinks,
        maxImages: config.maxImages,
        maxForms: config.maxForms,
        navTimeoutMs: config.navTimeoutMs,
        testTimeoutMs: config.testTimeoutMs,
        detectSoft404: config.detectSoft404,
        ignoreHttpsErrors: config.ignoreHttpsErrors,
      },
      tests: this.rows,
    };

    const inspection = readJson(path.join(config.reportsDir, 'inspection.json'), null);

    ensureDir(config.reportsDir);
    writeJson(path.join(config.reportsDir, 'summary.json'), summary);
    fs.writeFileSync(path.join(config.reportsDir, 'summary.md'), this.renderMarkdown(summary), 'utf8');
    fs.writeFileSync(path.join(config.reportsDir, 'report.html'), this.renderHtml(summary, inspection), 'utf8');
  }

  renderMarkdown(summary) {
    const lines = [];
    lines.push('# Universal Website Testing Report');
    lines.push('');
    lines.push(`- **Target:** ${summary.targetUrl}`);
    lines.push(`- **Browser:** ${summary.browser}`);
    lines.push(`- **Generated:** ${summary.generatedAt}`);
    lines.push(`- **Duration:** ${formatDuration(summary.durationMs)}`);
    lines.push(`- **Run status:** ${summary.runStatus}`);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push('| Total | PASS | FAIL | SKIP | Pass rate |');
    lines.push('| ---: | ---: | ---: | ---: | ---: |');
    lines.push(
      `| ${summary.totals.total} | ${summary.totals.passed} | ${summary.totals.failed} | ` +
        `${summary.totals.skipped} | ${summary.totals.passRatePercent}% |`,
    );
    lines.push('');
    lines.push('> SKIP means the page did not provide the element/feature being tested; it is not counted as PASS.');
    lines.push('');
    lines.push('## Test cases');
    lines.push('');
    lines.push('| Status | Test case | Duration | Notes |');
    lines.push('| --- | --- | ---: | --- |');

    for (const row of summary.tests) {
      const note = row.skipReason || row.errors[0]?.message?.split('\n')[0] || '';
      lines.push(
        `| ${statusLabel(row.status)} | ${row.fullTitle.replace(/\|/g, '\\|')} | ` +
          `${formatDuration(row.durationMs)} | ${truncate(note.replace(/\|/g, '\\|'), 160)} |`,
      );
    }

    lines.push('');
    lines.push('Open `report.html` for the interactive HTML report, or `html/index.html` for the Playwright report.');
    lines.push('');
    return `${lines.join('\n')}\n`;
  }

  renderHtml(summary, inspection) {
    const generated = escapeHtml(summary.generatedAt);
    const target = escapeHtml(summary.targetUrl);
    const cards = [
      ['Total', summary.totals.total, 'total'],
      ['Passed', summary.totals.passed, 'passed'],
      ['Failed', summary.totals.failed, 'failed'],
      ['Skipped', summary.totals.skipped, 'skipped'],
    ]
      .map(
        ([label, value, kind]) => `
          <div class="card ${kind}">
            <span class="card-label">${label}</span>
            <strong>${value}</strong>
          </div>`,
      )
      .join('');

    const inspectionHtml = this.renderInspection(inspection);
    const testsHtml = this.renderGroups(summary.tests);

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Universal Website Testing Report - ${target}</title>
<style>
  :root {
    color-scheme: light;
    --bg: #f4f6fb;
    --panel: #ffffff;
    --ink: #172033;
    --muted: #5d6b82;
    --line: #dfe5ef;
    --pass: #0f7b4f;
    --pass-bg: #e8f7ef;
    --fail: #b42318;
    --fail-bg: #fdecea;
    --skip: #8a5a00;
    --skip-bg: #fff5db;
    --accent: #1d4ed8;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
  }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 32px 20px 64px; }
  header { margin-bottom: 24px; }
  .kicker { margin: 0; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  h1 { margin: 4px 0 8px; font-size: clamp(26px, 4vw, 40px); }
  .target { margin: 0; font-size: 16px; overflow-wrap: anywhere; }
  .target a { color: var(--accent); }
  .meta { color: var(--muted); margin: 6px 0 0; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 24px 0; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; display: flex; justify-content: space-between; align-items: baseline; }
  .card strong { font-size: 28px; }
  .card.passed strong { color: var(--pass); }
  .card.failed strong { color: var(--fail); }
  .card.skipped strong { color: var(--skip); }
  .card-label { color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: .06em; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 20px; margin: 18px 0; }
  .panel h2 { margin: 0 0 12px; font-size: 18px; }
  .kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px 24px; }
  .kv div { overflow-wrap: anywhere; }
  .kv dt { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
  .kv dd { margin: 0; font-size: 14px; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 22px 0 12px; }
  .toolbar button {
    border: 1px solid var(--line); background: var(--panel); color: var(--ink);
    padding: 8px 14px; border-radius: 999px; cursor: pointer; font-size: 13px;
  }
  .toolbar button.active { background: var(--ink); color: #fff; border-color: var(--ink); }
  .toolbar .rate { margin-left: auto; color: var(--muted); font-size: 13px; }
  .group { margin: 22px 0 30px; }
  .group h2 { font-size: 15px; color: var(--muted); border-bottom: 1px solid var(--line); padding-bottom: 8px; }
  .test { background: var(--panel); border: 1px solid var(--line); border-left-width: 5px; border-radius: 12px; padding: 14px 18px; margin: 10px 0; }
  .test.pass { border-left-color: var(--pass); }
  .test.fail { border-left-color: var(--fail); }
  .test.skip { border-left-color: var(--skip); }
  .test-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .badge { font-size: 11px; font-weight: 800; letter-spacing: .08em; padding: 4px 9px; border-radius: 999px; }
  .badge.pass { color: var(--pass); background: var(--pass-bg); }
  .badge.fail { color: var(--fail); background: var(--fail-bg); }
  .badge.skip { color: var(--skip); background: var(--skip-bg); }
  .test-title { font-weight: 650; }
  .duration { color: var(--muted); font-size: 12px; margin-left: auto; }
  .path { color: var(--muted); font-size: 12px; margin: 6px 0 0; overflow-wrap: anywhere; }
  .notes { margin: 10px 0 0; border-radius: 10px; padding: 10px 12px; background: #f8f9fc; }
  .notes.fail { background: var(--fail-bg); }
  .notes.skip { background: var(--skip-bg); }
  pre { margin: 8px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; max-height: 380px; overflow: auto; }
  .attachments { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .attachment { font-size: 12px; }
  .attachment img { display: block; max-width: 240px; max-height: 150px; border: 1px solid var(--line); border-radius: 8px; object-fit: cover; object-position: top; background: #fff; }
  .attachment a { color: var(--accent); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .chip { background: #eef2ff; color: #313d70; border-radius: 999px; padding: 2px 8px; font-size: 11px; }
  footer { color: var(--muted); font-size: 12px; margin-top: 36px; border-top: 1px solid var(--line); padding-top: 16px; }
  @media (max-width: 640px) { .duration { margin-left: 0; } .toolbar .rate { margin-left: 0; width: 100%; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <p class="kicker">Universal Website Testing Tool</p>
    <h1>Test Report</h1>
    <p class="target">Target: <a href="${target}" rel="noreferrer">${target}</a></p>
    <p class="meta">Generated ${generated} · Browser: ${escapeHtml(summary.browser)} · Duration: ${escapeHtml(formatDuration(summary.durationMs))} · Run status: ${escapeHtml(summary.runStatus)}</p>
  </header>

  <section class="cards">${cards}</section>

  ${inspectionHtml}

  <section class="toolbar" aria-label="Filter results">
    <button type="button" data-filter="all" class="active">All (${summary.totals.total})</button>
    <button type="button" data-filter="passed">PASS (${summary.totals.passed})</button>
    <button type="button" data-filter="failed">FAIL (${summary.totals.failed})</button>
    <button type="button" data-filter="skipped">SKIP (${summary.totals.skipped})</button>
    <span class="rate">Pass rate (executed tests): <strong>${summary.totals.passRatePercent}%</strong></span>
  </section>

  ${testsHtml}

  <footer>
    SKIP means the feature/element was not present, so the test was not executed; it is never counted as PASS.
    This report was generated by a read-only test suite. Only test websites you own or are authorized to test.
  </footer>
</div>
<script>
  const buttons = Array.from(document.querySelectorAll('[data-filter]'));
  const tests = Array.from(document.querySelectorAll('[data-test]'));
  const groups = Array.from(document.querySelectorAll('[data-group]'));

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      for (const item of buttons) item.classList.toggle('active', item === button);
      for (const test of tests) {
        test.hidden = filter !== 'all' && test.dataset.status !== filter;
      }
      for (const group of groups) {
        const visible = Array.from(group.querySelectorAll('[data-test]')).some((test) => !test.hidden);
        group.hidden = !visible;
      }
    });
  }
</script>
</body>
</html>
`;
  }

  renderInspection(inspection) {
    if (!inspection) {
      return `
        <section class="panel">
          <h2>Pre-flight inspection</h2>
          <p class="meta">Inspection data is not available. Run the suite through <code>src/runner.js</code> to generate it.</p>
        </section>`;
    }

    const statusText = inspection.reachable
      ? `${inspection.httpStatus ?? 'n/a'}${inspection.statusText ? ` ${inspection.statusText}` : ''}`
      : 'Unreachable';

    const rows = [
      ['Reachable', inspection.reachable ? 'yes' : 'no'],
      ['HTTP status', statusText],
      ['Response time', `${inspection.responseTimeMs ?? 'n/a'} ms`],
      ['Final URL', inspection.finalUrl || 'n/a'],
      ['Page title', inspection.title || '(empty or not HTML)'],
      ['Content type', inspection.contentType || 'n/a'],
      ['Server', inspection.server || 'n/a'],
      ['Redirected', inspection.redirected ? 'yes' : 'no'],
      ['Checked at', inspection.checkedAt || 'n/a'],
    ];

    if (inspection.error) rows.push(['Error', inspection.error]);

    const body = rows
      .map(
        ([label, value]) =>
          `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
      )
      .join('');

    return `
      <section class="panel">
        <h2>Pre-flight inspection</h2>
        <dl class="kv">${body}</dl>
      </section>`;
  }

  renderGroups(rows) {
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.file)) grouped.set(row.file, []);
      grouped.get(row.file).push(row);
    }

    if (grouped.size === 0) {
      return '<section class="panel"><p>No test results were produced.</p></section>';
    }

    const groups = [];

    for (const [file, tests] of grouped) {
      const items = tests.map((row) => this.renderTest(row)).join('');
      groups.push(`
        <section class="group" data-group>
          <h2>${escapeHtml(file)}</h2>
          ${items}
        </section>`);
    }

    return groups.join('');
  }

  renderTest(row) {
    const kind = statusClass(row.status);
    const error = errorText({ errors: row.errors });
    const notes = [];

    if (row.skipReason) {
      notes.push(`<div class="notes skip"><strong>Skip reason:</strong> ${escapeHtml(row.skipReason)}</div>`);
    }

    if (error) {
      notes.push(`<div class="notes fail"><strong>Error detail</strong><pre>${escapeHtml(error)}</pre></div>`);
    }

    const annotations = row.annotations.length
      ? `<div class="chips">${row.annotations
          .map(
            (annotation) =>
              `<span class="chip">${escapeHtml(annotation.type)}${
                annotation.description ? `: ${escapeHtml(truncate(annotation.description, 120))}` : ''
              }</span>`,
          )
          .join('')}</div>`
      : '';

    const attachments = row.attachments
      .map((attachment) => {
        if (!attachment.href) return '';
        if (attachment.contentType.startsWith('image/')) {
          return `<div class="attachment"><a href="${escapeHtml(attachment.href)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(attachment.href)}" alt="${escapeHtml(attachment.name)}" loading="lazy"><span>${escapeHtml(attachment.name)}</span></a></div>`;
        }
        return `<div class="attachment"><a href="${escapeHtml(attachment.href)}" target="_blank" rel="noreferrer">${escapeHtml(attachment.name)}</a></div>`;
      })
      .filter(Boolean)
      .join('');

    return `
      <article class="test ${kind}" data-test data-status="${escapeHtml(row.status)}">
        <div class="test-head">
          <span class="badge ${kind}">${escapeHtml(statusLabel(row.status))}</span>
          <span class="test-title">${escapeHtml(row.title)}</span>
          <span class="duration">${escapeHtml(formatDuration(row.durationMs))}</span>
        </div>
        <p class="path">${escapeHtml(row.file)}:${row.line} · ${escapeHtml(row.fullTitle)}</p>
        ${annotations}
        ${notes.join('')}
        ${attachments ? `<div class="attachments">${attachments}</div>` : ''}
      </article>`;
  }
}

module.exports = SummaryReporter;
