// ============================================================
//  SOCCER PRO EXPERIENCE - CLASSIFICA UNICA AVANZATA
// ============================================================

let STATE = {
  tornei: [],
  activeTorneo: null,
  categorie: [],
  activeCat: null,
  isAdmin: false,
  currentSection: 'classifiche',
};

async function init() {
  initDB();
  try {
    STATE.tornei = await dbGetTornei();
    const attivi = STATE.tornei.filter(t => t.attivo);
    if (attivi.length) STATE.activeTorneo = attivi[0].id;
    else if (STATE.tornei.length) STATE.activeTorneo = STATE.tornei[0].id;
    await loadTorneo();
    subscribeRealtime(() => renderCurrentSection());
  } catch (e) {
    console.error(e);
  }
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
}

async function loadTorneo() {
  if (!STATE.activeTorneo) { renderTorneoBar(); renderCatBar(); await renderCurrentSection(); return; }
  STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
  STATE.activeCat = STATE.categorie.length ? STATE.categorie[0].id : null;
  renderTorneoBar();
  renderCatBar();
  await renderCurrentSection();
}

function updateHeader() {
  const t = STATE.tornei.find(t => t.id === STATE.activeTorneo);
  document.getElementById('header-title').textContent = t ? t.nome : 'Soccer Pro Experience';
  document.getElementById('header-date').textContent = t ? t.data || '' : '';
}

function showSection(name, btn) {
  STATE.currentSection = name;
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('sec-' + name);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('cat-bar').style.display = ['a-setup', 'a-tornei'].includes(name) ? 'none' : '';
  renderCurrentSection();
}

async function renderCurrentSection() {
  updateHeader();
  const s = STATE.currentSection;
  if (s === 'classifiche') await renderClassifiche();
  else if (s === 'risultati') await renderRisultati();
  else if (s === 'tabellone') await renderTabellone();
  else if (s === 'a-tornei') await renderAdminTornei();
  else if (s === 'a-setup') await renderAdminSetup();
  else if (s === 'a-loghi') await renderAdminLoghi();
  else if (s === 'a-risultati') await renderAdminRisultati();
  else if (s === 'a-knockout') await renderAdminKnockout();
}

function renderTorneoBar() {
  const bar = document.getElementById('torneo-bar');
  if (!bar) return;
  const attivi = STATE.tornei.filter(t => t.attivo);
  if (attivi.length <= 1) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  bar.innerHTML = `<div class="torneo-bar-inner">${attivi.map(t =>
    `<button class="torneo-pill ${t.id === STATE.activeTorneo ? 'active' : ''}" onclick="selectTorneo(${t.id})">${escapeHtml(t.nome)}</button>`
  ).join('')}</div>`;
}

async function selectTorneo(id) {
  STATE.activeTorneo = id;
  await loadTorneo();
}

function renderCatBar() {
  const bar = document.getElementById('cat-bar');
  if (!bar) return;
  if (!STATE.categorie.length) { bar.innerHTML = ''; return; }
  bar.innerHTML = `<div class="cat-bar-inner">${STATE.categorie.map(c =>
    `<button class="cat-pill ${c.id === STATE.activeCat ? 'active' : ''}" onclick="selectCat(${c.id})">${escapeHtml(c.nome)}</button>`
  ).join('')}</div>`;
}

async function selectCat(id) {
  STATE.activeCat = id;
  renderCatBar();
  await renderCurrentSection();
}

