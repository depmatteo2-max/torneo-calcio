// ============================================================
//  SOCCER PRO EXPERIENCE - App principale completa
//  Include: classifica con spareggio + risoluzione automatica triangolari
//  + Risultati ordinati per orario + chi ha inserito
// ============================================================

let STATE = {
  tornei: [],
  activeTorneo: null,
  categorie: [],
  activeCat: null,
  activeGiornata: 'tutte',
  isAdmin: false,
  currentSection: 'classifiche',
  userRole: null,
  userName: null,
};

async function init() {
  initDB();
  try {
    STATE.tornei = await dbGetTornei();
    const savedId = _loadSavedTorneo();
    const attivi = STATE.tornei.filter(t => t.attivo);
    if (savedId && attivi.find(t => t.id === savedId)) STATE.activeTorneo = savedId;
    else if (attivi.length) STATE.activeTorneo = attivi[0].id;
    else if (STATE.tornei.length) STATE.activeTorneo = STATE.tornei[0].id;
    subscribeRealtime(() => { if (!STATE.isAdmin) renderCurrentSection(); });
  } catch (e) { console.error(e); }

  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';

  const attivi = STATE.tornei.filter(t => t.attivo);
  if (!attivi.length) { await loadTorneo(); tryAutoLogin(); return; }
  if (attivi.length > 1 && !STATE.activeTorneo) { mostraSelezioneTeorneo(); tryAutoLogin(); return; }
  await loadTorneo();
  tryAutoLogin();
}

