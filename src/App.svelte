<script>
  import { onMount } from 'svelte';
  import { initPlanner, destroyPlanner } from './lib/planner/runtime.js';

  onMount(() => {
    initPlanner();
    return () => destroyPlanner();
  });
</script>

<header>
  <div class="header-row-top">
    <div class="header-title">
      <h1><a href="https://endfield-gacha.exe.xyz/" class="title-link" data-i18n="ui.title">Endfield Money Bye Bye Planner</a></h1>
      <a href="https://www.reddit.com/user/shasderias/" class="author-link" target="_blank" rel="noopener noreferrer">/u/shasderias</a>
      <a href="https://github.com/203Null" class="author-link" target="_blank" rel="noopener noreferrer">203Null</a>
    </div>
    <div class="header-actions">
      <button id="changelog-btn" data-i18n="ui.changelog" data-i18n-title="ui.changelog" title="Changelog">Changelog</button>
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
        <input type="number" id="welfare-free-pulls" value="5" min="0" max="120" />
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

<div id="changelog-modal" class="modal-overlay hidden">
  <div class="modal-content">
    <div class="modal-header">
      <h2><span data-i18n="ui.changelog">Changelog</span> <span class="changelog-scope" data-i18n="ui.changelogScope">gacha logic changes only</span></h2>
      <button class="modal-close" data-i18n-title="ui.close" title="Close">×</button>
    </div>
    <div class="modal-body">
      <div class="changelog-entry">
        <span class="changelog-date">2026-03-03</span>
        <ul>
          <li><code class="commit-hash">2ad21e4</code> <strong>Fix:</strong> 5★ pulls now correctly advance 6★ pity counter</li>
          <li><code class="commit-hash">1c5979c</code> <strong>Fix:</strong> 6★ soft pity now correctly starts at pull 65</li>
          <li><code class="commit-hash">7473326</code> <strong>Fix:</strong> bonus state now properly exposed to custom strategy functions</li>
        </ul>
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
          <label data-i18n="ui.strategy">Strategy</label>
          <select class="strategy-select">
            <option value="rate-up">Rate-Up 10-pull</option>
            <option value="rate-up-single">Rate-Up 1-pull</option>
            <option value="rate-up-plus">Rate-Up+</option>
            <option value="rate-up-then-60">Rate-Up+60</option>
            <option value="first-six">First 6★</option>
            <option value="c6">Max Pot 5/5</option>
            <option value="skip-alt">Skip Alternate Banners</option>
            <option value="30">Fixed 30</option>
            <option value="60">Fixed 60</option>
            <option value="80">Fixed 80</option>
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

      <div class="results-panel">
        <div class="results-placeholder" data-i18n="ui.runPlaceholder">Run a simulation to see results</div>
        <div class="results-content hidden"></div>
      </div>
    </div>
  </div>
</template>
