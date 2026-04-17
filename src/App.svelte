<script>
  import { onMount } from 'svelte';
  import { initPlanner, destroyPlanner } from './lib/planner/runtime.js';

  onMount(() => {
    initPlanner();
    return () => destroyPlanner();
  });
</script>

<header data-page-title-key="ui.title">
  <div class="header-row-top">
    <div class="header-title">
      <h1><a href="https://endfield-gacha.exe.xyz/" class="title-link" data-i18n="ui.title">Endfield Money Bye Bye Planner</a></h1>
      <a href="https://www.reddit.com/user/shasderias/" class="author-link" target="_blank" rel="noopener noreferrer">/u/shasderias</a>
      <a href="https://github.com/203Null" class="author-link" target="_blank" rel="noopener noreferrer">203Null</a>
    </div>
    <div class="header-actions">
      <nav class="page-switch" aria-label="Planner pages">
        <a href="index.html" class="page-switch-link active" data-i18n="ui.character">Character</a>
        <a href="weapon.html" class="page-switch-link" data-i18n="ui.weapon">Weapon</a>
      </nav>
      <button id="help-btn" data-i18n-title="ui.help" title="Help">

        <span class="btn-label" data-i18n="ui.apiHelp">API Help</span>
      </button>
      <select id="language-select" class="language-select" aria-label="Language">
        <option value="en">English</option>
        <option value="zh">中文</option>
      </select>
    </div>
  </div>

  <div class="top-config-grid">
    <section class="config-card">
      <h3 data-i18n="ui.simulation">Simulation</h3>
      <label class="field has-tip" data-i18n-tip="tip.trials" data-tip="How many times to re-run the entire simulation to get stable averages.">
        <span><span data-i18n="ui.trials">Trials</span> <span class="tip-icon">?</span></span>
        <input type="number" id="trials-input" value="5000" min="100" max="100000" step="100" />
      </label>
      <label class="field has-tip" data-i18n-tip="tip.maxBanners" data-tip="How many consecutive banners each trial simulates.">
        <span><span data-i18n="ui.maxBanners">Max Banners</span> <span class="tip-icon">?</span></span>
        <input type="number" id="banners-input" value="100" min="1" max="10000" />
      </label>
    </section>

    <section class="config-card">
      <h3 data-i18n="ui.initialization">Initialization</h3>
      <label class="field checkbox-label has-tip" data-i18n-tip="tip.charteredHH" data-tip="If checked, the 1st banner starts with the 60-pull bonus already available.">
        <span><span data-i18n="ui.charteredHH">Chartered HH</span> <span class="tip-icon">?</span></span>
        <input type="checkbox" id="start-chartered-hh" />
      </label>
      <label class="field has-tip" data-i18n-tip="tip.pity5" data-tip="Starting 5★ pity for the 1st banner.">
        <span><span data-i18n="ui.pity5">5★ Pity</span> <span class="tip-icon">?</span></span>
        <input type="number" id="start-5star-pity" value="0" min="0" max="9" />
      </label>
      <label class="field has-tip" data-i18n-tip="tip.pity6" data-tip="Starting 6★ pity for the 1st banner.">
        <span><span data-i18n="ui.pity6">6★ Pity</span> <span class="tip-icon">?</span></span>
        <input type="number" id="start-6star-pity" value="0" min="0" max="79" />
      </label>
      <label class="field has-tip" data-i18n-tip="tip.seed" data-tip="RNG seed for reproducible results. Leave blank for random.">
        <span><span data-i18n="ui.seed">Seed</span> <span class="tip-icon">?</span></span>
        <input type="number" id="seed-input" data-i18n-placeholder="ui.random" placeholder="random" min="0" max="4294967295" />
      </label>
    </section>

    <section class="config-card">
      <h3 data-i18n="ui.banner">Banner</h3>
      <label class="field has-tip" data-i18n-tip="tip.lengthDays" data-tip="How long each banner lasts.">
        <span><span data-i18n="ui.lengthDays">Length (days)</span> <span class="tip-icon">?</span></span>
        <input type="number" id="banner-length" value="17" min="1" max="90" />
      </label>
      <label class="field has-tip" data-i18n-tip="tip.welfarePulls" data-tip="Non-limited pulls given per banner (Chartered HH Permit, Oroberyl, and Origeometry) (Exclude monthly pass, etc)">
        <span><span data-i18n="ui.welfarePulls">Welfare Pulls</span> <span class="tip-icon">?</span></span>
        <input type="number" id="welfare-pulls" value="40" min="0" max="500" />
      </label>
      <label class="field has-tip" data-i18n-tip="tip.bannerFree" data-tip="Free pulls given at the start of each banner.">
        <span><span data-i18n="ui.bannerFree">Banner Free</span> <span class="tip-icon">?</span></span>
        <input type="number" id="welfare-free-pulls" value="10" min="0" max="120" />
      </label>
    </section>

    <section class="config-card">
      <h3 data-i18n="ui.topUp">Top Up</h3>
      <label class="field">
        <span data-i18n="ui.currency">Currency</span>
        <select id="currency-select">
          <option value="JPY">¥ JPY</option>
          <option value="USD">$ USD</option>
          <option value="RMB" selected>¥ RMB</option>
        </select>
      </label>
      <label class="field has-tip" data-i18n-tip="tip.monthlyCard" data-tip="Price of the Monthly Card in the selected currency.">
        <span><span data-i18n="ui.monthlyCard">Monthly Card</span> <span class="tip-icon">?</span></span>
        <input type="number" id="spending-monthly-card" step="0.01" min="0" />
      </label>
      <label class="field has-tip" data-i18n-tip="tip.hhBundle" data-tip="Price of the Headhunting Bundle in the selected currency.">
        <span><span data-i18n="ui.hhBundle">HH Bundle</span> <span class="tip-icon">?</span></span>
        <input type="number" id="spending-bundle" step="0.01" min="0" />
      </label>
      <div class="field hard-spend-field has-tip" data-i18n-tip="tip.hardSpend" data-tip="Cost of purchasing pulls when higher value options are exhausted.">
        <span><span data-i18n="ui.hardSpend">Hard Spend</span> <span class="tip-icon">?</span></span>
        <div class="hard-spend-row">
          <input type="number" id="spending-hard-cost" step="0.01" min="0" />
          <span class="config-word" data-i18n="ui.for">for</span>
          <input type="number" id="spending-hard-qty" step="1" min="0" />
          <select id="spending-hard-currency">
            <option value="oroberyl" data-i18n="ui.oroberyl">oroberyl</option>
            <option value="origeometry" data-i18n="ui.origeometry">origeometry</option>
          </select>
        </div>
      </div>
    </section>

    <section class="config-card actions-card">
      <h3 data-i18n="ui.actions">Actions</h3>
      <button id="share-btn" data-i18n-title="ui.share" title="Copy shareable link to clipboard"><span class="share-icon">🔗</span> <span data-i18n="ui.share">Share</span></button>
      <button id="reset-btn" data-i18n-title="ui.reset" title="Reset all settings to defaults"><span class="action-icon">↺</span> <span data-i18n="ui.reset">Reset</span></button>
      <button id="add-window" data-i18n="ui.add" data-i18n-title="ui.add" title="Add comparison window">+ Add</button>
    </section>
  </div>

