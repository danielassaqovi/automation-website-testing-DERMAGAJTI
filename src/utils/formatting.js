'use strict';

const path = require('path');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sanitizeFilename(value, maxLength = 90) {
  const cleaned = String(value || 'artifact')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (cleaned || 'artifact').slice(0, maxLength);
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'n/a';
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

function truncate(value, maxLength = 500) {
  const text = String(value === undefined || value === null ? '' : value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function relativeTo(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).split(path.sep).join('/');
}

function matchesAny(value, regexes) {
  const text = String(value === undefined || value === null ? '' : value);
  return regexes.some((regex) => regex.test(text));
}

module.exports = {
  timestamp,
  sanitizeFilename,
  formatDuration,
  truncate,
  escapeHtml,
  relativeTo,
  matchesAny,
};
