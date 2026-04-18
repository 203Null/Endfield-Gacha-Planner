import html2canvas from 'html2canvas';
import { applyStaticTranslations, initLanguage, setLanguage, t } from '../i18n.js';

let windowCounter = 0;
let hashUpdateTimer = null;
let suppressHashUpdate = false;
let isInitialized = false;
let tooltipEl = null;
let mouseEnterHandler = null;
let mouseLeaveHandler = null;
let distributionModalEl = null;
const metricDistributionStore = new WeakMap();

const FOUR_STAR = 0;
const FIVE_STAR = 1;
const SIX_STAR_RATE_UP = 2;
const SIX_STAR_NON_RATE_UP = 3;

const OUTCOME_LABELS = ['4★', '5★', '6★ Rate-Up', '6★ Non-Rate-Up'];
const OUTCOME_CLASSES = ['four-star', 'five-star', 'six-star-rateup', 'six-star-standard'];

function tr(path, fallback) {
  const value = t(path);
  return value === path ? fallback : value;
}

function trTpl(path, fallback, params = {}) {
  let text = tr(path, fallback);
  Object.entries(params).forEach(([key, value]) => {
    text = text.replaceAll(`{${key}}`, String(value));
  });
  return text;
}

function weaponTip(key, fallback = '') {
  return tr(`weaponTip.${key}`, fallback);
}

function outcomeLabel(index) {
  if (index === FOUR_STAR) return tr('weaponResult.outcome4', OUTCOME_LABELS[index]);
  if (index === FIVE_STAR) return tr('weaponResult.outcome5', OUTCOME_LABELS[index]);
  if (index === SIX_STAR_RATE_UP) return tr('weaponResult.outcomeRateUp', OUTCOME_LABELS[index]);
  return tr('weaponResult.outcomeNonRateUp', OUTCOME_LABELS[index]);
}

function setShareButtonDefault() {
  const btn = document.getElementById('share-btn');
  if (!btn) return;
  btn.innerHTML = `<span class="btn-label">${t('ui.share')}</span>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  if (p <= 0) return sorted[0];
  if (p >= 100) return sorted[sorted.length - 1];
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[rank - 1];
}

function mean(values) {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
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

function formatDistributionSummaryValue(value, formatValue, digits = 2) {
  return formatDistributionDisplayValue(value, formatValue, digits);
}

function serializeState() {
  const params = new URLSearchParams();
  params.set('t', document.getElementById('trials-input').value);
  const seed = document.getElementById('seed-input').value.trim();
  if (seed !== '') params.set('s', seed);

  document.querySelectorAll('.sim-window').forEach((win) => {
    const mode = win.querySelector('.mode-select').value;
    if (mode === 'copies') {
      const copies = win.querySelector('.target-copies-input').value;
      params.append('w', `copies:${copies}`);
    } else {
      const pulls = win.querySelector('.ten-pulls-input').value;
      params.append('w', `pulls:${pulls}`);
    }
  });

  return params.toString();
}

function deserializeState(hash) {
  if (!hash || hash === '#') return false;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const knownKeys = ['t', 's', 'w'];
  if (!knownKeys.some((key) => params.has(key))) return false;

  if (params.has('t')) document.getElementById('trials-input').value = params.get('t');
  if (params.has('s')) document.getElementById('seed-input').value = params.get('s');

  const windows = params.getAll('w');
  if (windows.length > 0) {
    windows.forEach((value) => {
      if (value.startsWith('copies:')) {
        createSimWindow({ mode: 'copies', targetCopies: parseInt(value.slice(7), 10) || 1 });
      } else if (value.startsWith('pulls:')) {
        createSimWindow({ mode: 'pulls', tenPulls: parseInt(value.slice(6), 10) || 10 });
      } else {
        createSimWindow();
      }
    });
  } else {
    createSimWindow();
  }

  return true;
}

function updateHash() {
  const hash = serializeState();
  history.replaceState(null, '', hash ? `#${hash}` : `${location.pathname}${location.search}`);
}

function scheduleHashUpdate() {
  if (suppressHashUpdate) return;
  clearTimeout(hashUpdateTimer);
  hashUpdateTimer = setTimeout(updateHash, 300);
}

