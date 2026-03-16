let STATE = {
  torneo: null,
  categorie: [],
  activeCat: null,
  isAdmin: false,
  currentSection: 'classifiche',
};

function toast(msg) {
  alert(msg);
}

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
      STATE.categorie = await dbGetCategorie();
      if (!STATE.categorie.find(c => c.id === STATE.activeCat) && STATE.categorie.length) STATE.activeCat = STATE.categorie[0].id;
      renderCatBar();
      await renderCurrentSection();
    });
  } catch (e) {
    console.error(e);
    toast('Errore caricamento dati');
  }
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', init);

function updateHeader() {
  document.getElementById('header-title').textContent = STATE.torneo?.nome || 'Soccer Pro Experience';
  document.getElementById('header-date').textContent = STATE.torneo?.data || '';
}

function showSection(name, btn) {
  STATE.currentSection = name;
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('cat-bar').style.display = ['a-setup','a-loghi'].includes(name) ? 'none' : '';
  renderCurrentSection();
}

async function renderCurrentSection() {
  if (STATE.currentSection === 'classifiche') return renderClassifiche();
  if (STATE.currentSection === 'risultati') return renderRisultati();
  if (STATE.currentSection === 'legenda') return renderLegenda();
  if (STATE.currentSection === 'a-setup') return renderAdminSetup();
  if (STATE.currentSection === 'a-risultati') return renderAdminRisultati();
  if (STATE.currentSection === 'a-loghi') return renderAdminLoghi();
}

function renderCatBar() {
  const bar = document.getElementById('cat-bar');
  if (!STATE.categorie.length) return bar.innerHTML = '';
  bar.innerHTML = `<div class="cat-bar-inner">${STATE.categorie.map(c => `<button class="cat-pill ${c.id===STATE.activeCat?'active':''}" onclick="selectCat(${c.id})">${escapeHtml(c.nome)}</button>`).join('')}</div>`;
}
function selectCat(id) {
  STATE.activeCat = id;
  renderCatBar();
  renderCurrentSection();
}
function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function logoHTML(sq, size='sm') {
  if (sq?.logo) return `<img src="${sq.logo}" class="${size==='sm'?'team-logo-sm':'team-logo'}" alt="${escapeHtml(sq.nome)}">`;
  const initials = (sq?.nome || '?').split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase();
  return `<div class="${size==='sm'?'team-avatar-sm':'team-avatar'}">${initials}</div>`;
}

async function getGironiWithData(categoria_id) {
  const gironi = await dbGetGironi(categoria_id);
  for (const g of gironi) {
    const members = await dbGetGironeSquadre(g.id);
    g.squadre = members.map(m => m.squadre);
    g.partite = await dbGetPartite(g.id);
    for (const p of g.partite) p.marcatori = await dbGetMarcatori(p.id);
  }
  return gironi;
}

function rankingFromGirone(g) {
  const rows = {};
  for (const sq of g.squadre) rows[sq.id] = { sq, pts:0, g:0, v:0, n:0, p:0, gf:0, gs:0 };
  const head = {};
  for (const p of g.partite) {
    if (!p.giocata) continue;
    const h = rows[p.home_id], a = rows[p.away_id];
    if (!h || !a) continue;
    h.g++; a.g++; h.gf += p.gol_home; h.gs += p.gol_away; a.gf += p.gol_away; a.gs += p.gol_home;
    const key = [p.home_id, p.away_id].sort((x,y)=>x-y).join('-');
    head[key] = { home_id: p.home_id, away_id: p.away_id, gol_home: p.gol_home, gol_away: p.gol_away };
    if (p.gol_home > p.gol_away) { h.v++; h.pts += 3; a.p++; }
    else if (p.gol_home < p.gol_away) { a.v++; a.pts += 3; h.p++; }
    else { h.n++; a.n++; h.pts++; a.pts++; }
  }
  const arr = Object.values(rows);
  arr.sort((A,B) => {
    if (B.pts !== A.pts) return B.pts - A.pts;
    const key = [A.sq.id, B.sq.id].sort((x,y)=>x-y).join('-');
    const m = head[key];
    if (m) {
      let aGoals = 0, bGoals = 0;
      if (m.home_id === A.sq.id) { aGoals = m.gol_home; bGoals = m.gol_away; }
      else { aGoals = m.gol_away; bGoals = m.gol_home; }
      if (aGoals !== bGoals) return bGoals - aGoals; // reverse for sort
    }
    const gdA = A.gf - A.gs, gdB = B.gf - B.gs;
    if (gdB !== gdA) return gdB - gdA;
    if (B.gf !== A.gf) return B.gf - A.gf;
    return A.sq.nome.localeCompare(B.sq.nome);
  });
  return arr;
}

