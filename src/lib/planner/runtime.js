import html2canvas from 'html2canvas';
import { applyStaticTranslations, initLanguage, setLanguage, t } from '../i18n.js';
import {
  ORBS_PER_PULL,
  ORIGEOMETRY_TO_OROBERYL,
  CURRENCIES,
  STRATEGY_SOURCE,
  STRATEGY_HEADER,
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
    monthlyCard: parseFloat(document.getElementById('spending-monthly-card').value) || cur.defaults.monthlyCard,
    bundle: parseFloat(document.getElementById('spending-bundle').value) || cur.defaults.bundle,
    hardSpendCost: parseFloat(document.getElementById('spending-hard-cost').value) || cur.defaults.hardSpendCost,
    hardSpendQty: parseFloat(document.getElementById('spending-hard-qty').value) || cur.defaults.hardSpendQty,
    hardSpendCurrency: document.getElementById('spending-hard-currency').value || cur.defaults.hardSpendCurrency,
  };
}

function getStrategyCode(name) {
  if (name === 'custom') return null;
  return STRATEGY_HEADER + (STRATEGY_SOURCE[name] || '');
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

function getStrategyDescription(name) {
  const src = STRATEGY_SOURCE[name];
  if (!src) return '';
  const match = src.match(/^\/\/ Description:\s*(.+)$/m);
  return match ? match[1].trim() : '';
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
      textarea.value = getStrategyCode(opts.strategy) || '';
    }
  } else {
    textarea.value = getStrategyCode(stratSelect.value);
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
      textarea.value = getStrategyCode(name);
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

  const config = {
    numTrials: Math.min(100000, Math.max(100, parseInt(trialsInput.value) || 5000)),
    maxBanners: Math.min(10000, Math.max(1, parseInt(bannersInput.value) || 100)),
    welfareFree: Math.min(120, Math.max(0, parseInt(document.getElementById('welfare-free-pulls').value) || 5)),
    startWithCharteredHH: document.getElementById('start-chartered-hh').checked,
    seed: document.getElementById('seed-input').value.trim() !== '' ? parseInt(document.getElementById('seed-input').value) : null,
    startFiveStarPity: Math.min(9, Math.max(0, parseInt(document.getElementById('start-5star-pity').value) || 0)),
    startSixStarPity: Math.min(79, Math.max(0, parseInt(document.getElementById('start-6star-pity').value) || 0)),
  };

  // Always send the editor code â€” for built-ins it's the source, for custom it's the user code
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
  const idx = Math.round(p / 100 * (sorted.length - 1));
  return sorted[idx];
}

