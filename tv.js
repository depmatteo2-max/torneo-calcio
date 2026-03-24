// ============================================================
//  TV.JS — Soccer Pro Experience
//  Modalità TV: visualizzazione fullscreen per schermi grandi
// ============================================================

let TV_SECTION  = 'classifiche';
let TV_CAT      = null;
let TV_AUTO     = false;
let TV_TIMER    = null;
let TV_CLOCK    = null;
let TV_PROGRESS = 0;
const TV_AUTO_INTERVAL = 15000; // 15 secondi per pagina

// ── APRI / CHIUDI ────────────────────────────────────────────
function openTVMode() {
  document.getElementById('tv-mode').classList.add('active');
  document.body.style.overflow = 'hidden';
  _tvSyncLogo();
  _tvStartClock();
  _tvRenderCatBar();
  tvShowSection('classifiche', document.querySelector('.tv-nav-btn'));
}

function closeTVMode() {
  document.getElementById('tv-mode').classList.remove('active');
  document.body.style.overflow = '';
  _tvStopClock();
  _tvStopAuto();
}

// ── OROLOGIO ─────────────────────────────────────────────────
function _tvStartClock() {
  _tvTickClock();
  TV_CLOCK = setInterval(_tvTickClock, 1000);
}
function _tvStopClock() {
  if (TV_CLOCK) { clearInterval(TV_CLOCK); TV_CLOCK = null; }
}
function _tvTickClock() {
  const now  = new Date();
  const hh   = String(now.getHours()).padStart(2,'0');
  const mm   = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('tv-clock').textContent = `${hh}:${mm}`;

  const giorni  = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
  const mesi    = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  document.getElementById('tv-date-str').textContent =
    `${giorni[now.getDay()]} ${now.getDate()} ${mesi[now.getMonth()]} ${now.getFullYear()}`;
}

// ── LOGO / TITOLO ────────────────────────────────────────────
function _tvSyncLogo() {
  const src = document.getElementById('header-logo')?.src;
  if (src) document.getElementById('tv-logo').src = src;
  const title = document.getElementById('header-title')?.textContent;
  if (title) document.getElementById('tv-title').textContent = title;
  if (STATE?.activeTorneo) {
    const t = STATE.tornei?.find(x => x.id === STATE.activeTorneo);
    if (t) {
      document.getElementById('tv-subtitle').textContent = `● ${t.nome}${t.data ? ' — '+t.data : ''}`;
    }
  }
}

// ── CAT BAR ──────────────────────────────────────────────────
function _tvRenderCatBar() {
  const bar = document.getElementById('tv-cat-bar');
  if (!STATE?.categorie?.length) { bar.style.display='none'; return; }
  bar.style.display='flex';
  bar.innerHTML = STATE.categorie.map((c, i) => `
    <button class="tv-cat-btn${i===0?' active':''}" onclick="tvSelectCat(${c.id}, this)">
      ${c.nome}
    </button>
  `).join('');
  TV_CAT = STATE.categorie[0]?.id || null;
}

