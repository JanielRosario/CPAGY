const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MAIN_SCRIPT = path.join(ROOT, 'userscripts', 'carlos-google-review-helper.user.js');
const UPDATER_SCRIPT = path.join(ROOT, 'userscripts', 'carlos-google-review-helper-updater.user.js');

const REPO_URL = 'https://github.com/JanielRosario/CPAGY';
const RAW_BASE = 'https://raw.githubusercontent.com/JanielRosario/CPAGY/main/userscripts';
const MAIN_RAW_URL = `${RAW_BASE}/carlos-google-review-helper.user.js`;
const UPDATER_RAW_URL = `${RAW_BASE}/carlos-google-review-helper-updater.user.js`;

function readScript(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function metadataBlock(source) {
  const match = source.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
  assert.ok(match, 'userscript metadata block is present');
  return match[1];
}

function metadataValue(source, key) {
  const block = metadataBlock(source);
  const match = block.match(new RegExp(`^//\\s*@${key}\\s+(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

function assertMetadata(source, expected) {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(metadataValue(source, key), value, `@${key}`);
  }
}

function assertIncludes(source, expected, label) {
  assert.ok(source.includes(expected), `${label}: ${expected}`);
}

const main = readScript(MAIN_SCRIPT);
assertMetadata(main, {
  namespace: 'https://github.com/JanielRosario/CPAGY/userscripts/carlos-google-review-helper',
  homepageURL: REPO_URL,
  supportURL: `${REPO_URL}/issues`,
  updateURL: MAIN_RAW_URL,
  downloadURL: MAIN_RAW_URL
});

const updater = readScript(UPDATER_SCRIPT);
assertMetadata(updater, {
  name: 'Carlos AgencyZoom Google Review Helper Updater',
  namespace: 'https://github.com/JanielRosario/CPAGY/userscripts/carlos-google-review-helper-updater',
  homepageURL: REPO_URL,
  supportURL: `${REPO_URL}/issues`,
  updateURL: UPDATER_RAW_URL,
  downloadURL: UPDATER_RAW_URL
});

assert.equal(metadataValue(updater, 'connect'), 'api.github.com', 'first updater @connect is api.github.com');
assertIncludes(updater, '// @connect      raw.githubusercontent.com', 'updater can fetch raw GitHub script');
assertIncludes(updater, '// @connect      qkjbpszojgyvhzrlopys.supabase.co', 'updater grants target Supabase host');
assertIncludes(updater, "const TARGET_ID = 'carlos-agencyzoom-google-review-helper';", 'target id');
assertIncludes(updater, "const TARGET_FILE = 'carlos-google-review-helper.user.js';", 'target file');
assertIncludes(updater, `const BASE_URL = '${RAW_BASE}';`, 'raw base url');
assertIncludes(updater, "const COMMIT_API_URL = 'https://api.github.com/repos/JanielRosario/CPAGY/commits/main';", 'commit api url');
assert.ok(!updater.includes('(0, eval)'), 'updater uses direct eval so the target can access granted GM APIs');
