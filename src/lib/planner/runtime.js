import html2canvas from 'html2canvas';
import { applyStaticTranslations, initLanguage, setLanguage, t } from '../i18n.js';
import {
  ORBS_PER_PULL,
  ORIGEOMETRY_TO_OROBERYL,
  CURRENCIES,
  STRATEGY_SOURCE,
  OUTCOME_LABELS,
  OUTCOME_CLASSES,
  PULL_TYPE_LABELS,
  PULL_TYPE_CLASSES,
  TOOLTIPS,
} from './constants.js';
let windowCounter = 0;
let _hashUpdateTimer = null;
let _suppressHashUpdate = false;
let _isInitialized = false;
let _mouseenterHandler = null;
let _mouseleaveHandler = null;
let _keydownHandler = null;
let _distributionModalEl = null;
const _metricDistributionStore = new WeakMap();
const STRATEGY_NAME_KEYS = {
  'rate-up': 'ui.strategyNameRateUp10',
  'rate-up-single': 'ui.strategyNameRateUp1',
  'rate-up-plus': 'ui.strategyNameRateUpPlus',
  'rate-up-then-60': 'ui.strategyNameRateUp60',
  'full-collection-optimal': 'ui.strategyNameFullCollectionOptimal',
  'null-select': 'ui.strategyNameNullSelect',
  'first-six': 'ui.strategyNameFirst6',
  'c6': 'ui.strategyNameMaxPot',
  'skip-alt': 'ui.strategyNameSkipAlt',
  '30': 'ui.strategyNameFixed30',
  '60': 'ui.strategyNameFixed60',
  '80': 'ui.strategyNameFixed80',
  'bank-120': 'ui.strategyNameBank120',
};

function tr(path, fallback) {
  const value = t(path);
  return value === path ? fallback : value;
}

function trTpl(path, fallback, params = {}) {
  let text = tr(path, fallback);
  Object.entries(params).forEach(([k, v]) => {
    text = text.replaceAll(`{${k}}`, String(v));
  });
  return text;
}

function tip(key, fallbackOrParams = '', maybeParams = {}) {
  if (typeof fallbackOrParams === 'object' && fallbackOrParams !== null) {
    return trTpl(`detailTip.${key}`, '', fallbackOrParams);
  }
  return trTpl(`detailTip.${key}`, fallbackOrParams, maybeParams);
}

function trResultLabel(label) {
  return tr(`resultLabels.${label}`, label);
}

function trOutcomeLabel(label) {
  if (label === '6★ Rate-Up') return tr('result.outcomeRateUpSix', label);
  if (label === '6★ Limited') return tr('result.outcomeLimitedSix', label);
  if (label === '6★ Standard') return tr('result.outcomeStandardSix', label);
  return label;
}

function trPullTypeLabel(label) {
  if (label === 'Normal') return tr('result.normal', label);
  if (label === 'Bonus 30') return tr('result.bonus30', label);
  if (label === 'Bonus 60') return tr('result.bonus60', label);
  if (label === 'Welfare') return tr('result.welfare', label);
  return label;
}

function parseIntegerOrFallback(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatOrFallback(value, fallback) {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function setShareButtonDefault() {
  const btn = document.getElementById('share-btn');
  if (!btn) return;
  btn.innerHTML = `<span class="share-icon">🔗</span> ${t('ui.share')}`;
}

function getSelectedCurrency() {
  const sel = document.getElementById('currency-select');
  const key = sel ? sel.value : 'RMB';
  const cur = CURRENCIES[key] || CURRENCIES.RMB;
  return {
    symbol: cur.symbol,
    name: cur.name,
    monthlyCard: parseFloatOrFallback(document.getElementById('spending-monthly-card').value, cur.defaults.monthlyCard),
    bundle: parseFloatOrFallback(document.getElementById('spending-bundle').value, cur.defaults.bundle),
    hardSpendCost: parseFloatOrFallback(document.getElementById('spending-hard-cost').value, cur.defaults.hardSpendCost),
    hardSpendQty: parseFloatOrFallback(document.getElementById('spending-hard-qty').value, cur.defaults.hardSpendQty),
    hardSpendCurrency: document.getElementById('spending-hard-currency').value || cur.defaults.hardSpendCurrency,
  };
}

function getStrategyHeader() {
  return `// ${tr('ui.strategyHeaderHelp', 'See Help button on the top right for full reference')}\n\n`;
}

function getStrategyDisplayName(name) {
  return tr(STRATEGY_NAME_KEYS[name], name);
}

function extractStrategyBody(code) {
  if (typeof code !== 'string') return '';
  const lines = code.split('\n');
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (trimmed === '') {
      index++;
      continue;
    }
    if (!trimmed.startsWith('//')) break;
    index++;
    if (trimmed.startsWith('// Description:')) break;
  }

  while (index < lines.length && lines[index].trim() === '') index++;
  return lines.slice(index).join('\n');
}

function getStrategyDescription(name) {
  const localized = t(`strategyDesc.${name}`);
  if (!localized.startsWith('strategyDesc.')) return localized;

  const src = STRATEGY_SOURCE[name];
  if (!src) return '';
  const match = src.match(/^\/\/ Description:\s*(.+)$/m);
  return match ? match[1].trim() : '';
}

function getStrategyCode(name) {
  if (name === 'custom') return null;
  const description = getStrategyDescription(name);
  const body = extractStrategyBody(STRATEGY_SOURCE[name] || '');
  const nameLine = `// ${tr('ui.strategyHeaderName', 'Name')}: ${getStrategyDisplayName(name)}\n`;
  const descriptionLine = description ? `// ${tr('ui.strategyHeaderDescription', 'Description')}: ${description}\n` : '';
  return getStrategyHeader() + nameLine + descriptionLine + body;
}

function applyBuiltInStrategyCode(textarea, name) {
  const code = getStrategyCode(name) || '';
  textarea.value = code;
  textarea.dataset.generatedStrategyName = name;
  textarea.dataset.generatedStrategyCode = code;
}

function isDefaultBuiltInStrategyCode(name, textarea) {
  return textarea?.dataset.generatedStrategyName === name
    && textarea.dataset.generatedStrategyCode != null
    && textarea.value === textarea.dataset.generatedStrategyCode;
}

// --- Base64url encoding for custom strategy code in URLs ---
function base64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function stripComments(code) {
  return code.split('\n')
    .filter(line => !/^\s*\/\//.test(line))
    .join('\n')
    .trim();
}

// --- URL hash state serialization ---
function serializeState() {
  const params = new URLSearchParams();

  params.set('t', document.getElementById('trials-input').value);
  params.set('b', document.getElementById('banners-input').value);
  params.set('bl', document.getElementById('banner-length').value);
  params.set('wp', document.getElementById('welfare-pulls').value);
  params.set('wf', document.getElementById('welfare-free-pulls').value);
  params.set('ch', document.getElementById('start-chartered-hh').checked ? '1' : '0');
  params.set('p5', document.getElementById('start-5star-pity').value);
  params.set('p6', document.getElementById('start-6star-pity').value);
  const seed = document.getElementById('seed-input').value.trim();
  if (seed !== '') params.set('s', seed);
  params.set('c', document.getElementById('currency-select').value);
  params.set('mc', document.getElementById('spending-monthly-card').value);
  params.set('hb', document.getElementById('spending-bundle').value);
  params.set('hc', document.getElementById('spending-hard-cost').value);
  params.set('hq', document.getElementById('spending-hard-qty').value);
  params.set('hx', document.getElementById('spending-hard-currency').value);

  // Windows
  document.querySelectorAll('.sim-window').forEach(win => {
    const strategy = win.querySelector('.strategy-select').value;
    if (strategy === 'custom') {
      const code = stripComments(win.querySelector('.strategy-editor').value);
      params.append('w', 'custom:' + base64urlEncode(code));
    } else {
      params.append('w', strategy);
    }
  });

  return params.toString();
}

function deserializeState(hash) {
  if (!hash || hash === '#') return false;
  const params = new URLSearchParams(hash.replace(/^#/, ''));

  // Need at least one recognized param to consider it a valid state
  const knownKeys = ['t','b','bl','wp','wf','ch','p5','p6','s','c','mc','hb','hc','hq','hx','w'];
  if (!knownKeys.some(k => params.has(k))) return false;

  // Set all global inputs from params
  const setVal = (id, key) => { if (params.has(key)) document.getElementById(id).value = params.get(key); };
  setVal('trials-input', 't');
  setVal('banners-input', 'b');
  setVal('banner-length', 'bl');
  setVal('welfare-pulls', 'wp');
  setVal('welfare-free-pulls', 'wf');
  setVal('start-5star-pity', 'p5');
  setVal('start-6star-pity', 'p6');
  setVal('seed-input', 's');
  if (params.has('ch')) document.getElementById('start-chartered-hh').checked = params.get('ch') === '1';

  // Currency: set select first, populate defaults, then override spending values
  if (params.has('c')) document.getElementById('currency-select').value = params.get('c');
  populateSpendingInputs(document.getElementById('currency-select').value);
  setVal('spending-monthly-card', 'mc');
  setVal('spending-bundle', 'hb');
  setVal('spending-hard-cost', 'hc');
  setVal('spending-hard-qty', 'hq');
  if (params.has('hx')) document.getElementById('spending-hard-currency').value = params.get('hx');

  // Windows
  const windows = params.getAll('w');
  if (windows.length > 0) {
    for (const w of windows) {
      if (w.startsWith('custom:')) {
        try {
          const code = base64urlDecode(w.slice(7));
          createSimWindow({ strategy: 'custom', code });
        } catch (e) {
          createSimWindow({ strategy: 'custom', code: '// Failed to decode shared code' });
        }
      } else {
        createSimWindow({ strategy: w });
      }
    }
  } else {
    createSimWindow();
  }

  return true;
}

function updateHash() {
  const hash = serializeState();
  history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search);
}

function scheduleHashUpdate() {
  if (_suppressHashUpdate) return;
  clearTimeout(_hashUpdateTimer);
  _hashUpdateTimer = setTimeout(updateHash, 300);
}

async function exportWindowAsJpeg(win) {
  const btn = win.querySelector('.window-export');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '\u23f3';

  try {
    // Temporarily expand the window so the full content is captured (not clipped by scroll)
    const body = win.querySelector('.window-body');
    const origMaxH = win.style.maxHeight;
    const origOverflow = body.style.overflowY;
    win.style.maxHeight = 'none';
    body.style.overflowY = 'visible';

    // Also expand any scrollable pull logs
    const pullLogs = win.querySelectorAll('.pull-log');
    const origPullLogStyles = [];
    pullLogs.forEach(pl => {
      origPullLogStyles.push(pl.style.maxHeight);
      pl.style.maxHeight = 'none';
    });

    const canvas = await html2canvas(win, {
      backgroundColor: '#0f1117',
      scale: 2,
      useCORS: true,
    });

    // Restore styles
    win.style.maxHeight = origMaxH;
    body.style.overflowY = origOverflow;
    pullLogs.forEach((pl, i) => {
      pl.style.maxHeight = origPullLogStyles[i];
    });

    const link = document.createElement('a');
    const title = win.querySelector('.window-title').textContent;
    link.download = `endfield-gacha-${title.replace(/[^a-zA-Z0-9]/g, '')}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  } catch (err) {
    console.error('Export failed:', err);
    alert(`${t('ui.exportFailed')}: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

function createSimWindow(opts = {}) {
  windowCounter++;
  const template = document.getElementById('sim-window-template');
  const clone = template.content.cloneNode(true);
  const win = clone.querySelector('.sim-window');
  const title = win.querySelector('.window-title');
  title.textContent = `#${windowCounter}`;

  // Wire up close button
  win.querySelector('.window-close').addEventListener('click', () => {
    if (document.querySelectorAll('.sim-window').length <= 1) return;
    win.remove();
    renumberWindows();
    scheduleHashUpdate();
  });

  // Strategy select + editor wiring
  const stratSelect = win.querySelector('.strategy-select');
  const editorContainer = win.querySelector('.editor-container');
  const toggleBtn = win.querySelector('.editor-toggle');
  const textarea = win.querySelector('.strategy-editor');

  // Strategy description display
  const stratDesc = win.querySelector('.strategy-description');
  function updateStrategyDescription(name) {
    const localized = t(`strategyDesc.${name}`);
    const desc = localized.startsWith('strategyDesc.') ? getStrategyDescription(name) : localized;
    stratDesc.textContent = desc;
    stratDesc.style.display = desc ? '' : 'none';
  }

  // Apply options from URL hash or defaults
  if (opts.strategy) {
    stratSelect.value = opts.strategy;
    if (opts.strategy === 'custom') {
      textarea.value = opts.code || '';
      editorContainer.classList.remove('collapsed');
    } else {
      applyBuiltInStrategyCode(textarea, opts.strategy);
    }
  } else {
    applyBuiltInStrategyCode(textarea, stratSelect.value);
  }
  updateStrategyDescription(stratSelect.value);

  // Toggle collapse/expand
  toggleBtn.addEventListener('click', () => {
    editorContainer.classList.toggle('collapsed');
  });

  // Strategy change: reset code for built-ins, toggle collapse
  stratSelect.addEventListener('change', () => {
    const name = stratSelect.value;
    updateStrategyDescription(name);
    if (name === 'custom') {
      // Expand editor, don't touch the code
      editorContainer.classList.remove('collapsed');
    } else {
      // Reset to built-in source, collapse
      applyBuiltInStrategyCode(textarea, name);
      editorContainer.classList.add('collapsed');
    }
  });

  // Tab key support in textarea
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
    }
  });

  // Export button
  win.querySelector('.window-export').addEventListener('click', () => exportWindowAsJpeg(win));

  // Run button
  win.querySelector('.run-btn').addEventListener('click', () => runSimulation(win));

  setPercentileVisibility(win, false);

  win.querySelector('.results-panel').addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-dist-key]');
    if (!trigger) return;
    openDistributionFromTrigger(win, trigger);
  });
  win.querySelector('.results-panel').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const trigger = event.target.closest('[data-dist-key]');
    if (!trigger) return;
    event.preventDefault();
    openDistributionFromTrigger(win, trigger);
  });

  applyStaticTranslations(clone);
  document.getElementById('windows-container').appendChild(clone);
  renumberWindows();
  scheduleHashUpdate();
}

