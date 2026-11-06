'use strict';

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const config = require('./config');
const { inspectTarget } = require('./utils/http');
const { ensureDir, cleanDirectory, writeJson, readJson } = require('./utils/fs');
const { formatDuration } = require('./utils/formatting');

function line(text = '') {
  console.log(text);
}

function banner() {
  line('============================================================');
  line(' Universal Website Testing Tool');
  line(' Playwright + JavaScript + Docker');
  line('============================================================');
}

function printUsage() {
  line('');
  line('Usage:');
  line('  TARGET_URL=https://example.com docker compose run --rm playwright');
  line('');
  line('Optional: copy .env.example to .env and edit it.');
  line('Only test websites you own or are authorized to test.');
  line('');
}

function resolvePlaywrightCli() {
  const candidates = ['@playwright/test/cli', 'playwright/cli'];
  for (const candidate of candidates) {
    try {
      return require.resolve(candidate);
    } catch {
      // Try the next package entry point.
    }
  }
  throw new Error('Playwright CLI not found. Run "npm ci" inside the Docker image.');
}

function prepareOutputDirectories() {
  ensureDir(config.reportsDir);
  ensureDir(config.screenshotsDir);

  if (config.cleanOutput) {
    cleanDirectory(config.reportsDir);
    cleanDirectory(config.screenshotsDir);
  }
}

function printSummary() {
  const summaryPath = path.join(config.reportsDir, 'summary.json');
  const summary = readJson(summaryPath, null);

  line('');
  line('============================================================');
  line(' Result summary');
  line('============================================================');

  if (!summary) {
    line('Summary file was not produced. Check the Playwright output above.');
    line(`Expected: ${summaryPath}`);
    line('');
    return;
  }

  const { totals } = summary;
  line(` Target      : ${summary.targetUrl}`);
  line(` Browser     : ${summary.browser}`);
  line(` Total tests : ${totals.total}`);
  line(` Passed      : ${totals.passed}`);
  line(` Failed      : ${totals.failed}`);
  line(` Skipped     : ${totals.skipped}`);
  line(` Pass rate   : ${totals.passRatePercent}% (skipped tests excluded)`);
  line(` Duration    : ${formatDuration(summary.durationMs)}`);
  const hostPath = (absolutePath) =>
    path.relative(config.projectRoot, absolutePath).split(path.sep).join('/');

  line('');
  line(' Reports (mounted on the host):');
  line(`  HTML (tool)      : ./${hostPath(path.join(config.reportsDir, 'report.html'))}`);
  line(`  HTML (Playwright): ./${hostPath(path.join(config.reportsDir, 'html', 'index.html'))}`);
  line(`  JSON summary     : ./${hostPath(summaryPath)}`);
  line(`  Screenshots      : ./${hostPath(config.screenshotsDir)}`);
  line('');
}

async function main() {
  banner();

  let target;
  try {
    target = config.getTargetUrl();
  } catch (error) {
    console.error(`\n[configuration error] ${error.message}\n`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  prepareOutputDirectories();

  line(` Target  : ${target}`);
  line(` Browser : ${config.browser}`);
  line(` Limits  : pages=${config.maxPages}, depth=${config.maxDepth}, links=${config.maxLinks}, images=${config.maxImages}`);
  line('');

  if (config.ignoreHttpsErrors) {
    // Node's fetch does not expose a per-request "ignore TLS" option.
    // This only affects the runner process; Playwright has its own setting.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  line('[1/2] Pre-flight HTTP inspection (read-only)...');
  const inspection = await inspectTarget(target, { timeoutMs: config.navTimeoutMs });
  writeJson(path.join(config.reportsDir, 'inspection.json'), inspection);

  if (inspection.reachable) {
    line(
      `      HTTP ${inspection.httpStatus} in ${inspection.responseTimeMs} ms` +
        `${inspection.title ? ` | title: "${inspection.title}"` : ''}`,
    );
    if (!inspection.ok) {
      line('      WARNING: the target responded with an HTTP error status.');
    }
  } else {
    line(`      WARNING: pre-flight request failed: ${inspection.error}`);
    line('      Tests will still run so the report can show the failure details.');
  }

  line('');
  line('[2/2] Running Playwright test suite...');
  line('------------------------------------------------------------');

  let cliPath;
  try {
    cliPath = resolvePlaywrightCli();
  } catch (error) {
    console.error(`[error] ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const extraArgs = process.argv.slice(2);
  const result = spawnSync(process.execPath, [cliPath, 'test', ...extraArgs], {
    cwd: config.projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      TARGET_URL: target,
      REPORTS_DIR: config.reportsDir,
      SCREENSHOTS_DIR: config.screenshotsDir,
    },
  });

  if (result.error) {
    console.error(`[error] Failed to start Playwright: ${result.error.message}`);
    process.exitCode = 1;
    return;
  }

  printSummary();

  if (result.signal) {
    console.error(`[error] Playwright terminated by signal ${result.signal}.`);
    process.exitCode = 1;
    return;
  }

  const exitCode = typeof result.status === 'number' ? result.status : 1;
  if (exitCode === 0) {
    console.log('All executed test cases passed.');
  } else {
    console.log(`Playwright exited with code ${exitCode}. Review the report for failure details.`);
  }

  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error('[fatal] Unexpected runner error:', error);
  process.exitCode = 1;
});
