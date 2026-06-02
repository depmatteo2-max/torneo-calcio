// ============================================================
//  TV.JS — MC LION TROPHY 2026
//  Modalità TV: scorre categorie/classifiche/risultati
//  + notifica aggiornamento risultati
// ============================================================

let TV_MODE = false;
let TV_INTERVAL = null;
let TV_CAT_INDEX = 0;
let TV_SECTION_INDEX = 0;
const TV_SECTIONS = ['classifiche', 'risultati'];
const TV_DURATION = 15000; // 15s per schermata

// ── Notifica aggiornamento risultati ─────────────────────────
let _lastRisultatiHash = '';

function _hashRisultati(gironi) {
  return gironi.map(g =>
    g.partite.filter(p=>p.giocata).map(p=>`${p.id}:${p.gol_home}-${p.gol_away}`).join(',')
  ).join('|');
}

function _mostraNotificaTVGol(testo) {
  const old = document.getElementById('tv-gol-notifica');
  if (old) old.remove();
  const div = document.createElement('div');
  div.id = 'tv-gol-notifica';
  div.innerHTML = `<div style="
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    background:linear-gradient(135deg,#D42B2B,#A81E1E);
    color:white;padding:28px 48px;border-radius:20px;
    font-size:32px;font-weight:900;z-index:99999;
    box-shadow:0 8px 40px rgba(212,43,43,0.7);
    border:3px solid #F5A800;
    text-align:center;letter-spacing:1px;
    animation:tvGolPop 0.3s ease-out;
  ">⚽ ${testo}</div>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}

// ── Attiva/disattiva TV ───────────────────────────────────────
function toggleTVMode() { TV_MODE ? exitTVMode() : enterTVMode(); }

function enterTVMode() {
  TV_MODE = true; TV_CAT_INDEX = 0; TV_SECTION_INDEX = 0;
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(()=>{});
  document.body.classList.add('tv-active');
  creaOverlayTV();
  avviaAutoScorrimento();
  // Controlla aggiornamenti ogni 10s
  TV_CHECK_INTERVAL = setInterval(async () => {
    if (!TV_MODE || !STATE.activeCat) return;
    try {
      const gironi = await getGironiWithData(STATE.activeCat);
      const hash = _hashRisultati(gironi);
      if (_lastRisultatiHash && hash !== _lastRisultatiHash) {
        // Trova il risultato nuovo
        for (const g of gironi) {
          for (const p of g.partite.filter(p=>p.giocata)) {
            const oldKey = `${p.id}:${p.gol_home}-${p.gol_away}`;
            if (_lastRisultatiHash.includes(p.id) && !_lastRisultatiHash.includes(oldKey)) {
              const nomeH = p.home?.nome || '?';
              const nomeA = p.away?.nome || '?';
              _mostraNotificaTVGol(`GOAL! ${nomeH} ${p.gol_home} — ${p.gol_away} ${nomeA}`);
              break;
            }
          }
        }
        _lastRisultatiHash = hash;
        renderTV(); // Aggiorna schermata
      } else if (!_lastRisultatiHash) {
        _lastRisultatiHash = hash;
      }
    } catch(e) {}
  }, 10000);
  const btn = document.getElementById('tv-btn');
  if (btn) { btn.textContent = '✕ Esci TV'; btn.style.background='rgba(212,43,43,0.3)'; }
}

let TV_CHECK_INTERVAL = null;

function exitTVMode() {
  TV_MODE = false;
  if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  document.body.classList.remove('tv-active');
  document.getElementById('tv-overlay')?.remove();
  document.getElementById('tv-gol-notifica')?.remove();
  if (TV_INTERVAL) { clearInterval(TV_INTERVAL); TV_INTERVAL = null; }
  if (TV_CHECK_INTERVAL) { clearInterval(TV_CHECK_INTERVAL); TV_CHECK_INTERVAL = null; }
  const btn = document.getElementById('tv-btn');
  if (btn) { btn.textContent = '📺 TV'; btn.style.background=''; }
}

// ── Crea overlay TV ───────────────────────────────────────────
function creaOverlayTV() {
  document.getElementById('tv-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'tv-overlay';
  overlay.innerHTML = `
    <div id="tv-header">
      <div id="tv-logo-area">
        <img id="tv-logo-img" style="display:none;width:52px;height:52px;border-radius:50%;object-fit:cover;border:3px solid #F5A800;" alt="">
        <div>
          <div id="tv-titolo">🦁 MC LION TROPHY</div>
          <div id="tv-sottotitolo" style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px;">12-13-14 Giugno 2026 · Valle d'Aosta</div>
        </div>
      </div>
      <div id="tv-info">
        <div id="tv-live-badge">● LIVE</div>
        <div id="tv-orologio">--:--</div>
      </div>
    </div>
    <div id="tv-cat-tabs"></div>
    <div id="tv-content"></div>
    <div id="tv-footer">
      <div id="tv-cat-nome"></div>
      <div id="tv-progress-bar"><div id="tv-progress-inner"></div></div>
      <button onclick="exitTVMode()" id="tv-exit-btn">✕ Esci</button>
    </div>`;
  document.body.appendChild(overlay);

  // Orologio
  const tickOrologio = () => {
    const el = document.getElementById('tv-orologio');
    if (el) el.textContent = new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  };
  tickOrologio();
  setInterval(tickOrologio, 1000);

  // Logo
  const hl = document.getElementById('header-logo');
  if (hl?.src?.length > 50) {
    const tl = document.getElementById('tv-logo-img');
    tl.src = hl.src; tl.style.display = 'block';
  }

  // Titolo da config
  if (typeof CONFIG !== 'undefined' && CONFIG.NOME_SITO) {
    const el = document.getElementById('tv-titolo');
    if (el) el.textContent = CONFIG.NOME_SITO;
  }

  // Tab categorie
  _renderTVCatTabs();
  renderTV();
}

function _renderTVCatTabs() {
  const el = document.getElementById('tv-cat-tabs');
  if (!el || !STATE.categorie?.length) return;
  el.innerHTML = STATE.categorie.map((c, i) =>
    `<button onclick="TV_CAT_INDEX=${i};TV_SECTION_INDEX=0;renderTV();avviaProgressBar();"
      style="background:${i===TV_CAT_INDEX?'rgba(212,43,43,0.4)':'transparent'};
             border:1px solid ${i===TV_CAT_INDEX?'#D42B2B':'rgba(255,255,255,0.1)'};
             color:${i===TV_CAT_INDEX?'white':'rgba(255,255,255,0.4)'};
             padding:5px 14px;border-radius:20px;cursor:pointer;font-family:inherit;
             font-size:12px;font-weight:700;">${c.nome}</button>`
  ).join('');
}

