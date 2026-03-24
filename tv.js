// ============================================================
//  TV.JS — Modalità TV + Chromecast integrato
// ============================================================

let TV_MODE = false;
let TV_INTERVAL = null;
let TV_SCROLL_INTERVAL = null;
let TV_CAT_INDEX = 0;
let TV_SECTION_INDEX = 0;
const TV_SECTIONS = ['classifiche', 'risultati'];
const TV_SCROLL_SPEED = 1.2; // pixel per frame (velocità scorrimento)
const TV_PAUSE_TOP = 3000;   // ms di pausa in cima prima di scorrere
const TV_PAUSE_BOTTOM = 4000; // ms di pausa in fondo prima di cambiare

// ============================================================
//  CHROMECAST — guida integrata
// ============================================================

function initChromecast() {
  // Nessun SDK necessario — usiamo il cast nativo di Chrome
}

function avviaChomecast() {
  mostraIstruzioniCast();
}

function mostraIstruzioniCast() {
  const old = document.getElementById('cast-modal');
  if (old) { old.remove(); return; }

  const div = document.createElement('div');
  div.id = 'cast-modal';
  div.innerHTML = `
    <div class="cast-box">
      <div class="cast-title">📺 Come trasmettere alla TV</div>
      <div class="cast-steps">
        <div class="cast-step">
          <span class="cast-num">1</span>
          <div>
            <strong>Attiva la modalità TV</strong><br>
            <span>Clicca il pulsante <b>📺 TV</b> accanto a questo pulsante</span>
          </div>
        </div>
        <div class="cast-step">
          <span class="cast-num">2</span>
          <div>
            <strong>Trasmetti con Chrome</strong><br>
            <span>Clicca i <b>3 puntini ⋮</b> in alto a destra nel browser</span>
          </div>
        </div>
        <div class="cast-step">
          <span class="cast-num">3</span>
          <div>
            <strong>Seleziona "Trasmetti"</strong><br>
            <span>Poi scegli il tuo <b>Chromecast</b> o <b>Smart TV</b> dalla lista</span>
          </div>
        </div>
        <div class="cast-step">
          <span class="cast-num">4</span>
          <div>
            <strong>Schermo intero automatico</strong><br>
            <span>La modalità TV va in fullscreen sulla TV — nessun altro tasto!</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button onclick="enterTVMode();document.getElementById('cast-modal').remove();"
          style="flex:1;padding:10px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">
          📺 Attiva modalità TV ora
        </button>
        <button onclick="document.getElementById('cast-modal').remove()"
          style="padding:10px 16px;background:#f5f5f5;color:#333;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:inherit;">
          Chiudi
        </button>
      </div>
    </div>`;
  document.body.appendChild(div);
}

// ============================================================
//  TV MODE
// ============================================================
function toggleTVMode() {
  TV_MODE ? exitTVMode() : enterTVMode();
}

function enterTVMode() {
  TV_MODE = true;
  TV_CAT_INDEX = 0;
  TV_SECTION_INDEX = 0;

  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(()=>{});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();

  document.body.classList.add('tv-active');
  creaOverlayTV();
  avviaAutoScorrimento();

  const btn = document.getElementById('tv-btn');
  if (btn) btn.textContent = '✕ Esci TV';
}

function exitTVMode() {
  TV_MODE = false;

  if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();

  document.body.classList.remove('tv-active');
  const overlay = document.getElementById('tv-overlay');
  if (overlay) overlay.remove();

  if (TV_INTERVAL) { clearInterval(TV_INTERVAL); TV_INTERVAL = null; }
  if (TV_SCROLL_INTERVAL) { cancelAnimationFrame(TV_SCROLL_INTERVAL); TV_SCROLL_INTERVAL = null; }

  const btn = document.getElementById('tv-btn');
  if (btn) btn.textContent = '📺 TV';
}

