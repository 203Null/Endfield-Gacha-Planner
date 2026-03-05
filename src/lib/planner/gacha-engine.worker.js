// Lock down network access — custom strategies have no legitimate need for it
self.fetch = undefined;
self.importScripts = undefined;
self.XMLHttpRequest = undefined;

// Gacha simulation engine — runs inside a Web Worker
// Faithfully mirrors the Go implementation in endfield-gacha-mc

const BASE_SIX_STAR_RATE = 0.008;
const BASE_FIVE_STAR_RATE = 0.08;
const SIX_STAR_SOFT_PITY = 65; // soft pity boost starts on pull 66
const SIX_STAR_SOFT_PITY_BONUS = 0.05;
const SIX_STAR_HARD_PITY = 80;
const FIVE_STAR_PITY = 10;
const RATE_UP_GUARANTEE = 120;

// Pull outcomes
const FOUR_STAR = 0;
const FIVE_STAR = 1;
const SIX_STAR_RATE_UP = 2;
const SIX_STAR_LIMITED = 3;
const SIX_STAR_STANDARD = 4;

// Pull types
const PULL_NORMAL = 0;
const PULL_BONUS30 = 1;
const PULL_BONUS60 = 2;
const PULL_WELFARE = 3;

// --- PRNG: xoshiro128** for speed ---
function xoshiro128ss(seed) {
  let s = [seed >>> 0, (seed * 2654435761) >>> 0, (seed * 2246822519) >>> 0, (seed * 3266489917) >>> 0];
  // Ensure non-zero state
  if ((s[0] | s[1] | s[2] | s[3]) === 0) s[0] = 1;
  return {
    nextFloat() {
      const result = (((s[1] * 5) << 7 | (s[1] * 5) >>> 25) * 9) >>> 0;
      const t = s[1] << 9;
      s[2] ^= s[0];
      s[3] ^= s[1];
      s[1] ^= s[2];
      s[0] ^= s[3];
      s[2] ^= t;
      s[3] = (s[3] << 11 | s[3] >>> 21);
      return (result >>> 0) / 4294967296;
    }
  };
}

function pullRates(nextPullPullsSinceSixStar) {
  const sixStarRate = BASE_SIX_STAR_RATE + SIX_STAR_SOFT_PITY_BONUS * Math.max(0, nextPullPullsSinceSixStar - SIX_STAR_SOFT_PITY);
  const fiveStarRate = sixStarRate + BASE_FIVE_STAR_RATE;
  return { sixStarRate, fiveStarRate };
}

function rollSixStar(rng) {
  if (rng.nextFloat() < 0.5) return SIX_STAR_RATE_UP;
  return rng.nextFloat() < 5.0 / 7.0 ? SIX_STAR_STANDARD : SIX_STAR_LIMITED;
}

function rollSixStarDetailed(rng, cb) {
  const r1 = rng.nextFloat();
  if (r1 < 0.5) { cb(r1, -1); return SIX_STAR_RATE_UP; }
  const r2 = rng.nextFloat();
  cb(r1, r2);
  return r2 < 5.0 / 7.0 ? SIX_STAR_STANDARD : SIX_STAR_LIMITED;
}

function createPlayerState() {
  return {
    sixStarPity: 0,
    fiveStarPity: 0,
    pullCount: 0,
    bonus30PullCount: 0,
    bonus60PullCount: 0,
    welfarePullCount: 0,
    totalFourStar: 0,
    totalFiveStar: 0,
    totalSixStarRateUp: 0,
    totalSixStarLimited: 0,
    totalSixStarStandard: 0,
  };
}

function createBannerState(serial) {
  return {
    serial: serial,
    pullCount: 0,
    bonus30PullCount: 0,
    bonus30FiveStarPity: 0,
    gotRateUp: false,
    bonus30Available: false,
    bonus60Available: false,
    welfarePullsRemaining: 0,
    totalFourStar: 0,
    totalFiveStar: 0,
    totalSixStarRateUp: 0,
    totalSixStarLimited: 0,
    totalSixStarStandard: 0,
  };
}

