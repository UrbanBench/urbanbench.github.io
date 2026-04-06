// satelliteApp.js — Urban-Satellite domain conversation viewer
// Fork of app.js with:
//  1. Default data: ./data/sample_satellite.json
//  2. Satellite image rendering inside tool call cards
//  3. Urban-Satellite task types & tool categories
//  4. simpleTaskId strips "urban_satellite_" prefix

import { loadData, getTaskTypes } from './dataLoader.js';
import { parseMessages } from './messageParser.js';
import { getToolMeta, getAllGroups } from './toolClassifier.js';
import { computeSimulationMetrics } from './benchmarkMetrics.js';
import { formatToolResult } from './resultFormatter.js';

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  data: null,
  filtered: [],
  activeFilters: new Set(),
  selectedId: null,
  modelDataFiles: {},
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const els = {
  loadingOverlay:     () => $('loading-overlay'),
  errorOverlay:       () => $('error-overlay'),
  errorMsg:           () => $('error-msg'),
  filterChips:        () => $('filter-chips'),
  simList:            () => $('simulation-list'),
  simCount:           () => $('sim-count'),
  welcomeScreen:      () => $('welcome-screen'),
  conversationView:   () => $('conversation-view'),
  taskInfoPanel:      () => $('task-info-panel'),
  taskInfoBody:       () => $('task-info-body'),
  taskInfoToggle:     () => $('task-info-toggle'),
  taskInfoId:         () => $('task-info-id'),
  threadContainer:    () => $('thread-container'),
  fileInput:          () => $('file-input'),
  headerMeta:         () => $('header-meta'),
};

// ── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  $('upload-btn').addEventListener('click', () => els.fileInput().click());
  els.fileInput().addEventListener('change', onFileChange);
  $('task-info-header').addEventListener('click', toggleTaskInfoPanel);

  // Try loading dynamic model options
  const urlParams = new URLSearchParams(window.location.search);
  const modelParam = urlParams.get('model');
  const modelSelect = $('model-selector');
  let currentModel = modelParam;

  try {
    const res = await fetch('./data/leaderboard/leaderboard.json');
    if (res.ok) {
      const lbData = await res.json();
      const models = lbData['urban_satellite'] || [];
      if (modelSelect && models.length > 0) {
        modelSelect.innerHTML = '';
        models.forEach(m => {
          const val = (m.filename || '').replace('.json', '');
          if (!val) return;
          state.modelDataFiles[val] = m.data_file || m.filename || `${val}.json`;
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = m.model_name;
          modelSelect.appendChild(opt);
        });
        if (!currentModel || !models.some(m => (m.filename || '').replace('.json', '') === currentModel)) {
          currentModel = (models[0].filename || '').replace('.json', '');
        }
      }
    }
  } catch (err) {
    console.warn('Could not load dynamic models list fallback to default.', err);
  }

  if (!currentModel) currentModel = 'gpt-4.1-mini';

  if (modelSelect) {
    modelSelect.value = currentModel;
    modelSelect.addEventListener('change', (e) => {
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('model', e.target.value);
      window.history.pushState({}, '', newUrl);
      loadModelData(e.target.value);
    });
  }

  loadModelData(currentModel);
});