async function exportWindowAsJpeg(win) {
  const btn = win.querySelector('.window-export');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const body = win.querySelector('.window-body');
    const originalMaxHeight = win.style.maxHeight;
    const originalOverflow = body.style.overflowY;
    win.style.maxHeight = 'none';
    body.style.overflowY = 'visible';

    const pullLogs = win.querySelectorAll('.pull-log');
    const originalPullLogHeights = [];
    pullLogs.forEach((pullLog) => {
      originalPullLogHeights.push(pullLog.style.maxHeight);
      pullLog.style.maxHeight = 'none';
    });

    const canvas = await html2canvas(win, {
      backgroundColor: '#0f1117',
      scale: 2,
      useCORS: true,
    });

    win.style.maxHeight = originalMaxHeight;
    body.style.overflowY = originalOverflow;
    pullLogs.forEach((pullLog, index) => {
      pullLog.style.maxHeight = originalPullLogHeights[index];
    });

    const link = document.createElement('a');
    const title = win.querySelector('.window-title').textContent;
    link.download = `endfield-weapon-${title.replace(/[^a-zA-Z0-9]/g, '')}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  } catch (error) {
    console.error('Export failed:', error);
    alert(`${t('ui.exportFailed')}: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function createSimWindow(opts = {}) {
  windowCounter++;
  const template = document.getElementById('sim-window-template');
  const clone = template.content.cloneNode(true);
  const win = clone.querySelector('.sim-window');
  win.querySelector('.window-title').textContent = `#${windowCounter}`;

  win.querySelector('.window-close').addEventListener('click', () => {
    if (document.querySelectorAll('.sim-window').length <= 1) return;
    win.remove();
    renumberWindows();
    scheduleHashUpdate();
  });

  const modeSelect = win.querySelector('.mode-select');
  const pullsRow = win.querySelector('[data-mode-input="pulls"]');
  const copiesRow = win.querySelector('[data-mode-input="copies"]');

  function applyMode(mode) {
    if (mode === 'copies') {
      pullsRow.classList.add('hidden');
      copiesRow.classList.remove('hidden');
    } else {
      pullsRow.classList.remove('hidden');
      copiesRow.classList.add('hidden');
    }
  }

  if (opts.mode) modeSelect.value = opts.mode;
  if (opts.tenPulls) win.querySelector('.ten-pulls-input').value = opts.tenPulls;
  if (opts.targetCopies) win.querySelector('.target-copies-input').value = opts.targetCopies;
  applyMode(modeSelect.value);

  modeSelect.addEventListener('change', () => {
    applyMode(modeSelect.value);
    scheduleHashUpdate();
  });

  win.querySelector('.window-export').addEventListener('click', () => exportWindowAsJpeg(win));
  win.querySelector('.run-btn').addEventListener('click', () => runSimulation(win));
  bindPercentileSlider(win);
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
  document.querySelectorAll('.sim-window').forEach((win, index) => {
    win.querySelector('.window-title').textContent = `#${index + 1}`;
  });
}

function runSimulation(win) {
  const mode = win.querySelector('.mode-select').value;
  const runBtn = win.querySelector('.run-btn');
  const progressContainer = win.querySelector('.progress-bar-container');
  const progressBar = win.querySelector('.progress-bar');
  const progressText = win.querySelector('.progress-text');
  const resultsPlaceholder = win.querySelector('.results-placeholder');
  const resultsContent = win.querySelector('.results-content');

  const config = {
    numTrials: Math.min(100000, Math.max(100, parseInt(document.getElementById('trials-input').value, 10) || 5000)),
    mode,
    tenPulls: Math.min(500, Math.max(1, parseInt(win.querySelector('.ten-pulls-input').value, 10) || 10)),
    targetCopies: Math.min(50, Math.max(1, parseInt(win.querySelector('.target-copies-input').value, 10) || 1)),
    seed: document.getElementById('seed-input').value.trim() !== '' ? parseInt(document.getElementById('seed-input').value, 10) : null,
  };

  runBtn.disabled = true;
  runBtn.textContent = t('ui.running');
  progressContainer.style.display = '';
  progressBar.style.width = '0%';
  progressText.textContent = '0%';
  resultsPlaceholder.classList.add('hidden');
  resultsContent.classList.add('hidden');
  metricDistributionStore.delete(win);
  setPercentileVisibility(win, false);

  const worker = new Worker(new URL('./weapon-engine.worker.js', import.meta.url), { type: 'module' });

  worker.onmessage = (event) => {
    const msg = event.data;
    if (msg.type === 'progress') {
      const pct = Math.round(msg.progress * 100);
      progressBar.style.width = `${pct}%`;
      progressText.textContent = `${pct}%`;
      return;
    }

    if (msg.type === 'done') {
      worker.terminate();
      runBtn.disabled = false;
      runBtn.textContent = t('ui.runSimulation');
      progressContainer.style.display = 'none';
      displayResults(win, msg.results, config, msg.sampleLog, msg.tenPullCounts, msg.rateUpCopyCounts);
      return;
    }

    if (msg.type === 'error') {
      worker.terminate();
      runBtn.disabled = false;
      runBtn.textContent = t('ui.runSimulation');
      progressContainer.style.display = 'none';
      resultsContent.classList.remove('hidden');
      resultsContent.innerHTML = `<div class="error-msg">${escapeHtml(msg.error)}</div>`;
    }
  };

  worker.onerror = (error) => {
    worker.terminate();
    runBtn.disabled = false;
    runBtn.textContent = t('ui.runSimulation');
    progressContainer.style.display = 'none';
    resultsContent.classList.remove('hidden');
    resultsContent.innerHTML = `<div class="error-msg">${t('ui.workerError')}: ${escapeHtml(error.message)}</div>`;
  };

  worker.postMessage({ type: 'run', config });
}

function renderDistribution(sorted, options = {}) {
  const formatValue = options.formatValue || defaultDistributionFormatter;
  const showStdCurve = options.showStdCurve ?? true;
  const selectedPercentile = Number.isFinite(options.selectedPercentile) ? Math.max(1, Math.min(100, options.selectedPercentile)) : null;
  const selectedRange = options.selectedRange && Number.isFinite(options.selectedRange.start) && Number.isFinite(options.selectedRange.end)
    ? normalizePercentileRange(options.selectedRange.start, options.selectedRange.end)
    : null;
  const buckets = 30;
  const absMin = sorted[0];
  const absMax = sorted[sorted.length - 1];
  if (absMin === absMax) {
    return `<div class="dist-single">${formatDistributionDisplayValue(absMin, formatValue)} ${tr('result.allTrialsIdentical', '(all trials identical)')}</div>`;
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

  sorted.forEach((value) => {
    if (value < minVal) {
      trimmedLow++;
      return;
    }
    if (value > maxVal) {
      trimmedHigh++;
      return;
    }
    let bucket = Math.floor((value - minVal) / bucketSize);
    if (bucket >= buckets) bucket = buckets - 1;
    counts[bucket]++;
  });

  const maxCount = Math.max(...counts);
  const includedCount = sorted.length - trimmedLow - trimmedHigh;
  const stats = computeDistributionStats(sorted);
  const percentileMarkers = [
    { p: 5, label: 'P5', color: '#4caf50' },
    { p: 25, label: 'P25', color: '#8aa4ff' },
    { p: 50, label: 'P50', color: '#fff' },
    { p: 75, label: 'P75', color: '#8aa4ff' },
    { p: 95, label: 'P95', color: '#ff9800' },
  ].map((marker) => ({ ...marker, val: percentile(sorted, marker.p) }));

  const W = 380;
  const H = 120;
  const padL = 2;
  const padR = 2;
  const padT = 20;
  const padB = 32;
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

  let svg = `<svg class="dist-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  for (let i = 0; i < buckets; i++) {
    const barH = yScaleMax > 0 ? (counts[i] / yScaleMax) * chartH : 0;
    const x = padL + i * barW;
    const y = padT + chartH - barH;
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
  percentileMarkers.forEach((marker, i) => {
    const xRaw = padL + ((marker.val - minVal) / range) * chartW;
    const xTick = Math.max(padL, Math.min(padL + chartW, xRaw));
    const xLabel = padL + (i + 0.5) * chartW / percentileMarkers.length;
    svg += `<line x1="${xTick}" y1="${padT}" x2="${xTick}" y2="${padT + chartH + 5}" stroke="${marker.color}" stroke-width="1" stroke-opacity="0.7" stroke-dasharray="${marker.p === 50 ? 'none' : '2,2'}"/>`;
    if (Math.abs(xTick - xLabel) > 1) {
      svg += `<line x1="${xTick}" y1="${padT + chartH + 5}" x2="${xLabel}" y2="${padT + chartH + 9}" stroke="${marker.color}" stroke-width="0.8" stroke-opacity="0.4"/>`;
    }
    svg += `<text x="${xLabel}" y="${padT + chartH + 17}" text-anchor="middle" fill="${marker.color}" font-size="9" font-family="inherit" opacity="0.9">${marker.label}</text>`;
    svg += `<text x="${xLabel}" y="${padT + chartH + 28}" text-anchor="middle" fill="${marker.color}" font-size="9" font-family="inherit" font-weight="600">${formatDistributionDisplayValue(marker.val, formatValue)}</text>`;
  });

  if (selectedRange && !(selectedRange.rangeStart <= 0 && selectedRange.rangeEnd >= 100)) {
    const rangeColor = '#9fd0ff';
    const startValue = percentile(sorted, selectedRange.rangeStart);
    const endValue = percentile(sorted, selectedRange.rangeEnd);
    const startX = Math.max(padL, Math.min(padL + chartW, padL + ((startValue - minVal) / range) * chartW));
    const endX = Math.max(padL, Math.min(padL + chartW, padL + ((endValue - minVal) / range) * chartW));
    const leftX = Math.min(startX, endX);
    const rightX = Math.max(startX, endX);

    if (rightX - leftX > 1) {
      svg += `<rect x="${leftX}" y="${padT}" width="${rightX - leftX}" height="${chartH}" fill="${rangeColor}" fill-opacity="0.14"/>`;
    }

    [startX, endX].forEach((xPos, index) => {
      if (index === 1 && Math.abs(endX - startX) < 0.5) return;
      svg += `<line x1="${xPos}" y1="${padT}" x2="${xPos}" y2="${padT + chartH}" stroke="${rangeColor}" stroke-width="1.6" stroke-opacity="0.85" stroke-dasharray="4 3"/>`;
    });
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

  const lowVal = formatDistributionDisplayValue(minVal, formatValue);
  const highVal = formatDistributionDisplayValue(maxVal, formatValue);
  const lowLabel = trimmedLow > 0 ? `${lowVal} (←${trimmedLow})` : lowVal;
  const highLabel = trimmedHigh > 0 ? `(${trimmedHigh}→) ${highVal}` : highVal;
  svg += `<text x="${padL}" y="${padT - 6}" fill="#8b8fa3" font-size="9" font-family="inherit">${lowLabel}</text>`;
  svg += `<text x="${W - padR}" y="${padT - 6}" text-anchor="end" fill="#8b8fa3" font-size="9" font-family="inherit">${highLabel}</text>`;
  svg += '</svg>';

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

function formatDistributionMetricValue(metric, state) {
  const values = getDistributionValues(metric);
  if (!values.length) return '—';
  const formatValue = metric.formatValue || defaultDistributionFormatter;
  const selectedValue = state.mode === 'percentile'
    ? percentile(values, state.percentileValue)
    : averagePercentileRange(values, state.rangeStart, state.rangeEnd);
  return formatDistributionDisplayValue(selectedValue, formatValue);
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

function getWindowDistributionState(win) {
  const container = win.querySelector('.pctl-slider-container');
  const percentileSlider = win.querySelector('.pctl-single-slider');
  const { rangeStart, rangeEnd } = syncAverageRangeInputs(win);
  return {
    mode: container?.dataset.mode === 'percentile' ? 'percentile' : 'average',
    percentileValue: clampPercentileValue(percentileSlider?.value, 1, 100, 50),
    rangeStart,
    rangeEnd,
  };
}

function setPercentileVisibility(win, visible) {
  const container = win.querySelector('.pctl-slider-container');
  if (!container) return;
  container.classList.toggle('hidden', !visible);
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

function updateDistributionLabels(win, state) {
  const summaryLabel = win.querySelector('[data-pctl="sliderLabel"]');
  if (summaryLabel) {
    summaryLabel.textContent = state.mode === 'percentile'
      ? `P${state.percentileValue}`
      : `${tr('ui.distributionModeAverage', 'Average')} P${state.rangeStart}-P${state.rangeEnd}`;
  }


}

function refreshPercentileView(win) {
  const metricMap = metricDistributionStore.get(win);
  const hasMetrics = Boolean(metricMap?.size);
  setPercentileVisibility(win, hasMetrics);
  if (!hasMetrics) return;

  const state = getWindowDistributionState(win);
  const percentileSlider = win.querySelector('.pctl-single-slider');
  if (percentileSlider) percentileSlider.value = String(state.percentileValue);
  updateDistributionLabels(win, state);

  win.querySelectorAll('[data-dist-key]').forEach((el) => {
    const metric = metricMap.get(el.dataset.distKey);
    if (!metric) return;
    el.textContent = formatDistributionMetricValue(metric, state);
  });

  win.querySelectorAll('[data-dist-chart-key]').forEach((el) => {
    const metric = metricMap.get(el.dataset.distChartKey);
    if (!metric) return;
    const values = getDistributionValues(metric);
    if (!values.length) {
      el.innerHTML = '';
      return;
    }
    const formatValue = metric.formatValue || defaultDistributionFormatter;
    el.innerHTML = renderDistribution(values, {
      formatValue,
      selectedPercentile: state.mode === 'percentile' ? state.percentileValue : null,
      selectedRange: state.mode === 'average'
        ? { start: state.rangeStart, end: state.rangeEnd }
        : null,
    });
  });
}

function bindPercentileSlider(win) {
  const container = win.querySelector('.pctl-slider-container');
  const percentileSlider = win.querySelector('.pctl-single-slider');
  const rangeStartSlider = win.querySelector('.pctl-range-start');
  const rangeEndSlider = win.querySelector('.pctl-range-end');
  if (!container || !percentileSlider || !rangeStartSlider || !rangeEndSlider || container.dataset.bound === 'true') return;

  container.dataset.bound = 'true';
  if (container.dataset.mode !== 'percentile' && container.dataset.mode !== 'average') {
    container.dataset.mode = 'average';
  }
  if (!percentileSlider.value) percentileSlider.value = '50';
  if (!rangeStartSlider.value) rangeStartSlider.value = '0';
  if (!rangeEndSlider.value) rangeEndSlider.value = '100';
  syncAverageRangeInputs(win);
  setDistributionMode(win, container.dataset.mode);

  const sync = () => refreshPercentileView(win);
  percentileSlider.addEventListener('input', sync);
  percentileSlider.addEventListener('change', sync);
  rangeStartSlider.addEventListener('input', () => {
    syncAverageRangeInputs(win, 'start');
    sync();
  });
  rangeStartSlider.addEventListener('change', () => {
    syncAverageRangeInputs(win, 'start');
    sync();
  });
  rangeEndSlider.addEventListener('input', () => {
    syncAverageRangeInputs(win, 'end');
    sync();
  });
  rangeEndSlider.addEventListener('change', () => {
    syncAverageRangeInputs(win, 'end');
    sync();
  });
  container.querySelectorAll('[data-pctl-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      setDistributionMode(win, button.dataset.pctlMode);
      sync();
    });
  });

  updateDistributionLabels(win, getWindowDistributionState(win));
}

function getDistributionTriggerDescription(trigger) {
  return trigger?.dataset.tip || trigger?.closest('[data-tip]')?.dataset.tip || '';
}

function openDistributionFromTrigger(win, trigger) {
  if (!trigger) return;
  const metric = metricDistributionStore.get(win)?.get(trigger.dataset.distKey);
  openDistributionModal(metric, getDistributionTriggerDescription(trigger));
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
  if (distributionModalEl) return distributionModalEl;
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
  distributionModalEl = modal;
  return modal;
}

function openDistributionModal(metric, description = '') {
  if (!metric) return;
  const values = getDistributionValues(metric);
  if (!values.length) return;

  hideTooltip();
  const formatValue = metric.formatValue || defaultDistributionFormatter;
  const modal = ensureDistributionModal();
  modal.querySelector('.modal-header h2').textContent = metric.title;
  modal.querySelector('.modal-close').setAttribute('title', t('ui.close'));
  const noteEl = modal.querySelector('.distribution-modal-note');
  noteEl.textContent = description;
  noteEl.classList.toggle('hidden', !description);
  modal.querySelector('.distribution-modal-chart').innerHTML = renderDistribution(values, { formatValue });
  modal.querySelector('.distribution-modal-summary').innerHTML = renderDistributionSummary(values, formatValue);
  modal.classList.remove('hidden');
}

let pullChartIdCounter = 0;

function renderPullDistChart(counts, color, gradId) {
  if (!counts || counts.length === 0) return '';

  const cap = counts.length - 1;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i <= cap; i++) {
    if (counts[i] > 0) maxX = i;
    if (counts[i] > maxY) maxY = counts[i];
  }
  if (maxY === 0) return `<div class="term-chart-empty">${tr('weaponResult.noData', 'No data')}</div>`;

  const W = 380;
  const H = 150;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const xMax = Math.min(maxX + 5, cap);

  let svg = `<svg class="term-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  for (let tick = 0; tick <= 4; tick++) {
    const yVal = Math.round(maxY * tick / 4);
    const y = padT + chartH - (chartH * tick / 4);
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#2e3347" stroke-width="0.5"/>`;
    svg += `<text x="${padL - 4}" y="${y + 3}" text-anchor="end" fill="#8b8fa3" font-size="9" font-family="inherit">${yVal}</text>`;
  }

  const xOf = (index) => padL + (index / xMax) * chartW;
  const yOf = (count) => padT + chartH - (count / maxY) * chartH;
  const baseY = yOf(0);
  const points = [];
  for (let i = 0; i <= xMax; i++) {
    const count = counts[i] || 0;
    if (count > 0) points.push({ x: xOf(i), y: yOf(count), count });
  }

  if (points.length > 0) {
    const linePath = points.reduce((path, point, index) => (
      index === 0 ? `M${point.x},${point.y}` : `${path} L${point.x},${point.y}`
    ), '');
    const areaPath = `${linePath} L${points[points.length - 1].x},${baseY} L${points[0].x},${baseY} Z`;
    svg += `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.6"/><stop offset="100%" stop-color="${color}" stop-opacity="0.05"/></linearGradient></defs>`;
    svg += `<path d="${areaPath}" fill="url(#${gradId})" fill-opacity="0.3"/>`;
    svg += `<path d="${linePath}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    points.forEach((point) => {
      svg += `<circle cx="${point.x}" cy="${point.y}" r="${point.count / maxY > 0.1 ? 2.5 : 1.5}" fill="${color}"/>`;
    });
  }

  const xLabelStep = xMax <= 10 ? 1 : xMax <= 50 ? 5 : xMax <= 100 ? 10 : xMax <= 200 ? 20 : xMax <= 300 ? 50 : 100;
  for (let i = 0; i <= xMax; i += xLabelStep) {
    const x = padL + (i / (xMax + 1)) * chartW;
    svg += `<text x="${x}" y="${H - 20}" text-anchor="middle" fill="#8b8fa3" font-size="9" font-family="inherit">${i}</text>`;
  }
  svg += `<text x="${padL + chartW / 2}" y="${H - 8}" text-anchor="middle" fill="#8b8fa3" font-size="8" font-family="inherit">${tr('weaponResult.countAxis', 'count')}</text>`;
  svg += '</svg>';

  return `<div class="term-chart">${svg}</div>`;
}

function renderCumulativeProbChart(counts, totalTrials, gradId) {
  if (!counts || counts.length === 0 || totalTrials === 0) return '';

  let maxCopies = 0;
  for (let i = counts.length - 1; i >= 0; i--) {
    if (counts[i] > 0) {
      maxCopies = i;
      break;
    }
  }
  if (maxCopies === 0) return `<div class="term-chart-empty">${tr('weaponResult.noRateUpCopies', 'No rate-up copies obtained')}</div>`;

  const cumulativeProb = new Array(maxCopies + 1);
  let cumulativeCount = totalTrials;
  for (let i = 0; i <= maxCopies; i++) {
    cumulativeProb[i] = cumulativeCount / totalTrials;
    cumulativeCount -= counts[i] || 0;
  }

  const W = 380;
  const H = 160;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 50;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const xOf = (index) => padL + ((index - 0.5) / maxCopies) * chartW;
  const yOf = (prob) => padT + chartH - prob * chartH;

  let svg = `<svg class="term-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  [0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
    const y = yOf(tick);
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#2e3347" stroke-width="0.5"/>`;
    svg += `<text x="${padL - 4}" y="${y + 3}" text-anchor="end" fill="#8b8fa3" font-size="9" font-family="inherit">${Math.round(tick * 100)}%</text>`;
  });

  const color = '#ffd700';
  const points = [];
  for (let i = 1; i <= maxCopies; i++) {
    points.push({ x: xOf(i), y: yOf(cumulativeProb[i]), prob: cumulativeProb[i], i });
  }

  if (points.length > 0) {
    let linePath = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      linePath += ` L${points[i].x},${points[i - 1].y} L${points[i].x},${points[i].y}`;
    }

    const baseY = yOf(0);
    const areaPath = `${linePath} L${points[points.length - 1].x},${baseY} L${points[0].x},${baseY} Z`;
    svg += `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.6"/><stop offset="100%" stop-color="${color}" stop-opacity="0.05"/></linearGradient></defs>`;
    svg += `<path d="${areaPath}" fill="url(#${gradId})" fill-opacity="0.3"/>`;
    svg += `<path d="${linePath}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    points.forEach((point) => {
      svg += `<circle cx="${point.x}" cy="${point.y}" r="2.5" fill="${color}"/>`;
    });
  }

  const labelStep = maxCopies > 12 ? Math.ceil(maxCopies / 10) : 1;
  for (let i = 1; i <= maxCopies; i++) {
    if (i % labelStep !== 0 && i !== 1 && i !== maxCopies) continue;
    const x = xOf(i);
    const pct = cumulativeProb[i] * 100;
    const pctLabel = pct >= 99.95 ? '≥99.9%' : pct < 0.1 ? '<0.1%' : `${pct.toFixed(1)}%`;
    svg += `<text x="${x}" y="${H - 28}" text-anchor="middle" fill="#8b8fa3" font-size="9" font-family="inherit">${i}</text>`;
    svg += `<text x="${x}" y="${H - 17}" text-anchor="middle" fill="${color}" font-size="7.5" font-family="inherit" font-weight="600">${pctLabel}</text>`;
  }
  svg += `<text x="${padL + chartW / 2}" y="${H - 4}" text-anchor="middle" fill="#8b8fa3" font-size="8" font-family="inherit">${tr('weaponResult.atLeastAxis', '≥ N rate-up copies')}</text>`;
  svg += '</svg>';

  return `<div class="term-chart">${svg}</div>`;
}

function initBannerTabs(win) {
  const inspector = win.querySelector('.banner-inspector');
  if (!inspector) return;

  inspector.addEventListener('click', (event) => {
    const tab = event.target.closest('.banner-tab');
    if (!tab) return;
    const idx = tab.dataset.tab;
    inspector.querySelectorAll('.banner-tab').forEach((item) => item.classList.remove('active'));
    inspector.querySelectorAll('.banner-tab-panel').forEach((panel) => panel.classList.add('hidden'));
    tab.classList.add('active');
    inspector.querySelector(`[data-panel="${idx}"]`).classList.remove('hidden');
  });
}

function statRow(label, value, colorClass = '', span = false, tipText = '', popupKey = '') {
  const tipAttr = tipText ? ` data-tip="${escapeHtml(tipText)}"` : '';
  const tipClass = tipText ? ' has-tip' : '';
  const popupAttr = popupKey ? ` data-dist-key="${popupKey}" tabindex="0" role="button" aria-haspopup="dialog"` : '';
  const valueClass = popupKey ? ' stat-value-clickable' : '';
  return `<div class="stat-row${span ? ' span-2' : ''}"${tipAttr}><span class="stat-label${tipClass}">${label}${tipText ? ' <span class="tip-icon">?</span>' : ''}</span><span class="stat-value${colorClass ? ` ${colorClass}` : ''}${valueClass}"${popupAttr}>${value}</span></div>`;
}

function renderSampleInspector(sampleLog) {
  if (!sampleLog || sampleLog.length === 0) return '';

  const groups = new Map();
  sampleLog.forEach((entry) => {
    if (!groups.has(entry.tenPullNum)) groups.set(entry.tenPullNum, []);
    groups.get(entry.tenPullNum).push(entry);
  });

  const keys = Array.from(groups.keys()).sort((a, b) => a - b).slice(0, 10);
  let html = `<h3>${tr('weaponResult.sampleInspector', 'Sample Trial Inspector')}</h3><div class="banner-inspector">`;
  html += '<div class="banner-tabs">';
  keys.forEach((key, index) => {
    const pulls = groups.get(key);
    const hasSixStar = pulls.some((pull) => pull.outcome === SIX_STAR_RATE_UP || pull.outcome === SIX_STAR_NON_RATE_UP);
    const hasRateUp = pulls.some((pull) => pull.outcome === SIX_STAR_RATE_UP);
    const hasMilestone = pulls.some((pull) => pull.milestone);
    const tabClass = hasRateUp ? 'has-rateup' : (hasSixStar ? 'has-six' : '');
    html += `<button class="banner-tab ${index === 0 ? 'active' : ''} ${tabClass}" data-tab="${index}">${trTpl('weaponResult.tenPullTab', '10p #{num}', { num: key })}${hasMilestone ? ' 🎁' : ''}</button>`;
  });
  html += '</div>';

  keys.forEach((key, index) => {
    const pulls = groups.get(key);
    const sixCount = pulls.filter((pull) => pull.outcome === SIX_STAR_RATE_UP || pull.outcome === SIX_STAR_NON_RATE_UP).length;
    const milestone = pulls.find((pull) => pull.milestone);
    html += `<div class="banner-tab-panel ${index === 0 ? '' : 'hidden'}" data-panel="${index}">`;
    html += `<div class="banner-summary"><span>${trTpl('weaponResult.tenPullSummary', '10-pull #{num}', { num: key })}</span><span class="sep">·</span><span>${trTpl('weaponResult.pullsRange', 'Pulls {start}-{end}', { start: (key - 1) * 10 + 1, end: key * 10 })}</span>`;
    if (sixCount > 0) html += `<span class="sep">·</span><span class="gold">${sixCount}× 6★</span>`;
    if (milestone?.milestone === 'selector') html += `<span class="sep">·</span><span class="milestone-badge selector">🎯 ${tr('weaponResult.selector', 'Selector')}</span>`;
    if (milestone?.milestone === 'rateup') html += `<span class="sep">·</span><span class="milestone-badge rateup">⭐ ${tr('weaponResult.rateUpReward', 'Rate-Up')}</span>`;
    html += '</div><div class="pull-log">';
    pulls.forEach((pull) => {
      const outcomeClass = OUTCOME_CLASSES[pull.outcome];
      const notable = pull.outcome >= 1 ? ' notable' : '';
      html += `<div class="pull-entry ${outcomeClass}${notable}">`;
      html += `<span class="pull-num">#${pull.pullNum}</span>`;
      html += `<span class="pull-outcome ${outcomeClass}">${outcomeLabel(pull.outcome)}</span>`;
      if (pull.forced) html += `<span class="forced-badge">${tr('weaponResult.guaranteed', 'GUARANTEED')}</span>`;
      if (pull.milestone === 'selector') html += `<span class="milestone-badge selector">${tr('weaponResult.selector', 'Selector')}</span>`;
      if (pull.milestone === 'rateup') html += `<span class="milestone-badge rateup">${tr('weaponResult.rateUpReward', 'Rate-Up')}</span>`;
      html += '</div>';
    });
    html += '</div></div>';
  });

  html += '</div>';
  return html;
}

