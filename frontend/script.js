// =====================================================================
// AI WAR ROOM — SECTOR 7 | CLEAN BACKEND-DRIVEN SCRIPT v3.0
// SINGLE SOURCE OF TRUTH: BACKEND ONLY
// =====================================================================

// ── Detect environment automatically ──
const IS_HF = window.location.hostname.includes("hf.space") 
              || window.location.hostname.includes("huggingface.co");

const API = IS_HF
  ? ""           // Same origin on HF — no host needed
  : "http://localhost:7860";  // Local Docker dev

// ── Application state (display only — never used as sim source of truth)
let currentTask = "easy";
let autoInterval = null;
let isAutoRunning = false;
let episodeDone = false;
let alertTimeout = null;
let attackCount = 0;
const MAX_ATTACKS = 10;
let lastAlertTime = 0;
const ALERT_COOLDOWN = 3000; // 3 sec (change to 4000 if needed)
let simulationStarted = false;


// ── Audio Assets (Dropbox hosted)
const audioBeep    = new Audio('https://www.dropbox.com/scl/fi/n3z6vd7m6r2qdbcrv80ix/beep.mp3?rlkey=pvrund9imtjn43lidvpdu3trz&st=bewo06ar&dl=1');
const audioSiren   = new Audio('https://www.dropbox.com/scl/fi/ragcgx8yb15d061nzd6lm/siren.mp3?rlkey=86z73vfis5ykmv8cr16ced5ft&st=l4bycy85&dl=1');
const audioWarning = new Audio('https://www.dropbox.com/scl/fi/qy0f5fw9rv2lbh1v8ycab/warning.mp3?rlkey=gi343146sivrev2di7789hhg9&st=ydaqc0v3&dl=1');

// Optional: Adjust volume levels so they aren't overpowering
audioBeep.volume = 0.3;
audioSiren.volume = 0.5;
audioWarning.volume = 0.4;

// ── Tracking (derived from backend responses only)
let cumulativeScore = 0.0;      // sum of rewards from /step
let lastReward = 0.0;
let lastActions = [];
let lastState = null;           // last state from backend (THE source of truth)
let backendScore = null;        // score from /score endpoint

// ── Log store
let allLogs = [];
let currentFilter = "all";

// ── Blip position cache (stable radar dots per threat ID)
const blipCache = {};

// ── Session timer
const sessionStart = Date.now();

// ── Charts
let mainChart = null, metricsChart = null, intelChart = null,
    forecastChart = null, threatDistChart = null, historyChart = null;

// ── Seen threat IDs (to detect new threats)
const seenThreatIds = new Set();
const resolvedThreatIds = new Set();

// =====================================================================
// CLOCK
// =====================================================================
function startClock() {
  function tick() {
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const el = document.getElementById('clock');
    if (el) el.textContent = pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds());
    const up = Math.floor((Date.now()-sessionStart)/1000);
    const uel = document.getElementById('uptime-val');
    if (uel) uel.textContent = pad(Math.floor(up/3600))+':'+pad(Math.floor((up%3600)/60))+':'+pad(up%60);
  }
  tick(); setInterval(tick, 1000);
}

// =====================================================================
// CHARTS INIT
// =====================================================================
const chartBase = {
  plugins:{ legend:{ display:false } },
  scales:{
    x:{ display:false },
    y:{ min:0, max:100, grid:{color:'rgba(0,255,140,0.05)'}, ticks:{color:'rgba(0,255,140,0.3)',font:{size:9},maxTicksLimit:5} }
  },
  animation:{ duration:200 }
};

function initMainChart() {
  const ctx = document.getElementById('chart').getContext('2d');
  mainChart = new Chart(ctx, {
    type:'line',
    data:{ labels:[], datasets:[
      { label:'Risk', data:[], borderColor:'#ff3b3b', borderWidth:2, pointRadius:0, fill:true, backgroundColor:'rgba(255,59,59,0.06)', tension:0.4 },
      { label:'Damage', data:[], borderColor:'#ff8c00', borderWidth:1.5, pointRadius:0, fill:false, borderDash:[4,4], tension:0.4 }
    ]},
    options: chartBase
  });
}

function initMetricsChart() {
  const ctx = document.getElementById('metrics-chart').getContext('2d');
  metricsChart = new Chart(ctx, {
    type:'line',
    data:{ labels:[], datasets:[
      { label:'Risk', data:[], borderColor:'#ff3b3b', borderWidth:2, pointRadius:2, fill:true, backgroundColor:'rgba(255,59,59,0.08)', tension:0.4 },
      { label:'Damage', data:[], borderColor:'#ff8c00', borderWidth:1.5, pointRadius:0, fill:false, borderDash:[4,4], tension:0.4 },
      { label:'Resolved', data:[], borderColor:'#00ff8c', borderWidth:1.5, pointRadius:0, fill:false, tension:0.4 }
    ]},
    options:{
      plugins:{ legend:{ display:true, labels:{ color:'rgba(0,255,140,0.5)', font:{size:9}, boxWidth:12 } } },
      scales:{ x:{ display:false }, y:{ min:0, max:100, grid:{color:'rgba(0,255,140,0.05)'}, ticks:{color:'rgba(0,255,140,0.3)',font:{size:9},maxTicksLimit:5} } },
      animation:{ duration:200 }
    }
  });
}

function initIntelChart() {
  const ctx = document.getElementById('intel-chart').getContext('2d');
  intelChart = new Chart(ctx, {
    type:'doughnut',
    data:{ labels:['Alerts','Info','Resolved','System'], datasets:[{ data:[0,0,0,0], backgroundColor:['rgba(255,59,59,0.7)','rgba(0,255,198,0.7)','rgba(0,168,90,0.7)','rgba(77,140,106,0.5)'], borderColor:'rgba(0,255,140,0.15)', borderWidth:1 }] },
    options:{ plugins:{ legend:{ display:true, labels:{ color:'rgba(0,255,140,0.5)', font:{size:9}, boxWidth:10 } } }, animation:{ duration:300 } }
  });
}

function initForecastChart() {
  const ctx = document.getElementById('forecast-chart').getContext('2d');
  forecastChart = new Chart(ctx, {
    type:'bar',
    data:{ labels:['S+1','S+2','S+3','S+4','S+5','S+6','S+7','S+8','S+9','S+10'],
      datasets:[{ label:'Predicted Risk', data:Array(10).fill(0), backgroundColor:'rgba(192,132,252,0.4)', borderColor:'rgba(192,132,252,0.8)', borderWidth:1 }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ x:{ ticks:{color:'rgba(0,255,140,0.3)',font:{size:8}}, grid:{color:'rgba(0,255,140,0.04)'}}, y:{ min:0, max:100, ticks:{color:'rgba(0,255,140,0.3)',font:{size:8}}, grid:{color:'rgba(0,255,140,0.05)'} } }, animation:{duration:300} }
  });
}

