// ==UserScript==
// @name         Carlos AgencyZoom Google Review Helper Updater
// @namespace    https://github.com/JanielRosario/CPAGY/userscripts/carlos-google-review-helper-updater
// @version      0.1.0
// @description  Loads and auto-updates the Carlos AgencyZoom Google Review Helper from GitHub.
// @author       Carlos Perez Agency
// @homepageURL  https://github.com/JanielRosario/CPAGY
// @supportURL   https://github.com/JanielRosario/CPAGY/issues
// @match        https://app.agencyzoom.com/integration/messages/index*
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @connect      qkjbpszojgyvhzrlopys.supabase.co
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-idle
// @noframes
// @icon         https://www.google.com/s2/favicons?sz=64&domain=agencyzoom.com
// @updateURL    https://raw.githubusercontent.com/JanielRosario/CPAGY/main/userscripts/carlos-google-review-helper-updater.user.js
// @downloadURL  https://raw.githubusercontent.com/JanielRosario/CPAGY/main/userscripts/carlos-google-review-helper-updater.user.js
// ==/UserScript==

(function loadCarlosAgencyZoomGoogleReviewHelper() {
  'use strict';

  const LOADER_VERSION = '0.1.0';
  const TARGET_ID = 'carlos-agencyzoom-google-review-helper';
  const TARGET_LABEL = 'Carlos AgencyZoom Google Review Helper';
  const TARGET_FILE = 'carlos-google-review-helper.user.js';
  const BASE_URL = 'https://raw.githubusercontent.com/JanielRosario/CPAGY/main/userscripts';
  const COMMIT_API_URL = 'https://api.github.com/repos/JanielRosario/CPAGY/commits/main';
  const CHECK_INTERVAL_MS = 15 * 60 * 1000;

  const CACHE_KEY = `${TARGET_ID}:source`;
  const CACHE_VERSION_KEY = `${TARGET_ID}:source-version`;
  const CACHE_COMMIT_KEY = `${TARGET_ID}:source-commit`;
  const LAST_CHECK_KEY = `${TARGET_ID}:last-check`;

  const params = new URLSearchParams(window.location.search);
  const debugEnabled = hasFlag('staffUpdaterDebug') || hasFlag('carlosReviewUpdaterDebug');
  const forceCheck = hasFlag('staffUpdaterForce') || hasFlag('carlosReviewUpdaterForce');
  const clearCache = hasFlag('staffUpdaterClear') || hasFlag('carlosReviewUpdaterClear');
  const reloadOnUpdate = hasFlag('staffUpdaterReload') || hasFlag('carlosReviewUpdaterReload');

  let executedSource = '';
  let executedCachedScript = false;

  if (!isAgencyZoomSmsPage()) {
    return;
  }

  if (clearCache) {
    deleteValue(CACHE_KEY);
    deleteValue(CACHE_VERSION_KEY);
    deleteValue(CACHE_COMMIT_KEY);
    deleteValue(LAST_CHECK_KEY);
    log('cleared cached target script');
  }

  const cachedSource = getValue(CACHE_KEY, '');
  if (cachedSource) {
    executedCachedScript = executeTarget(cachedSource, getValue(CACHE_VERSION_KEY, 'cached'));
  }

  refreshTarget().catch((error) => {
    warn(`could not refresh ${TARGET_LABEL}: ${error.message}`);
  });

  function hasFlag(name) {
    const value = params.get(name);
    return value === '' || value === '1' || value === 'true' || value === 'yes';
  }

  function isAgencyZoomSmsPage() {
    return /^app\.agencyzoom\.com$/i.test(window.location.hostname) &&
      window.location.pathname.startsWith('/integration/messages/index');
  }

  async function refreshTarget() {
    const now = Date.now();
    const lastCheck = Number(getValue(LAST_CHECK_KEY, 0)) || 0;
    if (!forceCheck && cachedSource && now - lastCheck < CHECK_INTERVAL_MS) {
      log('skipped remote check; cache interval has not expired');
      return;
    }

    setValue(LAST_CHECK_KEY, now);

    const commitSha = await fetchLatestCommitSha().catch((error) => {
      warn(`commit lookup failed; falling back to branch raw URL: ${error.message}`);
      return '';
    });
    const remoteUrl = commitSha
      ? `https://raw.githubusercontent.com/JanielRosario/CPAGY/${commitSha}/userscripts/${TARGET_FILE}`
      : `${BASE_URL}/${TARGET_FILE}`;
    const remoteSource = await requestText(remoteUrl);
    const currentSource = getValue(CACHE_KEY, '');

    if (!remoteSource.trim()) {
      throw new Error('downloaded script was empty');
    }

    if (normalizeSource(remoteSource) === normalizeSource(currentSource)) {
      log('cached target script is current');
      if (!executedCachedScript) {
        executeAndCache(remoteSource, commitSha || 'branch', false);
      }
      return;
    }

    executeAndCache(remoteSource, commitSha || 'branch', executedCachedScript && reloadOnUpdate);
  }

  function executeAndCache(source, version, shouldReload) {
    setValue(CACHE_KEY, source);
    setValue(CACHE_VERSION_KEY, version);
    setValue(CACHE_COMMIT_KEY, version);
    log(`cached ${TARGET_LABEL} ${version}`);

    if (!executedCachedScript) {
      executeTarget(source, version);
      return;
    }

    if (shouldReload) {
      window.setTimeout(() => window.location.reload(), 1000);
    } else {
      log('updated cache; new script will run on the next AgencyZoom page load');
    }
  }

  async function fetchLatestCommitSha() {
    const response = await requestText(COMMIT_API_URL);
    const payload = JSON.parse(response);
    const sha = payload && payload.sha;
    if (!sha) {
      throw new Error('GitHub commit response did not include sha');
    }

    return sha;
  }

  function executeTarget(source, version) {
    if (!source || normalizeSource(source) === normalizeSource(executedSource)) {
      return false;
    }

    executedSource = source;
    log(`executing ${TARGET_LABEL} ${version} with updater ${LOADER_VERSION}`);
    try {
      eval(`${source}\n//# sourceURL=${BASE_URL}/${TARGET_FILE}`);
      return true;
    } catch (error) {
      warn(`target script crashed: ${error.message}`);
      return false;
    }
  }

  function normalizeSource(source) {
    return String(source || '').replace(/\r\n/g, '\n').trim();
  }

  function requestText(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: {
          Accept: url.includes('api.github.com') ? 'application/vnd.github+json' : 'text/plain,*/*'
        },
        timeout: 20000,
        onload: (response) => {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(`GET ${url} returned ${response.status}`));
            return;
          }
          resolve(response.responseText || '');
        },
        onerror: () => reject(new Error(`GET ${url} failed`)),
        ontimeout: () => reject(new Error(`GET ${url} timed out`))
      });
    });
  }

  function getValue(key, fallback) {
    try {
      if (typeof GM_getValue === 'function') {
        return GM_getValue(key, fallback);
      }
    } catch (error) {
      warn(`GM_getValue failed for ${key}: ${error.message}`);
    }

    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? fallback : JSON.parse(stored);
    } catch {
      return fallback;
    }
  }

  function setValue(key, value) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(key, value);
        return;
      }
    } catch (error) {
      warn(`GM_setValue failed for ${key}: ${error.message}`);
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      warn(`localStorage set failed for ${key}: ${error.message}`);
    }
  }

  function deleteValue(key) {
    try {
      if (typeof GM_deleteValue === 'function') {
        GM_deleteValue(key);
        return;
      }
    } catch (error) {
      warn(`GM_deleteValue failed for ${key}: ${error.message}`);
    }

    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      warn(`localStorage remove failed for ${key}: ${error.message}`);
    }
  }

  function log(message) {
    if (debugEnabled) {
      console.info(`[${TARGET_LABEL} Updater] ${message}`);
    }
  }

  function warn(message) {
    console.warn(`[${TARGET_LABEL} Updater] ${message}`);
  }
})();