function mostraSelezioneTeorneo() {
  const attivi = STATE.tornei.filter(t => t.attivo);
  document.getElementById('pub-nav').style.display = 'none';
  document.getElementById('admin-nav').style.display = 'none';
  document.getElementById('cat-bar').style.display = 'none';
  document.getElementById('torneo-bar').style.display = 'none';
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div style="min-height:80vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;">
      <img id="sel-logo" style="width:90px;height:90px;border-radius:50%;object-fit:cover;box-shadow:0 4px 20px rgba(0,0,0,0.15);margin-bottom:20px;" alt="SPE">
      <div style="font-size:22px;font-weight:800;color:#1a2a3a;margin-bottom:4px;">Soccer Pro Experience</div>
      <div style="font-size:14px;color:#888;margin-bottom:32px;">Seleziona il torneo da seguire</div>
      <div style="width:100%;max-width:400px;display:flex;flex-direction:column;gap:12px;">
        ${attivi.map(t => `
          <button onclick="selezionaTorneoPublic(${t.id})"
            style="background:white;border:2px solid #e8edf2;border-radius:14px;padding:16px 20px;text-align:left;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.06);transition:all 0.15s ease;font-family:inherit;"
            onmouseover="this.style.borderColor='#E85C00';this.style.transform='translateY(-1px)'"
            onmouseout="this.style.borderColor='#e8edf2';this.style.transform='translateY(0)'">
            <div style="font-size:16px;font-weight:700;color:#1a2a3a;">${t.nome}</div>
            <div style="font-size:13px;color:#888;margin-top:3px;">📅 ${t.data || 'Data da definire'} &nbsp;•&nbsp; 🔴 Live</div>
          </button>`).join('')}
      </div>
    </div>`;
  if (typeof getLogo === 'function') { const l = getLogo(); if (l) { const img = document.getElementById('sel-logo'); if (img) img.src = l; } }
}

async function selezionaTorneoPublic(id) {
  STATE.activeTorneo = id;
  _saveSavedTorneo(id);

  // Ricrea le sezioni
  document.getElementById('main-content').innerHTML =
    '<div id="sec-classifiche" class="sec active"></div><div id="sec-risultati" class="sec"></div>' +
    '<div id="sec-tabellone" class="sec"></div><div id="sec-a-tornei" class="sec"></div>' +
    '<div id="sec-a-setup" class="sec"></div><div id="sec-a-loghi" class="sec"></div>' +
    '<div id="sec-a-risultati" class="sec"></div><div id="sec-a-knockout" class="sec"></div>';

  // Mostra nav pubblica, resetta bottoni attivi
  document.getElementById('pub-nav').style.display = 'flex';
  document.querySelectorAll('#pub-nav .nav-btn').forEach(b => b.classList.remove('active'));
  const btnClass = document.querySelector('[data-section="classifiche"]');
  if (btnClass) btnClass.classList.add('active');

  STATE.currentSection = 'classifiche';
  STATE.activeCat = null; // reset categoria per mostrare selezione
  await loadTorneo();
}

function _saveSavedTorneo(id) { try { localStorage.setItem('spe_torneo', String(id)); } catch(e) {} }
function _loadSavedTorneo() { try { const v = localStorage.getItem('spe_torneo'); return v ? parseInt(v) : null; } catch(e) { return null; } }

async function loadTorneo() {
  if (!STATE.activeTorneo) { renderTorneoBar(); renderCatBar(); renderCurrentSection(); return; }
  _saveSavedTorneo(STATE.activeTorneo);
  STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
  STATE.activeGiornata = 'tutte';
  STATE._giornateDisponibili = [];

  // Se ci sono più categorie e nessuna è già selezionata, mostra selezione
  if (STATE.categorie.length > 1 && !STATE.activeCat) {
    STATE.activeCat = null;
    renderTorneoBar();
    document.getElementById('cat-bar').style.display = 'none';
    mostraSelezioneCat();
    return;
  }

  STATE.activeCat = STATE.categorie.length ? STATE.categorie[0].id : null;
  if (STATE.activeCat) await _caricaGiornate();
  renderTorneoBar(); renderCatBar(); await renderCurrentSection();
}

function mostraSelezioneCat() {
  const main = document.getElementById('main-content');
  // Ricrea sezioni
  main.innerHTML =
    '<div id="sec-classifiche" class="sec active"></div><div id="sec-risultati" class="sec"></div>' +
    '<div id="sec-tabellone" class="sec"></div><div id="sec-a-tornei" class="sec"></div>' +
    '<div id="sec-a-setup" class="sec"></div><div id="sec-a-loghi" class="sec"></div>' +
    '<div id="sec-a-risultati" class="sec"></div><div id="sec-a-knockout" class="sec"></div>';

  const el = document.getElementById('sec-classifiche');
  el.classList.add('active');

  const t = STATE.tornei.find(x => x.id === STATE.activeTorneo);
  const oggiLabel = STATE._giornateDisponibili?.length
    ? _trovaGiornataOggi(STATE._giornateDisponibili) : null;

  el.innerHTML = `
    <div class="cat-select-screen">
      ${oggiLabel ? `<div style="background:var(--arancio-bg);border:1px solid rgba(234,88,12,0.2);
        border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:13px;font-weight:600;color:var(--arancio);
        display:flex;align-items:center;gap:8px;">
        <span class="oggi-dot"></span> Oggi: ${oggiLabel}
      </div>` : ''}
      <div class="cat-select-title">Seleziona categoria</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${STATE.categorie.map(c => `
          <button class="cat-select-btn" onclick="selezionaCategoriaPublic(${c.id})">
            <div>
              <div class="cat-select-btn-nome">${c.nome}</div>
              ${c.note ? `<div class="cat-select-btn-sub">${c.note}</div>` : ''}
            </div>
            <span class="cat-select-arrow">›</span>
          </button>`).join('')}
      </div>
      <button class="cat-select-all" onclick="mostraTutteLCategorie()">
        📊 Vedi tutte le categorie insieme
      </button>
    </div>`;

  // Mostra nav pubblica
  document.getElementById('pub-nav').style.display = 'flex';
  document.querySelectorAll('#pub-nav .nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector('[data-section="classifiche"]');
  if (btn) btn.classList.add('active');
  STATE.currentSection = 'classifiche';
}

async function selezionaCategoriaPublic(catId) {
  STATE.activeCat = catId;
  STATE.activeGiornata = 'tutte';
  STATE._giornateDisponibili = [];
  await _caricaGiornate();
  renderCatBar();
  document.getElementById('cat-bar').style.display = '';
  await renderCurrentSection();
}

async function mostraTutteLCategorie() {
  // Seleziona prima categoria e mostra tutto
  STATE.activeCat = STATE.categorie[0]?.id || null;
  if (STATE.activeCat) await _caricaGiornate();
  renderCatBar();
  document.getElementById('cat-bar').style.display = '';
  await renderCurrentSection();
}

function renderTorneoBar() {
  const bar = document.getElementById('torneo-bar'); if (!bar) return;
  const attivi = STATE.tornei.filter(t => t.attivo);
  if (attivi.length <= 1) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  const t = STATE.tornei.find(x => x.id === STATE.activeTorneo);
  bar.innerHTML = `<div class="torneo-bar-inner">
    <span style="font-size:13px;font-weight:600;color:#1a2a3a;flex:1;">${t?.nome || ''}</span>
    <button onclick="cambiaTorneo()" style="background:#f0f4f8;border:1px solid #dde3ea;border-radius:8px;padding:5px 12px;font-size:12px;font-weight:600;color:#E85C00;cursor:pointer;">🔄 Cambia torneo</button>
  </div>`;
}

async function cambiaTorneo() {
  STATE.activeTorneo = null;
  STATE.categorie = [];
  STATE.activeCat = null;
  STATE.activeGiornata = 'tutte';
  STATE._giornateDisponibili = [];
  try { localStorage.removeItem('spe_torneo'); } catch(e) {}

  // Ricarica lista tornei
  STATE.tornei = await dbGetTornei();

  // Nascondi navigazione
  document.getElementById('pub-nav').style.display = 'none';
  if (document.getElementById('admin-nav')) document.getElementById('admin-nav').style.display = 'none';
  const catBar = document.getElementById('cat-bar');
  if (catBar) catBar.innerHTML = '';
  const torneoBar = document.getElementById('torneo-bar');
  if (torneoBar) torneoBar.style.display = 'none';

  // Ricrea le sezioni nel main-content
  document.getElementById('main-content').innerHTML =
    '<div id="sec-classifiche" class="sec active"></div><div id="sec-risultati" class="sec"></div>' +
    '<div id="sec-tabellone" class="sec"></div><div id="sec-a-tornei" class="sec"></div>' +
    '<div id="sec-a-setup" class="sec"></div><div id="sec-a-loghi" class="sec"></div>' +
    '<div id="sec-a-risultati" class="sec"></div><div id="sec-a-knockout" class="sec"></div>';

  mostraSelezioneTeorneo();
}

async function selectTorneo(id) { STATE.activeTorneo = id; _saveSavedTorneo(id); await loadTorneo(); }

function updateHeader() {
  const t = STATE.tornei.find(t => t.id === STATE.activeTorneo);
  const titleEl = document.getElementById('header-title');
  const dateEl = document.getElementById('header-date');
  if (titleEl) titleEl.textContent = t ? t.nome : 'Soccer Pro Experience';
  if (dateEl) dateEl.textContent = t ? t.data || '' : '';
}

function showSection(name, btn) {
  STATE.currentSection = name;
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + name); if (sec) sec.classList.add('active');
  document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('cat-bar').style.display = ['a-setup','a-tornei'].includes(name) ? 'none' : '';
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

function renderCatBar() {
  const bar = document.getElementById('cat-bar');
  if (!STATE.categorie.length) { bar.innerHTML = ''; return; }

  // Mostra solo barra giornate (le categorie si vedono in cascata)
  bar.innerHTML = `<div id="giornata-bar" class="cat-bar-inner" style="flex-wrap:wrap;gap:4px;"></div>`;
  _renderGiornataBar();
}

function _renderGiornataBar() {
  const bar = document.getElementById('giornata-bar');
  if (!bar) return;
  const giornate = STATE._giornateDisponibili || [];
  if (giornate.length <= 1) { bar.innerHTML = ''; return; }

  // Rileva la giornata di oggi
  const oggi = _trovaGiornataOggi(giornate);

  bar.innerHTML = [
    { id: 'tutte', label: '📅 Tutte', oggi: false },
    ...giornate.map(g => ({ id: g, label: _labelGiornata(g), oggi: g === oggi }))
  ].map(g => {
    const isActive = STATE.activeGiornata === g.id;
    const isOggi = g.oggi;
    return `<button class="cat-pill ${isActive ? 'active' : ''} ${isOggi && !isActive ? 'oggi-pill' : ''}"
      style="font-size:11px;padding:3px 10px;"
      onclick="selectGiornata('${g.id}')">
      ${isOggi ? '🔴 ' : ''}${g.label}
    </button>`;
  }).join('');
}

function _labelGiornata(g) {
  // Abbrevia "4 Aprile 2026" → "Sab 4 Apr"
  const giorni = {'sabato':'Sab','domenica':'Dom','lunedì':'Lun','martedì':'Mar','mercoledì':'Mer','giovedì':'Gio','venerdì':'Ven'};
  const mesi = {'gennaio':'Gen','febbraio':'Feb','marzo':'Mar','aprile':'Apr','maggio':'Mag','giugno':'Giu',
                 'luglio':'Lug','agosto':'Ago','settembre':'Set','ottobre':'Ott','novembre':'Nov','dicembre':'Dic'};
  let label = g;
  for (const [full, short] of Object.entries(mesi)) {
    label = label.toLowerCase().replace(full, short);
  }
  // Rimuovi anno
  label = label.replace(/20\d\d/,'').trim().replace(/\s+/g,' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function _trovaGiornataOggi(giornate) {
  // Confronta ogni giornata con la data di oggi
  const ora = new Date();
  const mesiMap = {'gennaio':0,'febbraio':1,'marzo':2,'aprile':3,'maggio':4,'giugno':5,
                   'luglio':6,'agosto':7,'settembre':8,'ottobre':9,'novembre':10,'dicembre':11};
  for (const g of giornate) {
    const parts = g.toLowerCase().split(/\s+/);
    const giorno = parseInt(parts.find(p => /^\d+$/.test(p)));
    const meseStr = parts.find(p => mesiMap[p] !== undefined);
    const anno = parseInt(parts.find(p => /^20\d\d$/.test(p)));
    if (giorno && meseStr) {
      const mese = mesiMap[meseStr];
      const dataG = new Date(anno || ora.getFullYear(), mese, giorno);
      if (dataG.toDateString() === ora.toDateString()) return g;
    }
  }
  return null;
}

function _abbreviaNomeCat(nome) {
  // Abbrevia nomi lunghi per la pill bar
  const abbr = {
    'Girone Silver 1': 'Silver 1', 'Girone Silver 2': 'Silver 2',
    'Girone Gold 1': 'Gold 1', 'Girone Gold 2': 'Gold 2',
    'Pulcini 2016': 'Pulcini', 'Esordienti 2013': 'Esord. 2013',
    'Esordienti 2014': 'Esord. 2014', 'Girone Unico': 'Girone Unico',
  };
  if (abbr[nome]) return abbr[nome];
  // Tronca se troppo lungo
  return nome.length > 14 ? nome.substring(0, 13) + '…' : nome;
}

async function selectCat(id) {
  STATE.activeCat = id;
  STATE.activeGiornata = 'tutte';
  STATE._giornateDisponibili = [];
  // Carica giornate disponibili per questa categoria
  await _caricaGiornate();
  renderCatBar();
  renderCurrentSection();
}

async function selectGiornata(g) {
  STATE.activeGiornata = g;
  _renderGiornataBar();
  renderCurrentSection();
}

async function _caricaGiornate() {
  try {
    const dateSet = new Set();
    // Legge da TUTTE le categorie del torneo
    for (const cat of STATE.categorie) {
      const gironi = await dbGetGironi(cat.id);
      for (const g of gironi) {
        const { data: partite } = await db.from('partite')
          .select('giorno').eq('girone_id', g.id).not('giorno', 'is', null);
        (partite || []).forEach(p => { if (p.giorno) dateSet.add(p.giorno); });
      }
    }
    const mesi = {'gennaio':1,'febbraio':2,'marzo':3,'aprile':4,'maggio':5,'giugno':6,
                  'luglio':7,'agosto':8,'settembre':9,'ottobre':10,'novembre':11,'dicembre':12};
    const parseData = s => {
      const parts = s.toLowerCase().split(' ').filter(Boolean);
      const giorno = parseInt(parts.find(p => /^\d+$/.test(p))) || 0;
      const meseEntry = Object.entries(mesi).find(([m]) => parts.some(p => p.includes(m)));
      return (meseEntry ? meseEntry[1] : 0) * 100 + giorno;
    };
    STATE._giornateDisponibili = [...dateSet].sort((a,b) => parseData(a) - parseData(b));

    // Auto-seleziona OGGI se disponibile, altrimenti 'tutte'
    const oggi = _trovaGiornataOggi(STATE._giornateDisponibili);
    STATE.activeGiornata = oggi || 'tutte';
  } catch(e) { STATE._giornateDisponibili = []; STATE.activeGiornata = 'tutte'; }
}

function logoHTML(sq, size = 'md') {
  const cls = size === 'sm' ? 'team-logo-sm' : 'team-logo';
  const avcls = size === 'sm' ? 'team-avatar-sm' : 'team-avatar';
  if (sq && sq.logo) return `<img src="${sq.logo}" class="${cls}" alt="${sq.nome}">`;
  const name = sq ? sq.nome : '?';
  const ini = name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();
  return `<div class="${avcls}">${ini}</div>`;
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

// ============================================================
//  CLASSIFICA
// ============================================================
function calcGironeClassifica(girone) {
  const map = {};
  for (const sq of girone.squadre) map[sq.id] = { sq, g:0, v:0, p:0, s:0, gf:0, gs:0, pts:0, rigori:0 };
  const giocate = girone.partite.filter(p => p.giocata);
  for (const p of giocate) {
    const h = map[p.home_id]; const a = map[p.away_id]; if (!h || !a) continue;
    h.g++; a.g++; h.gf += p.gol_home; h.gs += p.gol_away; a.gf += p.gol_away; a.gs += p.gol_home;
    if (p.gol_home > p.gol_away) { h.v++; h.pts+=3; a.s++; }
    else if (p.gol_home < p.gol_away) { a.v++; a.pts+=3; h.s++; }
    else { h.p++; h.pts++; a.p++; a.pts++; }
  }
  const lista = Object.values(map);
  lista.sort((a,b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const sd = _scontroDir2(a.sq.id, b.sq.id, giocate); if (sd !== 0) return sd;
    if ((b.gf-b.gs) !== (a.gf-a.gs)) return (b.gf-b.gs) - (a.gf-a.gs);
    if (b.gf !== a.gf) return b.gf - a.gf;
    return b.rigori - a.rigori;
  });
  return _risolviGruppi(lista, giocate);
}

function _scontroDir2(idA, idB, giocate) {
  let ptA=0,ptB=0,drA=0,drB=0,gfA=0,gfB=0;
  for (const p of giocate) {
    const ab = p.home_id===idA && p.away_id===idB;
    const ba = p.home_id===idB && p.away_id===idA;
    if (!ab && !ba) continue;
    const gh=p.gol_home, ga=p.gol_away;
    if (ab) { drA+=gh-ga; drB+=ga-gh; gfA+=gh; gfB+=ga; if(gh>ga)ptA+=3; else if(gh<ga)ptB+=3; else{ptA++;ptB++;} }
    else { drB+=gh-ga; drA+=ga-gh; gfB+=gh; gfA+=ga; if(gh>ga)ptB+=3; else if(gh<ga)ptA+=3; else{ptA++;ptB++;} }
  }
  if (ptB!==ptA) return ptB-ptA; if (drB!==drA) return drB-drA; if (gfB!==gfA) return gfB-gfA; return 0;
}

function _risolviGruppi(lista, giocate) {
  const out = []; let i=0;
  while (i < lista.length) {
    let j=i+1; while (j<lista.length && lista[j].pts===lista[i].pts) j++;
    const gruppo = lista.slice(i,j);
    if (gruppo.length<=1) { out.push(...gruppo); i=j; continue; }
    const idSet = new Set(gruppo.map(s=>s.sq.id));
    const pInt = giocate.filter(p=>idSet.has(p.home_id)&&idSet.has(p.away_id));
    const si = {}; gruppo.forEach(s=>{ si[s.sq.id]={pt:0,dr:0,gf:0}; });
    pInt.forEach(p=>{
      const h=si[p.home_id]; const a=si[p.away_id];
      h.dr+=p.gol_home-p.gol_away; a.dr+=p.gol_away-p.gol_home; h.gf+=p.gol_home; a.gf+=p.gol_away;
      if(p.gol_home>p.gol_away)h.pt+=3; else if(p.gol_home<p.gol_away)a.pt+=3; else{h.pt++;a.pt++;}
    });
    gruppo.sort((a,b)=>{
      const ia=si[a.sq.id],ib=si[b.sq.id];
      if(ib.pt!==ia.pt) return ib.pt-ia.pt; if(ib.dr!==ia.dr) return ib.dr-ia.dr;
      if(ib.gf!==ia.gf) return ib.gf-ia.gf;
      const drA=a.gf-a.gs,drB=b.gf-b.gs;
      if(drB!==drA) return drB-drA; if(b.gf!==a.gf) return b.gf-a.gf; return b.rigori-a.rigori;
    });
    out.push(...gruppo); i=j;
  }
  return out;
}

// ============================================================
//  RISOLUZIONE TRIANGOLARI
// ============================================================
async function verificaEGeneraTriangolari(categoriaId) {
  try {
    const { data: gironi } = await db.from('gironi').select('id,nome').eq('categoria_id', categoriaId);
    if (!gironi||!gironi.length) return;
    const classificheGironi = {};
    for (const g of gironi) {
      const { data: partite } = await db.from('partite').select('id,home_id,away_id,gol_home,gol_away,giocata').eq('girone_id', g.id);
      if (!partite||partite.length===0||partite.some(p=>!p.giocata)) return;
      const { data: gsRows } = await db.from('girone_squadre').select('squadra_id,squadre(id,nome,logo)').eq('girone_id', g.id);
      const squadre = (gsRows||[]).map(r=>({id:r.squadra_id,nome:r.squadre?.nome||'',logo:r.squadre?.logo||null}));
      classificheGironi[g.nome] = calcGironeClassifica({squadre,partite});
    }
    const { data: matches } = await db.from('knockout').select('id,note_home,note_away,home_id,away_id').eq('categoria_id', categoriaId);
    if (!matches||!matches.length) return;
    let risolti=0;
    for (const match of matches) {
      const newH=_resolvePlaceholder(match.note_home,classificheGironi);
      const newA=_resolvePlaceholder(match.note_away,classificheGironi);
      if ((newH&&newH!==match.home_id)||(newA&&newA!==match.away_id)) {
        const upd={}; if(newH)upd.home_id=newH; if(newA)upd.away_id=newA;
        await db.from('knockout').update(upd).eq('id',match.id); risolti++;
      }
    }
    if (risolti>0) { _mostraNotificaTriangolari(); if(STATE.currentSection==='a-knockout')await renderAdminKnockout(); if(STATE.currentSection==='tabellone')await renderTabellone(); }
  } catch(e) { console.error('verificaEGeneraTriangolari:',e); }
}

function _resolvePlaceholder(placeholder, classificheGironi) {
  if (!placeholder) return null;
  const m = placeholder.match(/(\d+)[°º]?\s*Girone\s+(.+)/i); if (!m) return null;
  const pos=parseInt(m[1]); const nome=`Girone ${m[2].trim()}`;
  const cl=classificheGironi[nome]; if (!cl||cl.length<pos) return null;
  return cl[pos-1]?.sq?.id||null;
}

function _mostraNotificaTriangolari() {
  const old=document.getElementById('notifica-triangolari'); if(old)old.remove();
  const div=document.createElement('div'); div.id='notifica-triangolari';
  div.innerHTML=`<div style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e8449;color:white;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:700;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.3);display:flex;align-items:center;gap:10px;max-width:90vw;">🏆 Gironi completati! Triangolari aggiornati.<button onclick="document.getElementById('notifica-triangolari').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:2px 8px;border-radius:6px;cursor:pointer;">✕</button></div>`;
  document.body.appendChild(div);
  setTimeout(()=>{ if(div.parentNode)div.remove(); },6000);
}