function mean(arr) {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
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

function renderDistribution(sorted, n) {
  const buckets = 30;
  const minVal = sorted[0];
  const maxVal = sorted[sorted.length - 1];
  if (minVal === maxVal) {
    return `<div class="dist-single">${minVal} ${tr('result.allTrialsIdentical', '')}</div>`;
  }

  const range = maxVal - minVal;
  const bucketSize = range / buckets;
  const counts = new Array(buckets).fill(0);
  for (const v of sorted) {
    let b = Math.floor((v - minVal) / bucketSize);
    if (b >= buckets) b = buckets - 1;
    counts[b]++;
  }
  const maxCount = Math.max(...counts);

  // Percentiles to mark
  const pMarkers = [
    { p: 5, label: 'P5', color: '#4caf50' },
    { p: 25, label: 'P25', color: '#8aa4ff' },
    { p: 50, label: 'P50', color: '#fff' },
    { p: 75, label: 'P75', color: '#8aa4ff' },
    { p: 95, label: 'P95', color: '#ff9800' },
  ];
  const pVals = pMarkers.map(m => ({ ...m, val: percentile(sorted, m.p) }));

  // SVG dimensions
  const W = 380, H = 120;
  const padL = 2, padR = 2, padT = 20, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = chartW / buckets;

  let svg = `<svg class="dist-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;

  // Bars
  for (let i = 0; i < buckets; i++) {
    const barH = maxCount > 0 ? (counts[i] / maxCount) * chartH : 0;
    const x = padL + i * barW;
    const y = padT + chartH - barH;
    // Color gradient from dim to bright based on height
    const intensity = maxCount > 0 ? counts[i] / maxCount : 0;
    const r = Math.round(108 + intensity * 30);
    const g = Math.round(140 + intensity * 24);
    const b = Math.round(255);
    svg += `<rect x="${x}" y="${y}" width="${Math.max(barW - 1, 1)}" height="${barH}" rx="1" fill="rgb(${r},${g},${b})" fill-opacity="${0.35 + intensity * 0.65}"/>`;
  }

  // Percentile markers
  for (const pm of pVals) {
    const xPos = padL + ((pm.val - minVal) / range) * chartW;
    // Tick line
    svg += `<line x1="${xPos}" y1="${padT}" x2="${xPos}" y2="${padT + chartH + 4}" stroke="${pm.color}" stroke-width="1" stroke-opacity="0.7" stroke-dasharray="${pm.p === 50 ? 'none' : '2,2'}"/>`;
    // Label below
    svg += `<text x="${xPos}" y="${padT + chartH + 16}" text-anchor="middle" fill="${pm.color}" font-size="9" font-family="inherit" opacity="0.9">${pm.label}</text>`;
    svg += `<text x="${xPos}" y="${padT + chartH + 27}" text-anchor="middle" fill="${pm.color}" font-size="9" font-family="inherit" font-weight="600">${pm.val}</text>`;
  }

  // Min/max labels at top corners
  svg += `<text x="${padL}" y="${padT - 6}" fill="#8b8fa3" font-size="9" font-family="inherit">${minVal}</text>`;
  svg += `<text x="${W - padR}" y="${padT - 6}" text-anchor="end" fill="#8b8fa3" font-size="9" font-family="inherit">${maxVal}</text>`;

  svg += `</svg>`;
  return `<div class="dist-chart">${svg}</div>`;
}

function formatSixStarRate(rate) {
  if (rate >= 1.0) return '100%';
  if (rate === 0) return 'â€”';
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
  html += `<label class="advanced-toggle" data-tip="${escapeHtml(tip('advancedInspector'))}"><input type="checkbox" class="advanced-toggle-input"> ${tr('result.advanced', 'Advanced')}</label>`;
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
        html += `<span class="pull-pity dim">â€”</span>`;
        html += `<span class="pull-pity dim">â€”</span>`;
      }
      html += `<span class="pull-rate adv-stat ${sixStarRateClass(p.sixStarRate)}">${formatSixStarRate(p.sixStarRate)}</span>`;
      if (p.mainRoll >= 0) html += `<span class="pull-roll adv-stat">${p.mainRoll.toFixed(3)}</span>`;
      else html += `<span class="pull-roll adv-stat dim">â€”</span>`;
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
  html += `<button class="pull-dist-tab active" data-tab="rateup-${id}" data-tip="${escapeHtml(tip('pullDistRateUp'))}">${tr('result.rateUpSix', 'Rate-Up 6★')}</button>`;
  html += `<button class="pull-dist-tab" data-tab="term-${id}" data-tip="${escapeHtml(tip('pullDistTermination'))}">${tr('result.termination', 'Termination')}</button>`;
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
  const paidPulls = results.map(r => r.pullCount).sort((a, b) => a - b);
  const totalPulls = results.map(r =>
    r.pullCount + r.bonus30PullCount + r.bonus60PullCount + r.welfarePullCount
  ).sort((a, b) => a - b);

  let sumPaid = 0, sumBonus30 = 0, sumBonus60 = 0, sumWelfare = 0;
  let sumFour = 0, sumFive = 0, sumRateUp = 0, sumLimited = 0, sumStandard = 0, sumBanners = 0, sumBannersSkipped = 0;

  for (const r of results) {
    sumPaid += r.pullCount;
    sumBonus30 += r.bonus30PullCount;
    sumBonus60 += r.bonus60PullCount;
    sumWelfare += r.welfarePullCount;
    sumFour += r.totalFourStar;
    sumFive += r.totalFiveStar;
    sumRateUp += r.totalSixStarRateUp;
    sumLimited += r.totalSixStarLimited;
    sumStandard += r.totalSixStarStandard;
    sumBanners += r.bannersVisited;
    sumBannersSkipped += r.bannersSkipped;
  }

  const totalSixStar = sumRateUp + sumLimited + sumStandard;
  const arsenalFrom6 = totalSixStar * 2000 / n;
  const arsenalFrom5 = sumFive * 200 / n;
  const arsenalFrom4 = sumFour * 20 / n;
  const arsenalTotal = arsenalFrom6 + arsenalFrom5 + arsenalFrom4;
  const bondQuota = sumFive * 10 / n;
  const refundTickets = bondQuota / 25;
  const aicQuotaFrom5 = sumFive * 20 / n;
  const aicQuotaFrom4 = sumFour * 5 / n;
  const aicQuotaTotal = aicQuotaFrom5 + aicQuotaFrom4;

  let html = '';

  // Base Parameters
  const bannerLength = parseInt(document.getElementById('banner-length').value) || 17;
  const welfarePulls = parseInt(document.getElementById('welfare-pulls').value) || 40;
  const currency = getSelectedCurrency();
  const fmtMoney = (v) => {
    if (Number.isInteger(v) || v >= 100) return `${currency.symbol}${Math.round(v)}`;
    return `${currency.symbol}${v.toFixed(2)}`;
  };

  const monthlyCardPulls = bannerLength * 200 / ORBS_PER_PULL;
  const monthlyCardProrated = currency.monthlyCard * bannerLength / 30;
  const bundlePulls = 10;
  const hardSpendOrbs = currency.hardSpendCurrency === 'origeometry'
    ? currency.hardSpendQty * ORIGEOMETRY_TO_OROBERYL
    : currency.hardSpendQty;
  const hardSpendPulls = hardSpendOrbs / ORBS_PER_PULL;
  const costPerPull = currency.hardSpendCost / hardSpendPulls;

  html += `<h3>${tr('result.parameters', 'Parameters')}</h3>`;
  html += `<div class="stat-grid">`;
  html += statRow('Trials', config.numTrials.toLocaleString());
  html += statRow('Max Banners', config.maxBanners.toLocaleString());
  if (config.startWithCharteredHH) html += statRow('Start with Chartered HH', tr('result.yes', 'Yes'), 'blue', false, tip('charHHStart'));
  if (config.seed != null) html += statRow('Seed', config.seed.toString(), '', false, tip('fixedSeed'));
  if (config.startFiveStarPity > 0) html += statRow('Starting 5★ Pity', config.startFiveStarPity.toString(), '', false, tip('startPity5'));
  if (config.startSixStarPity > 0) html += statRow('Starting 6★ Pity', config.startSixStarPity.toString(), '', false, tip('startPity6'));
  html += statRow('Banner Length', `${bannerLength} ${tr('result.days', 'days')}`);
  html += statRow('Welfare Pulls', `${welfarePulls} ${tr('result.perBanner', '/banner')}`, '', false, tip('welfareAssumed'));
  html += `</div>`;

  // Banners
  const avgBannersSkipped = sumBannersSkipped / n;
  html += `<h3 class="has-tip" data-tip="${escapeHtml(tip('bannersHeading'))}">${tr('result.banners', 'Banners')} <span class="tip-icon">?</span></h3>`;
  html += `<div class="stat-grid">`;
  html += statRow('Banners Skipped', avgBannersSkipped.toFixed(1), '', false, tip('bannersSkipped', { trials: n }));
  html += `</div>`;

  // Paid Pulls â€” hero mean + histogram
  html += `<h3 class="has-tip" data-tip="${escapeHtml(tip('paidHeading'))}">${tr('result.paidPulls', 'Paid Pulls')} <span class="tip-icon">?</span></h3>`;
  const meanPaid = mean(paidPulls);
  const paidPerBanner = meanPaid / (sumBanners / n);
  html += `<div class="paid-pulls-hero">`;
  html += `<div class="hero-stat has-tip" data-tip="${escapeHtml(tip('paidMean', { banners: config.maxBanners }))}"><div class="hero-num">${meanPaid.toFixed(0)}</div><div class="hero-label">${tr('result.meanPulls', 'mean pulls')} <span class="tip-icon">?</span></div></div>`;
  html += `<div class="hero-stat has-tip" data-tip="${escapeHtml(tip('paidPerAll', { banners: config.maxBanners }))}"><div class="hero-num">${paidPerBanner.toFixed(2)}</div><div class="hero-label-row"><div class="hero-label">${tr('result.pullsBannerAll', 'pulls/banner<br>(all)')}</div><span class="tip-icon">?</span></div></div>`;
  const targetBanners = config.maxBanners - avgBannersSkipped;
  const paidPerTarget = targetBanners > 0 ? meanPaid / targetBanners : 0;
  html += `<div class="hero-stat has-tip" data-tip="${escapeHtml(tip('paidPerTarget', { skipped: avgBannersSkipped.toFixed(1) }))}"><div class="hero-num">${paidPerTarget.toFixed(2)}</div><div class="hero-label-row"><div class="hero-label">${tr('result.pullsBannerTarget', 'pulls/banner<br>(target)')}</div><span class="tip-icon">?</span></div></div>`;
  html += `</div>`;
  html += renderDistribution(paidPulls, n);

  // Bonus Pulls
  html += `<h3>${tr('result.bonusPulls', 'Bonus Pulls')}</h3>`;
  html += `<div class="stat-grid">`;
  html += statRow('Banner Specific', (sumWelfare / n).toFixed(1), '', false, tip('bonusBannerSpecific'));
  html += statRow('30-pull bonus', (sumBonus30 / n).toFixed(1), '', false, tip('bonus30'));
  html += statRow('60-pull bonus', (sumBonus60 / n).toFixed(1), '', false, tip('bonus60'));
  html += `</div>`;

  // Total Pulls
  const meanTotal = mean(totalPulls);
  const totalPerBanner = meanTotal / (sumBanners / n);
  html += `<h3>${tr('result.totalPulls', 'Total Pulls')}</h3>`;
  html += `<div class="stat-grid">`;
  html += statRow('Mean', meanTotal.toFixed(1), '', false, tip('totalMean', { banners: config.maxBanners }));
  html += statRow('Pulls/Banner', totalPerBanner.toFixed(1), '', false, tip('totalPerBanner'));
  html += `</div>`;

  // Characters
  const avgBanners = sumBanners / n;
  const avgFour = sumFour / n;
  const avgFive = sumFive / n;
  const avgRateUp = sumRateUp / n;
  const avgLimited = sumLimited / n;
  const avgStandard = sumStandard / n;
  const avgSixTotal = avgRateUp + avgLimited + avgStandard;
  html += `<h3>${tr('result.characters', 'Characters')}</h3>`;
  html += `<div class="stat-grid">`;
  html += statRow('4★', avgFour.toFixed(2), '', false, tip('fourTotal', { banners: config.maxBanners }));
  html += statRow('4★ /banner', (avgFour / avgBanners).toFixed(2), '', false, tip('fourPerBanner'));
  html += statRow('5★', avgFive.toFixed(2), 'blue', false, tip('fiveTotal', { banners: config.maxBanners }));
  html += statRow('5★ /banner', (avgFive / avgBanners).toFixed(2), 'blue', false, tip('fivePerBanner'));
  html += statRow('6★ standard', avgStandard.toFixed(2), 'purple', false, tip('sixStandard'));
  html += statRow('6★ standard/banner', (avgStandard / avgBanners).toFixed(2), 'purple', false, tip('sixStandardPerBanner'));
  html += statRow('6★ rate-up', avgRateUp.toFixed(2), 'gold', false, tip('sixRateUp', { banners: config.maxBanners }));
  html += statRow('6★ rate-up/banner', (avgRateUp / avgBanners).toFixed(2), 'gold', false, tip('sixRateUpPerBanner'));
  html += statRow('6★ limited', avgLimited.toFixed(2), 'orange', false, tip('sixLimited'));
  html += statRow('6★ limited/banner', (avgLimited / avgBanners).toFixed(2), 'orange', false, tip('sixLimitedPerBanner'));
  html += statRow('6★ total', avgSixTotal.toFixed(2), 'gold', false, tip('sixTotal', { banners: config.maxBanners }));
  html += statRow('6★ total/banner', (avgSixTotal / avgBanners).toFixed(2), 'gold', false, tip('sixTotalPerBanner'));
  html += `</div>`;

  // Pulls per 6-star
  html += `<h3>${tr('result.pullsPerSix', 'Pulls per 6★')}</h3>`;
  html += `<div class="stat-grid">`;
  if (sumRateUp > 0) html += statRow('Paid / rate-up', (sumPaid / sumRateUp).toFixed(2), 'gold', false, tip('paidPerRateUp'));
  if (totalSixStar > 0) html += statRow('Paid / any 6★', (sumPaid / totalSixStar).toFixed(2), '', false, tip('paidPerAnySix'));
  html += `</div>`;

  // Arsenal Tickets
  html += `<h3>${tr('result.arsenalTickets', 'Arsenal Tickets')}</h3>`;
  html += `<div class="stat-grid">`;
  html += statRow('From 4★', Math.round(arsenalFrom4), '', false, tip('arsenalFrom4')) + '<div></div>';
  html += statRow('From 5★', Math.round(arsenalFrom5), '', false, tip('arsenalFrom5')) + '<div></div>';
  html += statRow('From 6★', Math.round(arsenalFrom6), '', false, tip('arsenalFrom6')) + '<div></div>';
  html += statRow('Total', Math.round(arsenalTotal), 'green', false, tip('arsenalTotal', { banners: config.maxBanners }));
  html += statRow('→ Arsenal 10-pull', (arsenalTotal / 1980).toFixed(2), 'green', false, tip('arsenalTenPull'));
  html += `<div></div>`;
  html += statRow('→ Arsenal 10-pull/banner', (arsenalTotal / 1980 / avgBanners).toFixed(2), 'green', false, tip('arsenalTenPullPerBanner'));
  html += `</div>`;

  // Quota Exchange
  html += `<h3>${tr('result.quotaExchange', 'Quota Exchange')}</h3>`;
  html += `<div class="stat-grid">`;
  html += statRow('Bond Quota', bondQuota.toFixed(0), '', false, tip('bondQuota'));
  html += statRow('→ HH Ticket', refundTickets.toFixed(1));
  html += `<div></div>`;
  html += statRow('→ HH Ticket/banner', (refundTickets / avgBanners).toFixed(2));
  html += `<div></div><div></div>`;
  html += statRow('AIC Quota from 4★', aicQuotaFrom4.toFixed(0), '', false, tip('aicFrom4'));
  html += `<div></div>`;
  html += statRow('AIC Quota from 5★', aicQuotaFrom5.toFixed(0), '', false, tip('aicFrom5'));
  html += `<div></div>`;
  const bannerHHTickets = aicQuotaTotal / 70;
  html += statRow('AIC Quota', aicQuotaTotal.toFixed(0), 'blue', false, tip('aicTotal', { banners: config.maxBanners }));
  html += statRow('→ Banner HH Ticket', bannerHHTickets.toFixed(1), 'blue', false, tip('bannerHHTicket'));
  html += `<div></div>`;
  html += statRow('→ Banner HH Ticket/banner', (bannerHHTickets / avgBanners).toFixed(2), 'blue', false, tip('bannerHHTicketPerBanner'));
  html += `</div>`;

  // Money, Money, Money
  const shortfall = paidPerBanner - welfarePulls;
  const withMonthly = shortfall - monthlyCardPulls;
  const withMonthlyBundle = withMonthly - bundlePulls;

  html += `<h3>${tr('result.money', 'Money, Money, Money')}</h3>`;
  const mcCostPerPull = monthlyCardProrated / monthlyCardPulls;
  const pullsWord = tr('result.pullsWord', 'pulls');
  const perPull = tr('result.perPull', '/pull');
  const dayUnit = tr('result.days', 'days') === '天' ? '天' : 'd';
  const pullsAtPerPull = (pulls, cost) => tr('result.pullsAtPerPull', '{pulls} pulls @ {cost}/pull')
    .replace('{pulls}', pulls)
    .replace('{cost}', cost);
  html += packRow('Monthly Card',
    [`${fmtMoney(currency.monthlyCard)}/30${dayUnit}`, `${fmtMoney(monthlyCardProrated)}/${bannerLength}${dayUnit}`, pullsAtPerPull(monthlyCardPulls.toFixed(1), fmtMoney(mcCostPerPull))],
    tip(
      'monthlyCardPack',
      {
        cost30: fmtMoney(currency.monthlyCard),
        days: bannerLength,
        costDays: fmtMoney(monthlyCardProrated),
        pulls: monthlyCardPulls.toFixed(1),
      },
    ));
  const bundleCostPerPull = currency.bundle / bundlePulls;
  html += packRow('HH Bundle',
    [`${fmtMoney(currency.bundle)}${tr('result.perBanner', '/banner')}`, pullsAtPerPull(bundlePulls, fmtMoney(bundleCostPerPull))],
    tip(
      'hhBundlePack',
      { cost: fmtMoney(currency.bundle) },
    ));
  const hardSpendCurrencyLabel = tr(`ui.${currency.hardSpendCurrency}`, currency.hardSpendCurrency);
  const hardSpendLabel = `${tr('ui.hardSpend', 'Hard Spend')} (${currency.hardSpendQty} ${hardSpendCurrencyLabel})`;
  html += packRow(hardSpendLabel,
    [`${fmtMoney(currency.hardSpendCost)}`, `${hardSpendPulls.toFixed(1)} ${pullsWord}`, `${fmtMoney(costPerPull)}${perPull}`],
    tip(
      'hardSpendPack',
      {
        cost: fmtMoney(currency.hardSpendCost),
        qty: currency.hardSpendQty,
        currency: hardSpendCurrencyLabel,
        oroberyl: hardSpendOrbs,
        orbsPerPull: ORBS_PER_PULL,
      },
    ));
  html += `<div class="stat-grid">`;
  const fmtShortfall = (v) => (v > 0 ? '-' : '+') + Math.abs(v).toFixed(1) + ` ${pullsWord}`;
  const shortfallColor = (v) => v > 0 ? 'red' : 'green';
  const shortfallLabel = shortfall > 0 ? 'Shortfall/banner' : 'Gain/banner';
  const shortfallTip = shortfall > 0
    ? tip('shortfall', { welfare: welfarePulls })
    : tip('surplus', { welfare: welfarePulls, pulls: Math.abs(shortfall).toFixed(1) });
  html += statRow(shortfallLabel, fmtShortfall(shortfall), shortfallColor(shortfall), false, shortfallTip);
  html += `<div></div>`;
  const bundleCostProrated = monthlyCardProrated + currency.bundle;
  const costLabel = tr('result.costPerDays', 'Cost/{days} days').replace('{days}', bannerLength);
  html += statRow('w/ MC', fmtShortfall(withMonthly), shortfallColor(withMonthly), false, tip('withMc'));
  html += statRow(costLabel, fmtMoney(monthlyCardProrated), '', false, tip('costPerPeriod'));
  html += statRow('w/ MC, Bundle', fmtShortfall(withMonthlyBundle), shortfallColor(withMonthlyBundle), false, tip('withMcBundle'));
  html += statRow(costLabel, fmtMoney(bundleCostProrated), '', false, tip('costPerPeriod'));
  const hardSpendTotalCost = bundleCostProrated + Math.max(0, withMonthlyBundle) * costPerPull;
  html += statRow('w/ MC, Bundle, Hard Spend', '---', 'green');
  html += statRow(costLabel, fmtMoney(hardSpendTotalCost), '', false, tip('costPerPeriod'));
  html += `</div>`;

  // Pull Distribution (tabbed: Termination / Rate-Up 6★)
  html += `<h3>${tr('result.pullDistribution', 'Pull Distribution')}</h3>`;
  html += renderPullDistSection(terminationCounts, rateUpCounts);

  // Banner inspector (sample trial)
  html += renderBannerInspector(sampleBannerLogs);

  resultsContent.innerHTML = html;
  initBannerTabs(win);
  initPullDistTabs(win);
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

function statRow(label, value, colorClass, span, tipOverride) {
  const tooltip = tipOverride || tr(`detailTipLabel.${label}`, TOOLTIPS[label]);
  const tipAttr = tooltip ? ` data-tip="${escapeHtml(tooltip)}"` : '';
  const tipClass = tooltip ? ' has-tip' : '';
  return `<div class="stat-row${span ? ' span-2' : ''}"${tipAttr}>
    <span class="stat-label${tipClass}">${trResultLabel(label)}${tooltip ? ' <span class="tip-icon">?</span>' : ''}</span>
    <span class="stat-value${colorClass ? ' ' + colorClass : ''}">${value}</span>
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
  const tip = target.closest('[data-tip]');
  if (!tip) return;
  const el = ensureTooltip();
  el.textContent = tip.dataset.tip;
  el.classList.add('visible');

  const rect = tip.getBoundingClientRect();
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
  document.getElementById('welfare-free-pulls').value = 5;
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
  const changelogModal = document.getElementById('changelog-modal');
  const changelogBtn = document.getElementById('changelog-btn');
  const changelogCloseBtn = changelogModal.querySelector('.modal-close');
  const languageSelect = document.getElementById('language-select');

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
        if (strategy && desc) {
          const localized = t(`strategyDesc.${strategy.value}`);
          desc.textContent = localized.startsWith('strategyDesc.') ? getStrategyDescription(strategy.value) : localized;
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
  changelogBtn.addEventListener('click', () => {
    changelogModal.classList.remove('hidden');
  });
  changelogCloseBtn.addEventListener('click', () => {
    changelogModal.classList.add('hidden');
  });
  changelogModal.addEventListener('click', (e) => {
    if (e.target === changelogModal) changelogModal.classList.add('hidden');
  });

  _mouseenterHandler = (e) => {
    if (e.target.closest('[data-tip]')) showTooltip(e.target);
  };
  _mouseleaveHandler = (e) => {
    if (e.target.closest('[data-tip]')) hideTooltip();
  };
  _keydownHandler = (e) => {
    if (e.key === 'Escape' && !changelogModal.classList.contains('hidden')) {
      changelogModal.classList.add('hidden');
    }
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
}