function displayResults(win, results, config, sampleLog, tenPullCounts, rateUpCopyCounts) {
  const resultsContent = win.querySelector('.results-content');
  resultsContent.classList.remove('hidden');
  const n = results.length;

  const isCopiesMode = config.mode === 'copies';
  let sum4 = 0;
  let sum5 = 0;
  let sumRateUp = 0;
  let sumNonRateUp = 0;
  let sumSelectors = 0;
  let sumRateUpRewards = 0;
  let sumAic = 0;
  let sumTenPulls = 0;
  let sumG40 = 0;
  let sumG80 = 0;

  results.forEach((result) => {
    sum4 += result.total4Star;
    sum5 += result.total5Star;
    sumRateUp += result.total6StarRateUp;
    sumNonRateUp += result.total6StarNonRateUp;
    sumSelectors += result.selectorRewards;
    sumRateUpRewards += result.rateUpRewards;
    sumAic += result.aicQuota;
    sumTenPulls += result.tenPulls;
    if (result.guarantee40Triggered) sumG40++;
    if (result.guarantee80Triggered) sumG80++;
  });

  const avg4 = sum4 / n;
  const avg5 = sum5 / n;
  const avgRateUp = sumRateUp / n;
  const avgNonRateUp = sumNonRateUp / n;
  const avgTotal6 = (sumRateUp + sumNonRateUp) / n;
  const avgSelectors = sumSelectors / n;
  const avgRateUpRewards = sumRateUpRewards / n;
  const avgAic = sumAic / n;
  const avgTenPulls = sumTenPulls / n;
  const avgTickets = avgTenPulls * 1980;
  const avgTotalRateUp = avgRateUp + avgRateUpRewards;
  const aicFrom5 = sum5 * 10 / n;
  const aicFrom6 = (sumRateUp + sumNonRateUp) * 50 / n;
  const formatFixed = (digits = 2) => (value) => value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  const formatInteger = (value) => Math.round(value).toLocaleString();
  const formatPercent = (value) => `${value.toFixed(1).replace(/\.0$/, '')}%`;
  const titleOf = (sectionTitle, label) => `${sectionTitle} - ${label}`;
  const weaponsTitle = tr('weaponResult.weapons', 'Weapons');
  const milestonesTitle = tr('weaponResult.milestones', 'Milestone Rewards');
  const guaranteesTitle = tr('weaponResult.guarantees', 'Guarantees');
  const aicTitle = tr('weaponResult.aicQuota', 'AIC Quota');
  const metricMap = new Map();
  const addMetric = (key, title, getValues, formatValue) => {
    metricMap.set(key, createDistributionMetric(title, getValues, formatValue));
    return key;
  };
  const total6For = (result) => result.total6StarRateUp + result.total6StarNonRateUp;
  const aicFrom5For = (result) => result.total5Star * 10;
  const aicFrom6For = (result) => total6For(result) * 50;

  let html = `<h3>${tr('weaponResult.parameters', 'Parameters')}</h3><div class="stat-grid">`;
  html += statRow(tr('weaponResult.labelTrials', 'Trials'), config.numTrials.toLocaleString());
  html += statRow(tr('weaponResult.labelMode', 'Mode'), isCopiesMode ? tr('weaponResult.modeCopies', 'Target Copies') : tr('weaponResult.modePulls', 'Fixed 10-pulls'));
  html += statRow(
    isCopiesMode ? tr('weaponResult.labelTargetCopies', 'Target Copies') : tr('weaponResult.labelTenPulls', '10-pulls'),
    String(isCopiesMode ? config.targetCopies : config.tenPulls),
  );
  if (config.seed != null) html += statRow(tr('weaponResult.labelSeed', 'Seed'), String(config.seed));
  html += '</div>';

  html += `<h3>${tr('weaponResult.keyStats', 'Key Statistics')}</h3><div class="paid-pulls-hero">`;
  if (isCopiesMode) {
    const meanTenPullsMetric = addMetric('hero-mean-ten-pulls', titleOf(tr('weaponResult.keyStats', 'Key Statistics'), tr('weaponResult.meanTenPulls', 'Mean 10-pulls')), () => results.map((result) => result.tenPulls), formatFixed(1));
    const meanTicketsMetric = addMetric('hero-mean-tickets', titleOf(tr('weaponResult.keyStats', 'Key Statistics'), tr('weaponResult.meanTickets', 'Mean Tickets')), () => results.map((result) => result.tenPulls * 1980), formatInteger);
    html += `<div class="hero-stat has-tip" data-tip="${escapeHtml(weaponTip('meanTenPulls'))}"><div class="hero-num stat-value-clickable" data-dist-key="${meanTenPullsMetric}" tabindex="0" role="button" aria-haspopup="dialog">${avgTenPulls.toFixed(1)}</div><div class="hero-label">${tr('weaponResult.meanTenPulls', 'Mean 10-pulls')} <span class="tip-icon">?</span></div></div>`;
    html += `<div class="hero-stat has-tip" data-tip="${escapeHtml(weaponTip('meanTickets'))}"><div class="hero-num stat-value-clickable" data-dist-key="${meanTicketsMetric}" tabindex="0" role="button" aria-haspopup="dialog">${Math.round(avgTickets).toLocaleString()}</div><div class="hero-label">${tr('weaponResult.meanTickets', 'Mean Tickets')} <span class="tip-icon">?</span></div></div>`;
  } else {
    const ticketCostMetric = addMetric('hero-ticket-cost', titleOf(tr('weaponResult.keyStats', 'Key Statistics'), tr('weaponResult.ticketCost', 'Ticket Cost')), () => results.map(() => config.tenPulls * 1980), formatInteger);
    const meanAicMetric = addMetric('hero-mean-aic', titleOf(tr('weaponResult.keyStats', 'Key Statistics'), tr('weaponResult.meanAicQuota', 'Mean AIC Quota')), () => results.map((result) => result.aicQuota), formatFixed(1));
    const meanRateUpMetric = addMetric('hero-mean-rate-up', titleOf(tr('weaponResult.keyStats', 'Key Statistics'), tr('weaponResult.meanRateUpSix', 'Mean 6★ Rate-Up')), () => results.map((result) => result.total6StarRateUp + result.rateUpRewards), formatFixed(2));
    html += `<div class="hero-stat has-tip" data-tip="${escapeHtml(weaponTip('ticketCost'))}"><div class="hero-num stat-value-clickable" data-dist-key="${ticketCostMetric}" tabindex="0" role="button" aria-haspopup="dialog">${(config.tenPulls * 1980).toLocaleString()}</div><div class="hero-label">${tr('weaponResult.ticketCost', 'Ticket Cost')} <span class="tip-icon">?</span></div></div>`;
    html += `<div class="hero-stat has-tip" data-tip="${escapeHtml(weaponTip('meanAicQuota'))}"><div class="hero-num stat-value-clickable" data-dist-key="${meanAicMetric}" tabindex="0" role="button" aria-haspopup="dialog">${avgAic.toFixed(1)}</div><div class="hero-label">${tr('weaponResult.meanAicQuota', 'Mean AIC Quota')} <span class="tip-icon">?</span></div></div>`;
    html += `<div class="hero-stat has-tip" data-tip="${escapeHtml(weaponTip('meanRateUpSix'))}"><div class="hero-num stat-value-clickable" data-dist-key="${meanRateUpMetric}" tabindex="0" role="button" aria-haspopup="dialog">${avgTotalRateUp.toFixed(2)}</div><div class="hero-label">${tr('weaponResult.meanRateUpSix', 'Mean 6★ Rate-Up')} <span class="tip-icon">?</span></div></div>`;
  }
  html += '</div>';

  if (isCopiesMode) {
    const tenPullDistributionMetric = addMetric('ten-pull-distribution', titleOf(tr('weaponResult.tenPullDistribution', '10-Pull Distribution'), tr('weaponResult.tenPullDistribution', '10-Pull Distribution')), () => results.map((result) => result.tenPulls), formatInteger);
    html += `<h3>${tr('weaponResult.tenPullDistribution', '10-Pull Distribution')}</h3>`;
    html += `<div data-dist-chart-key="${tenPullDistributionMetric}"></div>`;
  }

  const fourStarLabel = tr('weaponResult.fourStarMean', '4★ mean');
  const fiveStarLabel = tr('weaponResult.fiveStarMean', '5★ mean');
  const rateUpLabel = tr('weaponResult.rateUpMean', '6★ rate-up mean');
  const nonRateUpLabel = tr('weaponResult.nonRateUpMean', '6★ non-rate-up mean');
  const total6Label = tr('weaponResult.total6Mean', '6★ total mean');
  html += `<h3>${weaponsTitle}</h3><div class="stat-grid">`;
  html += statRow(fourStarLabel, avg4.toFixed(2), '', false, weaponTip('avg4'), addMetric('weapon-four-star', titleOf(weaponsTitle, fourStarLabel), () => results.map((result) => result.total4Star), formatInteger));
  html += statRow(fiveStarLabel, avg5.toFixed(2), 'blue', false, weaponTip('avg5'), addMetric('weapon-five-star', titleOf(weaponsTitle, fiveStarLabel), () => results.map((result) => result.total5Star), formatInteger));
  html += statRow(rateUpLabel, avgRateUp.toFixed(2), 'gold', false, weaponTip('avgRateUp'), addMetric('weapon-rate-up', titleOf(weaponsTitle, rateUpLabel), () => results.map((result) => result.total6StarRateUp), formatInteger));
  html += statRow(nonRateUpLabel, avgNonRateUp.toFixed(2), 'purple', false, weaponTip('avgNonRateUp'), addMetric('weapon-non-rate-up', titleOf(weaponsTitle, nonRateUpLabel), () => results.map((result) => result.total6StarNonRateUp), formatInteger));
  html += statRow(total6Label, avgTotal6.toFixed(2), 'gold', false, weaponTip('avgTotal6'), addMetric('weapon-total-six', titleOf(weaponsTitle, total6Label), () => results.map(total6For), formatInteger));
  html += '</div>';

  const selectorsLabel = tr('weaponResult.selectorsMean', '6★ Selectors mean');
  const rateUpRewardsLabel = tr('weaponResult.rateUpRewardsMean', '6★ Rate-Up Rewards mean');
  html += `<h3>${milestonesTitle}</h3><div class="stat-grid">`;
  html += statRow(selectorsLabel, avgSelectors.toFixed(2), 'blue', false, weaponTip('avgSelectors'), addMetric('milestones-selector', titleOf(milestonesTitle, selectorsLabel), () => results.map((result) => result.selectorRewards), formatInteger));
  html += statRow(rateUpRewardsLabel, avgRateUpRewards.toFixed(2), 'gold', false, weaponTip('avgRateUpRewards'), addMetric('milestones-rate-up', titleOf(milestonesTitle, rateUpRewardsLabel), () => results.map((result) => result.rateUpRewards), formatInteger));
  html += '</div>';

  const guarantee40Label = tr('weaponResult.guarantee40Label', '40-pull guarantee triggered');
  const guarantee80Label = tr('weaponResult.guarantee80Label', '80-pull guarantee triggered');
  html += `<h3>${guaranteesTitle}</h3><div class="stat-grid">`;
  html += statRow(guarantee40Label, `${(sumG40 / n * 100).toFixed(1)}%`, '', false, weaponTip('guarantee40'), addMetric('guarantee-40', titleOf(guaranteesTitle, guarantee40Label), () => results.map((result) => result.guarantee40Triggered ? 100 : 0), formatPercent));
  html += statRow(guarantee80Label, `${(sumG80 / n * 100).toFixed(1)}%`, '', false, weaponTip('guarantee80'), addMetric('guarantee-80', titleOf(guaranteesTitle, guarantee80Label), () => results.map((result) => result.guarantee80Triggered ? 100 : 0), formatPercent));
  html += '</div>';

  const from5Label = tr('weaponResult.from5', 'From 5★');
  const from6Label = tr('weaponResult.from6', 'From 6★');
  const totalLabel = tr('weaponResult.total', 'Total');
  html += `<h3>${aicTitle}</h3><div class="stat-grid">`;
  html += statRow(from5Label, aicFrom5.toFixed(1), '', false, weaponTip('aicFrom5'), addMetric('aic-from5', titleOf(aicTitle, from5Label), () => results.map(aicFrom5For), formatInteger));
  html += statRow(from6Label, aicFrom6.toFixed(1), '', false, weaponTip('aicFrom6'), addMetric('aic-from6', titleOf(aicTitle, from6Label), () => results.map(aicFrom6For), formatInteger));
  html += statRow(totalLabel, avgAic.toFixed(1), 'blue', false, weaponTip('aicTotal'), addMetric('aic-total', titleOf(aicTitle, totalLabel), () => results.map((result) => result.aicQuota), formatInteger));
  html += '</div>';

  const chartId = pullChartIdCounter++;
  if (isCopiesMode) {
    html += `<h3>${tr('weaponResult.pullDistributionChart', 'Pull Distribution Chart')}</h3>`;
    html += renderPullDistChart(tenPullCounts, '#8aa4ff', `tenPullGrad${chartId}`);
  } else {
    html += `<h3>${tr('weaponResult.cumulativeProbability', 'Cumulative Probability')}</h3>`;
    html += renderCumulativeProbChart(rateUpCopyCounts, results.length, `cumProb${chartId}`);
  }

  html += renderSampleInspector(sampleLog);
  resultsContent.innerHTML = html;
  metricDistributionStore.set(win, metricMap);
  refreshPercentileView(win);
  initBannerTabs(win);
}

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
  el.style.left = `${rect.left}px`;
  el.style.top = '0px';
  const tipRect = el.getBoundingClientRect();
  const top = rect.top - tipRect.height - 6 < 4 ? rect.bottom + 6 : rect.top - tipRect.height - 6;
  const maxLeft = window.innerWidth - tipRect.width - 8;
  el.style.top = `${top}px`;
  el.style.left = `${Math.max(4, Math.min(rect.left, maxLeft))}px`;
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.classList.remove('visible');
}

