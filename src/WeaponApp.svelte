<script>
  import { onMount } from 'svelte';
  import { initWeaponPlanner, destroyWeaponPlanner } from './lib/weapon/runtime.js';

  onMount(() => {
    initWeaponPlanner();
    return () => destroyWeaponPlanner();
  });
</script>

<header data-page-title-key="ui.weaponTitle">
  <div class="header-row-top">
    <div class="header-title">
      <h1><a href="https://endfield-gacha.exe.xyz/weapon.html" class="title-link" data-i18n="ui.weaponTitle">Endfield Weapon Sadness Simulator</a></h1>
      <a href="https://www.reddit.com/user/shasderias/" class="author-link" target="_blank" rel="noopener noreferrer">/u/shasderias</a>
      <a href="https://github.com/203Null" class="author-link" target="_blank" rel="noopener noreferrer">203Null</a>
    </div>
    <div class="header-actions">
      <nav class="page-switch" aria-label="Planner pages">
        <a href="index.html" class="page-switch-link" data-i18n="ui.character">Character</a>
        <a href="weapon.html" class="page-switch-link active" data-i18n="ui.weapon">Weapon</a>
      </nav>
      <select id="language-select" class="language-select" aria-label="Language">
        <option value="en">English</option>
        <option value="zh">中文</option>
      </select>
    </div>
  </div>

  <div class="top-config-grid compact-toolbar">
    <section class="config-card">
      <h3 data-i18n="ui.simulation">Simulation</h3>
      <label class="field has-tip" data-i18n-tip="weaponTip.trials" data-tip="How many times to re-run the entire simulation to get stable averages.">
        <span><span data-i18n="ui.trials">Trials</span> <span class="tip-icon">?</span></span>
        <input type="number" id="trials-input" value="5000" min="100" max="100000" step="100" />
      </label>
      <label class="field has-tip" data-i18n-tip="weaponTip.seed" data-tip="RNG seed for reproducible results. Leave blank for random. Same seed + same settings = same results.">
        <span><span data-i18n="ui.seed">Seed</span> <span class="tip-icon">?</span></span>
        <input type="number" id="seed-input" data-i18n-placeholder="ui.random" placeholder="random" min="0" max="4294967295" />
      </label>
    </section>

    <section class="config-card actions-card">
      <h3 data-i18n="ui.actions">Actions</h3>
      <button id="share-btn" data-i18n-title="ui.share" title="Copy shareable link to clipboard"><span class="btn-label" data-i18n="ui.share">Share</span></button>
      <button id="reset-btn" data-i18n-title="ui.reset" title="Reset all settings to defaults"><span class="btn-label" data-i18n="ui.reset">Reset</span></button>
      <button id="add-window" data-i18n-title="ui.add" title="Add comparison window"><span class="btn-label" data-i18n="ui.add">+ Add</span></button>
    </section>
  </div>
</header>

<main id="windows-container"></main>

<template id="sim-window-template">
  <div class="sim-window">
    <div class="window-header">
      <span class="window-title">#1</span>
      <div class="window-header-actions">
        <button class="window-export" title="Export as JPEG">JPG</button>
        <button class="window-close" title="Close">×</button>
      </div>
    </div>

    <div class="window-body">
      <div class="config-panel">
        <div class="mode-row config-row">
          <span class="has-tip" data-i18n-tip="weaponTip.mode" data-tip="Target Copies: simulate until you obtain N rate-up 6★ copies. Fixed 10-pulls: simulate a fixed number of 10-pulls."><span data-i18n="weaponUi.mode">Mode</span> <span class="tip-icon">?</span></span>
          <select class="mode-select" aria-label="Mode">
            <option value="copies" data-i18n="weaponUi.modeCopies">Target Copies</option>
            <option value="pulls" data-i18n="weaponUi.modePulls">Fixed 10-pulls</option>
          </select>
        </div>

        <div class="mode-input-row config-row hidden" data-mode-input="pulls">
          <span class="has-tip" data-i18n-tip="weaponTip.tenPulls" data-tip="Number of 10-pulls to perform per trial."><span data-i18n="weaponUi.tenPulls">10-pulls</span> <span class="tip-icon">?</span></span>
          <input type="number" class="ten-pulls-input" value="10" min="1" max="500" aria-label="10-pulls" />
        </div>

        <div class="mode-input-row config-row" data-mode-input="copies">
          <span class="has-tip" data-i18n-tip="weaponTip.targetCopies" data-tip="Target number of rate-up weapon copies to obtain (including milestone rewards)."><span data-i18n="weaponUi.targetCopies">Target Copies</span> <span class="tip-icon">?</span></span>
          <input type="number" class="target-copies-input" value="1" min="1" max="50" aria-label="Target Copies" />
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