function singlePull(rng, player, banner, pullType, log, rateUpCounts) {
  const nextPullBanner = banner.pullCount + 1;
  const nextPullSixStarPity = player.sixStarPity + 1;
  const nextPullFiveStarPity = player.fiveStarPity + 1;

  let outcome;
  let rateUpToken = false;
  let effectiveSixStarRate = 0;
  let mainRoll = -1;       // the primary RNG roll
  let sixStarRoll1 = -1;   // 50/50 rate-up roll
  let sixStarRoll2 = -1;   // standard vs limited roll
  let pityForced = false;  // whether pity overrode the roll

  if (nextPullBanner % 240 === 0) {
    rateUpToken = true;
  }

  if (pullType === PULL_BONUS30) {
    banner.bonus30FiveStarPity++;
    effectiveSixStarRate = BASE_SIX_STAR_RATE;
    mainRoll = rng.nextFloat();
    if (mainRoll < BASE_SIX_STAR_RATE) {
      outcome = rollSixStarDetailed(rng, function(r1, r2) { sixStarRoll1 = r1; sixStarRoll2 = r2; });
    } else if (mainRoll < BASE_SIX_STAR_RATE + BASE_FIVE_STAR_RATE) {
      outcome = FIVE_STAR;
    } else if (banner.bonus30FiveStarPity >= 10) {
      pityForced = true;
      outcome = FIVE_STAR;
    } else {
      outcome = FOUR_STAR;
    }
    if (outcome !== FOUR_STAR) {
      banner.bonus30FiveStarPity = 0;
    }
  } else if (nextPullBanner === RATE_UP_GUARANTEE && !banner.gotRateUp) {
    effectiveSixStarRate = 1.0;
    pityForced = true;
    outcome = SIX_STAR_RATE_UP;
  } else if (nextPullSixStarPity === SIX_STAR_HARD_PITY) {
    effectiveSixStarRate = 1.0;
    pityForced = true;
    outcome = rollSixStarDetailed(rng, function(r1, r2) { sixStarRoll1 = r1; sixStarRoll2 = r2; });
  } else {
    const { sixStarRate, fiveStarRate } = pullRates(nextPullSixStarPity);
    effectiveSixStarRate = sixStarRate;
    mainRoll = rng.nextFloat();
    if (mainRoll < sixStarRate) {
      outcome = rollSixStarDetailed(rng, function(r1, r2) { sixStarRoll1 = r1; sixStarRoll2 = r2; });
    } else if (mainRoll < fiveStarRate) {
      outcome = FIVE_STAR;
    } else if (nextPullFiveStarPity >= FIVE_STAR_PITY) {
      pityForced = true;
      outcome = FIVE_STAR;
    } else {
      outcome = FOUR_STAR;
    }
  }

  // Record to log before state changes
  if (log) {
    log.push({
      bannerPull: banner.pullCount + (pullType === PULL_BONUS30 ? 0 : 1),
      pullType,
      outcome,
      rateUpToken,
      sixStarPity: pullType === PULL_BONUS30 ? -1 : nextPullSixStarPity,
      fiveStarPity: pullType === PULL_BONUS30 ? -1 : nextPullFiveStarPity,
      sixStarRate: effectiveSixStarRate,
      mainRoll,
      sixStarRoll1,
      sixStarRoll2,
      pityForced,
    });
  }

  // Track rate-up 6★ by banner pull number
  if (rateUpCounts && outcome === SIX_STAR_RATE_UP) {
    const pullNum = banner.pullCount + (pullType === PULL_BONUS30 ? 0 : 1);
    if (pullNum <= TERMINATION_CAP) rateUpCounts[pullNum]++;
  }

  applyResult(player, banner, outcome, rateUpToken, pullType);
  return { outcome, rateUpToken };
}