function initThreatDistChart() {
  const ctx = document.getElementById('threat-dist-chart').getContext('2d');
  threatDistChart = new Chart(ctx, {
    type:'polarArea',
    data:{ labels:['Cyber','Drone'], datasets:[{ data:[0,0], backgroundColor:['rgba(255,59,59,0.5)','rgba(255,140,0,0.5)'], borderColor:['#ff3b3b','#ff8c00'], borderWidth:1 }] },
    options:{ plugins:{ legend:{ display:true, labels:{ color:'rgba(0,255,140,0.5)', font:{size:9}, boxWidth:10 } } }, scales:{ r:{ ticks:{display:false}, grid:{color:'rgba(0,255,140,0.08)'} } }, animation:{duration:300} }
  });
}

function initHistoryChart() {
  const ctx = document.getElementById('history-chart').getContext('2d');
  historyChart = new Chart(ctx, {
    type:'line',
    data:{ labels:[], datasets:[{ label:'Risk', data:[], borderColor:'#ff3b3b', borderWidth:2, pointRadius:0, fill:true, backgroundColor:'rgba(255,59,59,0.06)', tension:0.4 }] },
    options: chartBase
  });
}

function pushChartData(damage, riskScore, resolvedCount) {
  const MAX = 60;
  const label = lastState ? lastState.time : 0;
  [mainChart, metricsChart, historyChart].forEach(c => {
    if (!c) return;
    c.data.labels.push(label);
    if (c === metricsChart) {
      c.data.datasets[0].data.push(Math.min(riskScore, 100));
      c.data.datasets[1].data.push(Math.min(damage * 8, 100));
      c.data.datasets[2].data.push(Math.min(resolvedCount * 10, 100));
    } else {
      c.data.datasets[0].data.push(Math.min(riskScore, 100));
      if (c === mainChart) c.data.datasets[1].data.push(Math.min(damage * 8, 100));
    }
    while (c.data.labels.length > MAX) {
      c.data.labels.shift();
      c.data.datasets.forEach(d => d.data.shift());
    }
    c.update();
  });
}

// =====================================================================
// LOGGING
// =====================================================================
function ts() {
  const n = new Date();
  return String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0');
}

function addLog(type, text) {
  const entry = { type, text, ts: ts(), time: Date.now() };
  allLogs.push(entry);

  // Main log panel
  const logs = document.getElementById('logs');
  if (logs) {
    const line = document.createElement('span');
    line.className = 'log-line log-' + type;
    line.innerHTML = '<span class="log-time">[' + entry.ts + ']</span> ' + text;
    logs.appendChild(line);
    logs.scrollTop = logs.scrollHeight;
    while (logs.children.length > 80) logs.removeChild(logs.firstChild);
  }

  refreshIntelFeed();
  updateIntelStats();

  // Timeline
  if (type === 'alert' || type === 'resolved' || type === 'system') {
    addToTimeline(type, text, entry.ts);
  }
}

function addToTimeline(type, text, ts) {
  const el = document.getElementById('history-timeline');
  if (!el) return;
  const col = type === 'alert' ? 'c-red' : type === 'resolved' ? 'c-green' : 'c-cyan';
  const textCol = type === 'alert' ? 'var(--red)' : type === 'resolved' ? 'var(--green-dim)' : 'var(--cyan)';
  const item = document.createElement('div');
  item.className = 'timeline-item';
  item.innerHTML = '<div class="timeline-dot ' + col + '"></div><div class="timeline-content"><div class="timeline-header"><span class="timeline-time">' + ts + '</span><span class="timeline-title" style="color:' + textCol + '">' + text + '</span></div></div>';
  el.insertBefore(item, el.firstChild);
  const ec = document.getElementById('event-count-badge');
  if (ec) ec.textContent = el.children.length + ' EVENTS';
}

function refreshIntelFeed() {
  const cont = document.getElementById('intel-logs-full');
  if (!cont) return;
  cont.innerHTML = '';
  const filtered = currentFilter === 'all' ? allLogs : allLogs.filter(l => l.type === currentFilter);
  filtered.slice(-100).forEach(e => {
    const line = document.createElement('span');
    line.className = 'log-line log-' + e.type;
    line.innerHTML = '<span class="log-time">[' + e.ts + ']</span> ' + e.text;
    cont.appendChild(line);
  });
  cont.scrollTop = cont.scrollHeight;
}

function updateIntelStats() {
  const alerts = allLogs.filter(l => l.type === 'alert').length;
  const resolved = allLogs.filter(l => l.type === 'resolved').length;
  const info = allLogs.filter(l => l.type === 'info').length;
  const sys = allLogs.filter(l => l.type === 'system').length;
  setEl('stat-total', allLogs.length);
  setEl('stat-alerts', alerts);
  setEl('stat-resolved', resolved);
  if (backendScore !== null) setEl('stat-backend-score', backendScore.toFixed(3));
  if (intelChart) {
    intelChart.data.datasets[0].data = [alerts, info, resolved, sys];
    intelChart.update();
  }
}

function filterLogs(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = type;
  refreshIntelFeed();
}

// =====================================================================
// HELPERS
// =====================================================================
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setCtrlStatus(msg, color) {
  const el = document.getElementById('ctrl-status');
  if (!el) return;
  el.textContent = msg;
  const colors = { green:'var(--green)', orange:'var(--orange)', red:'var(--red)', cyan:'var(--cyan)', yellow:'var(--yellow)', dim:'var(--text-dim)' };
  el.style.color = colors[color] || 'var(--text-dim)';
}

function setConnected(ok) {
  const dot = document.getElementById('sidebar-dot');
  const status = document.getElementById('sidebar-status');
  if (dot) { dot.className = 'status-dot ' + (ok ? 'online' : 'offline'); }
  if (status) status.textContent = ok ? 'BACKEND ONLINE' : 'BACKEND OFFLINE';
}

// ── Threat naming from backend data
function getThreatLabel(t) {
  const type = (t.type || 'unknown').toLowerCase();
  if (type === 'cyber') {
    const stage = t.stage || 'probing';
    const labels = { probing:'CYBER PROBE', breach:'CYBER BREACH', critical:'CRITICAL HACK' };
    return labels[stage] || 'CYBER THREAT';
  }
  if (type === 'drone') {
    const d = t.distance || 0;
    return d < 10 ? 'DRONE IMPACT IMM.' : d < 20 ? 'DRONE CLOSING' : 'DRONE DETECTED';
  }
  return type.toUpperCase() + ' THREAT';
}

