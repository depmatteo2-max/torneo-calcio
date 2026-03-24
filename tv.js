// ============================================================
//  TV.JS — Modalità TV ottimizzata per Chromecast
//  Font grandi, auto-scorrimento, niente admin
// ============================================================

let TV_MODE = false;
let TV_INTERVAL = null;
let TV_CAT_INDEX = 0;
let TV_SECTION_INDEX = 0;
const TV_SECTIONS = ['classifiche', 'risultati'];
const TV_SECTION_DURATION = 12000; // 12 secondi per sezione

// ============================================================
//  ATTIVA / DISATTIVA TV MODE
// ============================================================
function toggleTVMode() {
  if (TV_MODE) {
    exitTVMode();
  } else {
    enterTVMode();
  }
}

function enterTVMode() {
  TV_MODE = true;
  TV_CAT_INDEX = 0;
  TV_SECTION_INDEX = 0;

  // Richiedi fullscreen
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();

  // Aggiungi classe al body
  document.body.classList.add('tv-active');

  // Nascondi elementi non necessari
  document.getElementById('admin-btn').style.display = 'none';
  document.getElementById('cat-bar').style.display = 'none';

  // Crea overlay TV
  creaOverlayTV();

  // Avvia auto-scorrimento
  avviaAutoScorrimento();

  // Aggiorna pulsante
  const btn = document.getElementById('tv-btn');
  if (btn) btn.textContent = '✕ Esci TV';
}

function exitTVMode() {
  TV_MODE = false;

  // Esci dal fullscreen
  if (document.exitFullscreen) document.exitFullscreen();
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();

  // Rimuovi classe
  document.body.classList.remove('tv-active');

  // Ripristina elementi
  document.getElementById('admin-btn').style.display = '';
  document.getElementById('cat-bar').style.display = '';

  // Rimuovi overlay TV
  const overlay = document.getElementById('tv-overlay');
  if (overlay) overlay.remove();

  // Ferma auto-scorrimento
  if (TV_INTERVAL) clearInterval(TV_INTERVAL);
  TV_INTERVAL = null;

  // Aggiorna pulsante
  const btn = document.getElementById('tv-btn');
  if (btn) btn.textContent = '📺 TV';

  // Torna alla vista normale
  renderCurrentSection();
}