// ============================================================
//  OVERLAY
// ============================================================
function creaOverlayTV() {
  const old = document.getElementById('tv-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tv-overlay';
  overlay.innerHTML = `
    <div id="tv-header">
      <div id="tv-logo-area">
        <img id="tv-logo-img" style="display:none;width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.3);" alt="">
        <div id="tv-titolo">Soccer Pro Experience</div>
      </div>
      <div id="tv-info">
        <div id="tv-live-badge">● LIVE</div>
        <div id="tv-orologio">--:--</div>
      </div>
    </div>
    <div id="tv-content"></div>
    <div id="tv-footer">
      <div id="tv-cat-nome"></div>
      <div id="tv-progress-bar"><div id="tv-progress-inner"></div></div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button onclick="saltaAvanti()" id="tv-skip-btn">⏭ Avanti</button>
        <button onclick="exitTVMode()" id="tv-exit-btn">✕ Esci</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Orologio
  aggiornaOrologioTV();
  setInterval(aggiornaOrologioTV, 1000);

  // Logo
  const headerLogo = document.getElementById('header-logo');
  if (headerLogo && headerLogo.src && headerLogo.src.length > 80) {
    const tvLogo = document.getElementById('tv-logo-img');
    tvLogo.src = headerLogo.src;
    tvLogo.style.display = 'block';
  }

  // Titolo
  const titolo = document.getElementById('header-title');
  if (titolo) document.getElementById('tv-titolo').textContent = titolo.textContent;

  renderTV();
}

function aggiornaOrologioTV() {
  const el = document.getElementById('tv-orologio');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' });
}

function saltaAvanti() {
  prossimaSchermataTv();
}

// ============================================================
//  AUTO-SCORRIMENTO
// ============================================================
function avviaAutoScorrimento() {
  if (TV_INTERVAL) clearInterval(TV_INTERVAL);
  if (TV_SCROLL_INTERVAL) cancelAnimationFrame(TV_SCROLL_INTERVAL);
  // Aspetta un po' prima di iniziare a scorrere
  setTimeout(() => avviaScrollLento(), TV_PAUSE_TOP);
}

function avviaScrollLento() {
  if (!TV_MODE) return;
  const content = document.getElementById('tv-content');
  if (!content) return;

  // Resetta scroll in cima
  content.scrollTop = 0;

  let lastTime = null;
  let pausando = false;

  function scroll(timestamp) {
    if (!TV_MODE) return;
    if (!lastTime) lastTime = timestamp;
    const delta = timestamp - lastTime;
    lastTime = timestamp;

    const maxScroll = content.scrollHeight - content.clientHeight;

    if (content.scrollTop >= maxScroll - 2) {
      // Arrivato in fondo — pausa poi cambia schermata
      if (!pausando) {
        pausando = true;
        aggiornaProgressBar(1);
        setTimeout(() => {
          if (TV_MODE) prossimaSchermataTv();
        }, TV_PAUSE_BOTTOM);
      }
      return;
    }

    // Scorri verso il basso
    content.scrollTop += TV_SCROLL_SPEED * (delta / 16.67);

    // Aggiorna progress bar proporzionalmente
    const prog = maxScroll > 0 ? content.scrollTop / maxScroll : 0;
    aggiornaProgressBar(prog);

    TV_SCROLL_INTERVAL = requestAnimationFrame(scroll);
  }

  TV_SCROLL_INTERVAL = requestAnimationFrame(scroll);
}

function aggiornaProgressBar(percentuale) {
  const bar = document.getElementById('tv-progress-inner');
  if (!bar) return;
  bar.style.transition = 'none';
  bar.style.width = (percentuale * 100) + '%';
}

function prossimaSchermataTv() {
  if (!STATE.categorie || !STATE.categorie.length) return;
  if (TV_SCROLL_INTERVAL) { cancelAnimationFrame(TV_SCROLL_INTERVAL); TV_SCROLL_INTERVAL = null; }

  TV_SECTION_INDEX++;
  if (TV_SECTION_INDEX >= TV_SECTIONS.length) {
    TV_SECTION_INDEX = 0;
    TV_CAT_INDEX = (TV_CAT_INDEX + 1) % STATE.categorie.length;
  }
  STATE.activeCat = STATE.categorie[TV_CAT_INDEX].id;
  aggiornaProgressBar(0);
  renderTV().then(() => {
    setTimeout(() => avviaScrollLento(), TV_PAUSE_TOP);
  });
}

// ============================================================
//  RENDER
// ============================================================
async function renderTV() {
  if (!TV_MODE) return;
  const section = TV_SECTIONS[TV_SECTION_INDEX];
  const cat = STATE.categorie[TV_CAT_INDEX];
  if (!cat) return;

  const catNomeEl = document.getElementById('tv-cat-nome');
  if (catNomeEl) {
    const icon = section === 'classifiche' ? '📊' : '⚽';
    catNomeEl.textContent = `${icon} ${section === 'classifiche' ? 'Classifica' : 'Risultati'} — ${cat.nome}`;
  }

  const content = document.getElementById('tv-content');
  if (!content) return;

  content.style.opacity = '0';

  if (section === 'classifiche') {
    await renderTVClassifiche(cat, content);
  } else {
    await renderTVRisultati(cat, content);
  }

  setTimeout(() => {
    content.style.transition = 'opacity 0.4s ease';
    content.style.opacity = '1';
  }, 50);
}

async function renderTVClassifiche(cat, content) {
  const gironi = await getGironiWithData(cat.id);
  let html = '<div class="tv-gironi-grid">';

  for (const g of gironi) {
    const cl = calcGironeClassifica(g);
    const played = g.partite.filter(p => p.giocata).length;
    html += `<div class="tv-block">
      <div class="tv-block-title">${g.nome} <span class="tv-badge">${played}/${g.partite.length} partite</span></div>
      <table class="tv-table">
        <thead><tr>
          <th style="width:24px;"></th>
          <th style="text-align:left;min-width:160px;">Squadra</th>
          <th>G</th><th>V</th><th>P</th><th>S</th>
          <th class="tv-gf">GF</th>
          <th class="tv-gs">GS</th>
          <th>GD</th>
          <th class="tv-pt">Pt</th>
        </tr></thead><tbody>`;
    cl.forEach((row, idx) => {
      const q = idx < (cat.qualificate || 2);
      const diff = row.gf - row.gs;
      html += `<tr class="${q ? 'tv-q' : ''}">
        <td>${q ? '<span class="tv-qdot"></span>' : ''}</td>
        <td class="tv-team-cell">
          ${logoHTML(row.sq,'sm')} <span>${row.sq.nome}</span>
        </td>
        <td>${row.g}</td><td>${row.v}</td><td>${row.p}</td><td>${row.s}</td>
        <td class="tv-gf">${row.gf}</td>
        <td class="tv-gs">${row.gs}</td>
        <td class="${diff>0?'tv-pos':diff<0?'tv-neg':''}">${diff>0?'+':''}${diff}</td>
        <td class="tv-pt">${row.pts}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  html += '</div>';
  content.innerHTML = html || '<div class="tv-empty">Nessun dato disponibile</div>';
}

async function renderTVRisultati(cat, content) {
  const gironi = await getGironiWithData(cat.id);
  let html = '<div class="tv-risultati-grid">';

  for (const g of gironi) {
    const giocate = g.partite.filter(p => p.giocata);
    const dafar   = g.partite.filter(p => !p.giocata);

    html += `<div class="tv-block">`;
    html += `<div class="tv-block-title">${g.nome}</div>`;

    // Tutte le partite giocate
    for (const p of giocate) {
      const w1 = p.gol_home > p.gol_away;
      const w2 = p.gol_away > p.gol_home;
      const orario = p.orario ? `<span class="tv-orario">${p.orario}${p.campo ? ' · '+p.campo : ''}</span>` : '';
      html += `<div class="tv-match tv-played">
        ${orario}
        <div class="tv-match-row">
          <div class="tv-mteam ${w1?'tv-win':''}">${logoHTML(p.home,'sm')} <span>${p.home?.nome||'?'}</span></div>
          <div class="tv-mscore">${p.gol_home} — ${p.gol_away}</div>
          <div class="tv-mteam right ${w2?'tv-win':''}"><span>${p.away?.nome||'?'}</span> ${logoHTML(p.away,'sm')}</div>
        </div>
      </div>`;
    }

    // Partite da giocare
    for (const p of dafar) {
      const orario = p.orario ? `<span class="tv-orario">${p.orario}${p.campo ? ' · '+p.campo : ''}</span>` : '';
      html += `<div class="tv-match tv-upcoming">
        ${orario}
        <div class="tv-match-row">
          <div class="tv-mteam">${logoHTML(p.home,'sm')} <span>${p.home?.nome||'?'}</span></div>
          <div class="tv-mscore tv-vs">vs</div>
          <div class="tv-mteam right"><span>${p.away?.nome||'?'}</span> ${logoHTML(p.away,'sm')}</div>
        </div>
      </div>`;
    }

    if (!giocate.length && !dafar.length) {
      html += `<div class="tv-empty">Nessuna partita</div>`;
    }

    html += `</div>`;
  }

  html += '</div>';
  content.innerHTML = html;
}

// ============================================================
//  PULSANTI HEADER — aggiunti al caricamento
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;
  const adminBtn = document.getElementById('admin-btn');

  // Pulsante Chromecast
  const castBtn = document.createElement('button');
  castBtn.id = 'cast-btn';
  castBtn.textContent = '📺 Chromecast';
  castBtn.className = 'tv-toggle-btn';
  castBtn.onclick = avviaChomecast;
  headerRight.insertBefore(castBtn, adminBtn);

  // Inizializza Chromecast SDK
  initChromecast();
});