function getThreatDesc(t) {
  const type = (t.type || 'unknown').toLowerCase();
  if (type === 'cyber') return 'Stage: ' + (t.stage || 'probing').toUpperCase() + ' | ID: ' + t.id;
  if (type === 'drone') return 'Dist: ' + (t.distance || '?') + ' | Speed: ' + (t.speed || '?') + ' | ID: ' + t.id;
  return 'ID: ' + t.id;
}

// =====================================================================
// RENDER — ALL FROM STATE
// =====================================================================

// Main render: takes backend state as single source of truth
function renderFromState(state) {
  if (!state) return;

  const threats = state.threats || [];
  const visibleThreats = state.visible_threats || [];
  const damage = state.damage || 0;
  const time = state.time || 0;
  const resources = state.resources || {};

  // Threat classification
  const activeThreats = visibleThreats.filter(t => t.status === 'active');
  const resolvedThreats = threats.filter(t => t.status === 'resolved');
  const cyberActive = activeThreats.filter(t => t.type === 'cyber');
  const droneActive = activeThreats.filter(t => t.type === 'drone');

  // Risk score computed from backend data
  const cyberPenalty = cyberActive.reduce((s, t) => {
    const p = { probing:10, breach:20, critical:35 };
    return s + (p[t.stage] || 10);
  }, 0);
  const dronePenalty = droneActive.reduce((s, t) => {
    return s + Math.max(0, 30 - (t.distance || 30));
  }, 0);
  const riskScore = Math.min(100, Math.round(damage * 3 + cyberPenalty + dronePenalty));

  // --- HUD ---
  setEl('step-counter', time);
  setEl('hud-score', cumulativeScore.toFixed(2));
  setEl('hud-task', currentTask.toUpperCase());

  // --- Threat level badge ---
  const badge = document.getElementById('threat-status');
  if (badge) {
    badge.className = 'hud-val threat-badge';
    if (!activeThreats.length) { badge.textContent = 'STANDBY'; badge.classList.add('level-standby'); }
    else if (cyberActive.some(t => t.stage === 'critical') || damage >= 7) { badge.textContent = 'CRITICAL'; badge.classList.add('level-critical'); }
    else { badge.textContent = 'ELEVATED'; badge.classList.add('level-elevated'); }
  }

  // --- System status badge ---
  const sysBadge = document.getElementById('sys-status');
  if (sysBadge) {
    if (!activeThreats.length) { sysBadge.textContent = 'MONITORING'; sysBadge.className = 'badge badge-monitor'; }
    else if (cyberActive.some(t => t.stage === 'critical')) { sysBadge.textContent = 'CRITICAL'; sysBadge.className = 'badge badge-live'; }
    else { sysBadge.textContent = 'ALERT'; sysBadge.className = 'badge badge-count'; }
  }

  // --- Overview metrics (from state) ---
  setEl('metric-damage', damage);
  setEl('metric-neutralized', resolvedThreats.length);
  setEl('metric-risk', riskScore);
  setEl('metric-steps', time);
  setEl('metric-score', cumulativeScore.toFixed(2));

  // Risk bar
  const bar = document.getElementById('risk-bar');
  if (bar) {
    bar.style.width = riskScore + '%';
    bar.style.background = riskScore > 70 ? 'var(--red)' : riskScore > 40 ? 'var(--orange)' : 'var(--green)';
  }

  // AI engine status
  const aeDot = document.getElementById('ae-dot');
  const aeLabel = document.getElementById('ae-label');
  if (episodeDone) {
    if (aeDot) { aeDot.className = 'ae-dot'; aeDot.style.background = 'var(--red)'; aeDot.style.boxShadow = '0 0 6px var(--red)'; }
    if (aeLabel) { aeLabel.textContent = 'EPISODE DONE'; aeLabel.parentElement.style.color = 'var(--red)'; }
  } else {
    if (aeDot) { aeDot.className = 'ae-dot pulse'; aeDot.style.background = ''; aeDot.style.boxShadow = ''; }
    if (aeLabel) { aeLabel.textContent = 'ACTIVE'; aeLabel.parentElement.style.color = ''; }
  }

  // --- Threat list (from visible_threats) ---
  renderThreatList(visibleThreats);
  renderTypeColumns(cyberActive, droneActive);
  renderRadar(visibleThreats);

  // --- Detect new/resolved threats for logging ---
  visibleThreats.forEach(t => {
    const key = String(t.id) + '_' + t.type;

    if (simulationStarted && t.status === 'active' && !seenThreatIds.has(key)) {
  seenThreatIds.add(key);

  attackCount++; // ✅ COUNT ADD KIYA

  addLog('alert', '[ALERT] ' + t.type.toUpperCase() + 
    ' — ' + getThreatLabel(t) + ' DETECTED (ID:' + t.id + ')');

  triggerAlertOverlay([t]);

  // 🛑 STOP AFTER 10 ATTACKS
  if (attackCount >= MAX_ATTACKS) {
    addLog('system', 'MAX ATTACK LIMIT REACHED — STOPPING SIMULATION');

    if (autoInterval) {
      clearInterval(autoInterval);
      autoInterval = null;
      isAutoRunning = false;
      document.getElementById('btn-auto').innerHTML = '<span class="btn-icon">&#8635;</span> AUTO RUN';
    }

    episodeDone = true;
    setCtrlStatus('MAX ATTACKS REACHED — RESET TO RESTART', 'red');
    renderRadar([]);
  }
}
  });
  threats.forEach(t => {
    const key = String(t.id) + '_' + t.type;
    if (t.status === 'resolved' && !resolvedThreatIds.has(key)) {
      resolvedThreatIds.add(key);
      addLog('resolved', '[RESOLVED] ' + t.type.toUpperCase() + ' — ' + getThreatLabel(t) + ' NEUTRALIZED (ID:' + t.id + ')');
    }
  });

  // --- Charts ---
  pushChartData(damage, riskScore, resolvedThreats.length);

  // --- Big metrics view ---
  setEl('bm-damage', damage);
  const dmgBar = document.getElementById('bm-damage-bar');
  if (dmgBar) dmgBar.style.width = Math.min(damage * 10, 100) + '%';
  const dmgTrend = document.getElementById('bm-damage-trend');
  if (dmgTrend) { dmgTrend.textContent = damage === 0 ? '✓ No damage taken' : damage < 5 ? '⚠ Moderate damage' : '✗ High damage — act fast'; dmgTrend.style.color = damage === 0 ? 'var(--green)' : damage < 5 ? 'var(--orange)' : 'var(--red)'; }
  setEl('bm-neut', resolvedThreats.length);
  const neutBar = document.getElementById('bm-neut-bar');
  if (neutBar) neutBar.style.width = Math.min(resolvedThreats.length * 12, 100) + '%';
  setEl('bm-risk', riskScore);
  const riskBarBig = document.getElementById('bm-risk-bar');
  if (riskBarBig) riskBarBig.style.width = riskScore + '%';
  const riskTrend = document.getElementById('bm-risk-trend');
  if (riskTrend) { riskTrend.textContent = riskScore > 70 ? 'HIGH RISK — ESCALATE' : riskScore > 40 ? 'MODERATE — MONITOR' : 'LOW RISK — STABLE'; riskTrend.style.color = riskScore > 70 ? 'var(--red)' : riskScore > 40 ? 'var(--orange)' : 'var(--green)'; }
  setEl('bm-active', activeThreats.length);
  const actBar = document.getElementById('bm-active-bar');
  if (actBar) actBar.style.width = Math.min(activeThreats.length * 20, 100) + '%';

  // Threat distribution chart
  if (threatDistChart) {
    threatDistChart.data.datasets[0].data = [cyberActive.length, droneActive.length];
    threatDistChart.update();
  }

  // Forecast chart (predicted based on current threats)
  if (forecastChart) {
    const base = riskScore;
    forecastChart.data.datasets[0].data = Array.from({ length:10 }, (_, i) => {
      const decay = episodeDone ? -i * 5 : (activeThreats.length > 0 ? i * 3 : -i * 4);
      return Math.max(0, Math.min(100, base + decay + (Math.random() * 10 - 5)));
    });
    forecastChart.update();
  }

  // --- AI analysis text ---
  renderAIAnalysis(activeThreats, damage, time, resources);

  // --- Countermeasures panel ---
  renderCountermeasures(cyberActive, droneActive, resources);

  // --- Map ---
  updateAssetMap(cyberActive, droneActive);

  // --- History stats ---
  setEl('hs-steps', time);
  setEl('hs-detected', seenThreatIds.size);
  setEl('hs-neutralized', resolvedThreats.length);
  setEl('hs-damage', damage);
  setEl('hs-score', cumulativeScore.toFixed(2));

  // --- Debug panel ---
  updateDebugPanel(state);
}