function renumberWindows() {
  document.querySelectorAll('.sim-window').forEach((win, i) => {
    win.querySelector('.window-title').textContent = `#${i + 1}`;
  });
}

function runSimulation(win) {
  const stratSelect = win.querySelector('.strategy-select');
  const trialsInput = document.getElementById('trials-input');
  const bannersInput = document.getElementById('banners-input');
  const editor = win.querySelector('.strategy-editor');
  const runBtn = win.querySelector('.run-btn');
  const progressContainer = win.querySelector('.progress-bar-container');
  const progressBar = win.querySelector('.progress-bar');
  const progressText = win.querySelector('.progress-text');
  const resultsPlaceholder = win.querySelector('.results-placeholder');
  const resultsContent = win.querySelector('.results-content');
  const seedInput = document.getElementById('seed-input');

  const config = {
    numTrials: Math.min(100000, Math.max(100, parseIntegerOrFallback(trialsInput.value, 5000))),
    maxBanners: Math.min(10000, Math.max(1, parseIntegerOrFallback(bannersInput.value, 100))),
    welfareFree: Math.min(120, Math.max(0, parseIntegerOrFallback(document.getElementById('welfare-free-pulls').value, 10))),
    startWithCharteredHH: document.getElementById('start-chartered-hh').checked,
    seed: seedInput.value.trim() !== '' ? parseIntegerOrFallback(seedInput.value, null) : null,
    startFiveStarPity: Math.min(9, Math.max(0, parseIntegerOrFallback(document.getElementById('start-5star-pity').value, 0))),
    startSixStarPity: Math.min(79, Math.max(0, parseIntegerOrFallback(document.getElementById('start-6star-pity').value, 0))),
  };

  // Always send the editor code; for built-ins it's the source, for custom it's the user code.
  const strategyName = 'custom';
  const customCode = editor.value;

  // UI: disable, show progress
  runBtn.disabled = true;
  runBtn.textContent = t('ui.running');
  progressContainer.style.display = '';
  progressBar.style.transform = 'scaleX(0)';
  progressText.textContent = '0%';
  resultsPlaceholder.classList.add('hidden');
  resultsContent.classList.add('hidden');
  _metricDistributionStore.delete(win);
  setPercentileVisibility(win, false);

  const worker = new Worker(new URL('./gacha-engine.worker.js', import.meta.url), { type: 'module' });

  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'progress') {
      const pct = Math.round(msg.progress * 100);
      progressBar.style.transform = `scaleX(${Math.max(0, Math.min(1, msg.progress))})`;
      progressText.textContent = pct + '%';
    } else if (msg.type === 'done') {
      worker.terminate();
      runBtn.disabled = false;
      runBtn.textContent = t('ui.runSimulation');
      progressContainer.style.display = 'none';
      config.baseSeed = msg.baseSeed;
      displayResults(win, msg.results, config, msg.sampleBannerLogs, msg.terminationCounts, msg.rateUpCounts);
    } else if (msg.type === 'error') {
      worker.terminate();
      runBtn.disabled = false;
      runBtn.textContent = t('ui.runSimulation');
      progressContainer.style.display = 'none';
      resultsContent.classList.remove('hidden');
      resultsContent.innerHTML = `<div class="error-msg">${escapeHtml(msg.error)}</div>`;
    }
  };

  worker.onerror = (err) => {
    worker.terminate();
    runBtn.disabled = false;
    runBtn.textContent = t('ui.runSimulation');
    progressContainer.style.display = 'none';
    resultsContent.classList.remove('hidden');
    resultsContent.innerHTML = `<div class="error-msg">${t('ui.workerError')}: ${escapeHtml(err.message)}</div>`;
  };

  worker.postMessage({ type: 'run', config, strategyName, customCode });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// --- Statistics ---
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  if (p <= 0) return sorted[0];
  if (p >= 100) return sorted[sorted.length - 1];
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[rank - 1];
}

function mean(arr) {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function computeDistributionStats(values) {
  const avg = mean(values);
  const variance = values.reduce((sum, value) => {
    const delta = value - avg;
    return sum + delta * delta;
  }, 0) / values.length;
  return {
    mean: avg,
    variance,
    stdDev: Math.sqrt(variance),
  };
}

function normalPdf(value, meanValue, stdDev) {
  if (!Number.isFinite(value) || !Number.isFinite(meanValue) || !Number.isFinite(stdDev) || stdDev <= 0) {
    return 0;
  }
  const z = (value - meanValue) / stdDev;
  return Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI));
}

function sortNums(values) {
  return values.slice().sort((a, b) => a - b);
}

function sortFiniteNums(values) {
  return values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
}

function buildHistogram(sorted, buckets) {
  if (sorted.length === 0) return [];
  const minVal = sorted[0];
  const maxVal = sorted[sorted.length - 1];
  if (minVal === maxVal) return [{ lo: minVal, hi: minVal, count: sorted.length, pct: 100 }];

  const bucketSize = (maxVal - minVal) / buckets;
  const counts = new Array(buckets).fill(0);
  for (const v of sorted) {
    let b = Math.floor((v - minVal) / bucketSize);
    if (b >= buckets) b = buckets - 1;
    counts[b]++;
  }

  return counts.map((c, i) => ({
    lo: Math.round(minVal + i * bucketSize),
    hi: Math.round(minVal + (i + 1) * bucketSize),
    count: c,
    pct: (100 * c / sorted.length),
  }));
}

