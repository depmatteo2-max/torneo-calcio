// ============================================================
//  SOCCER PRO EXPERIENCE - App principale completa
// ============================================================

let STATE = {
  tornei: [], activeTorneo: null, categorie: [],
  activeCat: null, isAdmin: false, currentSection: 'classifiche',
  currentUser: null,
};

async function init() {
  initDB();
  try {
    STATE.tornei = await dbGetTornei();
    const attivi = STATE.tornei.filter(t => t.attivo);

    // Controlla se c'è un torneo salvato nel browser
    let savedId = null;
    try { savedId = parseInt(localStorage.getItem('spe_torneo_id')); } catch(e) {}
    const savedTorneo = savedId && attivi.find(t => t.id === savedId);

    if (savedTorneo) {
      // Torneo già scelto — vai diretto
      STATE.activeTorneo = savedTorneo.id;
      await loadTorneo();
      subscribeRealtime(() => renderCurrentSection());
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('main-app').style.display = 'block';
    } else if (attivi.length === 0) {
      // Nessun torneo attivo
      STATE.activeTorneo = STATE.tornei[0]?.id || null;
      await loadTorneo();
      subscribeRealtime(() => renderCurrentSection());
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('main-app').style.display = 'block';
    } else {
      // Mostra schermata di benvenuto
      document.getElementById('loading-screen').style.display = 'none';
      mostraWelcome(attivi);
    }
  } catch(e) {
    console.error(e);
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
  }
}

function mostraWelcome(torneiAttivi) {
  const screen = document.getElementById('welcome-screen');
  if (!screen) return;

  // Logo: prendi dal loading-img già caricato o dalla variabile SPE_LOGO
  let logoSrc = '';
  try {
    const existingLogo = document.getElementById('loading-img');
    if (existingLogo && existingLogo.src && existingLogo.src !== window.location.href) {
      logoSrc = existingLogo.src;
    } else if (typeof SPE_LOGO !== 'undefined' && SPE_LOGO) {
      logoSrc = SPE_LOGO;
    }
  } catch(e) {}
  let html = `<div class="welcome-inner">
    <img id="welcome-logo" src="${logoSrc}" style="width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.3);margin-bottom:18px;" alt="SPE">
    <div style="font-size:22px;font-weight:700;color:white;margin-bottom:4px;text-align:center;">Soccer Pro Experience</div>
    <div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:32px;text-align:center;">Classifiche e risultati in tempo reale</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:14px;text-align:center;text-transform:uppercase;letter-spacing:.08em;">Tornei in corso</div>
    <div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:340px;">`;

  torneiAttivi.forEach(t => {
    html += `<button class="welcome-torneo-btn" onclick="sceliTorneoWelcome(${t.id})">
      <div style="font-size:16px;font-weight:600;">${t.nome}</div>
      ${t.data ? `<div style="font-size:12px;opacity:.7;margin-top:2px;">${t.data}</div>` : ''}
      <svg style="position:absolute;right:16px;top:50%;transform:translateY(-50%);" width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M7 4l5 5-5 5" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>`;
  });

  html += `</div></div>`;
  screen.innerHTML = html;
  screen.style.display = 'flex';

  // Carica logo
  try {
    const logoImg = document.getElementById('welcome-logo');
    if (logoImg && window._SPE_LOGO) logoImg.src = window._SPE_LOGO;
  } catch(e) {}
}

async function sceliTorneoWelcome(torneoId) {
  try { localStorage.setItem('spe_torneo_id', torneoId); } catch(e) {}
  STATE.activeTorneo = torneoId;
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  await loadTorneo();
  subscribeRealtime(() => renderCurrentSection());
}

async function loadTorneo() {
  if (!STATE.activeTorneo) { renderTorneoBar(); renderCatBar(); renderCurrentSection(); return; }
  STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
  STATE.activeCat = STATE.categorie.length ? STATE.categorie[0].id : null;
  renderTorneoBar(); renderCatBar();
  await renderCurrentSection();
}

function renderTorneoBar() {
  const bar = document.getElementById('torneo-bar');
  const attivi = STATE.tornei.filter(t => t.attivo);
  if (attivi.length <= 1) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  bar.innerHTML = `<div class="torneo-bar-inner">${attivi.map(t =>
    `<button class="torneo-pill ${t.id===STATE.activeTorneo?'active':''}" onclick="selectTorneo(${t.id})">${t.nome}</button>`
  ).join('')}</div>`;
}

async function selectTorneo(id) {
  STATE.activeTorneo = id;
  try { localStorage.setItem('spe_torneo_id', id); } catch(e) {}
  await loadTorneo();
}

function updateHeader() {
  const t = STATE.tornei.find(t => t.id === STATE.activeTorneo);
  document.getElementById('header-title').textContent = t ? t.nome : 'Soccer Pro Experience';
  document.getElementById('header-date').textContent = t ? t.data || '' : '';
}

function showSection(name, btn) {
  STATE.currentSection = name;
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('cat-bar').style.display = ['a-setup','a-tornei'].includes(name) ? 'none' : '';
  if(name==='a-regolamento') document.getElementById('cat-bar').style.display='';
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
  else if (s === 'a-regolamento') await renderAdminRegolamento();
}

function renderCatBar() {
  const bar = document.getElementById('cat-bar');
  if (!STATE.categorie.length) { bar.innerHTML = ''; return; }
  bar.innerHTML = `<div class="cat-bar-inner">${STATE.categorie.map(c =>
    `<button class="cat-pill ${c.id===STATE.activeCat?'active':''}" onclick="selectCat(${c.id})">${c.nome}</button>`
  ).join('')}</div>`;
}