</header>

<div id="help-modal" class="modal-overlay hidden">
  <div class="modal-content modal-wide">
    <div class="modal-header">
      <h2 data-i18n="ui.helpTitle">Custom Strategy Reference</h2>
      <button class="modal-close" data-i18n-title="ui.close" title="Close">×</button>
    </div>
    <div class="modal-body help-body">
      <div class="help-tabs">
        <button class="help-tab active" data-help-tab="overview"><span data-i18n="ui.overview">Overview</span></button>
        <button class="help-tab" data-help-tab="fields"><span data-i18n="ui.fields">Fields</span></button>
      </div>

      <div class="help-tab-panel" data-help-panel="overview">
        <p data-i18n-html="help.overviewIntro">A strategy is a JavaScript function that takes <code>player</code> and <code>banner</code> and returns a <strong>decision</strong> string.</p>

        <h3 data-i18n="help.executionFlowTitle">Execution Flow for Each Banner</h3>
        <ol>
          <li data-i18n-html="help.executionStepProbe"><strong>Banner intention probe</strong> — strategy called once to determine whether banner should be considered skipped for statistics purposes.</li>
          <li data-i18n-html="help.executionStepAuto"><strong>Auto spend free pulls</strong> — automatically spend bonus60 and free pulls.</li>
          <li data-i18n-html="help.executionStepLoop"><strong>Strategy loop</strong> — strategy called repeatedly, simulation advances based on decision returned by strategy.</li>
        </ol>

        <h3 data-i18n="help.probeHeading">(1) Banner Intention Probe</h3>
        <table class="help-table">
          <thead><tr><th data-i18n="help.decisionReturned">Decision Returned</th><th data-i18n="help.skipColumn">Skip?</th><th data-i18n="help.freePullsColumn">Free pulls</th></tr></thead>
          <tbody>
            <tr><td><code>'stop'</code></td><td data-i18n="help.yes">Yes</td><td data-i18n="help.autoConsumed">Auto-consumed</td></tr>
            <tr><td><code>'pull1'</code> / <code>'pull10'</code></td><td data-i18n="help.no">No</td><td data-i18n="help.autoConsumed">Auto-consumed</td></tr>
            <tr><td><code>'skip-hold-free'</code></td><td data-i18n="help.yes">Yes</td><td data-i18n="help.strategyControlled">Spent when instructed to by strategy</td></tr>
            <tr><td><code>'pull-hold-free'</code></td><td data-i18n="help.no">No</td><td data-i18n="help.strategyControlled">Spent when instructed to by strategy</td></tr>
          </tbody>
        </table>
        <p class="help-note" data-i18n-html="help.skipNote">"Skip" means the banner's pulls are excluded from the <em>target pull count</em> statistic.</p>

        <h3 data-i18n="help.autoSpendHeading">(2) Auto Spend Free Pulls</h3>
        <p data-i18n-html="help.autoSpendBody">The simulator automatically spends bonus60 and free pulls unless the strategy returns <code>'skip-hold-free'</code> or <code>'pull-hold-free'</code> in step (1).</p>

        <h3 data-i18n="help.loopHeading">(3) Strategy Loop</h3>
        <table class="help-table">
          <thead><tr><th data-i18n="help.decisionReturned">Decision Returned</th><th data-i18n="help.effectColumn">Effect</th></tr></thead>
          <tbody>
            <tr><td><code>'stop'</code></td><td data-i18n="help.loopStop">Stop pulling on this banner. Move to the next banner.</td></tr>
            <tr><td><code>'pullBonus60'</code></td><td data-i18n="help.loopPullBonus60">Use the 10 bonus60 pulls. Must be the first decision when bonus60 is available.</td></tr>
            <tr><td><code>'pull1Free'</code></td><td data-i18n-html="help.loopPull1Free">Use one free pull. Must be used before <code>pull1</code>/<code>pull10</code>.</td></tr>
            <tr><td><code>'pull1'</code></td><td data-i18n="help.loopPull1">Do one paid pull.</td></tr>
            <tr><td><code>'pull10'</code></td><td data-i18n="help.loopPull10">Do ten paid pulls.</td></tr>
          </tbody>
        </table>
        <p class="help-note" data-i18n-html="help.loopNote">When spending free pulls manually, decisions must be used in this order: <code>pullBonus60</code> → <code>pull1Free</code> → <code>pull1</code>/<code>pull10</code>.</p>
      </div>

      <div class="help-tab-panel hidden" data-help-panel="fields">
        <h3 data-i18n-html="help.playerFieldsHeading"><code>player</code> Fields</h3>
        <table class="help-table">
          <thead><tr><th data-i18n="help.fieldColumn">Field</th><th data-i18n="help.typeColumn">Type</th><th data-i18n="help.descriptionColumn">Description</th></tr></thead>
          <tbody>
            <tr><td><code>seed</code></td><td>int</td><td data-i18n="help.playerSeedDesc">The PRNG seed used for this trial.</td></tr>
            <tr><td><code>sixStarPity</code></td><td>int</td><td data-i18n="help.playerSixStarPityDesc">Pulls since last 6★. Soft pity at 66, hard pity at 80.</td></tr>
            <tr><td><code>fiveStarPity</code></td><td>int</td><td data-i18n="help.playerFiveStarPityDesc">Pulls since last 5★ or higher. Guaranteed 5★ at 10.</td></tr>
            <tr><td><code>pullCount</code></td><td>int</td><td data-i18n="help.playerPullCountDesc">Total paid pulls across all banners.</td></tr>
            <tr><td><code>bonus60PullCount</code></td><td>int</td><td data-i18n="help.playerBonus60Desc">Total bonus60 pulls across all banners.</td></tr>
            <tr><td><code>welfarePullCount</code></td><td>int</td><td data-i18n="help.playerWelfareDesc">Total free pulls across all banners.</td></tr>
            <tr><td><code>totalSixStarRateUp</code></td><td>int</td><td data-i18n="help.playerRateUpDesc">Total rate-up 6★ obtained.</td></tr>
            <tr><td><code>totalSixStarLimited</code></td><td>int</td><td data-i18n="help.playerLimitedDesc">Total limited off-banner 6★ obtained.</td></tr>
            <tr><td><code>totalSixStarStandard</code></td><td>int</td><td data-i18n="help.playerStandardDesc">Total standard off-banner 6★ obtained.</td></tr>
            <tr><td><code>totalFiveStar</code></td><td>int</td><td data-i18n="help.playerFiveStarDesc">Total 5★ obtained.</td></tr>
            <tr><td><code>totalFourStar</code></td><td>int</td><td data-i18n="help.playerFourStarDesc">Total 4★ obtained.</td></tr>
          </tbody>
        </table>

        <h3 data-i18n-html="help.bannerFieldsHeading"><code>banner</code> Fields</h3>
        <table class="help-table">
          <thead><tr><th data-i18n="help.fieldColumn">Field</th><th data-i18n="help.typeColumn">Type</th><th data-i18n="help.descriptionColumn">Description</th></tr></thead>
          <tbody>
            <tr><td><code>serial</code></td><td>int</td><td data-i18n="help.bannerSerialDesc">Banner number (1-indexed).</td></tr>
            <tr><td><code>pullCount</code></td><td>int</td><td data-i18n="help.bannerPullCountDesc">Total pulls on this banner (paid + bonus60 + free).</td></tr>
            <tr><td><code>skipProbe</code></td><td>bool</td><td data-i18n-html="help.bannerSkipProbeDesc"><code>true</code> during the banner intention probe.</td></tr>
            <tr><td><code>gotRateUp</code></td><td>bool</td><td data-i18n="help.bannerGotRateUpDesc">Whether the rate-up 6★ has been obtained on this banner.</td></tr>
            <tr><td><code>bonus60Available</code></td><td>bool</td><td data-i18n="help.bannerBonus60AvailableDesc">Whether the 10-pull bonus60 is available.</td></tr>
            <tr><td><code>bonus60Used</code></td><td>bool</td><td data-i18n="help.bannerBonus60UsedDesc">Whether bonus60 has been used.</td></tr>
            <tr><td><code>welfarePullsRemaining</code></td><td>int</td><td data-i18n="help.bannerWelfareRemainingDesc">Free pulls remaining on this banner.</td></tr>
            <tr><td><code>totalSixStarRateUp</code></td><td>int</td><td data-i18n="help.bannerRateUpDesc">Rate-up 6★ obtained on this banner.</td></tr>
            <tr><td><code>totalSixStarLimited</code></td><td>int</td><td data-i18n="help.bannerLimitedDesc">Limited off-banner 6★ obtained on this banner.</td></tr>
            <tr><td><code>totalSixStarStandard</code></td><td>int</td><td data-i18n="help.bannerStandardDesc">Standard off-banner 6★ obtained on this banner.</td></tr>
            <tr><td><code>totalFiveStar</code></td><td>int</td><td data-i18n="help.bannerFiveStarDesc">5★ obtained on this banner.</td></tr>
            <tr><td><code>totalFourStar</code></td><td>int</td><td data-i18n="help.bannerFourStarDesc">4★ obtained on this banner.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<main id="windows-container"></main>