// ============================================================
//  CREA OVERLAY TV
// ============================================================
function creaOverlayTV() {
  const old = document.getElementById('tv-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tv-overlay';
  overlay.innerHTML = `
    <div id="tv-header">
      <div id="tv-logo-area">
        <img id="tv-logo-img" src="" alt="SPE" style="display:none;">
        <div id="tv-titolo">Soccer Pro Experience</div>
      </div>
      <div id="tv-info">
        <div id="tv-orologio">--:--</div>
        <div id="tv-live-badge">● LIVE</div>
      </div>
    </div>
    <div id="tv-content"></div>
    <div id="tv-footer">
      <div id="tv-cat-nome"></div>
      <div id="tv-progress-bar"><div id="tv-progress-inner"></div></div>
      <button onclick="exitTVMode()" id="tv-exit-btn">✕ Esci</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Aggiorna orologio ogni secondo
  aggiornaOrologioTV();
  setInterval(aggiornaOrologioTV, 1000);

  // Aggiorna logo se disponibile
  const logo = document.getElementById('header-logo');
  if (logo && logo.src && !logo.src.includes('undefined')) {
    const tvLogo = document.getElementById('tv-logo-img');
    tvLogo.src = logo.src;
    tvLogo.style.display = 'block';
  }

  // Aggiorna titolo torneo
  const titolo = document.getElementById('header-title');
  if (titolo) document.getElementById('tv-titolo').textContent = titolo.textContent;

  // Renderizza prima schermata
  renderTV();
}

function aggiornaOrologioTV() {
  const el = document.getElementById('tv-orologio');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
//  AUTO-SCORRIMENTO
// ============================================================
function avviaAutoScorrimento() {
  if (TV_INTERVAL) clearInterval(TV_INTERVAL);

  // Avvia progress bar
  avviaProgressBar();

  TV_INTERVAL = setInterval(() => {
    prossimaSchermataTv();
  }, TV_SECTION_DURATION);
}

function avviaProgressBar() {
  const bar = document.getElementById('tv-progress-inner');
  if (!bar) return;
  bar.style.transition = 'none';
  bar.style.width = '0%';
  setTimeout(() => {
    bar.style.transition = `width ${TV_SECTION_DURATION}ms linear`;
    bar.style.width = '100%';
  }, 50);
}

function prossimaSchermataTv() {
  if (!STATE.categorie || !STATE.categorie.length) return;

  TV_SECTION_INDEX++;
  if (TV_SECTION_INDEX >= TV_SECTIONS.length) {
    TV_SECTION_INDEX = 0;
    TV_CAT_INDEX = (TV_CAT_INDEX + 1) % STATE.categorie.length;
  }

  STATE.activeCat = STATE.categorie[TV_CAT_INDEX].id;
  renderTV();
  avviaProgressBar();
}

// ============================================================
//  RENDER TV
// ============================================================
async function renderTV() {
  if (!TV_MODE) return;
  const section = TV_SECTIONS[TV_SECTION_INDEX];
  const cat = STATE.categorie[TV_CAT_INDEX];
  if (!cat) return;

  // Aggiorna nome categoria nel footer
  const catNome = document.getElementById('tv-cat-nome');
  if (catNome) {
    const sectionNome = section === 'classifiche' ? '📊 Classifica' : '⚽ Risultati';
    catNome.textContent = `${sectionNome} — ${cat.nome}`;
  }

  const content = document.getElementById('tv-content');
  if (!content) return;

  content.style.opacity = '0';
  content.style.transform = 'translateY(10px)';

  if (section === 'classifiche') {
    await renderTVClassifiche(cat, content);
  } else {
    await renderTVRisultati(cat, content);
  }

  // Animazione entrata
  setTimeout(() => {
    content.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    content.style.opacity = '1';
    content.style.transform = 'translateY(0)';
  }, 50);
}

async function renderTVClassifiche(cat, content) {
  const gironi = await getGironiWithData(cat.id);
  let html = '';

  for (const g of gironi) {
    const cl = calcGironeClassifica(g);
    const played = g.partite.filter(p => p.giocata).length;

    html += `<div class="tv-girone">
      <div class="tv-girone-title">${g.nome} <span class="tv-badge">${played}/${g.partite.length}</span></div>
      <table class="tv-table">
        <thead><tr>
          <th style="width:30px;"></th>
          <th style="text-align:left;">Squadra</th>
          <th>G</th><th>V</th><th>P</th><th>S</th>
          <th style="color:#4ade80;">GF</th>
          <th style="color:#f87171;">GS</th>
          <th>GD</th>
          <th style="color:#FFD700;">Pt</th>
        </tr></thead>
        <tbody>`;

    cl.forEach((row, idx) => {
      const q = idx < (cat.qualificate || 2);
      const diff = row.gf - row.gs;
      html += `<tr class="${q ? 'tv-qualifies' : ''}">
        <td>${q ? '<span class="tv-q-dot"></span>' : ''}</td>
        <td style="text-align:left;font-weight:${q?'700':'400'}">
          ${logoHTML(row.sq, 'sm')} ${row.sq.nome}
        </td>
        <td>${row.g}</td><td>${row.v}</td><td>${row.p}</td><td>${row.s}</td>
        <td style="color:#4ade80;font-weight:600;">${row.gf}</td>
        <td style="color:#f87171;font-weight:600;">${row.gs}</td>
        <td style="color:${diff>0?'#4ade80':diff<0?'#f87171':'#aaa'}">${diff>0?'+':''}${diff}</td>
        <td style="color:#FFD700;font-weight:800;">${row.pts}</td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
  }

  content.innerHTML = html || '<div class="tv-empty">Nessun dato disponibile</div>';
}

async function renderTVRisultati(cat, content) {
  const gironi = await getGironiWithData(cat.id);
  let html = '';

  for (const g of gironi) {
    const giocate = g.partite.filter(p => p.giocata);
    const dafar = g.partite.filter(p => !p.giocata).slice(0, 4);

    if (giocate.length) {
      html += `<div class="tv-girone-title">${g.nome} — Risultati</div>`;
      html += `<div class="tv-risultati">`;
      for (const p of giocate.slice(-6)) {
        const w1 = p.gol_home > p.gol_away, w2 = p.gol_away > p.gol_home;
        html += `<div class="tv-partita">
          <div class="tv-team ${w1?'tv-winner':''}">${logoHTML(p.home,'sm')} ${p.home?.nome||'?'}</div>
          <div class="tv-score">${p.gol_home} — ${p.gol_away}</div>
          <div class="tv-team right ${w2?'tv-winner':''}">${p.away?.nome||'?'} ${logoHTML(p.away,'sm')}</div>
        </div>`;
      }
      html += `</div>`;
    }

    if (dafar.length) {
      html += `<div class="tv-girone-title" style="margin-top:16px;">${g.nome} — Prossime partite</div>`;
      html += `<div class="tv-risultati">`;
      for (const p of dafar) {
        html += `<div class="tv-partita tv-pending">
          <div class="tv-team">${logoHTML(p.home,'sm')} ${p.home?.nome||'?'}</div>
          <div class="tv-score tv-vs">${p.orario||'vs'}</div>
          <div class="tv-team right">${p.away?.nome||'?'} ${logoHTML(p.away,'sm')}</div>
        </div>`;
      }
      html += `</div>`;
    }
  }

  content.innerHTML = html || '<div class="tv-empty">Nessun risultato disponibile</div>';
}