// ============================================================
//  HELPER: ordina partite per orario
// ============================================================
function _orarioToMinuti(orario) {
  if (!orario) return 9999;
  const clean = String(orario).replace(',', '.').trim();
  const parts = clean.split(/[:.]/);
  if (parts.length >= 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  const num = parseFloat(clean);
  if (!isNaN(num)) return Math.floor(num) * 60 + Math.round((num % 1) * 100);
  return 9999;
}

// ============================================================
//  RIEPILOGO TORNEO (tutte le giornate)
// ============================================================
function _riepilogoBanner(section) {
  if (!STATE._giornateDisponibili || STATE._giornateDisponibili.length <= 1) return '';
  const isRiepilogo = STATE.activeGiornata === 'tutte';
  if (isRiepilogo) return '';
  return `
    <button class="riepilogo-banner" onclick="selectGiornata('tutte')">
      <div class="riepilogo-banner-left">
        <div class="riepilogo-banner-icon">🏆</div>
        <div>
          <div class="riepilogo-banner-title">Riepilogo Torneo</div>
          <div class="riepilogo-banner-sub">Vedi classifica, risultati e tabellone di tutte le giornate</div>
        </div>
      </div>
      <div class="riepilogo-banner-arrow">→</div>
    </button>`;
}

// ============================================================
//  PUBLIC: CLASSIFICHE
// ============================================================
async function renderClassifiche() {
  const el = document.getElementById('sec-classifiche');
  if (!STATE.categorie.length) { el.innerHTML='<div class="empty-state">Nessuna categoria configurata.</div>'; return; }

  // Mostra TUTTE le categorie in cascata
  let html = _riepilogoBanner('classifiche');

  for (const cat of STATE.categorie) {
    const gironi = await getGironiWithData(cat.id);
    if (!gironi.length) continue;

    // Header categoria se ci sono più categorie
    if (STATE.categorie.length > 1) {
      const totPartite = gironi.reduce((s,g)=>s+g.partite.length,0);
      const totGiocate = gironi.reduce((s,g)=>s+g.partite.filter(p=>p.giocata).length,0);
      html += `<div style="background:linear-gradient(90deg,var(--blu) 0%,var(--blu-lt) 100%);
        color:white;border-radius:var(--radius);padding:9px 14px;margin:${html?'18px':'0'} 0 8px;
        font-size:13px;font-weight:700;letter-spacing:.03em;
        display:flex;align-items:center;justify-content:space-between;">
        <span>🏆 ${cat.nome}</span>
        <span style="font-size:11px;opacity:.7;">${totGiocate}/${totPartite} partite</span>
      </div>`;
    }

    for (const g of gironi) {
      const cl = calcGironeClassifica(g);
      const played = g.partite.filter(p=>p.giocata).length;
      html += `<div class="card" style="margin-bottom:8px;">
        <div class="card-title">${g.nome}<span class="badge badge-gray">${played}/${g.partite.length}</span></div>
        <table class="standings-table">
          <thead><tr><th></th><th colspan="2">Squadra</th><th>G</th><th>V</th><th>P</th><th>S</th><th>GD</th><th>Pt</th></tr></thead>
          <tbody>`;
      cl.forEach((row,idx) => {
        const q = idx < (cat.qualificate||1);
        const diff = row.gf - row.gs;
        html += `<tr class="${q?'qualifies':''}">
          <td><span class="${q?'q-dot':'nq-dot'}"></span></td>
          <td style="padding-right:4px;">${logoHTML(row.sq,'sm')}</td>
          <td>${row.sq.nome}</td>
          <td>${row.g}</td><td>${row.v}</td><td>${row.p}</td><td>${row.s}</td>
          <td class="${diff>0?'diff-pos':diff<0?'diff-neg':''}">${diff>0?'+':''}${diff}</td>
          <td class="pts-col">${row.pts}</td>
        </tr>`;
      });
      html += `</tbody></table>
        <div style="font-size:10px;color:var(--testo-xs);margin-top:6px;padding-top:6px;border-top:1px solid var(--bordo-lt);">
          Spareggio: punti → scontro diretto → diff. reti → gol fatti → rigori
        </div>
      </div>`;
    }
  }
  el.innerHTML = html || '<div class="empty-state">Nessun girone trovato.</div>';
}

// ============================================================
//  PUBLIC: RISULTATI — ordinati per orario, con chi ha inserito
// ============================================================
async function renderRisultati() {
  const el = document.getElementById('sec-risultati');
  if (!STATE.categorie.length) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }

  // Raccoglie partite da TUTTE le categorie
  let tuttePartite = [];
  for (const cat of STATE.categorie) {
    const gironi = await getGironiWithData(cat.id);
    for (const g of gironi) {
      for (const p of g.partite) {
        tuttePartite.push({ ...p, _girone: g.nome, _cat: cat.nome });
      }
    }
  }

  // Filtra per giornata se selezionata
  const filtroAttivo = STATE.activeGiornata && STATE.activeGiornata !== 'tutte';
  if (filtroAttivo) {
    tuttePartite = tuttePartite.filter(p => p.giorno === STATE.activeGiornata);
  }

  // Ordina per orario
  tuttePartite.sort((a, b) => _orarioToMinuti(a.orario) - _orarioToMinuti(b.orario));

  const giocate = tuttePartite.filter(p => p.giocata);
  const daFare  = tuttePartite.filter(p => !p.giocata);

  let html = '';

  // ── Header giornata in cima ──
  if (filtroAttivo) {
    html += `<div style="background:linear-gradient(90deg,var(--blu) 0%,var(--blu-lt) 100%);
      color:white;border-radius:var(--radius);padding:11px 16px;margin-bottom:14px;
      font-size:14px;font-weight:700;display:flex;align-items:center;gap:10px;">
      📅 ${STATE.activeGiornata}
      <span style="font-size:11px;opacity:.7;margin-left:auto;">${tuttePartite.length} partite</span>
    </div>`;
  } else {
    // Riepilogo: mostra giorni disponibili come chip cliccabili
    const giornate = STATE._giornateDisponibili || [];
    if (giornate.length > 1) {
      html += `<div style="background:white;border:1px solid var(--bordo);border-radius:var(--radius);
        padding:12px 14px;margin-bottom:14px;box-shadow:var(--shadow);">
        <div style="font-size:11px;font-weight:700;color:var(--testo-xs);text-transform:uppercase;
          letter-spacing:.07em;margin-bottom:10px;">📅 Filtra per giornata</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${giornate.map(g => {
            const oggi = _trovaGiornataOggi(giornate);
            const isOggi = g === oggi;
            return `<button onclick="selectGiornata('${g}')"
              style="padding:5px 12px;border-radius:20px;border:1.5px solid ${isOggi?'var(--arancio)':'var(--bordo)'};
              background:${isOggi?'var(--arancio-bg)':'white'};color:${isOggi?'var(--arancio)':'var(--testo-lt)'};
              font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">
              ${isOggi?'🔴 ':''}${_labelGiornata(g)}
            </button>`;
          }).join('')}
        </div>
      </div>`;
    }
  }

  // Funzione per renderizzare una partita
  const renderPartita = (p, showCat) => {
    const mH = (p.marcatori||[]).filter(m=>m.squadra_id===p.home_id);
    const mA = (p.marcatori||[]).filter(m=>m.squadra_id===p.away_id);
    let r = `<div class="match-result">
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:5px;">
        ${p.orario?`<span class="match-meta-time">🕐 ${p.orario}</span>`:''}
        ${p.campo?`<span class="match-meta-field">📍 ${p.campo}</span>`:''}
        <span class="match-meta-girone">${p._girone}</span>
        ${showCat && STATE.categorie.length > 1 ? `<span style="font-size:10px;color:var(--blu);background:var(--blu-bg);padding:1px 6px;border-radius:4px;">${p._cat}</span>` : ''}
        ${p.inserito_da?`<span class="match-meta-author">✏️ ${p.inserito_da}</span>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="match-team">${logoHTML(p.home,'sm')}<span>${p.home?.nome||'?'}</span></div>`;
    if (p.giocata) {
      r += `<div class="match-score">${p.gol_home} — ${p.gol_away}</div>`;
    } else {
      r += `<div class="match-score pending">vs</div>`;
    }
    r += `<div class="match-team right"><span>${p.away?.nome||'?'}</span>${logoHTML(p.away,'sm')}</div>
      </div>`;
    if (mH.length||mA.length) {
      r += `<div class="match-scorers">`;
      mH.forEach(m=>r+=`<span class="scorer-chip">⚽ ${m.nome}${m.minuto?' '+m.minuto+"'":''}  ${p.home?.nome||''}</span>`);
      mA.forEach(m=>r+=`<span class="scorer-chip">⚽ ${m.nome}${m.minuto?' '+m.minuto+"'":''}  ${p.away?.nome||''}</span>`);
      r += `</div>`;
    }
    r += `</div>`;
    return r;
  };

  // ── Risultati ──
  if (giocate.length) {
    html += `<div class="section-label">✅ Risultati <span style="color:var(--verde);font-weight:800;">(${giocate.length})</span></div>`;
    // Raggruppa per giorno se riepilogo
    if (!filtroAttivo) {
      const perGiorno = {};
      giocate.forEach(p => {
        const g = p.giorno || '—';
        if (!perGiorno[g]) perGiorno[g] = [];
        perGiorno[g].push(p);
      });
      for (const [giorno, partite] of Object.entries(perGiorno)) {
        html += `<div class="day-header">📅 ${giorno}</div>`;
        html += `<div class="card">`;
        partite.forEach(p => { html += renderPartita(p, true); });
        html += `</div>`;
      }
    } else {
      html += `<div class="card">`;
      giocate.forEach(p => { html += renderPartita(p, true); });
      html += `</div>`;
    }
  }

  // ── Programma ──
  if (daFare.length) {
    html += `<div class="section-label">🕐 Programma <span style="color:var(--testo-xs);font-weight:600;">(${daFare.length})</span></div>`;
    if (!filtroAttivo) {
      const perGiorno = {};
      daFare.forEach(p => {
        const g = p.giorno || '—';
        if (!perGiorno[g]) perGiorno[g] = [];
        perGiorno[g].push(p);
      });
      for (const [giorno, partite] of Object.entries(perGiorno)) {
        html += `<div class="day-header" style="background:var(--sfondo);color:var(--testo-lt);border:1px solid var(--bordo);">📅 ${giorno}</div>`;
        html += `<div class="card">`;
        partite.forEach(p => { html += renderPartita(p, true); });
        html += `</div>`;
      }
    } else {
      html += `<div class="card">`;
      daFare.forEach(p => { html += renderPartita(p, false); });
      html += `</div>`;
    }
  }

  el.innerHTML = html || '<div class="empty-state">Nessun risultato per questa giornata.</div>';
}

// ============================================================
//  PUBLIC: TABELLONE
// ============================================================
async function renderTabellone() {
  const el=document.getElementById('sec-tabellone');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }
  const ko=await dbGetKnockout(STATE.activeCat);
  const squadre=await dbGetSquadre(STATE.activeTorneo);
  const sqMap={}; squadre.forEach(s=>sqMap[s.id]=s);
  if (!ko.length) { el.innerHTML='<div class="empty-state">Tabellone non ancora generato.</div>'; return; }
  const ROUND_COLORS={'PLATINO':'#FFD700','GOLD':'#FFA500','SILVER':'#C0C0C0','BRONZO':'#CD7F32','WHITE':'#B0BEC5'};
  const renderRounds=(matches,label)=>{
    if (!matches.length) return '';
    const rounds={};
    matches.forEach(m=>{ if(!rounds[m.round_name])rounds[m.round_name]=[]; rounds[m.round_name].push(m); });
    let h=`<div class="section-label">${label}</div>`;
    for (const [rname,rmatch] of Object.entries(rounds)) {
      const rkey=Object.keys(ROUND_COLORS).find(k=>rname.toUpperCase().includes(k));
      const color=ROUND_COLORS[rkey]||'#E85C00';
      h+=`<div class="card" style="border-top:4px solid ${color};margin-bottom:12px;"><div class="card-title">${rname}</div>`;
      for (const m of rmatch) {
        const hm=m.home_id?sqMap[m.home_id]:null;
        const am=m.away_id?sqMap[m.away_id]:null;
        const hmNome=hm?hm.nome:(m.note_home||'In attesa...');
        const amNome=am?am.nome:(m.note_away||'In attesa...');
        const isPending=!hm||!am;
        const orario=m.orario||m.campo?`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          ${m.orario?`<span style="font-size:11px;font-weight:700;color:#E85C00;">🕐 ${m.orario}</span>`:''}
          ${m.campo?`<span style="font-size:11px;color:#888;">📍 ${m.campo}</span>`:''}
          ${m.inserito_da?`<span style="font-size:10px;color:#bbb;margin-left:auto;">✏️ ${m.inserito_da}</span>`:''}
        </div>`:'';
        h+=`<div class="match-result" style="border-bottom:1px solid #f0f0f0;padding-bottom:10px;margin-bottom:8px;">
          ${orario}
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div class="match-team ${isPending?'':''}"><span style="${isPending?'color:#bbb;font-style:italic;':''}">${isPending?'':logoHTML(hm,'sm')}${hmNome}</span></div>
            <div class="match-score ${!m.giocata?'pending':''}">${m.giocata?m.gol_home+' — '+m.gol_away:'vs'}</div>
            <div class="match-team right"><span style="${isPending?'color:#bbb;font-style:italic;':''}">${amNome}${isPending?'':logoHTML(am,'sm')}</span></div>
          </div>
        </div>`;
      }
      h+=`</div>`;
    }
    return h;
  };
  el.innerHTML=renderRounds(ko.filter(m=>!m.is_consolazione),'🏆 Tabellone')+renderRounds(ko.filter(m=>m.is_consolazione),'🥉 Consolazione');
}

// ============================================================
//  ADMIN: TORNEI
// ============================================================
async function renderAdminTornei() {
  const el=document.getElementById('sec-a-tornei'); STATE.tornei=await dbGetTornei();
  let html=`<div class="section-label">Tornei</div>`;
  if (!STATE.tornei.length) html+=`<div class="empty-state">Nessun torneo. Creane uno!</div>`;
  for (const t of STATE.tornei) {
    html+=`<div class="card"><div class="card-title">
      <div><div style="font-weight:600;">${t.nome}</div><div style="font-size:12px;color:#aaa;">${t.data||'Data non impostata'}</div></div>
      <div style="display:flex;gap:6px;align-items:center;">
        <span class="badge ${t.attivo?'badge-green':'badge-gray'}">${t.attivo?'Attivo':'Archiviato'}</span>
        <button class="btn btn-sm ${t.attivo?'':'btn-p'}" onclick="toggleTorneo(${t.id},${t.attivo})">${t.attivo?'Archivia':'Riattiva'}</button>
        <button class="btn btn-sm" onclick="editTorneo(${t.id})">Modifica</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTorneo(${t.id})">Elimina</button>
      </div></div></div>`;
  }
  html+=`<div class="section-label">Nuovo torneo</div>
  <div class="card">
    <div class="form-grid-2">
      <div class="form-group"><label class="form-label">Nome torneo</label><input class="form-input" id="new-t-nome" placeholder="Torneo 2026"></div>
      <div class="form-group"><label class="form-label">Data</label><input class="form-input" id="new-t-data" placeholder="Dom 22 Mar 2026"></div>
    </div>
    <button class="btn btn-p" onclick="createTorneo()">Crea torneo</button>
  </div>`;
  el.innerHTML=html;
}

async function createTorneo() {
  const nome=document.getElementById('new-t-nome').value.trim();
  const data=document.getElementById('new-t-data').value.trim();
  if (!nome) { alert('Inserisci il nome'); return; }
  const t=await dbSaveTorneo({nome,data,attivo:true});
  STATE.tornei=await dbGetTornei(); STATE.activeTorneo=t.id;
  await loadTorneo(); toast('Torneo creato!'); await renderAdminTornei();
}
async function toggleTorneo(id,attivo) { await dbUpdateTorneo(id,{attivo:!attivo}); STATE.tornei=await dbGetTornei(); await renderAdminTornei(); toast(attivo?'Torneo archiviato':'Torneo riattivato'); }
async function deleteTorneo(id) {
  if (!confirm('Eliminare questo torneo e tutti i dati?')) return;
  await dbDeleteTorneo(id); STATE.tornei=await dbGetTornei();
  STATE.activeTorneo=STATE.tornei.find(t=>t.attivo)?.id||STATE.tornei[0]?.id||null;
  await loadTorneo(); await renderAdminTornei(); toast('Torneo eliminato');
}
async function editTorneo(id) {
  const t=STATE.tornei.find(x=>x.id===id);
  const nome=prompt('Nome torneo:',t.nome); if (!nome) return;
  const data=prompt('Data:',t.data||'');
  await dbUpdateTorneo(id,{nome,data}); STATE.tornei=await dbGetTornei();
  updateHeader(); renderTorneoBar(); await renderAdminTornei(); toast('Torneo aggiornato');
}

// ============================================================
//  ADMIN: CATEGORIE
// ============================================================
async function renderAdminSetup() {
  const el=document.getElementById('sec-a-setup');
  if (!STATE.activeTorneo) { el.innerHTML='<div class="empty-state">Crea prima un torneo.</div>'; return; }
  const t=STATE.tornei.find(x=>x.id===STATE.activeTorneo);
  const tutteSquadre=await dbGetSquadre(STATE.activeTorneo);
  let html=`<div style="background:#fff3e0;border-radius:10px;padding:12px 16px;margin-bottom:14px;">
    <div style="font-size:13px;color:#bf360c;">Torneo attivo: <strong>${t?.nome||'?'}</strong></div>
  </div>`;
  if (tutteSquadre.length) {
    html+=`<div class="section-label">Squadre (${tutteSquadre.length})</div><div class="card" style="margin-bottom:14px;"><div style="display:flex;flex-wrap:wrap;gap:6px;">`;
    tutteSquadre.forEach(sq=>{ html+=`<span style="display:inline-flex;align-items:center;gap:5px;background:#fff3e0;border:1px solid #ffcc80;border-radius:99px;padding:3px 10px;font-size:12px;color:#E85C00;">${logoHTML(sq,'sm')} ${sq.nome}</span>`; });
    html+=`</div></div>`;
  }
  html+=`<div class="section-label">Categorie configurate</div>`;
  if (!STATE.categorie.length) html+=`<div style="color:#aaa;font-size:13px;padding:8px 0 12px;">Nessuna categoria. Importa da Excel o aggiungine una.</div>`;
  for (const cat of STATE.categorie) {
    const gironi=await dbGetGironi(cat.id); let totP=0,totG=0;
    for (const g of gironi) { const pp=await dbGetPartite(g.id); totP+=pp.length; totG+=pp.filter(p=>p.giocata).length; }
    html+=`<div class="card" style="margin-bottom:10px;">
      <div class="card-title" style="margin-bottom:10px;">
        <div style="font-size:15px;font-weight:600;">${cat.nome}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <span class="badge badge-gray">${totG}/${totP} partite</span>
          <button class="btn btn-danger btn-sm" onclick="deleteCat(${cat.id})">Elimina</button>
        </div>
      </div>`;
    for (const g of gironi) {
      const members=await dbGetGironeSquadre(g.id);
      html+=`<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">${g.nome}</div><div style="display:flex;flex-wrap:wrap;gap:4px;">`;
      members.forEach(m=>{ html+=`<span style="display:inline-flex;align-items:center;gap:4px;background:#f5f5f5;border-radius:99px;padding:2px 8px;font-size:12px;">${logoHTML(m.squadre,'sm')} ${m.squadre.nome}</span>`; });
      html+=`</div></div>`;
    }
    html+=`</div>`;
  }
  html+=`<div class="section-label">Importa da Excel</div>
  <div class="card">
    <div style="font-size:13px;color:#555;margin-bottom:8px;">Fogli richiesti: <strong>CATEGORIE · GIRONI · PARTITE_FASE1 · FASE_FINALE</strong></div>
    <label style="display:inline-flex;align-items:center;gap:8px;background:#E85C00;color:white;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
      📂 Seleziona file Excel
      <input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importaExcel(event)">
    </label>
    <div id="import-preview"></div>
  </div>
  <div class="section-label">Aggiungi categoria manualmente</div>
  <div class="card">
    <div class="form-grid-2">
      <div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="cname" placeholder="Under 10"></div>
      <div class="form-group"><label class="form-label">Si qualificano</label>
        <select class="form-input" id="cqualify"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Squadre per girone (una riga per girone, separate da virgola)</label>
      <textarea class="form-input" id="cteams" rows="4" placeholder="Girone A: Milan, Inter, Juve&#10;Girone B: Napoli, Lazio, Roma"></textarea></div>
    <button class="btn btn-p" style="width:100%;" onclick="addCategoria()">+ Aggiungi categoria</button>
  </div>`;
  el.innerHTML=html;
}

