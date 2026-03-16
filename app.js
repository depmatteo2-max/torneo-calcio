// ============================================================
//  APP PRINCIPALE - VERSIONE CORRETTA
// ============================================================

let STATE = {
  torneo: null,
  categorie: [],
  activeCat: null,
  isAdmin: false,
  currentSection: 'classifiche',
  cache: {}
};

let openScorers = {};
let tempMarcatori = {};

// ===== INIT =====
async function init() {
  initDB();
  try {
    STATE.torneo = await dbGetTorneo();
    STATE.categorie = await dbGetCategorie();
    if (STATE.categorie.length) STATE.activeCat = STATE.categorie[0].id;
    updateHeader();
    renderCatBar();
    await renderCurrentSection();
    subscribeRealtime(async () => {
      await renderCurrentSection();
    });
  } catch (e) {
    console.error(e);
  }
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
}

function updateHeader() {
  if (!STATE.torneo) return;
  document.getElementById('header-title').textContent = STATE.torneo.nome || 'Torneo Calcio';
  document.getElementById('header-date').textContent = STATE.torneo.data || '';
}

// ===== NAVIGATION =====
function showSection(name, btn) {
  STATE.currentSection = name;
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');

  document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const hideCatBar = ['a-setup'].includes(name);
  document.getElementById('cat-bar').style.display = hideCatBar ? 'none' : '';
  renderCurrentSection();
}

async function renderCurrentSection() {
  const s = STATE.currentSection;
  if (s === 'classifiche') await renderClassifiche();
  else if (s === 'risultati') await renderRisultati();
  else if (s === 'tabellone') await renderTabellone();
  else if (s === 'a-setup') await renderAdminSetup();
  else if (s === 'a-loghi') await renderAdminLoghi();
  else if (s === 'a-risultati') await renderAdminRisultati();
  else if (s === 'a-knockout') await renderAdminKnockout();
}

// ===== CATEGORY BAR =====
function renderCatBar() {
  const bar = document.getElementById('cat-bar');
  if (!STATE.categorie.length) {
    bar.innerHTML = '';
    return;
  }

  bar.innerHTML = `<div class="cat-bar-inner">${
    STATE.categorie.map(c =>
      `<button class="cat-pill ${c.id === STATE.activeCat ? 'active' : ''}" onclick="selectCat(${c.id})">${c.nome}</button>`
    ).join('')
  }</div>`;
}

function selectCat(id) {
  STATE.activeCat = id;
  STATE.cache = {};
  renderCatBar();
  renderCurrentSection();
}

// ===== HELPERS =====
function logoHTML(sq, size = 'md') {
  const cls = size === 'sm' ? 'team-logo-sm' : 'team-logo';
  const avcls = size === 'sm' ? 'team-avatar-sm' : 'team-avatar';
  if (sq && sq.logo) return `<img src="${sq.logo}" class="${cls}" alt="${sq.nome}">`;
  const name = sq ? sq.nome : '?';
  const ini = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return `<div class="${avcls}">${ini}</div>`;
}

async function getGironiWithData(categoria_id) {
  const gironi = await dbGetGironi(categoria_id);
  for (const g of gironi) {
    const members = await dbGetGironeSquadre(g.id);
    g.squadre = members.map(m => m.squadre).filter(Boolean);
    g.partite = await dbGetPartite(g.id);
    for (const p of g.partite) {
      p.marcatori = await dbGetMarcatori(p.id);
    }
  }
  return gironi;
}

function calcGironeClassifica(girone) {
  const map = {};
  for (const sq of girone.squadre) {
    map[sq.id] = {
      sq,
      g: 0,
      v: 0,
      p: 0,
      s: 0,
      gf: 0,
      gs: 0,
      pts: 0
    };
  }

  for (const p of girone.partite) {
    if (!p.giocata) continue;
    const h = map[p.home_id];
    const a = map[p.away_id];
    if (!h || !a) continue;

    h.g++; a.g++;
    h.gf += p.gol_home; h.gs += p.gol_away;
    a.gf += p.gol_away; a.gs += p.gol_home;

    if (p.gol_home > p.gol_away) {
      h.v++; h.pts += 3; a.s++;
    } else if (p.gol_home < p.gol_away) {
      a.v++; a.pts += 3; h.s++;
    } else {
      h.p++; h.pts++;
      a.p++; a.pts++;
    }
  }

  const rows = Object.values(map);

  return rows.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;

    const direct = girone.partite.find(p =>
      p.giocata &&
      (
        (p.home_id === a.sq.id && p.away_id === b.sq.id) ||
        (p.home_id === b.sq.id && p.away_id === a.sq.id)
      )
    );

    if (direct) {
      if (direct.home_id === a.sq.id && direct.gol_home > direct.gol_away) return -1;
      if (direct.home_id === a.sq.id && direct.gol_home < direct.gol_away) return 1;
      if (direct.home_id === b.sq.id && direct.gol_home > direct.gol_away) return 1;
      if (direct.home_id === b.sq.id && direct.gol_home < direct.gol_away) return -1;
    }

    const diffA = a.gf - a.gs;
    const diffB = b.gf - b.gs;
    if (diffB !== diffA) return diffB - diffA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.sq.nome.localeCompare(b.sq.nome);
  });
}

