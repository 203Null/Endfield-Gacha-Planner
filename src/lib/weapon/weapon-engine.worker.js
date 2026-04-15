if (typeof self !== 'undefined') {
  self.fetch = undefined;
  self.importScripts = undefined;
  self.XMLHttpRequest = undefined;
}

const RATE_6STAR = 0.04;
const RATE_5STAR = 0.15;
const RATE_UP_CHANCE = 0.25;
const GUARANTEE_40_PULL = 40;
const GUARANTEE_80_PULL = 80;
const MILESTONE_FIRST_SELECTOR = 10;
const MILESTONE_FIRST_RATEUP = 18;
const MILESTONE_CYCLE = 8;
const AIC_PER_5STAR = 10;
const AIC_PER_6STAR = 50;
const FOUR_STAR = 0;
const FIVE_STAR = 1;
const SIX_STAR_RATE_UP = 2;
const SIX_STAR_NON_RATE_UP = 3;
const MAX_TEN_PULLS = 500;

function xoshiro128ss(seed) {
  const state = [
    seed >>> 0,
    (seed * 2654435761) >>> 0,
    (seed * 2246822519) >>> 0,
    (seed * 3266489917) >>> 0,
  ];
  if ((state[0] | state[1] | state[2] | state[3]) === 0) state[0] = 1;
  return {
    nextFloat() {
      const result = (((state[1] * 5) << 7 | (state[1] * 5) >>> 25) * 9) >>> 0;
      const temp = state[1] << 9;
      state[2] ^= state[0];
      state[3] ^= state[1];
      state[1] ^= state[2];
      state[0] ^= state[3];
      state[2] ^= temp;
      state[3] = (state[3] << 11 | state[3] >>> 21);
      return (result >>> 0) / 4294967296;
    },
  };
}

function getMilestone(tenPullNum) {
  if (tenPullNum === MILESTONE_FIRST_SELECTOR) return 'selector';
  if (tenPullNum === MILESTONE_FIRST_RATEUP) return 'rateup';
  if (tenPullNum > MILESTONE_FIRST_RATEUP) {
    const past = tenPullNum - MILESTONE_FIRST_RATEUP;
    if (past % MILESTONE_CYCLE === 0) {
      const cycleNum = past / MILESTONE_CYCLE;
      return cycleNum % 2 === 1 ? 'selector' : 'rateup';
    }
  }
  return null;
}

function singlePull(rng, pullNum, state) {
  let outcome;
  let forced = false;

  if (pullNum === GUARANTEE_80_PULL && state.total6StarRateUp === 0) {
    outcome = SIX_STAR_RATE_UP;
    forced = true;
    state.guarantee80Triggered = true;
  } else if (pullNum === GUARANTEE_40_PULL && (state.total6StarRateUp + state.total6StarNonRateUp) === 0) {
    forced = true;
    state.guarantee40Triggered = true;
    outcome = rng.nextFloat() < RATE_UP_CHANCE ? SIX_STAR_RATE_UP : SIX_STAR_NON_RATE_UP;
  } else {
    const roll = rng.nextFloat();
    if (roll < RATE_6STAR) {
      outcome = rng.nextFloat() < RATE_UP_CHANCE ? SIX_STAR_RATE_UP : SIX_STAR_NON_RATE_UP;
    } else if (roll < RATE_6STAR + RATE_5STAR) {
      outcome = FIVE_STAR;
    } else {
      outcome = FOUR_STAR;
    }
  }

  switch (outcome) {
    case FOUR_STAR:
      state.total4Star++;
      break;
    case FIVE_STAR:
      state.total5Star++;
      break;
    case SIX_STAR_RATE_UP:
      state.total6StarRateUp++;
      break;
    case SIX_STAR_NON_RATE_UP:
      state.total6StarNonRateUp++;
      break;
  }

  return { outcome, forced };
}

function runTrial(rng, config, detailed) {
  const state = {
    total4Star: 0,
    total5Star: 0,
    total6StarRateUp: 0,
    total6StarNonRateUp: 0,
    selectorRewards: 0,
    rateUpRewards: 0,
    guarantee40Triggered: false,
    guarantee80Triggered: false,
  };

  const sampleLog = detailed ? [] : null;
  let tenPullsDone = 0;
  const maxTenPulls = config.mode === 'pulls' ? config.tenPulls : MAX_TEN_PULLS;

  for (let tenPullNum = 1; tenPullNum <= maxTenPulls; tenPullNum++) {
    for (let index = 0; index < 10; index++) {
      const pullNum = (tenPullNum - 1) * 10 + index + 1;
      const result = singlePull(rng, pullNum, state);
      if (sampleLog) {
        sampleLog.push({
          pullNum,
          tenPullNum,
          outcome: result.outcome,
          forced: result.forced,
          milestone: index === 9 ? getMilestone(tenPullNum) : null,
        });
      }
    }

    tenPullsDone = tenPullNum;
    const milestone = getMilestone(tenPullNum);
    if (milestone === 'selector') state.selectorRewards++;
    if (milestone === 'rateup') state.rateUpRewards++;

    if (config.mode === 'copies') {
      const totalRateUp = state.total6StarRateUp + state.rateUpRewards;
      if (totalRateUp >= config.targetCopies) break;
    }
  }

  const total6Star = state.total6StarRateUp + state.total6StarNonRateUp;
  return {
    result: {
      tenPulls: tenPullsDone,
      total4Star: state.total4Star,
      total5Star: state.total5Star,
      total6StarRateUp: state.total6StarRateUp,
      total6StarNonRateUp: state.total6StarNonRateUp,
      selectorRewards: state.selectorRewards,
      rateUpRewards: state.rateUpRewards,
      aicQuota: state.total5Star * AIC_PER_5STAR + total6Star * AIC_PER_6STAR,
      guarantee40Triggered: state.guarantee40Triggered,
      guarantee80Triggered: state.guarantee80Triggered,
    },
    sampleLog,
  };
}

self.onmessage = (event) => {
  const { type, config } = event.data;
  if (type !== 'run') return;

  const results = new Array(config.numTrials);
  const batch = Math.max(1, Math.floor(config.numTrials / 50));
  const tenPullCounts = new Uint32Array(MAX_TEN_PULLS + 1);
  const maxCopies = MAX_TEN_PULLS * 10;
  const rateUpCopyCounts = new Uint32Array(maxCopies + 1);
  const baseSeed = config.seed != null ? config.seed : Date.now();
  let sampleLog = null;

  try {
    for (let i = 0; i < config.numTrials; i++) {
      const rng = xoshiro128ss(baseSeed ^ (i * 2654435761 + i));
      const trial = runTrial(rng, config, i === 0);
      results[i] = trial.result;
      if (i === 0) sampleLog = trial.sampleLog;

      if (trial.result.tenPulls <= MAX_TEN_PULLS) tenPullCounts[trial.result.tenPulls]++;
      const totalRateUpCopies = trial.result.total6StarRateUp + trial.result.rateUpRewards;
      if (totalRateUpCopies <= maxCopies) rateUpCopyCounts[totalRateUpCopies]++;

      if (i % batch === 0) {
        self.postMessage({ type: 'progress', progress: (i + 1) / config.numTrials });
      }
    }
  } catch (error) {
    self.postMessage({ type: 'error', error: `Simulation error: ${error.message}` });
    return;
  }

  self.postMessage({ type: 'progress', progress: 1 });
  self.postMessage({
    type: 'done',
    results,
    sampleLog,
    tenPullCounts: Array.from(tenPullCounts),
    rateUpCopyCounts: Array.from(rateUpCopyCounts),
  });
};