async function addCategoria() {
  const nome=document.getElementById('cname').value.trim();
  const qualificate=parseInt(document.getElementById('cqualify').value);
  const teamsText=document.getElementById('cteams').value.trim();
  if (!nome||!teamsText) { alert('Compila nome e squadre'); return; }
  const cat=await dbSaveCategoria({nome,qualificate,formato:'triangolare',ordine:STATE.categorie.length,torneo_id:STATE.activeTorneo});
  STATE.categorie=await dbGetCategorie(STATE.activeTorneo); if (!STATE.activeCat) STATE.activeCat=cat.id;
  const lines=teamsText.split('\n').map(l=>l.trim()).filter(Boolean);
  for (let gi=0;gi<lines.length;gi++) {
    let line=lines[gi]; if(line.includes(':'))line=line.split(':')[1];
    const teamNames=line.split(',').map(t=>t.trim()).filter(Boolean);
    const girone=await dbSaveGirone({categoria_id:cat.id,nome:'Girone '+String.fromCharCode(65+gi)});
    const squadra_ids=[];
    for (const tn of teamNames) {
      let sq=(await dbGetSquadre(STATE.activeTorneo)).find(s=>s.nome.toLowerCase()===tn.toLowerCase());
      if (!sq) sq=await dbSaveSquadra({nome:tn,torneo_id:STATE.activeTorneo});
      squadra_ids.push(sq.id);
    }
    await dbSetGironeSquadre(girone.id,squadra_ids); await dbGeneraPartite(girone.id,squadra_ids);
  }
  renderCatBar(); toast('Categoria aggiunta!'); await renderAdminSetup();
}

