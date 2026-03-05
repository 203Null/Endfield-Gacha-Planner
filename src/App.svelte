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
      <h1><a href="https://endfield-gacha.exe.xyz/" class="title-link">Endfield Money Bye Bye Planner</a></h1>
      <a href="https://www.reddit.com/user/shasderias/" class="author-link" target="_blank" rel="noopener noreferrer">/u/shasderias</a>
      <a href="https://github.com/203Null" class="author-link" target="_blank" rel="noopener noreferrer">203Null</a>
    </div>
    <div class="header-actions">
      <button id="changelog-btn" title="Changelog">Changelog</button>
    </div>
  </div>

  <div class="top-config-grid">
    <section class="config-card">
      <h3>Simulation</h3>
      <label class="field has-tip" data-tip="How many times to re-run the entire simulation to get stable averages.">
        <span>Trials <span class="tip-icon">?</span></span>
        <input type="number" id="trials-input" value="5000" min="100" max="100000" step="100" />
      </label>
      <label class="field has-tip" data-tip="How many consecutive banners each trial simulates.">
        <span>Max Banners <span class="tip-icon">?</span></span>
        <input type="number" id="banners-input" value="100" min="1" max="10000" />
      </label>
    </section>

    <section class="config-card">
      <h3>Initialization</h3>
      <label class="field checkbox-label has-tip" data-tip="If checked, the 1st banner starts with the 60-pull bonus already available.">
        <span>Chartered HH <span class="tip-icon">?</span></span>
        <input type="checkbox" id="start-chartered-hh" />
      </label>
      <label class="field has-tip" data-tip="Starting 5★ pity for the 1st banner.">
        <span>5★ Pity <span class="tip-icon">?</span></span>
        <input type="number" id="start-5star-pity" value="0" min="0" max="9" />
      </label>
      <label class="field has-tip" data-tip="Starting 6★ pity for the 1st banner.">
        <span>6★ Pity <span class="tip-icon">?</span></span>
        <input type="number" id="start-6star-pity" value="0" min="0" max="79" />
      </label>
      <label class="field has-tip" data-tip="RNG seed for reproducible results. Leave blank for random.">
        <span>Seed <span class="tip-icon">?</span></span>
        <input type="number" id="seed-input" placeholder="random" min="0" max="4294967295" />
      </label>
    </section>

    <section class="config-card">
      <h3>Banner</h3>
      <label class="field has-tip" data-tip="How long each banner lasts.">
        <span>Length (days) <span class="tip-icon">?</span></span>
        <input type="number" id="banner-length" value="17" min="1" max="90" />
      </label>
      <label class="field has-tip" data-tip="Non-limited pulls given per banner (Chartered HH Permit, Oroberyl, and Origeometry) (Exclude monthly pass, etc)">
        <span>Welfare Pulls <span class="tip-icon">?</span></span>
        <input type="number" id="welfare-pulls" value="40" min="0" max="500" />
      </label>
      <label class="field has-tip" data-tip="Free pulls given at the start of each banner.">
        <span>Banner Free <span class="tip-icon">?</span></span>
        <input type="number" id="welfare-free-pulls" value="5" min="0" max="120" />
      </label>
    </section>

    <section class="config-card">
      <h3>Top Up</h3>
      <label class="field">
        <span>Currency</span>
        <select id="currency-select">
          <option value="JPY">¥ JPY</option>
          <option value="USD">$ USD</option>
        </select>
      </label>
      <label class="field has-tip" data-tip="Price of the Monthly Card in the selected currency.">
        <span>Monthly Card <span class="tip-icon">?</span></span>
        <input type="number" id="spending-monthly-card" step="0.01" min="0" />
      </label>
      <label class="field has-tip" data-tip="Price of the Headhunting Bundle in the selected currency.">
        <span>HH Bundle <span class="tip-icon">?</span></span>
        <input type="number" id="spending-bundle" step="0.01" min="0" />
      </label>
      <div class="field hard-spend-field has-tip" data-tip="Cost of purchasing pulls when higher value options are exhausted.">
        <span>Hard Spend <span class="tip-icon">?</span></span>
        <div class="hard-spend-row">
          <input type="number" id="spending-hard-cost" step="0.01" min="0" />
          <span class="config-word">for</span>
          <input type="number" id="spending-hard-qty" step="1" min="0" />
          <select id="spending-hard-currency">
            <option value="oroberyl">oroberyl</option>
            <option value="origeometry">origeometry</option>
          </select>
        </div>
      </div>
    </section>

    <section class="config-card actions-card">
      <h3>Actions</h3>
      <button id="share-btn" title="Copy shareable link to clipboard"><span class="share-icon">🔗</span> Share</button>
      <button id="reset-btn" title="Reset all settings to defaults">Reset</button>
      <button id="add-window" title="Add comparison window">+ Add</button>
    </section>
  </div>
</header>

<div id="changelog-modal" class="modal-overlay hidden">
  <div class="modal-content">
    <div class="modal-header">
      <h2>Changelog <span class="changelog-scope">gacha logic changes only</span></h2>
      <button class="modal-close" title="Close">×</button>
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
          <label>Strategy</label>
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
            <option value="custom">Custom (JavaScript)</option>
          </select>
        </div>

        <div class="strategy-description">Do 10-pulls until the rate-up character is obtained</div>

        <div class="editor-container collapsed">
          <button class="editor-toggle" type="button">
            <span class="editor-toggle-arrow">▶</span>
            <span class="editor-label">Strategy Code (JS)</span>
          </button>
          <div class="editor-collapsible">
            <div class="editor-collapsible-inner">
              <textarea class="strategy-editor" spellcheck="false"></textarea>
            </div>
          </div>
        </div>

        <button class="run-btn">▶ Run Simulation</button>
        <div class="progress-bar-container" style="display:none">
          <div class="progress-bar"></div>
          <span class="progress-text">0%</span>
        </div>
      </div>

      <div class="results-panel">
        <div class="results-placeholder">Run a simulation to see results</div>
        <div class="results-content hidden"></div>
      </div>
    </div>
  </div>
</template>