function resetToDefaults() {
  suppressHashUpdate = true;
  document.getElementById('trials-input').value = 5000;
  document.getElementById('seed-input').value = '';
  document.querySelectorAll('.sim-window').forEach((win) => win.remove());
  windowCounter = 0;
  suppressHashUpdate = false;
  createSimWindow();
}

function copyShareLink() {
  updateHash();
  const btn = document.getElementById('share-btn');
  const restore = () => setShareButtonDefault();

  navigator.clipboard.writeText(window.location.href).then(() => {
    btn.textContent = t('ui.copied');
    setTimeout(restore, 2000);
  }, () => {
    const input = document.createElement('input');
    input.value = window.location.href;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    btn.textContent = t('ui.copied');
    setTimeout(restore, 2000);
  });
}

export function initWeaponPlanner() {
  if (isInitialized) return;
  isInitialized = true;

  const languageSelect = document.getElementById('language-select');
  const lang = initLanguage();
  if (languageSelect) languageSelect.value = lang;
  setShareButtonDefault();

  suppressHashUpdate = true;
  const restored = deserializeState(location.hash);
  if (!restored) createSimWindow();
  suppressHashUpdate = false;
  updateHash();

  document.getElementById('add-window').addEventListener('click', () => createSimWindow());
  document.querySelector('header').addEventListener('input', scheduleHashUpdate);
  document.querySelector('header').addEventListener('change', scheduleHashUpdate);
  document.getElementById('windows-container').addEventListener('input', scheduleHashUpdate);
  document.getElementById('windows-container').addEventListener('change', scheduleHashUpdate);
  document.getElementById('reset-btn').addEventListener('click', resetToDefaults);
  document.getElementById('share-btn').addEventListener('click', copyShareLink);
  if (languageSelect) {
    languageSelect.addEventListener('change', () => {
      setLanguage(languageSelect.value);
      setShareButtonDefault();
      document.querySelectorAll('.sim-window').forEach((win) => {
        const runButton = win.querySelector('.run-btn');
        if (runButton) runButton.textContent = runButton.disabled ? t('ui.running') : t('ui.runSimulation');
        const placeholder = win.querySelector('.results-placeholder');
        if (placeholder) placeholder.textContent = t('ui.runPlaceholder');
      });
    });
  }

  mouseEnterHandler = (event) => {
    if (event.target?.closest?.('.tip-icon')) showTooltip(event.target);
  };
  mouseLeaveHandler = (event) => {
    if (event.target?.closest?.('.tip-icon')) hideTooltip();
  };
  document.addEventListener('mouseenter', mouseEnterHandler, true);
  document.addEventListener('mouseleave', mouseLeaveHandler, true);
}

export function destroyWeaponPlanner() {
  if (!isInitialized) return;
  isInitialized = false;
  if (mouseEnterHandler) document.removeEventListener('mouseenter', mouseEnterHandler, true);
  if (mouseLeaveHandler) document.removeEventListener('mouseleave', mouseLeaveHandler, true);
  mouseEnterHandler = null;
  mouseLeaveHandler = null;
  if (tooltipEl) tooltipEl.remove();
  tooltipEl = null;
}