async function selectCat(id) { STATE.activeCat = id; renderCatBar(); renderCurrentSection(); }

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
  let ptsA=0,ptsB=0,gfA=0,gfB=0;
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
  // Prima aggiungi TUTTE le squadre del girone, anche quelle senza partite
  for (const sq of girone.squadre) {
    if (sq && sq.id) map[sq.id]={sq,g:0,v:0,p:0,s:0,gf:0,gs:0,pts:0};
  }
  // Poi aggiungi anche le squadre che compaiono nelle partite (per sicurezza)
  for (const p of girone.partite) {
    if (p.home && !map[p.home_id]) map[p.home_id]={sq:p.home,g:0,v:0,p:0,s:0,gf:0,gs:0,pts:0};
    if (p.away && !map[p.away_id]) map[p.away_id]={sq:p.away,g:0,v:0,p:0,s:0,gf:0,gs:0,pts:0};
  }
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
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria configurata.</div>'; return; }
  const cat = STATE.categorie.find(c=>c.id===STATE.activeCat);
  const gironi = await getGironiWithData(STATE.activeCat);
  if (!gironi.length) { el.innerHTML='<div class="empty-state">Nessun girone trovato.</div>'; return; }
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
    // Leggi spareggio dal regolamento
    let sparTxt = 'Spareggio: punti → scontro diretto → diff. reti → gol fatti → gol subiti → sorteggio/rigori';
    try {
      const reg = await getRegolamento(STATE.activeCat);
      if(reg?.spareggio_fase1) sparTxt = 'Spareggio: ' + reg.spareggio_fase1;
    } catch(e){}
    html+=`</tbody></table>
    <div style="font-size:11px;color:#aaa;margin-top:8px;padding-top:8px;border-top:1px solid #f5f5f5;">
      ${sparTxt}
    </div></div>`;

    // Classifica finale con coppa se tutte le partite sono giocate
    const totPartite = g.partite.length;
    const totGiocate = g.partite.filter(p=>p.giocata).length;
    if (totPartite > 0 && totGiocate === totPartite) {
      const oro = cl[0], argento = cl[1], bronzo = cl[2];
      html += `<div class="card" style="margin-top:8px;background:linear-gradient(135deg,#fffbe6,#fff8d6);border:1.5px solid #f0c040;">
        <div style="text-align:center;padding:8px 0 4px;">
          <div style="font-size:28px;">🏆</div>
          <div style="font-size:14px;font-weight:700;color:#7a5200;margin-top:2px;">CLASSIFICA FINALE — ${g.nome}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:12px;">
          ${oro ? `<div style="display:flex;align-items:center;gap:10px;background:#fff8d0;border-radius:10px;padding:10px 14px;">
            <span style="font-size:22px;">🥇</span>
            ${logoHTML(oro.sq,'md')}
            <span style="flex:1;font-size:15px;font-weight:700;color:#7a5200;">${oro.sq.nome}</span>
            <span style="font-size:13px;font-weight:600;color:#7a5200;">${oro.pts} pt</span>
          </div>` : ''}
          ${argento ? `<div style="display:flex;align-items:center;gap:10px;background:#f5f5f5;border-radius:10px;padding:10px 14px;">
            <span style="font-size:22px;">🥈</span>
            ${logoHTML(argento.sq,'md')}
            <span style="flex:1;font-size:15px;font-weight:600;color:#444;">${argento.sq.nome}</span>
            <span style="font-size:13px;font-weight:600;color:#444;">${argento.pts} pt</span>
          </div>` : ''}
          ${bronzo ? `<div style="display:flex;align-items:center;gap:10px;background:#fdf3ec;border-radius:10px;padding:10px 14px;">
            <span style="font-size:22px;">🥉</span>
            ${logoHTML(bronzo.sq,'md')}
            <span style="flex:1;font-size:15px;font-weight:600;color:#6b3a1f;">${bronzo.sq.nome}</span>
            <span style="font-size:13px;font-weight:600;color:#6b3a1f;">${bronzo.pts} pt</span>
          </div>` : ''}
        </div>
      </div>`;
    }
  }
  // Pulsante condividi WhatsApp
  const torneo = STATE.tornei.find(t => t.id === STATE.activeTorneo);
  const url = encodeURIComponent(window.location.href);
  const testo = encodeURIComponent(`🏆 ${torneo?.nome || 'Torneo'} — Segui classifiche e risultati in tempo reale!`);
  html += `<div style="text-align:center;margin:16px 0 8px;">
    <a href="https://wa.me/?text=${testo}%20${url}" target="_blank"
       style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:white;
              padding:10px 20px;border-radius:99px;text-decoration:none;font-size:14px;font-weight:600;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L0 24l6.335-1.658A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.57-.487-5.063-1.342l-.363-.215-3.761.985.999-3.662-.236-.374A9.94 9.94 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
      </svg>
      Condividi su WhatsApp
    </a>
  </div>`;

  el.innerHTML = html;
}