// ============================================================
//  CSS
// ============================================================
const tvCSS = `
.tv-toggle-btn {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  padding: 5px 11px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  margin-right: 5px;
  transition: background 0.15s;
}
.tv-toggle-btn:hover { background: rgba(255,255,255,0.28); }

#tv-overlay {
  position: fixed;
  inset: 0;
  background: #060b18;
  z-index: 99998;
  display: flex;
  flex-direction: column;
  font-family: inherit;
  overflow: hidden;
}

#tv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 28px;
  background: linear-gradient(135deg, #0d1b3e 0%, #1a3a6e 100%);
  border-bottom: 2px solid #2563eb;
  flex-shrink: 0;
}
#tv-logo-area { display:flex; align-items:center; gap:12px; }
#tv-titolo { font-size:20px; font-weight:800; color:white; }
#tv-info { display:flex; align-items:center; gap:14px; }
#tv-orologio { font-size:26px; font-weight:900; color:white; font-variant-numeric:tabular-nums; }
#tv-live-badge {
  background:#ef4444; color:white; font-size:11px; font-weight:700;
  padding:3px 10px; border-radius:99px; letter-spacing:.06em;
  animation: tvLivePulse 1.8s ease infinite;
}
@keyframes tvLivePulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

#tv-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 28px;
  scrollbar-width: none;
}
#tv-content::-webkit-scrollbar { display: none; }

#tv-footer {
  display: flex;
  align-items: center;
  padding: 7px 28px;
  background: rgba(0,0,0,0.6);
  flex-shrink: 0;
  gap: 14px;
}
#tv-cat-nome { font-size:13px; font-weight:600; color:rgba(255,255,255,0.6); white-space:nowrap; }
#tv-progress-bar { flex:1; height:3px; background:rgba(255,255,255,0.1); border-radius:99px; overflow:hidden; }
#tv-progress-inner { height:100%; background:#2563eb; width:0%; }
#tv-skip-btn, #tv-exit-btn {
  background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15);
  color:rgba(255,255,255,0.5); padding:4px 10px; border-radius:8px;
  cursor:pointer; font-size:11px; font-family:inherit; white-space:nowrap;
}
#tv-skip-btn:hover, #tv-exit-btn:hover { background:rgba(255,255,255,0.18); color:white; }

/* GRIGLIA GIRONI — affiancati se più gironi */
.tv-gironi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 14px;
}
.tv-risultati-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 14px;
}

.tv-block { overflow: hidden; }
.tv-block-title {
  font-size:14px; font-weight:700; color:#60a5fa;
  text-transform:uppercase; letter-spacing:.05em;
  margin-bottom:6px; display:flex; align-items:center; gap:8px;
}
.tv-badge {
  font-size:11px; background:rgba(96,165,250,0.15); color:#60a5fa;
  padding:2px 8px; border-radius:99px; font-weight:600; text-transform:none;
}

/* TABELLA CLASSIFICA */
.tv-table { width:100%; border-collapse:collapse; font-size:16px; }
.tv-table th {
  color:rgba(255,255,255,0.3); font-size:11px; font-weight:700;
  text-transform:uppercase; letter-spacing:.05em;
  padding:4px 8px; text-align:center;
  border-bottom:1px solid rgba(255,255,255,0.07);
}
.tv-table td {
  padding:8px 8px; text-align:center;
  color:rgba(255,255,255,0.8);
  border-bottom:1px solid rgba(255,255,255,0.04);
  font-size:16px;
}
.tv-table tr.tv-q td { background:rgba(37,99,235,0.1); }
.tv-qdot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; }
.tv-team-cell { display:flex; align-items:center; gap:6px; text-align:left !important; }
.tv-gf { color:#4ade80 !important; font-weight:600; }
.tv-gs { color:#f87171 !important; font-weight:600; }
.tv-pt { color:#FFD700 !important; font-weight:800; font-size:18px !important; }
.tv-pos { color:#4ade80; }
.tv-neg { color:#f87171; }

/* PARTITE RISULTATI */
.tv-match {
  border-radius:8px; margin-bottom:6px; overflow:hidden;
}
.tv-match.tv-played { background:rgba(255,255,255,0.05); }
.tv-match.tv-upcoming { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); }
.tv-orario {
  display:block; font-size:11px; color:rgba(255,255,255,0.3);
  padding:4px 12px 0; text-align:center;
}
.tv-match-row {
  display:flex; align-items:center; gap:10px;
  padding:8px 12px;
}
.tv-mteam {
  flex:1; font-size:17px; font-weight:600; color:rgba(255,255,255,0.8);
  display:flex; align-items:center; gap:6px;
  white-space: nowrap; overflow:hidden; text-overflow:ellipsis;
}
.tv-mteam.right { flex-direction:row-reverse; text-align:right; }
.tv-mteam.tv-win { color:#22c55e; font-weight:800; }
.tv-mscore {
  font-size:24px; font-weight:900; color:white;
  min-width:80px; text-align:center;
  background:rgba(37,99,235,0.3); border-radius:7px; padding:3px 10px;
  border:1px solid rgba(37,99,235,0.5); flex-shrink:0;
}
.tv-mscore.tv-vs {
  font-size:13px; color:rgba(255,255,255,0.3);
  background:transparent; border-color:rgba(255,255,255,0.08);
}
.tv-empty { color:rgba(255,255,255,0.2); font-size:14px; text-align:center; padding:16px 0; }

/* Nascondi sito quando TV attivo */
body.tv-active #app { visibility:hidden; }
`;

const tvStyle = document.createElement('style');
tvStyle.textContent = tvCSS;
document.head.appendChild(tvStyle);

// CSS modal Chromecast
const castCSS = `
#cast-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.cast-box {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 380px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.cast-title {
  font-size: 18px;
  font-weight: 800;
  color: #1a1a1a;
  margin-bottom: 16px;
}
.cast-steps { display:flex; flex-direction:column; gap:12px; }
.cast-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 10px;
}
.cast-num {
  width: 28px;
  height: 28px;
  background: #2563eb;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  flex-shrink: 0;
}
.cast-step div { font-size: 13px; color: #333; line-height: 1.5; }
.cast-step strong { color: #1a1a1a; }
`;
const castStyle = document.createElement('style');
castStyle.textContent = castCSS;
document.head.appendChild(castStyle);
