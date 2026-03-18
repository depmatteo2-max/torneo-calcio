// ============================================================
//  SOCCER PRO EXPERIENCE - Multi-torneo
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
  } catch(e) { console.error(e); }
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
}

async function loadTorneo() {
  if (!STATE.activeTorneo) { renderTorneoBar(); renderCatBar(); renderCurrentSection(); return; }
  STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
  STATE.activeCat = STATE.categorie.length ? STATE.categorie[0].id : null;
  renderTorneoBar();
  renderCatBar();
  await renderCurrentSection();
}

// ===== TORNEO BAR =====
function renderTorneoBar() {
  const bar = document.getElementById('torneo-bar');
  const attivi = STATE.tornei.filter(t => t.attivo);
  if (attivi.length <= 1) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  bar.innerHTML = `<div class="torneo-bar-inner">${attivi.map(t =>
    `<button class="torneo-pill ${t.id === STATE.activeTorneo ? 'active' : ''}" onclick="selectTorneo(${t.id})">${t.nome}</button>`
  ).join('')}</div>`;
}

async function selectTorneo(id) {
  STATE.activeTorneo = id;
  await loadTorneo();
}

// ===== HEADER =====
function updateHeader() {
  const t = STATE.tornei.find(t => t.id === STATE.activeTorneo);
  document.getElementById('header-title').textContent = t ? t.nome : 'Soccer Pro Experience';
  document.getElementById('header-date').textContent = t ? t.data || '' : '';
}