// ===== PUBLIC: RISULTATI =====
async function renderRisultati() {
  const el = document.getElementById('sec-risultati');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }
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
        const orario = p.orario ? `<span style="font-size:11px;color:#aaa;margin-right:6px;">${p.orario}${p.campo?' · '+p.campo:''}</span>` : '';
        html+=`<div class="match-result">
          <div class="match-team">${logoHTML(p.home,'sm')}<span>${p.home?.nome||'?'}</span></div>
          <div style="display:flex;flex-direction:column;align-items:center;">
            ${orario}
            <div class="match-score">${p.gol_home} — ${p.gol_away}</div>
          </div>
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
        const orario = p.orario ? `<span style="font-size:11px;color:#aaa;">${p.orario}${p.campo?' · '+p.campo:''}</span>` : '';
        html+=`<div class="match-result">
          <div class="match-team">${logoHTML(p.home,'sm')}<span>${p.home?.nome||'?'}</span></div>
          <div style="display:flex;flex-direction:column;align-items:center;">${orario}<div class="match-score pending">vs</div></div>
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

  // Raggruppa per round_name
  const rounds={};
  ko.forEach(m=>{if(!rounds[m.round_name])rounds[m.round_name]=[];rounds[m.round_name].push(m);});

  const roundOrder = ['PLATINO','GOLD','SILVER','BRONZO','WHITE',
    'Quarti di finale','Semifinali','3° posto','Finale','5° posto','7° posto',
    'Consolazione semifinali','Consolazione finale','Consolazione 3° posto'];
  const sorted = Object.keys(rounds).sort((a,b)=>{
    const ia=roundOrder.indexOf(a), ib=roundOrder.indexOf(b);
    return (ia===-1?99:ia)-(ib===-1?99:ib);
  });

  const roundColors = {
    'PLATINO':'#1A3A6B','GOLD':'#7a5200','SILVER':'#555','BRONZO':'#6B2A00','WHITE':'#1A6B3A'
  };
  const roundBg = {
    'PLATINO':'#EBF3FB','GOLD':'#FFF9C4','SILVER':'#F0F0F0','BRONZO':'#FDF3EC','WHITE':'#EBF7EF'
  };

  let html = '';
  for (const rname of sorted) {
    const matches = rounds[rname];
    const color = roundColors[rname] || '#1A3A6B';
    const bg = roundBg[rname] || '#f5f5f5';
    const isTriangolare = ['PLATINO','GOLD','SILVER','BRONZO','WHITE'].includes(rname);

    html += `<div style="margin-bottom:16px;">
      <div style="background:${color};color:white;padding:8px 14px;border-radius:10px 10px 0 0;font-weight:700;font-size:14px;">
        ${rname === 'PLATINO' ? '🥇' : rname === 'GOLD' ? '🥈' : rname === 'SILVER' ? '🥉' : rname === 'BRONZO' ? '4°' : rname === 'WHITE' ? '5°' : '🏆'} ${rname}
      </div>
      <div style="background:${bg};border-radius:0 0 10px 10px;padding:10px;">`;

    if (isTriangolare) {
      // Calcola classifica del triangolare
      const sqIds = [...new Set(matches.flatMap(m=>[m.home_id,m.away_id]).filter(Boolean))];
      const clMap={};
      sqIds.forEach(id=>{clMap[id]={sq:sqMap[id],g:0,v:0,p:0,s:0,gf:0,gs:0,pts:0};});
      matches.forEach(m=>{
        if(!m.giocata) return;
        const h=clMap[m.home_id], a=clMap[m.away_id];
        if(!h||!a) return;
        h.g++;a.g++;h.gf+=m.gol_home;h.gs+=m.gol_away;a.gf+=m.gol_away;a.gs+=m.gol_home;
        if(m.gol_home>m.gol_away){h.v++;h.pts+=3;a.s++;}
        else if(m.gol_home<m.gol_away){a.v++;a.pts+=3;h.s++;}
        else{h.p++;h.pts++;a.p++;a.pts++;}
      });
      const cl=Object.values(clMap).sort((a,b)=>{
        if(b.pts!==a.pts) return b.pts-a.pts;
        const da=a.gf-a.gs, db=b.gf-b.gs;
        if(db!==da) return db-da;
        return b.gf-a.gf;
      });
      const giocate=matches.filter(m=>m.giocata).length;
      html+=`<div style="font-size:11px;color:#888;margin-bottom:8px;">${giocate}/${matches.length} partite</div>`;
      html+=`<table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="color:#888;font-size:11px;">
          <th style="text-align:left;padding:3px 4px;">Squadra</th>
          <th style="text-align:center;padding:3px 4px;">G</th>
          <th style="text-align:center;padding:3px 4px;">V</th>
          <th style="text-align:center;padding:3px 4px;">P</th>
          <th style="text-align:center;padding:3px 4px;">S</th>
          <th style="text-align:center;padding:3px 4px;">GD</th>
          <th style="text-align:center;padding:3px 4px;font-weight:700;color:${color};">Pt</th>
        </tr></thead><tbody>`;
      cl.forEach((row,idx)=>{
        const diff=row.gf-row.gs;
        html+=`<tr style="border-top:1px solid rgba(0,0,0,0.05);">
          <td style="padding:5px 4px;display:flex;align-items:center;gap:6px;">
            <span style="font-weight:700;color:${color};width:16px;">${idx+1}°</span>
            ${logoHTML(row.sq,'sm')} ${row.sq?.nome||'?'}
          </td>
          <td style="text-align:center;padding:5px 4px;">${row.g}</td>
          <td style="text-align:center;padding:5px 4px;">${row.v}</td>
          <td style="text-align:center;padding:5px 4px;">${row.p}</td>
          <td style="text-align:center;padding:5px 4px;">${row.s}</td>
          <td style="text-align:center;padding:5px 4px;color:${diff>0?'#2e7d32':diff<0?'#c62828':'#888'}">${diff>0?'+':''}${diff}</td>
          <td style="text-align:center;padding:5px 4px;font-weight:700;color:${color};">${row.pts}</td>
        </tr>`;
      });
      html+=`</tbody></table>`;
      // Risultati
      const giocateFull=matches.filter(m=>m.giocata);
      if(giocateFull.length){
        html+=`<div style="margin-top:10px;font-size:11px;color:#888;font-weight:600;margin-bottom:4px;">RISULTATI</div>`;
        giocateFull.forEach(m=>{
          const hm=sqMap[m.home_id], am=sqMap[m.away_id];
          html+=`<div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;padding:3px 0;border-top:1px solid rgba(0,0,0,0.05);">
            <span>${hm?.nome||'?'}</span>
            <span style="font-weight:700;color:${color};padding:0 8px;">${m.gol_home} — ${m.gol_away}</span>
            <span>${am?.nome||'?'}</span>
          </div>`;
        });
      }
      // Partite da giocare
      const daGiocare=matches.filter(m=>!m.giocata);
      if(daGiocare.length){
        html+=`<div style="margin-top:8px;font-size:11px;color:#888;font-weight:600;margin-bottom:4px;">DA GIOCARE</div>`;
        daGiocare.forEach(m=>{
          const hm=sqMap[m.home_id], am=sqMap[m.away_id];
          html+=`<div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;padding:3px 0;border-top:1px solid rgba(0,0,0,0.05);color:#aaa;">
            <span>${hm?.nome||'?'}</span>
            <span style="padding:0 8px;">vs</span>
            <span>${am?.nome||'?'}</span>
          </div>`;
        });
      }
    } else {
      // Formato bracket normale
      matches.forEach(m=>{
        const hm=m.home_id?sqMap[m.home_id]:null, am=m.away_id?sqMap[m.away_id]:null;
        const w1=m.giocata&&m.gol_home>m.gol_away, w2=m.giocata&&m.gol_away>m.gol_home;
        const hmNome=hm?hm.nome:(m.note_home||'TBD'), amNome=am?am.nome:(m.note_away||'TBD');
        html+=`<div class="ko-match">
          <div class="ko-team-row ${w1?'winner':''}">${logoHTML(hm,'sm')}<span style="flex:1;">${hmNome}</span>${m.giocata?`<span class="ko-score">${m.gol_home}</span>`:''}</div>
          <div class="ko-sep"></div>
          <div class="ko-team-row ${w2?'winner':''}">${logoHTML(am,'sm')}<span style="flex:1;">${amNome}</span>${m.giocata?`<span class="ko-score">${m.gol_away}</span>`:''}</div>
        </div>`;
      });
    }
    html+=`</div></div>`;
  }

  // Leggenda spareggio
  html+=`<div style="font-size:11px;color:#aaa;padding:8px 4px;">
    Spareggio: punti → scontro diretto → diff. reti → gol fatti → rigori
  </div>`;

  el.innerHTML=html;
}

