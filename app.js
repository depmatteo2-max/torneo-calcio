let STATE = {
  torneo: null,
  categorie: [],
  activeCat: null,
  isAdmin: false,
  currentSection: 'classifiche',
  adminSection: 'a-torneo',
};

async function init() {
  initDB();
  try {
    STATE.torneo = await dbGetTorneo();
    STATE.categorie = await dbGetCategorie();
    if (STATE.categorie.length) STATE.activeCat = STATE.categorie[0].id;
    updateHeader();
    renderCatBar();
    await renderCurrentSection();
    subscribeRealtime(() => renderCurrentSection());
  } catch(e) { console.error(e); }
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
}

function updateHeader() {
  if (!STATE.torneo) return;
  document.getElementById('header-title').textContent = STATE.torneo.nome || 'Soccer Pro Experience';
  document.getElementById('header-date').textContent = STATE.torneo.data || '';
  if (STATE.torneo.logo) {
    document.getElementById('header-logo').src = STATE.torneo.logo;
    document.getElementById('loading-img').src = STATE.torneo.logo;
  }
}

// ===== NAVIGATION =====
function showSection(name, btn) {
  STATE.currentSection = name;
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('cat-bar').style.display = ['a-torneo','a-categorie'].includes(name) ? 'none' : '';
  renderCurrentSection();
}

function showAdminSection(name) {
  STATE.adminSection = name;
  STATE.currentSection = name;
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  const tab = document.querySelector(`.admin-tab[data-section="${name}"]`);
  if (tab) tab.classList.add('active');
  document.getElementById('cat-bar').style.display = ['a-torneo','a-categorie'].includes(name) ? 'none' : '';
  renderCurrentSection();
}

async function renderCurrentSection() {
  updateHeader();
  const s = STATE.currentSection;
  if (s === 'classifiche')  await renderClassifiche();
  else if (s === 'risultati')   await renderRisultati();
  else if (s === 'tabellone')   await renderTabellone();
  else if (s === 'a-torneo')    await renderAdminTorneo();
  else if (s === 'a-categorie') await renderAdminCategorie();
  else if (s === 'a-loghi')     await renderAdminLoghi();
  else if (s === 'a-risultati') await renderAdminRisultati();
  else if (s === 'a-knockout')  await renderAdminKnockout();
}

function renderCatBar() {
  const bar = document.getElementById('cat-bar');
  if (!STATE.categorie.length) { bar.innerHTML = ''; return; }
  bar.innerHTML = `<div class="cat-bar-inner">${STATE.categorie.map(c =>
    `<button class="cat-pill ${c.id === STATE.activeCat ? 'active' : ''}" onclick="selectCat(${c.id})">${c.nome}</button>`
  ).join('')}</div>`;
}

function selectCat(id) {
  STATE.activeCat = id;
  renderCatBar();
  renderCurrentSection();
}

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

function calcGironeClassifica(girone) {
  const map = {};
  for (const sq of girone.squadre) map[sq.id] = { sq, g:0, v:0, p:0, s:0, gf:0, gs:0, pts:0 };
  for (const p of girone.partite) {
    if (!p.giocata) continue;
    const h=map[p.home_id], a=map[p.away_id];
    if(!h||!a) continue;
    h.g++;a.g++;h.gf+=p.gol_home;h.gs+=p.gol_away;a.gf+=p.gol_away;a.gs+=p.gol_home;
    if(p.gol_home>p.gol_away){h.v++;h.pts+=3;a.s++;}
    else if(p.gol_home<p.gol_away){a.v++;a.pts+=3;h.s++;}
    else{h.p++;h.pts++;a.p++;a.pts++;}
  }
  return Object.values(map).sort((a,b)=>b.pts-a.pts||(b.gf-b.gs)-(a.gf-a.gs)||b.gf-a.gf);
}