function applyResult(player, banner, outcome, rateUpToken, pullType) {
  switch (outcome) {
    case FOUR_STAR:
      player.totalFourStar++; banner.totalFourStar++; break;
    case FIVE_STAR:
      player.totalFiveStar++; banner.totalFiveStar++; break;
    case SIX_STAR_RATE_UP:
      player.totalSixStarRateUp++; banner.totalSixStarRateUp++; banner.gotRateUp = true; break;
    case SIX_STAR_LIMITED:
      player.totalSixStarLimited++; banner.totalSixStarLimited++; break;
    case SIX_STAR_STANDARD:
      player.totalSixStarStandard++; banner.totalSixStarStandard++; break;
  }

  if (rateUpToken) {
    player.totalSixStarRateUp++;
    banner.totalSixStarRateUp++;
  }

  if (banner.pullCount + 1 === 30) {
    banner.bonus30Available = true;
  }

  switch (pullType) {
    case PULL_BONUS30:
      banner.bonus30Available = false;
      player.bonus30PullCount++;
      banner.bonus30PullCount++;
      break;
    case PULL_BONUS60:
      banner.bonus60Available = false;
      player.bonus60PullCount++;
      banner.pullCount++;
      break;
    case PULL_WELFARE:
      banner.welfarePullsRemaining--;
      player.welfarePullCount++;
      banner.pullCount++;
      break;
    case PULL_NORMAL:
      banner.pullCount++;
      player.pullCount++;
      break;
  }

  if (pullType !== PULL_BONUS30) {
    const isSixStar = outcome === SIX_STAR_RATE_UP || outcome === SIX_STAR_LIMITED || outcome === SIX_STAR_STANDARD;
    const isFiveStar = outcome === FIVE_STAR;

    if (isSixStar) {
      player.sixStarPity = 0;
      player.fiveStarPity = 0;
    } else if (isFiveStar) {
      // 5★ does not reset 6★ pity; it advances toward next 6★.
      player.sixStarPity++;
      player.fiveStarPity = 0;
    } else {
      player.sixStarPity++;
      player.fiveStarPity++;
    }
  }
}

function doPulls(rng, player, banner, pullType, count, log, rateUpCounts) {
  for (let i = 0; i < count; i++) {
    singlePull(rng, player, banner, pullType, log, rateUpCounts);
  }
}

// --- Built-in strategies ---
const STRATEGIES = {
  'rate-up': (player, banner) => banner.gotRateUp ? 'stop' : 'pull10',
  'rate-up-single': (player, banner) => banner.gotRateUp ? 'stop' : 'pull1',
  'rate-up-plus': (player, banner) => {
    if (!banner.gotRateUp) return 'pull10';
    const pulls = banner.pullCount;
    let target = 0;
    if (pulls < 30 && 30 - pulls <= 5) target = 30;
    else if (pulls < 60 && 60 - pulls <= 5) target = 60;
    if (target === 0) return 'stop';
    return 'pull1';
  },
  'rate-up-then-60': (player, banner) => {
    if (!banner.gotRateUp) return 'pull10';
    return banner.pullCount >= 60 ? 'stop' : 'pull10';
  },
  'first-six': (player, banner) => {
    return (banner.totalSixStarRateUp + banner.totalSixStarLimited + banner.totalSixStarStandard > 0) ? 'stop' : 'pull10';
  },
  'c6': (player, banner) => {
    if (player.totalSixStarRateUp >= 6) return 'stop';
    return banner.gotRateUp ? 'stop' : 'pull10';
  },
  'skip-alt': (player, banner) => {
    if (banner.serial % 2 === 0) return 'stop';
    return banner.gotRateUp ? 'stop' : 'pull10';
  },
  '30': (player, banner) => banner.pullCount >= 30 ? 'stop' : 'pull10',
  '60': (player, banner) => banner.pullCount >= 60 ? 'stop' : 'pull10',
  '80': (player, banner) => banner.pullCount >= 80 ? 'stop' : 'pull10',
};

const MAX_DETAILED_BANNERS = 10;

const TERMINATION_CAP = 500;