// =====================================================================
// THREAT LIST RENDER
// =====================================================================
function renderThreatList(visibleThreats) {
  const list = document.getElementById('threat-list');
  if (!list) return;
  const active = visibleThreats.filter(t => t.status === 'active');
  const tcEl = document.getElementById('threat-count');
  if (tcEl) tcEl.textContent = active.length + ' ACTIVE';
  if (!active.length) { list.innerHTML = '<div class="empty-state">NO THREATS DETECTED — MONITORING</div>'; return; }
  list.innerHTML = '';
  active.forEach(t => list.appendChild(buildThreatItem(t)));
}

function buildThreatItem(t) {
  const type = (t.type || 'unknown').toLowerCase();
  const badgeCls = type === 'cyber' ? 'tbadge-cyb' : 'tbadge-drn';
  const badgeLabel = type === 'cyber' ? 'CYB' : 'DRN';
  const statusCls = 'sbadge-active';
  const statusLabel = 'ACTIVE';
  const itemCls = 'status-active';
  const div = document.createElement('div');
  div.className = 'threat-item ' + itemCls;
  div.innerHTML = '<div class="threat-type-badge ' + badgeCls + '">' + badgeLabel + '</div>' +
    '<div class="threat-info"><div class="threat-name">ID:' + t.id + ' — ' + getThreatLabel(t) + '</div>' +
    '<div class="threat-desc">' + getThreatDesc(t) + '</div></div>' +
    '<div class="threat-status-badge ' + statusCls + '">' + statusLabel + '</div>';
  return div;
}

function renderTypeColumns(cyberActive, droneActive) {
  const cc = document.getElementById('cyber-count'), cl = document.getElementById('cyber-list');
  const dc = document.getElementById('drone-count'), dl = document.getElementById('drone-list');
  if (cc) cc.textContent = cyberActive.length;
  if (dc) dc.textContent = droneActive.length;
  if (cl) { cl.innerHTML = ''; if (!cyberActive.length) { cl.innerHTML = '<div class="empty-state">NONE DETECTED</div>'; } else { cyberActive.forEach(t => cl.appendChild(buildThreatItem(t))); } }
  if (dl) { dl.innerHTML = ''; if (!droneActive.length) { dl.innerHTML = '<div class="empty-state">CLEAR AIRSPACE</div>'; } else { droneActive.forEach(t => dl.appendChild(buildThreatItem(t))); } }
}

// =====================================================================
// RADAR
// =====================================================================
function renderRadar(visibleThreats) {
  ['blips', 'blips2'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    
    // Clear existing blips from the radar
    el.innerHTML = '';
    
    // Stop drawing new dots if the episode has ended
    if (episodeDone) return;

    visibleThreats.filter(t => t.status === 'active').forEach(t => {
      const key = String(t.id);
      if (!blipCache[key]) {
        // Position based on distance for drones, random for cyber
        const type = (t.type || 'cyber').toLowerCase();
        let radius, angle;
        if (type === 'drone') {
          const dist = t.distance || 30;
          // Map distance 0-50 to radar radius 5-45%
          radius = Math.max(5, Math.min(45, (50 - dist) * 0.9 + 5));
          angle = (t.id * 137.5) % 360 * Math.PI / 180; // golden angle spread
        } else {
          radius = 15 + (Math.abs(t.id * 73 + 11) % 25);
          angle = (t.id * 97 + 30) % 360 * Math.PI / 180;
        }
        blipCache[key] = { left: 50 + radius * Math.cos(angle), top: 50 + radius * Math.sin(angle) };
      }
      const dot = document.createElement('div');
      dot.className = 'blip type-' + (t.type || 'cyber').toLowerCase();
      dot.style.left = blipCache[key].left + '%';
      dot.style.top = blipCache[key].top + '%';
      dot.title = getThreatLabel(t);
      el.appendChild(dot);
    });
  });
}

// =====================================================================
// AI ANALYSIS TEXT
// =====================================================================
function renderAIAnalysis(activeThreats, damage, time, resources) {
  const lines = buildAIText(activeThreats, damage, time, resources);
  ['decision', 'decision2'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = lines;
  });
}