// ── Auto scorrimento ──────────────────────────────────────────
function avviaAutoScorrimento() {
  if (TV_INTERVAL) clearInterval(TV_INTERVAL);
  avviaProgressBar();
  TV_INTERVAL = setInterval(prossimaSchermataTv, TV_DURATION);
}

function avviaProgressBar() {
  const bar = document.getElementById('tv-progress-inner');
  if (!bar) return;
  bar.style.transition = 'none'; bar.style.width = '0%';
  setTimeout(() => { bar.style.transition = `width ${TV_DURATION}ms linear`; bar.style.width = '100%'; }, 50);
}

function prossimaSchermataTv() {
  if (!STATE.categorie?.length) return;
  TV_SECTION_INDEX++;
  if (TV_SECTION_INDEX >= TV_SECTIONS.length) {
    TV_SECTION_INDEX = 0;
    TV_CAT_INDEX = (TV_CAT_INDEX + 1) % STATE.categorie.length;
  }
  _renderTVCatTabs();
  renderTV();
  avviaProgressBar();
}

// ── Render principale TV ──────────────────────────────────────
async function renderTV() {
  if (!TV_MODE) return;
  const cat = STATE.categorie[TV_CAT_INDEX];
  const section = TV_SECTIONS[TV_SECTION_INDEX];
  if (!cat) return;

  const catNomeEl = document.getElementById('tv-cat-nome');
  if (catNomeEl) catNomeEl.textContent = `${section==='classifiche'?'📊 Classifica':'⚽ Risultati'} — ${cat.nome}`;

  const content = document.getElementById('tv-content');
  if (!content) return;
  content.style.opacity = '0';

  const gironi = await getGironiWithData(cat.id);
  let html = '';

  if (section === 'classifiche') {
    // Filtra gironi con almeno una partita giocata
    const gironiAttivi = gironi.filter(g => g.partite.some(p=>p.giocata));
    if (!gironiAttivi.length) {
      html = '<div class="tv-empty">⏳ Nessun risultato ancora inserito</div>';
    } else {
      for (const g of gironiAttivi) {
        const sqMap = {};
        for (const p of g.partite) {
          if (p.home?.id && p.home.nome && !/^(prima|seconda|terza|quarta|quinta|sesta|settima|ottava|nona|decima)\s/i.test(p.home.nome) && !/^\d+[°º]/.test(p.home.nome)) sqMap[p.home.id] = p.home;
          if (p.away?.id && p.away.nome && !/^(prima|seconda|terza|quarta|quinta|sesta|settima|ottava|nona|decima)\s/i.test(p.away.nome) && !/^\d+[°º]/.test(p.away.nome)) sqMap[p.away.id] = p.away;
        }
        const sq = Object.values(sqMap);
        if (sq.length < 2) continue;
        const cl = calcGironeClassifica({squadre: sq, partite: g.partite});
        if (!cl.length) continue;
        const giocate = g.partite.filter(p=>p.giocata).length;
        html += `<div class="tv-block">
          <div class="tv-block-title">${g.nome} <span class="tv-badge">${giocate}/${g.partite.length}</span></div>
          <table class="tv-table"><thead><tr>
            <th></th><th style="text-align:left">Squadra</th>
            <th>G</th><th>V</th><th>P</th><th>S</th>
            <th style="color:#4ade80">GF</th><th style="color:#f87171">GS</th>
            <th>GD</th><th style="color:#F5A800">Pt</th>
          </tr></thead><tbody>`;
        cl.forEach((row, idx) => {
          const q = idx < (cat.qualificate||1);
          const diff = row.gf - row.gs;
          html += `<tr class="${q?'tv-q':''}">
            <td>${q?'<span class="tv-qdot"></span>':''}</td>
            <td style="text-align:left;font-weight:${q?700:400}">${logoHTML(row.sq,'sm')} ${row.sq.nome}</td>
            <td>${row.g}</td><td>${row.v}</td><td>${row.p}</td><td>${row.s}</td>
            <td style="color:#4ade80;font-weight:600">${row.gf}</td>
            <td style="color:#f87171;font-weight:600">${row.gs}</td>
            <td style="color:${diff>0?'#4ade80':diff<0?'#f87171':'#888'}">${diff>0?'+':''}${diff}</td>
            <td style="color:#F5A800;font-weight:900;font-size:20px">${row.pts}</td>
          </tr>`;
        });
        html += `</tbody></table></div>`;
      }
    }
  } else {
    // Risultati
    const oggi = typeof _trovaGiornataOggi==='function'
      ? _trovaGiornataOggi(STATE._giornateDisponibili||[]) : null;

    for (const g of gironi) {
      let partite = g.partite;
      if (oggi) {
        const oggiP = partite.filter(p=>p.giorno===oggi);
        if (oggiP.length) partite = oggiP;
      }
      const giocate = partite.filter(p=>p.giocata);
      const daFare = partite.filter(p=>!p.giocata).slice(0,5);
      if (!giocate.length && !daFare.length) continue;

      if (giocate.length) {
        html += `<div class="tv-block-title">${g.nome} — ✅ Risultati</div><div class="tv-matches">`;
        for (const p of giocate.slice(-6)) {
          const w1=p.gol_home>p.gol_away, w2=p.gol_away>p.gol_home;
          html += `<div class="tv-match">
            <div class="tv-team ${w1?'tv-win':''}">${logoHTML(p.home,'sm')} ${p.home?.nome||'?'}</div>
            <div class="tv-score">${p.gol_home} — ${p.gol_away}</div>
            <div class="tv-team right ${w2?'tv-win':''}">${p.away?.nome||'?'} ${logoHTML(p.away,'sm')}</div>
          </div>`;
        }
        html += `</div>`;
      }
      if (daFare.length) {
        html += `<div class="tv-block-title" style="margin-top:10px">${g.nome} — 🕐 Programma</div><div class="tv-matches">`;
        for (const p of daFare) {
          html += `<div class="tv-match tv-pending">
            <div class="tv-team">${logoHTML(p.home,'sm')} ${p.home?.nome||'?'}</div>
            <div class="tv-score tv-vs">${p.orario||'vs'}</div>
            <div class="tv-team right">${p.away?.nome||'?'} ${logoHTML(p.away,'sm')}</div>
          </div>`;
        }
        html += `</div>`;
      }
    }
    if (!html) html = '<div class="tv-empty">⏳ Nessuna partita per oggi</div>';
  }

  content.innerHTML = html;
  setTimeout(() => { content.style.transition='opacity 0.5s ease'; content.style.opacity='1'; }, 30);
}

