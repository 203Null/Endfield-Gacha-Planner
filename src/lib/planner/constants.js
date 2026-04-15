export const ORBS_PER_PULL = 500;
export const ORIGEOMETRY_TO_OROBERYL = 75;

export const CURRENCIES = {
  RMB: {
    symbol: '¥',
    name: 'RMB',
    defaults: {
      monthlyCard: 30,
      bundle: 98,
      hardSpendCost: 648,
      hardSpendQty: 350,
      hardSpendCurrency: 'origeometry',
    },
  },
  JPY: {
    symbol: '¥',
    name: 'JPY',
    defaults: {
      monthlyCard: 610,
      bundle: 2200,
      hardSpendCost: 10000,
      hardSpendQty: 242,
      hardSpendCurrency: 'origeometry',
    },
  },
  USD: {
    symbol: '$',
    name: 'USD',
    defaults: {
      monthlyCard: 4.99,
      bundle: 14.99,
      hardSpendCost: 69.99,
      hardSpendQty: 242,
      hardSpendCurrency: 'origeometry',
    },
  },
};

export const STRATEGY_SOURCE = {
  'rate-up': `// Description: Do 10-pulls until the rate-up character is obtained
if (banner.gotRateUp) return 'stop';
return 'pull10';`,
  'rate-up-single': `// Description: Do single pulls until the rate-up character is obtained
if (banner.gotRateUp) return 'stop';
return 'pull1';`,
  'rate-up-plus': `// Description: Do 10-pulls until the rate-up character is obtained, then pull to 30/60 if less than 5 pulls away
if (!banner.gotRateUp) return 'pull10';
const pulls = banner.pullCount;
if (pulls < 30 && 30 - pulls <= 5) return 'pull1';
if (pulls < 60 && 60 - pulls <= 5) return 'pull1';
return 'stop';`,
  'rate-up-then-60': `// Description: Do 10-pulls until the rate-up character is obtained, then pull to 60 if less than 60 pulls made
if (!banner.gotRateUp) return 'pull10';
return banner.pullCount >= 60 ? 'stop' : 'pull10';`,
  'full-collection-optimal': `// Description: Do single-pull until the rate up. If it rate-up is pulled at or after 46 pulls, top up to 60 for headhunting dossier. Best expected cost when targeting 100% characters.
if (banner.gotRateUp) {
  if (banner.pullCount >= 60 || banner.pullCount < 46) return 'stop';
  return 'pull1';
}

return 'pull1';`,
  'null-select': `// Description: Do 10-pulls until near a 6★ pity, then single-pull until the 6*. If it rate-up is pulled at or after 46 pulls, top up to 60 for headhunting dossier. Strategy used by site maker, best balance between ease of pulling & expected cost.
if (banner.gotRateUp) {
  if (banner.pullCount >= 60) return 'stop';
  return banner.pullCount >= 51 ? 'pull1'
    : banner.pullCount >= 46 ? 'pull10'
    : 'stop';
}

if (player.sixStarPity >= 60 || banner.pullCount > 110) return 'pull1';
return 'pull10';`,
  'first-six': `// Description: Do 10-pulls until any 6★ is obtained
const got6 = banner.totalSixStarRateUp + banner.totalSixStarLimited + banner.totalSixStarStandard;
return got6 > 0 ? 'stop' : 'pull10';`,
  'c6': `// Description: Do 10-pulls until 6 copies of rate-up character is obtained (1+5 tokens)
return banner.totalSixStarRateUp >= 6 ? 'stop' : 'pull10';`,
  'skip-alt': `// Description: Skip even-numbered banners, on odd banners, do 10-pulls until rate-up character is obtained
if (banner.serial % 2 === 0) return 'stop';
return banner.gotRateUp ? 'stop' : 'pull10';`,
  '30': `// Description: Do 10-pulls until at least 30 pulls are made
return banner.pullCount >= 30 ? 'stop' : 'pull10';`,
  '60': `// Description: Do 10-pulls until at least 60 pulls are made
return banner.pullCount >= 60 ? 'stop' : 'pull10';`,
  '80': `// Description: Do 10-pulls until at least 80 pulls are made
return banner.pullCount >= 80 ? 'stop' : 'pull10';`,
  'bank-120': `// Description: Start with 160 pulls, +40/banner, pull if bank >= 120, pull until rate-up

// --- Probe: decide whether to pull this banner ---
if (banner.skipProbe) {
  if (banner.serial === 1) {
    player.bank = 160;
  } else {
    player.bank += 40;
  }

  banner.pulling = player.bank >= 120;
  banner.paidPulls = 0;

  return banner.pulling ? 'pull-hold-free' : 'skip-hold-free';
}

// Always consume held free pulls before paid pulls.
if (banner.bonus60Available && banner.pullCount === 0) return 'pullBonus60';
if (banner.welfarePullsRemaining > 0) return 'pull1Free';

if (!banner.pulling) {
  return 'stop';
}

if (banner.gotRateUp) {
  const hhTickets = banner.totalFiveStar * 10 / 25;
  player.bank += hhTickets;
  return 'stop';
}

player.bank--;
banner.paidPulls++;
return 'pull1';`,
};

export const OUTCOME_LABELS = ['4★', '5★', '6★ Rate-Up', '6★ Limited', '6★ Standard'];
export const OUTCOME_CLASSES = ['four-star', 'five-star', 'six-star-rateup', 'six-star-limited', 'six-star-standard'];
export const PULL_TYPE_LABELS = ['Normal', 'Bonus 30', 'Bonus 60', 'Welfare'];
export const PULL_TYPE_CLASSES = ['normal', 'bonus30', 'bonus60', 'welfare'];

export const TOOLTIPS = {
  'w/ MC, Bundle, Hard Spend': 'Buy Monthly Card (use oroberyl only), buy Headhunting Bundle, then repeatedly buy the configured hard-spend package to cover shortfall.',
  '→ HH Ticket': 'Bond Quota converted to HH Ticket at 25 Bond Quota per ticket.',
  '→ HH Ticket/banner': 'HH Ticket earned per banner on average.',
  'AIC Quota from 4★': 'Each 4★ duplicate at max potential → 5 AIC Quota.',
  'AIC Quota from 5★': 'Each 5★ duplicate at max potential → 20 AIC Quota.',
  'AIC Quota': 'Sum of AIC Quota from 4★ and 5★ duplicates. Assumes all operators at max potential.',
  'AIC Quota/banner': 'AIC Quota earned per banner on average.',
};