// ===== ADMIN: TORNEI =====
async function renderAdminTornei() {
  const el = document.getElementById('sec-a-tornei');
  STATE.tornei = await dbGetTornei();
  let html = `<div class="section-label">Tornei</div>`;
  if (!STATE.tornei.length) html += `<div class="empty-state">Nessun torneo. Creane uno!</div>`;
  for (const t of STATE.tornei) {
    html += `<div class="card"><div class="card-title">
      <div style="display:flex;align-items:center;gap:8px;">
        <div><div style="font-weight:600;">${t.nome}</div><div style="font-size:12px;color:#aaa;">${t.data||'Data non impostata'}</div></div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <span class="badge ${t.attivo?'badge-green':'badge-gray'}">${t.attivo?'Attivo':'Archiviato'}</span>
        <button class="btn btn-sm ${t.attivo?'':'btn-p'}" onclick="toggleTorneo(${t.id},${t.attivo})">${t.attivo?'Archivia':'Riattiva'}</button>
        <button class="btn btn-sm" onclick="editTorneo(${t.id})">Modifica</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTorneo(${t.id})">Elimina</button>
      </div></div></div>`;
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
  const nome=document.getElementById('new-t-nome').value.trim();
  const data=document.getElementById('new-t-data').value.trim();
  if(!nome){alert('Inserisci il nome');return;}
  const t=await dbSaveTorneo({nome,data,attivo:true});
  STATE.tornei=await dbGetTornei(); STATE.activeTorneo=t.id;
  await loadTorneo(); toast('Torneo creato!'); await renderAdminTornei();
}
async function toggleTorneo(id,attivo){
  await dbUpdateTorneo(id,{attivo:!attivo});
  STATE.tornei=await dbGetTornei(); await renderAdminTornei();
  toast(attivo?'Torneo archiviato':'Torneo riattivato');
}
async function deleteTorneo(id){
  if(!confirm('Eliminare questo torneo e tutti i suoi dati?')) return;
  await dbDeleteTorneo(id);
  STATE.tornei=await dbGetTornei();
  STATE.activeTorneo=STATE.tornei.find(t=>t.attivo)?.id||STATE.tornei[0]?.id||null;
  await loadTorneo(); await renderAdminTornei(); toast('Torneo eliminato');
}
async function editTorneo(id){
  const t=STATE.tornei.find(x=>x.id===id);
  const nome=prompt('Nome torneo:',t.nome); if(!nome) return;
  const data=prompt('Data:',t.data||'');
  await dbUpdateTorneo(id,{nome,data});
  STATE.tornei=await dbGetTornei(); updateHeader(); renderTorneoBar();
  await renderAdminTornei(); toast('Torneo aggiornato');
}

// ===== ADMIN: CATEGORIE =====
async function renderAdminSetup() {
  const el = document.getElementById('sec-a-setup');
  if (!STATE.activeTorneo) { el.innerHTML='<div class="empty-state">Crea prima un torneo.</div>'; return; }
  const t = STATE.tornei.find(x=>x.id===STATE.activeTorneo);
  const tutteSquadre = await dbGetSquadre(STATE.activeTorneo);

  let html = `<div style="background:#e3f0fb;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
    <div style="font-size:13px;color:#0c447c;">Torneo attivo: <strong>${t?.nome||'?'}</strong></div>
    <button class="btn" style="background:#27ae60;color:white;border-color:#27ae60;font-weight:500;" onclick="esportaExcel()">↓ Scarica Excel</button>
  </div>`;

  if (tutteSquadre.length) {
    html += `<div class="section-label">Squadre caricate (${tutteSquadre.length} totali)</div>
    <div class="card" style="margin-bottom:14px;"><div style="display:flex;flex-wrap:wrap;gap:6px;">`;
    tutteSquadre.forEach(sq => {
      html += `<span style="display:inline-flex;align-items:center;gap:5px;background:#f0f6ff;border:1px solid #c5ddf5;border-radius:99px;padding:3px 10px;font-size:12px;color:#185FA5;">${logoHTML(sq,'sm')} ${sq.nome}</span>`;
    });
    html += `</div></div>`;
  }

  html += `<div class="section-label">Categorie configurate</div>`;
  if (!STATE.categorie.length) html += `<div style="color:#aaa;font-size:13px;padding:8px 0 12px;">Nessuna categoria. Aggiungine una o importa da Excel.</div>`;

  for (const cat of STATE.categorie) {
    const gironi = await dbGetGironi(cat.id);
    let totP=0, totG=0;
    for (const g of gironi) {
      const pp = await dbGetPartite(g.id);
      totP+=pp.length; totG+=pp.filter(p=>p.giocata).length;
    }
    html += `<div class="card" style="margin-bottom:10px;">
      <div class="card-title" style="margin-bottom:10px;">
        <div style="font-size:15px;font-weight:600;">${cat.nome}</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="badge badge-blue">Top ${cat.qualificate||2} si qualificano</span>
          <span class="badge badge-gray">${totG}/${totP} partite</span>
          <button class="btn btn-danger btn-sm" onclick="deleteCat(${cat.id})">Elimina</button>
        </div>
      </div>`;
    for (const g of gironi) {
      const members = await dbGetGironeSquadre(g.id);
      html += `<div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">${g.nome}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">`;
      members.forEach(m => {
        html += `<span style="display:inline-flex;align-items:center;gap:4px;background:#f5f5f5;border-radius:99px;padding:2px 8px;font-size:12px;">${logoHTML(m.squadre,'sm')} ${m.squadre.nome}</span>`;
      });
      html += `</div></div>`;
    }
    html += `</div>`;
  }

  html += `<div class="section-label">Aggiungi categoria manualmente</div>
  <div class="card">
    <div class="form-grid-2">
      <div class="form-group"><label class="form-label">Nome (es. Under 12)</label>
        <input class="form-input" id="cname" placeholder="Under 10"></div>
      <div class="form-group"><label class="form-label">Si qualificano (prime N)</label>
        <select class="form-input" id="cqualify"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Squadre — una riga per girone, separate da virgola</label>
      <textarea class="form-input" id="cteams" rows="4" placeholder="Girone A: Milan, Inter, Juve, Roma&#10;Girone B: Napoli, Fiorentina, Lazio, Torino"></textarea></div>
    <button class="btn btn-p" style="width:100%;" onclick="addCategoria()">+ Aggiungi categoria</button>
  </div>

  <div class="section-label">Importa da Excel</div>
  <div class="card">
    <div style="font-size:13px;color:#555;margin-bottom:12px;">Carica il file Excel compilato con il modello SPE — importa automaticamente categorie, gironi, squadre, orari e fase finale.</div>
    <label style="display:inline-flex;align-items:center;gap:8px;background:#185FA5;color:white;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
      📂 Seleziona file Excel
      <input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importaExcel(event)">
    </label>
    <span style="font-size:12px;color:#aaa;margin-left:8px;">Formati supportati: .xlsx .xls</span>
    <div id="import-preview"></div>
  </div>`;

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
  renderCatBar(); toast('Categoria aggiunta!'); await renderAdminSetup();
}

async function deleteCat(id){
  if(!confirm('Eliminare questa categoria?')) return;
  await dbDeleteCategoria(id);
  STATE.categorie=await dbGetCategorie(STATE.activeTorneo);
  STATE.activeCat=STATE.categorie[0]?.id||null;
  renderCatBar(); await renderAdminSetup();
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
      <div class="logo-upload-btn">${logoHTML(sq,'md')}
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
      const key='p'+p.id; const open=!!openScorers[key];
      let badge='';
      if(p.giocata){
        if(p.gol_home>p.gol_away) badge=`<span class="badge badge-green">${p.home?.nome} vince</span>`;
        else if(p.gol_home<p.gol_away) badge=`<span class="badge badge-green">${p.away?.nome} vince</span>`;
        else badge=`<span class="badge badge-blue">Pareggio</span>`;
      }
      const orInfo = p.orario ? `<span style="font-size:11px;color:#888;">${p.orario}${p.campo?' · '+p.campo:''}</span>` : '';
      html+=`<div class="admin-match" id="match-row-${p.id}"><div class="admin-match-header">
        <div class="admin-team-name">${logoHTML(p.home,'sm')}<span>${p.home?.nome||'?'}</span></div>
        <input class="score-input" type="number" min="0" max="30" value="${p.giocata?p.gol_home:''}" placeholder="—" id="sh_${p.id}">
        <span class="score-dash">—</span>
        <input class="score-input" type="number" min="0" max="30" value="${p.giocata?p.gol_away:''}" placeholder="—" id="sa_${p.id}">
        <div class="admin-team-name right"><span>${p.away?.nome||'?'}</span>${logoHTML(p.away,'sm')}</div>
        <div class="match-actions">
          ${orInfo}
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
          <div style="margin-top:10px;"><button class="btn btn-success btn-sm" onclick="saveMarcatori(${p.id},${g.id})">Salva marcatori</button></div></div>`;
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
  // Disabilita il pulsante per evitare doppi click
  const btn=document.querySelector(`button[onclick="saveRisultato(${partita_id},${girone_id})"]`);
  if(btn){btn.disabled=true;btn.textContent='...';}
  try{
    const result=await dbSavePartita({id:partita_id,girone_id,gol_home:parseInt(sh),gol_away:parseInt(sa),giocata:true});
    if(result){
      toast('✓ Salvato!');
      // Aggiorna solo la riga della partita, non tutto
      const row=document.getElementById('match-row-'+partita_id);
      if(row){
        row.style.background='#e8f5e9';
        setTimeout(()=>{if(row)row.style.background='';},2000);
      }
      if(btn){btn.disabled=false;btn.textContent='✓ Conferma';}
    } else {
      toast('Errore nel salvataggio');
      if(btn){btn.disabled=false;btn.textContent='✓ Conferma';}
    }
  }catch(e){
    console.error(e);
    toast('Errore: '+(e.message||'sconosciuto'));
    if(btn){btn.disabled=false;btn.textContent='✓ Conferma';}
  }
}

function toggleScorers(key){openScorers[key]=!openScorers[key];renderAdminRisultati();}
let tempMarcatori={};
function addMarcatore(partita_id){if(!tempMarcatori[partita_id])tempMarcatori[partita_id]=[];tempMarcatori[partita_id].push({});renderAdminRisultati();}
function removeMarcatore(partita_id,idx){if(!tempMarcatori[partita_id])tempMarcatori[partita_id]=[];tempMarcatori[partita_id].splice(idx,1);renderAdminRisultati();}
async function saveMarcatori(partita_id,girone_id){
  const gironi=await getGironiWithData(STATE.activeCat);
  let partita=null;
  for(const g of gironi) for(const p of g.partite) if(p.id===partita_id) partita=p;
  if(!partita) return;
  const all=[];
  for(let i=0;i<(partita.marcatori||[]).length;i++){
    const sqEl=document.getElementById(`msq_${partita_id}_${i}`);
    const nmEl=document.getElementById(`mnm_${partita_id}_${i}`);
    const mnEl=document.getElementById(`mmin_${partita_id}_${i}`);
    if(sqEl&&nmEl&&nmEl.value.trim()) all.push({squadra_id:parseInt(sqEl.value),nome:nmEl.value.trim(),minuto:mnEl?mnEl.value||null:null});
  }
  await dbSaveMarcatori(partita_id,all.filter(m=>m.nome));
  delete tempMarcatori[partita_id]; openScorers['p'+partita_id]=false;
  toast('Marcatori salvati'); await renderAdminRisultati();
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
      ${logoHTML(q.sq,'sm')}<span class="badge ${q.pos===1?'badge-green':'badge-blue'}">${q.pos}°</span>
      <span style="flex:1;">${q.sq.nome}</span><span style="color:#aaa;font-size:12px;">${q.girone} · ${q.pts} pt</span></div>`;
  });
  html+=`</div>`;
  if(consolazione.length){
    html+=`<div class="section-label">Non qualificate</div><div class="card" style="margin-bottom:14px;">`;
    consolazione.forEach(q=>{
      html+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:13px;">
        ${logoHTML(q.sq,'sm')}<span class="badge badge-gray">${q.pos}°</span>
        <span style="flex:1;">${q.sq.nome}</span><span style="color:#aaa;font-size:12px;">${q.girone} · ${q.pts} pt</span></div>`;
    });
    html+=`</div>`;
  }
  const allSq=[...qualificate,...consolazione];
  const sqOptions=allSq.map(q=>`<option value="${q.sq.id}">${q.sq.nome} (${q.girone} ${q.pos}°)</option>`).join('');
  // Pulsante genera fase 2 automatica
  const allGironiCompleti = gironi.every(g => g.partite.length > 0 && g.partite.every(p => p.giocata));
  if (allGironiCompleti && gironi.length >= 2) {
    html+=`<div class="card" style="background:linear-gradient(135deg,#e8f5e9,#f1f8e9);border:1.5px solid #66bb6a;margin-bottom:14px;">
      <div style="font-size:14px;font-weight:700;color:#2e7d32;margin-bottom:6px;">✨ Fase 1 completata!</div>
      <div style="font-size:13px;color:#555;margin-bottom:12px;">Tutte le partite sono state giocate. Puoi generare automaticamente gli accoppiamenti della Fase 2.</div>
      <button class="btn" style="background:#2e7d32;color:white;font-weight:600;width:100%;padding:10px;" 
        onclick="generaFase2()">⚡ Genera Fase 2 automaticamente</button>
    </div>`;
  }

  html+=`<div class="section-label">Aggiungi partita al tabellone</div>
  <div class="card" style="margin-bottom:14px;">
    <div class="form-grid-2" style="margin-bottom:10px;">
      <div><div class="form-label">Round</div><select class="form-input" id="new-round-name">
        <option>Quarti di finale</option><option>Semifinali</option><option>3° posto</option><option>Finale</option>
        <option>5° posto</option><option>7° posto</option><option>Consolazione semifinali</option>
        <option>Consolazione finale</option><option>Consolazione 3° posto</option></select></div>
      <div><div class="form-label">Tipo</div><select class="form-input" id="new-round-type">
        <option value="0">Tabellone principale</option><option value="1">Consolazione</option></select></div>
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
    const sorted=Object.keys(rounds).sort((a,b)=>(order.indexOf(a)===-1?99:order.indexOf(a))-(order.indexOf(b)===-1?99:order.indexOf(b)));
    let h=`<div class="section-label">${label} <button class="btn btn-sm btn-danger" style="margin-left:8px;" onclick="resetKOSection(${matches[0].is_consolazione?1:0})">Cancella tutto</button></div>`;
    for(const rname of sorted){
      h+=`<div style="font-size:12px;font-weight:600;color:#555;margin:10px 0 6px;text-transform:uppercase;letter-spacing:.04em;">${rname}</div>`;
      for(const m of rounds[rname]){
        const hm=m.home_id?sqMap[m.home_id]:null, am=m.away_id?sqMap[m.away_id]:null;
        const hmNome=hm?hm.nome:(m.note_home||'TBD'), amNome=am?am.nome:(m.note_away||'TBD');
        let badge='';
        if(m.giocata){
          if(m.gol_home>m.gol_away) badge=`<span class="badge badge-green">${hmNome} vince</span>`;
          else if(m.gol_home<m.gol_away) badge=`<span class="badge badge-green">${amNome} vince</span>`;
          else badge=`<span class="badge badge-blue">Pareggio</span>`;
        }
        h+=`<div class="admin-match"><div class="admin-match-header">
          <div class="admin-team-name">${logoHTML(hm,'sm')}<span>${hmNome}</span></div>
          <input class="score-input" type="number" min="0" value="${m.giocata?m.gol_home:''}" placeholder="—" id="ksh_${m.id}">
          <span class="score-dash">—</span>
          <input class="score-input" type="number" min="0" value="${m.giocata?m.gol_away:''}" placeholder="—" id="ksa_${m.id}">
          <div class="admin-team-name right"><span>${amNome}</span>${logoHTML(am,'sm')}</div>
          <div class="match-actions">
            <button class="btn btn-p btn-sm" onclick="saveKO(${m.id})">✓ Conferma</button>
            ${badge}
            <button class="btn btn-danger btn-sm" onclick="deleteKOMatch(${m.id})">✕</button>
          </div></div></div>`;
      }
    }
    return h;
  };
  html+=renderKOSection(ko.filter(m=>!m.is_consolazione),'Tabellone principale');
  html+=renderKOSection(ko.filter(m=>m.is_consolazione),'Consolazione');
  el.innerHTML=html;
}

async function addKOMatch(){
  const round_name=document.getElementById('new-round-name').value;
  const is_consolazione=document.getElementById('new-round-type').value==='1';
  const home_id=parseInt(document.getElementById('new-home').value);
  const away_id=parseInt(document.getElementById('new-away').value);
  if(home_id===away_id){toast('Seleziona due squadre diverse');return;}
  const ko=await dbGetKnockout(STATE.activeCat);
  const order=['Quarti di finale','Semifinali','3° posto','Finale','5° posto','7° posto','Consolazione semifinali','Consolazione finale','Consolazione 3° posto'];
  await dbSaveKnockoutMatch({categoria_id:STATE.activeCat,round_name,round_order:order.indexOf(round_name),match_order:ko.filter(m=>m.round_name===round_name).length,home_id,away_id,gol_home:0,gol_away:0,giocata:false,is_consolazione});
  toast('Partita aggiunta!'); await renderAdminKnockout();
}
async function saveKO(match_id){
  const sh=document.getElementById('ksh_'+match_id).value;
  const sa=document.getElementById('ksa_'+match_id).value;
  if(sh===''||sa===''){toast('Inserisci i gol');return;}
  const ko=await dbGetKnockout(STATE.activeCat);
  const m=ko.find(x=>x.id===match_id); if(!m) return;
  await dbSaveKnockoutMatch({...m,gol_home:parseInt(sh),gol_away:parseInt(sa),giocata:true});
  toast('✓ Risultato salvato'); await renderAdminKnockout();
}
async function deleteKOMatch(match_id){
  if(!confirm('Eliminare questa partita?')) return;
  await db.from('knockout').delete().eq('id',match_id);
  toast('Eliminata'); await renderAdminKnockout();
}
async function resetKOSection(is_consolazione){
  if(!confirm('Eliminare tutte le partite di questa sezione?')) return;
  const ko=await dbGetKnockout(STATE.activeCat);
  for(const m of ko.filter(x=>x.is_consolazione===!!is_consolazione)) await db.from('knockout').delete().eq('id',m.id);
  toast('Sezione eliminata'); await renderAdminKnockout();
}

// ===== AUTH =====
function toggleAdmin(){
  if(STATE.isAdmin){exitAdmin();return;}
  // Controlla sessione salvata
  try { if(localStorage.getItem('spe_admin_ok')==='1'){enterAdmin();return;} } catch(e){}
  document.getElementById('admin-modal').style.display='flex';
  // Ripristina credenziali salvate se presenti
  try {
    const saved = JSON.parse(localStorage.getItem('spe_admin_creds') || 'null');
    if(saved) {
      const userEl = document.getElementById('admin-user');
      const pwEl = document.getElementById('admin-pw');
      const remEl = document.getElementById('admin-remember');
      if(userEl) userEl.value = saved.u || '';
      if(pwEl) pwEl.value = saved.p || '';
      if(remEl) remEl.checked = true;
    }
  } catch(e){}
  setTimeout(()=>{
    const userEl = document.getElementById('admin-user');
    if(userEl && !userEl.value) userEl.focus();
    else document.getElementById('admin-pw')?.focus();
  },100);
}

function checkPw(){
  const pw = document.getElementById('admin-pw').value;
  const user = document.getElementById('admin-user')?.value?.trim() || '';
  const remember = document.getElementById('admin-remember')?.checked || false;
  // Accetta sia solo password (vecchio stile) che username+password
  const ok = pw===CONFIG.ADMIN_PASSWORD ||
             (CONFIG.USERS||[]).some(u=>u.password===pw) ||
             (user && (CONFIG.USERS||[]).some(u=>u.username.toLowerCase()===user.toLowerCase()&&u.password===pw));
  if(ok){
    document.getElementById('admin-modal').style.display='none';
    document.getElementById('admin-pw').value='';
    document.getElementById('pw-error').textContent='';
    try{
      if(remember) {
        // Salva credenziali cifrate (base64 semplice)
        localStorage.setItem('spe_admin_creds', JSON.stringify({u:user,p:btoa(pw)}));
        localStorage.setItem('spe_admin_ok','1');
      } else {
        // Salva solo sessione temporanea (senza credenziali)
        localStorage.removeItem('spe_admin_creds');
        localStorage.setItem('spe_admin_ok','1');
      }
    }catch(e){}
    enterAdmin();
  } else document.getElementById('pw-error').textContent='Username o password errati';
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
  try{
    localStorage.removeItem('spe_admin_ok');
    // NON rimuovere spe_admin_creds se l'utente ha scelto "Ricorda accesso"
  }catch(e){}
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
  t.textContent=msg; t.style.display='block';
  clearTimeout(t._timer); t._timer=setTimeout(()=>t.style.display='none',2500);
}

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script'); s.src=src;
    s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  // Carica logo SPE nella welcome screen
  try {
    const logoImg = document.getElementById('welcome-logo');
    if (logoImg && typeof SPE_LOGO !== 'undefined') {
      logoImg.src = SPE_LOGO;
    }
    // Anche loading screen
    const loadImg = document.getElementById('loading-img');
    if (loadImg && typeof SPE_LOGO !== 'undefined') {
      loadImg.src = SPE_LOGO;
    }
    // Header
    const headerLogo = document.getElementById('header-logo');
    if (headerLogo && typeof SPE_LOGO !== 'undefined') {
      headerLogo.src = SPE_LOGO;
    }
  } catch(e) {}
  init();
});

// ===== GENERA FASE 2 AUTOMATICA =====
async function generaFase2() {
  if (!STATE.activeCat) return;
  if (!confirm('Generare automaticamente gli accoppiamenti della Fase 2? Le partite esistenti verranno cancellate.')) return;

  const cat = STATE.categorie.find(c => c.id === STATE.activeCat);
  const gironi = await getGironiWithData(STATE.activeCat);
  const squadre = await dbGetSquadre(STATE.activeTorneo);
  const sqMap = {}; squadre.forEach(s => sqMap[s.id] = s);

  // Calcola classifiche per ogni girone
  const classifiche = gironi.map(g => calcGironeClassifica(g));

  // Estrai squadre per posizione
  // pos 0 = 1°, 1 = 2°, ecc.
  const getSquadraPos = (pos) => {
    return gironi.map((g, gi) => {
      const cl = classifiche[gi];
      return cl[pos] ? cl[pos].sq : null;
    }).filter(Boolean);
  };

  const prime   = getSquadraPos(0); // 1° di ogni girone → PLATINO
  const seconde = getSquadraPos(1); // 2° → GOLD
  const terze   = getSquadraPos(2); // 3° → SILVER
  const quarte  = getSquadraPos(3); // 4° → BRONZO
  const quinte  = getSquadraPos(4); // 5° → WHITE

  // Cancella fase finale esistente
  await dbDeleteKnockout(cat.id);

  const order = ['PLATINO','GOLD','SILVER','BRONZO','WHITE'];
  const gruppi = [prime, seconde, terze, quarte, quinte];
  const tipi = ['principale','principale','consolazione','consolazione','consolazione'];

  let matchOrder = 0;

  // Per ogni gruppo crea il triangolare (tutti vs tutti = 3 partite)
  for (let gi = 0; gi < gruppi.length; gi++) {
    const gruppo = gruppi[gi];
    const roundName = order[gi];
    const isConsolazione = tipi[gi] === 'consolazione';

    if (gruppo.length < 2) continue;

    matchOrder = 0;
    // Triangolare: tutti vs tutti
    for (let i = 0; i < gruppo.length; i++) {
      for (let j = i + 1; j < gruppo.length; j++) {
        await dbSaveKnockoutMatch({
          categoria_id: cat.id,
          round_name: roundName,
          round_order: gi,
          match_order: matchOrder++,
          home_id: gruppo[i].id,
          away_id: gruppo[j].id,
          gol_home: 0,
          gol_away: 0,
          giocata: false,
          is_consolazione: isConsolazione,
          note_home: null,
          note_away: null,
        });
      }
    }
  }

  toast('✅ Fase 2 generata! ' + prime.length + ' gironi per gruppo');
  await renderAdminKnockout();
}

// ============================================================
//  ADMIN: REGOLAMENTO
// ============================================================
async function renderAdminRegolamento() {
  const el = document.getElementById('sec-a-regolamento');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Seleziona una categoria dalla barra in alto.</div>'; return; }
  const cat = STATE.categorie.find(c => c.id === STATE.activeCat);
  const gironi = await getGironiWithData(STATE.activeCat);

  // Carica regolamento esistente
  const { data: reg } = await db.from('regolamento').select('*').eq('categoria_id', STATE.activeCat).single().catch(() => ({data:null}));
  const r = reg || {
    spareggio_fase1: 'Punti → Scontro diretto → Differenza reti → Gol fatti → Gol subiti → Sorteggio/Rigori',
    spareggio_fase2: 'Punti → Scontro diretto → Differenza reti → Gol fatti → Rigori',
    testo_libero: '',
    accoppiamenti: []
  };
  const accoppiamenti = typeof r.accoppiamenti === 'string' ? JSON.parse(r.accoppiamenti) : (r.accoppiamenti || []);

  // Calcola classifiche attuali
  const classifiche = {};
  for (const g of gironi) classifiche[g.id] = calcGironeClassifica(g);

  let html = `<div style="background:#e3f0fb;border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:13px;color:#0c447c;">
    Categoria: <strong>${cat?.nome||'?'}</strong></div>`;

  // ===== SPAREGGIO FASE 1 =====
  html += `<div class="section-label">Criteri spareggio Fase 1 (gironi)</div>
  <div class="card">
    <div style="font-size:12px;color:#888;margin-bottom:8px;">Separati da →</div>
    <textarea class="form-input" id="reg-spar1" rows="2" style="font-size:13px;">${r.spareggio_fase1}</textarea>
  </div>`;

  // ===== SPAREGGIO FASE 2 =====
  html += `<div class="section-label">Criteri spareggio Fase 2 (triangolari/finale)</div>
  <div class="card">
    <div style="font-size:12px;color:#888;margin-bottom:8px;">Separati da →</div>
    <textarea class="form-input" id="reg-spar2" rows="2" style="font-size:13px;">${r.spareggio_fase2}</textarea>
  </div>`;

  // ===== ACCOPPIAMENTI FASE 2 =====
  html += `<div class="section-label">Accoppiamenti Fase 2</div>
  <div class="card">
    <div style="font-size:12px;color:#555;margin-bottom:12px;">
      Definisci chi si qualifica e dove. Es: "1° Girone A" va nel gruppo PLATINO.<br>
      Il sistema userà le classifiche reali per assegnare le squadre.
    </div>`;

  // Classifiche attuali per riferimento
  html += `<div style="margin-bottom:14px;">
    <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;margin-bottom:6px;">Classifiche attuali:</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;">`;
  for (const g of gironi) {
    const cl = classifiche[g.id];
    html += `<div style="background:#f5f5f5;border-radius:8px;padding:8px 12px;font-size:12px;">
      <div style="font-weight:600;color:#333;margin-bottom:4px;">${g.nome}</div>`;
    cl.slice(0,5).forEach((row,idx) => {
      html += `<div style="color:#555;">${idx+1}° ${row.sq.nome} <span style="color:#aaa;">${row.pts}pt</span></div>`;
    });
    html += `</div>`;
  }
  html += `</div></div>`;

  // Lista accoppiamenti
  html += `<div id="accoppiamenti-list">`;
  accoppiamenti.forEach((acc, idx) => {
    html += `<div class="scorer-row" style="margin-bottom:6px;">
      <input placeholder="Nome gruppo (es. PLATINO)" value="${acc.gruppo||''}" id="acc-gruppo-${idx}" style="flex:1;min-width:100px;">
      <input placeholder="Posizione (es. 1° Girone A)" value="${acc.posizione||''}" id="acc-pos-${idx}" style="flex:2;min-width:150px;">
      <select id="acc-tipo-${idx}" style="min-width:120px;">
        <option value="principale" ${acc.tipo==='principale'?'selected':''}>Principale</option>
        <option value="consolazione" ${acc.tipo==='consolazione'?'selected':''}>Consolazione</option>
      </select>
      <button class="btn btn-danger btn-sm" onclick="rimuoviAccoppiamento(${idx})">✕</button>
    </div>`;
  });
  html += `</div>
  <button class="btn" style="margin-top:8px;width:100%;" onclick="aggiungiAccoppiamento()">+ Aggiungi accoppiamento</button>
  </div>`;

  // ===== TESTO LIBERO =====
  html += `<div class="section-label">Testo libero regolamento</div>
  <div class="card">
    <textarea class="form-input" id="reg-testo" rows="5" placeholder="Inserisci qui il regolamento completo del torneo...">${r.testo_libero||''}</textarea>
  </div>`;

  // ===== SALVA =====
  html += `<button class="btn btn-p" style="width:100%;padding:12px;font-size:14px;" onclick="salvaRegolamento()">
    💾 Salva regolamento
  </button>`;

  // ===== ANTEPRIMA PUBBLICA =====
  html += `<div class="section-label" style="margin-top:20px;">Anteprima pubblica</div>
  <div class="card" style="background:#f9f9f9;">
    <div style="font-size:11px;color:#aaa;margin-bottom:6px;">Così apparirà in classifica:</div>
    <div style="font-size:12px;color:#666;padding:8px;background:white;border-radius:6px;border:1px solid #eee;">
      Spareggio fase 1: <em>${r.spareggio_fase1}</em>
    </div>
    ${r.testo_libero ? `<div style="font-size:12px;color:#555;margin-top:10px;white-space:pre-wrap;">${r.testo_libero}</div>` : ''}
  </div>`;

  el.innerHTML = html;

  // Store accoppiamenti count for add/remove
  window._accCount = accoppiamenti.length;
}

function aggiungiAccoppiamento() {
  window._accCount = (window._accCount || 0) + 1;
  const list = document.getElementById('accoppiamenti-list');
  if (!list) return;
  const idx = window._accCount - 1;
  const div = document.createElement('div');
  div.className = 'scorer-row';
  div.style.marginBottom = '6px';
  div.id = `acc-row-${idx}`;
  div.innerHTML = `
    <input placeholder="Nome gruppo (es. PLATINO)" id="acc-gruppo-${idx}" style="flex:1;min-width:100px;">
    <input placeholder="Posizione (es. 1° Girone A)" id="acc-pos-${idx}" style="flex:2;min-width:150px;">
    <select id="acc-tipo-${idx}" style="min-width:120px;">
      <option value="principale">Principale</option>
      <option value="consolazione">Consolazione</option>
    </select>
    <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>`;
  list.appendChild(div);
}

function rimuoviAccoppiamento(idx) {
  const row = document.getElementById(`acc-row-${idx}`);
  if (row) row.remove();
  // Fallback: cerca per contenuto
  const list = document.getElementById('accoppiamenti-list');
  if (list) {
    const rows = list.querySelectorAll('.scorer-row');
    rows.forEach((r,i) => { if(i === idx) r.remove(); });
  }
}

async function salvaRegolamento() {
  const spareggio_fase1 = document.getElementById('reg-spar1')?.value?.trim() || '';
  const spareggio_fase2 = document.getElementById('reg-spar2')?.value?.trim() || '';
  const testo_libero = document.getElementById('reg-testo')?.value?.trim() || '';

  // Raccoglie accoppiamenti
  const accoppiamenti = [];
  let i = 0;
  while (true) {
    const g = document.getElementById(`acc-gruppo-${i}`);
    const p = document.getElementById(`acc-pos-${i}`);
    const t = document.getElementById(`acc-tipo-${i}`);
    if (!g && !p) break;
    if (g?.value?.trim() && p?.value?.trim()) {
      accoppiamenti.push({ gruppo: g.value.trim(), posizione: p.value.trim(), tipo: t?.value || 'principale' });
    }
    i++;
    if (i > 50) break;
  }

  const payload = {
    categoria_id: STATE.activeCat,
    spareggio_fase1, spareggio_fase2, testo_libero,
    accoppiamenti: JSON.stringify(accoppiamenti)
  };

  const { error } = await db.from('regolamento').upsert(payload, { onConflict: 'categoria_id' });
  if (error) { toast('❌ Errore: ' + error.message); return; }
  toast('✅ Regolamento salvato!');
  await renderAdminRegolamento();
}

// Funzione per leggere il regolamento nella classifica pubblica
async function getRegolamento(categoria_id) {
  try {
    const { data } = await db.from('regolamento').select('*').eq('categoria_id', categoria_id).single();
    return data;
  } catch(e) { return null; }
}