function buildAIText(activeThreats, damage, time, resources) {
  let html = '<span class="ai-line-header">═══ AI ANALYSIS — STEP ' + time + ' ═══</span>\n\n';
  if (!activeThreats.length) {
    html += '<span class="ai-line">✓ All visible threats neutralized.\n  Monitoring for new incursions.\n  Resources holding steady.</span>';
  } else {
    html += '<span class="ai-line">ACTIVE THREATS: ' + activeThreats.length + '\n</span>';
    activeThreats.forEach(t => {
      const type = (t.type || '').toLowerCase();
      let action = '→ ANALYZE & MONITOR';
      if (type === 'cyber') {
        if (t.stage === 'critical') action = '→ 🚨 EMERGENCY LOCKDOWN — CRITICAL STAGE';
        else if (t.stage === 'breach') action = '→ BLOCK CYBER — BREACH ACTIVE';
        else action = '→ BLOCK CYBER — EARLY INTERCEPT';
      } else if (type === 'drone') {
        const d = t.distance || 30;
        if (d < 10) action = '→ 🚨 INTERCEPT DRONE IMMEDIATELY (d=' + d + ')';
        else action = '→ INTERCEPT DRONE (d=' + d + ', spd=' + (t.speed || '?') + ')';
      }
      html += '<span class="ai-line">• ID:' + t.id + ' ' + getThreatLabel(t) + '\n  ' + action + '\n</span>';
    });
    if (damage >= 7) html += '\n<span style="color:var(--red)">⚠ DAMAGE CRITICAL — EPISODE NEAR END</span>';
    else if (damage > 3) html += '\n<span style="color:var(--orange)">⚠ DAMAGE ACCUMULATING — PRIORITIZE</span>';
  }
  html += '\n\n<span class="ai-line">DEF UNITS: ' + (resources.defense_units || 0) + ' | CYBER TEAMS: ' + (resources.cyber_teams || 0) + '\nLAST ACTIONS: ' + (lastActions.length ? lastActions.join(', ') : 'none') + '\nLAST REWARD: ' + lastReward.toFixed(3) + ' | CUMUL: ' + cumulativeScore.toFixed(2) + '</span>';
  return html;
}

// =====================================================================
// COUNTERMEASURES
// =====================================================================
function renderCountermeasures(cyberActive, droneActive, resources) {
  const cc = document.getElementById('cm-cyber');
  const cs = document.getElementById('cm-cyber-status');
  if (cc && cs) {
    const engaged = cyberActive.length > 0;
    cc.style.borderColor = engaged ? 'rgba(255,59,59,.6)' : 'rgba(255,59,59,.2)';
    cc.style.background = engaged ? 'rgba(255,59,59,.1)' : 'rgba(255,59,59,.04)';
    cs.textContent = engaged ? 'FIREWALL: ENGAGED · IDS: ALARMED · ' + cyberActive.length + ' THREAT(S) ACTIVE' : 'Firewall: ACTIVE · IDS: ARMED · Honeypot: DEPLOYED';
  }
  const dc = document.getElementById('cm-drone');
  const ds = document.getElementById('cm-drone-status');
  if (dc && ds) {
    const engaged = droneActive.length > 0;
    dc.style.borderColor = engaged ? 'rgba(255,140,0,.6)' : 'rgba(255,140,0,.2)';
    dc.style.background = engaged ? 'rgba(255,140,0,.1)' : 'rgba(255,140,0,.04)';
    ds.textContent = engaged ? 'INTERCEPTORS: DEPLOYED · ' + droneActive.length + ' DRONE(S) TRACKED' : 'Interceptors: STANDBY · Jamming: READY · Radar: TRACKING';
  }
  const rs = document.getElementById('cm-resource-status');
  if (rs) rs.textContent = 'Defense Units: ' + (resources.defense_units || 0) + ' · Cyber Teams: ' + (resources.cyber_teams || 0);
  const as = document.getElementById('cm-action-status');
  if (as) as.textContent = lastActions.length ? lastActions.join(' + ') : 'No actions sent yet';
}

// =====================================================================
// ASSET MAP
// =====================================================================
const ASSETS = [
  {id:'HQ',label:'HQ COMMAND',x:50,y:45},{id:'DB',label:'DATA CENTER',x:25,y:30},
  {id:'COMM',label:'COMMS TOWER',x:75,y:25},{id:'POWER',label:'POWER GRID',x:20,y:70},
  {id:'RADAR',label:'RADAR BASE',x:80,y:65},{id:'GATE',label:'GATEWAY',x:50,y:80}
];
const MAP_CONNECTIONS = [[0,1],[0,2],[0,3],[0,4],[0,5],[1,2],[3,5],[4,5]];

function initAssetMap() {
  const wrap = document.getElementById('map-wrap');
  const nodesDiv = document.getElementById('map-nodes');
  if (!wrap || !nodesDiv) return;
  nodesDiv.innerHTML = '';
  ASSETS.forEach(a => {
    const node = document.createElement('div');
    node.className = 'map-node'; node.id = 'node-' + a.id;
    node.style.left = a.x + '%'; node.style.top = 'calc(' + a.y + '% + 28px)';
    node.style.color = 'var(--green)';
    node.innerHTML = '<div class="map-node-dot"></div><div class="map-node-label">' + a.label + '</div>';
    nodesDiv.appendChild(node);
  });
  drawMapLines({ cyber: [], drone: [] });
}

function drawMapLines(threatData) {
  const wrap = document.getElementById('map-wrap');
  const canvas = document.getElementById('map-canvas');
  if (!wrap || !canvas) return;
  const rect = wrap.getBoundingClientRect();
  canvas.width = rect.width; canvas.height = rect.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  MAP_CONNECTIONS.forEach(([a, b]) => {
    const na = ASSETS[a], nb = ASSETS[b];
    const x1 = na.x / 100 * canvas.width, y1 = (na.y / 100) * (canvas.height - 28) + 28;
    const x2 = nb.x / 100 * canvas.width, y2 = (nb.y / 100) * (canvas.height - 28) + 28;
    const isRed = (threatData.cyber.length && (na.id === 'DB' || na.id === 'GATE' || nb.id === 'DB' || nb.id === 'GATE')) ||
                  (threatData.drone.length && (na.id === 'RADAR' || nb.id === 'RADAR'));
    ctx.strokeStyle = isRed ? 'rgba(255,59,59,0.3)' : 'rgba(0,255,140,0.12)';
    ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });
}

function updateAssetMap(cyberActive, droneActive) {
  const states = {};
  ASSETS.forEach(a => states[a.id] = 'secure');
  if (cyberActive.length) { states['DB'] = 'attacked'; states['GATE'] = 'attacked'; }
  if (droneActive.length) { states['RADAR'] = 'attacked'; }
  ASSETS.forEach(a => {
    const node = document.getElementById('node-' + a.id);
    if (!node) return;
    const attacked = states[a.id] === 'attacked';
    node.className = 'map-node' + (attacked ? ' attacked' : '');
    node.style.color = attacked ? 'var(--red)' : 'var(--green)';
  });
  drawMapLines({ cyber: cyberActive, drone: droneActive });
  const attackedCount = Object.values(states).filter(s => s === 'attacked').length;
  const badge = document.getElementById('asset-ok-count');
  if (badge) { badge.textContent = attackedCount ? attackedCount + ' AT RISK' : 'ALL SECURE'; badge.className = attackedCount ? 'badge badge-count' : 'badge badge-ok'; }
  // Asset list
  const list = document.getElementById('asset-list');
  if (list) {
    list.innerHTML = '';
    ASSETS.forEach(a => {
      const attacked = states[a.id] === 'attacked';
      const item = document.createElement('div');
      item.className = 'asset-item ' + (attacked ? 'at-risk' : 'secure');
      item.innerHTML = '<div class="asset-name">' + a.label + '</div><div class="asset-status ' + (attacked ? 'risk' : 'ok') + '">' + (attacked ? '⚠ UNDER ATTACK' : '✓ SECURE') + '</div>';
      list.appendChild(item);
    });
  }
}