function escapeHtml(v) {
  return String(v || '').replace(/[&<>\"]/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[s]));
}

function logoHTML(sq, size='md') {
  const cls = size==='sm' ? 'team-logo-sm' : 'team-logo';
  const avcls = size==='sm' ? 'team-avatar-sm' : 'team-avatar';
  if (sq && sq.logo) return `<img src="${sq.logo}" class="${cls}" alt="${escapeHtml(sq.nome)}">`;
  const name = sq ? sq.nome : '?';
  const ini = name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();
  return `<div class="${avcls}">${escapeHtml(ini)}</div>`;
}

function toast(msg) {
  const d = document.createElement('div');
  d.textContent = msg;
  d.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,.15)';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}

function toggleAdmin() {
  document.getElementById('admin-modal').style.display = 'flex';
  document.getElementById('admin-pw').value = '';
  document.getElementById('pw-error').textContent = '';
}
function checkPw() {
  const pw = document.getElementById('admin-pw').value;
  if (pw === CONFIG.ADMIN_PASSWORD) {
    STATE.isAdmin = true;
    document.getElementById('admin-modal').style.display = 'none';
    document.getElementById('pub-nav').style.display = 'none';
    document.getElementById('admin-nav').style.display = 'flex';
    showSection('a-setup', document.querySelector('#admin-nav .nav-btn'));
  } else document.getElementById('pw-error').textContent = 'Password errata';
}
function exitAdmin() {
  STATE.isAdmin = false;
  document.getElementById('pub-nav').style.display = 'flex';
  document.getElementById('admin-nav').style.display = 'none';
  const btn = document.querySelector('#pub-nav .nav-btn[data-section="classifiche"]');
  showSection('classifiche', btn);
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

function getScontroDiretto(girone, idA, idB) {
  let ptsA=0, ptsB=0, gfA=0, gfB=0;
  for (const p of girone.partite) {
    if (!p.giocata) continue;
    if (p.home_id===idA && p.away_id===idB) {
      gfA += p.gol_home; gfB += p.gol_away;
      if (p.gol_home > p.gol_away) ptsA += 3;
      else if (p.gol_home < p.gol_away) ptsB += 3;
      else { ptsA++; ptsB++; }
    } else if (p.home_id===idB && p.away_id===idA) {
      gfB += p.gol_home; gfA += p.gol_away;
      if (p.gol_home > p.gol_away) ptsB += 3;
      else if (p.gol_home < p.gol_away) ptsA += 3;
      else { ptsA++; ptsB++; }
    }
  }
  if (ptsB !== ptsA) return ptsB - ptsA;
  return (gfB - gfA);
}

function calcGironeClassifica(girone) {
  const map = {};
  for (const sq of girone.squadre) map[sq.id] = { sq, g:0, v:0, p:0, s:0, gf:0, gs:0, pts:0 };
  for (const p of girone.partite) {
    if (!p.giocata) continue;
    const h = map[p.home_id], a = map[p.away_id];
    if (!h || !a) continue;
    h.g++; a.g++;
    h.gf += p.gol_home; h.gs += p.gol_away;
    a.gf += p.gol_away; a.gs += p.gol_home;
    if (p.gol_home > p.gol_away) { h.v++; h.pts += 3; a.s++; }
    else if (p.gol_home < p.gol_away) { a.v++; a.pts += 3; h.s++; }
    else { h.p++; h.pts++; a.p++; a.pts++; }
  }
  return Object.values(map).sort((a,b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const sd = getScontroDiretto(girone, a.sq.id, b.sq.id);
    if (sd !== 0) return sd;
    const gdA = a.gf - a.gs, gdB = b.gf - b.gs;
    if (gdB !== gdA) return gdB - gdA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.sq.nome.localeCompare(b.sq.nome, 'it');
  });
}

function parsePriorityMap(text) {
  const map = {};
  String(text || '').split('\n').map(x => x.trim()).filter(Boolean).forEach(line => {
    const parts = line.split(':');
    if (parts.length < 2) return;
    const name = parts.slice(0, -1).join(':').trim().toLowerCase();
    const value = parseInt(parts[parts.length - 1].trim(), 10);
    if (name) map[name] = Number.isFinite(value) ? value : 1;
  });
  return map;
}

function buildRoundRobin(teamIds) {
  const teams = [...teamIds];
  if (teams.length % 2 === 1) teams.push(null);
  const rounds = [];
  const arr = [...teams];
  for (let r = 0; r < arr.length - 1; r++) {
    const pairs = [];
    for (let i = 0; i < arr.length / 2; i++) {
      const a = arr[i];
      const b = arr[arr.length - 1 - i];
      if (a && b) pairs.push(r % 2 === 0 ? [a,b] : [b,a]);
    }
    rounds.push(pairs);
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return rounds;
}

function buildSchedule(teamRows, priorityIds = [], slotRows = []) {
  const prioritySet = new Set(priorityIds);
  const rounds = buildRoundRobin(teamRows.map(t => t.id));
  const out = [];
  let matchOrder = 1;
  rounds.forEach((pairs, roundIndex) => {
    const sortedPairs = [...pairs].sort((a,b) => {
      const sa = (prioritySet.has(a[0])?1:0)+(prioritySet.has(a[1])?1:0);
      const sb = (prioritySet.has(b[0])?1:0)+(prioritySet.has(b[1])?1:0);
      return sb - sa;
    });
    sortedPairs.forEach((pair, idx) => {
      const slot = slotRows[idx % Math.max(slotRows.length,1)] || {};
      out.push({
        home_id: pair[0],
        away_id: pair[1],
        giornata: roundIndex + 1,
        ordine: matchOrder++,
        orario: slot.orario || '',
        campo: slot.campo || ''
      });
    });
  });
  return out;
}

function parseSlotRows(text) {
  return String(text || '').split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const [orario, campo] = line.split('|').map(x => (x || '').trim());
    return { orario: orario || '', campo: campo || '' };
  });
}

// ===== PUBLIC =====
async function renderClassifiche() {
  const el = document.getElementById('sec-classifiche');
  if (!STATE.activeCat) { el.innerHTML = '<div class="empty-state">Nessun campionato configurato.</div>'; return; }
  const gironi = await getGironiWithData(STATE.activeCat);
  const g = gironi[0];
  if (!g) { el.innerHTML = '<div class="empty-state">Nessuna classifica disponibile.</div>'; return; }
  const cl = calcGironeClassifica(g);
  const played = g.partite.filter(p => p.giocata).length;
  let html = `<div class="card"><div class="card-title">Classifica unica <span class="badge badge-gray">${played}/${g.partite.length} partite</span></div>
    <table class="standings-table"><thead><tr><th>#</th><th colspan="2">Squadra</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>GD</th><th>Pt</th></tr></thead><tbody>`;
  cl.forEach((row, idx) => {
    const diff = row.gf - row.gs;
    html += `<tr>
      <td>${idx + 1}</td>
      <td style="padding-right:4px;">${logoHTML(row.sq,'sm')}</td>
      <td>${escapeHtml(row.sq.nome)}</td>
      <td>${row.g}</td><td>${row.v}</td><td>${row.p}</td><td>${row.s}</td>
      <td>${row.gf}</td><td>${row.gs}</td>
      <td class="${diff>0?'diff-pos':diff<0?'diff-neg':''}">${diff>0?'+':''}${diff}</td>
      <td class="pts-col">${row.pts}</td>
    </tr>`;
  });
  html += `</tbody></table><div style="font-size:11px;color:#888;margin-top:10px;padding-top:8px;border-top:1px solid #f1f1f1;">Criteri: punti → scontro diretto → differenza reti → gol fatti</div></div>`;
  el.innerHTML = html;
}

function renderMatchMeta(p) {
  const bits = [];
  if (p.giornata) bits.push(`Giornata ${p.giornata}`);
  if (p.orario) bits.push(`Ore ${escapeHtml(p.orario)}`);
  if (p.campo) bits.push(`Campo ${escapeHtml(p.campo)}`);
  return bits.length ? `<div style="font-size:12px;color:#777;margin-bottom:6px;">${bits.join(' • ')}</div>` : '';
}

async function renderRisultati() {
  const el = document.getElementById('sec-risultati');
  if (!STATE.activeCat) { el.innerHTML = '<div class="empty-state">Nessun campionato configurato.</div>'; return; }
  const gironi = await getGironiWithData(STATE.activeCat);
  const g = gironi[0];
  if (!g) { el.innerHTML = '<div class="empty-state">Nessuna partita.</div>'; return; }
  const giocate = g.partite.filter(p => p.giocata);
  const dafare = g.partite.filter(p => !p.giocata);
  let html = '';
  if (giocate.length) {
    html += `<div class="section-label">Risultati</div><div class="card">`;
    giocate.forEach(p => {
      html += `${renderMatchMeta(p)}<div class="match-result">
        <div class="match-team">${logoHTML(p.home,'sm')}<span>${escapeHtml(p.home?.nome || '?')}</span></div>
        <div class="match-score">${p.gol_home} — ${p.gol_away}</div>
        <div class="match-team right"><span>${escapeHtml(p.away?.nome || '?')}</span>${logoHTML(p.away,'sm')}</div>
      </div>`;
    });
    html += `</div>`;
  }
  if (dafare.length) {
    html += `<div class="section-label">Calendario</div><div class="card">`;
    dafare.forEach(p => {
      html += `${renderMatchMeta(p)}<div class="match-result">
        <div class="match-team">${logoHTML(p.home,'sm')}<span>${escapeHtml(p.home?.nome || '?')}</span></div>
        <div class="match-score pending">vs</div>
        <div class="match-team right"><span>${escapeHtml(p.away?.nome || '?')}</span>${logoHTML(p.away,'sm')}</div>
      </div>`;
    });
    html += `</div>`;
  }
  el.innerHTML = html || '<div class="empty-state">Nessuna partita.</div>';
}

async function renderTabellone() {
  const el = document.getElementById('sec-tabellone');
  el.innerHTML = '<div class="empty-state">In questa versione c’è una sola classifica unica. Nessun tabellone finale.</div>';
}

// ===== ADMIN TORNEI =====
async function renderAdminTornei() {
  const el = document.getElementById('sec-a-tornei');
  if (!el) return;
  STATE.tornei = await dbGetTornei();
  let html = `<div class="section-label">Tornei</div>`;
  if (!STATE.tornei.length) html += `<div class="empty-state">Nessun torneo. Creane uno!</div>`;
  for (const t of STATE.tornei) {
    html += `<div class="card"><div class="card-title"><div><div style="font-weight:600;">${escapeHtml(t.nome)}</div><div style="font-size:12px;color:#999;">${escapeHtml(t.data || '')}</div></div>
      <div style="display:flex;gap:6px;align-items:center;">
        <span class="badge ${t.attivo?'badge-green':'badge-gray'}">${t.attivo?'Attivo':'Archiviato'}</span>
        <button class="btn btn-sm ${t.attivo?'':'btn-p'}" onclick="toggleTorneo(${t.id}, ${t.attivo})">${t.attivo?'Archivia':'Riattiva'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTorneo(${t.id})">Elimina</button>
      </div></div></div>`;
  }
  html += `<div class="section-label">Nuovo torneo</div><div class="card"><div class="form-grid-2">
    <div class="form-group"><label class="form-label">Nome torneo</label><input class="form-input" id="new-t-nome" placeholder="Campionato Under 12"></div>
    <div class="form-group"><label class="form-label">Data</label><input class="form-input" id="new-t-data" placeholder="Aprile 2026"></div>
  </div><button class="btn btn-p" onclick="createTorneo()">Crea torneo</button></div>`;
  el.innerHTML = html;
}

async function createTorneo() {
  const nome = document.getElementById('new-t-nome').value.trim();
  const data = document.getElementById('new-t-data').value.trim();
  if (!nome) { alert('Inserisci il nome del torneo'); return; }
  const t = await dbSaveTorneo({ nome, data, attivo: true });
  STATE.tornei = await dbGetTornei();
  STATE.activeTorneo = t.id;
  await loadTorneo();
  toast('Torneo creato');
  await renderAdminTornei();
}

async function toggleTorneo(id, attivo) {
  await dbUpdateTorneo(id, { attivo: !attivo });
  STATE.tornei = await dbGetTornei();
  if (STATE.activeTorneo === id && attivo) STATE.activeTorneo = STATE.tornei.find(t => t.attivo)?.id || null;
  await loadTorneo();
  toast(attivo ? 'Torneo archiviato' : 'Torneo riattivato');
}

async function deleteTorneo(id) {
  if (!confirm('Eliminare questo torneo e tutti i dati collegati?')) return;
  await dbDeleteTorneo(id);
  STATE.tornei = await dbGetTornei();
  STATE.activeTorneo = STATE.tornei.find(t => t.attivo)?.id || STATE.tornei[0]?.id || null;
  await loadTorneo();
  toast('Torneo eliminato');
}

// ===== ADMIN SETUP =====
async function renderAdminSetup() {
  const el = document.getElementById('sec-a-setup');
  if (!STATE.activeTorneo) { el.innerHTML = '<div class="empty-state">Crea prima un torneo.</div>'; return; }
  let html = `<div class="section-label">Campionato a classifica unica</div>`;
  for (const cat of STATE.categorie) {
    const gironi = await dbGetGironi(cat.id);
    const g = gironi[0];
    const members = g ? await dbGetGironeSquadre(g.id) : [];
    html += `<div class="card"><div class="card-title">${escapeHtml(cat.nome)}
      <div style="display:flex;gap:6px;"><button class="btn btn-danger btn-sm" onclick="deleteCat(${cat.id})">Elimina</button></div></div>
      <div style="font-size:13px;color:#555;">Squadre: ${members.map(m => escapeHtml(m.squadre.nome)).join(', ') || '—'}</div>
    </div>`;
  }

  html += `<div class="section-label">Crea campionato</div><div class="card">
    <div class="form-grid-2">
      <div class="form-group"><label class="form-label">Nome categoria</label><input class="form-input" id="cname" placeholder="Under 12 Elite"></div>
      <div class="form-group"><label class="form-label">Girone</label><input class="form-input" id="gname" value="Classifica unica"></div>
    </div>
    <div class="form-group"><label class="form-label">8 squadre (una per riga)</label>
      <textarea class="form-input" id="cteams" rows="8" placeholder="Juventus\nMilan\nInter\nRoma\nNapoli\nFiorentina\nTorino\nLazio"></textarea></div>
    <div class="form-group"><label class="form-label">Squadre con priorità per giocare prima (una per riga oppure Nome:2)</label>
      <textarea class="form-input" id="cpriority" rows="4" placeholder="Juventus\nMilan\nRoma:2"></textarea></div>
    <div class="form-group"><label class="form-label">Slot automatici (uno per riga nel formato Orario|Campo)</label>
      <textarea class="form-input" id="cslots" rows="5" placeholder="09:00|Campo 1\n09:00|Campo 2\n09:30|Campo 1\n09:30|Campo 2"></textarea></div>
    <button class="btn btn-p" onclick="addSingleLeagueCategoria()">Crea campionato e calendario</button>
  </div>`;

  if (STATE.activeCat) {
    const gironi = await getGironiWithData(STATE.activeCat);
    const g = gironi[0];
    const allTeams = await dbGetSquadre(STATE.activeTorneo);
    const memberIds = new Set((g?.squadre || []).map(s => s.id));
    const options = allTeams.filter(s => memberIds.has(s.id)).map(s => `<option value="${s.id}">${escapeHtml(s.nome)}</option>`).join('');
    html += `<div class="section-label">Aggiungi scontro manuale</div><div class="card">
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Squadra casa</label><select class="form-input" id="m-home">${options}</select></div>
        <div class="form-group"><label class="form-label">Squadra ospite</label><select class="form-input" id="m-away">${options}</select></div>
      </div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Orario</label><input class="form-input" id="m-time" placeholder="10:30"></div>
        <div class="form-group"><label class="form-label">Campo</label><input class="form-input" id="m-field" placeholder="Campo 1"></div>
      </div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Giornata</label><input class="form-input" id="m-round" type="number" min="1" value="1"></div>
        <div class="form-group"><label class="form-label">Ordine</label><input class="form-input" id="m-order" type="number" min="1" value="999"></div>
      </div>
      <button class="btn btn-p" onclick="addManualMatch()">Aggiungi partita manuale</button>
    </div>`;
  }
  el.innerHTML = html;
}

async function addSingleLeagueCategoria() {
  const nome = document.getElementById('cname').value.trim();
  const gname = document.getElementById('gname').value.trim() || 'Classifica unica';
  const teamLines = document.getElementById('cteams').value.split('\n').map(x => x.trim()).filter(Boolean);
  const priorityText = document.getElementById('cpriority').value.trim();
  const slotRows = parseSlotRows(document.getElementById('cslots').value);
  if (!nome || teamLines.length < 2) { alert('Inserisci nome e squadre'); return; }
  const cat = await dbSaveCategoria({ nome, qualificate: 0, formato: 'league', ordine: STATE.categorie.length, torneo_id: STATE.activeTorneo });
  STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
  STATE.activeCat = cat.id;
  const girone = await dbSaveGirone({ categoria_id: cat.id, nome: gname });
  const existing = await dbGetSquadre(STATE.activeTorneo);
  const squadraRows = [];
  const priorityMap = parsePriorityMap(priorityText);
  for (const tn of teamLines) {
    let sq = existing.find(s => s.nome.toLowerCase() === tn.toLowerCase());
    const priorita = priorityMap[tn.toLowerCase()] ?? (priorityText.split('\n').some(x => x.trim().toLowerCase() === tn.toLowerCase()) ? 1 : 0);
    if (!sq) sq = await dbSaveSquadra({ nome: tn, torneo_id: STATE.activeTorneo, priorita });
    else if ((sq.priorita || 0) !== priorita) sq = await dbSaveSquadra({ ...sq, priorita });
    squadraRows.push(sq);
  }
  await dbSetGironeSquadre(girone.id, squadraRows.map(s => s.id));
  const priorityIds = squadraRows.filter(s => (s.priorita || 0) > 0).sort((a,b) => (b.priorita||0)-(a.priorita||0)).map(s => s.id);
  const schedule = buildSchedule(squadraRows, priorityIds, slotRows);
  await dbReplaceSchedule(girone.id, schedule);
  renderCatBar();
  toast('Campionato creato');
  await renderAdminSetup();
}

async function deleteCat(id) {
  if (!confirm('Eliminare questa categoria?')) return;
  await dbDeleteCategoria(id);
  STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
  STATE.activeCat = STATE.categorie[0]?.id || null;
  renderCatBar();
  await renderAdminSetup();
}

async function addManualMatch() {
  const home_id = parseInt(document.getElementById('m-home').value, 10);
  const away_id = parseInt(document.getElementById('m-away').value, 10);
  const orario = document.getElementById('m-time').value.trim();
  const campo = document.getElementById('m-field').value.trim();
  const giornata = parseInt(document.getElementById('m-round').value, 10) || 1;
  const ordine = parseInt(document.getElementById('m-order').value, 10) || 999;
  if (!STATE.activeCat) return;
  if (!home_id || !away_id || home_id === away_id) { alert('Scegli due squadre diverse'); return; }
  const gironi = await dbGetGironi(STATE.activeCat);
  const girone = gironi[0];
  if (!girone) return;
  await dbCreatePartita({ girone_id: girone.id, home_id, away_id, orario, campo, giornata, ordine, giocata: false, manuale: true });
  toast('Partita aggiunta');
  await renderAdminSetup();
}

// ===== ADMIN LOGHI =====
async function renderAdminLoghi() {
  const el = document.getElementById('sec-a-loghi');
  const squadre = await dbGetSquadre(STATE.activeTorneo);
  if (!squadre.length) { el.innerHTML = '<div class="empty-state">Aggiungi prima le squadre nel setup.</div>'; return; }
  let html = '<div class="section-label">Loghi squadre</div><div class="card">';
  html += `<div style="font-size:13px;color:#666;margin-bottom:14px;">Clicca sul logo per caricare o cambiare l'immagine.</div>`;
  for (const sq of squadre) {
    html += `<div class="logo-team-row">
      <div class="logo-upload-btn">${logoHTML(sq,'md')}<div class="logo-plus">+</div><input type="file" accept="image/*" onchange="uploadLogo(event, ${sq.id})"></div>
      <div style="flex:1;"><div style="font-size:14px;font-weight:600;">${escapeHtml(sq.nome)}</div><div style="font-size:12px;color:#aaa;">Priorità: ${sq.priorita || 0}</div></div>
      <button class="btn btn-sm" onclick="editPriority(${sq.id}, '${escapeHtml(sq.nome).replace(/'/g, "&#39;")}')">Priorità</button>
      ${sq.logo ? `<button class="btn btn-danger btn-sm" onclick="removeLogo(${sq.id})">Rimuovi</button>` : ''}
    </div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

async function editPriority(squadra_id, nome) {
  const squadre = await dbGetSquadre(STATE.activeTorneo);
  const sq = squadre.find(x => x.id === squadra_id);
  const val = prompt(`Priorità per ${nome} (0 nessuna, 1 normale, 2 alta):`, sq?.priorita || 0);
  if (val === null) return;
  const priorita = parseInt(val, 10) || 0;
  await dbUpdateSquadra(squadra_id, { priorita });
  toast('Priorità aggiornata');
  await renderAdminLoghi();
}

async function uploadLogo(event, squadra_id) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    await dbUpdateLogo(squadra_id, e.target.result);
    toast('Logo caricato');
    await renderAdminLoghi();
  };
  reader.readAsDataURL(file);
}
async function removeLogo(squadra_id) {
  await dbUpdateLogo(squadra_id, null);
  toast('Logo rimosso');
  await renderAdminLoghi();
}

// ===== ADMIN RISULTATI =====
async function renderAdminRisultati() {
  const el = document.getElementById('sec-a-risultati');
  if (!STATE.activeCat) { el.innerHTML = '<div class="empty-state">Nessun campionato.</div>'; return; }
  const gironi = await getGironiWithData(STATE.activeCat);
  const g = gironi[0];
  if (!g) { el.innerHTML = '<div class="empty-state">Nessuna partita.</div>'; return; }
  let html = `<div class="section-label">Calendario e risultati <span class="badge badge-gray" style="margin-left:6px;">${g.partite.filter(p=>p.giocata).length}/${g.partite.length}</span></div>`;
  for (const p of g.partite) {
    let badge = '';
    if (p.giocata) {
      if (p.gol_home > p.gol_away) badge = `<span class="badge badge-green">${escapeHtml(p.home?.nome || '')} vince</span>`;
      else if (p.gol_home < p.gol_away) badge = `<span class="badge badge-green">${escapeHtml(p.away?.nome || '')} vince</span>`;
      else badge = `<span class="badge badge-blue">Pareggio</span>`;
    }
    html += `<div class="admin-match">
      <div style="display:grid;grid-template-columns:1fr 1fr 120px 120px;gap:10px;margin-bottom:10px;">
        <input class="form-input" id="mt_${p.id}" value="${escapeHtml(p.orario || '')}" placeholder="Orario 09:30">
        <input class="form-input" id="mf_${p.id}" value="${escapeHtml(p.campo || '')}" placeholder="Campo 1">
        <input class="form-input" id="mg_${p.id}" type="number" min="1" value="${p.giornata || 1}" placeholder="Giornata">
        <input class="form-input" id="mo_${p.id}" type="number" min="1" value="${p.ordine || 999}" placeholder="Ordine">
      </div>
      <div class="admin-match-header">
        <div class="admin-team-name">${logoHTML(p.home,'sm')}<span>${escapeHtml(p.home?.nome || '?')}</span></div>
        <input class="score-input" type="number" min="0" max="50" value="${p.giocata ? p.gol_home : ''}" id="sh_${p.id}" placeholder="—">
        <span class="score-dash">—</span>
        <input class="score-input" type="number" min="0" max="50" value="${p.giocata ? p.gol_away : ''}" id="sa_${p.id}" placeholder="—">
        <div class="admin-team-name right"><span>${escapeHtml(p.away?.nome || '?')}</span>${logoHTML(p.away,'sm')}</div>
        <div class="match-actions"><button class="btn btn-p btn-sm" onclick="saveRisultato(${p.id})">✓ Conferma</button>${badge}<button class="btn btn-danger btn-sm" onclick="deleteMatch(${p.id})">Elimina</button></div>
      </div>
    </div>`;
  }
  el.innerHTML = html;
}

async function saveRisultato(partita_id) {
  const gol_home = document.getElementById('sh_' + partita_id).value;
  const gol_away = document.getElementById('sa_' + partita_id).value;
  const orario = document.getElementById('mt_' + partita_id).value.trim();
  const campo = document.getElementById('mf_' + partita_id).value.trim();
  const giornata = parseInt(document.getElementById('mg_' + partita_id).value, 10) || 1;
  const ordine = parseInt(document.getElementById('mo_' + partita_id).value, 10) || 999;
  const payload = { id: partita_id, orario, campo, giornata, ordine };
  if (gol_home !== '' && gol_away !== '') {
    payload.gol_home = parseInt(gol_home, 10);
    payload.gol_away = parseInt(gol_away, 10);
    payload.giocata = true;
  }
  try {
    await dbSavePartita(payload);
    toast('Partita salvata');
    await renderAdminRisultati();
    if (STATE.currentSection === 'classifiche' || STATE.currentSection === 'risultati') await renderCurrentSection();
  } catch (e) {
    console.error(e);
    toast('Errore nel salvataggio');
  }
}

async function deleteMatch(id) {
  if (!confirm('Eliminare questa partita?')) return;
  await dbDeletePartita(id);
  toast('Partita eliminata');
  await renderAdminRisultati();
}

async function renderAdminKnockout() {
  const el = document.getElementById('sec-a-knockout');
  el.innerHTML = '<div class="empty-state">Questa modalità usa solo la classifica unica. Nessuna fase finale.</div>';
}

window.addEventListener('DOMContentLoaded', init);