// ===== NAVIGATION =====
function showSection(name, btn) {
  STATE.currentSection = name;
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
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

// ===== CATEGORY BAR =====
function renderCatBar() {
  const bar = document.getElementById('cat-bar');
  if (!STATE.categorie.length) { bar.innerHTML = ''; return; }
  bar.innerHTML = `<div class="cat-bar-inner">${STATE.categorie.map(c =>
    `<button class="cat-pill ${c.id === STATE.activeCat ? 'active' : ''}" onclick="selectCat(${c.id})">${c.nome}</button>`
  ).join('')}</div>`;
}

async function selectCat(id) {
  STATE.activeCat = id;
  renderCatBar();
  renderCurrentSection();
}

// ===== HELPERS =====
function logoHTML(sq, size='md') {
  const cls = size==='sm' ? 'team-logo-sm' : 'team-logo';
  const avcls = size==='sm' ? 'team-avatar-sm' : 'team-avatar';
  if (sq && sq.logo) return `<img src="${sq.logo}" class="${cls}" alt="${sq.nome}">`;
  const name = sq ? sq.nome : '?';
  const ini = name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
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

function getScontroDisretto(girone, idA, idB) {
  let ptsA=0, ptsB=0, gfA=0, gfB=0;
  for (const p of girone.partite) {
    if (!p.giocata) continue;
    if (p.home_id===idA && p.away_id===idB) {
      gfA+=p.gol_home; gfB+=p.gol_away;
      if(p.gol_home>p.gol_away) ptsA+=3; else if(p.gol_home<p.gol_away) ptsB+=3; else{ptsA++;ptsB++;}
    } else if (p.home_id===idB && p.away_id===idA) {
      gfB+=p.gol_home; gfA+=p.gol_away;
      if(p.gol_home>p.gol_away) ptsB+=3; else if(p.gol_home<p.gol_away) ptsA+=3; else{ptsA++;ptsB++;}
    }
  }
  if(ptsB!==ptsA) return ptsB-ptsA;
  return (gfA-gfB)-(gfB-gfA);
}

function calcGironeClassifica(girone) {
  const map = {};
  for (const sq of girone.squadre) map[sq.id]={sq,g:0,v:0,p:0,s:0,gf:0,gs:0,pts:0};
  for (const p of girone.partite) {
    if (!p.giocata) continue;
    const h=map[p.home_id], a=map[p.away_id];
    if(!h||!a) continue;
    h.g++;a.g++;h.gf+=p.gol_home;h.gs+=p.gol_away;a.gf+=p.gol_away;a.gs+=p.gol_home;
    if(p.gol_home>p.gol_away){h.v++;h.pts+=3;a.s++;}
    else if(p.gol_home<p.gol_away){a.v++;a.pts+=3;h.s++;}
    else{h.p++;h.pts++;a.p++;a.pts++;}
  }
  return Object.values(map).sort((a,b)=>{
    if(b.pts!==a.pts) return b.pts-a.pts;
    const sd=getScontroDisretto(girone,a.sq.id,b.sq.id);
    if(sd!==0) return sd;
    const da=a.gf-a.gs, db=b.gf-b.gs;
    if(db!==da) return db-da;
    return b.gf-a.gf;
  });
}

// ===== PUBLIC: CLASSIFICHE =====
async function renderClassifiche() {
  const el = document.getElementById('sec-classifiche');
  if (!STATE.activeCat) { el.innerHTML = '<div class="empty-state">Nessuna categoria configurata.</div>'; return; }
  const cat = STATE.categorie.find(c=>c.id===STATE.activeCat);
  const gironi = await getGironiWithData(STATE.activeCat);
  if (!gironi.length) { el.innerHTML = '<div class="empty-state">Nessun girone trovato.</div>'; return; }
  let html = '';
  for (const g of gironi) {
    const cl = calcGironeClassifica(g);
    const played = g.partite.filter(p=>p.giocata).length;
    html += `<div class="card"><div class="card-title">${g.nome} <span class="badge badge-gray">${played}/${g.partite.length} partite</span></div>
      <table class="standings-table"><thead><tr><th></th><th colspan="2">Squadra</th><th>G</th><th>V</th><th>P</th><th>S</th><th>GD</th><th>Pt</th></tr></thead><tbody>`;
    cl.forEach((row,idx)=>{
      const q=idx<(cat.qualificate||2);
      const diff=row.gf-row.gs;
      html+=`<tr class="${q?'qualifies':''}">
        <td><span class="${q?'q-dot':'nq-dot'}"></span></td>
        <td style="padding-right:4px;">${logoHTML(row.sq,'sm')}</td>
        <td>${row.sq.nome}</td><td>${row.g}</td><td>${row.v}</td><td>${row.p}</td><td>${row.s}</td>
        <td class="${diff>0?'diff-pos':diff<0?'diff-neg':''}">${diff>0?'+':''}${diff}</td>
        <td class="pts-col">${row.pts}</td></tr>`;
    });
    html+=`</tbody></table><div style="font-size:11px;color:#aaa;margin-top:8px;padding-top:8px;border-top:1px solid #f5f5f5;">Spareggio: punti → scontro diretto → diff. reti → gol fatti</div></div>`;
  }
  el.innerHTML = html;
}

// ===== PUBLIC: RISULTATI =====
async function renderRisultati() {
  const el = document.getElementById('sec-risultati');
  if (!STATE.activeCat) { el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>'; return; }
  const gironi = await getGironiWithData(STATE.activeCat);
  let html = '';
  for (const g of gironi) {
    const giocate = g.partite.filter(p=>p.giocata);
    const dafar = g.partite.filter(p=>!p.giocata);
    html += `<div class="section-label">${g.nome}</div>`;
    if (giocate.length) {
      html += `<div class="card">`;
      for (const p of giocate) {
        const mH=(p.marcatori||[]).filter(m=>m.squadra_id===p.home_id);
        const mA=(p.marcatori||[]).filter(m=>m.squadra_id===p.away_id);
        html+=`<div class="match-result">
          <div class="match-team">${logoHTML(p.home,'sm')}<span>${p.home?.nome||'?'}</span></div>
          <div class="match-score">${p.gol_home} — ${p.gol_away}</div>
          <div class="match-team right"><span>${p.away?.nome||'?'}</span>${logoHTML(p.away,'sm')}</div>
        </div>`;
        if(mH.length||mA.length){
          html+=`<div class="match-scorers">`;
          mH.forEach(m=>html+=`<span class="scorer-chip">⚽ ${m.nome}${m.minuto?' '+m.minuto+"'":''} (${p.home?.nome||''})</span>`);
          mA.forEach(m=>html+=`<span class="scorer-chip">⚽ ${m.nome}${m.minuto?' '+m.minuto+"'":''} (${p.away?.nome||''})</span>`);
          html+=`</div>`;
        }
      }
      html+=`</div>`;
    }
    if (dafar.length) {
      html+=`<div class="card">`;
      for (const p of dafar) {
        html+=`<div class="match-result">
          <div class="match-team">${logoHTML(p.home,'sm')}<span>${p.home?.nome||'?'}</span></div>
          <div class="match-score pending">vs</div>
          <div class="match-team right"><span>${p.away?.nome||'?'}</span>${logoHTML(p.away,'sm')}</div>
        </div>`;
      }
      html+=`</div>`;
    }
  }
  el.innerHTML = html || '<div class="empty-state">Nessun risultato.</div>';
}

// ===== PUBLIC: TABELLONE =====
async function renderTabellone() {
  const el = document.getElementById('sec-tabellone');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }
  const ko = await dbGetKnockout(STATE.activeCat);
  const squadre = await dbGetSquadre(STATE.activeTorneo);
  const sqMap={}; squadre.forEach(s=>sqMap[s.id]=s);
  if (!ko.length) { el.innerHTML='<div class="empty-state">Tabellone non ancora generato.</div>'; return; }
  const main_rounds=ko.filter(m=>!m.is_consolazione);
  const cons_rounds=ko.filter(m=>m.is_consolazione);
  const renderRounds=(matches,label)=>{
    if(!matches.length) return '';
    const rounds={};
    matches.forEach(m=>{if(!rounds[m.round_name])rounds[m.round_name]=[];rounds[m.round_name].push(m);});
    const order=['Quarti di finale','Semifinali','3° posto','Finale','5° posto','7° posto','Consolazione semifinali','Consolazione finale','Consolazione 3° posto'];
    const sorted=Object.keys(rounds).sort((a,b)=>(order.indexOf(a)||99)-(order.indexOf(b)||99));
    let h=`<div class="section-label">${label}</div><div class="ko-grid">`;
    for(const rname of sorted){
      h+=`<div class="ko-col"><div class="ko-col-title">${rname}</div>`;
      for(const m of rounds[rname]){
        const hm=m.home_id?sqMap[m.home_id]:null, am=m.away_id?sqMap[m.away_id]:null;
        const w1=m.giocata&&m.gol_home>m.gol_away, w2=m.giocata&&m.gol_away>m.gol_home;
        h+=`<div class="ko-match">
          <div class="ko-team-row ${w1?'winner':''}">${logoHTML(hm,'sm')}<span style="flex:1;">${hm?hm.nome:'TBD'}</span>${m.giocata?`<span class="ko-score">${m.gol_home}</span>`:''}</div>
          <div class="ko-sep"></div>
          <div class="ko-team-row ${w2?'winner':''}">${logoHTML(am,'sm')}<span style="flex:1;">${am?am.nome:'TBD'}</span>${m.giocata?`<span class="ko-score">${m.gol_away}</span>`:''}</div>
        </div>`;
      }
      h+=`</div>`;
    }
    return h+'</div>';
  };
  el.innerHTML=renderRounds(main_rounds,'Tabellone principale')+renderRounds(cons_rounds,'Consolazione');
}

// ===== ADMIN: TORNEI =====
async function renderAdminTornei() {
  const el = document.getElementById('sec-a-tornei');
  STATE.tornei = await dbGetTornei();
  let html = `<div class="section-label">Tornei</div>`;
  if (!STATE.tornei.length) html += `<div class="empty-state">Nessun torneo. Creane uno!</div>`;
  for (const t of STATE.tornei) {
    html += `<div class="card">
      <div class="card-title">
        <div style="display:flex;align-items:center;gap:8px;">
          ${logoHTML(null,'sm')}
          <div>
            <div style="font-weight:600;">${t.nome}</div>
            <div style="font-size:12px;color:#aaa;">${t.data||'Data non impostata'}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="badge ${t.attivo?'badge-green':'badge-gray'}">${t.attivo?'Attivo':'Archiviato'}</span>
          <button class="btn btn-sm ${t.attivo?'':'btn-p'}" onclick="toggleTorneo(${t.id},${t.attivo})">${t.attivo?'Archivia':'Riattiva'}</button>
          <button class="btn btn-sm" onclick="editTorneo(${t.id})">Modifica</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTorneo(${t.id})">Elimina</button>
        </div>
      </div>
    </div>`;
  }
  html += `<div class="section-label">Nuovo torneo</div>
  <div class="card">
    <div class="form-grid-2">
      <div class="form-group"><label class="form-label">Nome torneo</label>
        <input class="form-input" id="new-t-nome" placeholder="Trofeo Città di Massa 2026"></div>
      <div class="form-group"><label class="form-label">Data</label>
        <input class="form-input" id="new-t-data" placeholder="4-6 Aprile 2026"></div>
    </div>
    <button class="btn btn-p" onclick="createTorneo()">Crea torneo</button>
  </div>`;
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
  toast('Torneo creato!');
  await renderAdminTornei();
}

async function toggleTorneo(id, attivo) {
  await dbUpdateTorneo(id, { attivo: !attivo });
  STATE.tornei = await dbGetTornei();
  await renderAdminTornei();
  toast(attivo ? 'Torneo archiviato' : 'Torneo riattivato');
}

async function deleteTorneo(id) {
  if (!confirm('Eliminare questo torneo e tutti i suoi dati?')) return;
  await dbDeleteTorneo(id);
  STATE.tornei = await dbGetTornei();
  STATE.activeTorneo = STATE.tornei.find(t=>t.attivo)?.id || STATE.tornei[0]?.id || null;
  await loadTorneo();
  await renderAdminTornei();
  toast('Torneo eliminato');
}

async function editTorneo(id) {
  const t = STATE.tornei.find(x=>x.id===id);
  const nome = prompt('Nome torneo:', t.nome);
  if (!nome) return;
  const data = prompt('Data:', t.data||'');
  await dbUpdateTorneo(id, { nome, data });
  STATE.tornei = await dbGetTornei();
  updateHeader();
  renderTorneoBar();
  await renderAdminTornei();
  toast('Torneo aggiornato');
}

// ===== ADMIN: SETUP CATEGORIE =====
async function renderAdminSetup() {
  const el = document.getElementById('sec-a-setup');
  if (!STATE.activeTorneo) { el.innerHTML='<div class="empty-state">Crea prima un torneo.</div>'; return; }
  const t = STATE.tornei.find(x=>x.id===STATE.activeTorneo);
  const tutteSquadre = await dbGetSquadre(STATE.activeTorneo);

  let html = `<div style="background:#e3f0fb;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:13px;color:#0c447c;">Torneo attivo: <strong>${t?.nome||'?'}</strong></div>
    <button class="btn" style="background:#27ae60;color:white;border-color:#27ae60;font-weight:500;" onclick="esportaExcel()">↓ Scarica Excel</button>
  </div>`;

  if (tutteSquadre.length) {
    html += '<div class="section-label">Squadre caricate (' + tutteSquadre.length + ' totali)</div><div class="card" style="margin-bottom:14px;"><div style="display:flex;flex-wrap:wrap;gap:6px;">';
    tutteSquadre.forEach(sq => {
      html += '<span style="display:inline-flex;align-items:center;gap:5px;background:#f0f6ff;border:1px solid #c5ddf5;border-radius:99px;padding:3px 10px;font-size:12px;color:#185FA5;">' + logoHTML(sq,'sm') + ' ' + sq.nome + '</span>';
    });
    html += '</div></div>';
  }

  html += '<div class="section-label">Categorie configurate</div>';
  if (!STATE.categorie.length) html += '<div style="color:#aaa;font-size:13px;padding:8px 0 16px;">Nessuna categoria. Aggiungine una qui sotto.</div>';

  for (const cat of STATE.categorie) {
    const gironi = await dbGetGironi(cat.id);
    let totP = 0, totG = 0;
    for (const g of gironi) {
      const pp = await dbGetPartite(g.id);
      totP += pp.length; totG += pp.filter(p=>p.giocata).length;
    }
    html += '<div class="card" style="margin-bottom:10px;"><div class="card-title" style="margin-bottom:10px;"><div style="font-size:15px;font-weight:600;">' + cat.nome + '</div><div style="display:flex;gap:6px;align-items:center;"><span class="badge badge-blue">Top ' + (cat.qualificate||2) + ' si qualificano</span><span class="badge badge-gray">' + totG + '/' + totP + ' partite</span><button class="btn btn-danger btn-sm" onclick="deleteCat(' + cat.id + ')">Elimina</button></div></div>';
    for (const g of gironi) {
      const members = await dbGetGironeSquadre(g.id);
      html += '<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">' + g.nome + '</div><div style="display:flex;flex-wrap:wrap;gap:4px;">';
      members.forEach(m => {
        html += '<span style="display:inline-flex;align-items:center;gap:4px;background:#f5f5f5;border-radius:99px;padding:2px 8px;font-size:12px;">' + logoHTML(m.squadre,'sm') + ' ' + m.squadre.nome + '</span>';
      });
      html += '</div></div>';
    }
    html += '</div>';
  }

  html += '<div class="section-label">Aggiungi categoria manualmente</div><div class="card"><div class="form-grid-2"><div class="form-group"><label class="form-label">Nome (es. Under 12)</label><input class="form-input" id="cname" placeholder="Under 10"></div><div class="form-group"><label class="form-label">Si qualificano (prime N)</label><select class="form-input" id="cqualify"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></div></div><div class="form-group"><label class="form-label">Squadre — una riga per girone, separate da virgola</label><textarea class="form-input" id="cteams" rows="5" placeholder="Girone A: Milan, Inter, Juve, Roma&#10;Girone B: Napoli, Fiorentina, Lazio, Torino"></textarea></div><button class="btn btn-p" style="width:100%;" onclick="addCategoria()">+ Aggiungi categoria</button></div>';

  html += '<div class="section-label">Importa da Excel</div><div class="card"><div style="font-size:13px;color:#555;margin-bottom:12px;">Carica il file Excel compilato con il modello SPE — importa automaticamente categorie, gironi, squadre, partite con orari e fase finale.</div><label style="display:inline-flex;align-items:center;gap:8px;background:#185FA5;color:white;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">📂 Seleziona file Excel<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importaExcel(event)"></label><div id="import-preview"></div></div>';

  el.innerHTML = html;
}

async function addCategoria() {
  const nome=document.getElementById('cname').value.trim();
  const qualificate=parseInt(document.getElementById('cqualify').value);
  const teamsText=document.getElementById('cteams').value.trim();
  if(!nome||!teamsText){alert('Compila nome e squadre');return;}
  const cat=await dbSaveCategoria({nome,qualificate,formato:'semi',ordine:STATE.categorie.length,torneo_id:STATE.activeTorneo});
  STATE.categorie=await dbGetCategorie(STATE.activeTorneo);
  if(!STATE.activeCat) STATE.activeCat=cat.id;
  const lines=teamsText.split('\n').map(l=>l.trim()).filter(Boolean);
  for(let gi=0;gi<lines.length;gi++){
    let line=lines[gi];
    if(line.includes(':')) line=line.split(':')[1];
    const teamNames=line.split(',').map(t=>t.trim()).filter(Boolean);
    const girone=await dbSaveGirone({categoria_id:cat.id,nome:'Girone '+String.fromCharCode(65+gi)});
    const squadra_ids=[];
    for(const tn of teamNames){
      let sq=(await dbGetSquadre(STATE.activeTorneo)).find(s=>s.nome.toLowerCase()===tn.toLowerCase());
      if(!sq) sq=await dbSaveSquadra({nome:tn,torneo_id:STATE.activeTorneo});
      squadra_ids.push(sq.id);
    }
    await dbSetGironeSquadre(girone.id,squadra_ids);
    await dbGeneraPartite(girone.id,squadra_ids);
  }
  renderCatBar();
  toast('Categoria aggiunta!');
  await renderAdminSetup();
}

async function deleteCat(id){
  if(!confirm('Eliminare questa categoria?')) return;
  await dbDeleteCategoria(id);
  STATE.categorie=await dbGetCategorie(STATE.activeTorneo);
  STATE.activeCat=STATE.categorie[0]?.id||null;
  renderCatBar();
  await renderAdminSetup();
}

// ===== ADMIN: LOGHI =====
async function renderAdminLoghi(){
  const el=document.getElementById('sec-a-loghi');
  const squadre=await dbGetSquadre(STATE.activeTorneo);
  if(!squadre.length){el.innerHTML='<div class="empty-state">Aggiungi prima le squadre nel setup.</div>';return;}
  let html='<div class="section-label">Loghi squadre</div><div class="card">';
  html+=`<div style="font-size:13px;color:#666;margin-bottom:14px;">Clicca sul logo per caricare/cambiare l'immagine.</div>`;
  for(const sq of squadre){
    html+=`<div class="logo-team-row">
      <div class="logo-upload-btn">
        ${logoHTML(sq,'md')}
        <div class="logo-plus"><svg width="8" height="8" viewBox="0 0 8 8"><path d="M4 1v6M1 4h6" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <input type="file" accept="image/*" onchange="uploadLogo(event,${sq.id})">
      </div>
      <div style="flex:1;"><div style="font-size:14px;font-weight:600;">${sq.nome}</div>
        <div style="font-size:12px;color:#aaa;">${sq.logo?'Logo caricato':'Nessun logo'}</div></div>
      ${sq.logo?`<button class="btn btn-danger btn-sm" onclick="removeLogo(${sq.id})">Rimuovi</button>`:''}
    </div>`;
  }
  html+='</div>';
  el.innerHTML=html;
}

async function uploadLogo(event,squadra_id){
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async(e)=>{await dbUpdateLogo(squadra_id,e.target.result);toast('Logo caricato!');await renderAdminLoghi();};
  reader.readAsDataURL(file);
}
async function removeLogo(squadra_id){await dbUpdateLogo(squadra_id,null);toast('Logo rimosso');await renderAdminLoghi();}

// ===== ADMIN: RISULTATI =====
let openScorers={};
async function renderAdminRisultati(){
  const el=document.getElementById('sec-a-risultati');
  if(!STATE.activeCat){el.innerHTML='<div class="empty-state">Nessuna categoria.</div>';return;}
  const gironi=await getGironiWithData(STATE.activeCat);
  let html='';
  for(const g of gironi){
    const played=g.partite.filter(p=>p.giocata).length;
    html+=`<div class="section-label">${g.nome} <span class="badge badge-gray" style="margin-left:6px;">${played}/${g.partite.length}</span></div>`;
    for(const p of g.partite){
      const key='p'+p.id;
      const open=!!openScorers[key];
      let badge='';
      if(p.giocata){
        if(p.gol_home>p.gol_away) badge=`<span class="badge badge-green">${p.home?.nome} vince</span>`;
        else if(p.gol_home<p.gol_away) badge=`<span class="badge badge-green">${p.away?.nome} vince</span>`;
        else badge=`<span class="badge badge-blue">Pareggio</span>`;
      }
      html+=`<div class="admin-match"><div class="admin-match-header">
        <div class="admin-team-name">${logoHTML(p.home,'sm')}<span>${p.home?.nome||'?'}</span></div>
        <input class="score-input" type="number" min="0" max="30" value="${p.giocata?p.gol_home:''}" placeholder="—" id="sh_${p.id}">
        <span class="score-dash">—</span>
        <input class="score-input" type="number" min="0" max="30" value="${p.giocata?p.gol_away:''}" placeholder="—" id="sa_${p.id}">
        <div class="admin-team-name right"><span>${p.away?.nome||'?'}</span>${logoHTML(p.away,'sm')}</div>
        <div class="match-actions">
          <button class="btn btn-p btn-sm" onclick="saveRisultato(${p.id},${g.id})">✓ Conferma</button>
          ${badge}
          ${p.giocata?`<button class="btn btn-accent btn-sm" onclick="toggleScorers('${key}')">${open?'Chiudi':'+ Marcatori'}</button>`:''}
        </div>
      </div>`;
      if(open&&p.giocata){
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
          <div style="margin-top:10px;"><button class="btn btn-success btn-sm" onclick="saveMarcatori(${p.id},${g.id})">Salva marcatori</button></div>
        </div>`;
      }
      html+='</div>';
    }
  }
  el.innerHTML=html||'<div class="empty-state">Nessuna partita.</div>';
}

async function saveRisultato(partita_id,girone_id){
  const sh=document.getElementById('sh_'+partita_id).value;
  const sa=document.getElementById('sa_'+partita_id).value;
  if(sh===''||sa===''){toast('Inserisci entrambi i gol');return;}
  try{
    const result=await dbSavePartita({id:partita_id,girone_id,gol_home:parseInt(sh),gol_away:parseInt(sa),giocata:true});
    if(result){toast('✓ Salvato!');await renderAdminRisultati();}
    else toast('Errore nel salvataggio');
  }catch(e){console.error(e);toast('Errore: '+(e.message||'sconosciuto'));}
}

function toggleScorers(key){openScorers[key]=!openScorers[key];renderAdminRisultati();}

let tempMarcatori={};
function addMarcatore(partita_id){
  if(!tempMarcatori[partita_id])tempMarcatori[partita_id]=[];
  tempMarcatori[partita_id].push({squadra_id:null,nome:'',minuto:null});
  renderAdminRisultati();
}
function removeMarcatore(partita_id,idx){
  if(!tempMarcatori[partita_id])tempMarcatori[partita_id]=[];
  tempMarcatori[partita_id].splice(idx,1);
  renderAdminRisultati();
}
async function saveMarcatori(partita_id,girone_id){
  const gironi=await getGironiWithData(STATE.activeCat);
  let partita=null;
  for(const g of gironi) for(const p of g.partite) if(p.id===partita_id) partita=p;
  if(!partita) return;
  const existing=partita.marcatori||[];
  const all=[];
  for(let i=0;i<existing.length;i++){
    const sqEl=document.getElementById(`msq_${partita_id}_${i}`);
    const nmEl=document.getElementById(`mnm_${partita_id}_${i}`);
    const mnEl=document.getElementById(`mmin_${partita_id}_${i}`);
    if(sqEl&&nmEl&&nmEl.value.trim()) all.push({squadra_id:parseInt(sqEl.value),nome:nmEl.value.trim(),minuto:mnEl?mnEl.value||null:null});
  }
  await dbSaveMarcatori(partita_id,all.filter(m=>m.nome));
  delete tempMarcatori[partita_id];
  openScorers['p'+partita_id]=false;
  toast('Marcatori salvati');
  await renderAdminRisultati();
}

// ===== ADMIN: KNOCKOUT =====
async function renderAdminKnockout(){
  const el=document.getElementById('sec-a-knockout');
  if(!STATE.activeCat){el.innerHTML='<div class="empty-state">Nessuna categoria.</div>';return;}
  const cat=STATE.categorie.find(c=>c.id===STATE.activeCat);
  const gironi=await getGironiWithData(STATE.activeCat);
  const ko=await dbGetKnockout(STATE.activeCat);
  const squadre=await dbGetSquadre(STATE.activeTorneo);
  const sqMap={}; squadre.forEach(s=>sqMap[s.id]=s);

  const classifiche={};
  for(const g of gironi) classifiche[g.id]=calcGironeClassifica(g);

  const qualificate=[],consolazione=[];
  for(const g of gironi){
    const cl=classifiche[g.id];
    cl.forEach((row,idx)=>{
      if(idx<(cat.qualificate||2)) qualificate.push({...row,girone:g.nome,pos:idx+1});
      else consolazione.push({...row,girone:g.nome,pos:idx+1});
    });
  }

  let html=`<div class="section-label">Qualificate</div><div class="card" style="margin-bottom:14px;">`;
  qualificate.forEach(q=>{
    html+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:13px;">
      ${logoHTML(q.sq,'sm')}
      <span class="badge ${q.pos===1?'badge-green':'badge-blue'}">${q.pos}°</span>
      <span style="flex:1;">${q.sq.nome}</span>
      <span style="color:#aaa;font-size:12px;">${q.girone} · ${q.pts} pt</span>
    </div>`;
  });
  html+=`</div>`;

  if(consolazione.length){
    html+=`<div class="section-label">Non qualificate</div><div class="card" style="margin-bottom:14px;">`;
    consolazione.forEach(q=>{
      html+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:13px;">
        ${logoHTML(q.sq,'sm')}
        <span class="badge badge-gray">${q.pos}°</span>
        <span style="flex:1;">${q.sq.nome}</span>
        <span style="color:#aaa;font-size:12px;">${q.girone} · ${q.pts} pt</span>
      </div>`;
    });
    html+=`</div>`;
  }

  const allSq=[...qualificate,...consolazione];
  const sqOptions=allSq.map(q=>`<option value="${q.sq.id}">${q.sq.nome} (${q.girone} ${q.pos}°)</option>`).join('');

  html+=`<div class="section-label">Aggiungi partita al tabellone</div>
  <div class="card" style="margin-bottom:14px;">
    <div class="form-grid-2" style="margin-bottom:10px;">
      <div><div class="form-label">Round</div>
        <select class="form-input" id="new-round-name">
          <option>Quarti di finale</option><option>Semifinali</option>
          <option>3° posto</option><option>Finale</option>
          <option>5° posto</option><option>7° posto</option>
          <option>Consolazione semifinali</option><option>Consolazione finale</option>
          <option>Consolazione 3° posto</option>
        </select></div>
      <div><div class="form-label">Tipo</div>
        <select class="form-input" id="new-round-type">
          <option value="0">Tabellone principale</option>
          <option value="1">Consolazione</option>
        </select></div>
    </div>
    <div class="form-grid-2" style="margin-bottom:10px;">
      <div><div class="form-label">Squadra 1</div><select class="form-input" id="new-home">${sqOptions}</select></div>
      <div><div class="form-label">Squadra 2</div><select class="form-input" id="new-away">${sqOptions}</select></div>
    </div>
    <button class="btn btn-p" onclick="addKOMatch()">+ Aggiungi partita</button>
  </div>`;

  const renderKOSection=(matches,label)=>{
    if(!matches.length) return '';
    const rounds={};
    matches.forEach(m=>{if(!rounds[m.round_name])rounds[m.round_name]=[];rounds[m.round_name].push(m);});
    const order=['Quarti di finale','Semifinali','3° posto','Finale','5° posto','7° posto','Consolazione semifinali','Consolazione finale','Consolazione 3° posto'];
    const sorted=Object.keys(rounds).sort((a,b)=>(order.indexOf(a)||99)-(order.indexOf(b)||99));
    let h=`<div class="section-label">${label} <button class="btn btn-sm btn-danger" style="margin-left:8px;" onclick="resetKOSection(${matches[0].is_consolazione?1:0})">Cancella tutto</button></div>`;
    for(const rname of sorted){
      h+=`<div style="font-size:12px;font-weight:600;color:#555;margin:10px 0 6px;text-transform:uppercase;letter-spacing:.04em;">${rname}</div>`;
      for(const m of rounds[rname]){
        const hm=m.home_id?sqMap[m.home_id]:null, am=m.away_id?sqMap[m.away_id]:null;
        let badge='';
        if(m.giocata){
          if(m.gol_home>m.gol_away) badge=`<span class="badge badge-green">${hm?.nome} vince</span>`;
          else if(m.gol_home<m.gol_away) badge=`<span class="badge badge-green">${am?.nome} vince</span>`;
          else badge=`<span class="badge badge-blue">Pareggio</span>`;
        }
        h+=`<div class="admin-match"><div class="admin-match-header">
          <div class="admin-team-name">${logoHTML(hm,'sm')}<span>${hm?hm.nome:'TBD'}</span></div>
          <input class="score-input" type="number" min="0" value="${m.giocata?m.gol_home:''}" placeholder="—" id="ksh_${m.id}">
          <span class="score-dash">—</span>
          <input class="score-input" type="number" min="0" value="${m.giocata?m.gol_away:''}" placeholder="—" id="ksa_${m.id}">
          <div class="admin-team-name right"><span>${am?am.nome:'TBD'}</span>${logoHTML(am,'sm')}</div>
          <div class="match-actions">
            <button class="btn btn-p btn-sm" onclick="saveKO(${m.id})">✓ Conferma</button>
            ${badge}
            <button class="btn btn-danger btn-sm" onclick="deleteKOMatch(${m.id})">✕</button>
          </div>
        </div></div>`;
      }
    }
    return h;
  };

  const main_ko=ko.filter(m=>!m.is_consolazione);
  const cons_ko=ko.filter(m=>m.is_consolazione);
  html+=renderKOSection(main_ko,'Tabellone principale');
  html+=renderKOSection(cons_ko,'Consolazione');
  el.innerHTML=html;
}

async function addKOMatch(){
  const round_name=document.getElementById('new-round-name').value;
  const is_consolazione=document.getElementById('new-round-type').value==='1';
  const home_id=parseInt(document.getElementById('new-home').value);
  const away_id=parseInt(document.getElementById('new-away').value);
  if(home_id===away_id){toast('Seleziona due squadre diverse');return;}
  const ko=await dbGetKnockout(STATE.activeCat);
  const existing=ko.filter(m=>m.round_name===round_name);
  const order=['Quarti di finale','Semifinali','3° posto','Finale','5° posto','7° posto','Consolazione semifinali','Consolazione finale','Consolazione 3° posto'];
  await dbSaveKnockoutMatch({categoria_id:STATE.activeCat,round_name,round_order:order.indexOf(round_name),match_order:existing.length,home_id,away_id,gol_home:0,gol_away:0,giocata:false,is_consolazione});
  toast('Partita aggiunta!');
  await renderAdminKnockout();
}

async function saveKO(match_id){
  const sh=document.getElementById('ksh_'+match_id).value;
  const sa=document.getElementById('ksa_'+match_id).value;
  if(sh===''||sa===''){toast('Inserisci i gol');return;}
  const ko=await dbGetKnockout(STATE.activeCat);
  const m=ko.find(x=>x.id===match_id);
  if(!m) return;
  await dbSaveKnockoutMatch({...m,gol_home:parseInt(sh),gol_away:parseInt(sa),giocata:true});
  toast('✓ Risultato salvato');
  await renderAdminKnockout();
}

async function deleteKOMatch(match_id){
  if(!confirm('Eliminare questa partita?')) return;
  await db.from('knockout').delete().eq('id',match_id);
  toast('Eliminata');
  await renderAdminKnockout();
}

async function resetKOSection(is_consolazione){
  if(!confirm('Eliminare tutte le partite di questa sezione?')) return;
  const ko=await dbGetKnockout(STATE.activeCat);
  for(const m of ko.filter(x=>x.is_consolazione===!!is_consolazione)) await db.from('knockout').delete().eq('id',m.id);
  toast('Sezione eliminata');
  await renderAdminKnockout();
}

// ===== ADMIN AUTH =====
function toggleAdmin(){
  if(STATE.isAdmin){exitAdmin();return;}
  document.getElementById('admin-modal').style.display='flex';
  setTimeout(()=>document.getElementById('admin-pw').focus(),100);
}
function checkPw(){
  const pw=document.getElementById('admin-pw').value;
  if(pw===CONFIG.ADMIN_PASSWORD){
    document.getElementById('admin-modal').style.display='none';
    document.getElementById('admin-pw').value='';
    document.getElementById('pw-error').textContent='';
    enterAdmin();
  } else document.getElementById('pw-error').textContent='Password errata';
}
function enterAdmin(){
  STATE.isAdmin=true;
  document.getElementById('pub-nav').style.display='none';
  document.getElementById('admin-nav').style.display='flex';
  document.getElementById('admin-btn').textContent='Esci';
  STATE.currentSection='a-tornei';
  document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b=>b.classList.remove('active'));
  document.querySelector('[data-section="a-tornei"]').classList.add('active');
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  document.getElementById('sec-a-tornei').classList.add('active');
  document.getElementById('cat-bar').style.display='none';
  renderAdminTornei();
}
function exitAdmin(){
  STATE.isAdmin=false;
  document.getElementById('pub-nav').style.display='flex';
  document.getElementById('admin-nav').style.display='none';
  document.getElementById('admin-btn').textContent='Admin';
  STATE.currentSection='classifiche';
  document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b=>b.classList.remove('active'));
  document.querySelector('[data-section="classifiche"]').classList.add('active');
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  document.getElementById('sec-classifiche').classList.add('active');
  renderClassifiche();
}

function toast(msg){
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t);}
  t.textContent=msg;t.style.display='block';
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>t.style.display='none',2500);
}

window.addEventListener('DOMContentLoaded',init);