// =====================================================================
// ALERT OVERLAY — ✅ ONLY CHANGE: cyber → warning sound, drone → siren
// =====================================================================
function triggerAlertOverlay(threats) {
  if (!threats || !threats.length) return;

  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN) return;
  lastAlertTime = now;

  const hasCyber = threats.some(t => t.type === 'cyber');
  const at = document.getElementById('alert-text');
  const as = document.getElementById('alert-sub');
  const overlay = document.getElementById('alert-overlay');

  if (hasCyber) {
    if (at) at.textContent = 'CRITICAL CYBER THREAT';
    if (as) as.textContent = 'CYBER ATTACK DETECTED — IMMEDIATE RESPONSE REQUIRED';
    // 🔊 CYBER → warning sound
    audioWarning.currentTime = 0;
    audioWarning.play().catch(e => console.log("Audio blocked: ", e));
  } else {
    if (at) at.textContent = 'HOSTILE DRONE DETECTED';
    if (as) as.textContent = 'AIRSPACE BREACH — DEPLOY COUNTERMEASURES';
    // 🔊 DRONE → siren sound
    audioSiren.currentTime = 0;
    audioSiren.play().catch(e => console.log("Audio blocked: ", e));
  }

  overlay.classList.remove('hidden');
  document.body.classList.add('red-flash');

  if (alertTimeout) clearTimeout(alertTimeout);
  alertTimeout = setTimeout(() => {
    overlay.classList.add('hidden');
    document.body.classList.remove('red-flash');
    // Stop both sounds cleanly
    audioSiren.pause(); audioSiren.currentTime = 0;
    audioWarning.pause(); audioWarning.currentTime = 0;
  }, 1800);
}

// =====================================================================
// DEBUG PANEL
// =====================================================================
function updateDebugPanel(state) {
  if (!state) return;
  const resources = state.resources || {};
  const visThreats = state.visible_threats || [];
  const active = visThreats.filter(t => t.status === 'active').length;
  setEl('dbg-task', currentTask.toUpperCase());
  setEl('dbg-action', lastActions.length ? lastActions.join(', ') : '—');
  setEl('dbg-reward', lastReward.toFixed(4));
  setEl('dbg-done', episodeDone ? 'YES' : 'NO');
  setEl('dbg-score', cumulativeScore.toFixed(2));
  if (backendScore !== null) setEl('dbg-backend-score', backendScore.toFixed(3));
  setEl('dbg-damage', state.damage || 0);
  setEl('dbg-time', state.time || 0);
  setEl('dbg-active', active);
  setEl('dbg-def', resources.defense_units != null ? resources.defense_units : '—');
  setEl('dbg-cyb', resources.cyber_teams != null ? resources.cyber_teams : '—');
  const fse = document.getElementById('dbg-full-state');
  if (fse && fse.style.display !== 'none') fse.textContent = JSON.stringify(state, null, 2);
}

function toggleFullState() {
  const el = document.getElementById('dbg-full-state');
  if (!el) return;
  if (el.style.display === 'none' || el.style.display === '') {
    el.style.display = 'block';
    el.textContent = JSON.stringify(lastState, null, 2);
  } else {
    el.style.display = 'none';
  }
}

// =====================================================================
// SMART ACTION PICKER — reads from lastState (backend)
// =====================================================================
function pickActions(state) {
  if (!state) return ['idle'];
  const visibleThreats = state.visible_threats || [];
  const resources = state.resources || {};
  let defenseUnits = resources.defense_units || 0;
  let cyberTeams = resources.cyber_teams || 0;
  const activeThreats = visibleThreats.filter(t => t.status === 'active');
  if (!activeThreats.length) return ['idle'];

  // Priority sort: cyber critical > drone close > cyber breach > drone > cyber probing
  const sorted = [...activeThreats].sort((a, b) => {
    function priority(t) {
      if (t.type === 'cyber') {
        if (t.stage === 'critical') return 100;
        if (t.stage === 'breach') return 70;
        return 40;
      }
      if (t.type === 'drone') {
        const d = t.distance || 30;
        return 80 - d; // closer = higher priority
      }
      return 0;
    }
    return priority(b) - priority(a);
  });

  const actions = [];
  for (const t of sorted) {
    if (t.type === 'cyber' && cyberTeams > 0) {
      actions.push('block cyber');
      cyberTeams--;
    } else if (t.type === 'drone' && defenseUnits > 0) {
      actions.push('intercept drone');
      defenseUnits--;
    }
    if (cyberTeams <= 0 && defenseUnits <= 0) break;
  }

  return actions.length ? actions : ['idle'];
}

// =====================================================================
// VIEW SWITCHING
// =====================================================================
function setView(view, el) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');
  // Lazy init charts
  if (view === 'metrics' && !metricsChart) initMetricsChart();
  if (view === 'intel' && !intelChart) { initIntelChart(); refreshIntelFeed(); updateIntelStats(); }
  if (view === 'ai' && !forecastChart) initForecastChart();
  if (view === 'metrics' && !threatDistChart) initThreatDistChart();
  if (view === 'history' && !historyChart) initHistoryChart();
  if (view === 'map') setTimeout(initAssetMap, 50);
}

// =====================================================================
// TASK SELECTION
// =====================================================================
function selectTask(task, btn) {
  currentTask = task;
  document.querySelectorAll('.task-btn').forEach(b => b.classList.remove('active-task'));
  btn.classList.add('active-task');
  addLog('system', 'TASK SELECTED: ' + task.toUpperCase() + ' — PRESS RESET TO INITIALIZE');
  setCtrlStatus('TASK: ' + task.toUpperCase() + ' — PRESS RESET TO START', 'cyan');
  setEl('hud-task', task.toUpperCase());
}