async function renderClassifiche() {
  const el = document.getElementById('sec-classifiche');
  if (!STATE.activeCat) return el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>';
  const gironi = await getGironiWithData(STATE.activeCat);
  if (!gironi.length) return el.innerHTML = '<div class="empty-state">Nessun girone.</div>';
  let html = '';
  for (const g of gironi) {
    const classifica = rankingFromGirone(g);
    html += `<div class="card"><div class="card-title">${escapeHtml(g.nome)}</div><table class="standings-table"><thead><tr><th>#</th><th></th><th>Squadra</th><th>G</th><th>V</th><th>N</th><th>P</th><th>DR</th><th>GF</th><th>Pt</th></tr></thead><tbody>`;
    classifica.forEach((r, i) => {
      const gd = r.gf - r.gs;
      html += `<tr><td>${i+1}</td><td>${logoHTML(r.sq)}</td><td>${escapeHtml(r.sq.nome)}</td><td>${r.g}</td><td>${r.v}</td><td>${r.n}</td><td>${r.p}</td><td>${gd>0?'+':''}${gd}</td><td>${r.gf}</td><td class="pts-col">${r.pts}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }
  el.innerHTML = html;
}

async function renderRisultati() {
  const el = document.getElementById('sec-risultati');
  if (!STATE.activeCat) return el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>';
  const gironi = await getGironiWithData(STATE.activeCat);
  let html = '';
  for (const g of gironi) {
    html += `<div class="section-label">${escapeHtml(g.nome)}</div><div class="card">`;
    if (!g.partite.length) {
      html += '<div class="empty-state">Nessuna partita.</div>';
    } else {
      for (const p of g.partite) {
        html += `<div class="match-result">
          <div class="match-team">${logoHTML(p.home)}<span>${escapeHtml(p.home?.nome || '?')}</span></div>
          <div class="match-score ${p.giocata?'':'pending'}">${p.giocata ? `${p.gol_home} — ${p.gol_away}` : 'vs'}</div>
          <div class="match-team right"><span>${escapeHtml(p.away?.nome || '?')}</span>${logoHTML(p.away)}</div>
        </div>
        <div class="muted" style="font-size:12px;margin:-4px 0 10px 0;">${escapeHtml(p.fase || 'Fase 1')} · Giornata ${p.giornata || 1}${p.orario ? ` · ${escapeHtml(p.orario)}`:''}${p.campo ? ` · ${escapeHtml(p.campo)}`:''}</div>`;
      }
    }
    html += `</div>`;
  }
  el.innerHTML = html;
}

async function renderLegenda() {
  const el = document.getElementById('sec-legenda');
  const cat = STATE.categorie.find(c => c.id === STATE.activeCat);
  if (!cat) return el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>';
  el.innerHTML = `<div class="card">
    <div class="card-title">Formula torneo</div>
    <p><strong>Categoria:</strong> ${escapeHtml(cat.nome)}</p>
    <p><strong>Tipo torneo:</strong> ${escapeHtml(cat.formula_tipo || 'Gironi')}</p>
    <p><strong>Criteri classifica:</strong> ${escapeHtml(cat.criteri_classifica || 'Punti → Scontro diretto → Differenza reti → Gol fatti')}</p>
    <p><strong>Sviluppo torneo:</strong> ${escapeHtml(cat.sviluppo_torneo || '-')}</p>
    <p><strong>Note:</strong> ${escapeHtml(cat.note || '-')}</p>
  </div>`;
}

async function renderAdminSetup() {
  const el = document.getElementById('sec-a-setup');
  const cats = await dbGetCategorie();
  STATE.categorie = cats;
  renderCatBar();
  el.innerHTML = `
  <div class="card">
    <div class="card-title">Impostazioni torneo</div>
    <div class="form-grid">
      <input id="torneo-nome" class="modal-input" placeholder="Nome torneo" value="${escapeHtml(STATE.torneo?.nome || '')}">
      <input id="torneo-data" class="modal-input" placeholder="Data / luogo" value="${escapeHtml(STATE.torneo?.data || '')}">
    </div>
    <div style="margin-top:10px"><button class="btn btn-p" onclick="saveTorneoInfo()">Salva torneo</button></div>
  </div>

  <div class="card">
    <div class="card-title">Importa da Excel</div>
    <p class="muted">File con fogli: partite, legenda, squadre (facoltativo).</p>
    <input type="file" id="excel-file" accept=".xlsx,.xls">
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-p" onclick="importExcelFile()">Importa Excel</button>
      <a class="btn" href="modello_torneo_excel_import.xlsx" download>Scarica modello Excel</a>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Categorie create</div>
    ${cats.length ? cats.map(c => `<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #eee;"><div><strong>${escapeHtml(c.nome)}</strong><div class="muted" style="font-size:12px;">${escapeHtml(c.formula_tipo || '')}</div></div><button class="btn" onclick="deleteCategoria(${c.id})">Elimina</button></div>`).join('') : '<div class="empty-state">Nessuna categoria.</div>'}
  </div>`;
}

async function saveTorneoInfo() {
  try {
    await dbSaveTorneo({ nome: document.getElementById('torneo-nome').value.trim(), data: document.getElementById('torneo-data').value.trim() });
    STATE.torneo = await dbGetTorneo();
    updateHeader();
    toast('Torneo salvato');
  } catch(e) { console.error(e); toast('Errore salvataggio torneo'); }
}

async function deleteCategoria(id) {
  if (!confirm('Eliminare la categoria?')) return;
  try {
    await dbDeleteCategoria(id);
    STATE.categorie = await dbGetCategorie();
    STATE.activeCat = STATE.categorie[0]?.id || null;
    renderCatBar();
    renderAdminSetup();
  } catch(e) { console.error(e); toast('Errore eliminazione'); }
}

async function importExcelFile() {
  const file = document.getElementById('excel-file').files[0];
  if (!file) return toast('Seleziona un file Excel');
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheets = Object.fromEntries(wb.SheetNames.map(n => [n.toLowerCase(), XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' })]));
    const partiteRows = sheets['partite'] || [];
    const legendaRows = sheets['legenda'] || [];
    const squadreRows = sheets['squadre'] || [];
    if (!partiteRows.length) throw new Error('Manca il foglio partite o è vuoto');

    const catMap = {};
    for (const row of legendaRows) {
      const nomeCat = String(row['categoria'] || '').trim();
      if (!nomeCat) continue;
      const existing = (await dbGetCategorie()).find(c => c.nome.toLowerCase() === nomeCat.toLowerCase());
      const saved = await dbSaveCategoria({
        ...(existing?.id ? { id: existing.id } : {}),
        nome: nomeCat,
        formula_tipo: String(row['tipo torneo'] || row['formula'] || '').trim(),
        criteri_classifica: String(row['criteri classifica'] || '').trim() || 'Punti → Scontro diretto → Differenza reti → Gol fatti',
        sviluppo_torneo: String(row['sviluppo torneo'] || row['qualificazioni'] || '').trim(),
        note: String(row['note'] || '').trim(),
        ordine: existing?.ordine || 0,
      });
      catMap[nomeCat.toLowerCase()] = saved;
    }

    for (const row of squadreRows) {
      const nome = String(row['squadra'] || '').trim();
      if (!nome) continue;
      const existing = await dbFindSquadra(nome);
      await dbSaveSquadra({
        ...(existing?.id ? { id: existing.id } : {}),
        nome,
        tipo: String(row['tipo'] || 'normale').trim() || 'normale',
        priorita: Number(row['priorità'] || row['priorita'] || 0) || 0,
        logo: existing?.logo || null,
      });
    }

    const allCats = await dbGetCategorie();
    const allSquadre = await dbGetSquadre();
    const teamMap = Object.fromEntries(allSquadre.map(s => [s.nome.toLowerCase(), s]));
    const gironeCache = {};

    for (const row of partiteRows) {
      const categoria = String(row['categoria'] || '').trim();
      const gironeNome = String(row['girone'] || 'Unico').trim() || 'Unico';
      const casa = String(row['squadra casa'] || '').trim();
      const ospite = String(row['squadra ospite'] || '').trim();
      if (!categoria || !casa || !ospite) continue;

      let cat = catMap[categoria.toLowerCase()] || allCats.find(c => c.nome.toLowerCase() === categoria.toLowerCase());
      if (!cat) {
        cat = await dbSaveCategoria({ nome: categoria, ordine: allCats.length, criteri_classifica: 'Punti → Scontro diretto → Differenza reti → Gol fatti' });
        catMap[categoria.toLowerCase()] = cat;
      }

      const keyGir = `${cat.id}::${gironeNome.toLowerCase()}`;
      let girone = gironeCache[keyGir] || await dbFindGirone(cat.id, gironeNome);
      if (!girone) girone = await dbSaveGirone({ categoria_id: cat.id, nome: gironeNome });
      gironeCache[keyGir] = girone;

      let home = teamMap[casa.toLowerCase()] || await dbFindSquadra(casa);
      if (!home) home = await dbSaveSquadra({ nome: casa, tipo: 'normale', priorita: 0 });
      teamMap[casa.toLowerCase()] = home;
      let away = teamMap[ospite.toLowerCase()] || await dbFindSquadra(ospite);
      if (!away) away = await dbSaveSquadra({ nome: ospite, tipo: 'normale', priorita: 0 });
      teamMap[ospite.toLowerCase()] = away;

      const members = await dbGetGironeSquadre(girone.id);
      const ids = members.map(m => m.squadra_id);
      if (!ids.includes(home.id)) ids.push(home.id);
      if (!ids.includes(away.id)) ids.push(away.id);
      await dbSetGironeSquadre(girone.id, ids);

      await dbSavePartita({
        girone_id: girone.id,
        home_id: home.id,
        away_id: away.id,
        fase: String(row['fase'] || 'Fase 1').trim() || 'Fase 1',
        giornata: Number(row['giornata'] || 1) || 1,
        orario: String(row['orario'] || '').trim(),
        campo: String(row['campo'] || '').trim(),
        ordine: Number(row['ordine'] || 0) || 0,
        manuale: true,
        giocata: false,
        gol_home: 0,
        gol_away: 0,
      });
    }

    STATE.categorie = await dbGetCategorie();
    STATE.activeCat = STATE.activeCat || STATE.categorie[0]?.id || null;
    renderCatBar();
    await renderAdminSetup();
    toast('Import Excel completato');
  } catch (e) {
    console.error(e);
    toast('Errore import Excel: ' + e.message);
  }
}

async function renderAdminRisultati() {
  const el = document.getElementById('sec-a-risultati');
  if (!STATE.activeCat) return el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>';
  const gironi = await getGironiWithData(STATE.activeCat);
  let html = '';
  for (const g of gironi) {
    html += `<div class="section-label">${escapeHtml(g.nome)}</div><div class="card">`;
    for (const p of g.partite) {
      html += `<div style="border-bottom:1px solid #eee;padding:10px 0;">
        <div class="match-result">
          <div class="match-team">${logoHTML(p.home)}<span>${escapeHtml(p.home?.nome||'?')}</span></div>
          <div class="match-score"><input id="sh_${p.id}" type="number" class="score-input" value="${p.giocata ? p.gol_home : ''}"> - <input id="sa_${p.id}" type="number" class="score-input" value="${p.giocata ? p.gol_away : ''}"></div>
          <div class="match-team right"><span>${escapeHtml(p.away?.nome||'?')}</span>${logoHTML(p.away)}</div>
        </div>
        <div class="form-grid" style="margin-top:8px;">
          <input id="fase_${p.id}" class="modal-input" value="${escapeHtml(p.fase || 'Fase 1')}" placeholder="Fase">
          <input id="giornata_${p.id}" class="modal-input" type="number" value="${p.giornata || 1}" placeholder="Giornata">
          <input id="orario_${p.id}" class="modal-input" value="${escapeHtml(p.orario || '')}" placeholder="Orario">
          <input id="campo_${p.id}" class="modal-input" value="${escapeHtml(p.campo || '')}" placeholder="Campo">
          <input id="ordine_${p.id}" class="modal-input" type="number" value="${p.ordine || 0}" placeholder="Ordine">
        </div>
        <div style="margin-top:8px;"><button class="btn btn-p" onclick="saveMatch(${p.id}, ${g.id}, ${p.home_id}, ${p.away_id})">✓ Conferma</button></div>
      </div>`;
    }
    html += `</div>`;
  }
  el.innerHTML = html || '<div class="empty-state">Nessuna partita.</div>';
}

async function saveMatch(id, girone_id, home_id, away_id) {
  try {
    const sh = document.getElementById(`sh_${id}`).value;
    const sa = document.getElementById(`sa_${id}`).value;
    await dbSavePartita({
      id,
      girone_id,
      home_id,
      away_id,
      gol_home: sh === '' ? 0 : parseInt(sh, 10),
      gol_away: sa === '' ? 0 : parseInt(sa, 10),
      giocata: sh !== '' && sa !== '',
      fase: document.getElementById(`fase_${id}`).value.trim() || 'Fase 1',
      giornata: parseInt(document.getElementById(`giornata_${id}`).value || '1', 10),
      orario: document.getElementById(`orario_${id}`).value.trim(),
      campo: document.getElementById(`campo_${id}`).value.trim(),
      ordine: parseInt(document.getElementById(`ordine_${id}`).value || '0', 10),
      manuale: true,
    });
    toast('Partita salvata');
    await renderAdminRisultati();
  } catch (e) { console.error(e); toast('Errore salvataggio'); }
}

async function renderAdminLoghi() {
  const el = document.getElementById('sec-a-loghi');
  const squadre = await dbGetSquadre();
  el.innerHTML = `<div class="card"><div class="card-title">Loghi squadre</div>${squadre.map(s => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #eee;">
    <div style="display:flex;align-items:center;gap:10px;">${logoHTML(s)}<strong>${escapeHtml(s.nome)}</strong></div>
    <input type="file" accept="image/*" onchange="uploadLogo(${s.id}, this)">
  </div>`).join('')}</div>`;
}

async function uploadLogo(id, input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await dbUpdateLogo(id, reader.result);
      toast('Logo salvato');
      renderAdminLoghi();
    } catch(e) { console.error(e); toast('Errore salvataggio logo'); }
  };
  reader.readAsDataURL(file);
}

function toggleAdmin() {
  document.getElementById('admin-modal').style.display = 'flex';
}
function checkPw() {
  const v = document.getElementById('admin-pw').value;
  if (v === CONFIG.ADMIN_PASSWORD) {
    STATE.isAdmin = true;
    document.getElementById('admin-modal').style.display = 'none';
    document.getElementById('pub-nav').style.display = 'none';
    document.getElementById('admin-nav').style.display = 'flex';
    showSection('a-setup', document.querySelector('#admin-nav .nav-btn'));
  } else {
    document.getElementById('pw-error').textContent = 'Password errata';
  }
}
function exitAdmin() {
  STATE.isAdmin = false;
  document.getElementById('pub-nav').style.display = 'flex';
  document.getElementById('admin-nav').style.display = 'none';
  showSection('classifiche', document.querySelector('#pub-nav .nav-btn'));
}


// ============================================================
//  OVERRIDE FASE 1 / FASE 2 + CORREZIONE MANUALE
// ============================================================

function normalizePhaseName(v) {
  const s = String(v || '').trim();
  return s || 'Fase 1';
}

function sortPhaseName(a, b) {
  const na = parseInt(String(a).match(/\d+/)?.[0] || '999', 10);
  const nb = parseInt(String(b).match(/\d+/)?.[0] || '999', 10);
  if (na !== nb) return na - nb;
  return String(a).localeCompare(String(b), 'it');
}

function sortMatchesForDisplay(matches) {
  return [...matches].sort((a, b) => {
    const ga = Number(a.giornata || 0), gb = Number(b.giornata || 0);
    if (ga !== gb) return ga - gb;
    const oa = String(a.orario || ''), ob = String(b.orario || '');
    if (oa !== ob) return oa.localeCompare(ob, 'it');
    const ca = String(a.campo || ''), cb = String(b.campo || '');
    if (ca !== cb) return ca.localeCompare(cb, 'it');
    const aa = Number(a.ordine || 0), ab = Number(b.ordine || 0);
    if (aa !== ab) return aa - ab;
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

async function getGroupsByPhase(categoria_id) {
  const gironi = await dbGetGironi(categoria_id);
  const groupsMap = new Map();

  for (const g of gironi) {
    const members = await dbGetGironeSquadre(g.id);
    const memberTeams = members.map(m => m.squadre).filter(Boolean);
    const partite = await dbGetPartite(g.id);
    for (const p of partite) p.marcatori = await dbGetMarcatori(p.id);

    if (!partite.length && memberTeams.length) {
      const phase = 'Fase 1';
      const key = `${phase}|||${g.id}`;
      groupsMap.set(key, {
        phase,
        girone: g,
        partite: [],
        teams: memberTeams
      });
      continue;
    }

    for (const p of partite) {
      const phase = normalizePhaseName(p.fase);
      const key = `${phase}|||${g.id}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          phase,
          girone: g,
          partite: [],
          teams: []
        });
      }
      const group = groupsMap.get(key);
      group.partite.push(p);
      if (p.home && !group.teams.find(t => t.id === p.home.id)) group.teams.push(p.home);
      if (p.away && !group.teams.find(t => t.id === p.away.id)) group.teams.push(p.away);
    }
  }

  const groups = Array.from(groupsMap.values());
  groups.sort((a, b) => {
    const p = sortPhaseName(a.phase, b.phase);
    if (p !== 0) return p;
    return String(a.girone?.nome || '').localeCompare(String(b.girone?.nome || ''), 'it');
  });
  for (const g of groups) g.partite = sortMatchesForDisplay(g.partite);
  return groups;
}

function rankingFromMatches(group) {
  const rows = {};
  for (const sq of group.teams || []) rows[sq.id] = { sq, pts:0, g:0, v:0, n:0, p:0, gf:0, gs:0 };
  const head = {};
  for (const p of group.partite || []) {
    if (!p.giocata) continue;
    if (!rows[p.home_id] && p.home) rows[p.home_id] = { sq:p.home, pts:0, g:0, v:0, n:0, p:0, gf:0, gs:0 };
    if (!rows[p.away_id] && p.away) rows[p.away_id] = { sq:p.away, pts:0, g:0, v:0, n:0, p:0, gf:0, gs:0 };
    const h = rows[p.home_id], a = rows[p.away_id];
    if (!h || !a) continue;
    h.g++; a.g++;
    h.gf += Number(p.gol_home || 0); h.gs += Number(p.gol_away || 0);
    a.gf += Number(p.gol_away || 0); a.gs += Number(p.gol_home || 0);
    const key = [p.home_id, p.away_id].sort((x,y)=>x-y).join('-');
    head[key] = { home_id: p.home_id, away_id: p.away_id, gol_home: Number(p.gol_home || 0), gol_away: Number(p.gol_away || 0) };
    if (Number(p.gol_home) > Number(p.gol_away)) { h.v++; h.pts += 3; a.p++; }
    else if (Number(p.gol_home) < Number(p.gol_away)) { a.v++; a.pts += 3; h.p++; }
    else { h.n++; a.n++; h.pts++; a.pts++; }
  }
  const arr = Object.values(rows);
  arr.sort((A,B) => {
    if (B.pts !== A.pts) return B.pts - A.pts;
    const key = [A.sq.id, B.sq.id].sort((x,y)=>x-y).join('-');
    const m = head[key];
    if (m) {
      let aGoals = 0, bGoals = 0;
      if (m.home_id === A.sq.id) { aGoals = m.gol_home; bGoals = m.gol_away; }
      else { aGoals = m.gol_away; bGoals = m.gol_home; }
      if (aGoals !== bGoals) return bGoals - aGoals;
    }
    const gdA = A.gf - A.gs, gdB = B.gf - B.gs;
    if (gdB !== gdA) return gdB - gdA;
    if (B.gf !== A.gf) return B.gf - A.gf;
    return A.sq.nome.localeCompare(B.sq.nome, 'it');
  });
  return arr;
}

async function renderClassifiche() {
  const el = document.getElementById('sec-classifiche');
  if (!STATE.activeCat) return el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>';
  const groups = await getGroupsByPhase(STATE.activeCat);
  if (!groups.length) return el.innerHTML = '<div class="empty-state">Nessun girone o nessuna partita.</div>';
  let html = '';
  let lastPhase = null;
  for (const group of groups) {
    if (group.phase !== lastPhase) {
      html += `<div class="section-label">${escapeHtml(group.phase)}</div>`;
      lastPhase = group.phase;
    }
    const classifica = rankingFromMatches(group);
    html += `<div class="card">
      <div class="card-title">${escapeHtml(group.girone?.nome || 'Girone')}</div>
      <table class="standings-table">
        <thead><tr><th>#</th><th></th><th>Squadra</th><th>G</th><th>V</th><th>N</th><th>P</th><th>DR</th><th>GF</th><th>Pt</th></tr></thead>
        <tbody>`;
    classifica.forEach((r, i) => {
      const gd = r.gf - r.gs;
      html += `<tr>
        <td>${i+1}</td>
        <td>${logoHTML(r.sq)}</td>
        <td>${escapeHtml(r.sq.nome)}</td>
        <td>${r.g}</td><td>${r.v}</td><td>${r.n}</td><td>${r.p}</td>
        <td>${gd>0?'+':''}${gd}</td><td>${r.gf}</td><td class="pts-col">${r.pts}</td>
      </tr>`;
    });
    html += `</tbody></table>
      <div class="muted" style="font-size:12px;margin-top:8px;">Criteri: punti → scontro diretto → differenza reti → gol fatti</div>
    </div>`;
  }
  el.innerHTML = html;
}

async function renderRisultati() {
  const el = document.getElementById('sec-risultati');
  if (!STATE.activeCat) return el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>';
  const groups = await getGroupsByPhase(STATE.activeCat);
  if (!groups.length) return el.innerHTML = '<div class="empty-state">Nessuna partita.</div>';

  let html = '';
  let lastPhase = null;
  for (const group of groups) {
    if (group.phase !== lastPhase) {
      html += `<div class="section-label">${escapeHtml(group.phase)}</div>`;
      lastPhase = group.phase;
    }
    html += `<div class="card"><div class="card-title">${escapeHtml(group.girone?.nome || 'Girone')}</div>`;
    if (!group.partite.length) {
      html += '<div class="empty-state">Nessuna partita.</div>';
    } else {
      let lastGiornata = null;
      for (const p of group.partite) {
        if (Number(p.giornata || 1) !== lastGiornata) {
          lastGiornata = Number(p.giornata || 1);
          html += `<div class="section-label" style="margin-top:8px;">Giornata ${lastGiornata}</div>`;
        }
        html += `<div class="match-result">
          <div class="match-team">${logoHTML(p.home)}<span>${escapeHtml(p.home?.nome || '?')}</span></div>
          <div class="match-score ${p.giocata?'':'pending'}">${p.giocata ? `${p.gol_home} — ${p.gol_away}` : 'vs'}</div>
          <div class="match-team right"><span>${escapeHtml(p.away?.nome || '?')}</span>${logoHTML(p.away)}</div>
        </div>
        <div class="muted" style="font-size:12px;margin:-4px 0 10px 0;">
          ${p.orario ? `${escapeHtml(p.orario)}` : 'Orario da definire'}
          ${p.campo ? ` · ${escapeHtml(p.campo)}` : ''}
          ${p.manuale ? ' · Manuale' : ''}
        </div>`;
      }
    }
    html += `</div>`;
  }
  el.innerHTML = html;
}

async function renderAdminRisultati() {
  const el = document.getElementById('sec-a-risultati');
  if (!STATE.activeCat) return el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>';

  const groups = await getGroupsByPhase(STATE.activeCat);
  const gironi = await dbGetGironi(STATE.activeCat);
  const allTeams = await dbGetSquadre();

  const teamIds = new Set();
  for (const g of groups) {
    for (const t of g.teams || []) teamIds.add(t.id);
  }
  const categoryTeams = allTeams.filter(t => teamIds.has(t.id));
  const teamOptions = categoryTeams.map(t => `<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join('');
  const gironeOptions = gironi.map(g => `<option value="${g.id}">${escapeHtml(g.nome)}</option>`).join('');

  let html = `
    <div class="card">
      <div class="card-title">Aggiungi partita manuale</div>
      <div class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;">
        <select id="new_match_girone" class="modal-input">${gironeOptions}</select>
        <input id="new_match_fase" class="modal-input" placeholder="Fase" value="Fase 2">
        <input id="new_match_giornata" class="modal-input" type="number" placeholder="Giornata" value="1">
        <input id="new_match_orario" class="modal-input" placeholder="Orario" value="">
        <input id="new_match_campo" class="modal-input" placeholder="Campo" value="">
        <input id="new_match_ordine" class="modal-input" type="number" placeholder="Ordine" value="0">
        <select id="new_match_home" class="modal-input">${teamOptions}</select>
        <select id="new_match_away" class="modal-input">${teamOptions}</select>
      </div>
      <div style="margin-top:10px;"><button class="btn btn-p" onclick="createManualMatch()">+ Aggiungi partita</button></div>
    </div>`;

  if (!groups.length) html += '<div class="empty-state">Nessuna partita.</div>';

  let lastPhase = null;
  for (const group of groups) {
    if (group.phase !== lastPhase) {
      html += `<div class="section-label">${escapeHtml(group.phase)}</div>`;
      lastPhase = group.phase;
    }
    html += `<div class="card"><div class="card-title">${escapeHtml(group.girone?.nome || 'Girone')}</div>`;
    for (const p of group.partite) {
      const thisGironeOptions = gironi.map(g => `<option value="${g.id}" ${Number(g.id)===Number(p.girone_id)?'selected':''}>${escapeHtml(g.nome)}</option>`).join('');
      html += `<div style="border-bottom:1px solid #eee;padding:10px 0;">
        <div class="match-result">
          <div class="match-team">${logoHTML(p.home)}<span>${escapeHtml(p.home?.nome||'?')}</span></div>
          <div class="match-score">
            <input id="sh_${p.id}" type="number" class="score-input" value="${p.giocata ? p.gol_home : ''}">
            -
            <input id="sa_${p.id}" type="number" class="score-input" value="${p.giocata ? p.gol_away : ''}">
          </div>
          <div class="match-team right"><span>${escapeHtml(p.away?.nome||'?')}</span>${logoHTML(p.away)}</div>
        </div>
        <div class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:8px;">
          <select id="girone_${p.id}" class="modal-input">${thisGironeOptions}</select>
          <input id="fase_${p.id}" class="modal-input" value="${escapeHtml(p.fase || 'Fase 1')}" placeholder="Fase">
          <input id="giornata_${p.id}" class="modal-input" type="number" value="${p.giornata || 1}" placeholder="Giornata">
          <input id="orario_${p.id}" class="modal-input" value="${escapeHtml(p.orario || '')}" placeholder="Orario">
          <input id="campo_${p.id}" class="modal-input" value="${escapeHtml(p.campo || '')}" placeholder="Campo">
          <input id="ordine_${p.id}" class="modal-input" type="number" value="${p.ordine || 0}" placeholder="Ordine">
        </div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-p" onclick="saveMatchAdvanced(${p.id}, ${p.home_id}, ${p.away_id})">✓ Salva</button>
          <button class="btn" onclick="deleteMatchAdvanced(${p.id})">Elimina</button>
        </div>
      </div>`;
    }
    html += `</div>`;
  }

  el.innerHTML = html;
}

async function saveMatchAdvanced(id, home_id, away_id) {
  try {
    const sh = document.getElementById(`sh_${id}`).value;
    const sa = document.getElementById(`sa_${id}`).value;
    await dbSavePartita({
      id,
      girone_id: parseInt(document.getElementById(`girone_${id}`).value, 10),
      home_id,
      away_id,
      gol_home: sh === '' ? 0 : parseInt(sh, 10),
      gol_away: sa === '' ? 0 : parseInt(sa, 10),
      giocata: sh !== '' && sa !== '',
      fase: normalizePhaseName(document.getElementById(`fase_${id}`).value),
      giornata: parseInt(document.getElementById(`giornata_${id}`).value || '1', 10),
      orario: document.getElementById(`orario_${id}`).value.trim(),
      campo: document.getElementById(`campo_${id}`).value.trim(),
      ordine: parseInt(document.getElementById(`ordine_${id}`).value || '0', 10),
      manuale: true,
    });
    toast('Partita aggiornata');
    await renderAdminRisultati();
  } catch (e) {
    console.error(e);
    toast('Errore salvataggio partita');
  }
}

async function createManualMatch() {
  try {
    const girone_id = parseInt(document.getElementById('new_match_girone').value, 10);
    const home_id = parseInt(document.getElementById('new_match_home').value, 10);
    const away_id = parseInt(document.getElementById('new_match_away').value, 10);
    if (!girone_id || !home_id || !away_id) return toast('Compila la partita');
    if (home_id === away_id) return toast('Casa e ospite non possono coincidere');
    await dbSavePartita({
      girone_id,
      home_id,
      away_id,
      fase: normalizePhaseName(document.getElementById('new_match_fase').value),
      giornata: parseInt(document.getElementById('new_match_giornata').value || '1', 10),
      orario: document.getElementById('new_match_orario').value.trim(),
      campo: document.getElementById('new_match_campo').value.trim(),
      ordine: parseInt(document.getElementById('new_match_ordine').value || '0', 10),
      manuale: true,
      giocata: false,
      gol_home: 0,
      gol_away: 0
    });
    toast('Partita manuale aggiunta');
    await renderAdminRisultati();
  } catch (e) {
    console.error(e);
    toast('Errore creazione partita');
  }
}

async function deleteMatchAdvanced(id) {
  if (!confirm('Eliminare questa partita?')) return;
  try {
    await dbDeletePartita(id);
    toast('Partita eliminata');
    await renderAdminRisultati();
  } catch (e) {
    console.error(e);
    toast('Errore eliminazione partita');
  }
}