<template id="sim-window-template">
  <div class="sim-window">
    <div class="window-header">
      <span class="window-title">#1</span>
      <div class="window-header-actions">
        <button class="window-export" title="Export as JPEG">📷</button>
        <button class="window-close" title="Close">×</button>
      </div>
    </div>

    <div class="window-body">
      <div class="config-panel">
        <div class="config-row">
          <span data-i18n="ui.strategy">Strategy</span>
          <select class="strategy-select" aria-label="Strategy">
            <option value="rate-up" data-i18n="ui.strategyNameRateUp10">Rate-Up 10-pull</option>
            <option value="rate-up-single" data-i18n="ui.strategyNameRateUp1">Rate-Up 1-pull</option>
            <option value="rate-up-plus" data-i18n="ui.strategyNameRateUpPlus">Rate-Up+</option>
            <option value="rate-up-then-60" data-i18n="ui.strategyNameRateUp60">Rate-Up+60</option>
            <option value="full-collection-optimal" data-i18n="ui.strategyNameFullCollectionOptimal">全图鉴最优</option>
            <option value="null-select" data-i18n="ui.strategyNameNullSelect">Null严选</option>
            <option value="first-six" data-i18n="ui.strategyNameFirst6">First 6★</option>
            <option value="c6" data-i18n="ui.strategyNameMaxPot">Max Pot 5/5</option>
            <option value="skip-alt" data-i18n="ui.strategyNameSkipAlt">Skip Alternate Banners</option>
            <option value="30" data-i18n="ui.strategyNameFixed30">Fixed 30</option>
            <option value="60" data-i18n="ui.strategyNameFixed60">Fixed 60</option>
            <option value="80" data-i18n="ui.strategyNameFixed80">Fixed 80</option>
            <option value="bank-120" data-i18n="ui.strategyNameBank120">Pull when 120 banked</option>
            <option value="custom" data-i18n="ui.customJs">Custom (JavaScript)</option>
          </select>
        </div>

        <div class="strategy-description">Do 10-pulls until the rate-up character is obtained</div>

        <div class="editor-container collapsed">
          <button class="editor-toggle" type="button">
            <span class="editor-toggle-arrow">▶</span>
            <span class="editor-label" data-i18n="ui.strategyCode">Strategy Code (JS)</span>
          </button>
          <div class="editor-collapsible">
            <div class="editor-collapsible-inner">
              <textarea class="strategy-editor" spellcheck="false"></textarea>
            </div>
          </div>
        </div>

        <button class="run-btn" data-i18n="ui.runSimulation">▶ Run Simulation</button>
        <div class="progress-bar-container" style="display:none">
          <div class="progress-bar"></div>
          <span class="progress-text">0%</span>
        </div>
      </div>

      <div class="pctl-slider-container sticky-pctl has-tip hidden" data-i18n-tip="ui.percentileViewTip">
        <div class="pctl-label"><span data-i18n="ui.percentileView">Percentile View</span> <span class="tip-icon">?</span><span data-pctl="sliderLabel">P50</span></div>
        <input type="range" class="pctl-slider" min="1" max="100" value="50" step="1" aria-label="Percentile View" />
        <div class="pctl-ticks"><span>P1</span><span>P25</span><span>P50</span><span>P75</span><span>P100</span></div>
      </div>

      <div class="results-panel">
        <div class="results-placeholder" data-i18n="ui.runPlaceholder">Run a simulation to see results</div>
        <div class="results-content hidden"></div>
      </div>
    </div>
  </div>
</template>