async function deleteCat(id) {
  if (!confirm('Eliminare questa categoria?')) return;
  await dbDeleteCategoria(id); STATE.categorie=await dbGetCategorie(STATE.activeTorneo);
  STATE.activeCat=STATE.categorie[0]?.id||null; renderCatBar(); await renderAdminSetup();
}

// ============================================================
//  ADMIN: LOGHI
// ============================================================
async function renderAdminLoghi() {
  const el=document.getElementById('sec-a-loghi');
  const squadre=await dbGetSquadre(STATE.activeTorneo);
  if (!squadre.length) { el.innerHTML='<div class="empty-state">Aggiungi prima le squadre.</div>'; return; }
  let html='<div class="section-label">Loghi squadre</div><div class="card">';
  html+=`<div style="font-size:13px;color:#666;margin-bottom:14px;">Clicca sul logo per caricare/cambiare l'immagine.</div>`;
  for (const sq of squadre) {
    html+=`<div class="logo-team-row">
      <div class="logo-upload-btn">${logoHTML(sq,'md')}
        <div class="logo-plus"><svg width="8" height="8" viewBox="0 0 8 8"><path d="M4 1v6M1 4h6" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <input type="file" accept="image/*" onchange="uploadLogo(event,${sq.id})">
      </div>
      <div style="flex:1;"><div style="font-size:14px;font-weight:600;">${sq.nome}</div>
        <div style="font-size:12px;color:#aaa;">${sq.logo?'✅ Logo caricato':'Nessun logo'}</div></div>
      ${sq.logo?`<button class="btn btn-danger btn-sm" onclick="removeLogo(${sq.id})">Rimuovi</button>`:''}
    </div>`;
  }
  html+='</div>'; el.innerHTML=html;
}
async function uploadLogo(event,squadra_id) {
  const file=event.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=async(e)=>{ await dbUpdateLogo(squadra_id,e.target.result); toast('Logo caricato!'); await renderAdminLoghi(); };
  reader.readAsDataURL(file);
}
async function removeLogo(squadra_id) { await dbUpdateLogo(squadra_id,null); toast('Logo rimosso'); await renderAdminLoghi(); }