// ── CSS TV ────────────────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `<style>
@keyframes tvGolPop { from{transform:translate(-50%,-50%) scale(0.5);opacity:0} to{transform:translate(-50%,-50%) scale(1);opacity:1} }

#tv-overlay {
  position:fixed;inset:0;
  background:linear-gradient(160deg,#0a0a0a 0%,#120508 50%,#0a0a14 100%);
  z-index:99998;display:flex;flex-direction:column;font-family:inherit;overflow:hidden;
}
#tv-header {
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 32px;
  background:linear-gradient(135deg,#A81E1E,#D42B2B);
  border-bottom:3px solid #F5A800;flex-shrink:0;
}
#tv-logo-area { display:flex;align-items:center;gap:14px; }
#tv-titolo { font-size:24px;font-weight:900;color:white;letter-spacing:1px; }
#tv-info { display:flex;align-items:center;gap:16px; }
#tv-orologio { font-size:32px;font-weight:900;color:white;font-variant-numeric:tabular-nums; }
#tv-live-badge {
  background:#ef4444;color:white;font-size:13px;font-weight:700;
  padding:5px 14px;border-radius:99px;letter-spacing:1px;
  animation:tvLivePulse 1.8s ease infinite;
}
@keyframes tvLivePulse{0%,100%{opacity:1}50%{opacity:.4}}
#tv-cat-tabs {
  display:flex;gap:8px;padding:8px 32px;
  background:rgba(0,0,0,0.4);border-bottom:1px solid rgba(255,255,255,0.05);
  flex-shrink:0;overflow-x:auto;
}
#tv-content {
  flex:1;overflow:hidden;padding:14px 32px;
  display:flex;flex-direction:column;gap:10px;
}
#tv-footer {
  display:flex;align-items:center;padding:8px 32px;
  background:rgba(0,0,0,0.6);flex-shrink:0;gap:16px;
  border-top:1px solid rgba(245,168,0,0.2);
}
#tv-cat-nome { font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);white-space:nowrap; }
#tv-progress-bar { flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden; }
#tv-progress-inner { height:100%;background:linear-gradient(90deg,#D42B2B,#F5A800);border-radius:99px;width:0%; }
#tv-exit-btn {
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);
  color:rgba(255,255,255,.5);padding:5px 14px;border-radius:8px;
  cursor:pointer;font-size:12px;font-family:inherit;
}
.tv-block { overflow:hidden; }
.tv-block-title {
  font-size:13px;font-weight:700;color:#F5A800;
  text-transform:uppercase;letter-spacing:.08em;
  margin-bottom:6px;display:flex;align-items:center;gap:10px;
}
.tv-badge {
  font-size:11px;background:rgba(245,168,0,.12);
  color:#F5A800;padding:2px 8px;border-radius:99px;font-weight:600;
}
.tv-table { width:100%;border-collapse:collapse;font-size:16px; }
.tv-table th {
  color:rgba(255,255,255,.3);font-size:10px;font-weight:700;
  text-transform:uppercase;letter-spacing:.06em;
  padding:4px 8px;text-align:center;
  border-bottom:1px solid rgba(255,255,255,.06);
}
.tv-table td {
  padding:8px;text-align:center;
  color:rgba(255,255,255,.8);
  border-bottom:1px solid rgba(255,255,255,.03);
}
.tv-table tr.tv-q { background:rgba(212,43,43,.08); }
.tv-table tr.tv-q td { color:white; }
.tv-qdot { display:inline-block;width:8px;height:8px;border-radius:50%;background:#D42B2B;box-shadow:0 0 6px rgba(212,43,43,0.6); }
.tv-matches { display:flex;flex-direction:column;gap:5px; }
.tv-match {
  display:flex;align-items:center;gap:12px;
  background:rgba(255,255,255,.04);border-radius:9px;padding:9px 14px;
}
.tv-match.tv-pending {
  background:rgba(255,255,255,.02);
  border:1px solid rgba(255,255,255,.06);
}
.tv-team {
  flex:1;font-size:16px;font-weight:600;
  color:rgba(255,255,255,.8);
  display:flex;align-items:center;gap:7px;
}
.tv-team.right { flex-direction:row-reverse;text-align:right; }
.tv-team.tv-win { color:#D42B2B;font-weight:800; }
.tv-score {
  font-size:26px;font-weight:900;color:white;
  min-width:90px;text-align:center;
  background:rgba(212,43,43,.2);border-radius:8px;
  padding:4px 10px;border:1px solid rgba(212,43,43,.4);
}
.tv-score.tv-vs {
  font-size:13px;color:rgba(255,255,255,.3);
  background:transparent;border-color:rgba(255,255,255,.08);
}
.tv-empty { color:rgba(255,255,255,.2);font-size:18px;text-align:center;margin-top:40px; }
body.tv-active #main-app { visibility:hidden; }
</style>`);
