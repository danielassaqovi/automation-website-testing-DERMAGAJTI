'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanDirectory(dirPath, { preserve = ['.gitkeep'] } = {}) {
  ensureDir(dirPath);

  for (const entry of fs.readdirSync(dirPath)) {
    if (preserve.includes(entry)) continue;
    fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true });
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

module.exports = {
  ensureDir,
  cleanDirectory,
  writeJson,
  readJson,
};