// ============================================================
//  ADMIN: RISULTATI — ordinati per orario, con chi ha inserito
// ============================================================
let openScorers={};

async function renderAdminRisultati() {
  const el=document.getElementById('sec-a-risultati');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }
  const gironi=await getGironiWithData(STATE.activeCat);

  // Raccoglie tutte le partite e ordina per orario
  let tuttePartite = [];
  for (const g of gironi) {
    for (const p of g.partite) tuttePartite.push({ ...p, _girone: g.nome, _gironeId: g.id });
  }
  // Filtra per giornata se selezionata
  if (STATE.activeGiornata && STATE.activeGiornata !== 'tutte') {
    tuttePartite = tuttePartite.filter(p => p.giorno === STATE.activeGiornata);
  }
  tuttePartite.sort((a,b) => _orarioToMinuti(a.orario) - _orarioToMinuti(b.orario));

  let html='';
  for (const p of tuttePartite) {
    const key='p'+p.id; const open=!!openScorers[key];
    let badge='';
    if (p.giocata) {
      if(p.gol_home>p.gol_away)badge=`<span class="badge badge-green">${p.home?.nome} vince</span>`;
      else if(p.gol_home<p.gol_away)badge=`<span class="badge badge-green">${p.away?.nome} vince</span>`;
      else badge=`<span class="badge badge-blue">Pareggio</span>`;
    }
    const orInfo=`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
      ${p.orario?`<span style="font-size:11px;font-weight:700;color:#E85C00;">🕐 ${p.orario}</span>`:''}
      ${p.campo?`<span style="font-size:11px;color:#888;">📍 ${p.campo}</span>`:''}
      <span style="font-size:11px;color:#bbb;">${p._girone}</span>
      ${p.inserito_da?`<span style="font-size:10px;color:#888;margin-left:auto;">✏️ ${p.inserito_da}</span>`:''}
    </div>`;
    html+=`<div class="admin-match"><div class="admin-match-header">
      ${orInfo}
      <div style="display:flex;align-items:center;gap:6px;width:100%;flex-wrap:wrap;">
        <div class="admin-team-name">${logoHTML(p.home,'sm')}<span>${p.home?.nome||'?'}</span></div>
        <input class="score-input" type="number" min="0" max="30" value="${p.giocata?p.gol_home:''}" placeholder="—" id="sh_${p.id}">
        <span class="score-dash">—</span>
        <input class="score-input" type="number" min="0" max="30" value="${p.giocata?p.gol_away:''}" placeholder="—" id="sa_${p.id}">
        <div class="admin-team-name right"><span>${p.away?.nome||'?'}</span>${logoHTML(p.away,'sm')}</div>
        <div class="match-actions">
          <button class="btn btn-p btn-sm" onclick="saveRisultato(${p.id},${p._gironeId})">✓ Conferma</button>
          ${badge}
          ${p.giocata?`<button class="btn btn-accent btn-sm" onclick="toggleScorers('${key}')">${open?'Chiudi':'+ Marcatori'}</button>`:''}
        </div>
      </div>
    </div>`;
    if (open&&p.giocata) {
      const marcatori=p.marcatori||[];
      html+=`<div class="scorers-section"><div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Marcatori</div>`;
      marcatori.forEach((m,mi)=>{
        html+=`<div class="scorer-row">
          <select id="msq_${p.id}_${mi}">
            <option value="${p.home_id}" ${m.squadra_id===p.home_id?'selected':''}>${p.home?.nome}</option>
            <option value="${p.away_id}" ${m.squadra_id===p.away_id?'selected':''}>${p.away?.nome}</option>
          </select>
          <input placeholder="Nome giocatore" value="${m.nome||''}" id="mnm_${p.id}_${mi}">
          <input placeholder="Min" value="${m.minuto||''}" id="mmin_${p.id}_${mi}" class="min-input">
          <button class="btn btn-danger btn-sm" onclick="removeMarcatore(${p.id},${mi})">✕</button>
        </div>`;
      });
      html+=`<button class="add-scorer-btn" onclick="addMarcatore(${p.id})">+ Aggiungi marcatore</button>
        <div style="margin-top:10px;"><button class="btn btn-success btn-sm" onclick="saveMarcatori(${p.id},${p._gironeId})">Salva marcatori</button></div></div>`;
    }
    html+='</div>';
  }
  el.innerHTML=html||'<div class="empty-state">Nessuna partita.</div>';
}

async function saveRisultato(partita_id, girone_id) {
  const sh=document.getElementById('sh_'+partita_id).value;
  const sa=document.getElementById('sa_'+partita_id).value;
  if (sh===''||sa==='') { toast('Inserisci entrambi i gol'); return; }
  try {
    const result=await dbSavePartita({
      id: partita_id, girone_id,
      gol_home: parseInt(sh), gol_away: parseInt(sa),
      giocata: true,
      inserito_da: STATE.userName || null
    });
    if (result) {
      toast('✓ Salvato!'); await renderAdminRisultati();
      const {data:gironeRow}=await db.from('gironi').select('categoria_id').eq('id',girone_id).single();
      if (gironeRow?.categoria_id) await verificaEGeneraTriangolari(gironeRow.categoria_id);
    } else { toast('Errore nel salvataggio'); }
  } catch(e) { console.error(e); toast('Errore: '+(e.message||'sconosciuto')); }
}

function toggleScorers(key) { openScorers[key]=!openScorers[key]; renderAdminRisultati(); }
let tempMarcatori={};
function addMarcatore(pid) { if(!tempMarcatori[pid])tempMarcatori[pid]=[]; tempMarcatori[pid].push({}); renderAdminRisultati(); }
function removeMarcatore(pid,idx) { if(!tempMarcatori[pid])tempMarcatori[pid]=[]; tempMarcatori[pid].splice(idx,1); renderAdminRisultati(); }

async function saveMarcatori(partita_id, girone_id) {
  const gironi=await getGironiWithData(STATE.activeCat);
  let partita=null;
  for (const g of gironi) { for (const p of g.partite) { if(p.id===partita_id)partita=p; } }
  if (!partita) return;
  const all=[];
  for (let i=0;i<(partita.marcatori||[]).length;i++) {
    const sqEl=document.getElementById(`msq_${partita_id}_${i}`);
    const nmEl=document.getElementById(`mnm_${partita_id}_${i}`);
    const mnEl=document.getElementById(`mmin_${partita_id}_${i}`);
    if (sqEl&&nmEl&&nmEl.value.trim()) all.push({squadra_id:parseInt(sqEl.value),nome:nmEl.value.trim(),minuto:mnEl?mnEl.value||null:null});
  }
  await dbSaveMarcatori(partita_id,all.filter(m=>m.nome));
  delete tempMarcatori[partita_id]; openScorers['p'+partita_id]=false;
  toast('Marcatori salvati'); await renderAdminRisultati();
}