// ============================================================
//  AGGIUNGI PULSANTE TV ALL'HEADER
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const headerRight = document.querySelector('.header-right');
  if (headerRight) {
    const btn = document.createElement('button');
    btn.id = 'tv-btn';
    btn.textContent = '📺 TV';
    btn.className = 'tv-toggle-btn';
    btn.onclick = toggleTVMode;
    // Inserisci prima del pulsante Admin
    const adminBtn = document.getElementById('admin-btn');
    headerRight.insertBefore(btn, adminBtn);
  }
});

// ============================================================
//  CSS TV MODE
// ============================================================
const tvCSS = `
/* PULSANTE TV */
.tv-toggle-btn {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  padding: 5px 12px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  margin-right: 6px;
}
.tv-toggle-btn:hover { background: rgba(255,255,255,0.25); }

/* OVERLAY TV FULLSCREEN */
#tv-overlay {
  position: fixed;
  inset: 0;
  background: #0a0e1a;
  z-index: 99998;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: inherit;
}

/* HEADER TV */
#tv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 32px;
  background: linear-gradient(135deg, #0d1b3e 0%, #1a3a6e 100%);
  border-bottom: 2px solid #2563eb;
  flex-shrink: 0;
}
#tv-logo-area {
  display: flex;
  align-items: center;
  gap: 14px;
}
#tv-logo-img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255,255,255,0.3);
}
#tv-titolo {
  font-size: 22px;
  font-weight: 800;
  color: white;
  letter-spacing: .02em;
}
#tv-info {
  display: flex;
  align-items: center;
  gap: 16px;
}
#tv-orologio {
  font-size: 28px;
  font-weight: 900;
  color: white;
  font-variant-numeric: tabular-nums;
}
#tv-live-badge {
  background: #ef4444;
  color: white;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 99px;
  letter-spacing: .06em;
  animation: livePulse 2s ease infinite;
}
@keyframes livePulse {
  0%,100% { opacity:1; }
  50% { opacity:0.6; }
}

/* CONTENUTO TV */
#tv-content {
  flex: 1;
  overflow: hidden;
  padding: 16px 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* FOOTER TV */
#tv-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 32px;
  background: rgba(0,0,0,0.4);
  flex-shrink: 0;
}
#tv-cat-nome {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
  letter-spacing: .04em;
}
#tv-progress-bar {
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.1);
  border-radius: 99px;
  margin: 0 20px;
  overflow: hidden;
}
#tv-progress-inner {
  height: 100%;
  background: #2563eb;
  border-radius: 99px;
  width: 0%;
}
#tv-exit-btn {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.6);
  padding: 4px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
}
#tv-exit-btn:hover { background: rgba(255,255,255,0.2); color: white; }

/* GIRONE TITLE */
.tv-girone {
  flex: 1;
  overflow: hidden;
}
.tv-girone-title {
  font-size: 15px;
  font-weight: 700;
  color: #60a5fa;
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.tv-badge {
  font-size: 11px;
  background: rgba(96,165,250,0.15);
  color: #60a5fa;
  padding: 2px 8px;
  border-radius: 99px;
  font-weight: 600;
}

/* TABELLA TV */
.tv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 18px;
}
.tv-table th {
  color: rgba(255,255,255,0.4);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .06em;
  padding: 6px 12px;
  text-align: center;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.tv-table td {
  padding: 10px 12px;
  text-align: center;
  color: rgba(255,255,255,0.85);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: 17px;
}
.tv-table tr.tv-qualifies td {
  background: rgba(37,99,235,0.08);
}
.tv-table tr:hover td { background: rgba(255,255,255,0.03); }
.tv-q-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
}

/* RISULTATI TV */
.tv-risultati {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tv-partita {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  padding: 10px 16px;
  gap: 12px;
}
.tv-partita.tv-pending {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
}
.tv-team {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
  display: flex;
  align-items: center;
  gap: 8px;
}
.tv-team.right {
  flex-direction: row-reverse;
  text-align: right;
}
.tv-team.tv-winner {
  color: #22c55e;
  font-weight: 800;
}
.tv-score {
  font-size: 28px;
  font-weight: 900;
  color: white;
  min-width: 90px;
  text-align: center;
  background: rgba(37,99,235,0.3);
  border-radius: 8px;
  padding: 4px 12px;
  border: 1px solid rgba(37,99,235,0.5);
}
.tv-score.tv-vs {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255,255,255,0.4);
  background: transparent;
  border-color: rgba(255,255,255,0.1);
}
.tv-empty {
  color: rgba(255,255,255,0.3);
  font-size: 18px;
  text-align: center;
  margin-top: 40px;
}

/* Nascondi header/nav normali in TV mode */
body.tv-active > #app > #main-app > header { display: none !important; }
body.tv-active > #app > #main-app > nav { display: none !important; }
body.tv-active > #app > #main-app > .torneo-bar { display: none !important; }
body.tv-active > #app > #main-app > .cat-bar { display: none !important; }
body.tv-active > #app > #main-app > main { display: none !important; }
`;

const tvStyle = document.createElement('style');
tvStyle.textContent = tvCSS;
document.head.appendChild(tvStyle);