// ===== PUBLIC: CLASSIFICHE =====
async function renderClassifiche() {
  const el = document.getElementById('sec-classifiche');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria configurata.</div>'; return; }
  const cat = STATE.categorie.find(c=>c.id===STATE.activeCat);
  const gironi = await getGironiWithData(STATE.activeCat);
  if (!gironi.length) { el.innerHTML='<div class="empty-state">Nessun girone trovato.</div>'; return; }
  let html='';
  for (const g of gironi) {
    const cl=calcGironeClassifica(g);
    const played=g.partite.filter(p=>p.giocata).length;
    html+=`<div class="card"><div class="card-title">${g.nome} <span class="badge badge-gray">${played}/${g.partite.length} partite</span></div>
      <table class="standings-table"><thead><tr><th></th><th colspan="2">Squadra</th><th>G</th><th>V</th><th>P</th><th>S</th><th>GD</th><th>Pt</th></tr></thead><tbody>`;
    cl.forEach((row,idx)=>{
      const q=idx<(cat.qualificate||2);
      const diff=row.gf-row.gs;
      html+=`<tr class="${q?'qualifies':''}">
        <td><span class="${q?'q-dot':'nq-dot'}"></span></td>
        <td>${logoHTML(row.sq,'sm')}</td>
        <td>${row.sq.nome}</td><td>${row.g}</td><td>${row.v}</td><td>${row.p}</td><td>${row.s}</td>
        <td class="${diff>0?'diff-pos':diff<0?'diff-neg':''}">${diff>0?'+':''}${diff}</td>
        <td class="pts-col">${row.pts}</td></tr>`;
    });
    html+=`</tbody></table></div>`;
  }
  el.innerHTML=html;
}

// ===== PUBLIC: RISULTATI =====
async function renderRisultati() {
  const el=document.getElementById('sec-risultati');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }
  const gironi=await getGironiWithData(STATE.activeCat);
  let html='';
  for (const g of gironi) {
    const giocate=g.partite.filter(p=>p.giocata);
    const dafar=g.partite.filter(p=>!p.giocata);
    html+=`<div class="section-label">${g.nome}</div>`;
    if (giocate.length) {
      html+=`<div class="card">`;
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
          mH.forEach(m=>html+=`<span class="scorer-chip">⚽ ${m.nome}${m.minuto?' '+m.minuto+"'":''}</span>`);
          mA.forEach(m=>html+=`<span class="scorer-chip">⚽ ${m.nome}${m.minuto?' '+m.minuto+"'":''}</span>`);
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
  el.innerHTML=html||'<div class="empty-state">Nessun risultato.</div>';
}

// ===== PUBLIC: TABELLONE =====
async function renderTabellone() {
  const el=document.getElementById('sec-tabellone');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }
  const ko=await dbGetKnockout(STATE.activeCat);
  const squadre=await dbGetSquadre();
  const sqMap={}; squadre.forEach(s=>sqMap[s.id]=s);
  if (!ko.length) { el.innerHTML='<div class="empty-state">Tabellone non ancora generato.</div>'; return; }
  const rounds={};
  ko.forEach(m=>{if(!rounds[m.round_name])rounds[m.round_name]=[];rounds[m.round_name].push(m);});
  const order=['Quarti di finale','Semifinali','Finale 3° posto','3° posto','Finale','5° posto','7° posto'];
  const sorted=Object.keys(rounds).sort((a,b)=>{const ia=order.indexOf(a),ib=order.indexOf(b);return(ia===-1?99:ia)-(ib===-1?99:ib);});
  let html='<div class="ko-grid">';
  for (const rname of sorted) {
    html+=`<div class="ko-col"><div class="ko-col-title">${rname}</div>`;
    for (const m of rounds[rname]) {
      const h=m.home_id?sqMap[m.home_id]:null, a=m.away_id?sqMap[m.away_id]:null;
      const w1=m.giocata&&m.gol_home>m.gol_away, w2=m.giocata&&m.gol_away>m.gol_home;
      html+=`<div class="ko-match">
        <div class="ko-team-row ${w1?'winner':''}">${logoHTML(h,'sm')}<span style="flex:1;">${h?h.nome:(m.note_home||'TBD')}</span>${m.giocata?`<span class="ko-score">${m.gol_home}</span>`:''}</div>
        <div class="ko-sep"></div>
        <div class="ko-team-row ${w2?'winner':''}">${logoHTML(a,'sm')}<span style="flex:1;">${a?a.nome:(m.note_away||'TBD')}</span>${m.giocata?`<span class="ko-score">${m.gol_away}</span>`:''}</div>
      </div>`;
    }
    html+=`</div>`;
  }
  html+='</div>';
  el.innerHTML=html;
}

