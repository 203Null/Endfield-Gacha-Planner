const dictionaries = {
  en: {
    ui: {
      changelog: 'Changelog',
      language: 'Language',
      simulation: 'Simulation',
      initialization: 'Initialization',
      banner: 'Banner',
      topUp: 'Top Up',
      actions: 'Actions',
      trials: 'Trials',
      maxBanners: 'Max Banners',
      charteredHH: 'Chartered HH',
      pity5: '5★ Pity',
      pity6: '6★ Pity',
      seed: 'Seed',
      lengthDays: 'Length (days)',
      welfarePulls: 'Welfare Pulls',
      bannerFree: 'Banner Free',
      currency: 'Currency',
      monthlyCard: 'Monthly Card',
      hhBundle: 'HH Bundle',
      hardSpend: 'Hard Spend',
      oroberyl: 'oroberyl',
      origeometry: 'origeometry',
      for: 'for',
      share: 'Share',
      reset: 'Reset',
      add: '+ Add',
      changelogScope: 'gacha logic changes only',
      close: 'Close',
      strategy: 'Strategy',
      strategyCode: 'Strategy Code (JS)',
      runSimulation: '▶ Run Simulation',
      runPlaceholder: 'Run a simulation to see results',
      customJs: 'Custom (JavaScript)',
      copied: '✓ Copied!',
      running: 'Running…',
      random: 'random',
    },
    tip: {
      trials: 'How many times to re-run the entire simulation to get stable averages.',
      maxBanners: 'How many consecutive banners each trial simulates.',
      charteredHH: 'If checked, the 1st banner starts with the 60-pull bonus already available.',
      pity5: 'Starting 5★ pity for the 1st banner.',
      pity6: 'Starting 6★ pity for the 1st banner.',
      seed: 'RNG seed for reproducible results. Leave blank for random.',
      lengthDays: 'How long each banner lasts.',
      welfarePulls: 'Free, non-limited pulls given per banner (Chartered HH Permit, Oroberyl, and Origeometry)',
      bannerFree: 'Free pulls given at the start of each banner.',
      monthlyCard: 'Price of the Monthly Card in the selected currency.',
      hhBundle: 'Price of the Headhunting Bundle in the selected currency.',
      hardSpend: 'Cost of purchasing pulls when higher value options are exhausted.',
    },
    strategyDesc: {
      'rate-up': 'Do 10-pulls until the rate-up character is obtained',
      'rate-up-single': 'Do single pulls until the rate-up character is obtained',
      'rate-up-plus': 'Do 10-pulls until the rate-up character is obtained, then pull to 30/60 if less than 5 pulls away',
      'rate-up-then-60': 'Do 10-pulls until the rate-up character is obtained, then pull to 60 if less than 60 pulls made',
      'first-six': 'Do 10-pulls until any 6★ is obtained',
      c6: 'Do 10-pulls until 6 copies of rate-up character is obtained (1+5 tokens)',
      'skip-alt': 'Skip even-numbered banners, on odd banners, do 10-pulls until rate-up character is obtained',
      '30': 'Do 10-pulls until at least 30 pulls are made',
      '60': 'Do 10-pulls until at least 60 pulls are made',
      '80': 'Do 10-pulls until at least 80 pulls are made',
    },
    result: {
      sampleTrial: 'Sample Trial — Banner Inspector',
      parameters: 'Parameters',
      banners: 'Banners',
      paidPulls: 'Paid Pulls',
      bonusPulls: 'Bonus Pulls',
      totalPulls: 'Total Pulls',
      characters: 'Characters',
      pullsPerSix: 'Pulls per 6★',
      arsenalTickets: 'Arsenal Tickets',
      quotaExchange: 'Quota Exchange',
      money: 'Money, Money, Money',
      pullDistribution: 'Pull Distribution',
      meanPulls: 'mean pulls',
      pullsBannerAll: 'pulls/banner<br>(all)',
      pullsBannerTarget: 'pulls/banner<br>(target)',
      yes: 'Yes',
      days: 'days',
      perBanner: '/banner',
    },
    resultLabels: {},
  },
  zh: {
    ui: {
      changelog: '更新日志',
      language: '语言',
      simulation: '模拟参数',
      initialization: '初始参数',
      banner: '卡池参数',
      topUp: '氪金参数',
      actions: '操作',
      trials: '模拟次数',
      maxBanners: '模拟卡池数',
      charteredHH: '特许寻访凭证',
      pity5: '5★ 保底',
      pity6: '6★ 保底',
      seed: '随机种子',
      lengthDays: '卡池时长(天)',
      welfarePulls: '卡池福利抽数',
      bannerFree: '卡池免费抽',
      currency: '货币',
      monthlyCard: '月卡',
      hhBundle: '特许寻访礼包',
      hardSpend: '硬氪',
      oroberyl: '嵌晶玉',
      origeometry: '衍质源石',
      for: '可换',
      share: '分享',
      reset: '重置',
      add: '+ 新增',
      changelogScope: '仅含抽卡逻辑改动',
      close: '关闭',
      strategy: '策略',
      strategyCode: '策略代码 (JS)',
      runSimulation: '▶ 开始模拟',
      runPlaceholder: '运行模拟后显示结果',
      customJs: '自定义 (JavaScript)',
      copied: '✓ 已复制!',
      running: '运行中…',
      random: '随机',
    },
    tip: {
      trials: '完整重跑模拟的次数，次数越多平均值越稳定。',
      maxBanners: '每次试验连续模拟的卡池数量。',
      charteredHH: '勾选后，第 1 个卡池默认带有 60 抽奖励状态。',
      pity5: '第 1 个卡池的 5★ 起始保底计数。',
      pity6: '第 1 个卡池的 6★ 起始保底计数。',
      seed: '用于复现结果的随机种子，不填则随机。',
      lengthDays: '每个卡池持续天数。',
      welfarePulls: '每个卡池提供的免费非限定抽（特许寻访凭证、嵌晶玉、衍质源石）。',
      bannerFree: '每个卡池开局赠送的当期免费抽。',
      monthlyCard: '所选货币下的月卡价格。',
      hhBundle: '所选货币下的特许寻访礼包价格。',
      hardSpend: '高性价比选项用完后，继续购买抽数的成本。',
    },
    strategyDesc: {
      'rate-up': '10 连直到获得当期 UP',
      'rate-up-single': '单抽直到获得当期 UP',
      'rate-up-plus': '先 10 连拿到 UP，若离 30/60 抽差 5 抽内则补单抽',
      'rate-up-then-60': '拿到 UP 后补到 60 抽',
      'first-six': '10 连直到任意 6★',
      c6: '10 连直到获得 6 个当期 UP（满潜）',
      'skip-alt': '跳过偶数卡池，仅在奇数卡池抽到 UP 为止',
      '30': '至少抽到 30 抽',
      '60': '至少抽到 60 抽',
      '80': '至少抽到 80 抽',
    },
    result: {
      sampleTrial: '模拟样本',
      parameters: '参数',
      banners: '卡池',
      paidPulls: '付费抽数',
      bonusPulls: '奖励抽数',
      totalPulls: '总抽数',
      characters: '角色统计',
      pullsPerSix: '每个 6★ 所需抽数',
      arsenalTickets: '武库配额',
      quotaExchange: '配额兑换',
      money: '谁有多余资金',
      pullDistribution: '抽数分布',
      meanPulls: '平均抽数',
      pullsBannerAll: '每卡池抽数<br>(全部)',
      pullsBannerTarget: '每卡池抽数<br>(目标)',
      yes: '是',
      days: '天',
      perBanner: '/卡池',
    },
    resultLabels: {
      Trials: '模拟次数',
      'Max Banners': '模拟卡池数',
      'Start with Chartered HH': '起始拥有特许寻访凭证',
      Seed: '随机种子',
      'Starting 5★ Pity': '起始 5★ 保底',
      'Starting 6★ Pity': '起始 6★ 保底',
      'Banner Length': '卡池时长',
      'Welfare Pulls': '卡池福利抽数',
      'Banners Skipped': '跳过卡池数',
      'Banner Specific': '卡池免费抽',
      '30-pull bonus': '30抽奖励 - 十连加急招募',
      '60-pull bonus': '60抽奖励 - 寻访情报书',
      Mean: '平均',
      'Pulls/Banner': '每卡池抽数',
      '4★ /banner': '4★ /卡池',
      '5★ /banner': '5★ /卡池',
      '6★ standard': '6★ 常驻',
      '6★ standard/banner': '6★ 常驻/卡池',
      '6★ rate-up': '6★ 当期 UP',
      '6★ rate-up/banner': '6★ 当期 UP/卡池',
      '6★ limited': '6★ 限定',
      '6★ limited/banner': '6★ 限定/卡池',
      '6★ total': '6★ 总计',
      '6★ total/banner': '6★ 总计/卡池',
      'Paid / rate-up': '付费抽 / 当期 UP',
      'Paid / any 6★': '付费抽 / 任意 6★',
      'From 4★': '来自 4★',
      'From 5★': '来自 5★',
      'From 6★': '来自 6★',
      Total: '总计',
      '→ Arsenal 10-pull': '→ 武库配额 10 连',
      '→ Arsenal 10-pull/banner': '→ 武库配额 10 连/卡池',
      'Bond Quota': '保障配额',
      '→ HH Ticket': '→ 特许寻访凭证',
      '→ HH Ticket/banner': '→ 特许寻访凭证/卡池',
      'AIC Quota from 4★': '集成配额(来自 4★)',
      'AIC Quota from 5★': '集成配额(来自 5★)',
      'AIC Quota': '集成配额',
      '→ Banner HH Ticket': '→ 每期 特许寻访凭证',
      '→ Banner HH Ticket/banner': '→ 每期 特许寻访凭证/卡池',
      'Monthly Card': '月卡',
      'HH Bundle': '特许寻访礼包',
      'Shortfall/banner': '每卡池缺口',
      'Gain/banner': '每卡池盈余',
      'w/ MC': '含月卡',
      'w/ MC, Bundle': '含月卡+礼包',
      'w/ MC, Bundle, Hard Spend': '含月卡+礼包+硬氪',
    },
  },
};

let currentLang = 'en';

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && key in acc ? acc[key] : undefined), obj);
}

export function t(key) {
  const langDict = dictionaries[currentLang] || dictionaries.en;
  return getByPath(langDict, key) ?? getByPath(dictionaries.en, key) ?? key;
}

export function getLanguage() {
  return currentLang;
}

export function setLanguage(lang) {
  currentLang = lang === 'zh' ? 'zh' : 'en';
  try { localStorage.setItem('planner_lang', currentLang); } catch {}
  applyStaticTranslations(document);
}

export function initLanguage() {
  try {
    const saved = localStorage.getItem('planner_lang');
    currentLang = saved === 'zh' ? 'zh' : 'en';
  } catch {
    currentLang = 'en';
  }
  applyStaticTranslations(document);
  return currentLang;
}

export function applyStaticTranslations(root) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
  });

  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.dataset.i18nTitle));
  });

  root.querySelectorAll('[data-i18n-tip]').forEach((el) => {
    el.setAttribute('data-tip', t(el.dataset.i18nTip));
  });
}