// ===== PUBLIC: CLASSIFICHE =====
async function renderClassifiche() {
  const el = document.getElementById('sec-classifiche');
  if (!STATE.activeCat) {
    el.innerHTML = '<div class="empty-state">Nessuna categoria configurata.</div>';
    return;
  }

  const cat = STATE.categorie.find(c => c.id === STATE.activeCat);
  const gironi = await getGironiWithData(STATE.activeCat);

  if (!gironi.length) {
    el.innerHTML = '<div class="empty-state">Nessun girone trovato.</div>';
    return;
  }

  let html = '';

  for (const g of gironi) {
    const classifica = calcGironeClassifica(g);
    const played = g.partite.filter(p => p.giocata).length;

    html += `<div class="card">
      <div class="card-title">${g.nome} <span class="badge badge-gray">${played}/${g.partite.length} partite</span></div>
      <table class="standings-table">
        <thead>
          <tr>
            <th></th>
            <th colspan="2">Squadra</th>
            <th>G</th>
            <th>V</th>
            <th>P</th>
            <th>S</th>
            <th>GD</th>
            <th>Pt</th>
          </tr>
        </thead>
        <tbody>`;

    classifica.forEach((row, idx) => {
      const q = idx < (cat.qualificate || 2);
      const diff = row.gf - row.gs;

      html += `<tr class="${q ? 'qualifies' : ''}">
        <td><span class="${q ? 'q-dot' : 'nq-dot'}"></span></td>
        <td style="padding-right:4px;">${logoHTML(row.sq, 'sm')}</td>
        <td>${row.sq.nome}</td>
        <td>${row.g}</td>
        <td>${row.v}</td>
        <td>${row.p}</td>
        <td>${row.s}</td>
        <td class="${diff > 0 ? 'diff-pos' : diff < 0 ? 'diff-neg' : ''}">${diff > 0 ? '+' : ''}${diff}</td>
        <td class="pts-col">${row.pts}</td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
  }

  el.innerHTML = html;
}

// ===== PUBLIC: RISULTATI =====
async function renderRisultati() {
  const el = document.getElementById('sec-risultati');
  if (!STATE.activeCat) {
    el.innerHTML = '<div class="empty-state">Nessuna categoria configurata.</div>';
    return;
  }

  const gironi = await getGironiWithData(STATE.activeCat);
  let html = '';

  for (const g of gironi) {
    const giocate = g.partite.filter(p => p.giocata);
    const dafar = g.partite.filter(p => !p.giocata);

    html += `<div class="section-label">${g.nome}</div>`;

    if (giocate.length) {
      html += `<div class="card">`;
      for (const p of giocate) {
        const mHome = (p.marcatori || []).filter(m => m.squadra_id === p.home_id);
        const mAway = (p.marcatori || []).filter(m => m.squadra_id === p.away_id);

        html += `<div class="match-result">
          <div class="match-team">${logoHTML(p.home, 'sm')}<span>${p.home ? p.home.nome : '?'}</span></div>
          <div class="match-score">${p.gol_home} — ${p.gol_away}</div>
          <div class="match-team right"><span>${p.away ? p.away.nome : '?'}</span>${logoHTML(p.away, 'sm')}</div>
        </div>`;

        if (p.orario || p.campo || p.fase) {
          html += `<div class="match-meta" style="font-size:12px;color:#777;margin:4px 0 10px 0;">
            ${p.fase ? `🏆 ${p.fase}` : ''}
            ${p.orario ? ` • 🕒 ${p.orario}` : ''}
            ${p.campo ? ` • 📍 ${p.campo}` : ''}
          </div>`;
        }

        if (mHome.length || mAway.length) {
          html += `<div class="match-scorers">`;
          mHome.forEach(m => html += `<span class="scorer-chip">⚽ ${m.nome}${m.minuto ? ' ' + m.minuto + "'" : ''} (${p.home ? p.home.nome : ''})</span>`);
          mAway.forEach(m => html += `<span class="scorer-chip">⚽ ${m.nome}${m.minuto ? ' ' + m.minuto + "'" : ''} (${p.away ? p.away.nome : ''})</span>`);
          html += `</div>`;
        }
      }
      html += `</div>`;
    }

    if (dafar.length) {
      html += `<div class="card">`;
      for (const p of dafar) {
        html += `<div class="match-result">
          <div class="match-team">${logoHTML(p.home, 'sm')}<span>${p.home ? p.home.nome : '?'}</span></div>
          <div class="match-score pending">vs</div>
          <div class="match-team right"><span>${p.away ? p.away.nome : '?'}</span>${logoHTML(p.away, 'sm')}</div>
        </div>`;

        if (p.orario || p.campo || p.fase) {
          html += `<div class="match-meta" style="font-size:12px;color:#777;margin:4px 0 10px 0;">
            ${p.fase ? `🏆 ${p.fase}` : ''}
            ${p.orario ? ` • 🕒 ${p.orario}` : ''}
            ${p.campo ? ` • 📍 ${p.campo}` : ''}
          </div>`;
        }
      }
      html += `</div>`;
    }

    if (!g.partite.length) html += `<div class="empty-state" style="padding:16px;">Nessuna partita.</div>`;
  }

  el.innerHTML = html || '<div class="empty-state">Nessun risultato.</div>';
}

// ===== PUBLIC: TABELLONE =====
async function renderTabellone() {
  const el = document.getElementById('sec-tabellone');
  if (!STATE.activeCat) {
    el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>';
    return;
  }

  const ko = await dbGetKnockout(STATE.activeCat);
  const squadre = await dbGetSquadre();
  const sqMap = {};
  squadre.forEach(s => sqMap[s.id] = s);

  if (!ko.length) {
    el.innerHTML = '<div class="empty-state">Tabellone non ancora generato.</div>';
    return;
  }

  const rounds = {};
  ko.forEach(m => {
    if (!rounds[m.round_name]) rounds[m.round_name] = [];
    rounds[m.round_name].push(m);
  });

  const roundOrder = ['Quarti di finale', 'Semifinali', '3° posto', 'Finale'];
  const sorted = Object.keys(rounds).sort((a, b) => {
    const ia = roundOrder.indexOf(a), ib = roundOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  let html = '<div class="ko-grid">';
  for (const rname of sorted) {
    html += `<div class="ko-col"><div class="ko-col-title">${rname}</div>`;
    for (const m of rounds[rname]) {
      const h = m.home_id ? sqMap[m.home_id] : null;
      const a = m.away_id ? sqMap[m.away_id] : null;
      const w1 = m.giocata && m.gol_home > m.gol_away;
      const w2 = m.giocata && m.gol_away > m.gol_home;
      html += `<div class="ko-match">
        <div class="ko-team-row ${w1 ? 'winner' : ''}">${logoHTML(h, 'sm')}<span style="flex:1;">${h ? h.nome : 'TBD'}</span>${m.giocata ? `<span class="ko-score">${m.gol_home}</span>` : ''}</div>
        <div class="ko-sep"></div>
        <div class="ko-team-row ${w2 ? 'winner' : ''}">${logoHTML(a, 'sm')}<span style="flex:1;">${a ? a.nome : 'TBD'}</span>${m.giocata ? `<span class="ko-score">${m.gol_away}</span>` : ''}</div>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div>';

  el.innerHTML = html;
}

// ===== ADMIN: SETUP =====
async function renderAdminSetup() {
  const el = document.getElementById('sec-a-setup');
  const t = STATE.torneo || {};

  let html = `<div class="section-label">Info torneo</div>
  <div class="card">
    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">Nome torneo</label>
        <input class="form-input" id="t-nome" value="${t.nome || ''}" placeholder="Torneo Primavera 2026">
      </div>
      <div class="form-group">
        <label class="form-label">Data</label>
        <input class="form-input" id="t-data" value="${t.data || ''}" placeholder="15 Marzo 2026">
      </div>
    </div>
    <button class="btn btn-p" onclick="saveTorneo()">Salva info torneo</button>
  </div>

  <div class="section-label">Categorie</div>`;

  for (const cat of STATE.categorie) {
    html += `<div class="card">
      <div class="card-title">${cat.nome}
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <span class="badge badge-blue">${cat.qualificate || 2} si qualificano</span>
          <span class="badge badge-gray">${cat.formato || 'semi'}</span>
          <button class="btn btn-danger btn-sm" onclick="deleteCat(${cat.id})">Elimina</button>
        </div>
      </div>`;

    const gironi = await dbGetGironi(cat.id);
    for (const g of gironi) {
      const members = await dbGetGironeSquadre(g.id);
      html += `<div style="font-size:13px;color:#555;margin-bottom:4px;">
        <strong>${g.nome}:</strong> ${members.map(m => m.squadre.nome).join(', ') || '—'}
      </div>`;
    }
    html += `</div>`;
  }

  html += `<div class="section-label">Aggiungi categoria</div>
  <div class="card">
    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">Nome (es. Under 12)</label>
        <input class="form-input" id="new-cat-nome" placeholder="Under 10">
      </div>
      <div class="form-group">
        <label class="form-label">Numero gironi</label>
        <select class="form-input" id="new-cat-gironi">
          <option>1</option>
          <option>2</option>
          <option selected>3</option>
          <option>4</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Squadre per girone (una riga per girone, squadre separate da virgola)</label>
      <textarea class="form-input" id="new-cat-teams" rows="4" placeholder="Girone A: Juventus, Milan, Inter, Lazio
Girone B: Roma, Napoli, Fiorentina, Torino
Girone C: Atalanta, Bologna, Genoa, Parma"></textarea>
    </div>

    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">Si qualificano (prime N per girone)</label>
        <select class="form-input" id="new-cat-qual">
          <option>1</option>
          <option selected>2</option>
          <option>3</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Formato fase finale</label>
        <select class="form-input" id="new-cat-format">
          <option value="final">Solo finale</option>
          <option value="semi" selected>Semifinali + finale</option>
          <option value="quarter">Quarti + semifinali + finale</option>
        </select>
      </div>
    </div>

    <button class="btn btn-p" onclick="addCategoria()">Aggiungi categoria</button>
  </div>

  <div class="section-label">Importa da Excel</div>
  <div class="card">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <input type="file" id="excelFile" accept=".xlsx,.xls" class="form-input" style="max-width:320px;">
      <button class="btn btn-p" onclick="importExcel()">Importa Excel</button>
      <a class="btn" href="modello_torneo_excel_import.xlsx" download>Scarica modello Excel</a>
    </div>
    <div style="font-size:12px;color:#666;margin-top:10px;">
      Fogli supportati: <strong>partite</strong>, <strong>legenda</strong>, <strong>squadre</strong>.
    </div>
  </div>`;

  el.innerHTML = html;
}

async function saveTorneo() {
  const nome = document.getElementById('t-nome').value.trim();
  const data = document.getElementById('t-data').value.trim();
  await dbSaveTorneo({ nome, data });
  STATE.torneo = { nome, data };
  updateHeader();
  toast('Torneo aggiornato');
}

async function addCategoria() {
  const nome = document.getElementById('new-cat-nome').value.trim();
  const qualificate = parseInt(document.getElementById('new-cat-qual').value, 10);
  const formato = document.getElementById('new-cat-format').value;
  const teamsText = document.getElementById('new-cat-teams').value.trim();

  if (!nome || !teamsText) {
    alert('Compila nome e squadre');
    return;
  }

  const cat = await dbSaveCategoria({
    nome,
    qualificate,
    formato,
    ordine: STATE.categorie.length
  });

  STATE.categorie = await dbGetCategorie();
  if (!STATE.activeCat) STATE.activeCat = cat.id;

  const lines = teamsText.split('\n').map(l => l.trim()).filter(Boolean);
  for (let gi = 0; gi < lines.length; gi++) {
    let line = lines[gi];
    if (line.includes(':')) line = line.split(':').slice(1).join(':').trim();
    const teamNames = line.split(',').map(t => t.trim()).filter(Boolean);
    const girone = await dbSaveGirone({ categoria_id: cat.id, nome: 'Girone ' + String.fromCharCode(65 + gi) });

    const squadra_ids = [];
    const tutteSquadre = await dbGetSquadre();
    for (const tn of teamNames) {
      let sq = tutteSquadre.find(s => s.nome.toLowerCase() === tn.toLowerCase());
      if (!sq) sq = await dbSaveSquadra({ nome: tn });
      squadra_ids.push(sq.id);
    }

    await dbSetGironeSquadre(girone.id, squadra_ids);
    await dbGeneraPartite(girone.id, squadra_ids);
  }

  renderCatBar();
  toast('Categoria aggiunta!');
  await renderAdminSetup();
}

async function deleteCat(id) {
  if (!confirm('Elimina questa categoria e tutti i suoi dati?')) return;
  await dbDeleteCategoria(id);
  STATE.categorie = await dbGetCategorie();
  STATE.activeCat = STATE.categorie[0]?.id || null;
  renderCatBar();
  await renderAdminSetup();
}

// ===== ADMIN: LOGHI =====
async function renderAdminLoghi() {
  const el = document.getElementById('sec-a-loghi');
  const squadre = await dbGetSquadre();
  if (!squadre.length) {
    el.innerHTML = '<div class="empty-state">Aggiungi prima le squadre nel setup.</div>';
    return;
  }

  let html = '<div class="section-label">Loghi squadre</div><div class="card">';
  html += `<div style="font-size:13px;color:#666;margin-bottom:14px;">Clicca sul logo (o sulle iniziali) per caricare/cambiare l'immagine. Formati supportati: JPG, PNG, SVG.</div>`;
  for (const sq of squadre) {
    html += `<div class="logo-team-row">
      <div class="logo-upload-btn" title="Carica logo">
        ${logoHTML(sq, 'md')}
        <div class="logo-plus"><svg width="8" height="8" viewBox="0 0 8 8"><path d="M4 1v6M1 4h6" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <input type="file" accept="image/*" onchange="uploadLogo(event, ${sq.id})">
      </div>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:600;">${sq.nome}</div>
        <div style="font-size:12px;color:#aaa;margin-top:2px;">${sq.logo ? 'Logo caricato' : 'Nessun logo'}</div>
      </div>
      <div style="display:flex;gap:6px;">
        ${sq.logo ? `<button class="btn btn-danger btn-sm" onclick="removeLogo(${sq.id})">Rimuovi</button>` : ''}
      </div>
    </div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

async function uploadLogo(event, squadra_id) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    await dbUpdateLogo(squadra_id, e.target.result);
    toast('Logo caricato!');
    await renderAdminLoghi();
  };
  reader.readAsDataURL(file);
}

async function removeLogo(squadra_id) {
  await dbUpdateLogo(squadra_id, null);
  toast('Logo rimosso');
  await renderAdminLoghi();
}

// ===== ADMIN: RISULTATI =====
async function renderAdminRisultati() {
  const el = document.getElementById('sec-a-risultati');
  if (!STATE.activeCat) {
    el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>';
    return;
  }

  const gironi = await getGironiWithData(STATE.activeCat);
  let html = '';

  for (const g of gironi) {
    const played = g.partite.filter(p => p.giocata).length;
    html += `<div class="section-label">${g.nome} <span class="badge badge-gray" style="margin-left:6px;">${played}/${g.partite.length}</span></div>`;

    for (const p of g.partite) {
      const key = 'p' + p.id;
      const open = !!openScorers[key];
      let badge = '';

      if (p.giocata) {
        if (p.gol_home > p.gol_away) badge = `<span class="badge badge-green">${p.home?.nome} vince</span>`;
        else if (p.gol_home < p.gol_away) badge = `<span class="badge badge-green">${p.away?.nome} vince</span>`;
        else badge = `<span class="badge badge-blue">Pareggio</span>`;
      }

      html += `<div class="admin-match">
        <div class="admin-match-header">
          <div class="admin-team-name">${logoHTML(p.home, 'sm')}<span>${p.home?.nome || '?'}</span></div>
          <input class="score-input" type="number" min="0" max="30" value="${p.giocata ? p.gol_home : ''}" placeholder="—" id="sh_${p.id}">
          <span class="score-dash">—</span>
          <input class="score-input" type="number" min="0" max="30" value="${p.giocata ? p.gol_away : ''}" placeholder="—" id="sa_${p.id}">
          <div class="admin-team-name right"><span>${p.away?.nome || '?'}</span>${logoHTML(p.away, 'sm')}</div>
          <div class="match-actions">
            ${badge}
            <button class="btn btn-success btn-sm" onclick="saveRisultato(${p.id}, ${g.id})">✓ Conferma</button>
            ${p.giocata ? `<button class="btn btn-accent btn-sm" onclick="toggleScorers('${key}')">${open ? 'Chiudi' : '+ Marcatori'}</button>` : ''}
          </div>
        </div>`;

      if (p.fase || p.orario || p.campo) {
        html += `<div style="font-size:12px;color:#777;margin-top:8px;">
          ${p.fase ? `🏆 ${p.fase}` : ''}
          ${p.orario ? ` • 🕒 ${p.orario}` : ''}
          ${p.campo ? ` • 📍 ${p.campo}` : ''}
        </div>`;
      }

      if (open && p.giocata) {
        const marcatoriEsistenti = p.marcatori || [];
        const nuovi = tempMarcatori[p.id] || [];
        const allRows = [...marcatoriEsistenti, ...nuovi];

        html += `<div class="scorers-section">
          <div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Marcatori</div>`;

        allRows.forEach((m, mi) => {
          html += `<div class="scorer-row">
            <select id="msq_${p.id}_${mi}">
              <option value="${p.home_id}" ${m.squadra_id === p.home_id ? 'selected' : ''}>${p.home?.nome}</option>
              <option value="${p.away_id}" ${m.squadra_id === p.away_id ? 'selected' : ''}>${p.away?.nome}</option>
            </select>
            <input placeholder="Nome giocatore" value="${m.nome || ''}" id="mnm_${p.id}_${mi}">
            <input placeholder="Min" value="${m.minuto || ''}" id="mmin_${p.id}_${mi}" class="min-input">
          </div>`;
        });

        html += `<button class="add-scorer-btn" onclick="addMarcatore(${p.id})">+ Aggiungi marcatore</button>
          <div style="margin-top:10px;">
            <button class="btn btn-success btn-sm" onclick="saveMarcatori(${p.id})">Salva marcatori</button>
          </div>
        </div>`;
      }

      html += '</div>';
    }
  }

  el.innerHTML = html || '<div class="empty-state">Nessuna partita.</div>';
}

async function saveRisultato(partita_id, girone_id) {
  const sh = document.getElementById('sh_' + partita_id).value;
  const sa = document.getElementById('sa_' + partita_id).value;

  if (sh === '' || sa === '') {
    alert('Inserisci entrambi i gol');
    return;
  }

  try {
    await dbSavePartita({
      id: partita_id,
      girone_id,
      gol_home: parseInt(sh, 10),
      gol_away: parseInt(sa, 10),
      giocata: true
    });

    toast('Risultato salvato');
    await renderAdminRisultati();
    await renderClassifiche();
    await renderRisultati();
  } catch (e) {
    console.error(e);
    alert('Errore nel salvataggio');
  }
}

function toggleScorers(key) {
  openScorers[key] = !openScorers[key];
  renderAdminRisultati();
}

function addMarcatore(partita_id) {
  if (!tempMarcatori[partita_id]) tempMarcatori[partita_id] = [];
  tempMarcatori[partita_id].push({ squadra_id: null, nome: '', minuto: null });
  renderAdminRisultati();
}

async function saveMarcatori(partita_id) {
  const gironi = await getGironiWithData(STATE.activeCat);
  let partita = null;

  for (const g of gironi) {
    for (const p of g.partite) {
      if (p.id === partita_id) partita = p;
    }
  }
  if (!partita) return;

  const existing = partita.marcatori || [];
  const nuovi = tempMarcatori[partita_id] || [];
  const allRows = [...existing, ...nuovi];
  const all = [];

  for (let i = 0; i < allRows.length; i++) {
    const sqEl = document.getElementById(`msq_${partita_id}_${i}`);
    const nmEl = document.getElementById(`mnm_${partita_id}_${i}`);
    const mnEl = document.getElementById(`mmin_${partita_id}_${i}`);

    if (sqEl && nmEl && nmEl.value.trim()) {
      all.push({
        squadra_id: parseInt(sqEl.value, 10),
        nome: nmEl.value.trim(),
        minuto: mnEl ? (mnEl.value || null) : null
      });
    }
  }

  await dbSaveMarcatori(partita_id, all);
  delete tempMarcatori[partita_id];
  openScorers['p' + partita_id] = false;
  toast('Marcatori salvati');
  await renderAdminRisultati();
}

// ===== ADMIN: KNOCKOUT =====
async function renderAdminKnockout() {
  const el = document.getElementById('sec-a-knockout');
  if (!STATE.activeCat) {
    el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>';
    return;
  }

  const cat = STATE.categorie.find(c => c.id === STATE.activeCat);
  const gironi = await getGironiWithData(STATE.activeCat);
  const ko = await dbGetKnockout(STATE.activeCat);
  const squadre = await dbGetSquadre();
  const sqMap = {};
  squadre.forEach(s => sqMap[s.id] = s);

  let html = `<div class="section-label">Qualificate</div><div class="card">`;
  for (const g of gironi) {
    const cl = calcGironeClassifica(g);
    for (let i = 0; i < (cat.qualificate || 2) && i < cl.length; i++) {
      html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:13px;">
        ${logoHTML(cl[i].sq, 'sm')}
        <span class="badge ${i === 0 ? 'badge-green' : 'badge-blue'}">${i + 1}°</span>
        <span style="flex:1;">${cl[i].sq.nome}</span>
        <span style="color:#aaa;font-size:12px;">${g.nome} · ${cl[i].pts} pt</span>
      </div>`;
    }
  }
  html += '</div>';

  if (!ko.length) {
    html += `<button class="btn btn-p" onclick="generaKO()">Genera tabellone automatico</button>`;
  } else {
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <div class="section-label" style="margin:0;">Tabellone</div>
      <button class="btn btn-sm" onclick="resetKO()">Rigenera</button>
    </div>`;

    const rounds = {};
    ko.forEach(m => { if (!rounds[m.round_name]) rounds[m.round_name] = []; rounds[m.round_name].push(m); });
    const roundOrder = ['Quarti di finale', 'Semifinali', '3° posto', 'Finale'];
    const sorted = Object.keys(rounds).sort((a, b) => {
      const ia = roundOrder.indexOf(a), ib = roundOrder.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    for (const rname of sorted) {
      html += `<div class="section-label">${rname}</div>`;
      for (const m of rounds[rname]) {
        const h = m.home_id ? sqMap[m.home_id] : null;
        const a = m.away_id ? sqMap[m.away_id] : null;
        let badge = '';
        if (m.giocata) {
          if (m.gol_home > m.gol_away) badge = `<span class="badge badge-green">${h?.nome} vince</span>`;
          else if (m.gol_home < m.gol_away) badge = `<span class="badge badge-green">${a?.nome} vince</span>`;
          else badge = `<span class="badge badge-blue">Pareggio</span>`;
        }
        html += `<div class="admin-match">
          <div class="admin-match-header">
            <div class="admin-team-name">${logoHTML(h, 'sm')}<span>${h ? h.nome : 'TBD'}</span></div>
            <input class="score-input" type="number" min="0" value="${m.giocata ? m.gol_home : ''}" placeholder="—" id="ksh_${m.id}">
            <span class="score-dash">—</span>
            <input class="score-input" type="number" min="0" value="${m.giocata ? m.gol_away : ''}" placeholder="—" id="ksa_${m.id}">
            <div class="admin-team-name right"><span>${a ? a.nome : 'TBD'}</span>${logoHTML(a, 'sm')}</div>
            <div class="match-actions">
              ${badge}
              <button class="btn btn-success btn-sm" onclick="saveKO(${m.id})">✓ Conferma</button>
            </div>
          </div>
        </div>`;
      }
    }
  }
  el.innerHTML = html;
}

async function generaKO() {
  const cat = STATE.categorie.find(c => c.id === STATE.activeCat);
  const gironi = await getGironiWithData(STATE.activeCat);
  const firsts = [], seconds = [];
  for (const g of gironi) {
    const cl = calcGironeClassifica(g);
    if (cl[0]) firsts.push(cl[0].sq);
    if (cl[1] && (cat.qualificate || 2) >= 2) seconds.push(cl[1].sq);
  }

  await dbDeleteKnockout(STATE.activeCat);
  const matches = [];
  const formato = cat.formato || 'semi';

  if (formato === 'quarter' || firsts.length >= 4) {
    firsts.forEach((f, i) => {
      const opp = seconds[(i + 1) % Math.max(seconds.length, 1)];
      matches.push({ categoria_id: STATE.activeCat, round_name: 'Quarti di finale', round_order: 1, match_order: i, home_id: f.id, away_id: opp?.id || null, giocata: false });
    });
    matches.push({ categoria_id: STATE.activeCat, round_name: 'Semifinali', round_order: 2, match_order: 0, home_id: null, away_id: null, giocata: false });
    matches.push({ categoria_id: STATE.activeCat, round_name: 'Semifinali', round_order: 2, match_order: 1, home_id: null, away_id: null, giocata: false });
    matches.push({ categoria_id: STATE.activeCat, round_name: '3° posto', round_order: 3, match_order: 0, home_id: null, away_id: null, giocata: false });
    matches.push({ categoria_id: STATE.activeCat, round_name: 'Finale', round_order: 4, match_order: 0, home_id: null, away_id: null, giocata: false });
  } else if (formato === 'semi' || firsts.length >= 2) {
    firsts.forEach((f, i) => {
      const opp = seconds[(i + 1) % Math.max(seconds.length, 1)];
      matches.push({ categoria_id: STATE.activeCat, round_name: 'Semifinali', round_order: 1, match_order: i, home_id: f.id, away_id: opp?.id || null, giocata: false });
    });
    matches.push({ categoria_id: STATE.activeCat, round_name: '3° posto', round_order: 2, match_order: 0, home_id: null, away_id: null, giocata: false });
    matches.push({ categoria_id: STATE.activeCat, round_name: 'Finale', round_order: 3, match_order: 0, home_id: null, away_id: null, giocata: false });
  } else {
    matches.push({ categoria_id: STATE.activeCat, round_name: 'Finale', round_order: 1, match_order: 0, home_id: firsts[0]?.id || null, away_id: seconds[0]?.id || null, giocata: false });
  }

  for (const m of matches) await dbSaveKnockoutMatch(m);
  toast('Tabellone generato!');
  await renderAdminKnockout();
}

async function saveKO(match_id) {
  const sh = document.getElementById('ksh_' + match_id).value;
  const sa = document.getElementById('ksa_' + match_id).value;
  if (sh === '' || sa === '') return;
  const ko = await dbGetKnockout(STATE.activeCat);
  const m = ko.find(x => x.id === match_id);
  if (!m) return;
  await dbSaveKnockoutMatch({ ...m, gol_home: parseInt(sh, 10), gol_away: parseInt(sa, 10), giocata: true });
  await promoteKO();
  toast('Risultato salvato');
  await renderAdminKnockout();
}

async function promoteKO() {
  const ko = await dbGetKnockout(STATE.activeCat);
  const roundOrder = ['Quarti di finale', 'Semifinali'];
  for (const rname of roundOrder) {
    const thisRound = ko.filter(m => m.round_name === rname && m.giocata);
    if (!thisRound.length) continue;
    const nextRoundName = rname === 'Quarti di finale' ? 'Semifinali' : 'Finale';
    const thirdName = '3° posto';
    const nextRound = ko.filter(m => m.round_name === nextRoundName).sort((a,b) => a.match_order - b.match_order);
    const thirdRound = ko.filter(m => m.round_name === thirdName);
    const winners = thisRound.map(m => m.gol_home >= m.gol_away ? m.home_id : m.away_id);
    const losers = thisRound.map(m => m.gol_home < m.gol_away ? m.home_id : m.away_id);
    winners.forEach((w, i) => {
      const nm = nextRound[Math.floor(i / 2)];
      if (nm) {
        if (i % 2 === 0) dbSaveKnockoutMatch({ ...nm, home_id: w });
        else dbSaveKnockoutMatch({ ...nm, away_id: w });
      }
    });
    if (thirdRound[0] && losers.length >= 2) {
      dbSaveKnockoutMatch({ ...thirdRound[0], home_id: losers[0], away_id: losers[1] });
    }
  }
}

async function resetKO() {
  if (!confirm('Eliminare e rigenerare il tabellone?')) return;
  await dbDeleteKnockout(STATE.activeCat);
  await renderAdminKnockout();
}

// ===== ADMIN AUTH =====
function toggleAdmin() {
  if (STATE.isAdmin) {
    exitAdmin();
    return;
  }
  document.getElementById('admin-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('admin-pw').focus(), 100);
}

function checkPw() {
  const pw = document.getElementById('admin-pw').value;
  if (pw === CONFIG.ADMIN_PASSWORD) {
    document.getElementById('admin-modal').style.display = 'none';
    document.getElementById('admin-pw').value = '';
    document.getElementById('pw-error').textContent = '';
    enterAdmin();
  } else {
    document.getElementById('pw-error').textContent = 'Password errata';
  }
}

function enterAdmin() {
  STATE.isAdmin = true;
  document.getElementById('pub-nav').style.display = 'none';
  document.getElementById('admin-nav').style.display = 'flex';
  document.getElementById('admin-btn').textContent = 'Esci';
  STATE.currentSection = 'a-setup';
  document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-section="a-setup"]').classList.add('active');
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-a-setup').classList.add('active');
  renderAdminSetup();
}

function exitAdmin() {
  STATE.isAdmin = false;
  document.getElementById('pub-nav').style.display = 'flex';
  document.getElementById('admin-nav').style.display = 'none';
  document.getElementById('admin-btn').textContent = 'Admin';
  STATE.currentSection = 'classifiche';
  document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-section="classifiche"]').classList.add('active');
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-classifiche').classList.add('active');
  renderClassifiche();
}

// ===== TOAST =====
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.style.display = 'none', 2000);
}

// ===== IMPORT EXCEL =====
async function importExcel() {
  const input = document.getElementById('excelFile');
  const file = input?.files?.[0];

  if (!file) {
    alert('Seleziona un file Excel');
    return;
  }

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });

    const partiteSheet = workbook.Sheets['partite'];
    const legendaSheet = workbook.Sheets['legenda'];
    const squadreSheet = workbook.Sheets['squadre'];

    const partiteRows = partiteSheet ? XLSX.utils.sheet_to_json(partiteSheet, { defval: '' }) : [];
    const legendaRows = legendaSheet ? XLSX.utils.sheet_to_json(legendaSheet, { defval: '' }) : [];
    const squadreRows = squadreSheet ? XLSX.utils.sheet_to_json(squadreSheet, { defval: '' }) : [];

    if (!partiteRows.length) {
      alert('Il foglio "partite" è vuoto o mancante');
      return;
    }

    const categorie = await dbGetCategorie();
    const squadre = await dbGetSquadre();

    const catMap = new Map(categorie.map(c => [c.nome.toLowerCase(), c]));
    const teamMap = new Map(squadre.map(s => [s.nome.toLowerCase(), s]));
    const gironeCache = new Map();

    for (const row of squadreRows) {
      const categoriaNome = String(row.categoria || '').trim();
      const squadraNome = String(row.squadra || '').trim();
      if (!categoriaNome || !squadraNome) continue;

      let cat = catMap.get(categoriaNome.toLowerCase());
      if (!cat) {
        cat = await dbSaveCategoria({ nome: categoriaNome, qualificate: 2, formato: 'semi', ordine: catMap.size });
        catMap.set(categoriaNome.toLowerCase(), cat);
      }

      let sq = teamMap.get(squadraNome.toLowerCase());
      if (!sq) {
        sq = await dbSaveSquadra({ nome: squadraNome });
        teamMap.set(squadraNome.toLowerCase(), sq);
      }
    }

    for (const row of partiteRows) {
      const categoriaNome = String(row.categoria || '').trim();
      const gironeNome = String(row.girone || '').trim() || 'Girone A';
      const fase = String(row.fase || '').trim() || 'Fase 1';
      const giornata = Number(row.giornata || 1);
      const orario = String(row.orario || '').trim();
      const campo = String(row.campo || '').trim();
      const casa = String(row['squadra casa'] || row.casa || '').trim();
      const ospite = String(row['squadra ospite'] || row.ospite || '').trim();
      const ordine = Number(row.ordine || 0);
      const priorita = Number(row.priorita || 0);

      if (!categoriaNome || !casa || !ospite) continue;

      let cat = catMap.get(categoriaNome.toLowerCase());
      if (!cat) {
        cat = await dbSaveCategoria({ nome: categoriaNome, qualificate: 2, formato: 'semi', ordine: catMap.size });
        catMap.set(categoriaNome.toLowerCase(), cat);
      }

      let squadraCasa = teamMap.get(casa.toLowerCase());
      if (!squadraCasa) {
        squadraCasa = await dbSaveSquadra({ nome: casa });
        teamMap.set(casa.toLowerCase(), squadraCasa);
      }

      let squadraOspite = teamMap.get(ospite.toLowerCase());
      if (!squadraOspite) {
        squadraOspite = await dbSaveSquadra({ nome: ospite });
        teamMap.set(ospite.toLowerCase(), squadraOspite);
      }

      const gironeKey = `${cat.id}_${gironeNome}`;
      let girone = gironeCache.get(gironeKey);
      if (!girone) {
        const gironi = await dbGetGironi(cat.id);
        girone = gironi.find(g => g.nome.toLowerCase() === gironeNome.toLowerCase());
        if (!girone) {
          girone = await dbSaveGirone({ categoria_id: cat.id, nome: gironeNome });
        }
        gironeCache.set(gironeKey, girone);
      }

      const members = await dbGetGironeSquadre(girone.id);
      const currentIds = members.map(m => m.squadra_id || m.squadre?.id).filter(Boolean);
      const newIds = Array.from(new Set([...currentIds, squadraCasa.id, squadraOspite.id]));
      await dbSetGironeSquadre(girone.id, newIds);

      await dbInsertPartitaManuale({
        girone_id: girone.id,
        home_id: squadraCasa.id,
        away_id: squadraOspite.id,
        fase,
        giornata,
        orario,
        campo,
        ordine,
        priorita
      });
    }

    for (const row of legendaRows) {
      const categoriaNome = String(row.categoria || '').trim();
      if (!categoriaNome) continue;
      const cat = catMap.get(categoriaNome.toLowerCase());
      if (!cat) continue;

      await dbSaveLegenda({
        categoria_id: cat.id,
        fase: String(row.fase || '').trim(),
        formula: String(row.formula || '').trim(),
        qualificazioni: String(row.qualificazioni || '').trim(),
        criteri_classifica: String(row['criteri classifica'] || row.criteri_classifica || '').trim(),
        note: String(row.note || '').trim()
      });
    }

    STATE.categorie = await dbGetCategorie();
    if (!STATE.activeCat && STATE.categorie.length) {
      STATE.activeCat = STATE.categorie[0].id;
    }

    renderCatBar();
    await renderAdminSetup();
    await renderAdminRisultati();
    await renderClassifiche();
    await renderRisultati();

    alert('Import Excel completato');
  } catch (err) {
    console.error(err);
    alert('Errore import Excel: ' + err.message);
  }
}

// ===== START =====
window.addEventListener('DOMContentLoaded', init);