// ===== ADMIN: TORNEO =====
async function renderAdminTorneo() {
  const el=document.getElementById('sec-a-torneo');
  const t=STATE.torneo||{};
  el.innerHTML=`
    <div class="admin-page-title">⚙️ Impostazioni Torneo</div>
    <div class="card">
      <div class="form-group">
        <label class="form-label">Nome torneo *</label>
        <input class="form-input" id="t-nome" value="${t.nome||''}" placeholder="es. Trofeo Città di Massa 2026">
      </div>
      <div class="form-group">
        <label class="form-label">Data</label>
        <input class="form-input" id="t-data" value="${t.data||''}" placeholder="es. 4-6 Aprile 2026">
      </div>
      <div class="form-group">
        <label class="form-label">Luogo</label>
        <input class="form-input" id="t-luogo" value="${t.luogo||''}" placeholder="es. Massa (MS)">
      </div>
      <button class="btn btn-p" style="width:100%;padding:13px;font-size:15px;margin-top:8px;" onclick="saveTorneo()">
        💾 Salva torneo
      </button>
    </div>
    ${STATE.categorie.length ? `
    <div class="card" style="margin-top:12px;background:#e8f8ee;border:1px solid #a8dfc0;">
      <div style="font-size:13px;color:#1a7a4a;font-weight:600;margin-bottom:6px;">✅ Torneo configurato</div>
      <div style="font-size:13px;color:#555;">${STATE.categorie.length} categorie caricate</div>
      <button class="btn btn-p btn-sm" style="margin-top:8px;" onclick="showAdminSection('a-categorie')">Gestisci categorie →</button>
    </div>` : `
    <div class="card" style="margin-top:12px;background:#fff8e1;border:1px solid #ffe082;">
      <div style="font-size:13px;color:#e67e22;font-weight:600;margin-bottom:6px;">⚠️ Nessuna categoria caricata</div>
      <div style="font-size:13px;color:#555;margin-bottom:10px;">Dopo aver salvato il torneo, vai su Categorie per importare il file Excel.</div>
      <button class="btn btn-p btn-sm" onclick="showAdminSection('a-categorie')">Vai a Categorie →</button>
    </div>`}`;
}

async function saveTorneo() {
  const nome=document.getElementById('t-nome').value.trim();
  const data=document.getElementById('t-data').value.trim();
  const luogo=document.getElementById('t-luogo')?.value.trim()||'';
  if(!nome){alert('Inserisci il nome del torneo');return;}
  await dbSaveTorneo({nome,data,luogo});
  STATE.torneo={...STATE.torneo,nome,data,luogo};
  updateHeader();
  toast('✅ Torneo salvato!');
  await renderAdminTorneo();
}