// =====================================================================
// RESET — POST /reset?task=X
// =====================================================================
async function resetSim() {
  simulationStarted = false;
  if (autoInterval) { clearInterval(autoInterval); autoInterval = null; isAutoRunning = false; }
  setStepBtnsDisabled(true);
  addLog('system', 'RESETTING ENVIRONMENT — TASK: ' + currentTask.toUpperCase());
  setCtrlStatus('RESETTING...', 'orange');
  try {
    const res = await fetch(API + '/reset?task=' + currentTask, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
    const data = await res.json();

    // Backend returns { state: {...}, message: "..." }
    const state = data.state;
    if (!state) throw new Error('No state in reset response: ' + JSON.stringify(data));

    // Clear all local display state
    allLogs = [];
    document.getElementById('logs').innerHTML = '';
    const ht = document.getElementById('history-timeline');
    if (ht) ht.innerHTML = '';
    seenThreatIds.clear();
    resolvedThreatIds.clear();
    Object.keys(blipCache).forEach(k => delete blipCache[k]);
    cumulativeScore = 0;
    lastReward = 0;
    attackCount = 0;
    lastActions = [];
    episodeDone = false;
    backendScore = null;

    lastState = state;
    setConnected(true);
    renderFromState(state);
    document.getElementById('btn-auto').innerHTML = '<span class="btn-icon">&#8635;</span> AUTO RUN';
    setStepBtnsDisabled(false);
    addLog('system', 'RESET COMPLETE — TASK: ' + currentTask.toUpperCase() + ' | ' + data.message);
    setCtrlStatus('RESET OK — TASK: ' + currentTask.toUpperCase() + ' — READY TO STEP', 'green');
  } catch (err) {
    setConnected(false);
    addLog('alert', 'RESET ERROR: ' + err.message);
    setCtrlStatus('RESET FAILED: ' + err.message + ' — IS BACKEND RUNNING?', 'red');
    setStepBtnsDisabled(false);
    console.error('[WAR ROOM] Reset error:', err);
  }
}

// =====================================================================
// STEP — POST /step with smart actions
// =====================================================================
async function runStep() {
  audioBeep.play().catch(e => {}); // Play beep on step
  simulationStarted = true;


  if (episodeDone) {
    addLog('system', 'EPISODE DONE — PRESS RESET TO RESTART');
    setCtrlStatus('EPISODE DONE — SCORE: ' + cumulativeScore.toFixed(2) + ' — PRESS RESET', 'yellow');
    return;
  }
  if (!lastState) {
    addLog('alert', 'NO STATE — CALL RESET FIRST');
    setCtrlStatus('CALL RESET FIRST', 'red');
    return;
  }

  setStepBtnsDisabled(true);

  // Pick actions based on current backend state
  const actions = pickActions(lastState);
  lastActions = actions;

  try {
    const res = await fetch(API + '/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
    const data = await res.json();

    // Backend returns { state: {...}, reward: number, done: bool }
    const state = data.state;
    const reward = typeof data.reward === 'number' ? data.reward : 0;
    const done = data.done === true;

    if (!state) throw new Error('No state in step response');

    lastState = state;
    lastReward = reward;
    cumulativeScore += reward;
    episodeDone = done;

    addLog('info', 'STEP ' + state.time + ' | ACTIONS: [' + actions.join(', ') + '] | REWARD: ' + reward.toFixed(3) + ' | SCORE: ' + cumulativeScore.toFixed(2));
    renderFromState(state);
    setCtrlStatus('STEP ' + state.time + ' OK | ACTIONS: [' + actions.join(', ') + '] | R: ' + reward.toFixed(3) + ' | SCORE: ' + cumulativeScore.toFixed(2), 'green');

    if (done) {
      if (autoInterval) { clearInterval(autoInterval); autoInterval = null; isAutoRunning = false; document.getElementById('btn-auto').innerHTML = '<span class="btn-icon">&#8635;</span> AUTO RUN'; }
      addLog('system', '═══ EPISODE COMPLETE ═══ CUMULATIVE SCORE: ' + cumulativeScore.toFixed(2));
      setCtrlStatus('EPISODE DONE — CUMUL SCORE: ' + cumulativeScore.toFixed(2) + ' — PRESS RESET', 'yellow');
      // Auto-fetch backend score on episode end
      await fetchScore();
    }
  } catch (err) {
    addLog('alert', 'STEP ERROR: ' + err.message);
    setCtrlStatus('STEP FAILED: ' + err.message, 'red');
    console.error('[WAR ROOM] Step error:', err);
    if (autoInterval) { clearInterval(autoInterval); autoInterval = null; isAutoRunning = false; document.getElementById('btn-auto').innerHTML = '<span class="btn-icon">&#8635;</span> AUTO RUN'; }
  } finally {
    setStepBtnsDisabled(false);
  }
}

// =====================================================================
// AUTO RUN
// =====================================================================
function autoRun() {
  simulationStarted = true;
  if (isAutoRunning) {
    clearInterval(autoInterval); autoInterval = null; isAutoRunning = false;
    document.getElementById('btn-auto').innerHTML = '<span class="btn-icon">&#8635;</span> AUTO RUN';
    addLog('system', 'AUTO RUN PAUSED');
    setCtrlStatus('AUTO RUN PAUSED', 'orange');
  } else {
    if (!lastState) { addLog('alert', 'RESET FIRST BEFORE AUTO RUN'); setCtrlStatus('RESET FIRST', 'red'); return; }
    isAutoRunning = true;
    document.getElementById('btn-auto').innerHTML = '<span class="btn-icon">&#9646;&#9646;</span> PAUSE';
    addLog('system', 'AUTO RUN STARTED — 1s INTERVAL');
    setCtrlStatus('AUTO RUNNING...', 'cyan');
    autoInterval = setInterval(async () => {
      if (episodeDone) { clearInterval(autoInterval); autoInterval = null; isAutoRunning = false; document.getElementById('btn-auto').innerHTML = '<span class="btn-icon">&#8635;</span> AUTO RUN'; return; }
      await runStep();
    }, 1000);
    runStep();
  }
}

function stopSimulation() {
  if (autoInterval) {
    clearInterval(autoInterval);
    autoInterval = null;
    isAutoRunning = false;
  }

  const btn = document.getElementById('btn-auto');
  if (btn) {
    btn.innerHTML = '<span class="btn-icon">&#8635;</span> AUTO RUN';
  }

  addLog('system', '🚨 MAX ATTACK LIMIT REACHED — SIMULATION STOPPED');
  setCtrlStatus('STOPPED — TOO MANY THREATS', 'red');
}

// =====================================================================
// FETCH STATE — GET /state
// =====================================================================
async function fetchState() {
  setCtrlStatus('FETCHING STATE...', 'cyan');
  try {
    const res = await fetch(API + '/state');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    // /state returns state directly (not wrapped)
    const state = data.state || data;
    if (!state || state.error) throw new Error(state && state.error ? state.error : 'Invalid state response');
    lastState = state;
    renderFromState(state);
    addLog('info', 'STATE FETCHED — TIME:' + state.time + ' DMG:' + state.damage + ' THREATS:' + (state.visible_threats || []).length);
    setCtrlStatus('STATE FETCHED — DMG:' + state.damage + ' TIME:' + state.time, 'green');
    setConnected(true);
  } catch (err) {
    addLog('alert', 'STATE ERROR: ' + err.message);
    setCtrlStatus('STATE FAILED: ' + err.message, 'red');
    setConnected(false);
    console.error('[WAR ROOM] State error:', err);
  }
}

// =====================================================================
// FETCH SCORE — GET /score
// =====================================================================
async function fetchScore() {
  setCtrlStatus('FETCHING SCORE...', 'yellow');
  try {
    const res = await fetch(API + '/score');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.score == null) throw new Error('No score in response');
    backendScore = data.score;
    addLog('system', 'BACKEND SCORE: ' + backendScore.toFixed(3) + ' | CUMUL REWARD: ' + cumulativeScore.toFixed(2) + ' | TASK: ' + currentTask.toUpperCase());
    setEl('stat-backend-score', backendScore.toFixed(3));
    setEl('hud-score', backendScore.toFixed(3));
    setEl('bm-backend-score', backendScore.toFixed(3));
    const bsBar = document.getElementById('bm-bs-bar');
    if (bsBar) bsBar.style.width = (backendScore * 100) + '%';
    const bsTrend = document.getElementById('bm-bs-trend');
    if (bsTrend) { bsTrend.textContent = backendScore >= 0.7 ? '✓ Excellent performance' : backendScore >= 0.4 ? '⚠ Acceptable performance' : '✗ Needs improvement'; bsTrend.style.color = backendScore >= 0.7 ? 'var(--green)' : backendScore >= 0.4 ? 'var(--orange)' : 'var(--red)'; }
    setEl('dbg-backend-score', backendScore.toFixed(3));
    setCtrlStatus('BACKEND SCORE: ' + backendScore.toFixed(3) + ' (0–1 GRADED)', 'yellow');
  } catch (err) {
    addLog('alert', 'SCORE ERROR: ' + err.message);
    setCtrlStatus('SCORE FAILED: ' + err.message, 'red');
    console.error('[WAR ROOM] Score error:', err);
  }
}

// =====================================================================
// AI CHAT INTERFACE
// =====================================================================
function sendAIQuery() {
  const input = document.getElementById('ai-input');
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;
  const msgs = document.getElementById('ai-chat-messages');
  if (!msgs) return;

  // User message
  const um = document.createElement('div');
  um.className = 'ai-msg user-msg';
  um.innerHTML = '<div class="ai-msg-label">OPERATOR</div>' + query;
  msgs.appendChild(um);
  msgs.scrollTop = msgs.scrollHeight;
  input.value = '';

  // AI response from live state
  setTimeout(() => {
    const resp = buildChatResponse(query.toLowerCase());
    const am = document.createElement('div');
    am.className = 'ai-msg';
    am.innerHTML = '<div class="ai-msg-label">AI SYSTEM</div>' + resp;
    msgs.appendChild(am);
    msgs.scrollTop = msgs.scrollHeight;
  }, 300);
}

function buildChatResponse(q) {
  const state = lastState;
  if (!state) return 'No backend state available. Call RESET first.';
  const visThreats = state.visible_threats || [];
  const allThreats = state.threats || [];
  const active = visThreats.filter(t => t.status === 'active');
  const resolved = allThreats.filter(t => t.status === 'resolved');
  const resources = state.resources || {};
  const damage = state.damage || 0;

  if (q.includes('score') || q.includes('reward')) {
    return 'SCORE REPORT\nBackend grader score: ' + (backendScore != null ? backendScore.toFixed(3) : '(fetch /score)') + '\nCumulative reward: ' + cumulativeScore.toFixed(2) + '\nLast reward: ' + lastReward.toFixed(3) + '\nSteps: ' + state.time;
  }
  if (q.includes('threat') || q.includes('attack') || q.includes('status')) {
    return 'THREAT STATUS — Step ' + state.time + '\nActive threats: ' + active.length + '\n' + active.map(t => '• ID:' + t.id + ' ' + t.type.toUpperCase() + ' [' + (t.stage || ('d=' + (t.distance || '?'))) + ']').join('\n') + '\nResolved: ' + resolved.length + '\nDamage: ' + damage;
  }
  if (q.includes('resource') || q.includes('unit') || q.includes('team')) {
    return 'RESOURCE STATUS\nDefense units: ' + (resources.defense_units || 0) + '\nCyber teams: ' + (resources.cyber_teams || 0) + '\nLast actions: [' + (lastActions.join(', ') || 'none') + ']';
  }
  if (q.includes('recommend') || q.includes('action') || q.includes('what should')) {
    const rec = pickActions(state);
    return 'TACTICAL RECOMMENDATION\nRecommended actions: [' + rec.join(', ') + ']\nBased on ' + active.length + ' active threats and available resources.\nDamage so far: ' + damage + '\nPriority: ' + (active.length > 0 ? active[0].type.toUpperCase() + ' ID:' + active[0].id : 'NONE — IDLE');
  }
  if (q.includes('damage') || q.includes('health')) {
    return 'DAMAGE REPORT\nCurrent damage: ' + damage + '/10 (episode ends at 10)\nRisk level: ' + (damage < 3 ? 'LOW' : damage < 7 ? 'MODERATE' : 'CRITICAL') + '\nThreats remaining: ' + active.length;
  }
  return 'I am analyzing the live backend state. Current step: ' + state.time + ', damage: ' + damage + ', active threats: ' + active.length + '. Type "status", "score", "recommend", or "resources" for specific intel.';
}

// =====================================================================
// UTILITY
// =====================================================================
function setStepBtnsDisabled(disabled) {
  ['btn-step', 'btn-auto'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
}

// =====================================================================
// INIT
// =====================================================================
async function init() {
  startClock();
  initMainChart();
  addLog('system', 'WAR ROOM COMMAND v3.0 INITIALIZED');
  addLog('system', 'BACKEND: ' + API);
  addLog('system', 'SELECT TASK → PRESS RESET → PRESS STEP or AUTO RUN');

  // Try to ping backend
  try {
    const res = await fetch(API + '/', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      setConnected(true);
      addLog('system', 'BACKEND ONLINE — ' + JSON.stringify(data));
      setCtrlStatus('BACKEND ONLINE — SELECT TASK AND PRESS RESET', 'green');
      // Auto-reset with default task
      await resetSim();
    } else {
      throw new Error('HTTP ' + res.status);
    }
  } catch (err) {
    setConnected(false);
    addLog('alert', 'BACKEND OFFLINE: ' + err.message);
    addLog('system', 'START BACKEND: uvicorn backend.api.main:app --host 0.0.0.0 --port 7860');
    setCtrlStatus('BACKEND OFFLINE — START WITH: uvicorn backend.api.main:app --port 7860', 'red');
  }
}

window.onload = init;