async function loadModelData(modelName) {
  showLoading();
  const dataFile = state.modelDataFiles[modelName] || `${modelName}.json`;
  try {
    const response = await fetch(`./data/urban_satellite/${dataFile}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    initWithData(json);
  } catch (err) {
    // try fallback sample_satellite.json
    try {
      const resp2 = await fetch('./data/sample_satellite.json');
      if (!resp2.ok) throw new Error();
      const json2 = await resp2.json();
      initWithData(json2);
    } catch {
      console.info(`No data for model ${modelName}:`, err.message);
      hideOverlay();
      showWelcome();
    }
  }
}

// ── Data init ─────────────────────────────────────────────────────────────────
function initWithData(json) {
  try {
    state.data = loadData(json);
    state.activeFilters.clear();
    state.filtered = [...state.data.simulations];
    state.selectedId = null;

    updateHeaderMeta();
    buildFilterChips();
    renderSidebar();
    hideOverlay();
    showWelcome();
  } catch (err) {
    showError(`Failed to parse data: ${err.message}`);
  }
}

// ── File upload ───────────────────────────────────────────────────────────────
function onFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  showLoading();
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result);
      initWithData(json);
    } catch (err) {
      showError(`Invalid JSON: ${err.message}`);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ── Header meta ───────────────────────────────────────────────────────────────
function updateHeaderMeta() {
  const { meta, simulations } = state.data;
  const el = els.headerMeta();
  if (!el) return;
  el.innerHTML = `
    <span class="header-meta-badge">🤖 Agent: ${escapeHtml(meta.llm_agent)}</span>
    <span class="header-meta-badge">👤 User: ${escapeHtml(meta.llm_user)}</span>
    <span class="header-meta-badge">${simulations.length} simulations</span>
  `;
}

// ── Filter chips ──────────────────────────────────────────────────────────────
function buildFilterChips() {
  const container = els.filterChips();
  const types = getTaskTypes(state.data.simulations);
  container.innerHTML = '';

  const allChip = document.createElement('span');
  allChip.className = 'filter-chip active';
  allChip.dataset.type = 'all';
  allChip.textContent = 'All';
  allChip.addEventListener('click', () => {
    state.activeFilters.clear();
    updateFilterUI();
    applyFilter();
  });
  container.appendChild(allChip);

  for (const type of types) {
    const chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.dataset.type = type;
    chip.textContent = SAT_TYPE_LABELS[type] ?? type;
    chip.addEventListener('click', () => {
      if (state.activeFilters.has(type)) {
        state.activeFilters.delete(type);
      } else {
        state.activeFilters.add(type);
      }
      updateFilterUI();
      applyFilter();
    });
    container.appendChild(chip);
  }
}

function updateFilterUI() {
  const chips = els.filterChips().querySelectorAll('.filter-chip');
  const allActive = state.activeFilters.size === 0;
  chips.forEach(chip => {
    if (chip.dataset.type === 'all') {
      chip.classList.toggle('active', allActive);
    } else {
      chip.classList.toggle('active', state.activeFilters.has(chip.dataset.type));
    }
  });
}

function applyFilter() {
  if (state.activeFilters.size === 0) {
    state.filtered = [...state.data.simulations];
  } else {
    state.filtered = state.data.simulations.filter(s => state.activeFilters.has(s.taskType));
  }
  renderSidebar();
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function renderSidebar() {
  const list = els.simList();
  const count = els.simCount();
  if (count) count.textContent = `(${state.filtered.length})`;

  if (state.filtered.length === 0) {
    list.innerHTML = `
      <div class="sidebar-empty">
        <span class="icon">🔍</span>
        <p>No simulations match the current filter.</p>
      </div>`;
    return;
  }

  list.innerHTML = '';
  for (const sim of state.filtered) {
    const item = buildSimItem(sim);
    list.appendChild(item);
  }
}

function buildSimItem(sim) {
  const div = document.createElement('div');
  div.className = 'sim-item' + (sim.id === state.selectedId ? ' active' : '');
  div.dataset.id = sim.id;

  const isPass = sim.reward?.reward === 1.0;
  const scoreClass = isPass ? 'score-pass' : 'score-fail';
  const scoreTxt = isPass ? 'Pass' : 'Failed';
  const dur = sim.duration > 0 ? `${sim.duration.toFixed(1)}s` : '';

  div.innerHTML = `
    <div class="sim-item-header">
      <span class="task-type-badge" data-type="${sim.taskType}">${SAT_TYPE_LABELS[sim.taskType] ?? sim.taskType}</span>
      <span class="sim-task-id" title="${escapeHtml(sim.task_id)}">${simpleTaskId(sim.task_id)}</span>
    </div>
    <div class="sim-item-meta">
      <span class="score-chip ${scoreClass}">${scoreTxt}</span>
      <span class="sim-duration">${dur}</span>
    </div>`;

  div.addEventListener('click', () => selectSimulation(sim.id));
  return div;
}

function simpleTaskId(taskId) {
  // "urban_satellite_classification_01" → "classification_01"
  return taskId.replace(/^urban_satellite_/, '');
}

// ── Select & render simulation ────────────────────────────────────────────────
function selectSimulation(id) {
  state.selectedId = id;
  els.simList().querySelectorAll('.sim-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  const sim = state.data.simulations.find(s => s.id === id);
  if (!sim) return;

  hideWelcome();
  renderTaskInfoPanel(sim);
  renderConversation(sim);
  showConversationView();
}

// ── Task info panel ───────────────────────────────────────────────────────────
let taskInfoExpanded = true;

function toggleTaskInfoPanel() {
  taskInfoExpanded = !taskInfoExpanded;
  const body = els.taskInfoBody();
  const toggle = els.taskInfoToggle();
  body.classList.toggle('hidden', !taskInfoExpanded);
  toggle.classList.toggle('open', taskInfoExpanded);
  toggle.textContent = taskInfoExpanded ? '▲' : '▼';
}

function renderTaskInfoPanel(sim) {
  const idEl = els.taskInfoId();
  if (idEl) idEl.textContent = sim.task_id;

  const toggle = els.taskInfoToggle();
  if (toggle) {
    taskInfoExpanded = true;
    toggle.textContent = '▲';
    toggle.classList.add('open');
  }

  const body = els.taskInfoBody();
  if (!body) return;
  body.classList.remove('hidden');

  const task = sim.taskMeta;
  const reward = sim.reward ?? {};

  const purpose = task?.description?.purpose ?? '–';
  const persona = task?.user_scenario?.instructions?.task_instructions ??
                  task?.user_scenario?.persona ?? '–';
  const reasonForCall = task?.user_scenario?.instructions?.reason_for_call ?? '–';
  const formattedReason = escapeHtml(reasonForCall).replace(/\. /g, '.<br/><br/>').replace(/\n/g, '<br/>');

  const { actionScore, nlAccuracy, actionResults, nlResults } = computeSimulationMetrics(sim, task);
  const totalCost = sim.agentCost + sim.userCost;
  const actionScoreStr = actionScore !== null ? `${(actionScore * 100).toFixed(1)}%` : '–';
  const nlAccuracyStr = nlAccuracy !== null ? `${(nlAccuracy * 100).toFixed(1)}%` : '–';

  body.innerHTML = `
    <div class="task-info-section" style="grid-column: span 2">
      <h4>📋 Purpose</h4>
      <p>${escapeHtml(purpose)}</p>
    </div>

    <div class="task-info-section" style="grid-column: span 2">
      <h4>🎭 Persona</h4>
      <p>${escapeHtml(persona)}</p>
    </div>

    <div class="task-info-section" style="grid-column: span 2">
      <h4>📝 Instruction</h4>
      <p>${formattedReason}</p>
    </div>

    <div class="task-info-section">
      <h4>⏱ Execution</h4>
      <div style="font-size:11px;color:var(--text-secondary)">
        <div style="margin-bottom:4px"><strong>Duration:</strong> ${sim.duration.toFixed(2)}s</div>
        <div style="margin-bottom:4px"><strong>Termination:</strong> <span style="text-transform:uppercase;font-size:9px;font-weight:700">${escapeHtml(sim.termination)}</span></div>
        <div style="margin-bottom:4px"><strong>Seed:</strong> ${escapeHtml(String(sim.seed ?? '–'))}</div>
        ${totalCost > 0 ? `<div><strong>Cost:</strong> <span style="color:var(--text-secondary)">$${totalCost.toFixed(4)}</span></div>` : ''}
      </div>
    </div>

    <div class="task-info-section" style="grid-column: span 2">
      <h4>🎯 PROCESS-BASED ACCURACY (${actionScoreStr})</h4>
      <div class="action-steps-list">
        ${renderActionResults(actionResults)}
      </div>
    </div>

    <div class="task-info-section" style="grid-column: span 2">
      <h4>💬 OUTCOME-BASED ACCURACY (${nlAccuracyStr})</h4>
      <div class="action-steps-list" style="gap: 8px;">
        ${renderNLResults(nlResults)}
      </div>
    </div>
  `;
}

function renderActionResults(actionResults) {
  if (!actionResults || actionResults.length === 0) return '<span style="color:var(--text-muted);font-size:11px">–</span>';
  return actionResults.map(item => {
    const met = item.met;
    const icon = met ? '✓' : '✗';
    const iconClass = met ? 'pass' : 'fail';
    const infoText = item.action.info ? `: ${item.action.info}` : '';
    const text = escapeHtml(`[${item.action.name}]${infoText}`);
    return `<div class="action-step">
      <div class="action-step-icon ${iconClass}">${icon}</div>
      <span>${text}</span>
    </div>`;
  }).join('');
}

function renderNLResults(nlResults) {
  if (!nlResults || nlResults.length === 0) return '<span style="color:var(--text-muted);font-size:11px">–</span>';
  return nlResults.map(item => {
    const met = typeof item.met === 'boolean' ? item.met : null;
    const icon = met === true ? '✓' : met === false ? '✗' : '?';
    const iconClass = met === true ? 'pass' : met === false ? 'fail' : 'unknown';
    const text = escapeHtml(item.nl_assertion ?? String(item));
    const reason = item.justification ? escapeHtml(item.justification) : '';
    return `<div class="action-step" style="align-items: flex-start;">
      <div class="action-step-icon ${iconClass}" style="margin-top: 2px;">${icon}</div>
      <div style="flex: 1;">
        <div style="font-weight: 500; margin-bottom: 2px; color: var(--text-primary);">${text}</div>
        ${reason ? `<div style="font-size: 10px; color: var(--text-muted); line-height: 1.4;"><strong>Reason:</strong> ${reason}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Conversation rendering ────────────────────────────────────────────────────
function renderConversation(sim) {
  const container = els.threadContainer();
  container.innerHTML = '';
  const turns = parseMessages(sim.messages);
  for (const turn of turns) {
    container.appendChild(buildTurnEl(turn));
  }
  container.scrollTop = 0;
}

function buildTurnEl(turn) {
  if (turn.type === 'user_text')  return buildTextBubble(turn, 'user');
  if (turn.type === 'agent_text') return buildTextBubble(turn, 'agent');
  if (turn.type === 'tool_call')  return buildToolCard(turn);

  const div = document.createElement('div');
  div.style.cssText = 'font-size:11px;color:var(--text-muted);padding:4px 20px;font-style:italic';
  div.textContent = `[${turn.type}] ${String(turn.content ?? '').substring(0, 120)}`;
  return div;
}

function buildTextBubble(turn, who) {
  const row = document.createElement('div');
  row.className = `msg-row ${who}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = who === 'user' ? '👤' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = renderMarkdownLite(turn.content);

  row.appendChild(avatar);
  row.appendChild(bubble);
  return row;
}

// ── Satellite image helpers ───────────────────────────────────────────────────

// Tool arguments that may contain an image path
const IMAGE_ARG_KEYS = ['image_path', 'image_path_1', 'image_path_2'];

/**
 * Returns array of { key, filename, isPast } for any image arg found in args.
 */
function extractImageArgs(args) {
  if (!args || typeof args !== 'object') return [];
  return IMAGE_ARG_KEYS
    .filter(k => args[k] && typeof args[k] === 'string')
    .map(k => {
      const rawPath = args[k];
      // Strip any absolute path prefix – keep only the basename (e.g. "19665_30150_past.png")
      const basename = rawPath.split('/').pop();
      return {
        key: k,
        filename: basename,
        isPast: rawPath.includes('_past'),
      };
    });
}

/**
 * Resolves a satellite image basename to a relative URL.
 * current images: assets/satellite_imgs/{basename}
 * past images:    assets/satellite_imgs_past/{basename}
 */
function resolveImageUrl(filename, isPast) {
  if (isPast) {
    return `./assets/satellite_imgs_past/${filename}`;
  }
  return `./assets/satellite_imgs/${filename}`;
}

/**
 * Build the satellite image preview section HTML element.
 */
function buildImagePreviewSection(imageArgs, accentColor, borderColor) {
  if (!imageArgs || imageArgs.length === 0) return null;

  const section = document.createElement('div');
  section.style.cssText = `
    border-top: 1px solid ${borderColor};
    padding-top: 12px;
    margin-top: 4px;
    margin-bottom: 4px;
  `;

  const label = document.createElement('div');
  label.style.cssText = `
    font-weight: 600;
    font-size: 11px;
    color: ${accentColor};
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `;
  label.textContent = '🛰️ Satellite Image';
  section.appendChild(label);

  const imgWrapper = document.createElement('div');
  imgWrapper.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';

  for (const { key, filename, isPast } of imageArgs) {
    const imgContainer = document.createElement('div');
    imgContainer.style.cssText = 'flex: 1; min-width: 200px; max-width: 400px;';

    const img = document.createElement('img');
    img.src = resolveImageUrl(filename, isPast);
    img.alt = `Satellite tile: ${filename}`;
    img.style.cssText = `
      width: 100%;
      max-height: 220px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid ${borderColor};
      display: block;
      background: #f1f5f9;
    `;
    img.onerror = () => {
      img.style.display = 'none';
      const errMsg = document.createElement('div');
      errMsg.style.cssText = 'font-size:10px;color:#9ca3af;padding:8px;text-align:center;background:#f9fafb;border-radius:6px;border:1px dashed #d1d5db;';
      errMsg.textContent = `Image not found: ${filename}`;
      imgContainer.appendChild(errMsg);
    };

    const caption = document.createElement('div');
    caption.style.cssText = 'font-size: 10px; color: #6b7280; margin-top: 4px; font-family: monospace; text-align: center;';
    caption.textContent = filename + (isPast ? '  (past / historical)' : '  (current)');

    imgContainer.appendChild(img);
    imgContainer.appendChild(caption);
    imgWrapper.appendChild(imgContainer);
  }

  section.appendChild(imgWrapper);
  return section;
}

// ── Tool card builder (with satellite image support) ──────────────────────────
function buildToolCard(turn) {
  const meta = getToolMeta(turn.toolName);

  const card = document.createElement('div');
  card.className = 'tool-call-card';
  card.style.cssText = `
    background: ${meta.bg};
    border-color: ${meta.border};
    border-left: 4px solid ${meta.color};
    margin: 12px 0;
  `;

  // ── Header ─────────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'tool-header';
  header.style.cssText = `background: ${meta.bg}; border-bottom-color: ${meta.border}; padding: 10px 12px;`;

  header.innerHTML = `
    <span class="group-badge" style="color:${meta.color};background:${meta.bg};border-color:${meta.border}">
      ${meta.icon} ${escapeHtml(meta.group)}
    </span>
    <span class="tool-name">${escapeHtml(turn.toolName)}</span>
    ${turn.error ? '<span class="tool-error-badge">Error</span>' : ''}
    <span style="color: var(--text-muted); font-size: 10px; margin-left: 8px;">ID: ${escapeHtml(turn.toolCallId).substring(0, 16)}...</span>
  `;
  card.appendChild(header);

  // ── Body ───────────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'tool-body';
  body.style.cssText = `background: ${meta.bg}; padding: 8px;`;

  // Arguments section
  const argsSection = document.createElement('div');
  argsSection.style.cssText = 'margin-bottom: 12px;';

  const argsLabel = document.createElement('div');
  argsLabel.style.cssText = `
    font-weight: 600;
    font-size: 11px;
    color: ${meta.color};
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `;
  argsLabel.textContent = '📥 Arguments';
  argsSection.appendChild(argsLabel);

  const argsPre = document.createElement('pre');
  argsPre.className = 'json-block';
  argsPre.style.cssText = 'margin: 0; font-size: 11px; max-height: none; overflow-y: visible; line-height: 1.6;';
  
  let displayArgs = turn.args;
  if (typeof turn.args === 'object' && turn.args !== null) {
    displayArgs = { ...turn.args };
    IMAGE_ARG_KEYS.forEach(k => {
      if (typeof displayArgs[k] === 'string') {
        displayArgs[k] = displayArgs[k].split('/').pop();
      }
    });
  }

  const argsStr = typeof displayArgs === 'object' && displayArgs !== null
    ? JSON.stringify(displayArgs, null, 2)
    : String(displayArgs ?? '{}');
  argsPre.innerHTML = syntaxHighlightJSON(argsStr);
  argsSection.appendChild(argsPre);
  body.appendChild(argsSection);

  // ── Satellite image preview (between args and result) ─────────────────────
  const imageArgs = extractImageArgs(turn.args);
  if (imageArgs.length > 0) {
    const imgSection = buildImagePreviewSection(imageArgs, meta.color, meta.border);
    if (imgSection) {
      body.appendChild(imgSection);
    }
  }

  // Result section
  if (turn.resultRaw !== null && turn.resultRaw !== '') {
    const resultSection = document.createElement('div');
    resultSection.style.cssText = 'border-top: 1px solid ' + meta.border + '; padding-top: 12px; margin-top: 4px;';

    const resultLabel = document.createElement('div');
    resultLabel.style.cssText = `
      font-weight: 600;
      font-size: 11px;
      color: ${meta.color};
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    resultLabel.textContent = '📤 Result';
    resultSection.appendChild(resultLabel);

    const resultData = turn.result !== null ? turn.result : turn.resultRaw;
    const formatted = formatToolResult(resultData, turn.toolName);

    const resultDiv = document.createElement('div');
    if (turn.error) {
      resultDiv.style.cssText = 'background: #fef2f2; border: 1px solid #fca5a5; border-radius: 4px; padding: 10px; color: #b91c1c; font-size: 11px; line-height: 1.6;';
    } else {
      resultDiv.style.cssText = 'font-size: 11px; line-height: 1.6;';
    }
    resultDiv.innerHTML = formatted.html;
    resultSection.appendChild(resultDiv);
    body.appendChild(resultSection);
  }

  card.appendChild(body);
  return card;
}

// ── JSON syntax highlight ─────────────────────────────────────────────────────
function syntaxHighlightJSON(str) {
  str = escapeHtml(str);
  return str.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    match => {
      let cls = 'jn';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'jk' : 'js';
      } else if (/true|false/.test(match)) {
        cls = 'jb';
      } else if (/null/.test(match)) {
        cls = 'jnl';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

// ── Markdown-lite renderer ────────────────────────────────────────────────────
function renderMarkdownLite(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  html = html
    .split(/\n{2,}/)
    .map(block => block.trim() ? `<p>${block.replace(/\n/g, '<br>')}</p>` : '')
    .join('');
  return html || escapeHtml(text);
}

// ── UI state helpers ──────────────────────────────────────────────────────────
function showLoading() {
  els.loadingOverlay()?.classList.remove('hidden');
  els.errorOverlay()?.classList.add('hidden');
}

function hideOverlay() {
  els.loadingOverlay()?.classList.add('hidden');
  els.errorOverlay()?.classList.add('hidden');
}

function showError(msg) {
  const err = els.errorOverlay();
  if (err) {
    const msgEl = els.errorMsg();
    if (msgEl) msgEl.textContent = msg;
    err.classList.remove('hidden');
  }
  els.loadingOverlay()?.classList.add('hidden');
}

function showWelcome() {
  els.welcomeScreen()?.classList.remove('hidden');
  els.conversationView()?.classList.add('hidden');
}

function hideWelcome() {
  els.welcomeScreen()?.classList.add('hidden');
}

function showConversationView() {
  els.conversationView()?.classList.remove('hidden');
}

// ── Small utilities ───────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Urban-Satellite task type constants ───────────────────────────────────────
// Slugs match _TASK_SLUGS in tau2-bench/scripts/urban_satellite/task_generation.py
const SAT_TYPE_LABELS = {
  classification: 'Classification',
  comparison:     'Comparison',
  detection:      'Detection',
  verification:   'Verification',
  encroachment:   'Encroachment',
  change_check:   'Change Check',
  env_profile:    'Env. Profiling',
  suitability:    'Suitability',
  accessibility:  'Accessibility',
  other:          'Other',
};