// ===== ADMIN: CATEGORIE =====
async function renderAdminCategorie() {
  const el=document.getElementById('sec-a-categorie');

  let html=`<div class="admin-page-title">📁 Categorie</div>`;

  // Categorie già caricate
  if (STATE.categorie.length) {
    html+=`<div class="section-label">Categorie caricate</div>`;
    for (const cat of STATE.categorie) {
      const gironi=await dbGetGironi(cat.id);
      let totSquadre=0, totPartite=0;
      for(const g of gironi){
        const m=await dbGetGironeSquadre(g.id);
        const p=await dbGetPartite(g.id);
        totSquadre+=m.length;
        totPartite+=p.length;
      }
      html+=`<div class="card" style="margin-bottom:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-weight:700;font-size:15px;color:#185FA5;">${cat.nome}</div>
            <div style="font-size:12px;color:#888;margin-top:2px;">${gironi.length} gironi · ${totSquadre} squadre · ${totPartite} partite</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="deleteCat(${cat.id})">🗑 Elimina</button>
        </div>
      </div>`;
    }
    html+=`<div style="margin-bottom:20px;"></div>`;
  }

  // Box importa Excel
  html+=`
    <div class="section-label">📂 Importa da file Excel</div>
    <div class="card" style="border:2px dashed #185FA5;background:#f0f6ff;">
      <div style="text-align:center;padding:10px 0 16px;">
        <div style="font-size:32px;margin-bottom:8px;">📊</div>
        <div style="font-weight:700;font-size:15px;color:#185FA5;margin-bottom:6px;">Carica il file Excel del torneo</div>
        <div style="font-size:13px;color:#666;margin-bottom:16px;">Il file deve avere i fogli <strong>SQUADRE</strong> e <strong>PARTITE</strong></div>
        <label style="display:inline-flex;align-items:center;gap:10px;background:#185FA5;color:white;padding:12px 24px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(24,95,165,0.3);">
          📂 Seleziona file Excel (.xlsx)
          <input type="file" accept=".xlsx,.xls" style="display:none;" id="excel-input" onchange="importaExcel(event)">
        </label>
        <div style="margin-top:12px;font-size:12px;color:#888;">
          Non hai il modello? 
          <a href="#" onclick="scaricaModello()" style="color:#185FA5;font-weight:600;">📥 Scarica il modello</a>
        </div>
      </div>
      <div id="import-preview"></div>
    </div>

    <div class="section-label" style="margin-top:20px;">✏️ Aggiungi categoria manualmente</div>
    <div class="card">
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Nome categoria</label>
          <input class="form-input" id="new-cat-nome" placeholder="es. Under 10"></div>
        <div class="form-group"><label class="form-label">Si qualificano (prime N)</label>
          <select class="form-input" id="new-cat-qual">
            <option>1</option><option selected>2</option><option>3</option><option>4</option>
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">Squadre per girone (una riga per girone, squadre separate da virgola)</label>
        <textarea class="form-input" id="new-cat-teams" rows="3" placeholder="Girone A: Milan, Inter, Juve&#10;Girone B: Napoli, Roma, Lazio"></textarea></div>
      <button class="btn btn-p" onclick="addCategoria()">+ Aggiungi</button>
    </div>`;

  el.innerHTML=html;
}

function scaricaModello() {
  // Genera link al modello
  window.open('https://depmatteo2-max.github.io/torneo-calcio/modello_SPE_semplice.xlsx', '_blank');
}

async function addCategoria() {
  const nome=document.getElementById('new-cat-nome').value.trim();
  const qualificate=parseInt(document.getElementById('new-cat-qual').value);
  const teamsText=document.getElementById('new-cat-teams').value.trim();
  if(!nome||!teamsText){alert('Compila nome e squadre');return;}
  const cat=await dbSaveCategoria({nome,qualificate,formato:'semi',ordine:STATE.categorie.length});
  STATE.categorie=await dbGetCategorie();
  if(!STATE.activeCat) STATE.activeCat=cat.id;
  const lines=teamsText.split('\n').map(l=>l.trim()).filter(Boolean);
  for(let gi=0;gi<lines.length;gi++){
    let line=lines[gi];
    if(line.includes(':')) line=line.split(':')[1];
    const teamNames=line.split(',').map(t=>t.trim()).filter(Boolean);
    const girone=await dbSaveGirone({categoria_id:cat.id,nome:'Girone '+String.fromCharCode(65+gi)});
    const ids=[];
    for(const tn of teamNames){
      let sq=(await dbGetSquadre()).find(s=>s.nome.toLowerCase()===tn.toLowerCase());
      if(!sq) sq=await dbSaveSquadra({nome:tn});
      ids.push(sq.id);
    }
    await dbSetGironeSquadre(girone.id,ids);
    await dbGeneraPartite(girone.id,ids);
  }
  renderCatBar();
  toast('Categoria aggiunta!');
  await renderAdminCategorie();
}