function defaultDistributionFormatter(value) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value - Math.round(value)) < 1e-9) return Math.round(value).toLocaleString();
  return value.toFixed(Math.abs(value) >= 100 ? 1 : 2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function formatDistributionDisplayValue(value, formatValue, digits) {
  if (!Number.isFinite(value)) return '—';
  const formatted = formatValue(value);
  if (Math.abs(value - Math.round(value)) < 1e-9) return formatted;

  const numericMatch = String(formatted).match(/[+-]?\d[\d,]*(?:\.\d+)?/);
  const precise = value.toFixed(digits ?? (Math.abs(value) >= 100 ? 1 : 2))
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1');

  if (!numericMatch) return precise;
  if (numericMatch[0].includes('.')) return formatted;
  return String(formatted).replace(numericMatch[0], precise);
}

function renderDistribution(sorted, n, options = {}) {
  const formatValue = options.formatValue || defaultDistributionFormatter;
  const showPercentiles = options.showPercentiles ?? true;
  const showStdCurve = options.showStdCurve ?? true;
  const selectedPercentile = Number.isFinite(options.selectedPercentile) ? Math.max(1, Math.min(100, options.selectedPercentile)) : null;
  if (!sorted || sorted.length === 0) {
    return `<div class="dist-single">${tr('result.noData', 'No data')}</div>`;
  }
  const buckets = 30;
  const absMin = sorted[0];
  const absMax = sorted[sorted.length - 1];
  if (absMin === absMax) {
    return `<div class="dist-single">${formatValue(absMin)} ${tr('result.allTrialsIdentical', '')}</div>`;
  }

  const trimMin = percentile(sorted, 1);
  const trimMax = percentile(sorted, 99);
  const minVal = trimMin < trimMax ? trimMin : absMin;
  const maxVal = trimMin < trimMax ? trimMax : absMax;
  const range = maxVal - minVal;
  const bucketSize = range / buckets;
  const counts = new Array(buckets).fill(0);
  let trimmedLow = 0;
  let trimmedHigh = 0;

  for (const value of sorted) {
    if (value < minVal) {
      trimmedLow++;
      continue;
    }
    if (value > maxVal) {
      trimmedHigh++;
      continue;
    }
    let bucket = Math.floor((value - minVal) / bucketSize);
    if (bucket >= buckets) bucket = buckets - 1;
    counts[bucket]++;
  }
  const maxCount = Math.max(...counts);
  const includedCount = sorted.length - trimmedLow - trimmedHigh;
  const stats = computeDistributionStats(sorted);

  // SVG dimensions
  const W = 380, H = 120;
  const padL = 2, padR = 2, padT = 20, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = chartW / buckets;

  let stdCurvePath = '';
  let yScaleMax = maxCount;
  if (showStdCurve && stats.stdDev > 0 && Number.isFinite(stats.stdDev)) {
    const curveSteps = 96;
    const curvePoints = [];
    let curvePeak = 0;

    for (let i = 0; i <= curveSteps; i++) {
      const ratio = i / curveSteps;
      const value = minVal + ratio * range;
      const expectedCount = normalPdf(value, stats.mean, stats.stdDev) * bucketSize * includedCount;
      curvePeak = Math.max(curvePeak, expectedCount);
      curvePoints.push({ ratio, expectedCount });
    }

    yScaleMax = Math.max(yScaleMax, curvePeak);
    stdCurvePath = curvePoints.map((point, index) => {
      const x = padL + point.ratio * chartW;
      const y = padT + chartH - (point.expectedCount / yScaleMax) * chartH;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  }

  const pMarkers = showPercentiles
    ? [
      { p: 5, label: 'P5', color: '#4caf50' },
      { p: 25, label: 'P25', color: '#8aa4ff' },
      { p: 50, label: 'P50', color: '#fff' },
      { p: 75, label: 'P75', color: '#8aa4ff' },
      { p: 95, label: 'P95', color: '#ff9800' },
    ]
    : [];
  const pVals = pMarkers.map(m => ({ ...m, val: percentile(sorted, m.p) }));

  let svg = `<svg class="dist-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;

  // Bars
  for (let i = 0; i < buckets; i++) {
    const barH = yScaleMax > 0 ? (counts[i] / yScaleMax) * chartH : 0;
    const x = padL + i * barW;
    const y = padT + chartH - barH;
    // Color gradient from dim to bright based on height
    const intensity = maxCount > 0 ? counts[i] / maxCount : 0;
    const r = Math.round(108 + intensity * 30);
    const g = Math.round(140 + intensity * 24);
    const b = Math.round(255);
    svg += `<rect x="${x}" y="${y}" width="${Math.max(barW - 1, 1)}" height="${barH}" rx="1" fill="rgb(${r},${g},${b})" fill-opacity="${0.35 + intensity * 0.65}"/>`;
  }

  if (stdCurvePath) {
    svg += `<path d="${stdCurvePath}" fill="none" stroke="#dfe5ff" stroke-width="1.8" stroke-opacity="0.88" stroke-dasharray="6 4"/>`;
  }

  // Percentile markers — tick at actual data position, label at fixed evenly-spaced slot
  for (let i = 0; i < pVals.length; i++) {
    const pm = pVals[i];
    const xRaw = padL + ((pm.val - minVal) / range) * chartW;
    const xTick = Math.max(padL, Math.min(padL + chartW, xRaw));
    const xLabel = padL + (i + 0.5) * chartW / pVals.length;
    svg += `<line x1="${xTick}" y1="${padT}" x2="${xTick}" y2="${padT + chartH + 5}" stroke="${pm.color}" stroke-width="1" stroke-opacity="0.7" stroke-dasharray="${pm.p === 50 ? 'none' : '2,2'}"/>`;
    if (Math.abs(xTick - xLabel) > 1) {
      svg += `<line x1="${xTick}" y1="${padT + chartH + 5}" x2="${xLabel}" y2="${padT + chartH + 9}" stroke="${pm.color}" stroke-width="0.8" stroke-opacity="0.4"/>`;
    }
    svg += `<text x="${xLabel}" y="${padT + chartH + 17}" text-anchor="middle" fill="${pm.color}" font-size="9" font-family="inherit" opacity="0.9">${pm.label}</text>`;
    svg += `<text x="${xLabel}" y="${padT + chartH + 28}" text-anchor="middle" fill="${pm.color}" font-size="9" font-family="inherit" font-weight="600">${formatDistributionDisplayValue(pm.val, formatValue)}</text>`;
  }

  if (selectedPercentile != null) {
    const selectedValue = percentile(sorted, selectedPercentile);
    const xRaw = padL + ((selectedValue - minVal) / range) * chartW;
    const xPos = Math.max(padL, Math.min(padL + chartW, xRaw));
    const pointerColor = '#c47dff';
    svg += `<line x1="${xPos}" y1="${padT - 1}" x2="${xPos}" y2="${padT + chartH + 6}" stroke="${pointerColor}" stroke-width="1.8" stroke-opacity="0.9"/>`;
    svg += `<polygon points="${xPos - 5},${padT - 1} ${xPos + 5},${padT - 1} ${xPos},${padT + 6}" fill="${pointerColor}" fill-opacity="0.95"/>`;
    svg += `<text x="${xPos}" y="10" text-anchor="middle" fill="${pointerColor}" font-size="9" font-family="inherit" font-weight="700">P${selectedPercentile}</text>`;
  }

  // Min/max labels at top corners
  const lowVal = formatDistributionDisplayValue(minVal, formatValue);
  const highVal = formatDistributionDisplayValue(maxVal, formatValue);
  const lowLabel = trimmedLow > 0 ? `${lowVal} (←${trimmedLow})` : lowVal;
  const highLabel = trimmedHigh > 0 ? `(${trimmedHigh}→) ${highVal}` : highVal;
  svg += `<text x="${padL}" y="${padT - 6}" fill="#8b8fa3" font-size="9" font-family="inherit">${lowLabel}</text>`;
  svg += `<text x="${W - padR}" y="${padT - 6}" text-anchor="end" fill="#8b8fa3" font-size="9" font-family="inherit">${highLabel}</text>`;

  svg += `</svg>`;
  return `<div class="dist-chart">${svg}</div>`;
}

function createDistributionMetric(title, getValues, formatValue) {
  return { title, getValues, formatValue };
}

function getDistributionValues(metric) {
  if (!metric) return [];
  if (metric.sortedValues) return metric.sortedValues;
  const values = (typeof metric.getValues === 'function' ? metric.getValues() : metric.values || [])
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  metric.sortedValues = values;
  return values;
}

function setPercentileVisibility(win, visible) {
  const container = win.querySelector('.pctl-slider-container');
  if (!container) return;
  container.classList.toggle('hidden', !visible);
}

function clampPercentileValue(value, min, max, fallback) {
  const numericValue = Number.parseInt(value, 10);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(min, Math.min(max, numericValue));
}

function normalizePercentileRange(start, end) {
  const rangeStart = clampPercentileValue(start, 0, 100, 0);
  const rangeEnd = clampPercentileValue(end, 0, 100, 100);
  return {
    rangeStart: Math.min(rangeStart, rangeEnd),
    rangeEnd: Math.max(rangeStart, rangeEnd),
  };
}

function getPercentileRangeBounds(length, start, end) {
  if (!length) return null;
  const { rangeStart, rangeEnd } = normalizePercentileRange(start, end);
  const startIndex = rangeStart <= 0 ? 0 : Math.ceil((rangeStart / 100) * length) - 1;
  const endIndex = rangeEnd >= 100 ? length - 1 : Math.ceil((rangeEnd / 100) * length) - 1;
  return {
    rangeStart,
    rangeEnd,
    startIndex: Math.max(0, Math.min(length - 1, startIndex)),
    endIndex: Math.max(0, Math.min(length - 1, Math.max(startIndex, endIndex))),
  };
}

function averagePercentileRange(sorted, start, end) {
  const bounds = getPercentileRangeBounds(sorted?.length || 0, start, end);
  if (!bounds) return null;
  let sum = 0;
  for (let index = bounds.startIndex; index <= bounds.endIndex; index++) {
    sum += sorted[index];
  }
  return sum / (bounds.endIndex - bounds.startIndex + 1);
}

function getWindowDistributionMode(win) {
  const container = win.querySelector('.pctl-slider-container');
  return container?.dataset.mode === 'percentile' ? 'percentile' : 'average';
}

function setDistributionMode(win, mode) {
  const container = win.querySelector('.pctl-slider-container');
  if (!container) return;

  const nextMode = mode === 'percentile' ? 'percentile' : 'average';
  container.dataset.mode = nextMode;
  container.querySelectorAll('[data-pctl-mode]').forEach((button) => {
    const active = button.dataset.pctlMode === nextMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  container.querySelectorAll('[data-pctl-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.pctlPanel !== nextMode);
  });
}

function syncAverageRangeInputs(win, changedEdge) {
  const startSlider = win.querySelector('.pctl-range-start');
  const endSlider = win.querySelector('.pctl-range-end');
  if (!startSlider || !endSlider) return { rangeStart: 0, rangeEnd: 100 };

  let rangeStart = clampPercentileValue(startSlider.value, 0, 100, 0);
  let rangeEnd = clampPercentileValue(endSlider.value, 0, 100, 100);
  if (changedEdge === 'start' && rangeStart > rangeEnd) rangeEnd = rangeStart;
  if (changedEdge === 'end' && rangeEnd < rangeStart) rangeStart = rangeEnd;

  const normalized = normalizePercentileRange(rangeStart, rangeEnd);
  startSlider.value = String(normalized.rangeStart);
  endSlider.value = String(normalized.rangeEnd);
  return normalized;
}

function getDistributionState(win) {
  const percentileSlider = win.querySelector('.pctl-single-slider');
  const { rangeStart, rangeEnd } = syncAverageRangeInputs(win);
  return {
    mode: getWindowDistributionMode(win),
    percentileValue: clampPercentileValue(percentileSlider?.value, 1, 100, 50),
    rangeStart,
    rangeEnd,
  };
}

function updateDistributionLabels(win, state) {
  const summaryLabel = win.querySelector('[data-pctl="sliderLabel"]');
  if (summaryLabel) {
    summaryLabel.textContent = state.mode === 'percentile'
      ? `P${state.percentileValue}`
      : `${tr('ui.distributionModeAverage', 'Average')} P${state.rangeStart}-P${state.rangeEnd}`;
  }


}

function getDistributionMetricValue(values, state) {
  if (!values?.length) return null;
  if (state.mode === 'percentile') return percentile(values, state.percentileValue);
  return averagePercentileRange(values, state.rangeStart, state.rangeEnd);
}

function initPercentileSlider(win, sorted, ctx) {
  const sliderContainer = win.querySelector('.sticky-pctl');
  const percentileSlider = win.querySelector('.pctl-single-slider');
  const rangeStartSlider = win.querySelector('.pctl-range-start');
  const rangeEndSlider = win.querySelector('.pctl-range-end');
  if (!sliderContainer || !percentileSlider || !rangeStartSlider || !rangeEndSlider) return;

  if (sliderContainer) sliderContainer.classList.remove('hidden');

  if (sliderContainer.dataset.mode !== 'percentile' && sliderContainer.dataset.mode !== 'average') {
    sliderContainer.dataset.mode = 'average';
  }
  if (!percentileSlider.value) percentileSlider.value = '50';
  if (!rangeStartSlider.value) rangeStartSlider.value = '0';
  if (!rangeEndSlider.value) rangeEndSlider.value = '100';
  syncAverageRangeInputs(win);
  setDistributionMode(win, getWindowDistributionMode(win));

  function updatePctlValues() {
    const state = getDistributionState(win);
    const pick = (key) => {
      const values = sorted[key];
      return values && values.length > 0 ? getDistributionMetricValue(values, state) : null;
    };
    const fmt = (value, digits) => value == null ? '—' : value.toFixed(digits);
    const fmtInt = (value) => value == null ? '—' : formatDistributionDisplayValue(value, (raw) => Math.round(raw).toLocaleString(), 1);

    const paid = pick('paid');
    const total = pick('total');
    const bonus30 = pick('bonus30');
    const bonus60 = pick('bonus60');
    const welfare = pick('welfare');
    const fourStar = pick('fourStar');
    const fiveStar = pick('fiveStar');
    const rateUp = pick('rateUp');
    const limited = pick('limited');
    const standard = pick('standard');
    const sixTotal = pick('sixTotal');
    const paidPerBannerAll = pick('paidPerBannerAll');
    const paidPerTarget = pick('paidPerBannerTarget');
    const paidPerRateUp = pick('paidPerRateUp');
    const pityPerTarget = pick('pityPerTarget');
    const totalPerBannerAll = pick('totalPerBannerAll');
    const totalPerBannerTarget = pick('totalPerBannerTarget');
    const fourStarPerBanner = pick('fourStarPerBanner');
    const fiveStarPerBanner = pick('fiveStarPerBanner');
    const standardPerBanner = pick('standardPerBanner');
    const rateUpPerBanner = pick('rateUpPerBanner');
    const limitedPerBanner = pick('limitedPerBanner');
    const sixTotalPerBanner = pick('sixTotalPerBanner');
    const paidPerAnySix = pick('paidPerAnySix');
    const arsenal4 = pick('arsenal4');
    const arsenal5 = pick('arsenal5');
    const arsenal6 = pick('arsenal6');
    const arsenalTotal = pick('arsenalTotal');
    const arsenal10pull = pick('arsenal10pull');
    const arsenal10pullPerBanner = pick('arsenal10pullPerBanner');
    const bondQuota = pick('bondQuota');
    const hhTicket = pick('hhTicket');
    const hhTicketPerBanner = pick('hhTicketPerBanner');
    const aicQuota4 = pick('aicQuota4');
    const aicQuota5 = pick('aicQuota5');
    const aicQuotaTotal = pick('aicQuotaTotal');
    const bannerHHTicket = pick('bannerHHTicket');
    const bannerHHTicketPerBanner = pick('bannerHHTicketPerBanner');
    const bannersSkipped = pick('bannersSkipped');

    const shortfall = paidPerBannerAll == null ? null : paidPerBannerAll - ctx.welfarePulls;
    const withMC = shortfall == null ? null : shortfall - ctx.monthlyCardPulls;
    const withMCBundle = withMC == null ? null : withMC - ctx.bundlePulls;
    const hardSpendCost = withMCBundle == null
      ? null
      : ctx.bundleCostProrated + Math.max(0, withMCBundle) * ctx.costPerPull;

    const fmtShortfall = (value) => value == null ? '—' : (value > 0 ? '-' : '+') + Math.abs(value).toFixed(1) + ` ${tr('result.pullsWord', 'pulls')}`;
    const shortfallColor = (value) => value == null ? '' : (value > 0 ? 'red' : 'green');

    const set = (key, text, color) => {
      const el = win.querySelector(`[data-pctl="${key}"]`);
      if (!el) return;
      el.textContent = text;
      const classNames = [el.classList.contains('hero-num') ? 'hero-num' : 'stat-value'];
      if (color) classNames.push(color);
      if (el.dataset.distKey) classNames.push('stat-value-clickable');
      el.className = classNames.join(' ');
    };

    percentileSlider.value = String(state.percentileValue);
    updateDistributionLabels(win, state);

    set('heroPityPerTarget', fmt(pityPerTarget, 1));
    set('paidPerTarget', fmt(paidPerTarget, 1));
    set('paidPerRateUp', fmt(paidPerRateUp, 1));

    set('bannersSkipped', fmt(bannersSkipped, 1));

    set('paidPulls', fmt(paid, 1));
    set('paidPerBannerAll', fmt(paidPerBannerAll, 2));
    set('paidPerBannerTarget', fmt(paidPerTarget, 2));

    set('welfare', fmt(welfare, 1));
    set('bonus30', fmt(bonus30, 1));
    set('bonus60', fmt(bonus60, 1));

    set('totalPulls', fmt(total, 1));
    set('pityPerTarget', fmt(pityPerTarget, 1));
    set('totalPerBannerAll', fmt(totalPerBannerAll, 1));
    set('totalPerBannerTarget', fmt(totalPerBannerTarget, 1));

    set('fourStar', fmt(fourStar, 2));
    set('fourStarPerBanner', fmt(fourStarPerBanner, 2));
    set('fiveStar', fmt(fiveStar, 2));
    set('fiveStarPerBanner', fmt(fiveStarPerBanner, 2));
    set('standard', fmt(standard, 2));
    set('standardPerBanner', fmt(standardPerBanner, 2));
    set('rateUp', fmt(rateUp, 2), 'gold');
    set('rateUpPerBanner', fmt(rateUpPerBanner, 2), 'gold');
    set('limited', fmt(limited, 2), 'orange');
    set('limitedPerBanner', fmt(limitedPerBanner, 2), 'orange');
    set('sixTotal', fmt(sixTotal, 2), 'gold');
    set('sixTotalPerBanner', fmt(sixTotalPerBanner, 2), 'gold');

    set('paidPerRateUp6', fmt(paidPerRateUp, 2), 'gold');
    set('paidPerAnySix', fmt(paidPerAnySix, 2));

    set('arsenal4', fmtInt(arsenal4));
    set('arsenal5', fmtInt(arsenal5));
    set('arsenal6', fmtInt(arsenal6));
    set('arsenalTotal', fmtInt(arsenalTotal), 'green');
    set('arsenal10pull', fmt(arsenal10pull, 2), 'green');
    set('arsenal10pullPerBanner', fmt(arsenal10pullPerBanner, 2), 'green');

    set('bondQuota', fmtInt(bondQuota));
    set('hhTicket', fmt(hhTicket, 1));
    set('hhTicketPerBanner', fmt(hhTicketPerBanner, 2));
    set('aicQuota4', fmtInt(aicQuota4));
    set('aicQuota5', fmtInt(aicQuota5));
    set('aicQuotaTotal', fmtInt(aicQuotaTotal), 'blue');
    set('bannerHHTicket', fmt(bannerHHTicket, 1), 'blue');
    set('bannerHHTicketPerBanner', fmt(bannerHHTicketPerBanner, 2), 'blue');

    set('shortfall', fmtShortfall(shortfall), shortfallColor(shortfall));
    set('withMC', fmtShortfall(withMC), shortfallColor(withMC));
    set('withMCBundle', fmtShortfall(withMCBundle), shortfallColor(withMCBundle));
    set('hardSpendCost', hardSpendCost == null ? '—' : ctx.fmtMoney(hardSpendCost));

    const shortfallRow = win.querySelector('[data-pctl="shortfall"]');
    if (shortfallRow) {
      const row = shortfallRow.closest('.stat-row');
      const label = row?.querySelector('.stat-label');
      if (label) {
        const newLabel = shortfall > 0 ? trResultLabel('Shortfall/banner') : trResultLabel('Gain/banner');
        label.innerHTML = `${newLabel} <span class="tip-icon">?</span>`;
      }
      if (row && shortfall != null) {
        row.dataset.tip = shortfall > 0
          ? tip('shortfall', { welfare: ctx.welfarePulls })
          : tip('surplus', { welfare: ctx.welfarePulls, pulls: Math.abs(shortfall).toFixed(1) });
      }
    }

    updateHistogramMarker(win, sorted.paid, state);
  }

  percentileSlider.oninput = () => {
    updatePctlValues();
  };
  percentileSlider.onchange = percentileSlider.oninput;

  rangeStartSlider.oninput = () => {
    syncAverageRangeInputs(win, 'start');
    updatePctlValues();
  };
  rangeStartSlider.onchange = rangeStartSlider.oninput;

  rangeEndSlider.oninput = () => {
    syncAverageRangeInputs(win, 'end');
    updatePctlValues();
  };
  rangeEndSlider.onchange = rangeEndSlider.oninput;

  win.querySelectorAll('[data-pctl-mode]').forEach((button) => {
    button.onclick = () => {
      setDistributionMode(win, button.dataset.pctlMode);
      updatePctlValues();
    };
  });

  updatePctlValues();
}

function updateHistogramMarker(win, paidPulls, state) {
  const svg = win.querySelector('.dist-svg');
  if (!svg || !paidPulls?.length) return;

  const old = svg.querySelector('.pctl-marker-group');
  if (old) old.remove();
  const vb = svg.getAttribute('viewBox')?.split(' ').map(Number);
  if (!vb || vb.length < 4) return;

  const width = vb[2];
  const height = vb[3];
  const padL = 2;
  const padR = 2;
  const padT = 20;
  const padB = 32;
  const chartW = width - padL - padR;

  const trimMin = percentile(paidPulls, 1);
  const trimMax = percentile(paidPulls, 99);
  const minVal = trimMin < trimMax ? trimMin : paidPulls[0];
  const maxVal = trimMin < trimMax ? trimMax : paidPulls[paidPulls.length - 1];
  const range = maxVal - minVal;
  if (range === 0) return;

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', 'pctl-marker-group');

  const projectX = (value) => {
    const xRaw = padL + ((value - minVal) / range) * chartW;
    return Math.max(padL, Math.min(padL + chartW, xRaw));
  };

  if (state.mode === 'percentile') {
    const value = percentile(paidPulls, state.percentileValue);
    const xPos = projectX(value);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', xPos);
    line.setAttribute('y1', padT);
    line.setAttribute('x2', xPos);
    line.setAttribute('y2', padT + (height - padT - padB));
    line.setAttribute('stroke', '#c47dff');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-opacity', '0.9');
    group.appendChild(line);

    const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    triangle.setAttribute('points', `${xPos - 4},${padT - 2} ${xPos + 4},${padT - 2} ${xPos},${padT + 4}`);
    triangle.setAttribute('fill', '#c47dff');
    group.appendChild(triangle);
  } else {
    const { rangeStart, rangeEnd } = normalizePercentileRange(state.rangeStart, state.rangeEnd);
    if (!(rangeStart <= 0 && rangeEnd >= 100)) {
      const startValue = percentile(paidPulls, rangeStart);
      const endValue = percentile(paidPulls, rangeEnd);
      const startX = projectX(startValue);
      const endX = projectX(endValue);
      const leftX = Math.min(startX, endX);
      const rightX = Math.max(startX, endX);
      const chartHeight = height - padT - padB;

      if (rightX - leftX > 1) {
        const band = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        band.setAttribute('x', leftX);
        band.setAttribute('y', padT);
        band.setAttribute('width', rightX - leftX);
        band.setAttribute('height', chartHeight);
        band.setAttribute('fill', '#9fd0ff');
        band.setAttribute('fill-opacity', '0.14');
        group.appendChild(band);
      }

      [startX, endX].forEach((xPos, index) => {
        if (index === 1 && Math.abs(endX - startX) < 0.5) return;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', xPos);
        line.setAttribute('y1', padT);
        line.setAttribute('x2', xPos);
        line.setAttribute('y2', padT + chartHeight);
        line.setAttribute('stroke', '#9fd0ff');
        line.setAttribute('stroke-width', '1.6');
        line.setAttribute('stroke-opacity', '0.85');
        line.setAttribute('stroke-dasharray', '4 3');
        group.appendChild(line);
      });
    }
  }

  if (group.childNodes.length > 0) svg.appendChild(group);
}

function getDistributionTriggerDescription(trigger) {
  return trigger?.dataset.tip || trigger?.closest('[data-tip]')?.dataset.tip || '';
}

function openDistributionFromTrigger(win, trigger) {
  if (!trigger) return;
  const metric = _metricDistributionStore.get(win)?.get(trigger.dataset.distKey);
  openDistributionModal(metric, getDistributionTriggerDescription(trigger));
}

function formatDistributionSummaryValue(value, formatValue, digits = 2) {
  return formatDistributionDisplayValue(value, formatValue, digits);
}

function renderDistributionSummary(sorted, formatValue) {
  const distributionStats = computeDistributionStats(sorted);
  const median = percentile(sorted, 50);
  const stats = [
    [tr('result.distMean', 'Mean'), formatDistributionSummaryValue(distributionStats.mean, formatValue)],
    [tr('result.distStdDev', 'Std Dev'), formatDistributionSummaryValue(distributionStats.stdDev, formatValue)],
    [tr('result.distMedian', 'Median'), formatDistributionSummaryValue(median, formatValue)],
    [tr('result.distMin', 'Min'), formatDistributionDisplayValue(sorted[0], formatValue)],
    [tr('result.distMax', 'Max'), formatDistributionDisplayValue(sorted[sorted.length - 1], formatValue)],
  ];
  return `<div class="distribution-summary-grid">${stats.map(([label, value]) => `
    <div class="distribution-summary-item">
      <span class="distribution-summary-label">${label}</span>
      <span class="distribution-summary-value">${value}</span>
    </div>
  `).join('')}</div>`;
}

function ensureDistributionModal() {
  if (_distributionModalEl) return _distributionModalEl;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay distribution-modal hidden';
  modal.innerHTML = `
    <div class="modal-content distribution-modal-content">
      <div class="modal-header">
        <div class="distribution-modal-heading">
          <h2></h2>
          <p class="distribution-modal-note hidden"></p>
        </div>
        <button class="modal-close" title="${escapeHtml(t('ui.close'))}">×</button>
      </div>
      <div class="modal-body distribution-modal-body">
        <div class="distribution-modal-chart"></div>
        <div class="distribution-modal-summary"></div>
      </div>
    </div>
  `;
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.classList.add('hidden');
  });
  document.body.appendChild(modal);
  _distributionModalEl = modal;
  return modal;
}

function openDistributionModal(metric, description = '') {
  if (!metric) return;
  const values = getDistributionValues(metric);
  if (!values.length) return;
  const formatValue = metric.formatValue || defaultDistributionFormatter;

  hideTooltip();
  const modal = ensureDistributionModal();
  modal.querySelector('.modal-header h2').textContent = metric.title;
  modal.querySelector('.modal-close').setAttribute('title', t('ui.close'));
  const noteEl = modal.querySelector('.distribution-modal-note');
  noteEl.textContent = description;
  noteEl.classList.toggle('hidden', !description);
  modal.querySelector('.distribution-modal-summary').innerHTML = renderDistributionSummary(values, formatValue);
  modal.querySelector('.distribution-modal-chart').innerHTML = renderDistribution(values, values.length, {
    formatValue,
    showPercentiles: true,
  });
  modal.classList.remove('hidden');
}

function formatSixStarRate(rate) {
  if (rate >= 1.0) return '100%';
  if (rate === 0) return '—';
  return (rate * 100).toFixed(1) + '%';
}

function sixStarRateClass(rate) {
  if (rate >= 1.0) return 'rate-guaranteed';
  if (rate > 0.05) return 'rate-high';
  if (rate > 0.008) return 'rate-soft';
  return '';
}

function renderBannerInspector(bannerLogs) {
  if (!bannerLogs || bannerLogs.length === 0) return '';

  let html = `<div class="banner-inspector-header">`;
  html += `<h3>${tr('result.sampleTrial', 'Sample Trial — Banner Inspector')}</h3>`;
  html += `<label class="advanced-toggle has-tip" data-tip="${escapeHtml(tip('advancedInspector'))}"><input type="checkbox" class="advanced-toggle-input"> ${tr('result.advanced', 'Advanced')} <span class="tip-icon">?</span></label>`;
  html += `</div>`;
  html += `<div class="banner-inspector">`;

  // Tabs
  html += `<div class="banner-tabs">`;
  for (let i = 0; i < bannerLogs.length; i++) {
    const b = bannerLogs[i];
    const sixStars = b.totalSixStarRateUp + b.totalSixStarLimited + b.totalSixStarStandard;
    const hasRateUp = b.gotRateUp;
    const tabClass = hasRateUp ? 'has-rateup' : (sixStars > 0 ? 'has-six' : '');
    html += `<button class="banner-tab ${i === 0 ? 'active' : ''} ${tabClass}" data-tab="${i}">`;
    html += `B${b.serial}`;
    html += `</button>`;
  }
  html += `</div>`;

  // Tab panels
  for (let i = 0; i < bannerLogs.length; i++) {
    const b = bannerLogs[i];
    const sixStars = b.totalSixStarRateUp + b.totalSixStarLimited + b.totalSixStarStandard;
    html += `<div class="banner-tab-panel ${i === 0 ? '' : 'hidden'}" data-panel="${i}">`;

    // Banner summary line
    html += `<div class="banner-summary">`;
    html += `<span>${tr('result.bannerSingle', 'Banner')} ${b.serial}</span>`;
    html += `<span class="sep">·</span>`;
    html += `<span>${b.pullCount} ${tr('result.paid', 'paid')}</span>`;
    if (b.bonus30PullCount > 0) html += `<span class="sep">·</span><span>${b.bonus30PullCount} ${tr('result.bonus30', 'bonus30')}</span>`;
    html += `<span class="sep">·</span>`;
    if (b.gotRateUp) html += `<span class="six-star-rateup">✓ ${tr('result.rateUp', 'rate-up')}</span>`;
    else html += `<span class="dim">${tr('result.noRateUp', 'no rate-up')}</span>`;
    if (sixStars > 0) {
      html += `<span class="sep">·</span><span class="gold">${sixStars}x 6★</span>`;
    }
    html += `</div>`;

    // Pull list
    html += `<div class="pull-log">`;
    for (let j = 0; j < b.pulls.length; j++) {
      const p = b.pulls[j];
      const outcomeClass = OUTCOME_CLASSES[p.outcome];
      const outcomeLabel = trOutcomeLabel(OUTCOME_LABELS[p.outcome]);
      const typeLabel = trPullTypeLabel(PULL_TYPE_LABELS[p.pullType]);
      const typeClass = PULL_TYPE_CLASSES[p.pullType];
      const isSixStar = p.outcome >= 2;
      const isFiveStar = p.outcome === 1;
      const isNotable = isSixStar || isFiveStar || p.rateUpToken;

      html += `<div class="pull-entry ${outcomeClass} ${isNotable ? 'notable' : ''}">`;
      html += `<span class="pull-num">#${p.bannerPull}</span>`;
      html += `<span class="pull-outcome ${outcomeClass}">${outcomeLabel}</span>`;
      html += `<span class="pull-type ${typeClass}">${typeLabel}</span>`;
      if (p.sixStarPity >= 0) {
        html += `<span class="pull-pity">6★p:${p.sixStarPity}</span>`;
        html += `<span class="pull-pity">5★p:${p.fiveStarPity}</span>`;
      } else {
        html += `<span class="pull-pity dim">—</span>`;
        html += `<span class="pull-pity dim">—</span>`;
      }
      html += `<span class="pull-rate adv-stat ${sixStarRateClass(p.sixStarRate)}">${formatSixStarRate(p.sixStarRate)}</span>`;
      if (p.mainRoll >= 0) html += `<span class="pull-roll adv-stat">${p.mainRoll.toFixed(3)}</span>`;
      else html += `<span class="pull-roll adv-stat dim">—</span>`;
      if (p.sixStarRoll1 >= 0) {
        let subRolls = p.sixStarRoll1.toFixed(3);
        if (p.sixStarRoll2 >= 0) subRolls += '/' + p.sixStarRoll2.toFixed(3);
        html += `<span class="pull-subroll adv-stat">${subRolls}</span>`;
      }
      if (p.pityForced) html += `<span class="pull-pity-forced adv-stat">${tr('result.pity', 'pity')}</span>`;
      if (p.rateUpToken) html += `<span class="pull-token">🎫 ${tr('result.token', 'token')}</span>`;
      html += `</div>`;
    }
    html += `</div>`;
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function initBannerTabs(win) {
  const inspector = win.querySelector('.banner-inspector');
  if (!inspector) return;

  // Tab switching
  inspector.addEventListener('click', (e) => {
    const tab = e.target.closest('.banner-tab');
    if (!tab) return;
    const idx = tab.dataset.tab;
    inspector.querySelectorAll('.banner-tab').forEach(t => t.classList.remove('active'));
    inspector.querySelectorAll('.banner-tab-panel').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    inspector.querySelector(`[data-panel="${idx}"]`).classList.remove('hidden');
  });

  // Advanced stats toggle
  const toggle = win.querySelector('.advanced-toggle-input');
  if (toggle) {
    toggle.addEventListener('change', () => {
      inspector.classList.toggle('show-advanced', toggle.checked);
    });
  }
}

let pullChartIdCounter = 0;

function renderPullDistChart(counts, color, gradId) {
  if (!counts || counts.length === 0) return '';

  const cap = counts.length - 1;
  let maxX = 0, maxY = 0;
  for (let i = 0; i <= cap; i++) {
    if (counts[i] > 0) maxX = i;
    if (counts[i] > maxY) maxY = counts[i];
  }
  if (maxY === 0) return `<div class="term-chart-empty">${tr('result.noData', 'No data')}</div>`;

  const W = 380, H = 150;
  const padL = 40, padR = 10, padT = 10, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const xMax = Math.min(maxX + 5, cap);

  let svg = `<svg class="term-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;

  // Y grid
  const yTicks = 4;
  for (let t = 0; t <= yTicks; t++) {
    const yVal = Math.round(maxY * t / yTicks);
    const y = padT + chartH - (chartH * t / yTicks);
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#2e3347" stroke-width="0.5"/>`;
    svg += `<text x="${padL - 4}" y="${y + 3}" text-anchor="end" fill="#8b8fa3" font-size="9" font-family="inherit">${yVal}</text>`;
  }

  const xOf = (i) => padL + (i / xMax) * chartW;
  const yOf = (c) => padT + chartH - (c / maxY) * chartH;
  const baseY = yOf(0);

  const pts = [];
  for (let i = 0; i <= xMax; i++) {
    const count = counts[i] || 0;
    if (count > 0) pts.push({ x: xOf(i), y: yOf(count), count, i });
  }

  if (pts.length > 0) {
    function monotoneSplinePath(points) {
      const n = points.length;
      if (n === 1) return `M${points[0].x},${points[0].y}`;
      if (n === 2) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;
      const dx = [], dy = [], m = [], t = [];
      for (let i = 0; i < n - 1; i++) {
        dx[i] = points[i+1].x - points[i].x;
        dy[i] = points[i+1].y - points[i].y;
        m[i] = dx[i] === 0 ? 0 : dy[i] / dx[i];
      }
      t[0] = m[0]; t[n-1] = m[n-2];
      for (let i = 1; i < n - 1; i++) {
        if (m[i-1] * m[i] <= 0) t[i] = 0;
        else t[i] = (m[i-1] + m[i]) / 2;
      }
      for (let i = 0; i < n - 1; i++) {
        if (m[i] === 0) { t[i] = 0; t[i+1] = 0; continue; }
        const a = t[i] / m[i], b = t[i+1] / m[i];
        const s = a * a + b * b;
        if (s > 9) { const tau = 3 / Math.sqrt(s); t[i] = tau * a * m[i]; t[i+1] = tau * b * m[i]; }
      }
      let d = `M${points[0].x},${points[0].y}`;
      for (let i = 0; i < n - 1; i++) {
        const seg = dx[i] / 3;
        d += ` C${points[i].x + seg},${points[i].y + t[i] * seg} ${points[i+1].x - seg},${points[i+1].y - t[i+1] * seg} ${points[i+1].x},${points[i+1].y}`;
      }
      return d;
    }

    const linePath = monotoneSplinePath(pts);
    const areaPath = `M${pts[0].x},${baseY} L${pts[0].x},${pts[0].y}` +
      linePath.slice(linePath.indexOf(' ')) +
      ` L${pts[pts.length-1].x},${baseY} Z`;

    svg += `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.6"/><stop offset="100%" stop-color="${color}" stop-opacity="0.05"/></linearGradient></defs>`;
    svg += `<path d="${areaPath}" fill="url(#${gradId})" fill-opacity="0.3"/>`;
    svg += `<path d="${linePath}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    for (const pt of pts) {
      const r = pt.count / maxY > 0.1 ? 2.5 : 1.5;
      svg += `<circle cx="${pt.x}" cy="${pt.y}" r="${r}" fill="${color}"/>`;
    }
  }

  // X axis labels
  const xLabelStep = xMax <= 100 ? 10 : xMax <= 200 ? 20 : xMax <= 300 ? 50 : 100;
  for (let i = 0; i <= xMax; i += xLabelStep) {
    const x = padL + (i / (xMax + 1)) * chartW;
    svg += `<text x="${x}" y="${H - 6}" text-anchor="middle" fill="#8b8fa3" font-size="9" font-family="inherit">${i}</text>`;
  }
  svg += `<text x="${padL + chartW / 2}" y="${H}" text-anchor="middle" fill="#8b8fa3" font-size="8" font-family="inherit">${tr('result.pullCount', 'pull count')}</text>`;
  svg += `</svg>`;
  return `<div class="term-chart">${svg}</div>`;
}

function renderPullDistSection(terminationCounts, rateUpCounts) {
  const id = pullChartIdCounter++;
  let html = `<div class="pull-dist-section">`;
  html += `<div class="pull-dist-tabs" data-pull-dist-id="${id}">`;
  html += `<button class="pull-dist-tab has-tip active" data-tab="rateup-${id}" data-tip="${escapeHtml(tip('pullDistRateUp'))}">${tr('result.rateUpSix', 'Rate-Up 6★')} <span class="tip-icon">?</span></button>`;
  html += `<button class="pull-dist-tab has-tip" data-tab="term-${id}" data-tip="${escapeHtml(tip('pullDistTermination'))}">${tr('result.termination', 'Termination')} <span class="tip-icon">?</span></button>`;
  html += `</div>`;
  html += `<div class="pull-dist-panel" data-panel="rateup-${id}">`;
  html += renderPullDistChart(rateUpCounts, '#ffd700', `rateUpGrad${id}`);
  html += `</div>`;
  html += `<div class="pull-dist-panel hidden" data-panel="term-${id}">`;
  html += renderPullDistChart(terminationCounts, '#4caf50', `termGrad${id}`);
  html += `</div>`;
  html += `</div>`;
  return html;
}

function initPullDistTabs(win) {
  win.querySelectorAll('.pull-dist-section').forEach(section => {
    section.addEventListener('click', (e) => {
      const btn = e.target.closest('.pull-dist-tab');
      if (!btn) return;
      const panelKey = btn.dataset.tab;
      section.querySelectorAll('.pull-dist-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      section.querySelectorAll('.pull-dist-panel').forEach(p => p.classList.add('hidden'));
      section.querySelector(`[data-panel="${panelKey}"]`).classList.remove('hidden');
    });
  });
}

function displayResults(win, results, config, sampleBannerLogs, terminationCounts, rateUpCounts) {
  const resultsContent = win.querySelector('.results-content');
  resultsContent.classList.remove('hidden');

  const n = results.length;
  const sorted = {
    paid: sortNums(results.map((result) => result.pullCount)),
    bonus30: sortNums(results.map((result) => result.bonus30PullCount)),
    bonus60: sortNums(results.map((result) => result.bonus60PullCount)),
    welfare: sortNums(results.map((result) => result.welfarePullCount)),
    total: sortNums(results.map((result) => (
      result.pullCount + result.bonus30PullCount + result.bonus60PullCount + result.welfarePullCount
    ))),
    fourStar: sortNums(results.map((result) => result.totalFourStar)),
    fiveStar: sortNums(results.map((result) => result.totalFiveStar)),
    rateUp: sortNums(results.map((result) => result.totalSixStarRateUp)),
    limited: sortNums(results.map((result) => result.totalSixStarLimited)),
    standard: sortNums(results.map((result) => result.totalSixStarStandard)),
    sixTotal: sortNums(results.map((result) => (
      result.totalSixStarRateUp + result.totalSixStarLimited + result.totalSixStarStandard
    ))),
    bannersSkipped: sortNums(results.map((result) => result.bannersSkipped)),
    paidPerBannerAll: sortFiniteNums(results.map((result) => (
      result.bannersVisited > 0 ? result.pullCount / result.bannersVisited : 0
    ))),
    paidPerBannerTarget: sortFiniteNums(results.map((result) => {
      const targetBanners = result.bannersVisited - result.bannersSkipped;
      return targetBanners > 0 ? result.pullCount / targetBanners : NaN;
    })),
    pityPerTarget: sortFiniteNums(results.map((result) => {
      const targetBanners = result.bannersVisited - result.bannersSkipped;
      return targetBanners > 0 ? result.targetPullCount / targetBanners : NaN;
    })),
    totalPerBannerAll: sortFiniteNums(results.map((result) => {
      const totalPulls = result.pullCount + result.bonus30PullCount + result.bonus60PullCount + result.welfarePullCount;
      return result.bannersVisited > 0 ? totalPulls / result.bannersVisited : 0;
    })),
    totalPerBannerTarget: sortFiniteNums(results.map((result) => {
      const totalPulls = result.pullCount + result.bonus30PullCount + result.bonus60PullCount + result.welfarePullCount;
      const targetBanners = result.bannersVisited - result.bannersSkipped;
      return targetBanners > 0 ? totalPulls / targetBanners : NaN;
    })),
    fourStarPerBanner: sortFiniteNums(results.map((result) => (
      result.bannersVisited > 0 ? result.totalFourStar / result.bannersVisited : 0
    ))),
    fiveStarPerBanner: sortFiniteNums(results.map((result) => (
      result.bannersVisited > 0 ? result.totalFiveStar / result.bannersVisited : 0
    ))),
    standardPerBanner: sortFiniteNums(results.map((result) => (
      result.bannersVisited > 0 ? result.totalSixStarStandard / result.bannersVisited : 0
    ))),
    rateUpPerBanner: sortFiniteNums(results.map((result) => (
      result.bannersVisited > 0 ? result.totalSixStarRateUp / result.bannersVisited : 0
    ))),
    limitedPerBanner: sortFiniteNums(results.map((result) => (
      result.bannersVisited > 0 ? result.totalSixStarLimited / result.bannersVisited : 0
    ))),
    sixTotalPerBanner: sortFiniteNums(results.map((result) => {
      const totalSix = result.totalSixStarRateUp + result.totalSixStarLimited + result.totalSixStarStandard;
      return result.bannersVisited > 0 ? totalSix / result.bannersVisited : 0;
    })),
    paidPerRateUp: sortFiniteNums(results.map((result) => (
      result.totalSixStarRateUp > 0 ? result.pullCount / result.totalSixStarRateUp : NaN
    ))),
    paidPerAnySix: sortFiniteNums(results.map((result) => {
      const totalSix = result.totalSixStarRateUp + result.totalSixStarLimited + result.totalSixStarStandard;
      return totalSix > 0 ? result.pullCount / totalSix : NaN;
    })),
    arsenal4: sortFiniteNums(results.map((result) => result.totalFourStar * 20)),
    arsenal5: sortFiniteNums(results.map((result) => result.totalFiveStar * 200)),
    arsenal6: sortFiniteNums(results.map((result) => {
      const totalSix = result.totalSixStarRateUp + result.totalSixStarLimited + result.totalSixStarStandard;
      return totalSix * 2000;
    })),
    arsenalTotal: sortFiniteNums(results.map((result) => {
      const totalSix = result.totalSixStarRateUp + result.totalSixStarLimited + result.totalSixStarStandard;
      return result.totalFourStar * 20 + result.totalFiveStar * 200 + totalSix * 2000;
    })),
    arsenal10pull: sortFiniteNums(results.map((result) => {
      const totalSix = result.totalSixStarRateUp + result.totalSixStarLimited + result.totalSixStarStandard;
      return (result.totalFourStar * 20 + result.totalFiveStar * 200 + totalSix * 2000) / 1980;
    })),
    arsenal10pullPerBanner: sortFiniteNums(results.map((result) => {
      const totalSix = result.totalSixStarRateUp + result.totalSixStarLimited + result.totalSixStarStandard;
      const arsenalTotal = result.totalFourStar * 20 + result.totalFiveStar * 200 + totalSix * 2000;
      return result.bannersVisited > 0 ? arsenalTotal / 1980 / result.bannersVisited : 0;
    })),
    bondQuota: sortFiniteNums(results.map((result) => result.totalFiveStar * 10)),
    hhTicket: sortFiniteNums(results.map((result) => result.totalFiveStar * 10 / 25)),
    hhTicketPerBanner: sortFiniteNums(results.map((result) => (
      result.bannersVisited > 0 ? (result.totalFiveStar * 10 / 25) / result.bannersVisited : 0
    ))),
    aicQuota4: sortFiniteNums(results.map((result) => result.totalFourStar * 5)),
    aicQuota5: sortFiniteNums(results.map((result) => result.totalFiveStar * 20)),
    aicQuotaTotal: sortFiniteNums(results.map((result) => result.totalFourStar * 5 + result.totalFiveStar * 20)),
    bannerHHTicket: sortFiniteNums(results.map((result) => (result.totalFourStar * 5 + result.totalFiveStar * 20) / 70)),
    bannerHHTicketPerBanner: sortFiniteNums(results.map((result) => (
      result.bannersVisited > 0 ? ((result.totalFourStar * 5 + result.totalFiveStar * 20) / 70) / result.bannersVisited : 0
    ))),
  };

  let sumBannersSkipped = 0;
  for (const result of results) sumBannersSkipped += result.bannersSkipped;

  let html = '';

  const bannerLength = parseIntegerOrFallback(document.getElementById('banner-length').value, 17);
  const welfarePulls = parseIntegerOrFallback(document.getElementById('welfare-pulls').value, 40);
  const currency = getSelectedCurrency();
  const fmtMoney = (value) => {
    if (Number.isInteger(value) || value >= 100) return `${currency.symbol}${Math.round(value)}`;
    return `${currency.symbol}${value.toFixed(2)}`;
  };
  const formatFixed = (digits = 2) => (value) => value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  const formatInteger = (value) => Math.round(value).toLocaleString();

  const monthlyCardPulls = bannerLength * 200 / ORBS_PER_PULL;
  const monthlyCardProrated = currency.monthlyCard * bannerLength / 30;
  const bundlePulls = 10;
  const hardSpendOrbs = currency.hardSpendCurrency === 'origeometry'
    ? currency.hardSpendQty * ORIGEOMETRY_TO_OROBERYL
    : currency.hardSpendQty;
  const hardSpendPulls = hardSpendOrbs / ORBS_PER_PULL;
  const costPerPull = currency.hardSpendCost / hardSpendPulls;
  const bundleCostProrated = monthlyCardProrated + currency.bundle;

  const titleOf = (sectionTitle, label) => `${sectionTitle} - ${label}`;
  const keyStatsTitle = tr('result.keyStatistics', 'Key Statistics');
  const paidTitle = tr('result.paidPulls', 'Paid Pulls');
  const bonusTitle = tr('result.bonusPulls', 'Bonus Pulls');
  const totalTitle = tr('result.totalPulls', 'Total Pulls');
  const charactersTitle = tr('result.characters', 'Characters');
  const pullsPerSixTitle = tr('result.pullsPerSix', 'Pulls per 6★');
  const arsenalTitle = tr('result.arsenalTickets', 'Arsenal Tickets');
  const quotaTitle = tr('result.quotaExchange', 'Quota Exchange');
  const moneyTitle = tr('result.money', 'Money, Money, Money');
  const metricMap = new Map();
  const addMetric = (key, title, values, formatValue) => {
    metricMap.set(key, createDistributionMetric(title, () => values, formatValue));
    return key;
  };
  const addSortedMetric = (key, sectionTitle, label, values, formatValue) => (
    addMetric(key, titleOf(sectionTitle, trResultLabel(label)), values, formatValue)
  );
  const pctlRow = (label, pctlKey, colorClass = '', tipText = '', popupKey = '') => {
    const tooltip = tipText || tr(`detailTipLabel.${label}`, TOOLTIPS[label]);
    const tipAttr = tooltip ? ` data-tip="${escapeHtml(tooltip)}"` : '';
    const popupAttr = popupKey ? ` data-dist-key="${popupKey}" tabindex="0" role="button" aria-haspopup="dialog"` : '';
    const clickableClass = popupKey ? ' stat-value-clickable' : '';
    return `<div class="stat-row"${tipAttr}><span class="stat-label${tooltip ? ' has-tip' : ''}">${trResultLabel(label)}${tooltip ? ' <span class="tip-icon">?</span>' : ''}</span><span class="stat-value${colorClass ? ' ' + colorClass : ''}${clickableClass}" data-pctl="${pctlKey}"${popupAttr}>—</span></div>`;
  };

  html += `<h3>${tr('result.parameters', 'Parameters')}</h3>`;
  html += `<div class="stat-grid">`;
  html += statRow('Trials', config.numTrials.toLocaleString());
  html += statRow('Max Banners', config.maxBanners.toLocaleString());
  if (config.startWithCharteredHH) html += statRow('Start with Chartered HH', tr('result.yes', 'Yes'), 'blue', false, tip('charHHStart'));
  const shownSeed = config.baseSeed ?? config.seed;
  if (shownSeed != null) html += statRow('Seed', shownSeed.toString(), '', false, tip('fixedSeed'));
  if (config.startFiveStarPity > 0) html += statRow('Starting 5★ Pity', config.startFiveStarPity.toString(), '', false, tip('startPity5'));
  if (config.startSixStarPity > 0) html += statRow('Starting 6★ Pity', config.startSixStarPity.toString(), '', false, tip('startPity6'));
  html += statRow('Banner Length', `${bannerLength} ${tr('result.days', 'days')}`);
  html += statRow('Welfare Pulls', `${welfarePulls} ${tr('result.perBanner', '/banner')}`, '', false, tip('welfareAssumed'));
  html += statRow('Free Pulls', `${config.welfareFree} ${tr('result.perBanner', '/banner')}`, '', false, tip('freePullsAssumed'));
  html += `</div>`;

  const avgBannersSkipped = sumBannersSkipped / n;
  html += `<h3 class="has-tip" data-tip="${escapeHtml(tip('bannersHeading'))}">${tr('result.banners', 'Banners')} <span class="tip-icon">?</span></h3>`;
  html += `<div class="stat-grid">`;
  html += pctlRow(
    'Banners Skipped',
    'bannersSkipped',
    '',
    tip('bannersSkipped', { trials: n }),
    addSortedMetric('banners-skipped', tr('result.banners', 'Banners'), 'Banners Skipped', sorted.bannersSkipped, (value) => value.toFixed(1))
  );
  html += `</div>`;

  html += `<h3>${keyStatsTitle}</h3>`;
  html += `<div class="paid-pulls-hero">`;
  html += `<div class="hero-stat has-tip" data-tip="${escapeHtml(tip('heroPityPerTarget'))}"><div class="hero-num" data-pctl="heroPityPerTarget">—</div><div class="hero-label">${trResultLabel('Pity Pulls/Banner')} <span class="tip-icon">?</span></div></div>`;
  html += `<div class="hero-stat has-tip" data-tip="${escapeHtml(tip('paidPerTarget', { skipped: avgBannersSkipped.toFixed(1) }))}"><div class="hero-num" data-pctl="paidPerTarget">—</div><div class="hero-label">${trResultLabel('Paid Pulls/Banner')} <span class="tip-icon">?</span></div></div>`;
  html += `<div class="hero-stat has-tip" data-tip="${escapeHtml(tip('paidPerRateUp'))}"><div class="hero-num" data-pctl="paidPerRateUp">—</div><div class="hero-label">${trResultLabel('Paid Pulls/Rate-Up')} <span class="tip-icon">?</span></div></div>`;
  html += `</div>`;

  html += `<h3 class="has-tip" data-tip="${escapeHtml(tip('paidHeading'))}">${paidTitle} <span class="tip-icon">?</span></h3>`;
  html += renderDistribution(sorted.paid, n);
  html += `<div class="stat-grid">`;
  html += pctlRow('Paid Pulls', 'paidPulls', '', tip('paidSelected'), addSortedMetric('paid-pulls', paidTitle, 'Paid Pulls', sorted.paid, (value) => value.toFixed(1)));
  html += pctlRow('Pulls/Banner (all)', 'paidPerBannerAll', '', tip('paidPerAll', { banners: config.maxBanners }), addSortedMetric('paid-per-banner-all', paidTitle, 'Pulls/Banner (all)', sorted.paidPerBannerAll, (value) => value.toFixed(2)));
  html += pctlRow('Pulls/Banner (target)', 'paidPerBannerTarget', '', tip('paidPerTarget', { skipped: avgBannersSkipped.toFixed(1) }), addSortedMetric('paid-per-banner-target', paidTitle, 'Pulls/Banner (target)', sorted.paidPerBannerTarget, (value) => value.toFixed(2)));
  html += `</div>`;

  html += `<h3>${bonusTitle}</h3>`;
  html += `<div class="stat-grid">`;
  html += pctlRow('Banner Specific', 'welfare', '', tip('bonusBannerSpecific'), addSortedMetric('bonus-banner-specific', bonusTitle, 'Banner Specific', sorted.welfare, (value) => value.toFixed(1)));
  html += pctlRow('30-pull bonus', 'bonus30', '', tip('bonus30'), addSortedMetric('bonus-30-pull', bonusTitle, '30-pull bonus', sorted.bonus30, (value) => value.toFixed(1)));
  html += pctlRow('60-pull bonus', 'bonus60', '', tip('bonus60'), addSortedMetric('bonus-60-pull', bonusTitle, '60-pull bonus', sorted.bonus60, (value) => value.toFixed(1)));
  html += `</div>`;

  html += `<h3>${totalTitle}</h3>`;
  html += `<div class="stat-grid">`;
  html += pctlRow('Total', 'totalPulls', '', tip('totalMean', { banners: config.maxBanners }), addSortedMetric('total-pulls', totalTitle, 'Total', sorted.total, (value) => value.toFixed(1)));
  html += pctlRow('Pity Pulls/Banner (target)', 'pityPerTarget', '', tip('pityPerTarget'), addSortedMetric('total-pity-target', totalTitle, 'Pity Pulls/Banner (target)', sorted.pityPerTarget, (value) => value.toFixed(1)));
  html += pctlRow('Total Pulls/Banner (all)', 'totalPerBannerAll', '', tip('totalPerBanner'), addSortedMetric('total-per-banner-all', totalTitle, 'Total Pulls/Banner (all)', sorted.totalPerBannerAll, (value) => value.toFixed(1)));
  html += pctlRow('Total Pulls/Banner (target)', 'totalPerBannerTarget', '', tip('totalPerBannerTarget'), addSortedMetric('total-per-banner-target', totalTitle, 'Total Pulls/Banner (target)', sorted.totalPerBannerTarget, (value) => value.toFixed(1)));
  html += `</div>`;

  html += `<h3>${charactersTitle}</h3>`;
  html += `<div class="stat-grid">`;
  html += pctlRow('4★', 'fourStar', '', tip('fourTotal', { banners: config.maxBanners }), addSortedMetric('characters-four', charactersTitle, '4★', sorted.fourStar, (value) => value.toFixed(2)));
  html += pctlRow('4★ /banner', 'fourStarPerBanner', '', tip('fourPerBanner'), addSortedMetric('characters-four-banner', charactersTitle, '4★ /banner', sorted.fourStarPerBanner, (value) => value.toFixed(2)));
  html += pctlRow('5★', 'fiveStar', 'blue', tip('fiveTotal', { banners: config.maxBanners }), addSortedMetric('characters-five', charactersTitle, '5★', sorted.fiveStar, (value) => value.toFixed(2)));
  html += pctlRow('5★ /banner', 'fiveStarPerBanner', 'blue', tip('fivePerBanner'), addSortedMetric('characters-five-banner', charactersTitle, '5★ /banner', sorted.fiveStarPerBanner, (value) => value.toFixed(2)));
  html += pctlRow('6★ standard', 'standard', 'purple', tip('sixStandard'), addSortedMetric('characters-six-standard', charactersTitle, '6★ standard', sorted.standard, (value) => value.toFixed(2)));
  html += pctlRow('6★ standard/banner', 'standardPerBanner', 'purple', tip('sixStandardPerBanner'), addSortedMetric('characters-six-standard-banner', charactersTitle, '6★ standard/banner', sorted.standardPerBanner, (value) => value.toFixed(2)));
  html += pctlRow('6★ rate-up', 'rateUp', 'gold', tip('sixRateUp', { banners: config.maxBanners }), addSortedMetric('characters-six-rateup', charactersTitle, '6★ rate-up', sorted.rateUp, (value) => value.toFixed(2)));
  html += pctlRow('6★ rate-up/banner', 'rateUpPerBanner', 'gold', tip('sixRateUpPerBanner'), addSortedMetric('characters-six-rateup-banner', charactersTitle, '6★ rate-up/banner', sorted.rateUpPerBanner, (value) => value.toFixed(2)));
  html += pctlRow('6★ limited', 'limited', 'orange', tip('sixLimited'), addSortedMetric('characters-six-limited', charactersTitle, '6★ limited', sorted.limited, (value) => value.toFixed(2)));
  html += pctlRow('6★ limited/banner', 'limitedPerBanner', 'orange', tip('sixLimitedPerBanner'), addSortedMetric('characters-six-limited-banner', charactersTitle, '6★ limited/banner', sorted.limitedPerBanner, (value) => value.toFixed(2)));
  html += pctlRow('6★ total', 'sixTotal', 'gold', tip('sixTotal', { banners: config.maxBanners }), addSortedMetric('characters-six-total', charactersTitle, '6★ total', sorted.sixTotal, (value) => value.toFixed(2)));
  html += pctlRow('6★ total/banner', 'sixTotalPerBanner', 'gold', tip('sixTotalPerBanner'), addSortedMetric('characters-six-total-banner', charactersTitle, '6★ total/banner', sorted.sixTotalPerBanner, (value) => value.toFixed(2)));
  html += `</div>`;

  html += `<h3>${pullsPerSixTitle}</h3>`;
  html += `<div class="stat-grid">`;
  html += pctlRow('Paid / rate-up', 'paidPerRateUp6', 'gold', tip('paidPerRateUp'), addSortedMetric('pulls-per-rateup', pullsPerSixTitle, 'Paid / rate-up', sorted.paidPerRateUp, (value) => value.toFixed(2)));
  html += pctlRow('Paid / any 6★', 'paidPerAnySix', '', tip('paidPerAnySix'), addSortedMetric('pulls-per-any-six', pullsPerSixTitle, 'Paid / any 6★', sorted.paidPerAnySix, (value) => value.toFixed(2)));
  html += `</div>`;

  html += `<h3>${arsenalTitle}</h3>`;
  html += `<div class="stat-grid">`;
  html += pctlRow('From 4★', 'arsenal4', '', tip('arsenalFrom4'), addSortedMetric('arsenal-from4', arsenalTitle, 'From 4★', sorted.arsenal4, (value) => Math.round(value).toLocaleString())) + '<div></div>';
  html += pctlRow('From 5★', 'arsenal5', '', tip('arsenalFrom5'), addSortedMetric('arsenal-from5', arsenalTitle, 'From 5★', sorted.arsenal5, (value) => Math.round(value).toLocaleString())) + '<div></div>';
  html += pctlRow('From 6★', 'arsenal6', '', tip('arsenalFrom6'), addSortedMetric('arsenal-from6', arsenalTitle, 'From 6★', sorted.arsenal6, (value) => Math.round(value).toLocaleString())) + '<div></div>';
  html += pctlRow('Total', 'arsenalTotal', 'green', tip('arsenalTotal', { banners: config.maxBanners }), addSortedMetric('arsenal-total', arsenalTitle, 'Total', sorted.arsenalTotal, (value) => Math.round(value).toLocaleString()));
  html += pctlRow('→ Arsenal 10-pull', 'arsenal10pull', 'green', tip('arsenalTenPull'), addSortedMetric('arsenal-tenpull', arsenalTitle, '→ Arsenal 10-pull', sorted.arsenal10pull, (value) => value.toFixed(2)));
  html += `<div></div>`;
  html += pctlRow('→ Arsenal 10-pull/banner', 'arsenal10pullPerBanner', 'green', tip('arsenalTenPullPerBanner'), addSortedMetric('arsenal-tenpull-banner', arsenalTitle, '→ Arsenal 10-pull/banner', sorted.arsenal10pullPerBanner, (value) => value.toFixed(2)));
  html += `</div>`;

  html += `<h3>${quotaTitle}</h3>`;
  html += `<div class="stat-grid">`;
  html += pctlRow('Bond Quota', 'bondQuota', '', tip('bondQuota'), addSortedMetric('quota-bond', quotaTitle, 'Bond Quota', sorted.bondQuota, (value) => Math.round(value).toLocaleString()));
  html += pctlRow('→ HH Ticket', 'hhTicket', '', undefined, addSortedMetric('quota-hh-ticket', quotaTitle, '→ HH Ticket', sorted.hhTicket, (value) => value.toFixed(1)));
  html += `<div></div>`;
  html += pctlRow('→ HH Ticket/banner', 'hhTicketPerBanner', '', undefined, addSortedMetric('quota-hh-ticket-banner', quotaTitle, '→ HH Ticket/banner', sorted.hhTicketPerBanner, (value) => value.toFixed(2)));
  html += `<div></div><div></div>`;
  html += pctlRow('AIC Quota from 4★', 'aicQuota4', '', tip('aicFrom4'), addSortedMetric('quota-aic4', quotaTitle, 'AIC Quota from 4★', sorted.aicQuota4, (value) => Math.round(value).toLocaleString()));
  html += `<div></div>`;
  html += pctlRow('AIC Quota from 5★', 'aicQuota5', '', tip('aicFrom5'), addSortedMetric('quota-aic5', quotaTitle, 'AIC Quota from 5★', sorted.aicQuota5, (value) => Math.round(value).toLocaleString()));
  html += `<div></div>`;
  html += pctlRow('AIC Quota', 'aicQuotaTotal', 'blue', tip('aicTotal', { banners: config.maxBanners }), addSortedMetric('quota-aic-total', quotaTitle, 'AIC Quota', sorted.aicQuotaTotal, (value) => Math.round(value).toLocaleString()));
  html += pctlRow('→ Banner HH Ticket', 'bannerHHTicket', 'blue', tip('bannerHHTicket'), addSortedMetric('quota-banner-hh', quotaTitle, '→ Banner HH Ticket', sorted.bannerHHTicket, (value) => value.toFixed(1)));
  html += `<div></div>`;
  html += pctlRow('→ Banner HH Ticket/banner', 'bannerHHTicketPerBanner', 'blue', tip('bannerHHTicketPerBanner'), addSortedMetric('quota-banner-hh-banner', quotaTitle, '→ Banner HH Ticket/banner', sorted.bannerHHTicketPerBanner, (value) => value.toFixed(2)));
  html += `</div>`;

  html += `<h3>${moneyTitle}</h3>`;
  const mcCostPerPull = monthlyCardProrated / monthlyCardPulls;
  const pullsWord = tr('result.pullsWord', 'pulls');
  const perPull = tr('result.perPull', '/pull');
  const dayUnit = tr('result.days', 'days') === '天' ? '天' : 'd';
  const pullsAtPerPull = (pulls, cost) => tr('result.pullsAtPerPull', '{pulls} pulls @ {cost}/pull')
    .replace('{pulls}', pulls)
    .replace('{cost}', cost);
  html += packRow('Monthly Card',
    [`${fmtMoney(currency.monthlyCard)}/30${dayUnit}`, `${fmtMoney(monthlyCardProrated)}/${bannerLength}${dayUnit}`, pullsAtPerPull(monthlyCardPulls.toFixed(1), fmtMoney(mcCostPerPull))],
    tip('monthlyCardPack', {
      cost30: fmtMoney(currency.monthlyCard),
      days: bannerLength,
      costDays: fmtMoney(monthlyCardProrated),
      pulls: monthlyCardPulls.toFixed(1),
    }));
  const bundleCostPerPull = currency.bundle / bundlePulls;
  html += packRow('HH Bundle',
    [`${fmtMoney(currency.bundle)}${tr('result.perBanner', '/banner')}`, pullsAtPerPull(bundlePulls, fmtMoney(bundleCostPerPull))],
    tip('hhBundlePack', { cost: fmtMoney(currency.bundle) }));
  const hardSpendCurrencyLabel = tr(`ui.${currency.hardSpendCurrency}`, currency.hardSpendCurrency);
  const hardSpendLabel = `${tr('ui.hardSpend', 'Hard Spend')} (${currency.hardSpendQty} ${hardSpendCurrencyLabel})`;
  html += packRow(hardSpendLabel,
    [`${fmtMoney(currency.hardSpendCost)}`, `${hardSpendPulls.toFixed(1)} ${pullsWord}`, `${fmtMoney(costPerPull)}${perPull}`],
    tip('hardSpendPack', {
      cost: fmtMoney(currency.hardSpendCost),
      qty: currency.hardSpendQty,
      currency: hardSpendCurrencyLabel,
      oroberyl: hardSpendOrbs,
      orbsPerPull: ORBS_PER_PULL,
    }));
  html += `<div class="stat-grid">`;
  html += `<div class="stat-row" data-tip="${escapeHtml(tip('shortfall', { welfare: welfarePulls }))}"><span class="stat-label has-tip">${trResultLabel('Shortfall/banner')} <span class="tip-icon">?</span></span><span class="stat-value" data-pctl="shortfall">—</span></div>`;
  html += `<div></div>`;
  const costLabel = tr('result.costPerDays', 'Cost/{days} days').replace('{days}', bannerLength);
  html += `<div class="stat-row" data-tip="${escapeHtml(tip('withMc'))}"><span class="stat-label has-tip">${trResultLabel('w/ MC')} <span class="tip-icon">?</span></span><span class="stat-value" data-pctl="withMC">—</span></div>`;
  html += statRow(costLabel, fmtMoney(monthlyCardProrated), '', false, tip('costPerPeriod'));
  html += `<div class="stat-row" data-tip="${escapeHtml(tip('withMcBundle'))}"><span class="stat-label has-tip">${trResultLabel('w/ MC, Bundle')} <span class="tip-icon">?</span></span><span class="stat-value" data-pctl="withMCBundle">—</span></div>`;
  html += statRow(costLabel, fmtMoney(bundleCostProrated), '', false, tip('costPerPeriod'));
  html += statRow('w/ MC, Bundle, Hard Spend', '---', 'green');
  html += `<div class="stat-row" data-tip="${escapeHtml(tip('costPerPeriod'))}"><span class="stat-label has-tip">${costLabel} <span class="tip-icon">?</span></span><span class="stat-value" data-pctl="hardSpendCost">—</span></div>`;
  html += `</div>`;

  html += `<h3>${tr('result.pullDistribution', 'Pull Distribution')}</h3>`;
  html += renderPullDistSection(terminationCounts, rateUpCounts);
  html += renderBannerInspector(sampleBannerLogs);

  _metricDistributionStore.set(win, metricMap);
  resultsContent.innerHTML = html;
  initBannerTabs(win);
  initPullDistTabs(win);
  initPercentileSlider(win, sorted, {
    welfarePulls,
    monthlyCardPulls,
    bundlePulls,
    bundleCostProrated,
    costPerPull,
    fmtMoney,
  });
}

function packRow(label, items, tipText) {
  const tipAttr = tipText ? ` data-tip="${escapeHtml(tipText)}"` : '';
  const tipClass = tipText ? ' has-tip' : '';
  const pills = items.map(t => `<span class="pack-pill">${t}</span>`).join('<span class="pack-arrow">→</span>');
  return `<div class="pack-row"${tipAttr}>
    <span class="stat-label${tipClass}">${trResultLabel(label)}${tipText ? ' <span class="tip-icon">?</span>' : ''}</span>
    <span class="pack-pills">${pills}</span>
  </div>`;
}

function statRow(label, value, colorClass, span, tipOverride, popupKey) {
  const tooltip = tipOverride || tr(`detailTipLabel.${label}`, TOOLTIPS[label]);
  const tipAttr = tooltip ? ` data-tip="${escapeHtml(tooltip)}"` : '';
  const tipClass = tooltip ? ' has-tip' : '';
  const popupAttr = popupKey ? ` data-dist-key="${popupKey}" tabindex="0" role="button" aria-haspopup="dialog"` : '';
  const valueClass = popupKey ? ' stat-value-clickable' : '';
  return `<div class="stat-row${span ? ' span-2' : ''}"${tipAttr}>
    <span class="stat-label${tipClass}">${trResultLabel(label)}${tooltip ? ' <span class="tip-icon">?</span>' : ''}</span>
    <span class="stat-value${colorClass ? ' ' + colorClass : ''}${valueClass}"${popupAttr}>${value}</span>
  </div>`;
}

// --- Tooltip manager ---
let tooltipEl = null;

function ensureTooltip() {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'tooltip';
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function showTooltip(target) {
  const icon = target?.closest?.('.tip-icon');
  if (!icon) return;
  const tip = icon.closest('[data-tip]');
  if (!tip) return;
  const el = ensureTooltip();
  el.textContent = tip.dataset.tip;
  el.classList.add('visible');

  const rect = icon.getBoundingClientRect();
  el.style.left = rect.left + 'px';
  el.style.top = '0px';
  // Measure, then position above the row
  const tipRect = el.getBoundingClientRect();
  let top = rect.top - tipRect.height - 6;
  if (top < 4) top = rect.bottom + 6; // flip below if no room
  el.style.top = top + 'px';
  // Clamp horizontal
  const maxLeft = window.innerWidth - tipRect.width - 8;
  el.style.left = Math.max(4, Math.min(rect.left, maxLeft)) + 'px';
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.classList.remove('visible');
}

function populateSpendingInputs(currencyKey) {
  const cur = CURRENCIES[currencyKey] || CURRENCIES.RMB;
  document.getElementById('spending-monthly-card').value = cur.defaults.monthlyCard;
  document.getElementById('spending-bundle').value = cur.defaults.bundle;
  document.getElementById('spending-hard-cost').value = cur.defaults.hardSpendCost;
  document.getElementById('spending-hard-qty').value = cur.defaults.hardSpendQty;
  document.getElementById('spending-hard-currency').value = cur.defaults.hardSpendCurrency;
}

function resetToDefaults() {
  _suppressHashUpdate = true;
  document.getElementById('trials-input').value = 5000;
  document.getElementById('banners-input').value = 100;
  document.getElementById('banner-length').value = 17;
  document.getElementById('welfare-pulls').value = 40;
  document.getElementById('welfare-free-pulls').value = 10;
  document.getElementById('start-chartered-hh').checked = false;
  document.getElementById('start-5star-pity').value = 0;
  document.getElementById('start-6star-pity').value = 0;
  document.getElementById('seed-input').value = '';
  document.getElementById('currency-select').value = 'RMB';
  populateSpendingInputs('RMB');
  document.querySelectorAll('.sim-window').forEach((w) => w.remove());
  windowCounter = 0;
  _suppressHashUpdate = false;
  createSimWindow();
}

function copyShareLink() {
  updateHash();
  const btn = document.getElementById('share-btn');
  navigator.clipboard.writeText(window.location.href).then(() => {
    btn.textContent = t('ui.copied');
    setTimeout(() => { setShareButtonDefault(); }, 2000);
  }, () => {
    const input = document.createElement('input');
    input.value = window.location.href;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    btn.textContent = t('ui.copied');
    setTimeout(() => { setShareButtonDefault(); }, 2000);
  });
}

export function initPlanner() {
  if (_isInitialized) return;
  _isInitialized = true;

  const currencySelect = document.getElementById('currency-select');
  const addWindowBtn = document.getElementById('add-window');
  const resetBtn = document.getElementById('reset-btn');
  const shareBtn = document.getElementById('share-btn');
  const header = document.querySelector('header');
  const windowsContainer = document.getElementById('windows-container');
  const helpModal = document.getElementById('help-modal');
  const distributionModal = ensureDistributionModal();
  const helpBtn = document.getElementById('help-btn');
  const helpCloseBtn = helpModal.querySelector('.modal-close');
  const languageSelect = document.getElementById('language-select');

  const toggleModal = (modal, visible) => {
    modal.classList.toggle('hidden', !visible);
  };

  const lang = initLanguage();
  if (languageSelect) languageSelect.value = lang;
  setShareButtonDefault();

  _suppressHashUpdate = true;
  const restored = deserializeState(location.hash);
  if (!restored) {
    populateSpendingInputs(currencySelect.value);
    createSimWindow();
  }
  _suppressHashUpdate = false;
  updateHash();

  currencySelect.addEventListener('change', () => {
    populateSpendingInputs(currencySelect.value);
  });
  if (languageSelect) {
    languageSelect.addEventListener('change', () => {
      setLanguage(languageSelect.value);
      setShareButtonDefault();
      document.querySelectorAll('.sim-window').forEach((win) => {
        const runButton = win.querySelector('.run-btn');
        if (runButton && !runButton.disabled) runButton.textContent = t('ui.runSimulation');
        const placeholder = win.querySelector('.results-placeholder');
        if (placeholder) placeholder.textContent = t('ui.runPlaceholder');
        const strategy = win.querySelector('.strategy-select');
        const desc = win.querySelector('.strategy-description');
        const editor = win.querySelector('.strategy-editor');
        if (strategy && desc) {
          const localized = t(`strategyDesc.${strategy.value}`);
          desc.textContent = localized.startsWith('strategyDesc.') ? getStrategyDescription(strategy.value) : localized;
        }
        if (strategy && editor && strategy.value !== 'custom' && isDefaultBuiltInStrategyCode(strategy.value, editor)) {
          applyBuiltInStrategyCode(editor, strategy.value);
        }
      });
    });
  }
  addWindowBtn.addEventListener('click', () => createSimWindow());

  header.addEventListener('input', scheduleHashUpdate);
  header.addEventListener('change', scheduleHashUpdate);
  windowsContainer.addEventListener('input', scheduleHashUpdate);
  windowsContainer.addEventListener('change', scheduleHashUpdate);
  resetBtn.addEventListener('click', resetToDefaults);
  shareBtn.addEventListener('click', copyShareLink);
  helpBtn.addEventListener('click', () => {
    toggleModal(helpModal, true);
  });
  helpCloseBtn.addEventListener('click', () => {
    toggleModal(helpModal, false);
  });
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) toggleModal(helpModal, false);
  });
  document.querySelectorAll('.help-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.helpTab;
      document.querySelectorAll('.help-tab').forEach((item) => {
        item.classList.toggle('active', item === tab);
      });
      document.querySelectorAll('.help-tab-panel').forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.helpPanel !== target);
      });
    });
  });

  _mouseenterHandler = (e) => {
    if (e.target?.closest?.('.tip-icon')) showTooltip(e.target);
  };
  _mouseleaveHandler = (e) => {
    if (e.target?.closest?.('.tip-icon')) hideTooltip();
  };
  _keydownHandler = (e) => {
    if (e.key !== 'Escape') return;
    if (!helpModal.classList.contains('hidden')) toggleModal(helpModal, false);
    if (!distributionModal.classList.contains('hidden')) distributionModal.classList.add('hidden');
  };

  document.addEventListener('mouseenter', _mouseenterHandler, true);
  document.addEventListener('mouseleave', _mouseleaveHandler, true);
  document.addEventListener('keydown', _keydownHandler);
}

export function destroyPlanner() {
  if (!_isInitialized) return;
  _isInitialized = false;
  if (_mouseenterHandler) document.removeEventListener('mouseenter', _mouseenterHandler, true);
  if (_mouseleaveHandler) document.removeEventListener('mouseleave', _mouseleaveHandler, true);
  if (_keydownHandler) document.removeEventListener('keydown', _keydownHandler);
  _mouseenterHandler = null;
  _mouseleaveHandler = null;
  _keydownHandler = null;
  if (tooltipEl) tooltipEl.remove();
  tooltipEl = null;
  if (_distributionModalEl) _distributionModalEl.remove();
  _distributionModalEl = null;
}