function tvSelectCat(id, btn) {
  TV_CAT = id;
  document.querySelectorAll('.tv-cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _tvRender();
}

// ── SEZIONE ──────────────────────────────────────────────────
function tvShowSection(section, btn) {
  TV_SECTION = section;
  document.querySelectorAll('.tv-nav-btn').forEach(b => {
    if (!b.id) b.classList.remove('active');
  });
  if (btn && !btn.id) btn.classList.add('active');
  _tvRender();
}

async function _tvRender() {
  const content = document.getElementById('tv-content');
  content.innerHTML = `<div class="empty-state" style="padding:80px;font-size:18px;">⏳ Caricamento...</div>`;

  if (!STATE?.activeTorneo) {
    content.innerHTML = `<div class="empty-state" style="padding:80px;"><div class="empty-state-icon">🏟</div>Nessun torneo attivo</div>`;
    return;
  }

  _tvSyncLogo();

  if (TV_SECTION === 'classifiche') await _tvRenderClassifiche(content);
  else if (TV_SECTION === 'risultati')   await _tvRenderRisultati(content);
  else if (TV_SECTION === 'tabellone')   await _tvRenderTabellone(content);
}

// ── CLASSIFICHE ───────────────────────────────────────────────
async function _tvRenderClassifiche(content) {
  try {
    const catId = TV_CAT || STATE.categorie?.[0]?.id;
    if (!catId) { content.innerHTML = `<div class="empty-state" style="padding:80px;">Nessuna categoria</div>`; return; }

    const cat = STATE.categorie.find(c => c.id === catId);
    const gironi = await getGironiWithData(catId);

    if (!gironi.length) {
      content.innerHTML = `<div class="empty-state" style="padding:80px;"><div class="empty-state-icon">📋</div>Nessun girone configurato</div>`;
      return;
    }

    let html = `<div class="tv-gironi-grid">`;
    for (const g of gironi) {
      const cl = calcolaClassifica(g.squadre, g.partite);
      const q  = cat?.qualificate || 2;
      html += `
        <div class="tv-girone-card">
          <div class="tv-girone-title">${g.nome}</div>
          <table class="tv-standings-table">
            <thead>
              <tr>
                <th style="width:36px;">#</th>
                <th style="width:36px;"></th>
                <th>Squadra</th>
                <th>G</th><th>V</th><th>P</th><th>S</th>
                <th>GF</th><th>GS</th><th>DR</th>
                <th>Pt</th>
              </tr>
            </thead>
            <tbody>
              ${cl.map((r,i) => `
                <tr class="${i < q ? 'qualifies' : ''}">
                  <td><span class="pos-num ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${i+1}</span></td>
                  <td>${_tvLogoCell(r)}</td>
                  <td>${r.nome}</td>
                  <td>${r.g}</td><td>${r.v}</td><td>${r.n}</td><td>${r.p}</td>
                  <td>${r.gf}</td><td>${r.gs}</td>
                  <td class="${r.dr>0?'diff-pos':r.dr<0?'diff-neg':''}">${r.dr>0?'+':''}${r.dr}</td>
                  <td><span class="tv-pts">${r.pt}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    html += `</div>`;
    content.innerHTML = html;
  } catch(e) {
    console.error(e);
    content.innerHTML = `<div class="empty-state">Errore nel caricamento</div>`;
  }
}

// ── RISULTATI ─────────────────────────────────────────────────
async function _tvRenderRisultati(content) {
  try {
    const catId = TV_CAT || STATE.categorie?.[0]?.id;
    if (!catId) return;
    const cat = STATE.categorie.find(c => c.id === catId);
    const gironi = await getGironiWithData(catId);

    const allPartite = [];
    for (const g of gironi) {
      for (const p of g.partite) {
        allPartite.push({ ...p, girone: g.nome });
      }
    }

    if (!allPartite.length) {
      content.innerHTML = `<div class="empty-state" style="padding:80px;"><div class="empty-state-icon">⚽</div>Nessuna partita</div>`;
      return;
    }

    // Ordina: giocate prima, poi da giocare
    const played  = allPartite.filter(p => p.giocata);
    const pending = allPartite.filter(p => !p.giocata);
    const sorted  = [...played, ...pending];

    let html = `<div class="tv-results-grid">`;
    for (const p of sorted) {
      const hLogo = _tvLogoLg(p.home);
      const aLogo = _tvLogoLg(p.away);
      html += `
        <div class="tv-match-card ${!p.giocata?'pending-match':''}">
          <div class="tv-match-header">
            <span>${p.girone}</span>
            <span>${p.orario ? `⏰ ${p.orario}` : ''}${p.campo ? ` · ${p.campo}` : ''}</span>
          </div>
          <div class="tv-match-body">
            <div class="tv-match-team">
              ${hLogo}
              <div class="tv-team-name">${p.home?.nome || '?'}</div>
            </div>
            <div class="tv-score-box">
              ${p.giocata
                ? `<span class="tv-score">${p.gol_home}</span>
                   <span class="tv-score-sep">–</span>
                   <span class="tv-score">${p.gol_away}</span>`
                : `<span class="tv-score-pending">vs</span>`
              }
            </div>
            <div class="tv-match-team">
              ${aLogo}
              <div class="tv-team-name">${p.away?.nome || '?'}</div>
            </div>
          </div>
        </div>
      `;
    }
    html += `</div>`;
    content.innerHTML = html;
  } catch(e) {
    console.error(e);
    content.innerHTML = `<div class="empty-state">Errore nel caricamento</div>`;
  }
}

// ── TABELLONE ─────────────────────────────────────────────────
async function _tvRenderTabellone(content) {
  try {
    const catId = TV_CAT || STATE.categorie?.[0]?.id;
    if (!catId) return;
    const ko = await dbGetKnockout(catId);
    const squadre = await dbGetSquadre(STATE.activeTorneo);
    const sqMap = {}; squadre.forEach(s => sqMap[s.id] = s);

    if (!ko.length) {
      content.innerHTML = `<div class="empty-state" style="padding:80px;"><div class="empty-state-icon">🏆</div>Tabellone non ancora generato</div>`;
      return;
    }

    const rounds = {};
    ko.filter(m => !m.is_consolazione).forEach(m => {
      if (!rounds[m.round_name]) rounds[m.round_name] = [];
      rounds[m.round_name].push(m);
    });

    const roundOrder = ['Quarti di finale','Semifinali','3° posto','Finale'];
    const sortedRounds = Object.keys(rounds).sort((a,b) => {
      const ia = roundOrder.indexOf(a), ib = roundOrder.indexOf(b);
      return (ia===-1?99:ia)-(ib===-1?99:ib);
    });

    let html = `<div class="ko-grid">`;
    for (const rName of sortedRounds) {
      const matches = rounds[rName];
      html += `<div class="ko-col" style="min-width:220px;">
        <div class="ko-col-title">${rName}</div>`;
      for (const m of matches) {
        const h = m.home_id ? sqMap[m.home_id] : null;
        const a = m.away_id ? sqMap[m.away_id] : null;
        const hWin = m.giocata && m.gol_home > m.gol_away;
        const aWin = m.giocata && m.gol_away > m.gol_home;
        html += `
          <div class="ko-match" style="margin-bottom:14px;">
            <div class="ko-team-row ${hWin?'winner':''}">
              ${_tvLogoSmall(h)}
              <span style="font-size:15px;font-weight:700;">${h?.nome || 'TBD'}</span>
              ${m.giocata?`<span class="ko-score" style="font-size:22px;">${m.gol_home}</span>`:''}
            </div>
            <div class="ko-sep"></div>
            <div class="ko-team-row ${aWin?'winner':''}">
              ${_tvLogoSmall(a)}
              <span style="font-size:15px;font-weight:700;">${a?.nome || 'TBD'}</span>
              ${m.giocata?`<span class="ko-score" style="font-size:22px;">${m.gol_away}</span>`:''}
            </div>
          </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    content.innerHTML = html;
  } catch(e) {
    console.error(e);
    content.innerHTML = `<div class="empty-state">Errore nel caricamento</div>`;
  }
}

// ── AUTO-SCORRIMENTO ──────────────────────────────────────────
function tvToggleAutoScroll(btn) {
  TV_AUTO = !TV_AUTO;
  btn.textContent = TV_AUTO ? '⏸ Stop auto' : '▶ Auto-scorrimento';
  btn.style.color = TV_AUTO ? 'var(--verde-lt)' : '';
  if (TV_AUTO) _tvStartAuto();
  else _tvStopAuto();
}

function _tvStartAuto() {
  _tvStopAuto();
  TV_PROGRESS = 0;
  const sections = ['classifiche','risultati','tabellone'];
  let catIndex = 0;
  let secIndex = sections.indexOf(TV_SECTION);

  TV_TIMER = setInterval(() => {
    TV_PROGRESS += 100 / (TV_AUTO_INTERVAL / 100);
    document.getElementById('tv-scroll-progress').style.width = Math.min(TV_PROGRESS, 100) + '%';

    if (TV_PROGRESS >= 100) {
      TV_PROGRESS = 0;
      // Avanza categoria
      if (STATE.categorie?.length > 1) {
        catIndex = (catIndex + 1) % STATE.categorie.length;
        TV_CAT = STATE.categorie[catIndex].id;
        // Aggiorna bottoni categoria
        document.querySelectorAll('.tv-cat-btn').forEach((b,i) => {
          b.classList.toggle('active', i === catIndex);
        });
        // Quando ha girato tutte le categorie, cambia sezione
        if (catIndex === 0) {
          secIndex = (secIndex + 1) % sections.length;
          const newSec = sections[secIndex];
          const navBtn = document.querySelector(`.tv-nav-btn:not(#tv-autoscroll-btn)`);
          document.querySelectorAll('.tv-nav-btn:not(#tv-autoscroll-btn)').forEach((b,i) => {
            b.classList.toggle('active', b.textContent.toLowerCase().includes(newSec.substring(0,4)));
          });
          TV_SECTION = newSec;
        }
      } else {
        secIndex = (secIndex + 1) % sections.length;
        TV_SECTION = sections[secIndex];
        document.querySelectorAll('.tv-nav-btn:not(#tv-autoscroll-btn)').forEach((b,i) => {
          b.classList.toggle('active', i === secIndex);
        });
      }
      _tvRender();
    }
  }, 100);
}

function _tvStopAuto() {
  if (TV_TIMER) { clearInterval(TV_TIMER); TV_TIMER = null; }
  TV_PROGRESS = 0;
  const prog = document.getElementById('tv-scroll-progress');
  if (prog) prog.style.width = '0%';
}

// ── HELPER LOGO ───────────────────────────────────────────────
function _tvLogoCell(r) {
  if (r.logo) return `<img src="${r.logo}" class="team-logo-sm" alt="">`;
  const initials = (r.nome||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  return `<span class="team-avatar-sm">${initials}</span>`;
}

function _tvLogoLg(sq) {
  if (!sq) return `<div class="tv-team-avatar-lg">?</div>`;
  if (sq.logo) return `<img src="${sq.logo}" class="tv-team-logo-lg" alt="">`;
  const initials = (sq.nome||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  return `<div class="tv-team-avatar-lg">${initials}</div>`;
}

function _tvLogoSmall(sq) {
  if (!sq) return `<span class="team-avatar-sm">?</span>`;
  if (sq.logo) return `<img src="${sq.logo}" class="team-logo-sm" alt="">`;
  const initials = (sq.nome||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  return `<span class="team-avatar-sm">${initials}</span>`;
}

// ── FULLSCREEN API ────────────────────────────────────────────
function openTVMode() {
  const tvEl = document.getElementById('tv-mode');
  tvEl.classList.add('active');
  document.body.style.overflow = 'hidden';
  _tvSyncLogo();
  _tvStartClock();
  _tvRenderCatBar();
  tvShowSection('classifiche', document.querySelector('.tv-nav-btn:not(#tv-autoscroll-btn)'));

  // Prova fullscreen
  if (tvEl.requestFullscreen) tvEl.requestFullscreen().catch(()=>{});
  else if (tvEl.webkitRequestFullscreen) tvEl.webkitRequestFullscreen();
}

function closeTVMode() {
  document.getElementById('tv-mode').classList.remove('active');
  document.body.style.overflow = '';
  _tvStopClock();
  _tvStopAuto();
  if (document.exitFullscreen && document.fullscreenElement) {
    document.exitFullscreen().catch(()=>{});
  }
}

// Aggiorna TV mode quando cambiano i dati
function tvRefreshIfOpen() {
  if (document.getElementById('tv-mode').classList.contains('active')) {
    _tvRender();
  }
}