async function deleteCat(id){
  if(!confirm('Eliminare questa categoria e tutti i suoi dati?')) return;
  await dbDeleteCategoria(id);
  STATE.categorie=await dbGetCategorie();
  STATE.activeCat=STATE.categorie[0]?.id||null;
  renderCatBar();
  await renderAdminCategorie();
}

// ===== ADMIN: LOGHI =====
async function renderAdminLoghi(){
  const el=document.getElementById('sec-a-loghi');
  const squadre=await dbGetSquadre();
  if(!squadre.length){el.innerHTML='<div class="admin-page-title">🖼 Loghi</div><div class="empty-state">Aggiungi prima le squadre.</div>';return;}
  let html='<div class="admin-page-title">🖼 Loghi squadre</div><div class="card">';
  for(const sq of squadre){
    html+=`<div class="logo-team-row">
      <div class="logo-upload-btn">
        ${logoHTML(sq,'md')}
        <div class="logo-plus"><svg width="8" height="8" viewBox="0 0 8 8"><path d="M4 1v6M1 4h6" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <input type="file" accept="image/*" onchange="uploadLogo(event,${sq.id})">
      </div>
      <div style="flex:1;"><div style="font-weight:600;">${sq.nome}</div>
        <div style="font-size:12px;color:#aaa;">${sq.logo?'✅ Logo caricato':'Nessun logo'}</div></div>
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
let openScorers={}, tempMarcatori={};

async function renderAdminRisultati(){
  const el=document.getElementById('sec-a-risultati');
  if(!STATE.activeCat){el.innerHTML='<div class="admin-page-title">⚽ Risultati</div><div class="empty-state">Nessuna categoria.</div>';return;}
  const gironi=await getGironiWithData(STATE.activeCat);
  let html='<div class="admin-page-title">⚽ Inserisci Risultati</div>';
  for(const g of gironi){
    const played=g.partite.filter(p=>p.giocata).length;
    html+=`<div class="section-label">${g.nome} <span class="badge badge-gray">${played}/${g.partite.length}</span></div>`;
    for(const p of g.partite){
      const key='p'+p.id, open=!!openScorers[key];
      let badge='';
      if(p.giocata){
        if(p.gol_home>p.gol_away) badge=`<span class="badge badge-green">${p.home?.nome} vince</span>`;
        else if(p.gol_home<p.gol_away) badge=`<span class="badge badge-green">${p.away?.nome} vince</span>`;
        else badge=`<span class="badge badge-blue">Pareggio</span>`;
      }
      const orario = p.orario ? `<span style="font-size:11px;color:#aaa;margin-right:4px;">🕐 ${p.orario}</span>` : '';
      const campo = p.campo ? `<span style="font-size:11px;color:#aaa;">📍 ${p.campo}</span>` : '';
      html+=`<div class="admin-match">
        ${orario||campo ? `<div style="padding:4px 12px 0;font-size:11px;">${orario}${campo}</div>` : ''}
        <div class="admin-match-header">
          <div class="admin-team-name">${logoHTML(p.home,'sm')}<span>${p.home?.nome||'?'}</span></div>
          <input class="score-input" type="number" min="0" max="30" value="${p.giocata?p.gol_home:''}" placeholder="—" id="sh_${p.id}">
          <span class="score-dash">—</span>
          <input class="score-input" type="number" min="0" max="30" value="${p.giocata?p.gol_away:''}" placeholder="—" id="sa_${p.id}">
          <div class="admin-team-name right"><span>${p.away?.nome||'?'}</span>${logoHTML(p.away,'sm')}</div>
          <div class="match-actions">
            <button class="btn btn-p btn-sm" onclick="saveRisultato(${p.id},${g.id})">✓</button>
            ${badge}
            ${p.giocata?`<button class="btn btn-accent btn-sm" onclick="toggleScorers('${key}')">${open?'✕':'⚽'}</button>`:''}
          </div>
        </div>`;
      if(open&&p.giocata){
        const marc=p.marcatori||[];
        html+=`<div class="scorers-section">`;
        marc.forEach((m,mi)=>{
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
          <button class="btn btn-p btn-sm" style="margin-top:8px;" onclick="saveMarcatori(${p.id},${g.id})">Salva marcatori</button>
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
  if(sh===''||sa===''){toast('Inserisci i gol');return;}
  try{
    await dbSavePartita({id:partita_id,girone_id,gol_home:parseInt(sh),gol_away:parseInt(sa),giocata:true});
    toast('✓ Salvato!');
    await renderAdminRisultati();
  }catch(e){toast('Errore: '+e.message);}
}

function toggleScorers(key){openScorers[key]=!openScorers[key];renderAdminRisultati();}
function addMarcatore(pid){if(!tempMarcatori[pid])tempMarcatori[pid]=[];tempMarcatori[pid].push({});renderAdminRisultati();}
function removeMarcatore(pid,idx){if(tempMarcatori[pid])tempMarcatori[pid].splice(idx,1);renderAdminRisultati();}

async function saveMarcatori(partita_id,girone_id){
  const gironi=await getGironiWithData(STATE.activeCat);
  let partita=null;
  for(const g of gironi) for(const p of g.partite) if(p.id===partita_id) partita=p;
  if(!partita) return;
  const marc=partita.marcatori||[];
  const all=[];
  for(let i=0;i<marc.length;i++){
    const sq=document.getElementById(`msq_${partita_id}_${i}`);
    const nm=document.getElementById(`mnm_${partita_id}_${i}`);
    const mn=document.getElementById(`mmin_${partita_id}_${i}`);
    if(sq&&nm&&nm.value.trim()) all.push({squadra_id:parseInt(sq.value),nome:nm.value.trim(),minuto:mn?.value||null});
  }
  await dbSaveMarcatori(partita_id,all);
  delete tempMarcatori[partita_id];
  openScorers['p'+partita_id]=false;
  toast('Marcatori salvati');
  await renderAdminRisultati();
}

// ===== ADMIN: KNOCKOUT =====
async function renderAdminKnockout(){
  const el=document.getElementById('sec-a-knockout');
  if(!STATE.activeCat){el.innerHTML='<div class="admin-page-title">🏆 Fase Finale</div><div class="empty-state">Nessuna categoria.</div>';return;}
  const cat=STATE.categorie.find(c=>c.id===STATE.activeCat);
  const gironi=await getGironiWithData(STATE.activeCat);
  const ko=await dbGetKnockout(STATE.activeCat);
  const squadre=await dbGetSquadre();
  const sqMap={}; squadre.forEach(s=>sqMap[s.id]=s);

  let html=`<div class="admin-page-title">🏆 Fase Finale</div>
  <div class="section-label">Qualificate</div><div class="card">`;
  for(const g of gironi){
    const cl=calcGironeClassifica(g);
    for(let i=0;i<(cat.qualificate||2)&&i<cl.length;i++){
      html+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:13px;">
        ${logoHTML(cl[i].sq,'sm')}
        <span class="badge ${i===0?'badge-green':'badge-blue'}">${i+1}°</span>
        <span style="flex:1;">${cl[i].sq.nome}</span>
        <span style="color:#aaa;font-size:12px;">${g.nome} · ${cl[i].pts} pt</span>
      </div>`;
    }
  }
  html+=`</div>`;

  const sqOptions=squadre.map(s=>`<option value="${s.id}">${s.nome}</option>`).join('');
  html+=`<div class="section-label">Aggiungi partita</div>
  <div class="card">
    <div class="form-grid-2" style="margin-bottom:10px;">
      <div><label class="form-label">Round</label>
        <select class="form-input" id="new-round">
          <option>Quarti di finale</option><option>Semifinali</option>
          <option>Finale 3° posto</option><option>Finale</option>
          <option>5° posto</option><option>7° posto</option>
        </select></div>
      <div><label class="form-label">Tipo</label>
        <select class="form-input" id="new-round-type">
          <option value="0">Principale</option><option value="1">Consolazione</option>
        </select></div>
    </div>
    <div class="form-grid-2" style="margin-bottom:10px;">
      <div><label class="form-label">Squadra 1</label><select class="form-input" id="new-ko-home">${sqOptions}</select></div>
      <div><label class="form-label">Squadra 2</label><select class="form-input" id="new-ko-away">${sqOptions}</select></div>
    </div>
    <button class="btn btn-p" onclick="addKOMatch()">+ Aggiungi</button>
  </div>`;

  if(ko.length){
    const rounds={};
    ko.forEach(m=>{if(!rounds[m.round_name])rounds[m.round_name]=[];rounds[m.round_name].push(m);});
    const order=['Quarti di finale','Semifinali','Finale 3° posto','3° posto','Finale','5° posto','7° posto'];
    const sorted=Object.keys(rounds).sort((a,b)=>(order.indexOf(a)||99)-(order.indexOf(b)||99));
    html+=`<div class="section-label">Tabellone <button class="btn btn-danger btn-sm" style="margin-left:8px;" onclick="resetKO()">Cancella tutto</button></div>`;
    for(const rname of sorted){
      html+=`<div style="font-size:12px;font-weight:700;color:#555;margin:10px 0 6px;text-transform:uppercase;">${rname}</div>`;
      for(const m of rounds[rname]){
        const h=m.home_id?sqMap[m.home_id]:null, a=m.away_id?sqMap[m.away_id]:null;
        let badge='';
        if(m.giocata){
          if(m.gol_home>m.gol_away) badge=`<span class="badge badge-green">${h?.nome} vince</span>`;
          else if(m.gol_home<m.gol_away) badge=`<span class="badge badge-green">${a?.nome} vince</span>`;
          else badge=`<span class="badge badge-blue">Pareggio</span>`;
        }
        html+=`<div class="admin-match"><div class="admin-match-header">
          <div class="admin-team-name">${logoHTML(h,'sm')}<span>${h?h.nome:(m.note_home||'TBD')}</span></div>
          <input class="score-input" type="number" min="0" value="${m.giocata?m.gol_home:''}" placeholder="—" id="ksh_${m.id}">
          <span class="score-dash">—</span>
          <input class="score-input" type="number" min="0" value="${m.giocata?m.gol_away:''}" placeholder="—" id="ksa_${m.id}">
          <div class="admin-team-name right"><span>${a?a.nome:(m.note_away||'TBD')}</span>${logoHTML(a,'sm')}</div>
          <div class="match-actions">
            <button class="btn btn-p btn-sm" onclick="saveKO(${m.id})">✓</button>
            ${badge}
            <button class="btn btn-danger btn-sm" onclick="deleteKOMatch(${m.id})">✕</button>
          </div>
        </div></div>`;
      }
    }
  }
  el.innerHTML=html;
}