// ============================================================
//  ADMIN: KNOCKOUT
// ============================================================
async function renderAdminKnockout() {
  const el=document.getElementById('sec-a-knockout');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }
  const ko=await dbGetKnockout(STATE.activeCat);
  const squadre=await dbGetSquadre(STATE.activeTorneo);
  const sqMap={}; squadre.forEach(s=>sqMap[s.id]=s);
  const pending=ko.filter(k=>(!k.home_id||!k.away_id)&&(k.note_home||k.note_away));
  let html='';
  if (pending.length) {
    html+=`<div class="card" style="border-left:4px solid #e67e22;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:700;color:#e67e22;">⏳ ${pending.length} accoppiamenti in attesa dei gironi</div>
      <button class="btn btn-p btn-sm" style="margin-top:10px;" onclick="risolviManuale()">🔄 Risolvi ora</button>
    </div>`;
  }
  if (!ko.length) { el.innerHTML=html+'<div class="empty-state">Nessuna partita. Importa un Excel con FASE_FINALE.</div>'; return; }
  const rounds={}; ko.forEach(m=>{ if(!rounds[m.round_name])rounds[m.round_name]=[]; rounds[m.round_name].push(m); });
  const ROUND_COLORS={'PLATINO':'#FFD700','GOLD':'#FFA500','SILVER':'#C0C0C0','BRONZO':'#CD7F32','WHITE':'#B0BEC5'};
  for (const [rname,rmatch] of Object.entries(rounds)) {
    const rkey=Object.keys(ROUND_COLORS).find(k=>rname.toUpperCase().includes(k));
    const color=ROUND_COLORS[rkey]||'#E85C00';
    const done=rmatch.filter(m=>m.giocata).length;
    html+=`<div class="card" style="border-top:4px solid ${color};margin-bottom:14px;">
      <div class="card-title">${rname}<span class="badge badge-gray">${done}/${rmatch.length} giocate</span></div>`;
    for (const m of rmatch) {
      const hm=m.home_id?sqMap[m.home_id]:null; const am=m.away_id?sqMap[m.away_id]:null;
      const hmNome=hm?hm.nome:`<em style="color:#e67e22;">${m.note_home||'?'}</em>`;
      const amNome=am?am.nome:`<em style="color:#e67e22;">${m.note_away||'?'}</em>`;
      const risolto=!!(hm&&am);
      let badge='';
      if (m.giocata) {
        if(m.gol_home>m.gol_away)badge=`<span class="badge badge-green">${hm?.nome} vince</span>`;
        else if(m.gol_home<m.gol_away)badge=`<span class="badge badge-green">${am?.nome} vince</span>`;
        else badge=`<span class="badge badge-blue">Pareggio</span>`;
      }
      const orInfo=`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
        ${m.orario?`<span style="font-size:11px;font-weight:700;color:#E85C00;">🕐 ${m.orario}</span>`:''}
        ${m.campo?`<span style="font-size:11px;color:#888;">📍 ${m.campo}</span>`:''}
        ${m.inserito_da?`<span style="font-size:10px;color:#888;margin-left:auto;">✏️ ${m.inserito_da}</span>`:''}
      </div>`;
      html+=`<div class="admin-match"><div class="admin-match-header">
        ${orInfo}
        <div style="display:flex;align-items:center;gap:6px;width:100%;flex-wrap:wrap;">
          <div class="admin-team-name">${logoHTML(hm,'sm')}<span>${hmNome}</span></div>
          <input class="score-input" type="number" min="0" value="${m.giocata?m.gol_home:''}" placeholder="—" id="ksh_${m.id}" ${!risolto?'disabled':''}>
          <span class="score-dash">—</span>
          <input class="score-input" type="number" min="0" value="${m.giocata?m.gol_away:''}" placeholder="—" id="ksa_${m.id}" ${!risolto?'disabled':''}>
          <div class="admin-team-name right"><span>${amNome}</span>${logoHTML(am,'sm')}</div>
          <div class="match-actions">
            ${risolto?`<button class="btn btn-p btn-sm" onclick="saveKO(${m.id})">✓ Conferma</button>`:''}
            ${badge}
            ${!risolto?`<span style="font-size:11px;color:#e67e22;">⏳ In attesa gironi</span>`:''}
          </div>
        </div>
      </div></div>`;
    }
    html+=`</div>`;
  }
  el.innerHTML=html;
}

async function saveKO(match_id) {
  const sh=document.getElementById('ksh_'+match_id).value;
  const sa=document.getElementById('ksa_'+match_id).value;
  if (sh===''||sa==='') { toast('Inserisci i gol'); return; }
  const ko=await dbGetKnockout(STATE.activeCat);
  const m=ko.find(x=>x.id===match_id); if(!m)return;
  await dbSaveKnockoutMatch({...m, gol_home:parseInt(sh), gol_away:parseInt(sa), giocata:true, inserito_da: STATE.userName||null});
  toast('✓ Risultato salvato'); await renderAdminKnockout();
}

async function risolviManuale() {
  if (!STATE.activeCat) return;
  const {data:gironi}=await db.from('gironi').select('id,nome').eq('categoria_id',STATE.activeCat);
  if (!gironi||!gironi.length) { toast('Nessun girone trovato'); return; }
  const classificheGironi={};
  for (const g of gironi) {
    const {data:partite}=await db.from('partite').select('id,home_id,away_id,gol_home,gol_away,giocata').eq('girone_id',g.id);
    const {data:gsRows}=await db.from('girone_squadre').select('squadra_id,squadre(id,nome,logo)').eq('girone_id',g.id);
    const squadre=(gsRows||[]).map(r=>({id:r.squadra_id,nome:r.squadre?.nome||'',logo:r.squadre?.logo||null}));
    classificheGironi[g.nome]=calcGironeClassifica({squadre,partite:partite||[]});
  }
  const {data:matches}=await db.from('knockout').select('id,note_home,note_away,home_id,away_id').eq('categoria_id',STATE.activeCat);
  let risolti=0;
  for (const match of (matches||[])) {
    const newH=_resolvePlaceholder(match.note_home,classificheGironi);
    const newA=_resolvePlaceholder(match.note_away,classificheGironi);
    if ((newH&&newH!==match.home_id)||(newA&&newA!==match.away_id)) {
      const upd={}; if(newH)upd.home_id=newH; if(newA)upd.away_id=newA;
      await db.from('knockout').update(upd).eq('id',match.id); risolti++;
    }
  }
  if (risolti>0) { _mostraNotificaTriangolari(); await renderAdminKnockout(); }
  else toast('ℹ️ Nessun accoppiamento da aggiornare');
}

// ============================================================
//  AUTH
// ============================================================
function toggleAdmin() {
  if (STATE.isAdmin) { exitAdmin(); return; }
  const modal=document.getElementById('admin-modal'); if (!modal) return;
  modal.style.display='flex';
  const userEl=document.getElementById('admin-user'); const pwEl=document.getElementById('admin-pw'); const errEl=document.getElementById('pw-error');
  if (errEl) errEl.textContent='';
  const saved=_loadSavedLogin();
  if (saved) { if(userEl)userEl.value=saved.username||''; if(pwEl)pwEl.value=saved.password||''; }
  else { if(userEl)userEl.value=''; if(pwEl)pwEl.value=''; }
  setTimeout(()=>{ if(userEl&&userEl.value){if(pwEl)pwEl.focus();}else if(userEl)userEl.focus(); },100);
}

function checkPw() {
  const userEl=document.getElementById('admin-user'); const pwEl=document.getElementById('admin-pw'); const errEl=document.getElementById('pw-error');
  if (!userEl||!pwEl) { if(errEl)errEl.textContent='Errore tecnico'; return; }
  const username=userEl.value.trim().toLowerCase(); const password=pwEl.value;
  if (!username||!password) { if(errEl)errEl.textContent='Inserisci username e password'; return; }
  const user=(CONFIG.USERS||[]).find(u=>u.username.toLowerCase()===username&&u.password===password);
  if (!user) { if(errEl)errEl.textContent='Username o password errati'; pwEl.select(); return; }
  _saveLogin(username,password);
  document.getElementById('admin-modal').style.display='none';
  pwEl.value=''; userEl.value=''; if (errEl) errEl.textContent='';
  enterAdmin(user);
}

function enterAdmin(user) {
  STATE.isAdmin=true; STATE.userRole=user.ruolo; STATE.userName=user.nome;
  document.getElementById('pub-nav').style.display='none';
  document.getElementById('admin-nav').style.display='flex';
  document.getElementById('admin-btn').textContent=`Esci (${user.nome})`;
  if (user.ruolo==='arbitro') {
    _mostraNavArbitro(); STATE.currentSection='a-risultati';
    document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
    document.getElementById('sec-a-risultati').classList.add('active');
    document.getElementById('cat-bar').style.display=''; renderCatBar(); renderAdminRisultati();
  } else {
    document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b=>b.classList.remove('active'));
    const btn=document.querySelector('[data-section="a-tornei"]'); if(btn)btn.classList.add('active');
    document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
    document.getElementById('sec-a-tornei').classList.add('active');
    document.getElementById('cat-bar').style.display='none'; STATE.currentSection='a-tornei'; renderAdminTornei();
  }
}

function _mostraNavArbitro() {
  const nav=document.getElementById('admin-nav'); if(!nav)return;
  nav.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(btn=>{
    const sec=btn.getAttribute('data-section');
    btn.style.display=['a-risultati','a-knockout'].includes(sec)?'':'none';
  });
  nav.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b=>b.classList.remove('active'));
  const btnRis=nav.querySelector('[data-section="a-risultati"]');
  if (btnRis) { btnRis.style.display=''; btnRis.classList.add('active'); }
}

function exitAdmin() {
  STATE.isAdmin=false; STATE.userRole=null; STATE.userName=null;
  document.getElementById('admin-nav').querySelectorAll('.nav-btn').forEach(b=>b.style.display='');
  document.getElementById('pub-nav').style.display='flex';
  document.getElementById('admin-nav').style.display='none';
  document.getElementById('admin-btn').textContent='Admin';
  STATE.currentSection='classifiche';
  document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b=>b.classList.remove('active'));
  const btn=document.querySelector('[data-section="classifiche"]'); if(btn)btn.classList.add('active');
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  document.getElementById('sec-classifiche').classList.add('active'); renderClassifiche();
}

function _saveLogin(u,p) { try { localStorage.setItem('spe_login',JSON.stringify({username:u,password:p})); } catch(e){} }
function _loadSavedLogin() { try { const v=localStorage.getItem('spe_login'); return v?JSON.parse(v):null; } catch(e){return null;} }
function _clearLogin() { try { localStorage.removeItem('spe_login'); } catch(e){} }

function tryAutoLogin() {
  const saved=_loadSavedLogin(); if(!saved)return;
  const user=(CONFIG.USERS||[]).find(u=>u.username.toLowerCase()===saved.username.toLowerCase()&&u.password===saved.password);
  if (user) enterAdmin(user);
}

function toast(msg) {
  let t=document.getElementById('toast');
  if (!t) { t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.style.display='block';
  clearTimeout(t._timer); t._timer=setTimeout(()=>t.style.display='none',2500);
}

function loadScript(src) {
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
  });
}

window.addEventListener('DOMContentLoaded', init);

// ============================================================
//  TV MODE — scorre tutte le categorie, filtra per oggi
// ============================================================
let _tvState = {
  active: false,
  section: 'classifiche', // classifiche | risultati
  catIndex: 0,
  scrollTimer: null,
  catTimer: null,
  clockTimer: null,
};