function runTrial(rng, config, strategyFn, detailed, terminationCounts, rateUpCounts) {
  const player = createPlayerState();
  player.sixStarPity = config.startSixStarPity || 0;
  player.fiveStarPity = config.startFiveStarPity || 0;
  let banner = createBannerState(1);
  banner.welfarePullsRemaining = config.welfareFree || 0;
  if (config.startWithCharteredHH) banner.bonus60Available = true;
  let bannersVisited = 0;
  let bannersSkipped = 0;
  const bannerLogs = detailed ? [] : null;
  for (let b = 0; b < config.maxBanners; b++) {
    bannersVisited++;
    const logThis = detailed && b < MAX_DETAILED_BANNERS;
    const log = logThis ? [] : null;

    // Pre-check: probe strategy intent on the fresh banner before any pulls
    if (strategyFn(player, banner) === 'stop') bannersSkipped++;

    // Start-of-banner bonuses
    if (banner.welfarePullsRemaining > 0) doPulls(rng, player, banner, PULL_WELFARE, banner.welfarePullsRemaining, log, rateUpCounts);

    const hadBonus60 = banner.bonus60Available;
    if (banner.bonus60Available) doPulls(rng, player, banner, PULL_BONUS60, 10, log, rateUpCounts);

    // Strategy loop
    banner.bonus30Used = false;
    banner.bonus60Used = hadBonus60;
    let safety = 0;
    while (safety++ < 2000) {
      banner.bonus30Used = banner.bonus30PullCount > 0;
      const decision = strategyFn(player, banner);
      if (decision === 'stop') break;
      if (decision === 'pull1') doPulls(rng, player, banner, PULL_NORMAL, 1, log, rateUpCounts);
      else doPulls(rng, player, banner, PULL_NORMAL, 10, log, rateUpCounts);

      if (banner.bonus30Available) doPulls(rng, player, banner, PULL_BONUS30, 10, log, rateUpCounts);
    }

    if (logThis) {
      bannerLogs.push({
        serial: banner.serial,
        pullCount: banner.pullCount,
        bonus30PullCount: banner.bonus30PullCount,
        gotRateUp: banner.gotRateUp,
        totalFourStar: banner.totalFourStar,
        totalFiveStar: banner.totalFiveStar,
        totalSixStarRateUp: banner.totalSixStarRateUp,
        totalSixStarLimited: banner.totalSixStarLimited,
        totalSixStarStandard: banner.totalSixStarStandard,
        pulls: log,
      });
    }

    // Track per-banner termination pull count
    if (terminationCounts && banner.pullCount <= TERMINATION_CAP) {
      terminationCounts[banner.pullCount]++;
    }

    // Transition
    const oldBanner = banner;
    banner = createBannerState(oldBanner.serial + 1);
    if (oldBanner.pullCount >= 60) banner.bonus60Available = true;
    banner.welfarePullsRemaining = config.welfareFree || 0;
  }

  const result = {
    pullCount: player.pullCount,
    bonus30PullCount: player.bonus30PullCount,
    bonus60PullCount: player.bonus60PullCount,
    welfarePullCount: player.welfarePullCount,
    totalFourStar: player.totalFourStar,
    totalFiveStar: player.totalFiveStar,
    totalSixStarRateUp: player.totalSixStarRateUp,
    totalSixStarLimited: player.totalSixStarLimited,
    totalSixStarStandard: player.totalSixStarStandard,
    bannersVisited,
    bannersSkipped,
  };
  if (detailed) result.bannerLogs = bannerLogs;
  return result;
}

function compileCustomStrategy(code) {
  // Wrap user code into a function body
  return new Function('player', 'banner', code);
}

// --- Worker message handler ---
self.onmessage = function(e) {
  const { type, config, strategyName, customCode } = e.data;

  if (type !== 'run') return;

  let strategyFn;
  if (strategyName === 'custom') {
    try {
      strategyFn = compileCustomStrategy(customCode);
    } catch (err) {
      self.postMessage({ type: 'error', error: `Strategy compile error: ${err.message}` });
      return;
    }
  } else {
    strategyFn = STRATEGIES[strategyName];
    if (!strategyFn) {
      self.postMessage({ type: 'error', error: `Unknown strategy: ${strategyName}` });
      return;
    }
  }

  const numTrials = config.numTrials;
  const results = new Array(numTrials);
  const BATCH = Math.max(1, Math.floor(numTrials / 50));

  // Track per-pull termination counts (index = cumulative pull count, value = number of trials)
  const terminationCounts = new Uint32Array(TERMINATION_CAP + 1);
  const rateUpCounts = new Uint32Array(TERMINATION_CAP + 1);

  let sampleBannerLogs = null;
  try {
    for (let i = 0; i < numTrials; i++) {
      const baseSeed = config.seed != null ? config.seed : Date.now();
      const rng = xoshiro128ss(baseSeed ^ (i * 2654435761 + i));
      const detailed = (i === 0);
      results[i] = runTrial(rng, config, strategyFn, detailed, terminationCounts, rateUpCounts);

      if (detailed && results[i].bannerLogs) {
        sampleBannerLogs = results[i].bannerLogs;
        delete results[i].bannerLogs;
      }

      if (i % BATCH === 0) {
        self.postMessage({ type: 'progress', progress: (i + 1) / numTrials });
      }
    }
  } catch (err) {
    self.postMessage({ type: 'error', error: `Simulation error: ${err.message}` });
    return;
  }

  self.postMessage({ type: 'progress', progress: 1 });
  self.postMessage({ type: 'done', results, sampleBannerLogs, terminationCounts: Array.from(terminationCounts), rateUpCounts: Array.from(rateUpCounts) });
};