async function addKOMatch(){
  const rn=document.getElementById('new-round').value;
  const isC=document.getElementById('new-round-type').value==='1';
  const hi=parseInt(document.getElementById('new-ko-home').value);
  const ai=parseInt(document.getElementById('new-ko-away').value);
  if(hi===ai){toast('Seleziona due squadre diverse');return;}
  const ko=await dbGetKnockout(STATE.activeCat);
  const mc=ko.filter(m=>m.round_name===rn).length;
  const order=['Quarti di finale','Semifinali','Finale 3° posto','3° posto','Finale','5° posto','7° posto'];
  await dbSaveKnockoutMatch({categoria_id:STATE.activeCat,round_name:rn,round_order:order.indexOf(rn),match_order:mc,home_id:hi,away_id:ai,gol_home:0,gol_away:0,giocata:false,is_consolazione:isC});
  toast('Aggiunta!');
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
  toast('✓ Salvato');
  await renderAdminKnockout();
}

async function deleteKOMatch(id){
  if(!confirm('Eliminare?')) return;
  await db.from('knockout').delete().eq('id',id);
  await renderAdminKnockout();
}

async function resetKO(){
  if(!confirm('Eliminare tutto il tabellone?')) return;
  await dbDeleteKnockout(STATE.activeCat);
  await renderAdminKnockout();
}

// ===== AUTH =====
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
  showAdminSection('a-torneo');
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
  document.getElementById('cat-bar').style.display='';
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