function openTV() {
  const tv = document.getElementById('tv-mode');
  if (!tv) return;
  _tvState.active = true;
  _tvState.catIndex = 0;
  tv.classList.add('active');
  _tvRenderCatBar();
  _tvShowCat(0);
  _tvStartClock();
  _tvStartAutoscroll();
}

function closeTV() {
  _tvState.active = false;
  const tv = document.getElementById('tv-mode');
  if (tv) tv.classList.remove('active');
  clearInterval(_tvState.scrollTimer);
  clearInterval(_tvState.catTimer);
  clearInterval(_tvState.clockTimer);
  // Reset scroll progress
  const prog = document.getElementById('tv-scroll-progress');
  if (prog) prog.style.width = '0%';
}

function _tvCategorieFiltrate() {
  // Usa tutte le categorie disponibili
  return STATE.categorie;
}

function _tvRenderCatBar() {
  const bar = document.getElementById('tv-cat-bar');
  if (!bar) return;
  const cats = _tvCategorieFiltrate();
  bar.innerHTML = cats.map((c, i) =>
    `<button class="tv-cat-btn ${i === _tvState.catIndex ? 'active' : ''}"
      onclick="_tvShowCat(${i})">${_abbreviaNomeCat(c.nome)}</button>`
  ).join('');
}

async function _tvShowCat(idx) {
  _tvState.catIndex = idx;
  _tvRenderCatBar();

  const cats = _tvCategorieFiltrate();
  if (!cats[idx]) return;
  const cat = cats[idx];

  // Carica dati con filtro giorno
  const oggi = _tvGetOggi();
  const content = document.getElementById('tv-content');
  if (!content) return;
  content.innerHTML = '<div style="color:rgba(255,255,255,0.3);padding:40px;text-align:center;">Caricamento...</div>';

  try {
    if (_tvState.section === 'classifiche') {
      await _tvRenderClassifiche(cat, oggi, content);
    } else {
      await _tvRenderRisultati(cat, oggi, content);
    }
    content.scrollTop = 0;
  } catch(e) { console.error(e); }
}

function _tvGetOggi() {
  // Restituisce la giornata di oggi se disponibile
  const giornate = STATE._giornateDisponibili || [];
  return _trovaGiornataOggi(giornate);
}

async function _tvRenderClassifiche(cat, oggi, container) {
  const gironi = await getGironiWithData(cat.id);
  let html = '';

  if (oggi) {
    html += `<div style="background:rgba(234,88,12,0.15);border:1px solid rgba(234,88,12,0.3);border-radius:10px;
      padding:8px 16px;margin-bottom:20px;font-size:13px;color:#fb923c;font-weight:600;letter-spacing:.04em;">
      📅 ${oggi} — Classifica in tempo reale
    </div>`;
  }

  html += '<div class="tv-gironi-grid">';
  for (const g of gironi) {
    const cl = calcGironeClassifica(g);
    html += `<div class="tv-girone-card">
      <div class="tv-girone-title">${g.nome}
        <span style="font-size:11px;font-weight:600;opacity:.5;margin-left:auto;">${g.partite.filter(p=>p.giocata).length}/${g.partite.length}</span>
      </div>
      <table class="tv-standings-table">
        <thead><tr><th></th><th colspan="2">Squadra</th><th>G</th><th>Pt</th></tr></thead>
        <tbody>`;
    cl.forEach((row, idx) => {
      const q = idx < (cat.qualificate || 1);
      const diff = row.gf - row.gs;
      html += `<tr class="${q ? 'qualifies' : ''}">
        <td><span class="${q ? 'q-dot' : 'nq-dot'}"></span></td>
        <td>${logoHTML(row.sq, 'sm')}</td>
        <td>${row.sq.nome}</td>
        <td style="color:rgba(255,255,255,0.5)">${row.g}</td>
        <td class="tv-pts">${row.pts}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

async function _tvRenderRisultati(cat, oggi, container) {
  const gironi = await getGironiWithData(cat.id);
  let tuttePartite = [];
  for (const g of gironi) {
    for (const p of g.partite) tuttePartite.push({ ...p, _girone: g.nome });
  }

  // Filtra per oggi se disponibile
  if (oggi) {
    const filtrateOggi = tuttePartite.filter(p => p.giorno === oggi);
    if (filtrateOggi.length) tuttePartite = filtrateOggi;
  }

  tuttePartite.sort((a, b) => _orarioToMinuti(a.orario) - _orarioToMinuti(b.orario));

  const giocate = tuttePartite.filter(p => p.giocata);
  const daFare  = tuttePartite.filter(p => !p.giocata);

  let html = '';
  if (oggi) {
    html += `<div style="background:rgba(234,88,12,0.15);border:1px solid rgba(234,88,12,0.3);border-radius:10px;
      padding:8px 16px;margin-bottom:20px;font-size:13px;color:#fb923c;font-weight:600;">
      📅 ${oggi}
    </div>`;
  }

  if (giocate.length) {
    html += `<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.35);text-transform:uppercase;
      letter-spacing:.08em;margin-bottom:12px;">✅ Risultati</div>
      <div class="tv-results-grid">`;
    for (const p of giocate) {
      const hm = p.home; const am = p.away;
      html += `<div class="tv-match-card">
        <div class="tv-match-header">
          ${p.orario ? `🕐 ${p.orario}` : ''}
          ${p.campo ? ` · ${p.campo}` : ''}
          <span style="margin-left:auto">${p._girone}</span>
        </div>
        <div class="tv-match-body">
          <div class="tv-match-team">
            ${hm?.logo ? `<img src="${hm.logo}" class="tv-team-logo-lg">` : `<div class="tv-team-avatar-lg">${(hm?.nome||'?').substring(0,2).toUpperCase()}</div>`}
            <div class="tv-team-name">${hm?.nome||'?'}</div>
          </div>
          <div class="tv-score-box">
            <span class="tv-score">${p.gol_home}</span>
            <span class="tv-score-sep">—</span>
            <span class="tv-score">${p.gol_away}</span>
          </div>
          <div class="tv-match-team">
            ${am?.logo ? `<img src="${am.logo}" class="tv-team-logo-lg">` : `<div class="tv-team-avatar-lg">${(am?.nome||'?').substring(0,2).toUpperCase()}</div>`}
            <div class="tv-team-name">${am?.nome||'?'}</div>
          </div>
        </div>
      </div>`;
    }
    html += '</div>';
  }

  if (daFare.length) {
    html += `<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.35);text-transform:uppercase;
      letter-spacing:.08em;margin:20px 0 12px;">🕐 Programma</div>
      <div class="tv-results-grid">`;
    for (const p of daFare) {
      const hm = p.home; const am = p.away;
      html += `<div class="tv-match-card">
        <div class="tv-match-header">
          ${p.orario ? `🕐 ${p.orario}` : '—'}
          ${p.campo ? ` · ${p.campo}` : ''}
          <span style="margin-left:auto">${p._girone}</span>
        </div>
        <div class="tv-match-body">
          <div class="tv-match-team">
            ${hm?.logo ? `<img src="${hm.logo}" class="tv-team-logo-lg">` : `<div class="tv-team-avatar-lg">${(hm?.nome||'?').substring(0,2).toUpperCase()}</div>`}
            <div class="tv-team-name">${hm?.nome||'?'}</div>
          </div>
          <div class="tv-score-box">
            <span class="tv-score-pending">vs</span>
          </div>
          <div class="tv-match-team">
            ${am?.logo ? `<img src="${am.logo}" class="tv-team-logo-lg">` : `<div class="tv-team-avatar-lg">${(am?.nome||'?').substring(0,2).toUpperCase()}</div>`}
            <div class="tv-team-name">${am?.nome||'?'}</div>
          </div>
        </div>
      </div>`;
    }
    html += '</div>';
  }

  if (!giocate.length && !daFare.length) {
    html += '<div style="color:rgba(255,255,255,0.3);text-align:center;padding:60px;">Nessuna partita</div>';
  }
  container.innerHTML = html;
}

function _tvSwitchSection(section, btn) {
  _tvState.section = section;
  document.querySelectorAll('.tv-nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _tvShowCat(_tvState.catIndex);
}

function _tvStartClock() {
  const update = () => {
    const now = new Date();
    const el = document.getElementById('tv-clock');
    if (el) el.textContent = now.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' });
    const del = document.getElementById('tv-date-str');
    if (del) del.textContent = now.toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' });
  };
  update();
  _tvState.clockTimer = setInterval(update, 1000);
}

function _tvStartAutoscroll() {
  const SCROLL_INTERVAL = 30000; // 30s per categoria
  let elapsed = 0;
  const TICK = 200;

  clearInterval(_tvState.scrollTimer);
  _tvState.scrollTimer = setInterval(() => {
    elapsed += TICK;
    const pct = (elapsed / SCROLL_INTERVAL) * 100;
    const prog = document.getElementById('tv-scroll-progress');
    if (prog) prog.style.width = Math.min(pct, 100) + '%';

    // Scrolla il contenuto
    const content = document.getElementById('tv-content');
    if (content) {
      content.scrollTop += 2;
      // Se arrivato in fondo, passa alla categoria successiva
      if (content.scrollTop + content.clientHeight >= content.scrollHeight - 10) {
        elapsed = SCROLL_INTERVAL; // forza cambio
      }
    }

    if (elapsed >= SCROLL_INTERVAL) {
      elapsed = 0;
      if (prog) prog.style.width = '0%';
      const cats = _tvCategorieFiltrate();
      const nextIdx = (_tvState.catIndex + 1) % cats.length;
      _tvShowCat(nextIdx);
    }
  }, TICK);
}
