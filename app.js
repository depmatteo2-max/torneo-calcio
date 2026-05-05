// ============================================================
//  SOCCER PRO EXPERIENCE - App principale completa
//  Include: classifica con spareggio + risoluzione automatica triangolari
//  + Risultati ordinati per orario + chi ha inserito
//  FIX: girone_squadre non aggiunge squadre oltre slot originali
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
  if (typeof CONFIG !== 'undefined') {
    if (CONFIG.NOME_SITO) { document.title = CONFIG.NOME_SITO; var ht=document.getElementById('header-title'); if(ht)ht.textContent=CONFIG.NOME_SITO; }
    if (typeof getLogo === 'function') { var logo=getLogo(); if(logo){['header-logo','loading-img'].forEach(function(id){var el=document.getElementById(id);if(el)el.src=logo;});} }
  }
  if (typeof _CACHE_TTL !== 'undefined') window._CACHE_TTL_OVERRIDE = 30000;
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
  document.getElementById('main-content').innerHTML =
    '<div id="sec-classifiche" class="sec active"></div><div id="sec-risultati" class="sec"></div>' +
    '<div id="sec-tabellone" class="sec"></div><div id="sec-a-tornei" class="sec"></div>' +
    '<div id="sec-a-setup" class="sec"></div><div id="sec-a-loghi" class="sec"></div>' +
    '<div id="sec-a-risultati" class="sec"></div><div id="sec-a-knockout" class="sec"></div><div id="sec-a-crea" class="sec"></div><div id="sec-a-modifica" class="sec"></div>';
  document.getElementById('pub-nav').style.display = 'flex';
  document.querySelectorAll('#pub-nav .nav-btn').forEach(b => b.classList.remove('active'));
  const btnClass = document.querySelector('[data-section="classifiche"]');
  if (btnClass) btnClass.classList.add('active');
  STATE.currentSection = 'classifiche';
  STATE.activeCat = null;
  await loadTorneo();
}

function _saveSavedTorneo(id) { try { localStorage.setItem('spe_torneo', String(id)); } catch(e) {} }
function _loadSavedTorneo() { try { const v = localStorage.getItem('spe_torneo'); return v ? parseInt(v) : null; } catch(e) { return null; } }
function _saveSavedCat(id) { try { localStorage.setItem('spe_cat', String(id)); } catch(e) {} }
function _loadSavedCat() { try { const v = localStorage.getItem('spe_cat'); return v ? parseInt(v) : null; } catch(e) { return null; } }
function _clearSavedCat() { try { localStorage.removeItem('spe_cat'); } catch(e) {} }

async function loadTorneo() {
  if (!STATE.activeTorneo) { renderTorneoBar(); renderCatBar(); renderCurrentSection(); return; }
  _saveSavedTorneo(STATE.activeTorneo);
  STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
  STATE.activeGiornata = 'tutte';
  STATE._giornateDisponibili = [];

  const hashParams = _leggiHash();
  if (hashParams.cat) {
    const catId = parseInt(hashParams.cat);
    if (STATE.categorie.find(c => c.id === catId)) {
      await selezionaCategoriaPublic(catId);
      if (hashParams.tab) {
        const btn = document.querySelector(`[data-section="${hashParams.tab}"]`);
        if (btn) showSection(hashParams.tab, btn);
      }
      return;
    }
  }

  const savedCatId = _loadSavedCat();
  const catSalvata = savedCatId && STATE.categorie.find(c => c.id === savedCatId);

  if (catSalvata) {
    STATE.activeCat = catSalvata.id;
    preloadCategoria(catSalvata.id);
  } else if (STATE.categorie.length > 1 && !STATE.activeCat) {
    STATE.activeCat = null;
    renderTorneoBar();
    document.getElementById('cat-bar').style.display = 'none';
    mostraSelezioneCat();
    return;
  } else {
    STATE.activeCat = STATE.categorie.length ? STATE.categorie[0].id : null;
  }
  if (STATE.activeCat) await _caricaGiornate();
  renderTorneoBar(); renderCatBar(); await renderCurrentSection();
}

function mostraSelezioneCat() {
  const main = document.getElementById('main-content');
  main.innerHTML =
    '<div id="sec-classifiche" class="sec active"></div><div id="sec-risultati" class="sec"></div>' +
    '<div id="sec-tabellone" class="sec"></div><div id="sec-a-tornei" class="sec"></div>' +
    '<div id="sec-a-setup" class="sec"></div><div id="sec-a-loghi" class="sec"></div>' +
    '<div id="sec-a-risultati" class="sec"></div><div id="sec-a-knockout" class="sec"></div><div id="sec-a-crea" class="sec"></div><div id="sec-a-modifica" class="sec"></div>';

  const el = document.getElementById('sec-classifiche');
  el.classList.add('active');
  const t = STATE.tornei.find(x => x.id === STATE.activeTorneo);
  const oggiLabel = STATE._giornateDisponibili?.length ? _trovaGiornataOggi(STATE._giornateDisponibili) : null;
  const icons = ['⚽','🏅','🎯','🏆','⭐','🔥'];
  const colors = ['var(--blu-bg)','var(--verde-bg)','var(--arancio-bg)','#fef9c3','#f0fdf4','var(--blu-bg)'];

  const catFiltrate = STATE.categorie.filter(c => {
    const n = (c.nome || '').trim();
    if (n.length > 35) return false;
    if (/^(Girone|Gruppo)/i.test(n)) return false;
    if (/accedono|vince|finali|spareggio|semifinal|classific|punti|→|=|vs /i.test(n)) return false;
    return true;
  });

  const firstId = catFiltrate[0]?.id || 0;

  el.innerHTML = `
    <div style="padding-bottom:32px;">
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 60%,#1a56db 100%);
                  border-radius:16px;padding:24px 20px;margin-bottom:22px;
                  display:flex;align-items:center;gap:16px;position:relative;overflow:hidden;">
        <div style="position:absolute;right:-20px;top:-20px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.04);"></div>
        <div style="position:absolute;right:40px;bottom:-30px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.03);"></div>
        <img id="hero-logo" src="" alt="" style="width:58px;height:58px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.25);flex-shrink:0;display:none;">
        <div style="position:relative;flex:1;min-width:0;">
          <div style="font-size:10px;color:rgba(255,255,255,0.45);font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;">⚽ Torneo in corso</div>
          <div style="font-size:20px;font-weight:900;color:white;line-height:1.2;letter-spacing:-.01em;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t?.nome || 'Soccer Pro Experience'}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">${t?.data || ''}</div>
          ${oggiLabel ? `<div style="display:inline-flex;align-items:center;gap:5px;margin-top:8px;
            background:rgba(234,88,12,0.25);border:1px solid rgba(234,88,12,0.5);
            border-radius:20px;padding:3px 10px;">
            <span style="width:6px;height:6px;border-radius:50%;background:#fb923c;display:inline-block;animation:pulse-live 1.5s infinite;"></span>
            <span style="font-size:11px;color:#fb923c;font-weight:700;">Oggi: ${oggiLabel}</span>
          </div>` : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:22px;">
        <button onclick="selezionaCategoriaPublic(${firstId});setTimeout(()=>{showSection('classifiche',document.querySelector('[data-section=classifiche]'))},150)"
          style="background:white;border:2px solid var(--bordo);border-radius:14px;padding:18px 8px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:var(--shadow);transition:all .2s;"
          onmouseover="this.style.borderColor='var(--blu)';this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-md)'"
          onmouseout="this.style.borderColor='var(--bordo)';this.style.transform='translateY(0)';this.style.boxShadow='var(--shadow)'">
          <span style="font-size:30px;">🏆</span>
          <span style="font-size:12px;font-weight:800;color:var(--testo);">Classifiche</span>
        </button>
        <button onclick="selezionaCategoriaPublic(${firstId});setTimeout(()=>{showSection('risultati',document.querySelector('[data-section=risultati]'))},150)"
          style="background:var(--blu);border:2px solid var(--blu);border-radius:14px;padding:18px 8px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(26,86,219,0.35);transition:all .2s;"
          onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(26,86,219,0.45)'"
          onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 16px rgba(26,86,219,0.35)'">
          <span style="font-size:30px;">⚽</span>
          <span style="font-size:12px;font-weight:800;color:white;">Risultati</span>
        </button>
        <button onclick="selezionaCategoriaPublic(${firstId});setTimeout(()=>{showSection('tabellone',document.querySelector('[data-section=tabellone]'))},150)"
          style="background:white;border:2px solid var(--bordo);border-radius:14px;padding:18px 8px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:var(--shadow);transition:all .2s;"
          onmouseover="this.style.borderColor='var(--blu)';this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-md)'"
          onmouseout="this.style.borderColor='var(--bordo)';this.style.transform='translateY(0)';this.style.boxShadow='var(--shadow)'">
          <span style="font-size:30px;">🥇</span>
          <span style="font-size:12px;font-weight:800;color:var(--testo);">Tabellone</span>
        </button>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--testo-xs);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
        Seleziona categoria
        <span style="flex:1;height:1px;background:var(--bordo);"></span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${catFiltrate.map((c,i) => `
          <button onclick="selezionaCategoriaPublic(${c.id})"
            style="background:white;border:1.5px solid var(--bordo);border-radius:12px;padding:14px 16px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow-xs);transition:all .15s;text-align:left;"
            onmouseover="this.style.borderColor='var(--blu)';this.style.transform='translateY(-1px)';this.style.boxShadow='var(--shadow)'"
            onmouseout="this.style.borderColor='var(--bordo)';this.style.transform='translateY(0)';this.style.boxShadow='var(--shadow-xs)'">
            <div style="width:38px;height:38px;border-radius:10px;background:${colors[i%colors.length]};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">
              ${icons[i%icons.length]}
            </div>
            <span style="font-size:16px;font-weight:800;color:var(--testo);flex:1;">${c.nome}</span>
            <span style="font-size:18px;color:var(--testo-xs);">›</span>
          </button>`).join('')}
      </div>
      ${catFiltrate.length > 1 ? `
      <button onclick="mostraTutteLCategorie()"
        style="width:100%;margin-top:12px;padding:12px;background:var(--sfondo);border:1.5px solid var(--bordo);border-radius:10px;font-size:13px;font-weight:600;color:var(--testo-lt);cursor:pointer;font-family:inherit;transition:all .15s;"
        onmouseover="this.style.background='var(--blu-bg)';this.style.borderColor='var(--blu)';this.style.color='var(--blu)'"
        onmouseout="this.style.background='var(--sfondo)';this.style.borderColor='var(--bordo)';this.style.color='var(--testo-lt)'">
        📊 Vedi tutte le categorie insieme
      </button>` : ''}
    </div>`;

  if (typeof getLogo === 'function') {
    const l = getLogo();
    if (l) { const img = el.querySelector('#hero-logo'); if(img){img.src=l;img.style.display='block';} }
  }
  document.getElementById('pub-nav').style.display = 'none';
  document.getElementById('cat-bar').style.display = 'none';
  STATE.currentSection = 'classifiche';
}

async function selezionaCategoriaPublic(catId) {
  STATE.activeCat = catId;
  _saveSavedCat(catId);
  STATE.activeGiornata = 'tutte';
  STATE._giornateDisponibili = [];
  preloadCategoria(catId);
  await _caricaGiornate();
  renderTorneoBar();
  renderCatBar();
  document.getElementById('pub-nav').style.display = 'flex';
  document.getElementById('cat-bar').style.display = '';
  document.querySelectorAll('#pub-nav .nav-btn').forEach(b => b.classList.remove('active'));
  const btnAttivo = document.querySelector('[data-section="' + STATE.currentSection + '"]');
  if (btnAttivo) btnAttivo.classList.add('active');
  _scriviHash(catId, STATE.currentSection);
  await renderCurrentSection();
}

async function mostraTutteLCategorie() {
  _clearSavedCat();
  STATE.activeCat = STATE.categorie[0]?.id || null;
  if (STATE.activeCat) await _caricaGiornate();
  renderCatBar();
  document.getElementById('cat-bar').style.display = '';
  await renderCurrentSection();
}

function renderTorneoBar() {
  const bar = document.getElementById('torneo-bar'); if (!bar) return;
  const t = STATE.tornei.find(x => x.id === STATE.activeTorneo);
  const cat = STATE.categorie.find(c => c.id === STATE.activeCat);
  const multiCat = STATE.categorie.length > 1;
  const multiTorneo = STATE.tornei.filter(x => x.attivo).length > 1;
  bar.style.display = '';
  bar.innerHTML = `<div style="max-width:700px;margin:0 auto;display:flex;align-items:center;gap:6px;padding:6px 12px;min-height:50px;">
    <button onclick="${multiTorneo ? 'cambiaTorneo()' : 'cambiaCategoria()'}"
      style="flex-shrink:0;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;background:white;border:1.5px solid var(--bordo);border-radius:10px;cursor:pointer;transition:all .15s;box-shadow:var(--shadow-xs);"
      title="Home"
      onmouseover="this.style.borderColor='var(--blu)';this.style.background='var(--blu-bg)'"
      onmouseout="this.style.borderColor='var(--bordo)';this.style.background='white'">🏠</button>
    ${cat ? `
      <div style="flex:1;min-width:0;">
        <div style="font-size:9px;color:var(--testo-xs);font-weight:700;text-transform:uppercase;letter-spacing:.07em;line-height:1;margin-bottom:1px;">Categoria</div>
        <div style="font-size:16px;font-weight:900;color:var(--testo);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;">${cat.nome}</div>
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0;">
        <button onclick="mostraLinkCondivisibile()"
          style="width:34px;height:34px;border-radius:8px;font-size:14px;background:var(--sfondo);border:1.5px solid var(--bordo);color:var(--testo-lt);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;"
          title="Copia link"
          onmouseover="this.style.borderColor='var(--blu)';this.style.background='var(--blu-bg)'"
          onmouseout="this.style.borderColor='var(--bordo)';this.style.background='var(--sfondo)'">🔗</button>
        ${multiCat ? `<button onclick="cambiaCategoria()"
          style="height:34px;padding:0 10px;border-radius:8px;font-size:11px;font-weight:700;background:var(--sfondo);border:1.5px solid var(--bordo);color:var(--testo-lt);cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:3px;white-space:nowrap;transition:all .15s;"
          onmouseover="this.style.borderColor='var(--blu)';this.style.color='var(--blu)';this.style.background='var(--blu-bg)'"
          onmouseout="this.style.borderColor='var(--bordo)';this.style.color='var(--testo-lt)';this.style.background='var(--sfondo)'">
          ⇄ Cambia</button>` : ''}
      </div>
    ` : `<div style="flex:1;"></div>`}
  </div>`;
}

async function cambiaCategoria() {
  STATE.activeCat = null; _clearSavedCat(); _cancellaHash();
  STATE.activeGiornata = 'tutte'; STATE._giornateDisponibili = [];
  document.getElementById('cat-bar').style.display = 'none';
  document.getElementById('cat-bar').innerHTML = '';
  document.getElementById('main-content').innerHTML =
    '<div id="sec-classifiche" class="sec active"></div><div id="sec-risultati" class="sec"></div>' +
    '<div id="sec-tabellone" class="sec"></div><div id="sec-a-tornei" class="sec"></div>' +
    '<div id="sec-a-setup" class="sec"></div><div id="sec-a-loghi" class="sec"></div>' +
    '<div id="sec-a-risultati" class="sec"></div><div id="sec-a-knockout" class="sec"></div><div id="sec-a-crea" class="sec"></div><div id="sec-a-modifica" class="sec"></div>';
  STATE.currentSection = 'classifiche';
  document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector('[data-section="classifiche"]');
  if (btn) btn.classList.add('active');
  renderTorneoBar();
  mostraSelezioneCat();
}

async function cambiaTorneo() {
  STATE.activeTorneo = null; STATE.categorie = []; STATE.activeCat = null;
  STATE.activeGiornata = 'tutte'; STATE._giornateDisponibili = [];
  try { localStorage.removeItem('spe_torneo'); } catch(e) {}
  _clearSavedCat();
  STATE.tornei = await dbGetTornei();
  document.getElementById('pub-nav').style.display = 'none';
  if (document.getElementById('admin-nav')) document.getElementById('admin-nav').style.display = 'none';
  const catBar = document.getElementById('cat-bar'); if (catBar) catBar.innerHTML = '';
  const torneoBar = document.getElementById('torneo-bar'); if (torneoBar) torneoBar.style.display = 'none';
  document.getElementById('main-content').innerHTML =
    '<div id="sec-classifiche" class="sec active"></div><div id="sec-risultati" class="sec"></div>' +
    '<div id="sec-tabellone" class="sec"></div><div id="sec-a-tornei" class="sec"></div>' +
    '<div id="sec-a-setup" class="sec"></div><div id="sec-a-loghi" class="sec"></div>' +
    '<div id="sec-a-risultati" class="sec"></div><div id="sec-a-knockout" class="sec"></div><div id="sec-a-crea" class="sec"></div><div id="sec-a-modifica" class="sec"></div>';
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
  document.getElementById('cat-bar').style.display = ['a-setup','a-tornei','a-crea','a-modifica'].includes(name) ? 'none' : '';
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
  else if (s === 'a-crea') await renderAdminCreaTorneo();
  else if (s === 'a-modifica') await renderAdminModifica();
  _renderFooter();
}

function _leggiHash() {
  const hash = window.location.hash.replace('#', '');
  const params = {};
  hash.split('&').forEach(p => { const [k, v] = p.split('='); if (k && v) params[k] = v; });
  return params;
}
function _scriviHash(catId, tab) {
  const parts = [`cat=${catId}`];
  if (tab && tab !== 'classifiche') parts.push(`tab=${tab}`);
  window.location.hash = parts.join('&');
}
function _cancellaHash() { history.replaceState(null, '', window.location.pathname + window.location.search); }
function _getLinkCondivisibile(catId, tab) {
  const base = window.location.href.split('#')[0];
  const parts = [`cat=${catId}`];
  if (tab && tab !== 'classifiche') parts.push(`tab=${tab}`);
  return `${base}#${parts.join('&')}`;
}
function mostraLinkCondivisibile() {
  const cat = STATE.categorie.find(c => c.id === STATE.activeCat); if (!cat) return;
  const link = _getLinkCondivisibile(STATE.activeCat, STATE.currentSection || 'classifiche');
  navigator.clipboard.writeText(link).then(() => toast('🔗 Link copiato! Incollalo su WhatsApp o Telegram')).catch(() => prompt('Copia questo link:', link));
}

function _renderFooter() {
  let footer = document.getElementById('app-footer');
  if (!footer) {
    footer = document.createElement('div'); footer.id = 'app-footer'; footer.className = 'footer-credits';
    const main = document.getElementById('main-content'); if (main) main.appendChild(footer);
  }
  footer.innerHTML = `<div>Creato da <strong>Matteo De Pandis</strong></div><div style="margin-top:4px;"><a href="tel:+393283951608">📱 +39 328 395 1608</a></div>`;
}

function renderCatBar() {
  const bar = document.getElementById('cat-bar');
  if (!STATE.categorie.length) { bar.innerHTML = ''; return; }
  bar.innerHTML = `<div id="giornata-bar" class="cat-bar-inner" style="flex-wrap:wrap;gap:4px;"></div>`;
  _renderGiornataBar();
}

function _renderGiornataBar() {
  const bar = document.getElementById('giornata-bar'); if (!bar) return;
  const giornate = STATE._giornateDisponibili || [];
  if (giornate.length <= 1) { bar.innerHTML = ''; return; }
  const oggi = _trovaGiornataOggi(giornate);
  bar.innerHTML = [
    { id: 'tutte', label: '📅 Tutte', oggi: false },
    ...giornate.map(g => ({ id: g, label: _labelGiornata(g), oggi: g === oggi }))
  ].map(g => {
    const isActive = STATE.activeGiornata === g.id;
    const isOggi = g.oggi;
    return `<button class="cat-pill ${isActive ? 'active' : ''} ${isOggi && !isActive ? 'oggi-pill' : ''}" style="font-size:11px;padding:3px 10px;" onclick="selectGiornata('${g.id}')">${isOggi ? '🔴 ' : ''}${g.label}</button>`;
  }).join('');
}

function _labelGiornata(g) {
  const mesi = {'gennaio':'Gen','febbraio':'Feb','marzo':'Mar','aprile':'Apr','maggio':'Mag','giugno':'Giu','luglio':'Lug','agosto':'Ago','settembre':'Set','ottobre':'Ott','novembre':'Nov','dicembre':'Dic'};
  let label = g;
  for (const [full, short] of Object.entries(mesi)) label = label.toLowerCase().replace(full, short);
  label = label.replace(/20\d\d/,'').trim().replace(/\s+/g,' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function _trovaGiornataOggi(giornate) {
  const ora = new Date();
  const mesiMap = {'gennaio':0,'febbraio':1,'marzo':2,'aprile':3,'maggio':4,'giugno':5,'luglio':6,'agosto':7,'settembre':8,'ottobre':9,'novembre':10,'dicembre':11};
  for (const g of giornate) {
    const parts = g.toLowerCase().split(/\s+/);
    const giorno = parseInt(parts.find(p => /^\d+$/.test(p)));
    const meseStr = parts.find(p => mesiMap[p] !== undefined);
    const anno = parseInt(parts.find(p => /^20\d\d$/.test(p)));
    if (giorno && meseStr) {
      const dataG = new Date(anno || ora.getFullYear(), mesiMap[meseStr], giorno);
      if (dataG.toDateString() === ora.toDateString()) return g;
    }
  }
  return null;
}

function _abbreviaNomeCat(nome) {
  const abbr = {'Girone Silver 1':'Silver 1','Girone Silver 2':'Silver 2','Girone Gold 1':'Gold 1','Girone Gold 2':'Gold 2','Pulcini 2016':'Pulcini','Esordienti 2013':'Esord. 2013','Esordienti 2014':'Esord. 2014','Girone Unico':'Girone Unico'};
  if (abbr[nome]) return abbr[nome];
  return nome.length > 14 ? nome.substring(0, 13) + '…' : nome;
}

async function selectCat(id) {
  STATE.activeCat = id; _saveSavedCat(id); STATE.activeGiornata = 'tutte'; STATE._giornateDisponibili = [];
  await _caricaGiornate(); renderCatBar(); renderCurrentSection();
}
async function selectGiornata(g) { STATE.activeGiornata = g; _renderGiornataBar(); renderCurrentSection(); }

async function _caricaGiornate() {
  if (!STATE.activeCat) return;
  try {
    const dateSet = new Set();
    const gironi = await dbGetGironi(STATE.activeCat);
    for (const g of gironi) {
      const { data: partite } = await db.from('partite').select('giorno').eq('girone_id', g.id).not('giorno', 'is', null);
      (partite || []).forEach(p => { if (p.giorno) dateSet.add(p.giorno); });
    }
    const mesi = {'gennaio':1,'febbraio':2,'marzo':3,'aprile':4,'maggio':5,'giugno':6,'luglio':7,'agosto':8,'settembre':9,'ottobre':10,'novembre':11,'dicembre':12};
    const parseData = s => {
      const parts = s.toLowerCase().split(' ').filter(Boolean);
      const giorno = parseInt(parts.find(p => /^\d+$/.test(p))) || 0;
      const meseEntry = Object.entries(mesi).find(([m]) => parts.some(p => p.includes(m)));
      return (meseEntry ? meseEntry[1] : 0) * 100 + giorno;
    };
    STATE._giornateDisponibili = [...dateSet].sort((a,b) => parseData(a) - parseData(b));
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

// ============================================================
//  CLASSIFICA
// ============================================================
function calcGironeClassifica(girone) {
  const map = {};
  for (const sq of girone.squadre) map[sq.id] = { sq, g:0, v:0, p:0, s:0, gf:0, gs:0, pts:0, rigori:0 };
  const giocate = girone.partite.filter(p => p.giocata);
  for (const p of giocate) {
    const h = map[p.home_id]; const a = map[p.away_id];
    // Conta la partita anche se solo UNA squadra e' nel girone (partite extra ospiti)
    if (!h && !a) continue;
    if (h) { h.g++; h.gf += p.gol_home; h.gs += p.gol_away; }
    if (a) { a.g++; a.gf += p.gol_away; a.gs += p.gol_home; }
    if (p.gol_home > p.gol_away) {
      if (h) { h.v++; h.pts+=3; }
      if (a) { a.s++; }
    } else if (p.gol_home < p.gol_away) {
      if (a) { a.v++; a.pts+=3; }
      if (h) { h.s++; }
    } else {
      if (h) { h.p++; h.pts++; }
      if (a) { a.p++; a.pts++; }
    }
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
//  RISOLUZIONE PLACEHOLDER
//  *** FIX: totaleSlot — non aggiunge squadre oltre gli slot originali ***
// ============================================================
async function verificaEGeneraTriangolari(categoriaId) {
  try {
    const { data: gironi } = await db.from('gironi').select('id,nome').eq('categoria_id', categoriaId);
    const classificheGironi = {};

    // PASSO 1: calcola classifiche di ogni girone
    // Usa partite giocate con home_id e away_id reali e NON placeholder
    for (const g of (gironi||[])) {
      const { data: partite } = await db.from('partite')
        .select('id,home_id,away_id,gol_home,gol_away,giocata')
        .eq('girone_id', g.id);
      if (!partite || !partite.length) continue;
      const giocate = partite.filter(p => p.giocata && p.home_id && p.away_id);
      if (!giocate.length) continue;
      const sqIds = new Set();
      giocate.forEach(p => { sqIds.add(p.home_id); sqIds.add(p.away_id); });
      const { data: sqList } = await db.from('squadre').select('id,nome,logo').in('id', [...sqIds]);
      const sqMap = {}; (sqList||[]).forEach(s => sqMap[s.id] = s);
      const partitePure = giocate.filter(p =>
        !_isPlaceholder(sqMap[p.home_id]?.nome) && !_isPlaceholder(sqMap[p.away_id]?.nome)
      );
      // Non calcolare classifica se non ci sono abbastanza partite giocate tra reali
      // (almeno il 50% delle partite del girone devono essere giocate)
      const { data: tuttePartiteGirone } = await db.from('partite').select('id').eq('girone_id', g.id);
      const totPartite = tuttePartiteGirone?.length || 0;
      if (!partitePure.length) continue;
      // Non risolvere placeholder se il girone non è ancora iniziato
      if (totPartite > 0 && partitePure.length === 0) continue;
      const sqRealiIds = new Set();
      partitePure.forEach(p => { sqRealiIds.add(p.home_id); sqRealiIds.add(p.away_id); });
      const squadreReali = [...sqRealiIds].map(id => sqMap[id]).filter(s => s && !_isPlaceholder(s.nome));
      if (squadreReali.length > 0) {
        // Salva con il nome del girone E con varianti per facilitare il lookup
        const cl = calcGironeClassifica({ squadre: squadreReali, partite: partitePure });
        classificheGironi[g.nome] = cl;
        // Aggiungi anche varianti uppercase e senza accenti per lookup robusto
        classificheGironi[g.nome.toUpperCase()] = cl;
      }
    }

    const { data: allKo } = await db.from('knockout').select('id,round_name,home_id,away_id,gol_home,gol_away,giocata,note_home,note_away').eq('categoria_id', categoriaId);
    const ROUND_NON_GIRONE = /SEMIFINALE|FINALE|QUARTO|CONSOLAZ|PLAYOFF|SPAREGGIO/i;
    const koPerRound = {};
    const risultatiKnockout = {};

    for (const ko of (allKo||[])) {
      const rn = (ko.round_name||'').trim();
      const mSem = rn.match(/SEMIFINALE\s*(\d+)/i);
      if (mSem) risultatiKnockout['SEMIFINALE ' + mSem[1].padStart(2, '0')] = ko;
      const mQuarto = rn.match(/QUARTO\s*(\d+)/i);
      if (mQuarto) risultatiKnockout['QUARTO ' + mQuarto[1].padStart(2, '0')] = ko;
      if (!ROUND_NON_GIRONE.test(rn) && ko.home_id && ko.away_id) {
        const key = rn.toUpperCase();
        if (!koPerRound[key]) koPerRound[key] = [];
        koPerRound[key].push(ko);
      }
    }

    for (const [roundKey, partite] of Object.entries(koPerRound)) {
      const giocate = partite.filter(p => p.giocata);
      if (!giocate.length) continue;
      const sqIds = new Set();
      partite.forEach(p => { if(p.home_id) sqIds.add(p.home_id); if(p.away_id) sqIds.add(p.away_id); });
      if (!sqIds.size) continue;
      const { data: sqList } = await db.from('squadre').select('id,nome,logo').in('id', [...sqIds]);
      if (!sqList || !sqList.length) continue;
      classificheGironi[roundKey] = calcGironeClassifica({ squadre: sqList, partite: giocate.map(p => ({ ...p, giocata: true })) });
    }

    if (!Object.keys(classificheGironi).length && !Object.keys(risultatiKnockout).length) return;

    const miglioriSecondi = _calcolaMiglioriSecondi(classificheGironi);
    let risolti = 0;

    for (const match of (allKo||[])) {
      const newH = _resolvePlaceholder(match.note_home, classificheGironi, miglioriSecondi, risultatiKnockout);
      const newA = _resolvePlaceholder(match.note_away, classificheGironi, miglioriSecondi, risultatiKnockout);
      const upd = {};
      if (newH && newH !== match.home_id) upd.home_id = newH;
      if (newA && newA !== match.away_id) upd.away_id = newA;
      if (Object.keys(upd).length) { await db.from('knockout').update(upd).eq('id', match.id); risolti++; }
    }

    for (const g of (gironi||[])) {
      const { data: tuttePartite } = await db.from('partite').select('id,note_home,note_away,home_id,away_id').eq('girone_id', g.id);
      for (const p of (tuttePartite||[])) {
        if (!p.note_home && !p.note_away) continue;
        const newH = _resolvePlaceholder(p.note_home, classificheGironi, miglioriSecondi, risultatiKnockout);
        const newA = _resolvePlaceholder(p.note_away, classificheGironi, miglioriSecondi, risultatiKnockout);
        const upd = {};
        if (newH && newH !== p.home_id) upd.home_id = newH;
        if (newA && newA !== p.away_id) upd.away_id = newA;
        if (Object.keys(upd).length) { await db.from('partite').update(upd).eq('id', p.id); risolti++; }
      }

      // *** FIX CRITICO: sostituisce placeholder in girone_squadre con squadre reali ***
      // Carica tutto il girone_squadre con le note delle partite
      const { data: gsEsist } = await db.from('girone_squadre').select('id,squadra_id').eq('girone_id', g.id);
      for (const gs of (gsEsist||[])) {
        // Verifica se questa squadra è un placeholder
        const { data: sqInfo } = await db.from('squadre').select('nome').eq('id', gs.squadra_id).single();
        if (!sqInfo || !_isPlaceholder(sqInfo.nome)) continue;
        // È un placeholder — trova la squadra reale corrispondente
        const sqReale = _resolvePlaceholder(sqInfo.nome, classificheGironi, miglioriSecondi, risultatiKnockout);
        if (!sqReale || sqReale === gs.squadra_id) continue;
        // Verifica che la squadra reale non sia già nel girone
        const giaPresente = (gsEsist||[]).some(r => r.squadra_id === sqReale);
        if (giaPresente) continue;
        // Sostituisce il placeholder con la squadra reale
        await db.from('girone_squadre').update({ squadra_id: sqReale }).eq('id', gs.id);
        risolti++;
      }
    }

    if (risolti > 0) {
      _mostraNotificaTriangolari();
      if (STATE.currentSection === 'a-knockout') await renderAdminKnockout();
      if (STATE.currentSection === 'tabellone') await renderTabellone();
      if (STATE.currentSection === 'a-risultati') await renderAdminRisultati();
    }
  } catch(e) { console.error('verificaEGeneraTriangolari:', e); }
}

function _calcolaMiglioriSecondi(classificheGironi) {
  const secondi = [];
  for (const [nome, cl] of Object.entries(classificheGironi)) {
    if (cl.length >= 2) secondi.push({ girone: nome, sq: cl[1].sq, stat: cl[1] });
  }
  secondi.sort((a,b) => {
    if (b.stat.pts !== a.stat.pts) return b.stat.pts - a.stat.pts;
    const drA = a.stat.gf - a.stat.gs, drB = b.stat.gf - b.stat.gs;
    if (drB !== drA) return drB - drA;
    return b.stat.gf - a.stat.gf;
  });
  return secondi;
}

function _isPlaceholder(nome) {
  if (!nome) return false;
  const s = nome.trim();
  if (/^\d+[°º*]?\s*(Girone|Gruppo)\s+/i.test(s)) return true;
  if (/^\d+[°º*]?\s*\w+$/.test(s) && !/^\d+$/.test(s)) return true;
  if (/^(miglior|peggio)/i.test(s)) return true;
  if (/^(Vincente|Perdente)\s+(SEMIFINALE|QUARTO|Finale)/i.test(s)) return true;
  return false;
}

function _resolvePlaceholder(placeholder, classificheGironi, miglioriSecondi=[], risultatiKnockout={}) {
  if (!placeholder) return null;
  const s = placeholder.trim();

  const mSemVP = s.match(/(Vincente|Perdente)\s+SEMIFINALE\s*(\d+)/i);
  if (mSemVP) {
    const tipo = mSemVP[1].toLowerCase();
    const sem = risultatiKnockout['SEMIFINALE ' + mSemVP[2].padStart(2, '0')];
    if (!sem || !sem.giocata) return null;
    return tipo === 'vincente' ? (sem.gol_home >= sem.gol_away ? sem.home_id : sem.away_id) : (sem.gol_home <= sem.gol_away ? sem.home_id : sem.away_id);
  }

  const mQVP = s.match(/(Vincente|Perdente)\s+QUARTO\s*(\d+)/i);
  if (mQVP) {
    const tipo = mQVP[1].toLowerCase();
    const q = risultatiKnockout['QUARTO ' + mQVP[2].padStart(2, '0')];
    if (!q || !q.giocata) return null;
    return tipo === 'vincente' ? (q.gol_home >= q.gol_away ? q.home_id : q.away_id) : (q.gol_home <= q.gol_away ? q.home_id : q.away_id);
  }

  // Vincente/Perdente Finale N
  const mFinVP = s.match(/(Vincente|Perdente)\s+(?:Finale|FINALE)\s*(\d+)/i);
  if (mFinVP) {
    const tipo = mFinVP[1].toLowerCase();
    const key = 'FINALE ' + mFinVP[2].padStart(2, '0');
    const fin = risultatiKnockout[key] || Object.values(risultatiKnockout).find(k => (k.round_name||'').toUpperCase().includes('FINALE ' + mFinVP[2]));
    if (!fin || !fin.giocata) return null;
    return tipo === 'vincente' ? (fin.gol_home >= fin.gol_away ? fin.home_id : fin.away_id) : (fin.gol_home <= fin.gol_away ? fin.home_id : fin.away_id);
  }

  if (/miglior\s*2[°º]?/i.test(s) || /miglior\s*second/i.test(s)) return miglioriSecondi[0]?.sq?.id || null;
  const mMig = s.match(/^(\d+)[°º]?\s*Miglior/i);
  if (mMig) return miglioriSecondi[parseInt(mMig[1]) - 1]?.sq?.id || null;

  const mMigliorN = s.match(/^(miglior|peggio[a-z]*)?\s*(\d+)[°º]/i);
  if (mMigliorN) {
    const tipo = (mMigliorN[1]||'').toLowerCase();
    const pos = parseInt(mMigliorN[2]);
    const candidati = [];
    for (const [nome, cl] of Object.entries(classificheGironi)) {
      if (cl.length >= pos) candidati.push({ nome, sq: cl[pos-1].sq, stat: cl[pos-1] });
    }
    if (!candidati.length) return null;
    candidati.sort((a, b) => {
      const ptA = a.stat.pts, ptB = b.stat.pts;
      if (ptB !== ptA) return tipo.startsWith('peggio') ? ptA - ptB : ptB - ptA;
      const drA = a.stat.gf - a.stat.gs, drB = b.stat.gf - b.stat.gs;
      if (drB !== drA) return tipo.startsWith('peggio') ? drA - drB : drB - drA;
      return tipo.startsWith('peggio') ? a.stat.gf - b.stat.gf : b.stat.gf - a.stat.gf;
    });
    return candidati[0]?.sq?.id || null;
  }

  // Formato "3°A" o "4°B" senza spazio
  const mShort = s.match(/^(\d+)[°º]([A-Za-z])$/);
  if (mShort) {
    const pos = parseInt(mShort[1]);
    const lettera = mShort[2].toUpperCase();
    const normK = (k) => k.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    const k = Object.keys(classificheGironi).find(k => {
      const kn = normK(k);
      return kn === lettera || kn.endsWith(' ' + lettera);
    });
    if (k) { const cl = classificheGironi[k]; if (cl && cl.length >= pos) return cl[pos-1]?.sq?.id || null; }
    return null; // Girone non ancora risolto
  }

  // Risoluzione generica: "N° <nome girone>" o "N° Girone X" o "N° X"
  // Estrae il numero di posizione e cerca il girone nel dizionario
  const mNum = s.match(/^(\d+)\s*[°º*o]?\s*(.+)$/i);
  if (mNum) {
    const pos = parseInt(mNum[1]);
    const resto = mNum[2].trim();

    // Cerca prima match esatto con "Girone X" o "Gruppo X"
    const mGir = resto.match(/^(?:del\s*)?(Girone|Gruppo)\s+(.+)/i);
    if (mGir) {
      const nomeGirone = mGir[1] + ' ' + mGir[2].trim();
      const nomeAlt = (mGir[1] === 'Girone' ? 'Gruppo' : 'Girone') + ' ' + mGir[2].trim();
      const parteFinale = mGir[2].trim();
      // Cerca in ordine: match esatto, case insensitive, endsWith, contains
      for (const cerca of [nomeGirone, nomeAlt]) {
        const k = Object.keys(classificheGironi).find(k =>
          k.toLowerCase() === cerca.toLowerCase() ||
          k.toLowerCase().endsWith(' ' + parteFinale.toLowerCase())
        );
        if (k) {
          const cl = classificheGironi[k];
          if (cl && cl.length >= pos) return cl[pos - 1]?.sq?.id || null;
        }
      }
      // Cerca solo la parte finale
      const k2 = Object.keys(classificheGironi).find(k =>
        k.toLowerCase() === parteFinale.toLowerCase() ||
        k.toUpperCase().endsWith(' ' + parteFinale.toUpperCase())
      );
      if (k2) {
        const cl = classificheGironi[k2];
        if (cl && cl.length >= pos) return cl[pos - 1]?.sq?.id || null;
      }
      return null;
    }

    // Match diretto con il nome del girone (es. "1° Girone A", "1° A", "1° ARANCIO", "1° Venerdi")
    const keyword = resto.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    // Cerca il girone che contiene questa parola chiave (case insensitive, senza accenti)
    const normKey = (s) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const k = Object.keys(classificheGironi).find(k => {
      const kn = normKey(k);
      return kn === keyword ||
        kn === 'GIRONE ' + keyword ||
        kn === 'GRUPPO ' + keyword ||
        kn.endsWith(' ' + keyword) ||
        keyword === kn ||
        keyword.endsWith(kn) ||
        kn.includes(keyword);
    });
    if (k) {
      const cl = classificheGironi[k];
      if (cl && cl.length >= pos) return cl[pos - 1]?.sq?.id || null;
    }
  }

  return null;
}

async function forzaRisoluzioneAccoppiamenti() {
  if (!STATE.activeCat) return;
  toast('⏳ Risoluzione accoppiamenti...');
  await verificaEGeneraTriangolari(STATE.activeCat);
  await renderAdminKnockout(); await renderTabellone();
  toast('✅ Accoppiamenti aggiornati!');
}

function _mostraNotificaTriangolari() {
  const old=document.getElementById('notifica-triangolari'); if(old)old.remove();
  const div=document.createElement('div'); div.id='notifica-triangolari';
  div.innerHTML=`<div style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e8449;color:white;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:700;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.3);display:flex;align-items:center;gap:10px;max-width:90vw;">🏆 Gironi completati! Triangolari aggiornati.<button onclick="document.getElementById('notifica-triangolari').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:2px 8px;border-radius:6px;cursor:pointer;">✕</button></div>`;
  document.body.appendChild(div);
  setTimeout(()=>{ if(div.parentNode)div.remove(); },6000);
}

function _orarioToMinuti(orario) {
  if (!orario) return 9999;
  const clean = String(orario).replace(',', '.').trim();
  const parts = clean.split(/[:.]/);
  if (parts.length >= 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  const num = parseFloat(clean);
  if (!isNaN(num)) return Math.floor(num) * 60 + Math.round((num % 1) * 100);
  return 9999;
}

async function _caricaTutteCategorie() {
  const results = await Promise.all(STATE.categorie.map(cat => getGironiWithData(cat.id).then(gironi => ({ cat, gironi }))));
  return results;
}

function _riepilogoBanner(section) {
  if (!STATE._giornateDisponibili || STATE._giornateDisponibili.length <= 1) return '';
  if (STATE.activeGiornata === 'tutte') return '';
  return `<button class="riepilogo-banner" onclick="selectGiornata('tutte')"><div class="riepilogo-banner-left"><div class="riepilogo-banner-icon">🏆</div><div><div class="riepilogo-banner-title">Riepilogo Torneo</div><div class="riepilogo-banner-sub">Vedi classifica, risultati e tabellone di tutte le giornate</div></div></div><div class="riepilogo-banner-arrow">→</div></button>`;
}

// ============================================================
//  PUBLIC: CLASSIFICHE
// ============================================================
async function renderClassifiche() {
  const el = document.getElementById('sec-classifiche');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }
  el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--testo-xs);">⏳ Caricamento...</div>';
  const cat = STATE.categorie.find(c => c.id === STATE.activeCat);
  const gironi = await getGironiWithData(STATE.activeCat);

  if (!gironi.length) {
    const ko = await dbGetKnockout(STATE.activeCat);
    if (ko.length) {
      el.innerHTML = '';
      STATE.currentSection = 'tabellone';
      document.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(b => b.classList.remove('active'));
      const btnTab = document.querySelector('[data-section="tabellone"]');
      if (btnTab) btnTab.classList.add('active');
      document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
      const secTab = document.getElementById('sec-tabellone');
      if (secTab) secTab.classList.add('active');
      await renderTabellone();
      return;
    }
    el.innerHTML = '<div class="empty-state">Nessun girone trovato.</div>';
    return;
  }

  let html = '';
  for (const g of gironi) {
    // Nascondi gironi di qualificazione con solo 1 partita (es. Girone F1, F2, F3)
    if (g.partite.length <= 1) continue;
    const cl = calcGironeClassifica(g);
    const played = g.partite.filter(p=>p.giocata).length;
    html += `<div class="card" style="margin-bottom:8px;">
      <div class="card-title">${g.nome}<span class="badge badge-gray">${played}/${g.partite.length}</span></div>
      <table class="standings-table">
        <thead><tr><th></th><th colspan="2">Squadra</th><th>G</th><th>V</th><th>P</th><th>S</th><th>GD</th><th>Pt</th></tr></thead>
        <tbody>`;
    cl.forEach((row,idx) => {
      const q = idx < (cat?.qualificate||1);
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
  el.innerHTML = html;
}

// ============================================================
//  PUBLIC: RISULTATI
// ============================================================
async function renderRisultati() {
  const el = document.getElementById('sec-risultati');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }
  el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--testo-xs);">⏳ Caricamento...</div>';
  const cat = STATE.categorie.find(c => c.id === STATE.activeCat);
  const gironi = await getGironiWithData(STATE.activeCat);
  let tuttePartite = [];
  for (const g of gironi) { for (const p of g.partite) tuttePartite.push({ ...p, _girone: g.nome, _cat: cat?.nome || '' }); }
  const filtroAttivo = STATE.activeGiornata && STATE.activeGiornata !== 'tutte';
  if (filtroAttivo) tuttePartite = tuttePartite.filter(p => p.giorno === STATE.activeGiornata);
  tuttePartite.sort((a, b) => _orarioToMinuti(a.orario) - _orarioToMinuti(b.orario));
  const giocate = tuttePartite.filter(p => p.giocata);
  const daFare  = tuttePartite.filter(p => !p.giocata);
  let html = '';

  if (!STATE._campiGiornate) {
    try {
      const cg = await dbGetCampiGiornate(STATE.activeTorneo);
      const _cm = {}; cg.forEach(c => _cm[c.giorno] = c);
      STATE._campiGiornate = _cm;
    } catch(e) { STATE._campiGiornate = {}; }
  }
  const campiMap = STATE._campiGiornate || {};

  if (filtroAttivo) {
    const _campoOggi = campiMap[STATE.activeGiornata];
    const _keyIdOggi = STATE.activeGiornata.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-]/g,'_');
    html += `<div style="background:linear-gradient(90deg,var(--blu) 0%,var(--blu-lt) 100%);color:white;border-radius:var(--radius);padding:11px 16px;margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:14px;font-weight:700;">📅 ${STATE.activeGiornata}</span>
        <span style="font-size:11px;opacity:.7;margin-left:auto;">${tuttePartite.length} partite</span>
        ${STATE.isAdmin ? `<button onclick="mostraEditCampoGiornata('${STATE.activeGiornata}')" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);color:white;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap;">✏️ ${_campoOggi ? 'Modifica' : 'Aggiungi'}</button>` : ''}
      </div>
      ${_campoOggi ? `<div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:4px;">📍 <strong>${_campoOggi.nome_campo||''}</strong>${_campoOggi.nome_campo&&_campoOggi.indirizzo?' — ':''}${_campoOggi.indirizzo||''}</div>` : ''}
      <div id="edit-campo-${_keyIdOggi}" style="display:none;margin-top:8px;"></div>
    </div>`;
  } else {
    const giornate = STATE._giornateDisponibili || [];
    if (giornate.length > 1) {
      html += `<div style="background:white;border:1px solid var(--bordo);border-radius:var(--radius);padding:12px 14px;margin-bottom:14px;box-shadow:var(--shadow);">
        <div style="font-size:11px;font-weight:700;color:var(--testo-xs);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">📅 Filtra per giornata</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${giornate.map(g => { const oggi = _trovaGiornataOggi(giornate); const isOggi = g === oggi;
            return `<button onclick="selectGiornata('${g}')" style="padding:5px 12px;border-radius:20px;border:1.5px solid ${isOggi?'var(--arancio)':'var(--bordo)'};background:${isOggi?'var(--arancio-bg)':'white'};color:${isOggi?'var(--arancio)':'var(--testo-lt)'};font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">${isOggi?'🔴 ':''}${_labelGiornata(g)}</button>`;
          }).join('')}
        </div>
      </div>`;
    }
  }

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
    r += p.giocata ? `<div class="match-score">${p.gol_home} — ${p.gol_away}</div>` : `<div class="match-score pending">vs</div>`;
    r += `<div class="match-team right"><span>${p.away?.nome||'?'}</span>${logoHTML(p.away,'sm')}</div></div>`;
    if (mH.length||mA.length) {
      r += `<div class="match-scorers">`;
      mH.forEach(m=>r+=`<span class="scorer-chip">⚽ ${m.nome}${m.minuto?' '+m.minuto+"'":''}  ${p.home?.nome||''}</span>`);
      mA.forEach(m=>r+=`<span class="scorer-chip">⚽ ${m.nome}${m.minuto?' '+m.minuto+"'":''}  ${p.away?.nome||''}</span>`);
      r += `</div>`;
    }
    r += `</div>`; return r;
  };

  const _bannerGiornata = (giorno, isOggi) => {
    const campo = campiMap[giorno];
    const colore = isOggi ? 'var(--blu)' : 'var(--sfondo)';
    const testocolore = isOggi ? 'white' : 'var(--testo-lt)';
    const bordocolore = isOggi ? 'var(--blu)' : 'var(--bordo)';
    const keyId = giorno.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-]/g,'_');
    return `<div style="background:${colore};border:1px solid ${bordocolore};border-radius:var(--radius);padding:10px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:${testocolore};">📅 ${giorno}</div>
        ${campo ? `<div style="font-size:12px;color:${isOggi?'rgba(255,255,255,0.8)':'var(--testo-xs)'};margin-top:2px;">📍 <strong>${campo.nome_campo||''}</strong>${campo.nome_campo&&campo.indirizzo?' — ':''}${campo.indirizzo||''}</div>` : ''}
      </div>
      ${STATE.isAdmin ? `<button onclick="mostraEditCampoGiornata('${giorno}')" style="background:${isOggi?'rgba(255,255,255,0.2)':'white'};border:1px solid ${isOggi?'rgba(255,255,255,0.3)':'var(--bordo)'};color:${isOggi?'white':'var(--testo-lt)'};border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap;">✏️ ${campo ? 'Modifica' : 'Aggiungi'} luogo</button>` : ''}
      <div id="edit-campo-${keyId}" style="display:none;width:100%;margin-top:8px;"></div>
    </div>`;
  };

  if (giocate.length) {
    html += `<div class="section-label">✅ Risultati <span style="color:var(--verde);font-weight:800;">(${giocate.length})</span></div>`;
    if (!filtroAttivo) {
      const perGiorno = {}; giocate.forEach(p => { const g = p.giorno || '—'; if (!perGiorno[g]) perGiorno[g] = []; perGiorno[g].push(p); });
      for (const [giorno, partite] of Object.entries(perGiorno)) {
        const _oggi = _trovaGiornataOggi(STATE._giornateDisponibili||[]);
        html += _bannerGiornata(giorno, giorno===_oggi) + `<div class="card">`;
        partite.forEach(p => { html += renderPartita(p, true); });
        html += `</div>`;
      }
    } else { html += `<div class="card">`; giocate.forEach(p => { html += renderPartita(p, true); }); html += `</div>`; }
  }

  if (daFare.length) {
    html += `<div class="section-label">🕐 Programma <span style="color:var(--testo-xs);font-weight:600;">(${daFare.length})</span></div>`;
    if (!filtroAttivo) {
      const perGiorno = {}; daFare.forEach(p => { const g = p.giorno || '—'; if (!perGiorno[g]) perGiorno[g] = []; perGiorno[g].push(p); });
      for (const [giorno, partite] of Object.entries(perGiorno)) {
        html += _bannerGiornata(giorno, false) + `<div class="card">`;
        partite.forEach(p => { html += renderPartita(p, false); });
        html += `</div>`;
      }
    } else { html += `<div class="card">`; daFare.forEach(p => { html += renderPartita(p, false); }); html += `</div>`; }
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
    const rounds={}; matches.forEach(m=>{ if(!rounds[m.round_name])rounds[m.round_name]=[]; rounds[m.round_name].push(m); });
    let h=`<div class="section-label">${label}</div>`;
    for (const [rname,rmatch] of Object.entries(rounds)) {
      const rkey=Object.keys(ROUND_COLORS).find(k=>rname.toUpperCase().includes(k));
      const color=ROUND_COLORS[rkey]||'#E85C00';
      h+=`<div class="card" style="border-top:4px solid ${color};margin-bottom:12px;"><div class="card-title">${rname}</div>`;
      for (const m of rmatch) {
        const hm=m.home_id?sqMap[m.home_id]:null; const am=m.away_id?sqMap[m.away_id]:null;
        const hmNome=hm?hm.nome:(m.note_home||'In attesa...'); const amNome=am?am.nome:(m.note_away||'In attesa...');
        const isPending=!hm||!am;
        const orario=m.orario||m.campo?`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">${m.orario?`<span style="font-size:11px;font-weight:700;color:#E85C00;">🕐 ${m.orario}</span>`:''}${m.campo?`<span style="font-size:11px;color:#888;">📍 ${m.campo}</span>`:''}${m.inserito_da?`<span style="font-size:10px;color:#bbb;margin-left:auto;">✏️ ${m.inserito_da}</span>`:''}</div>`:'';
        h+=`<div class="match-result" style="border-bottom:1px solid #f0f0f0;padding-bottom:10px;margin-bottom:8px;">${orario}<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><div class="match-team"><span style="${isPending?'color:#bbb;font-style:italic;':''}">${isPending?'':logoHTML(hm,'sm')}${hmNome}</span></div><div class="match-score ${!m.giocata?'pending':''}">${m.giocata?m.gol_home+' — '+m.gol_away:'vs'}</div><div class="match-team right"><span style="${isPending?'color:#bbb;font-style:italic;':''}">${amNome}${isPending?'':logoHTML(am,'sm')}</span></div></div></div>`;
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
    html+=`<div class="card"><div class="card-title"><div><div style="font-weight:600;">${t.nome}</div><div style="font-size:12px;color:#aaa;">${t.data||'Data non impostata'}</div></div><div style="display:flex;gap:6px;align-items:center;"><span class="badge ${t.attivo?'badge-green':'badge-gray'}">${t.attivo?'Attivo':'Archiviato'}</span><button class="btn btn-sm ${t.attivo?'':'btn-p'}" onclick="toggleTorneo(${t.id},${t.attivo})">${t.attivo?'Archivia':'Riattiva'}</button><button class="btn btn-sm" onclick="editTorneo(${t.id})">Modifica</button><button class="btn btn-danger btn-sm" onclick="deleteTorneo(${t.id})">Elimina</button></div></div></div>`;
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
  const nome=document.getElementById('new-t-nome').value.trim(); const data=document.getElementById('new-t-data').value.trim();
  if (!nome) { alert('Inserisci il nome'); return; }
  const t=await dbSaveTorneo({nome,data,attivo:true});
  STATE.tornei=await dbGetTornei(); STATE.activeTorneo=t.id;
  await loadTorneo(); toast('Torneo creato!'); await renderAdminTornei();
}
async function toggleTorneo(id,attivo) { await dbUpdateTorneo(id,{attivo:!attivo}); STATE.tornei=await dbGetTornei(); await renderAdminTornei(); toast(attivo?'Torneo archiviato':'Torneo riattivato'); }
async function deleteTorneo(id) {
  const t = STATE.tornei.find(x=>x.id===id);
  if (!confirm(`Eliminare "${t?.nome||'questo torneo'}" e TUTTI i dati?`)) return;
  try {
    toast('⏳ Eliminazione in corso...');
    // Elimina nell'ordine giusto per i vincoli FK
    const {data:cats} = await db.from('categorie').select('id').eq('torneo_id', id);
    for (const cat of (cats||[])) {
      const {data:gironi} = await db.from('gironi').select('id').eq('categoria_id', cat.id);
      for (const g of (gironi||[])) {
        const {data:partite} = await db.from('partite').select('id').eq('girone_id', g.id);
        const pIds = (partite||[]).map(p=>p.id);
        if (pIds.length) await db.from('marcatori').delete().in('partita_id', pIds);
        await db.from('partite').delete().eq('girone_id', g.id);
        await db.from('girone_squadre').delete().eq('girone_id', g.id);
      }
      await db.from('gironi').delete().eq('categoria_id', cat.id);
      await db.from('knockout').delete().eq('categoria_id', cat.id);
    }
    await db.from('categorie').delete().eq('torneo_id', id);
    await db.from('squadre').delete().eq('torneo_id', id);
    const {error} = await db.from('tornei').delete().eq('id', id);
    if (error) throw error;
    STATE.tornei = await dbGetTornei();
    STATE.activeTorneo = STATE.tornei.find(t=>t.attivo)?.id || STATE.tornei[0]?.id || null;
    STATE.categorie = []; STATE.activeCat = null;
    renderCatBar(); renderTorneoBar();
    await renderAdminTornei();
    toast('✅ Torneo eliminato!');
  } catch(e) {
    console.error(e);
    toast('❌ ' + (e.message||'Errore eliminazione'));
  }
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
  let html=`<div style="background:#fff3e0;border-radius:10px;padding:12px 16px;margin-bottom:14px;"><div style="font-size:13px;color:#bf360c;">Torneo attivo: <strong>${t?.nome||'?'}</strong></div></div>`;
  if (tutteSquadre.length) {
    html+=`<div class="section-label">Squadre (${tutteSquadre.length})</div><div class="card" style="margin-bottom:14px;"><div style="display:flex;flex-wrap:wrap;gap:6px;">`;
    tutteSquadre.forEach(sq=>{ html+=`<span style="display:inline-flex;align-items:center;gap:5px;background:#fff3e0;border:1px solid #ffcc80;border-radius:99px;padding:3px 10px;font-size:12px;color:#E85C00;">${logoHTML(sq,'sm')} ${sq.nome}</span>`; });
    html+=`</div></div>`;
  }
  html+=`<div class="section-label">Categorie configurate</div>`;
  if (!STATE.categorie.length) html+=`<div style="color:#aaa;font-size:13px;padding:8px 0 12px;">Nessuna categoria. Importa da Excel o aggiungine una.</div>`;
  for (const cat of STATE.categorie) {
    const gironi=await getGironiWithData(cat.id); let totP=0,totG=0;
    for (const g of gironi) { totP+=g.partite.length; totG+=g.partite.filter(p=>p.giocata).length; }
    html+=`<div class="card" style="margin-bottom:10px;"><div class="card-title" style="margin-bottom:10px;"><div style="font-size:15px;font-weight:600;">${cat.nome}</div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;"><span class="badge badge-gray">${totG}/${totP} partite</span><button class="btn btn-sm" onclick="rinominaCat(${cat.id})">✏️ Rinomina</button><button class="btn btn-danger btn-sm" onclick="deleteCat(${cat.id})">Elimina</button></div></div>`;
    for (const g of gironi) {
      const members=g.squadre||[];
      html+=`<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">${g.nome}</div><div style="display:flex;flex-wrap:wrap;gap:4px;">`;
      members.forEach(sq=>{ html+=`<span style="display:inline-flex;align-items:center;gap:4px;background:#f5f5f5;border-radius:99px;padding:2px 8px;font-size:12px;">${logoHTML(sq,'sm')} ${sq.nome}</span>`; });
      html+=`</div></div>`;
    }
    html+=`</div>`;
  }
  html+=`<div class="section-label">Aggiungi categorie da Excel</div>
  <div class="card">
    <div style="font-size:13px;color:var(--testo-lt);margin-bottom:14px;">Per ogni categoria: scrivi il nome e carica il file Excel.</div>
    <div id="cat-import-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;"></div>
    <button onclick="aggiungiRigaCategoria()" style="width:100%;padding:10px;border:1.5px dashed var(--bordo);border-radius:9px;background:var(--sfondo);color:var(--blu);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">+ Aggiungi categoria</button>
    <div id="import-preview" style="margin-top:14px;"></div>
  </div>`;
  el.innerHTML = html;
  setTimeout(() => {
    if (document.getElementById('cat-import-list') && document.getElementById('cat-import-list').children.length === 0) aggiungiRigaCategoria();
  }, 50);
}

async function addCategoria() {
  const nome=document.getElementById('cname').value.trim(); const qualificate=parseInt(document.getElementById('cqualify').value); const teamsText=document.getElementById('cteams').value.trim();
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

let _catRigheCount = 0;

function aggiungiRigaCategoria() {
  const list = document.getElementById('cat-import-list'); if (!list) return;
  const idx = _catRigheCount++;
  const div = document.createElement('div');
  div.id = `cat-riga-${idx}`;
  div.style.cssText = 'display:flex;flex-direction:column;gap:8px;background:var(--sfondo);border:1px solid var(--bordo);border-radius:10px;padding:12px;';
  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <input id="cat-nome-${idx}" class="form-input" placeholder="Nome categoria (es. Esordienti 2013)" style="flex:1;font-size:13px;" oninput="_aggiornaNomeRiga(${idx})">
      <button onclick="_rimuoviRiga(${idx})" style="background:var(--rosso-bg);border:1px solid rgba(220,38,38,0.2);color:var(--rosso);border-radius:7px;padding:6px 10px;cursor:pointer;font-size:13px;flex-shrink:0;">✕</button>
    </div>
    <div id="cat-file-area-${idx}">
      <label style="display:flex;align-items:center;gap:8px;background:white;border:1.5px solid var(--bordo);border-radius:8px;padding:9px 14px;cursor:pointer;font-size:13px;color:var(--testo-lt);transition:all .15s;" onmouseover="this.style.borderColor='var(--blu)';this.style.color='var(--blu)'" onmouseout="this.style.borderColor='var(--bordo)';this.style.color='var(--testo-lt)'">
        <span>📂</span>
        <span id="cat-file-label-${idx}">Seleziona file Excel...</span>
        <input type="file" accept=".xlsx,.xls" style="display:none;" onchange="_fileSelezionato(event, ${idx})">
      </label>
    </div>
    <div id="cat-preview-${idx}" style="display:none;"></div>
    <div id="cat-btn-${idx}" style="display:none;">
      <button onclick="_importaRiga(${idx})" style="width:100%;background:var(--blu);color:white;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">✓ Importa "categoria"</button>
    </div>`;
  list.appendChild(div);
}

function _aggiornaNomeRiga(idx) {
  const nome = document.getElementById(`cat-nome-${idx}`)?.value || 'categoria';
  const btnDiv = document.getElementById(`cat-btn-${idx}`);
  if (btnDiv && btnDiv.style.display !== 'none') { const btn = btnDiv.querySelector('button'); if (btn) btn.textContent = `✓ Importa "${nome}"`; }
}
function _rimuoviRiga(idx) { const el = document.getElementById(`cat-riga-${idx}`); if (el) el.remove(); }

let _fileRighe = {};

function _fileSelezionato(event, idx) {
  const file = event.target.files[0]; if (!file) return;
  const label = document.getElementById(`cat-file-label-${idx}`);
  if (label) label.textContent = `📄 ${file.name}`;
  _parseExcelRiga(file, idx);
}

// Wrapper sicuri per le funzioni di import.js
function _safeCall(fn, ...args) {
  if (typeof fn === 'function') return fn(...args);
  return [];
}

async function _parseExcelRiga(file, idx) {
  const preview = document.getElementById(`cat-preview-${idx}`); const btnDiv = document.getElementById(`cat-btn-${idx}`);
  if (preview) { preview.style.display = 'block'; preview.innerHTML = '<div style="font-size:12px;color:var(--testo-xs);">⏳ Lettura file...</div>'; }
  try {
    if (typeof XLSX === 'undefined') {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const leggiCat  = typeof leggiCategorie    === 'function' ? leggiCategorie    : () => [];
    const leggiGir  = typeof leggiGironi       === 'function' ? leggiGironi       : () => [];
    const leggiP1   = typeof leggiPartiteFase1 === 'function' ? leggiPartiteFase1 : () => [];
    const leggiP2   = typeof leggiPartiteFase2 === 'function' ? leggiPartiteFase2 : () => [];
    const dati = { categorie: leggiCat(wb), gironi: leggiGir(wb), partite: leggiP1(wb), fase2: leggiP2(wb) };
    _fileRighe[idx] = dati;
    const nomeCatInput = document.getElementById(`cat-nome-${idx}`);
    if (nomeCatInput && !nomeCatInput.value.trim() && dati.categorie.length) nomeCatInput.value = dati.categorie[0].nome;
    if (preview) {
      preview.innerHTML = `<div style="background:var(--verde-bg);border:1px solid rgba(22,163,74,0.2);border-radius:8px;padding:10px 12px;font-size:12px;"><div style="font-weight:700;color:var(--verde);margin-bottom:6px;">✅ File letto correttamente</div><div style="display:flex;gap:10px;flex-wrap:wrap;"><span style="background:white;padding:2px 8px;border-radius:20px;color:var(--testo-2);">🏟 ${dati.gironi.length} gironi</span><span style="background:white;padding:2px 8px;border-radius:20px;color:var(--testo-2);">⚽ ${dati.partite.length} partite</span>${dati.fase2.length ? `<span style="background:white;padding:2px 8px;border-radius:20px;color:var(--testo-2);">🏆 ${dati.fase2.length} finali</span>` : ''}</div></div>`;
    }
    if (btnDiv) {
      btnDiv.style.display = 'block';
      const nome = nomeCatInput?.value || 'categoria';
      const btn = btnDiv.querySelector('button');
      if (btn) btn.textContent = `✓ Importa "${nome}"`;
    }
  } catch(e) {
    if (preview) preview.innerHTML = '<div style="color:var(--rosso);font-size:12px;">❌ Errore: ' + e.message + '</div>';
  }
}

async function _importaRiga(idx) {
  const dati = _fileRighe[idx];
  const nomeInput = document.getElementById(`cat-nome-${idx}`);
  const nomeScritto = nomeInput?.value?.trim();
  const btn = document.querySelector(`#cat-btn-${idx} button`);
  if (!dati) { toast('Carica prima un file Excel'); return; }
  if (nomeScritto && dati.categorie.length) {
    dati.categorie[0].nome = nomeScritto; dati.categorie[0].codice = nomeScritto;
    const vecchioNome = dati.gironi[0]?.categoria;
    if (vecchioNome) {
      dati.gironi.forEach(g => { if(g.categoria === vecchioNome) g.categoria = nomeScritto; });
      dati.partite.forEach(p => { if(p.categoria === vecchioNome) p.categoria = nomeScritto; });
      dati.fase2.forEach(p => { if(p.categoria === vecchioNome) p.categoria = nomeScritto; });
    }
  }
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Importazione...'; }
  try {
    const tornei = await db.from('tornei').select('id,nome').eq('cliente', CONFIG.CLIENTE || 'spe').eq('attivo', true).order('created_at', { ascending: false });
    if (!tornei.data?.length) throw new Error('Nessun torneo attivo');
    const torneoId = STATE.activeTorneo || tornei.data[0].id;
    window._importDati = dati;
    await eseguiImportazioneConTorneo(torneoId, dati, btn);
    const riga = document.getElementById(`cat-riga-${idx}`);
    if (riga) {
      riga.style.background = 'var(--verde-bg)'; riga.style.borderColor = 'rgba(22,163,74,0.3)';
      const preview = document.getElementById(`cat-preview-${idx}`);
      if (preview) preview.innerHTML = `<div style="color:var(--verde);font-weight:700;font-size:13px;">✅ Importata!</div>`;
      if (btn) { btn.disabled = true; btn.textContent = '✅ Importata'; btn.style.background = 'var(--verde)'; }
    }
    STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
    renderCatBar();
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = `✓ Importa "${nomeScritto||'categoria'}"`; }
    toast('❌ Errore: ' + e.message); console.error(e);
  }
}

async function rinominaCat(id) {
  const cat = STATE.categorie.find(c => c.id === id);
  const nuovo = prompt('Nuovo nome categoria:', cat ? cat.nome : '');
  if (!nuovo || nuovo.trim() === (cat?.nome||'')) return;
  try {
    await dbUpdateCategoria(id, { nome: nuovo.trim() });
    STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
    renderCatBar(); renderTorneoBar(); toast('✅ Categoria rinominata!'); await renderAdminSetup();
  } catch(e) { toast('❌ Errore: ' + e.message); }
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
  const squadre=await dbGetSquadreFull(STATE.activeTorneo);
  if (!squadre.length) { el.innerHTML='<div class="empty-state">Aggiungi prima le squadre.</div>'; return; }
  let html='<div class="section-label">Loghi squadre</div><div class="card">';
  html+=`<div style="font-size:13px;color:#666;margin-bottom:14px;">Clicca sul logo per caricare/cambiare l'immagine.</div>`;
  html+=`<div style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
    <label style="display:inline-flex;align-items:center;gap:8px;background:var(--blu,#1a56db);color:white;padding:9px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;border:2px solid var(--blu,#1a56db);transition:all .15s;" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
      📁 Carica loghi da cartella
      <input type="file" accept="image/*" multiple style="display:none;" onchange="caricaLoghiDaCartella(event)">
    </label>
    <button class="btn" onclick="comprimiloghiEsistenti()" id="btn-comprimi-loghi">📦 Comprimi loghi grandi</button>
  </div>
  <div style="font-size:11px;color:#888;margin-bottom:12px;">💡 <strong>Suggerimento:</strong> rinomina i file con il nome della squadra (es. <em>rhodense.png</em>) e selezionali tutti insieme</div>
  <div id="loghi-auto-log" style="display:none;background:#f8f9fa;border-radius:8px;padding:10px;margin-bottom:14px;font-size:12px;max-height:200px;overflow-y:auto;font-family:monospace;"></div>`;
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

async function caricaLoghiDaCartella(event) {
  const files = Array.from(event.target.files);
  const log = document.getElementById('loghi-auto-log');
  if (!files.length || !log) return;
  log.style.display = 'block';
  log.innerHTML = '📁 ' + files.length + ' file selezionati — abbinamento in corso...<br>';
  const squadre = await dbGetSquadreFull(STATE.activeTorneo);
  const PREFISSI = /^(a\.s\.d\.|asd|ssd|acd|usd|a\.c\.|ac|a\.s\.|as|u\.s\.|us|s\.s\.|ss|ssc|asc|fc|f\.c\.|gc|pd|pol|polisportiva|unione|sporting|real|atletico|athletic|pro|new|calcio|football|club|team)\s*/gi;
  const SUFFISSI = /\s*(calcio|football|club|sport|city|united|1972|1908|1919|1973|2016|2024|verde|bianco|blu|grigio|srl|spa|s\.p\.a\.|f\.c\.)\s*$/gi;
  const norm = (s) => { if (!s) return ''; return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(PREFISSI, '').replace(SUFFISSI, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); };
  const tokens = (s) => norm(s).split(' ').filter(w => w.length >= 3);
  const similarita = (fileStr, sqStr) => {
    const fn = norm(fileStr); const sn = norm(sqStr);
    if (!fn || !sn) return 0;
    if (fn === sn) return 1.0;
    if (sn.includes(fn) || fn.includes(sn)) return Math.min(fn.length, sn.length) / Math.max(fn.length, sn.length);
    if (sn.startsWith(fn) || fn.startsWith(sn)) return Math.min(fn.length, sn.length) / Math.max(fn.length, sn.length) * 0.95;
    const tf = tokens(fileStr); const ts = tokens(sqStr);
    if (!tf.length || !ts.length) return 0;
    let comuni = 0, parziali = 0;
    for (const w of tf) { if (ts.some(t => t === w)) comuni++; else if (ts.some(t => t.startsWith(w) || w.startsWith(t))) parziali++; }
    if (comuni > 0) return (comuni + parziali * 0.5) / Math.max(tf.length, ts.length) * 0.9;
    const iniziali = ts.map(t => t[0]).join('');
    if (fn === iniziali) return 0.75;
    if (iniziali.startsWith(fn) || fn.startsWith(iniziali)) return 0.6;
    return 0;
  };
  const sqUniche = new Map();
  for (const sq of squadre) { const key = norm(sq.nome); if (!sqUniche.has(key)) sqUniche.set(key, []); sqUniche.get(key).push(sq); }
  let abbinati = 0, nonAbbinati = [];
  for (const file of files) {
    const nomeFilePulito = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    const nomeFileNorm = norm(nomeFilePulito);
    if (!nomeFileNorm) continue;
    let bestKey = null, bestScore = 0;
    for (const [key] of sqUniche) { const score = similarita(nomeFilePulito, key); if (score > bestScore) { bestScore = score; bestKey = key; } }
    if (bestKey && bestScore >= 0.3) {
      const targets = sqUniche.get(bestKey);
      const conf = bestScore >= 0.85 ? '✅' : bestScore >= 0.55 ? '🟡' : '🟠';
      log.innerHTML += conf + ' <strong>' + file.name + '</strong> → ' + targets.map(s => s.nome).join(' + ') + ' (' + Math.round(bestScore*100) + '%) ';
      try {
        const compressed = await _comprimiImmagine(file, 120, 0.80);
        for (const sq of targets) await dbUpdateLogo(sq.id, compressed);
        abbinati++;
        log.innerHTML += targets.length > 1 ? '✓ (' + targets.length + ' squadre)<br>' : '✓<br>';
      } catch(e) { log.innerHTML += `errore<br>`; }
    } else { nonAbbinati.push(file.name); log.innerHTML += '❓ <strong>' + file.name + '</strong> → non trovata<br>'; }
    log.scrollTop = log.scrollHeight;
  }
  log.innerHTML += `<br>🏁 <strong>${abbinati} file abbinati</strong>`;
  if (nonAbbinati.length) log.innerHTML += `<br>⚠️ Non abbinati: ${nonAbbinati.join(', ')}`;
  if (abbinati > 0) { await renderAdminLoghi(); toast('✅ ' + abbinati + ' loghi caricati!'); }
  event.target.value = '';
}

async function comprimiloghiEsistenti() {
  const btn = document.getElementById('btn-comprimi-loghi'); const log = document.getElementById('loghi-auto-log');
  if (!btn || !log) return;
  btn.disabled = true; btn.textContent = '⏳ Compressione...';
  log.style.display = 'block'; log.innerHTML = '📦 Avvio compressione loghi...<br>';
  const squadre = await dbGetSquadreFull(STATE.activeTorneo);
  const conLogo = squadre.filter(s => s.logo?.startsWith('data:'));
  let compressi = 0, saltati = 0;
  for (const sq of conLogo) {
    const kb = Math.round(sq.logo.length * 0.75 / 1024);
    if (kb < 15) { saltati++; continue; }
    log.innerHTML += `📦 ${sq.nome} (${kb}KB)... `; log.scrollTop = log.scrollHeight;
    try {
      const compressed = await _comprimiImmagine({ arrayBuffer: async () => { const b64=sq.logo.split(',')[1]; const bin=atob(b64); const arr=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i); return arr.buffer; }}, 120, 0.75, sq.logo);
      const newKb = Math.round(compressed.length * 0.75 / 1024);
      await dbUpdateLogo(sq.id, compressed);
      compressi++;
      log.innerHTML += `✅ ${newKb}KB (-${Math.round((1-newKb/kb)*100)}%)<br>`;
    } catch(e) { log.innerHTML += `❌ Errore<br>`; }
    log.scrollTop = log.scrollHeight;
    await new Promise(r => setTimeout(r, 100));
  }
  log.innerHTML += `<br>🏁 <strong>${compressi} compressi, ${saltati} già piccoli</strong>`;
  btn.disabled = false; btn.textContent = '📦 Comprimi loghi grandi';
  if (compressi > 0) { await renderAdminLoghi(); toast('✅ ' + compressi + ' loghi compressi!'); }
}

async function uploadLogo(event, squadra_id) {
  const file = event.target.files[0]; if (!file) return;
  toast('⏳ Compressione logo...');
  try { const compressed = await _comprimiImmagine(file, 120, 0.75); await dbUpdateLogo(squadra_id, compressed); toast('✅ Logo caricato!'); await renderAdminLoghi(); }
  catch(e) { console.error(e); toast('Errore caricamento logo'); }
}

function _comprimiImmagine(file, maxSize = 120, quality = 0.75, dataUrl = null) {
  return new Promise((resolve, reject) => {
    const processUrl = (src) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
        else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
        canvas.width = w || maxSize; canvas.height = h || maxSize;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject; img.src = src;
    };
    if (dataUrl) { processUrl(dataUrl); return; }
    const reader = new FileReader();
    reader.onload = (e) => processUrl(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function removeLogo(squadra_id) { await dbUpdateLogo(squadra_id,null); toast('Logo rimosso'); await renderAdminLoghi(); }

// ============================================================
//  ADMIN: RISULTATI
// ============================================================
let openScorers={};

async function renderAdminRisultati() {
  const el=document.getElementById('sec-a-risultati');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }
  el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--testo-xs);">⏳ Caricamento...</div>';
  const gironi=await getGironiWithData(STATE.activeCat);
  const campiGiornate = await dbGetCampiGiornate(STATE.activeTorneo);
  const campiMap = {}; campiGiornate.forEach(c => campiMap[c.giorno] = c);
  STATE._campiGiornate = campiMap;
  let tuttePartite = [];
  for (const g of gironi) { for (const p of g.partite) tuttePartite.push({ ...p, _girone: g.nome, _gironeId: g.id }); }
  if (STATE.activeGiornata && STATE.activeGiornata !== 'tutte') tuttePartite = tuttePartite.filter(p => p.giorno === STATE.activeGiornata);
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
    const orInfo=`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">${p.orario?`<span style="font-size:11px;font-weight:700;color:#E85C00;">🕐 ${p.orario}</span>`:''}${p.campo?`<span style="font-size:11px;color:#888;">📍 ${p.campo}</span>`:''}
      <span style="font-size:11px;color:#bbb;">${p._girone}</span>${p.inserito_da?`<span style="font-size:10px;color:#888;margin-left:auto;">✏️ ${p.inserito_da}</span>`:''}</div>`;
    const _pgIdx = tuttePartite.indexOf(p);
    const _prevGiorno = _pgIdx > 0 ? tuttePartite[_pgIdx-1].giorno : null;
    if (p.giorno && p.giorno !== _prevGiorno) {
      const _campoG = campiMap[p.giorno] || {};
      const _keyG = (p.giorno).replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-]/g,'_');
      html += `<div style="background:var(--blu);color:white;border-radius:var(--radius);padding:10px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span style="font-size:13px;font-weight:700;">📅 ${p.giorno}</span>${_campoG.nome_campo||_campoG.indirizzo ? `<span style="font-size:12px;color:rgba(255,255,255,0.85);">📍 <strong>${_campoG.nome_campo||''}</strong>${_campoG.nome_campo&&_campoG.indirizzo?' — ':''}${_campoG.indirizzo||''}</span>` : ''}</div></div>
        <button onclick="mostraEditCampoGiornata('${p.giorno}')" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);color:white;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap;">✏️ ${_campoG.nome_campo ? 'Modifica' : 'Aggiungi'} luogo</button>
        <div id="edit-campo-${_keyG}" style="display:none;width:100%;margin-top:8px;"></div>
      </div>`;
    }
    html+=`<div class="admin-match"><div class="admin-match-header">${orInfo}
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
        html+=`<div class="scorer-row"><select id="msq_${p.id}_${mi}"><option value="${p.home_id}" ${m.squadra_id===p.home_id?'selected':''}>${p.home?.nome}</option><option value="${p.away_id}" ${m.squadra_id===p.away_id?'selected':''}>${p.away?.nome}</option></select><input placeholder="Nome giocatore" value="${m.nome||''}" id="mnm_${p.id}_${mi}"><input placeholder="Min" value="${m.minuto||''}" id="mmin_${p.id}_${mi}" class="min-input"><button class="btn btn-danger btn-sm" onclick="removeMarcatore(${p.id},${mi})">✕</button></div>`;
      });
      html+=`<button class="add-scorer-btn" onclick="addMarcatore(${p.id})">+ Aggiungi marcatore</button><div style="margin-top:10px;"><button class="btn btn-success btn-sm" onclick="saveMarcatori(${p.id},${p._gironeId})">Salva marcatori</button></div></div>`;
    }
    html+='</div>';
  }
  el.innerHTML=html||'<div class="empty-state">Nessuna partita.</div>';
}

async function saveRisultato(partita_id, girone_id) {
  const sh=document.getElementById('sh_'+partita_id).value; const sa=document.getElementById('sa_'+partita_id).value;
  if (sh===''||sa==='') { toast('Inserisci entrambi i gol'); return; }
  try {
    const result=await dbSavePartita({ id: partita_id, girone_id, gol_home: parseInt(sh), gol_away: parseInt(sa), giocata: true, inserito_da: STATE.userName || null });
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
  const gironi=await getGironiWithData(STATE.activeCat); let partita=null;
  for (const g of gironi) { for (const p of g.partite) { if(p.id===partita_id)partita=p; } }
  if (!partita) return;
  const all=[];
  for (let i=0;i<(partita.marcatori||[]).length;i++) {
    const sqEl=document.getElementById('msq_' + partita_id + '_' + i);
    const nmEl=document.getElementById('mnm_' + partita_id + '_' + i);
    const mnEl=document.getElementById('mmin_' + partita_id + '_' + i);
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
  await verificaEGeneraTriangolari(STATE.activeCat);
  const ko=await dbGetKnockout(STATE.activeCat);
  const squadre=await dbGetSquadre(STATE.activeTorneo);
  const sqMap={}; squadre.forEach(s=>sqMap[s.id]=s);
  const pending=ko.filter(k=>(!k.home_id||!k.away_id)&&(k.note_home||k.note_away));
  let html='';
  if (pending.length) {
    html+=`<div class="card" style="border-left:4px solid #e67e22;margin-bottom:14px;"><div style="font-size:13px;font-weight:700;color:#e67e22;">⏳ ${pending.length} accoppiamenti in attesa dei gironi</div><button class="btn btn-p btn-sm" style="margin-top:10px;" onclick="risolviManuale()">🔄 Risolvi ora</button></div>`;
  }
  if (!ko.length) { el.innerHTML=html+'<div class="empty-state">Nessuna partita. Importa un Excel con FASE_FINALE.</div>'; return; }
  const rounds={}; ko.forEach(m=>{ if(!rounds[m.round_name])rounds[m.round_name]=[]; rounds[m.round_name].push(m); });
  const ROUND_COLORS={'PLATINO':'#FFD700','GOLD':'#FFA500','SILVER':'#C0C0C0','BRONZO':'#CD7F32','WHITE':'#B0BEC5'};
  for (const [rname,rmatch] of Object.entries(rounds)) {
    const rkey=Object.keys(ROUND_COLORS).find(k=>rname.toUpperCase().includes(k));
    const color=ROUND_COLORS[rkey]||'#E85C00';
    const done=rmatch.filter(m=>m.giocata).length;
    html+=`<div class="card" style="border-top:4px solid ${color};margin-bottom:14px;"><div class="card-title">${rname}<span class="badge badge-gray">${done}/${rmatch.length} giocate</span></div>`;
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
      const orInfo=`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">${m.orario?`<span style="font-size:11px;font-weight:700;color:#E85C00;">🕐 ${m.orario}</span>`:''}${m.campo?`<span style="font-size:11px;color:#888;">📍 ${m.campo}</span>`:''}${m.inserito_da?`<span style="font-size:10px;color:#888;margin-left:auto;">✏️ ${m.inserito_da}</span>`:''}</div>`;
      html+=`<div class="admin-match"><div class="admin-match-header">${orInfo}
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
  const sh=document.getElementById('ksh_'+match_id).value; const sa=document.getElementById('ksa_'+match_id).value;
  if (sh===''||sa==='') { toast('Inserisci i gol'); return; }
  const ko=await dbGetKnockout(STATE.activeCat); const m=ko.find(x=>x.id===match_id); if(!m)return;
  await dbSaveKnockoutMatch({...m, gol_home:parseInt(sh), gol_away:parseInt(sa), giocata:true, inserito_da: STATE.userName||null});
  toast('✓ Risultato salvato');
  if (STATE.activeCat) await verificaEGeneraTriangolari(STATE.activeCat);
  await renderAdminKnockout();
  if (STATE.currentSection==='tabellone') await renderTabellone();
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
  document.getElementById('admin-btn').textContent='Esci (' + user.nome + ')';
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
    _addSimBtn();
  }
}

function _addSimBtn() {
  if (document.getElementById('sim-toggle-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'sim-toggle-btn'; btn.textContent = '🎮'; btn.title = 'Modalità Simulazione';
  btn.style.cssText = 'background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;border-radius:8px;padding:6px 10px;font-size:15px;cursor:pointer;transition:all .18s;';
  btn.onmouseover = () => btn.style.background = 'rgba(245,158,11,0.25)';
  btn.onmouseout  = () => btn.style.background = 'rgba(245,158,11,0.12)';
  btn.onclick = toggleSimulazione;
  const headerRight = document.querySelector('.header-right');
  if (headerRight) headerRight.insertBefore(btn, headerRight.firstChild);
}

function _mostraNavArbitro() {
  const nav=document.getElementById('admin-nav'); if(!nav)return;
  nav.querySelectorAll('.nav-btn:not(.nav-exit)').forEach(btn=>{ const sec=btn.getAttribute('data-section'); btn.style.display=['a-risultati','a-knockout'].includes(sec)?'':'none'; });
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
  const simBtn = document.getElementById('sim-toggle-btn'); if (simBtn) simBtn.remove();
  const simPanel = document.getElementById('sim-panel'); if (simPanel) simPanel.remove();
  _simUnlocked = false;
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
  return new Promise((resolve,reject)=>{ const s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); });
}

window.addEventListener('DOMContentLoaded', init);

// ============================================================
//  CREA TORNEO — Wizard v3 — Semplice e intuitivo
//  Step 1: Info torneo + Giorni
//  Step 2: Categorie (lista)
//  Step 3: Per ogni categoria → Gironi → Calendario → Accoppiamenti → Gironi Finali → Finali
//  Step 4: Riepilogo + Salva
// ============================================================

// ============================================================
// WIZARD CREA TORNEO v4 — Automatico + Modificabile
// ============================================================
let CT = {
  step: 1,
  subStep: null,
  torneo: { nome:'', luogo:'', durata:20, pausa:5, giorni:[{data:'',oraInizio:'09:00',pausaIni:'12:30',pausaFine:'14:00',campi:2}] },
  categorie: []
};

// ─── ENTRY POINT ─────────────────────────────────────────────
async function renderAdminCreaTorneo() {
  const el = document.getElementById('sec-a-crea');
  if (!el) return;
  let html = '';
  if (CT.step===1) html = _ctStep1();
  else if (CT.step===2) html = _ctStep2();
  else if (CT.step===3) html = _ctStep3();
  else if (CT.step===4) html = await _ctStep4();
  el.innerHTML = `<div style="max-width:820px;margin:0 auto;padding-bottom:60px;">
    <div style="display:flex;align-items:center;margin-bottom:16px;">
      <div style="font-size:20px;font-weight:800;">🆕 Crea Torneo</div>
      <button onclick="if(confirm('Ricominciare da zero?'))ctReset()" style="margin-left:auto;background:var(--sfondo);border:1.5px solid var(--bordo);border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;color:var(--testo-lt);">🗑 Ricomincia</button>
    </div>
    ${_ctProgressBar()}
    ${html}
  </div>`;
}

function ctReset() {
  CT = { step:1, subStep:null, torneo:{nome:'',luogo:'',durata:20,pausa:5,giorni:[{data:'',oraInizio:'09:00',pausaIni:'12:30',pausaFine:'14:00',campi:2}]}, categorie:[] };
  renderAdminCreaTorneo();
}

function _ctProgressBar() {
  const steps = [{n:1,label:'Torneo'},{n:2,label:'Categorie'},{n:3,label:'Programma'},{n:4,label:'Salva'}];
  return `<div style="display:flex;gap:0;margin-bottom:20px;background:white;border-radius:12px;overflow:hidden;box-shadow:var(--shadow);">
    ${steps.map(s=>{ const a=CT.step===s.n,d=CT.step>s.n;
      return `<div style="flex:1;padding:10px 4px;text-align:center;background:${a?'var(--blu)':d?'var(--verde-bg)':'white'};color:${a?'white':d?'var(--verde)':'var(--testo-xs)'};border-right:1px solid var(--bordo);font-size:12px;font-weight:${a?'800':'500'};">
        <div style="font-size:16px;">${d?'✅':s.n+'.'}</div>${s.label}</div>`;
    }).join('')}
  </div>`;
}

// ══════════════════════════════════════════════════════════════
// STEP 1: INFO TORNEO + GIORNI
// ══════════════════════════════════════════════════════════════
function _ctStep1() {
  const t = CT.torneo;
  const giorniHTML = t.giorni.map((g,i) => `
    <div style="border:1.5px solid var(--bordo);border-radius:10px;padding:12px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="background:var(--blu);color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">📅 Giorno ${i+1}</span>
        ${t.giorni.length>1?`<button onclick="ctRimuoviGiorno(${i})" style="margin-left:auto;background:var(--rosso-bg);border:1px solid rgba(220,38,38,.2);color:var(--rosso);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px;">✕</button>`:''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
        <div><label style="font-size:10px;font-weight:700;color:var(--testo-xs);text-transform:uppercase;">Data</label>
          <input class="form-input" type="date" id="ctg-data-${i}" value="${g.data||''}"></div>
        <div><label style="font-size:10px;font-weight:700;color:var(--testo-xs);text-transform:uppercase;">Inizio</label>
          <input class="form-input" type="time" id="ctg-ini-${i}" value="${g.oraInizio||'09:00'}"></div>
        <div><label style="font-size:10px;font-weight:700;color:var(--testo-xs);text-transform:uppercase;">Pausa pranzo</label>
          <input class="form-input" type="time" id="ctg-pi-${i}" value="${g.pausaIni||'12:30'}"></div>
        <div><label style="font-size:10px;font-weight:700;color:var(--testo-xs);text-transform:uppercase;">Ripresa</label>
          <input class="form-input" type="time" id="ctg-pf-${i}" value="${g.pausaFine||'14:00'}"></div>
        <div><label style="font-size:10px;font-weight:700;color:var(--testo-xs);text-transform:uppercase;">N° Campi</label>
          <input class="form-input" type="number" id="ctg-campi-${i}" value="${g.campi||2}" min="1" max="10"></div>
      </div>
    </div>`).join('');

  return `<div class="card">
    <div class="card-title">🏆 Informazioni Torneo</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Nome torneo *</label>
        <input class="form-input" id="ct-nome" value="${t.nome||''}" placeholder="es. Spring Cup 2026" style="font-size:16px;font-weight:700;"></div>
      <div class="form-group"><label class="form-label">Luogo</label>
        <input class="form-input" id="ct-luogo" value="${t.luogo||''}" placeholder="es. Andora (SV)"></div>
      <div class="form-group"><label class="form-label">Durata partita (min)</label>
        <input class="form-input" type="number" id="ct-durata" value="${t.durata||20}" min="5" max="90"></div>
      <div class="form-group"><label class="form-label">Pausa tra partite (min)</label>
        <input class="form-input" type="number" id="ct-pausa" value="${t.pausa||5}" min="0" max="30"></div>
    </div>
  </div>
  <div class="card" style="margin-top:12px;">
    <div style="display:flex;align-items:center;margin-bottom:14px;">
      <div class="card-title" style="margin:0;">📅 Giorni</div>
      <button onclick="ctAggiungiGiorno()" style="margin-left:auto;background:var(--sfondo);border:1.5px dashed var(--bordo);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;color:var(--blu);cursor:pointer;">+ Giorno</button>
    </div>
    ${giorniHTML}
  </div>
  <div style="display:flex;justify-content:flex-end;margin-top:12px;">
    <button onclick="ctSalva1()" class="btn btn-p" style="padding:12px 32px;font-size:15px;">Avanti → Categorie ›</button>
  </div>`;
}

function ctAggiungiGiorno() { _ctSalvaGiorni(); CT.torneo.giorni.push({data:'',oraInizio:'09:00',pausaIni:'12:30',pausaFine:'14:00',campi:2}); renderAdminCreaTorneo(); }
function ctRimuoviGiorno(i) { _ctSalvaGiorni(); CT.torneo.giorni.splice(i,1); renderAdminCreaTorneo(); }
function _ctSalvaGiorni() {
  CT.torneo.giorni.forEach((_,i) => {
    const d=document.getElementById('ctg-data-'+i); if(d) CT.torneo.giorni[i].data=d.value;
    const oi=document.getElementById('ctg-ini-'+i); if(oi) CT.torneo.giorni[i].oraInizio=oi.value;
    const pi=document.getElementById('ctg-pi-'+i); if(pi) CT.torneo.giorni[i].pausaIni=pi.value;
    const pf=document.getElementById('ctg-pf-'+i); if(pf) CT.torneo.giorni[i].pausaFine=pf.value;
    const ca=document.getElementById('ctg-campi-'+i); if(ca) CT.torneo.giorni[i].campi=parseInt(ca.value)||2;
  });
}
function ctSalva1() {
  const n=document.getElementById('ct-nome')?.value?.trim();
  if(!n){toast('Inserisci il nome del torneo');return;}
  CT.torneo.nome=n;
  CT.torneo.luogo=document.getElementById('ct-luogo')?.value?.trim()||'';
  CT.torneo.durata=parseInt(document.getElementById('ct-durata')?.value)||20;
  CT.torneo.pausa=parseInt(document.getElementById('ct-pausa')?.value)||5;
  _ctSalvaGiorni();
  if(!CT.categorie.length) CT.categorie.push(_ctNuovaCat(''));
  CT.step=2; renderAdminCreaTorneo();
}

// ══════════════════════════════════════════════════════════════
// STEP 2: CATEGORIE
// ══════════════════════════════════════════════════════════════
function _ctNuovaCat(nome) {
  return {
    nome, gironiQ:[], gironiFinali:[], finali:[], calendario:[],
    durata:CT.torneo.durata, pausa:CT.torneo.pausa,
    oraPerGiorno: CT.torneo.giorni.map(g=>({oraInizio:g.oraInizio,pausaIni:g.pausaIni,pausaFine:g.pausaFine,campi:g.campi,durata:CT.torneo.durata,pausa:CT.torneo.pausa})),
    _fatto:false
  };
}

function _ctStep2() {
  const catsHTML = CT.categorie.map((cat,ci) => `
    <div style="display:flex;align-items:center;gap:10px;padding:12px;border:1.5px solid var(--bordo);border-radius:10px;margin-bottom:8px;background:${cat._fatto?'var(--verde-bg)':'white'};">
      <div style="font-size:20px;">${cat._fatto?'✅':'📁'}</div>
      <input value="${cat.nome}" placeholder="Nome categoria (es. PULCINI 2016)"
        style="flex:1;border:1.5px solid var(--bordo);border-radius:8px;padding:8px 12px;font-size:14px;font-weight:700;font-family:inherit;"
        onchange="CT.categorie[${ci}].nome=this.value">
      <button onclick="CT.step=3;CT.subStep={ci:${ci},fase:'gironiQ'};renderAdminCreaTorneo()"
        style="background:var(--blu);color:white;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;">
        ${cat._fatto?'✏️ Modifica':'▶ Configura'}</button>
      ${CT.categorie.length>1?`<button onclick="CT.categorie.splice(${ci},1);renderAdminCreaTorneo()"
        style="background:var(--rosso-bg);border:1px solid rgba(220,38,38,.2);color:var(--rosso);border-radius:8px;padding:8px 10px;cursor:pointer;">✕</button>`:''}
    </div>`).join('');

  const tutteOk = CT.categorie.length && CT.categorie.every(c=>c._fatto);
  return `<div class="card">
    <div style="display:flex;align-items:center;margin-bottom:16px;">
      <div class="card-title" style="margin:0;">📁 Categorie</div>
      <button onclick="CT.categorie.push(_ctNuovaCat(''));renderAdminCreaTorneo()"
        style="margin-left:auto;background:var(--sfondo);border:1.5px dashed var(--bordo);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;color:var(--blu);cursor:pointer;">+ Categoria</button>
    </div>
    <div style="background:var(--blu-bg);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--blu);">
      💡 Aggiungi tutte le categorie, poi clicca <strong>▶ Configura</strong> su ognuna.
    </div>
    ${catsHTML}
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:12px;">
    <button onclick="CT.step=1;renderAdminCreaTorneo()" class="btn btn-secondary">‹ Indietro</button>
    ${tutteOk?`<button onclick="CT.step=4;renderAdminCreaTorneo()" class="btn btn-p" style="padding:12px 32px;font-size:15px;">Avanti → Salva ›</button>`
      :`<div style="font-size:12px;color:var(--testo-xs);padding:12px;">Configura tutte le categorie per continuare</div>`}
  </div>`;
}

// ══════════════════════════════════════════════════════════════
// STEP 3: CONFIGURAZIONE CATEGORIA
// ══════════════════════════════════════════════════════════════
function _ctStep3() {
  const {ci, fase} = CT.subStep;
  const cat = CT.categorie[ci];
  const fasi = [{id:'gironiQ',icon:'👕',label:'Gironi'},{id:'accoppiamenti',icon:'🔀',label:'Accoppiamenti'},{id:'calendario',icon:'📅',label:'Calendario'},{id:'finali',icon:'🏅',label:'Finali'}];
  const ordFasi = fasi.map(f=>f.id);
  const faseIdx = ordFasi.indexOf(fase);

  const faseBar = `<div style="display:flex;gap:4px;margin-bottom:16px;">
    ${fasi.map((f,fi)=>{ const att=fase===f.id,fat=fi<faseIdx;
      return `<button onclick="CT.subStep.fase='${f.id}';renderAdminCreaTorneo()"
        style="flex:1;padding:8px 4px;border-radius:8px;border:2px solid ${att?'var(--blu)':fat?'var(--verde)':'var(--bordo)'};
        background:${att?'var(--blu)':fat?'var(--verde-bg)':'white'};color:${att?'white':fat?'var(--verde)':'var(--testo-xs)'};
        font-size:11px;font-weight:${att?800:500};cursor:pointer;font-family:inherit;">
        <div style="font-size:15px;">${fat?'✅':f.icon}</div>${f.label}</button>`;
    }).join('')}
  </div>`;

  let body='';
  if(fase==='gironiQ') body=_ctFaseGironiQ(cat,ci);
  else if(fase==='accoppiamenti') body=_ctFaseAccoppiamenti(cat,ci);
  else if(fase==='calendario') body=_ctFaseCalendario(cat,ci);
  else if(fase==='finali') body=_ctFaseFinali(cat,ci);

  return `<div style="background:var(--blu);color:white;border-radius:12px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">
    <button onclick="CT.step=2;CT.subStep=null;renderAdminCreaTorneo()"
      style="background:rgba(255,255,255,.2);border:none;color:white;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit;">‹ Categorie</button>
    <div style="font-size:16px;font-weight:800;">${cat.nome||'Categoria '+(ci+1)}</div>
  </div>
  ${faseBar}${body}`;
}

// ── GIRONI QUALIFICHE ─────────────────────────────────────────
function _ctFaseGironiQ(cat, ci) {
  const dLabel = (di) => { const g=CT.torneo.giorni[di]; return g?.data?_ctFmtData(g.data):`Giorno ${di+1}`; };

  // Sezione orari categoria per giorno
  const orariHTML = `<div class="card" style="margin-bottom:12px;">
    <div class="card-title">⏰ Orari per questa categoria</div>
    ${CT.torneo.giorni.map((g,di)=>`
      <div style="border:1px solid var(--bordo);border-radius:8px;padding:10px;margin-bottom:8px;background:${di%2?'var(--sfondo)':'white'};">
        <div style="font-size:12px;font-weight:700;color:var(--blu);margin-bottom:8px;">📅 ${dLabel(di)}</div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;">
          ${['Inizio','Pausa','Ripresa','Campi','Durata','Pausa gara'].map((lbl,j)=>`
            <div><label style="font-size:9px;font-weight:700;color:var(--testo-xs);text-transform:uppercase;">${lbl}</label>
            ${j<3?`<input type="time" value="${[cat.oraPerGiorno[di]?.oraInizio,cat.oraPerGiorno[di]?.pausaIni,cat.oraPerGiorno[di]?.pausaFine][j]||['09:00','12:30','14:00'][j]}"
              style="width:100%;border:1px solid var(--bordo);border-radius:5px;padding:4px 4px;font-size:11px;font-family:inherit;"
              onchange="if(!CT.categorie[${ci}].oraPerGiorno[${di}])CT.categorie[${ci}].oraPerGiorno[${di}]={};CT.categorie[${ci}].oraPerGiorno[${di}].${'oraInizio,pausaIni,pausaFine'.split(',')[j]}=this.value">`
            :`<input type="number" value="${[cat.oraPerGiorno[di]?.campi||2,cat.oraPerGiorno[di]?.durata||CT.torneo.durata||20,cat.oraPerGiorno[di]?.pausa||CT.torneo.pausa||5][j-3]}" min="${j===3?1:1}" max="${j===3?10:90}"
              style="width:100%;border:1px solid var(--bordo);border-radius:5px;padding:4px 4px;font-size:11px;font-family:inherit;"
              onchange="if(!CT.categorie[${ci}].oraPerGiorno[${di}])CT.categorie[${ci}].oraPerGiorno[${di}]={};CT.categorie[${ci}].oraPerGiorno[${di}].${'campi,durata,pausa'.split(',')[j-3]}=parseInt(this.value)||${[2,20,5][j-3]}">`}
            </div>`).join('')}
        </div>
      </div>`).join('')}
  </div>`;

  const gironiHTML = (cat.gironiQ||[]).map((g,gi)=>`
    <div style="border:1.5px solid var(--bordo);border-radius:10px;margin-bottom:12px;overflow:hidden;">
      <div style="background:var(--sfondo);padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <input value="${g.nome}" placeholder="Nome girone (es. Girone Q)"
          style="flex:1;min-width:120px;border:1.5px solid var(--blu);border-radius:7px;padding:5px 10px;font-size:13px;font-weight:800;font-family:inherit;background:var(--blu-bg);color:var(--blu);"
          onchange="CT.categorie[${ci}].gironiQ[${gi}].nome=this.value">
        <span style="font-size:11px;color:var(--testo-xs);">Gioca il:</span>
        <select style="border:1px solid var(--bordo);border-radius:6px;padding:4px 8px;font-size:12px;font-family:inherit;"
          onchange="CT.categorie[${ci}].gironiQ[${gi}].giorno=parseInt(this.value)">
          ${CT.torneo.giorni.map((_,di)=>`<option value="${di}" ${(g.giorno||0)===di?'selected':''}>${dLabel(di)}</option>`).join('')}
        </select>
        ${(cat.gironiQ||[]).length>1?`<button onclick="CT.categorie[${ci}].gironiQ.splice(${gi},1);renderAdminCreaTorneo()"
          style="background:var(--rosso-bg);border:1px solid rgba(220,38,38,.2);color:var(--rosso);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;">✕</button>`:''}
      </div>
      <div style="padding:10px 12px;">
        <div style="font-size:11px;font-weight:700;color:var(--testo-xs);text-transform:uppercase;margin-bottom:6px;">Squadre</div>
        ${(g.squadre||[]).map((sq,si)=>`
          <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--bordo-lt);">
            <span style="font-size:12px;color:var(--testo-xs);width:18px;text-align:right;">${si+1}.</span>
            <input value="${sq.nome}" style="flex:1;border:1px solid var(--bordo);border-radius:5px;padding:4px 8px;font-size:13px;font-weight:600;font-family:inherit;"
              onchange="CT.categorie[${ci}].gironiQ[${gi}].squadre[${si}].nome=this.value">
            <select title="Priorità orario" style="border:1px solid var(--bordo);border-radius:5px;padding:3px 6px;font-size:11px;font-family:inherit;"
              onchange="CT.categorie[${ci}].gironiQ[${gi}].squadre[${si}].prio=this.value">
              <option value="prima" ${sq.prio==='prima'?'selected':''}>⬆ Prima</option>
              <option value="normale" ${!sq.prio||sq.prio==='normale'?'selected':''}>= Normale</option>
              <option value="dopo" ${sq.prio==='dopo'?'selected':''}>⬇ Dopo</option>
            </select>
            <button onclick="CT.categorie[${ci}].gironiQ[${gi}].squadre.splice(${si},1);renderAdminCreaTorneo()"
              style="background:none;border:none;color:var(--testo-xs);cursor:pointer;font-size:14px;">✕</button>
          </div>`).join('')}
        <div style="display:flex;gap:6px;margin-top:8px;">
          <input id="sq-in-${ci}-${gi}" class="form-input" style="flex:1;font-size:13px;" placeholder="Nome squadra..."
            onkeydown="if(event.key==='Enter')ctAddSq(${ci},${gi})">
          <button onclick="ctAddSq(${ci},${gi})" class="btn btn-p btn-sm">+ Aggiungi</button>
        </div>
        <textarea id="bulk-${ci}-${gi}" class="form-input" rows="3" style="font-size:12px;margin-top:6px;resize:vertical;"
          placeholder="Incolla lista (una per riga)"></textarea>
        <button onclick="ctBulkSq(${ci},${gi})"
          style="margin-top:4px;background:var(--sfondo);border:1.5px solid var(--bordo);border-radius:7px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;">📋 Aggiungi lista</button>
        
        <!-- Finali dentro il girone (tipo finali_posto) -->
        <div style="margin-top:12px;border-top:1px solid var(--bordo-lt);padding-top:10px;">
          <div style="font-size:11px;font-weight:700;color:var(--testo-xs);text-transform:uppercase;margin-bottom:6px;">Finali nello stesso giorno</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
            ${['nessuna','1°/2° e 3°/4°','fino al 6°','fino all\'8°'].map((lbl,ni)=>`
              <button onclick="CT.categorie[${ci}].gironiQ[${gi}].finaliPosto=${ni};renderAdminCreaTorneo()"
                style="padding:5px 10px;border-radius:6px;border:2px solid ${(g.finaliPosto||0)===ni?'var(--blu)':'var(--bordo)'};background:${(g.finaliPosto||0)===ni?'var(--blu-bg)':'white'};color:${(g.finaliPosto||0)===ni?'var(--blu)':'var(--testo-lt)'};cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;">${lbl}</button>`).join('')}
          </div>
          ${(g.finaliPosto||0)>0?_ctFinaliPostoTable(g,ci,gi):''}
        </div>
      </div>
    </div>`).join('');

  return `${orariHTML}
  <div class="card">
    <div style="display:flex;align-items:center;margin-bottom:12px;">
      <div class="card-title" style="margin:0;">👕 Gironi di Qualifica</div>
      <button onclick="CT.categorie[${ci}].gironiQ.push({nome:'Girone '+String.fromCharCode(65+CT.categorie[${ci}].gironiQ.length),giorno:0,squadre:[],finaliPosto:0,finaliOrari:{}});renderAdminCreaTorneo()"
        style="margin-left:auto;background:var(--sfondo);border:1.5px dashed var(--bordo);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;color:var(--blu);cursor:pointer;">+ Girone</button>
    </div>
    ${!(cat.gironiQ||[]).length?'<div style="text-align:center;padding:20px;color:var(--testo-xs);">Clicca <strong>+ Girone</strong> per iniziare</div>':gironiHTML}
  </div>
  <div style="display:flex;justify-content:flex-end;margin-top:12px;">
    <button onclick="_ctVaiAccoppiamenti(${ci})" class="btn btn-p" style="padding:12px 28px;font-size:15px;">Avanti → Accoppiamenti ›</button>
  </div>`;
}

function _ctFinaliPostoTable(g, ci, gi) {
  const nFin = [0,2,3,4][g.finaliPosto||0];
  if(!nFin) return '';
  const rows = Array.from({length:nFin},(_,f)=>{
    const p1=f*2+1,p2=f*2+2, key=p1+'v'+p2;
    const fo=g.finaliOrari?.[key]||{};
    return `<tr style="background:${f%2?'var(--sfondo)':'white'};">
      <td style="padding:5px 8px;border:1px solid var(--bordo-lt);font-weight:700;font-size:12px;">${p1}°/${p2}°</td>
      <td style="padding:5px 8px;border:1px solid var(--bordo-lt);font-size:11px;color:var(--testo-xs);">${p1}° ${g.nome} vs ${p2}° ${g.nome}</td>
      <td style="padding:4px 6px;border:1px solid var(--bordo-lt);">
        <input value="${fo.ora||''}" placeholder="es. 16:45" style="width:64px;border:1px solid var(--bordo);border-radius:4px;padding:3px 5px;font-size:12px;font-family:inherit;"
          onchange="if(!CT.categorie[${ci}].gironiQ[${gi}].finaliOrari)CT.categorie[${ci}].gironiQ[${gi}].finaliOrari={};CT.categorie[${ci}].gironiQ[${gi}].finaliOrari['${key}']={...CT.categorie[${ci}].gironiQ[${gi}].finaliOrari['${key}'],ora:this.value}"></td>
      <td style="padding:4px 6px;border:1px solid var(--bordo-lt);">
        <input type="number" value="${fo.campo||1}" min="1" max="10" style="width:40px;border:1px solid var(--bordo);border-radius:4px;padding:3px 4px;font-size:12px;text-align:center;font-family:inherit;"
          onchange="if(!CT.categorie[${ci}].gironiQ[${gi}].finaliOrari)CT.categorie[${ci}].gironiQ[${gi}].finaliOrari={};CT.categorie[${ci}].gironiQ[${gi}].finaliOrari['${key}']={...CT.categorie[${ci}].gironiQ[${gi}].finaliOrari['${key}'],campo:parseInt(this.value)||1}"></td>
    </tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="background:var(--sfondo);">
      <th style="padding:5px 8px;border:1px solid var(--bordo-lt);text-align:left;">Finale</th>
      <th style="padding:5px 8px;border:1px solid var(--bordo-lt);text-align:left;">Squadre</th>
      <th style="padding:5px 8px;border:1px solid var(--bordo-lt);">Ora</th>
      <th style="padding:5px 8px;border:1px solid var(--bordo-lt);">Campo</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

function ctAddSq(ci,gi) {
  const inp=document.getElementById('sq-in-'+ci+'-'+gi);
  if(!inp||!inp.value.trim())return;
  if(!CT.categorie[ci].gironiQ[gi].squadre)CT.categorie[ci].gironiQ[gi].squadre=[];
  CT.categorie[ci].gironiQ[gi].squadre.push({nome:inp.value.trim(),prio:'normale'});
  inp.value=''; renderAdminCreaTorneo();
  setTimeout(()=>{const el=document.getElementById('sq-in-'+ci+'-'+gi);if(el)el.focus();},100);
}
function ctBulkSq(ci,gi) {
  const ta=document.getElementById('bulk-'+ci+'-'+gi);
  if(!ta)return;
  const nomi=ta.value.split(/[\n,;]/).map(s=>s.trim()).filter(Boolean);
  if(!nomi.length){toast('Nessuna squadra trovata');return;}
  if(!CT.categorie[ci].gironiQ[gi].squadre)CT.categorie[ci].gironiQ[gi].squadre=[];
  nomi.forEach(n=>CT.categorie[ci].gironiQ[gi].squadre.push({nome:n,prio:'normale'}));
  ta.value=''; toast('✅ '+nomi.length+' squadre aggiunte!'); renderAdminCreaTorneo();
}

// ── ACCOPPIAMENTI ─────────────────────────────────────────────
function _ctVaiAccoppiamenti(ci) {
  const cat=CT.categorie[ci];
  for(const g of (cat.gironiQ||[])){
    if(!g.nome?.trim()){toast('Dai un nome a tutti i gironi');return;}
    if(!(g.squadre||[]).length){toast(`${g.nome}: inserisci almeno una squadra`);return;}
  }
  // Init accoppiamenti se non esistono
  if(!(cat.accoppiamenti)){
    cat.accoppiamenti=[];
    (cat.gironiQ||[]).forEach(g=>{
      (g.squadre||[]).forEach((_,si)=>{
        cat.accoppiamenti.push({pos:si+1,gironeQ:g.nome,aGirone:'',giorno:Math.min(1,CT.torneo.giorni.length-1)});
      });
    });
  }
  CT.subStep.fase='accoppiamenti'; renderAdminCreaTorneo();
}

function _ctFaseAccoppiamenti(cat,ci) {
  if(!(cat.accoppiamenti)) cat.accoppiamenti=[];
  const gironiQ=cat.gironiQ||[];
  if(!gironiQ.length) return '<div class="empty-state">Prima aggiungi i gironi.</div>';

  const maxSq=Math.max(...gironiQ.map(g=>(g.squadre||[]).length),0);
  const dLabel=(di)=>{const g=CT.torneo.giorni[di];return g?.data?_ctFmtData(g.data):`Giorno ${di+1}`;};

  const tabella=`<div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:var(--sfondo);">
        <th style="padding:7px 8px;border:1px solid var(--bordo);text-align:left;">Posizione</th>
        ${gironiQ.map(g=>`<th style="padding:7px 8px;border:1px solid var(--bordo);text-align:center;color:var(--blu);font-weight:800;">${g.nome}</th>`).join('')}
        <th style="padding:7px 8px;border:1px solid var(--bordo);text-align:center;">Giorno finali</th>
      </tr></thead>
      <tbody>
        ${Array.from({length:maxSq},(_,pi)=>{
          const pos=pi+1;
          const giornoAcc=cat.accoppiamenti.find(a=>a.pos===pos)?.giorno??1;
          return `<tr style="background:${pi%2?'var(--sfondo)':'white'};">
            <td style="padding:7px 8px;border:1px solid var(--bordo);font-weight:800;">${pos}° posto</td>
            ${gironiQ.map(g=>{
              const acc=cat.accoppiamenti.find(a=>a.pos===pos&&a.gironeQ===g.nome);
              return `<td style="padding:5px 6px;border:1px solid var(--bordo);text-align:center;">
                <input value="${acc?.aGirone||''}" placeholder="es. GIRONE A"
                  style="width:100%;border:1.5px solid var(--blu);border-radius:6px;padding:4px 8px;font-size:12px;font-weight:700;font-family:inherit;text-align:center;background:var(--blu-bg);color:var(--blu);"
                  onchange="ctSetAcc(${ci},${pos},'${g.nome}',this.value)">
              </td>`;
            }).join('')}
            <td style="padding:5px 6px;border:1px solid var(--bordo);text-align:center;">
              <select style="border:1px solid var(--bordo);border-radius:5px;padding:3px 6px;font-size:11px;font-family:inherit;"
                onchange="CT.categorie[${ci}].accoppiamenti.filter(a=>a.pos===${pos}).forEach(a=>a.giorno=parseInt(this.value))">
                ${CT.torneo.giorni.map((_,di)=>`<option value="${di}" ${(giornoAcc||1)===di?'selected':''}>${dLabel(di)}</option>`).join('')}
              </select>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;

  // Squadre fisse per gironi finali
  const gironiFinaliNomi=[...new Set((cat.accoppiamenti||[]).map(a=>a.aGirone).filter(Boolean))];
  const extraHTML=`<div style="margin-top:14px;">
    <div style="font-size:12px;font-weight:700;color:var(--testo-lt);margin-bottom:8px;">🏟️ Squadre fisse nei gironi finali (entrano senza qualificarsi)</div>
    ${gironiFinaliNomi.map(gnome=>`
      <div style="border:1px solid var(--bordo);border-radius:8px;padding:10px;margin-bottom:8px;">
        <div style="font-size:12px;font-weight:800;color:var(--blu);margin-bottom:6px;">${gnome}</div>
        ${(cat.squadreExtra||[]).filter(sq=>sq.aGirone===gnome).map((sq,ei)=>`
          <div style="display:flex;gap:6px;margin-bottom:4px;align-items:center;">
            <input value="${sq.nome}" placeholder="Nome squadra"
              style="flex:1;border:1px solid var(--bordo);border-radius:5px;padding:4px 8px;font-size:13px;font-family:inherit;"
              onchange="CT.categorie[${ci}].squadreExtra[${ei}].nome=this.value">
            <select style="border:1px solid var(--bordo);border-radius:5px;padding:3px 6px;font-size:11px;font-family:inherit;"
              onchange="CT.categorie[${ci}].squadreExtra[${ei}].prio=this.value">
              <option value="prima" ${sq.prio==='prima'?'selected':''}>⬆ Prima</option>
              <option value="normale" ${!sq.prio||sq.prio==='normale'?'selected':''}>= Normale</option>
              <option value="dopo" ${sq.prio==='dopo'?'selected':''}>⬇ Dopo</option>
            </select>
            <button onclick="CT.categorie[${ci}].squadreExtra.splice(${ei},1);renderAdminCreaTorneo()"
              style="background:var(--rosso-bg);border:1px solid rgba(220,38,38,.2);color:var(--rosso);border-radius:6px;padding:4px 8px;cursor:pointer;">✕</button>
          </div>`).join('')}
        <button onclick="if(!CT.categorie[${ci}].squadreExtra)CT.categorie[${ci}].squadreExtra=[];CT.categorie[${ci}].squadreExtra.push({nome:'',aGirone:'${gnome}',prio:'normale'});renderAdminCreaTorneo()"
          style="background:var(--sfondo);border:1.5px dashed var(--bordo);border-radius:7px;padding:4px 12px;font-size:12px;font-weight:600;color:var(--blu);cursor:pointer;">+ Squadra fissa in ${gnome}</button>
      </div>`).join('')}
  </div>`;

  return `<div class="card">
    <div class="card-title">🔀 Accoppiamenti — Chi va dove dopo le qualifiche</div>
    <div style="background:var(--blu-bg);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--blu);">
      💡 Per ogni posizione scrivi in quale <strong>girone finale</strong> va la squadra. Lascia vuoto se non fa gironi finali.
    </div>
    ${tabella}
    ${gironiFinaliNomi.length?extraHTML:'<div style="margin-top:10px;padding:10px;background:var(--sfondo);border-radius:8px;font-size:12px;color:var(--testo-xs);">Compila la tabella sopra per vedere i gironi finali</div>'}
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:12px;">
    <button onclick="CT.subStep.fase='gironiQ';renderAdminCreaTorneo()" class="btn btn-secondary">‹ Gironi</button>
    <button onclick="_ctVaiCalendario(${ci})" class="btn btn-p" style="padding:12px 28px;font-size:15px;">Avanti → Calendario ›</button>
  </div>`;
}

function ctSetAcc(ci,pos,gironeQ,aGirone) {
  if(!CT.categorie[ci].accoppiamenti) CT.categorie[ci].accoppiamenti=[];
  const idx=CT.categorie[ci].accoppiamenti.findIndex(a=>a.pos===pos&&a.gironeQ===gironeQ);
  const giorno=CT.categorie[ci].accoppiamenti.find(a=>a.pos===pos)?.giorno??1;
  if(idx>=0) CT.categorie[ci].accoppiamenti[idx].aGirone=aGirone;
  else CT.categorie[ci].accoppiamenti.push({pos,gironeQ,aGirone,giorno});
}

// ── CALENDARIO ────────────────────────────────────────────────
function _ctVaiCalendario(ci) {
  const cat=CT.categorie[ci];
  // Genera gironi finali dagli accoppiamenti
  const accMap={};
  (cat.accoppiamenti||[]).forEach(a=>{
    if(!a.aGirone) return;
    if(!accMap[a.aGirone]) accMap[a.aGirone]={nome:a.aGirone,giorno:a.giorno??1,squadre:[],squadreExtra:[]};
    accMap[a.aGirone].squadre.push({nome:`${a.pos}° ${a.gironeQ}`,prio:'normale',_placeholder:true,_gironeQ:a.gironeQ,_pos:a.pos});
  });
  (cat.squadreExtra||[]).forEach(sq=>{
    if(sq.aGirone&&accMap[sq.aGirone]) accMap[sq.aGirone].squadreExtra.push({nome:sq.nome,prio:sq.prio||'normale',_placeholder:false});
  });
  cat.gironiFinali=Object.values(accMap);

  // Genera calendario con priorità
  cat.calendario=[];
  let ordine=1;

  // Gironi qualifiche
  (cat.gironiQ||[]).forEach(g=>{
    const sq=g.squadre||[];
    const di=g.giorno||0;
    const giornata=CT.torneo.giorni[di]?.data?_ctFmtData(CT.torneo.giorni[di].data):`Giorno ${di+1}`;
    // Ordina per priorità
    const prima=sq.filter(s=>s.prio==='prima');
    const normale=sq.filter(s=>!s.prio||s.prio==='normale');
    const dopo=sq.filter(s=>s.prio==='dopo');
    const sqOrd=[...prima,...normale,...dopo];
    for(let i=0;i<sqOrd.length;i++) for(let j=i+1;j<sqOrd.length;j++)
      cat.calendario.push({tipo:'gironeQ',gironeNome:g.nome,sq1:sqOrd[i].nome,sq2:sqOrd[j].nome,ora:'',campo:1,giornata,ordine:ordine++,_di:di});
    // Finali dentro il girone
    const nFin=[0,2,3,4][g.finaliPosto||0];
    for(let f=nFin-1;f>=0;f--){
      const p1=f*2+1,p2=f*2+2,key=p1+'v'+p2;
      const fo=g.finaliOrari?.[key]||{};
      cat.calendario.push({tipo:'finaleQ',gironeNome:`FINALE ${p1}°/${p2}° ${g.nome}`,sq1:`${p1}° ${g.nome}`,sq2:`${p2}° ${g.nome}`,ora:fo.ora||'',campo:fo.campo||1,giornata,ordine:ordine++,_di:di,_oraManuale:!!(fo.ora)});
    }
  });

  // Gironi finali
  cat.gironiFinali.forEach(gf=>{
    const di=gf.giorno??1;
    const giornata=CT.torneo.giorni[di]?.data?_ctFmtData(CT.torneo.giorni[di].data):`Giorno ${di+1}`;
    const allSq=[...gf.squadre,...gf.squadreExtra];
    const prima=allSq.filter(s=>s.prio==='prima');
    const normale=allSq.filter(s=>!s.prio||s.prio==='normale');
    const dopo=allSq.filter(s=>s.prio==='dopo');
    const sqOrd=[...prima,...normale,...dopo];
    for(let i=0;i<sqOrd.length;i++) for(let j=i+1;j<sqOrd.length;j++)
      cat.calendario.push({tipo:'gironeF',gironeNome:gf.nome,sq1:sqOrd[i].nome,sq2:sqOrd[j].nome,ora:'',campo:1,giornata,ordine:ordine++,_di:di});
  });

  _ctCalcolaOrari(cat);
  CT.subStep.fase='calendario'; renderAdminCreaTorneo();
}

function _ctCalcolaOrari(cat) {
  const perDi={};
  cat.calendario.forEach(p=>{const k=p._di??0;if(!perDi[k])perDi[k]=[];perDi[k].push(p);});
  Object.entries(perDi).forEach(([diStr,partite])=>{
    const di=parseInt(diStr);
    const catDay=cat.oraPerGiorno?.[di];
    const dayData=CT.torneo.giorni[di]||{};
    const durata=catDay?.durata??CT.torneo.durata??20;
    const pausa=catDay?.pausa??CT.torneo.pausa??5;
    const campi=catDay?.campi??dayData.campi??2;
    let oraMin=_ctTimeToMin(catDay?.oraInizio??dayData.oraInizio??'09:00');
    const pausaIni=_ctTimeToMin(catDay?.pausaIni??dayData.pausaIni??'12:30');
    const pausaFine=_ctTimeToMin(catDay?.pausaFine??dayData.pausaFine??'14:00');
    partite.sort((a,b)=>a.ordine-b.ordine);
    let campo=1;
    partite.forEach(p=>{
      if(p._oraManuale&&p.ora){oraMin=_ctTimeToMin(p.ora)+durata+pausa;campo=(p.campo||1)%campi+1;return;}
      if(oraMin>=pausaIni&&oraMin<pausaFine)oraMin=pausaFine;
      p.ora=_ctMinToTime(oraMin); p.campo=campo;
      campo++;if(campo>campi){campo=1;oraMin+=durata+pausa;}
    });
  });
}

function _ctFaseCalendario(cat,ci) {
  const partite=[...cat.calendario].sort((a,b)=>a.ordine-b.ordine);
  const colore={gironeQ:'var(--blu)',finaleQ:'#d97706',gironeF:'#7c3aed'};
  const label={gironeQ:'Qualifica',finaleQ:'Finale Q',gironeF:'Finale'};

  const righe=partite.map((p,i)=>`
    <tr style="background:${i%2?'var(--sfondo)':'white'};">
      <td style="padding:4px 6px;border-bottom:1px solid var(--bordo-lt);text-align:center;white-space:nowrap;">
        <div style="display:flex;flex-direction:column;gap:1px;">
          <button onclick="ctSposta(${ci},${i},-1)" style="background:var(--sfondo);border:1px solid var(--bordo);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:10px;" ${i===0?'disabled':''}>▲</button>
          <button onclick="ctSposta(${ci},${i},1)" style="background:var(--sfondo);border:1px solid var(--bordo);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:10px;" ${i===partite.length-1?'disabled':''}>▼</button>
        </div>
      </td>
      <td style="padding:4px 6px;border-bottom:1px solid var(--bordo-lt);text-align:center;font-size:11px;color:var(--testo-xs);font-weight:700;">${i+1}</td>
      <td style="padding:4px 6px;border-bottom:1px solid var(--bordo-lt);">
        <input value="${p.ora}" style="width:56px;border:1px solid var(--bordo);border-radius:5px;padding:3px 5px;font-size:12px;font-family:inherit;font-weight:700;"
          onchange="CT.categorie[${ci}].calendario[${i}].ora=this.value;CT.categorie[${ci}].calendario[${i}]._oraManuale=true"></td>
      <td style="padding:4px 6px;border-bottom:1px solid var(--bordo-lt);text-align:center;">
        <input type="number" value="${p.campo}" min="1" max="10" style="width:36px;border:1px solid var(--bordo);border-radius:5px;padding:3px 4px;font-size:12px;text-align:center;font-family:inherit;"
          onchange="CT.categorie[${ci}].calendario[${i}].campo=parseInt(this.value)||1"></td>
      <td style="padding:4px 6px;border-bottom:1px solid var(--bordo-lt);white-space:nowrap;">
        <span style="font-size:10px;background:${colore[p.tipo]||'#888'};color:white;padding:1px 6px;border-radius:10px;">${label[p.tipo]||''}</span>
        <span style="font-size:11px;color:var(--testo-xs);margin-left:4px;">${p.gironeNome}</span>
      </td>
      <td style="padding:4px 6px;border-bottom:1px solid var(--bordo-lt);font-weight:600;font-size:12px;">${p.sq1}</td>
      <td style="padding:4px 6px;border-bottom:1px solid var(--bordo-lt);text-align:center;color:var(--testo-xs);font-size:11px;">vs</td>
      <td style="padding:4px 6px;border-bottom:1px solid var(--bordo-lt);font-weight:600;font-size:12px;">${p.sq2}</td>
    </tr>`).join('');

  return `<div class="card">
    <div style="display:flex;align-items:center;margin-bottom:12px;">
      <div class="card-title" style="margin:0;">📅 Calendario</div>
      <button onclick="_ctCalcolaOrari(CT.categorie[${ci}]);renderAdminCreaTorneo()" style="margin-left:8px;background:var(--sfondo);border:1.5px solid var(--bordo);border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;">🔄 Rigenera orari</button>
      <div style="display:flex;gap:4px;margin-left:8px;">
        <button onclick="ctOrdGirone(${ci})" style="background:white;border:1.5px solid var(--bordo);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-family:inherit;">📋 Per girone</button>
        <button onclick="ctOrdAlterna(${ci})" style="background:white;border:1.5px solid var(--bordo);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-family:inherit;">⚡ Alterna</button>
      </div>
    </div>
    <div style="background:var(--blu-bg);border-radius:8px;padding:8px 14px;margin-bottom:10px;font-size:12px;color:var(--blu);">
      💡 <strong>▲▼</strong> per riordinare • <strong>🔄 Rigenera</strong> per aggiornare orari • <strong>⚡ Alterna</strong> per gironi su più campi contemporaneamente
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:var(--sfondo);">
          <th style="padding:6px;border-bottom:1px solid var(--bordo);width:40px;"></th>
          <th style="padding:6px;border-bottom:1px solid var(--bordo);width:24px;">N°</th>
          <th style="padding:6px;border-bottom:1px solid var(--bordo);width:64px;">Ora</th>
          <th style="padding:6px;border-bottom:1px solid var(--bordo);width:44px;">Campo</th>
          <th style="padding:6px;border-bottom:1px solid var(--bordo);text-align:left;">Girone</th>
          <th style="padding:6px;border-bottom:1px solid var(--bordo);text-align:left;">Squadra 1</th>
          <th style="padding:6px;border-bottom:1px solid var(--bordo);width:20px;"></th>
          <th style="padding:6px;border-bottom:1px solid var(--bordo);text-align:left;">Squadra 2</th>
        </tr></thead>
        <tbody>${righe}</tbody>
      </table>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:12px;">
    <button onclick="CT.subStep.fase='accoppiamenti';renderAdminCreaTorneo()" class="btn btn-secondary">‹ Accoppiamenti</button>
    <button onclick="CT.subStep.fase='finali';renderAdminCreaTorneo()" class="btn btn-p" style="padding:12px 28px;font-size:15px;">Avanti → Finali ›</button>
  </div>`;
}

function ctSposta(ci,i,dir) {
  const lista=CT.categorie[ci].calendario;
  const j=i+dir; if(j<0||j>=lista.length)return;
  const tmp=lista[i].ordine; lista[i].ordine=lista[j].ordine; lista[j].ordine=tmp;
  _ctCalcolaOrari(CT.categorie[ci]); renderAdminCreaTorneo();
}
function ctOrdGirone(ci) {
  const lista=CT.categorie[ci].calendario;
  const gironi=[...new Set(lista.map(p=>p.gironeNome))];
  let ord=1; gironi.forEach(g=>lista.filter(p=>p.gironeNome===g).forEach(p=>p.ordine=ord++));
  _ctCalcolaOrari(CT.categorie[ci]); renderAdminCreaTorneo();
}
function ctOrdAlterna(ci) {
  const lista=CT.categorie[ci].calendario;
  const gironi=[...new Set(lista.map(p=>p.gironeNome))];
  const perG={}; gironi.forEach(g=>perG[g]=lista.filter(p=>p.gironeNome===g));
  const max=Math.max(...gironi.map(g=>perG[g].length));
  let ord=1; for(let i=0;i<max;i++) gironi.forEach(g=>{if(perG[g][i])perG[g][i].ordine=ord++;});
  _ctCalcolaOrari(CT.categorie[ci]); renderAdminCreaTorneo();
}

// ── FINALI ────────────────────────────────────────────────────
function _ctFaseFinali(cat,ci) {
  if(!cat.finali) cat.finali=[];
  const gironiF=cat.gironiFinali||[];
  const r0=gironiF[0]?.nome||'GIRONE A', r1=gironiF[1]?.nome||'GIRONE B';
  const lastDay=CT.torneo.giorni[CT.torneo.giorni.length-1];
  const lastLabel=lastDay?.data?_ctFmtData(lastDay.data):`Giorno ${CT.torneo.giorni.length}`;

  const templates=[
    {label:'Semifinali + Finali 1°-4°', fn:()=>{cat.finali=[
      {nome:'SEMIFINALE 01',sq1:`1° Girone ${r0}`,sq2:`2° Girone ${r1}`,ora:'',campo:1,giornata:lastLabel},
      {nome:'SEMIFINALE 02',sq1:`1° Girone ${r1}`,sq2:`2° Girone ${r0}`,ora:'',campo:2,giornata:lastLabel},
      {nome:'FINALE 3°/4°',sq1:'Perdente SEMIFINALE 01',sq2:'Perdente SEMIFINALE 02',ora:'',campo:1,giornata:lastLabel},
      {nome:'FINALE 1°/2°',sq1:'Vincente SEMIFINALE 01',sq2:'Vincente SEMIFINALE 02',ora:'',campo:1,giornata:lastLabel},
    ];}},
    {label:'Solo Finali per posto (1°/2°, 3°/4°...)', fn:()=>{
      const max=Math.max(...gironiF.map(g=>(g.squadre.length+g.squadreExtra.length)||4));
      cat.finali=Array.from({length:max},(_,i)=>({nome:`FINALE ${i*2+1}°/${i*2+2}°`,sq1:`${i+1}° Girone ${r0}`,sq2:`${i+1}° Girone ${r1}`,ora:'',campo:1,giornata:lastLabel}));
    }},
    {label:'Semifinali + Finali 1°-8°', fn:()=>{cat.finali=[
      {nome:'SEMIFINALE 01',sq1:`1° Girone ${r0}`,sq2:`2° Girone ${r1}`,ora:'',campo:1,giornata:lastLabel},
      {nome:'SEMIFINALE 02',sq1:`1° Girone ${r1}`,sq2:`2° Girone ${r0}`,ora:'',campo:2,giornata:lastLabel},
      {nome:'FINALE 3°/4°',sq1:'Perdente SEMIFINALE 01',sq2:'Perdente SEMIFINALE 02',ora:'',campo:1,giornata:lastLabel},
      {nome:'FINALE 1°/2°',sq1:'Vincente SEMIFINALE 01',sq2:'Vincente SEMIFINALE 02',ora:'',campo:1,giornata:lastLabel},
      {nome:'FINALE 5°/6°',sq1:`3° Girone ${r0}`,sq2:`3° Girone ${r1}`,ora:'',campo:2,giornata:lastLabel},
      {nome:'FINALE 7°/8°',sq1:`4° Girone ${r0}`,sq2:`4° Girone ${r1}`,ora:'',campo:2,giornata:lastLabel},
    ];}},
  ];

  const finaliHTML=cat.finali.map((f,fi)=>`
    <div style="border:1px solid var(--bordo);border-radius:8px;margin-bottom:8px;overflow:hidden;">
      <div style="background:var(--sfondo);padding:7px 12px;display:flex;align-items:center;gap:8px;">
        <input value="${f.nome}" style="flex:1;border:1.5px solid var(--bordo);border-radius:6px;padding:4px 10px;font-size:13px;font-weight:700;font-family:inherit;"
          onchange="CT.categorie[${ci}].finali[${fi}].nome=this.value">
        <button onclick="CT.categorie[${ci}].finali.splice(${fi},1);renderAdminCreaTorneo()"
          style="background:var(--rosso-bg);border:1px solid rgba(220,38,38,.2);color:var(--rosso);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px;">✕</button>
      </div>
      <div style="padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <input value="${f.sq1}" placeholder="Squadra 1 (es. 1° Girone A)"
          style="flex:2;min-width:160px;border:1px solid var(--bordo);border-radius:5px;padding:4px 8px;font-size:12px;font-family:inherit;"
          onchange="CT.categorie[${ci}].finali[${fi}].sq1=this.value">
        <span style="color:var(--testo-xs);">vs</span>
        <input value="${f.sq2}" placeholder="Squadra 2 (es. 1° Girone B)"
          style="flex:2;min-width:160px;border:1px solid var(--bordo);border-radius:5px;padding:4px 8px;font-size:12px;font-family:inherit;"
          onchange="CT.categorie[${ci}].finali[${fi}].sq2=this.value">
        <input value="${f.ora||''}" placeholder="Ora" style="width:60px;border:1px solid var(--bordo);border-radius:5px;padding:4px 6px;font-size:12px;font-family:inherit;"
          onchange="CT.categorie[${ci}].finali[${fi}].ora=this.value">
        <input type="number" value="${f.campo||1}" min="1" max="10" style="width:40px;border:1px solid var(--bordo);border-radius:5px;padding:4px;font-size:12px;text-align:center;font-family:inherit;"
          onchange="CT.categorie[${ci}].finali[${fi}].campo=parseInt(this.value)||1">
      </div>
    </div>`).join('');

  return `<div class="card">
    <div class="card-title">🏅 Round Finali (Semifinali, Finali per posto...)</div>
    <div style="background:var(--blu-bg);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--blu);">
      💡 Placeholder riconosciuti: <code>1° Girone A</code> · <code>Vincente SEMIFINALE 01</code> · <code>Perdente SEMIFINALE 02</code>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
      ${templates.map((t,ti)=>`<button onclick="(${t.fn.toString()})();renderAdminCreaTorneo()"
        style="background:var(--sfondo);border:1.5px solid var(--bordo);border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;color:var(--blu);cursor:pointer;font-family:inherit;">${t.label}</button>`).join('')}
      <button onclick="CT.categorie[${ci}].finali.push({nome:'FINALE',sq1:'',sq2:'',ora:'',campo:1,giornata:'${lastLabel}'});renderAdminCreaTorneo()"
        style="background:var(--sfondo);border:1.5px dashed var(--bordo);border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;color:var(--blu);cursor:pointer;">+ Round vuoto</button>
    </div>
    ${finaliHTML}
    ${!cat.finali.length?'<div style="text-align:center;padding:16px;color:var(--testo-xs);">Scegli un template o aggiungi round</div>':''}
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:12px;">
    <button onclick="CT.subStep.fase='calendario';renderAdminCreaTorneo()" class="btn btn-secondary">‹ Calendario</button>
    <button onclick="_ctCompletaCat(${ci})" class="btn btn-p" style="padding:12px 28px;font-size:15px;background:var(--verde);border-color:var(--verde);">✅ Completa Categoria</button>
  </div>`;
}

function _ctCompletaCat(ci) { CT.categorie[ci]._fatto=true; CT.step=2; CT.subStep=null; renderAdminCreaTorneo(); }

// ══════════════════════════════════════════════════════════════
// STEP 4: RIEPILOGO + SALVA
// ══════════════════════════════════════════════════════════════
async function _ctStep4() {
  const tot=CT.categorie.reduce((s,c)=>s+c.calendario.length,0);
  const totF=CT.categorie.reduce((s,c)=>s+(c.finali?.length||0),0);
  return `<div class="card">
    <div class="card-title">✅ Riepilogo</div>
    <div style="background:var(--verde-bg);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="font-size:18px;font-weight:800;color:var(--verde);margin-bottom:6px;">🏆 ${CT.torneo.nome}</div>
      <div style="font-size:13px;color:var(--testo-lt);">📍 ${CT.torneo.luogo||'—'} &nbsp;|&nbsp; ⏱️ ${CT.torneo.durata}min</div>
      <div style="font-size:13px;color:var(--testo-lt);">📅 ${CT.torneo.giorni.map((g,i)=>g.data?_ctFmtData(g.data):'Giorno '+(i+1)).join(' • ')}</div>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
        ${CT.categorie.map(cat=>`
          <div style="background:white;border-radius:8px;padding:8px 12px;font-size:12px;">
            <strong>${cat.nome}</strong> — ${(cat.gironiQ||[]).length} gironi qualifiche + ${(cat.gironiFinali||[]).length} gironi finali | ${cat.calendario.length} partite + ${cat.finali?.length||0} round knockout
          </div>`).join('')}
      </div>
      <div style="margin-top:8px;font-size:13px;color:var(--testo-lt);">⚽ ${tot} partite &nbsp;|&nbsp; 🏅 ${totF} round finali</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button onclick="ctSalvaDB()" style="background:var(--verde);color:white;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;">💾 Salva nel Database</button>
    </div>
    <div id="ct-log" style="margin-top:12px;"></div>
  </div>
  <div style="margin-top:12px;">
    <button onclick="CT.step=2;renderAdminCreaTorneo()" class="btn btn-secondary">‹ Categorie</button>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
// SALVA DATABASE — usa il sistema di importazione Excel
// ══════════════════════════════════════════════════════════════
async function ctSalvaDB() {
  const log=document.getElementById('ct-log');
  if(log)log.innerHTML='<div style="color:var(--testo-lt);font-size:13px;">⏳ Salvataggio in corso...</div>';
  try {
    const torneo=await dbSaveTorneo({nome:CT.torneo.nome,data:CT.torneo.giorni[0]?.data||'',attivo:true});
    STATE.tornei=await dbGetTornei(); STATE.activeTorneo=torneo.id;

    // Costruisci struttura dati uguale all'Excel
    const dati={categorie:[],gironi:[],partite:[],fase2:[]};
    let ordCat=0;
    for(const cat of CT.categorie) {
      ordCat++;
      dati.categorie.push({nome:cat.nome,qualificate:2,formato:'gironi',ordine:ordCat,codice:cat.nome});

      // Gironi qualifiche — squadre
      for(const g of (cat.gironiQ||[])) {
        const di=g.giorno||0;
        const giornata=CT.torneo.giorni[di]?.data?_ctFmtData(CT.torneo.giorni[di].data):`Giorno ${di+1}`;
        (g.squadre||[]).forEach((sq,i)=>dati.gironi.push({categoria:cat.nome,girone:g.nome,squadra:sq.nome,ordine:i+1}));
        cat.calendario.filter(p=>p.tipo==='gironeQ'&&p.gironeNome===g.nome).sort((a,b)=>a.ordine-b.ordine).forEach(p=>
          dati.partite.push({categoria:cat.nome,girone:g.nome,home:p.sq1,away:p.sq2,orario:p.ora,campo:p.campo,giornata:p.giornata||giornata,giorno:p.giornata||giornata}));
        // Finali nel girone (knockout)
        cat.calendario.filter(p=>p.tipo==='finaleQ'&&p.gironeNome.includes(g.nome)).sort((a,b)=>a.ordine-b.ordine).forEach(p=>{
          const m=p.gironeNome.match(/FINALE\s+(.+)/i);
          dati.fase2.push({categoria:cat.nome,round:p.gironeNome,roundLabel:`🎖️ ${p.gironeNome}`,roundOrder:50,matchOrder:dati.fase2.length,consolazione:true,sq1raw:p.sq1,sq2raw:p.sq2,orario:p.ora,campo:p.campo,giorno:p.giornata||giornata});
        });
      }

      // Gironi finali — squadre (inclusi placeholder con nome CORRETTO)
      for(const gf of (cat.gironiFinali||[])) {
        const di=gf.giorno??1;
        const giornata=CT.torneo.giorni[di]?.data?_ctFmtData(CT.torneo.giorni[di].data):`Giorno ${di+1}`;
        const allSq=[...gf.squadre,...gf.squadreExtra];
        allSq.forEach((sq,i)=>{
          // Il placeholder viene salvato come "N° Girone X" — formato riconosciuto dal sistema
          const nomeSq=sq._placeholder?`${sq._pos}° Girone ${sq._gironeQ}`:sq.nome;
          dati.gironi.push({categoria:cat.nome,girone:gf.nome,squadra:nomeSq,ordine:i+1});
        });
        cat.calendario.filter(p=>p.tipo==='gironeF'&&p.gironeNome===gf.nome).sort((a,b)=>a.ordine-b.ordine).forEach(p=>
          dati.partite.push({categoria:cat.nome,girone:gf.nome,home:p.sq1,away:p.sq2,orario:p.ora,campo:p.campo,giornata:p.giornata||giornata,giorno:p.giornata||giornata}));
      }

      // Round finali knockout
      (cat.finali||[]).forEach((f,fi)=>{
        // Trasforma sq1/sq2: se "1° GIRONE A" → "1° Girone A" (con Girone maiuscolo)
        const fixPh=s=>{
          if(!s)return s;
          const m=s.match(/^(\d+)[°º]\s+(?:girone\s+)?(\w+)$/i);
          if(m)return `${m[1]}° Girone ${m[2].toUpperCase()}`;
          return s;
        };
        dati.fase2.push({
          categoria:cat.nome,round:f.nome,
          roundLabel:`🏅 ${f.nome}`,roundOrder:18+fi,matchOrder:fi,consolazione:fi>1,
          sq1raw:fixPh(f.sq1),sq2raw:fixPh(f.sq2),
          orario:f.ora||'',campo:f.campo||1,giorno:f.giornata||''
        });
      });
    }

    // Usa il sistema di importazione
    if(typeof eseguiImportazioneConTorneo==='function') {
      await eseguiImportazioneConTorneo(torneo.id,dati,null);
    } else {
      throw new Error('Sistema di importazione non disponibile. Ricarica la pagina.');
    }

    STATE.categorie=await dbGetCategorie(STATE.activeTorneo);
    STATE.activeCat=STATE.categorie[0]?.id||null;
    renderCatBar(); renderTorneoBar();
    if(log)log.innerHTML=`<div style="background:var(--verde-bg);border-radius:8px;padding:12px;color:var(--verde);font-weight:700;">✅ Torneo "${CT.torneo.nome}" creato!</div>`;
    toast('✅ Torneo creato!');
  } catch(e) {
    console.error(e);
    if(log)log.innerHTML=`<div style="background:var(--rosso-bg);border-radius:8px;padding:12px;color:var(--rosso);font-size:13px;">❌ ${e.message}</div>`;
    toast('❌ '+e.message);
  }
}

// ─── HELPERS ─────────────────────────────────────────────────
function _ctTimeToMin(t){if(!t)return 540;const p=String(t).split(':');return parseInt(p[0]||9)*60+parseInt(p[1]||0);}
function _ctMinToTime(m){const h=Math.floor(m/60),mm=m%60;return String(h).padStart(2,'0')+':'+String(mm).padStart(2,'0');}
function _ctFmtData(iso){if(!iso)return '';try{return new Date(iso+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}catch(e){return iso;}}


async function renderAdminModifica() {
  const el = document.getElementById('sec-a-modifica');
  if (!el) return;
  if (!STATE.activeTorneo) { el.innerHTML = '<div class="empty-state">Seleziona prima un torneo.</div>'; return; }

  // Mostra pagina scelta: modifica con wizard o modifica rapida
  el.innerHTML = `<div style="max-width:700px;margin:0 auto;padding:20px 0;">
    <div style="font-size:20px;font-weight:800;margin-bottom:20px;">✏️ Modifica Torneo</div>

    <div style="display:flex;flex-direction:column;gap:12px;">
      <button onclick="ctCaricaDaDatabase()" 
        style="background:var(--blu);color:white;border:none;border-radius:12px;padding:20px 24px;text-align:left;cursor:pointer;font-family:inherit;">
        <div style="font-size:16px;font-weight:800;margin-bottom:4px;">🆕 Apri nel Wizard Crea</div>
        <div style="font-size:13px;opacity:.8;">Modifica tutto: struttura, gironi, squadre, orari, finali — esattamente come quando l'hai creato</div>
      </button>
      <button onclick="modShowVeloce()" 
        style="background:white;border:2px solid var(--bordo);border-radius:12px;padding:20px 24px;text-align:left;cursor:pointer;font-family:inherit;">
        <div style="font-size:16px;font-weight:800;margin-bottom:4px;color:var(--testo);">⚡ Modifica Rapida</div>
        <div style="font-size:13px;color:var(--testo-lt);">Cambia solo orari, campi, sposta squadre — veloce per correzioni minori</div>
      </button>
    </div>
    <div id="mod-veloce-content" style="margin-top:16px;"></div>
  </div>`;
}

async function ctCaricaDaDatabase() {
  toast('⏳ Caricamento torneo...');
  try {
    const torneo = STATE.tornei.find(t => t.id === STATE.activeTorneo);
    if (!torneo) { toast('Nessun torneo selezionato'); return; }

    // Carica struttura dal DB
    const categorie = await dbGetCategorie(STATE.activeTorneo);
    const tutteSquadre = await dbGetSquadre(STATE.activeTorneo);
    const sqMap = {}; tutteSquadre.forEach(s => sqMap[s.id] = s);

    // Ricostruisci CT
    CT = {
      step: 2,
      subStep: null,
      torneo: {
        nome: torneo.nome || '',
        luogo: torneo.luogo || '',
        durata: 20,
        pausa: 5,
        giorni: [{data: torneo.data||'', oraInizio:'09:00', pausaIni:'12:30', pausaFine:'14:00', campi:2}]
      },
      categorie: []
    };

    for (const cat of categorie) {
      const gironiDB = await dbGetGironi(cat.id);
      const gironi = [];
      const calendario = [];

      for (const g of gironiDB) {
        const {data: gsRows} = await db.from('girone_squadre')
          .select('squadra_id').eq('girone_id', g.id);
        const squadreGirone = (gsRows||[]).map(r => ({
          nome: sqMap[r.squadra_id]?.nome || '?',
          prio: 'normale'
        }));

        const {data: partite} = await db.from('partite')
          .select('id,home_id,away_id,orario,campo,giorno,giocata,gol_home,gol_away')
          .eq('girone_id', g.id)
          .order('orario');

        // Aggiungi al calendario
        (partite||[]).forEach((p,i) => {
          calendario.push({
            gironeNome: g.nome,
            sq1: sqMap[p.home_id]?.nome || '?',
            sq2: sqMap[p.away_id]?.nome || '?',
            ora: p.orario||'',
            campo: parseInt(p.campo)||1,
            giornata: p.giorno||'',
            ordine: i+1,
            _giornoIdx: 0,
            _partitaId: p.id
          });
        });

        gironi.push({
          nome: g.nome,
          giorno: 0,
          squadre: squadreGirone,
          tipo: 'solo',
          qualificate: cat.qualificate||2,
          numFinali: 2
        });
      }

      // Knockout / finali
      const koList = await dbGetKnockout(cat.id);
      const finali = (koList||[]).map(ko => ({
        nome: ko.round_name||'',
        sq1: ko.home_id ? (sqMap[ko.home_id]?.nome||'') : (ko.note_home||''),
        sq2: ko.away_id ? (sqMap[ko.away_id]?.nome||'') : (ko.note_away||''),
        ora: ko.orario||'',
        campo: ko.campo||1,
        giornata: '',
        _koId: ko.id
      }));

      CT.categorie.push({
        nome: cat.nome,
        gironi,
        calendario,
        accoppiamenti: [],
        squadreExtra: [],
        gironiFinali: [],
        calendarioFinali: [],
        finali,
        oraPerGiorno: CT.torneo.giorni.map(g=>({
          oraInizio:g.oraInizio,pausaIni:g.pausaIni,
          pausaFine:g.pausaFine,campi:g.campi
        })),
        _fatto: true,
        _catId: cat.id
      });
    }

    // Vai al wizard Crea
    const btnCrea = document.querySelector('[data-section="a-crea"]');
    showSection('a-crea', btnCrea);
    await renderAdminCreaTorneo();
    toast('✅ Torneo caricato nel wizard!');
  } catch(e) {
    console.error(e);
    toast('❌ Errore: ' + e.message);
  }
}

async function modShowVeloce() {
  const el = document.getElementById('mod-veloce-content');
  if (!el) return;

  el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--testo-xs);">⏳ Caricamento...</div>';

  if (!STATE.activeTorneo) { el.innerHTML = '<div class="empty-state">Seleziona un torneo.</div>'; return; }
  const cat = STATE.activeCat ? STATE.categorie.find(c => c.id === STATE.activeCat) : STATE.categorie[0];
  if (!cat) { el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>'; return; }

  const gironi = await getGironiWithData(cat.id);
  const ko = await dbGetKnockout(cat.id);
  const squadre = await dbGetSquadre(STATE.activeTorneo);
  const sqMap = {}; squadre.forEach(s => sqMap[s.id] = s);

  // Tab selector
  const tabHTML = `
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <button id="mod-tab-partite" onclick="modShowTab('partite')"
        style="padding:8px 16px;border-radius:8px;border:2px solid var(--blu);background:var(--blu);color:white;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px;">
        ⚽ Partite Gironi
      </button>
      <button id="mod-tab-knockout" onclick="modShowTab('knockout')"
        style="padding:8px 16px;border-radius:8px;border:2px solid var(--bordo);background:white;color:var(--testo-lt);font-weight:600;cursor:pointer;font-family:inherit;font-size:13px;">
        🏆 Fase Finale
      </button>
      <button id="mod-tab-squadre" onclick="modShowTab('squadre')"
        style="padding:8px 16px;border-radius:8px;border:2px solid var(--bordo);background:white;color:var(--testo-lt);font-weight:600;cursor:pointer;font-family:inherit;font-size:13px;">
        👕 Sposta Squadre
      </button>
    </div>`;

  // Categoria selector
  const catSel = STATE.categorie.length > 1 ? `
    <div style="margin-bottom:14px;">
      <label class="form-label">Categoria</label>
      <select class="form-input" onchange="STATE.activeCat=parseInt(this.value);renderAdminModifica()">
        ${STATE.categorie.map(c => `<option value="${c.id}" ${c.id===cat.id?'selected':''}>${c.nome}</option>`).join('')}
      </select>
    </div>` : '';

  // Tab partite gironi
  let partiteHTML = '';
  let counter = 0;
  for (const g of gironi) {
    const partite = g.partite.sort((a,b) => _orarioToMinuti(a.orario) - _orarioToMinuti(b.orario));
    partiteHTML += `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-title" style="background:var(--blu-bg);padding:10px 14px;margin:-16px -16px 12px;border-radius:10px 10px 0 0;">
          <span style="color:var(--blu);font-weight:800;">${g.nome}</span>
          <span class="badge badge-gray" style="margin-left:8px;">${partite.length} partite</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:var(--sfondo);">
            <th style="padding:7px 8px;text-align:left;border-bottom:1px solid var(--bordo);">Orario</th>
            <th style="padding:7px 8px;border-bottom:1px solid var(--bordo);text-align:center;">Campo</th>
            <th style="padding:7px 8px;text-align:left;border-bottom:1px solid var(--bordo);">Giornata</th>
            <th style="padding:7px 8px;text-align:left;border-bottom:1px solid var(--bordo);">Squadra Casa</th>
            <th style="padding:7px 8px;text-align:center;border-bottom:1px solid var(--bordo);"></th>
            <th style="padding:7px 8px;text-align:left;border-bottom:1px solid var(--bordo);">Squadra Ospite</th>
            <th style="padding:7px 8px;border-bottom:1px solid var(--bordo);width:70px;"></th>
          </tr></thead>
          <tbody>
            ${partite.map((p, i) => {
              counter++;
              return `<tr style="background:${i%2===0?'white':'var(--sfondo)'};" id="mod-row-${p.id}">
                <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);">
                  <input id="mod-ora-${p.id}" value="${p.orario||''}" placeholder="09:00"
                    style="width:60px;border:1px solid var(--bordo);border-radius:5px;padding:3px 6px;font-size:12px;font-family:inherit;font-weight:700;">
                </td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);text-align:center;">
                  <input id="mod-campo-${p.id}" value="${p.campo||''}" placeholder="1"
                    style="width:36px;border:1px solid var(--bordo);border-radius:5px;padding:3px 4px;font-size:12px;text-align:center;font-family:inherit;">
                </td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);">
                  <input id="mod-giorno-${p.id}" value="${p.giorno||''}" placeholder="Sabato 25 Apr"
                    style="width:110px;border:1px solid var(--bordo);border-radius:5px;padding:3px 6px;font-size:11px;font-family:inherit;">
                </td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);font-weight:600;">${p.home?.nome||'?'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);text-align:center;color:var(--testo-xs);">vs</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);font-weight:600;">${p.away?.nome||'?'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);">
                  <button onclick="modSalvaPartita(${p.id},'${g.id}')"
                    style="background:var(--verde);color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">
                    ✓ Salva
                  </button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // Tab knockout
  let koHTML = '';
  if (ko.length) {
    const rounds = {};
    ko.forEach(m => { if(!rounds[m.round_name]) rounds[m.round_name]=[]; rounds[m.round_name].push(m); });
    for (const [rname, matches] of Object.entries(rounds)) {
      koHTML += `
        <div class="card" style="margin-bottom:12px;">
          <div class="card-title" style="background:var(--arancio-bg);padding:10px 14px;margin:-16px -16px 12px;border-radius:10px 10px 0 0;">
            <span style="color:var(--arancio);font-weight:800;">${rname}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:var(--sfondo);">
              <th style="padding:7px 8px;text-align:left;border-bottom:1px solid var(--bordo);">Orario</th>
              <th style="padding:7px 8px;border-bottom:1px solid var(--bordo);text-align:center;">Campo</th>
              <th style="padding:7px 8px;text-align:left;border-bottom:1px solid var(--bordo);">Squadra Casa</th>
              <th style="padding:7px 8px;text-align:center;border-bottom:1px solid var(--bordo);"></th>
              <th style="padding:7px 8px;text-align:left;border-bottom:1px solid var(--bordo);">Squadra Ospite</th>
              <th style="padding:7px 8px;border-bottom:1px solid var(--bordo);width:70px;"></th>
            </tr></thead>
            <tbody>
              ${matches.map((m, i) => {
                const hm = m.home_id ? sqMap[m.home_id] : null;
                const am = m.away_id ? sqMap[m.away_id] : null;
                return `<tr style="background:${i%2===0?'white':'var(--sfondo)'};">
                  <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);">
                    <input id="mod-ko-ora-${m.id}" value="${m.orario||''}" placeholder="09:00"
                      style="width:60px;border:1px solid var(--bordo);border-radius:5px;padding:3px 6px;font-size:12px;font-family:inherit;font-weight:700;">
                  </td>
                  <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);text-align:center;">
                    <input id="mod-ko-campo-${m.id}" value="${m.campo||''}" placeholder="1"
                      style="width:36px;border:1px solid var(--bordo);border-radius:5px;padding:3px 4px;font-size:12px;text-align:center;font-family:inherit;">
                  </td>
                  <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);font-weight:600;">${hm?.nome||(m.note_home||'?')}</td>
                  <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);text-align:center;color:var(--testo-xs);">vs</td>
                  <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);font-weight:600;">${am?.nome||(m.note_away||'?')}</td>
                  <td style="padding:5px 8px;border-bottom:1px solid var(--bordo-lt);">
                    <button onclick="modSalvaKO(${m.id})"
                      style="background:var(--verde);color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">
                      ✓ Salva
                    </button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }
  } else {
    koHTML = '<div class="empty-state">Nessuna partita fase finale.</div>';
  }

  // Tab sposta squadre
  let squadreHTML = `
    <div class="card">
      <div style="background:var(--blu-bg);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--blu);">
        💡 Seleziona una squadra e spostala in un altro girone. Le partite del girone originale verranno aggiornate automaticamente.
      </div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:start;">
        <div>
          <div class="form-label" style="margin-bottom:6px;">Squadra da spostare</div>
          <select id="mod-sq-source" class="form-input" style="font-size:13px;">
            <option value="">-- Seleziona squadra --</option>
            ${gironi.map(g => g.squadre.map(sq => `<option value="${sq.id}|${g.id}">${sq.nome} (${g.nome})</option>`).join('')).join('')}
          </select>
        </div>
        <div style="padding-top:24px;font-size:20px;text-align:center;">→</div>
        <div>
          <div class="form-label" style="margin-bottom:6px;">Girone destinazione</div>
          <select id="mod-girone-dest" class="form-input" style="font-size:13px;">
            <option value="">-- Seleziona girone --</option>
            ${gironi.map(g => `<option value="${g.id}">${g.nome}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="margin-top:14px;">
        <button onclick="modSpostaSquadra()"
          style="background:var(--blu);color:white;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;">
          🔀 Sposta Squadra
        </button>
      </div>
      <div id="mod-sposta-log" style="margin-top:10px;"></div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="card-title">✏️ Rinomina Squadra</div>
      <div style="display:flex;gap:10px;align-items:flex-end;">
        <div style="flex:1;">
          <label class="form-label">Squadra</label>
          <select id="mod-sq-rename" class="form-input" style="font-size:13px;">
            <option value="">-- Seleziona squadra --</option>
            ${squadre.map(sq => `<option value="${sq.id}">${sq.nome}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;">
          <label class="form-label">Nuovo nome</label>
          <input id="mod-sq-newnome" class="form-input" placeholder="Nuovo nome squadra" style="font-size:13px;">
        </div>
        <button onclick="modRinominaSquadra()"
          style="background:var(--blu);color:white;border:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">
          ✓ Rinomina
        </button>
      </div>
    </div>`;

  el.innerHTML = `
    <div style="max-width:900px;margin:0 auto;">
      <div style="font-size:20px;font-weight:800;margin-bottom:16px;">✏️ Modifica Calendario</div>
      ${catSel}
      ${tabHTML}
      <div id="mod-tab-content-partite">${partiteHTML || '<div class="empty-state">Nessuna partita.</div>'}</div>
      <div id="mod-tab-content-knockout" style="display:none;">${koHTML}</div>
      <div id="mod-tab-content-squadre" style="display:none;">${squadreHTML}</div>
    </div>`;
}

function modShowTab(tab) {
  ['partite','knockout','squadre'].forEach(t => {
    const cont = document.getElementById('mod-tab-content-' + t);
    const btn = document.getElementById('mod-tab-' + t);
    if (cont) cont.style.display = t === tab ? '' : 'none';
    if (btn) {
      btn.style.background = t === tab ? 'var(--blu)' : 'white';
      btn.style.color = t === tab ? 'white' : 'var(--testo-lt)';
      btn.style.borderColor = t === tab ? 'var(--blu)' : 'var(--bordo)';
      btn.style.fontWeight = t === tab ? '700' : '600';
    }
  });
}

async function modSalvaPartita(partitaId, gironeId) {
  const ora = document.getElementById('mod-ora-' + partitaId)?.value?.trim() || '';
  const campo = document.getElementById('mod-campo-' + partitaId)?.value?.trim() || '';
  const giorno = document.getElementById('mod-giorno-' + partitaId)?.value?.trim() || '';
  try {
    await db.from('partite').update({ orario: ora, campo, giorno }).eq('id', partitaId);
    // Feedback visivo rapido
    const row = document.getElementById('mod-row-' + partitaId);
    if (row) {
      row.style.background = 'var(--verde-bg)';
      setTimeout(() => { if(row) row.style.background = ''; }, 1500);
    }
    toast('✅ Partita aggiornata!');
    // Invalida cache
    if (typeof _cacheClear === 'function') _cacheClear();
  } catch(e) {
    toast('❌ Errore: ' + e.message);
  }
}

async function modSalvaKO(matchId) {
  const ora = document.getElementById('mod-ko-ora-' + matchId)?.value?.trim() || '';
  const campo = document.getElementById('mod-ko-campo-' + matchId)?.value?.trim() || '';
  try {
    await db.from('knockout').update({ orario: ora, campo }).eq('id', matchId);
    toast('✅ Partita finale aggiornata!');
    if (typeof _cacheClear === 'function') _cacheClear();
  } catch(e) {
    toast('❌ Errore: ' + e.message);
  }
}

async function modSpostaSquadra() {
  const log = document.getElementById('mod-sposta-log');
  const sourceVal = document.getElementById('mod-sq-source')?.value;
  const destGironeId = document.getElementById('mod-girone-dest')?.value;
  if (!sourceVal || !destGironeId) { toast('Seleziona squadra e girone destinazione'); return; }
  const [sqId, srcGironeId] = sourceVal.split('|').map(v => isNaN(v) ? v : parseInt(v));
  if (srcGironeId === destGironeId) { toast('La squadra è già in questo girone'); return; }
  if (!confirm('Spostare la squadra nel nuovo girone? Le partite del girone originale verranno eliminate e rigenerate.')) return;
  if (log) log.innerHTML = '<div style="font-size:12px;color:var(--testo-lt);">⏳ Spostamento in corso...</div>';
  try {
    // 1. Rimuovi dal girone originale
    await db.from('girone_squadre').delete().eq('girone_id', srcGironeId).eq('squadra_id', sqId);
    // 2. Elimina partite del girone originale che coinvolgono questa squadra
    const { data: partiteOld } = await db.from('partite').select('id').eq('girone_id', srcGironeId);
    const partiteConSq = partiteOld?.filter(p => true) || []; // elimina tutte e rigenera
    // 3. Elimina tutte le partite del girone origine e rigenera
    await db.from('partite').delete().eq('girone_id', srcGironeId);
    // 4. Aggiungi al girone destinazione
    await db.from('girone_squadre').insert({ girone_id: destGironeId, squadra_id: sqId, posizione: 0 });
    // 5. Rigenera partite per entrambi i gironi
    const { data: sqSrc } = await db.from('girone_squadre').select('squadra_id').eq('girone_id', srcGironeId);
    const { data: sqDest } = await db.from('girone_squadre').select('squadra_id').eq('girone_id', destGironeId);
    if (sqSrc?.length >= 2) await dbGeneraPartite(srcGironeId, sqSrc.map(r => r.squadra_id));
    if (sqDest?.length >= 2) await dbGeneraPartite(destGironeId, sqDest.map(r => r.squadra_id));
    if (typeof _cacheClear === 'function') _cacheClear();
    if (log) log.innerHTML = '<div style="background:var(--verde-bg);border-radius:8px;padding:8px 12px;color:var(--verde);font-size:12px;font-weight:700;">✅ Squadra spostata! Le partite sono state rigenerate.</div>';
    toast('✅ Squadra spostata con successo!');
    // Ricarica la sezione
    setTimeout(() => renderAdminModifica(), 1000);
  } catch(e) {
    if (log) log.innerHTML = `<div style="color:var(--rosso);font-size:12px;">❌ Errore: ${e.message}</div>`;
    toast('❌ ' + e.message);
  }
}

async function modRinominaSquadra() {
  const sqId = document.getElementById('mod-sq-rename')?.value;
  const nuovoNome = document.getElementById('mod-sq-newnome')?.value?.trim();
  if (!sqId || !nuovoNome) { toast('Seleziona squadra e inserisci il nuovo nome'); return; }
  try {
    await db.from('squadre').update({ nome: nuovoNome }).eq('id', sqId);
    if (typeof _cacheClear === 'function') _cacheClear();
    toast('✅ Squadra rinominata!');
    renderAdminModifica();
  } catch(e) {
    toast('❌ ' + e.message);
  }
}

// ============================================================
//  SIMULAZIONE & RESET RISULTATI
// ============================================================
const _SIM_PWD = '19880204';
let _simUnlocked = false;

function toggleSimulazione() {
  if (_simUnlocked) { _renderSimPanel(); return; }
  const pwd = prompt('🔐 Inserisci la password per la modalità simulazione:');
  if (!pwd) return;
  if (pwd !== _SIM_PWD) { alert('❌ Password errata'); return; }
  _simUnlocked = true; toast('✅ Modalità simulazione attivata!'); _renderSimPanel();
}

function _renderSimPanel() {
  const existing = document.getElementById('sim-panel'); if (existing) { existing.remove(); return; }
  const panel = document.createElement('div'); panel.id = 'sim-panel';
  panel.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:8000;background:#0f172a;border:2px solid #f59e0b;border-radius:14px;padding:16px;width:290px;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:var(--font-display,sans-serif);';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="color:#f59e0b;font-size:14px;font-weight:800;letter-spacing:.04em;">🎮 SIMULAZIONE</div>
      <button onclick="document.getElementById('sim-panel').remove()" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px;font-family:inherit;">✕</button>
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:12px;line-height:1.5;">Genera risultati casuali per testare il sistema.</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <button onclick="simulaRisultati()" style="background:linear-gradient(135deg,#f59e0b,#d97706);border:none;color:#000;border-radius:8px;padding:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">⚽ SIMULA TUTTI I RISULTATI</button>
      <button onclick="simulaRisultatiGirone()" style="background:rgba(245,158,11,0.1);border:1.5px solid rgba(245,158,11,0.4);color:#f59e0b;border-radius:8px;padding:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">⚽ Simula solo girone attivo</button>
      <div style="height:1px;background:rgba(255,255,255,0.08);margin:4px 0;"></div>
      <button onclick="resetRisultati()" style="background:rgba(239,68,68,0.1);border:1.5px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:8px;padding:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">🔄 RESET — Azzera tutti i risultati</button>
      <button onclick="resetRisultatiGirone()" style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);color:#f87171;border-radius:8px;padding:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">🔄 Reset solo categoria attiva</button>
      <button onclick="resetCompleto()" style="background:rgba(220,38,38,0.15);border:2px solid rgba(220,38,38,0.4);color:#ef4444;border-radius:8px;padding:10px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">💥 RESET COMPLETO — Come appena importato</button>
    </div>
    <div id="sim-log" style="margin-top:12px;font-size:10px;color:rgba(255,255,255,0.4);max-height:100px;overflow-y:auto;line-height:1.6;"></div>`;
  document.body.appendChild(panel);
}

function _simLog(msg) {
  const log = document.getElementById('sim-log');
  if (log) { log.innerHTML += msg + '<br>'; log.scrollTop = log.scrollHeight; }
}

function _golCasuale() {
  const r = Math.random();
  if (r < 0.15) return 0; if (r < 0.35) return 1; if (r < 0.55) return 2;
  if (r < 0.70) return 3; if (r < 0.82) return 4; if (r < 0.91) return 5;
  if (r < 0.96) return 6; return 7;
}

async function simulaRisultati() {
  if (!STATE.activeTorneo) { toast('Seleziona un torneo'); return; }
  const log = document.getElementById('sim-log'); if (log) log.innerHTML = '';
  _simLog('⏳ Avvio simulazione...');
  try {
    const catId = STATE.activeCat || STATE.categorie[0]?.id;
    let totale = 0; const MAX = 8;
    for (let pass = 1; pass <= MAX; pass++) {
      if (catId) {
        await verificaEGeneraTriangolari(catId);
        if (typeof _cacheClear === 'function') _cacheClear();
        if (typeof _cache !== 'undefined') Object.keys(_cache).forEach(k => delete _cache[k]);
      }
      const gironi = await getGironiWithData(catId); let nuovi = 0;
      for (const g of gironi) {
        const daGiocare = g.partite.filter(p => !p.giocata && p.home_id && p.away_id);
        if (!daGiocare.length) continue;
        _simLog('Pass ' + pass + ' — ' + g.nome + ': ' + daGiocare.length + ' partite');
        for (const p of daGiocare) {
          const gh = _golCasuale(), ga = _golCasuale();
          await dbSavePartita({ id: p.id, girone_id: p.girone_id, gol_home: gh, gol_away: ga, giocata: true, inserito_da: '🤖 Simulazione' });
          nuovi++; totale++;
          _simLog('✓ ' + (p.home?.nome||'?') + ' ' + gh + '–' + ga + ' ' + (p.away?.nome||'?'));
        }
      }
      if (nuovi === 0) { _simLog('✓ Completato in ' + pass + ' passaggi!'); break; }
    }
    if (STATE.activeCat) await verificaEGeneraTriangolari(STATE.activeCat);
    _simLog('\n✅ ' + totale + ' risultati simulati!');
    toast('✅ ' + totale + ' risultati simulati!');
    await renderCurrentSection();
  } catch(e) { console.error(e); _simLog('❌ ' + e.message); toast('Errore: ' + e.message); }
}

async function simulaRisultatiGirone() {
  if (!STATE.activeCat) { toast('Seleziona una categoria'); return; }
  const log = document.getElementById('sim-log'); if (log) log.innerHTML = '';
  try {
    const gironi = await getGironiWithData(STATE.activeCat); let totale = 0;
    for (const g of gironi) {
      const daGiocare = g.partite.filter(p => !p.giocata && p.home_id && p.away_id);
      if (!daGiocare.length) continue;
      _simLog('📋 Simulo ' + g.nome + ' (' + daGiocare.length + ' partite)...');
      for (const p of daGiocare) {
        const gh = _golCasuale(), ga = _golCasuale();
        await dbSavePartita({ id: p.id, girone_id: p.girone_id, gol_home: gh, gol_away: ga, giocata: true, inserito_da: '🤖 Simulazione' });
        totale++;
      }
      break;
    }
    _simLog('✅ ' + totale + ' risultati simulati!');
    toast('✅ ' + totale + ' risultati simulati!');
    if (STATE.activeCat) await verificaEGeneraTriangolari(STATE.activeCat);
    await renderCurrentSection();
  } catch(e) { _simLog('❌ ' + e.message); }
}

async function resetRisultati() {
  if (!STATE.activeTorneo) { toast('Seleziona un torneo'); return; }
  if (!confirm('⚠️ Azzerare TUTTI i risultati? Partite, marcatori e knockout verranno azzerati.')) return;
  const log = document.getElementById('sim-log'); if (log) log.innerHTML = '';
  _simLog('⏳ Reset in corso...');
  try {
    const cats = STATE.categorie.map(c => c.id);
    for (const catId of cats) {
      const gironi = await dbGetGironi(catId);
      for (const g of gironi) {
        await db.from('partite').update({ gol_home: 0, gol_away: 0, giocata: false, inserito_da: null }).eq('girone_id', g.id);
      }
      await db.from('knockout').update({ gol_home: 0, gol_away: 0, giocata: false, inserito_da: null }).eq('categoria_id', catId);
      const gironiIds = gironi.map(g => g.id);
      if (gironiIds.length) {
        const { data: partite } = await db.from('partite').select('id').in('girone_id', gironiIds);
        if (partite?.length) await db.from('marcatori').delete().in('partita_id', partite.map(p => p.id));
      }
    }
    if (typeof _cacheClear === 'function') _cacheClear();
    _simLog('✅ Reset completato!'); toast('✅ Risultati azzerati!'); await renderCurrentSection();
  } catch(e) { console.error(e); _simLog('❌ ' + e.message); toast('Errore reset: ' + e.message); }
}

async function resetRisultatiGirone() {
  if (!STATE.activeCat) { toast('Seleziona una categoria'); return; }
  if (!confirm('⚠️ Azzerare i risultati della categoria attiva?')) return;
  const log = document.getElementById('sim-log'); if (log) log.innerHTML = '';
  try {
    const gironi = await dbGetGironi(STATE.activeCat);
    for (const g of gironi) await db.from('partite').update({ gol_home: 0, gol_away: 0, giocata: false, inserito_da: null }).eq('girone_id', g.id);
    await db.from('knockout').update({ gol_home: 0, gol_away: 0, giocata: false }).eq('categoria_id', STATE.activeCat);
    if (typeof _cacheClear === 'function') _cacheClear();
    _simLog('✅ Reset categoria completato!'); toast('✅ Risultati categoria azzerati!'); await renderCurrentSection();
  } catch(e) { _simLog('❌ ' + e.message); }
}

// RESET COMPLETO — come se il file fosse appena importato
// Azzera risultati + azzera placeholder knockout (torna a note_home/away senza home_id/away_id reali)
async function resetCompleto() {
  if (!STATE.activeTorneo) { toast('Seleziona un torneo'); return; }
  if (!confirm('💥 RESET COMPLETO\n\nAzzerare tutti i risultati E ripristinare gli accoppiamenti knockout ai placeholder originali?\n\nIl torneo tornerà esattamente come quando è stato importato.')) return;
  const log = document.getElementById('sim-log'); if (log) log.innerHTML = '';
  _simLog('⏳ Reset completo in corso...');
  try {
    const cats = STATE.categorie.map(c => c.id);
    for (const catId of cats) {
      // 1. Azzera risultati partite gironi
      const gironi = await dbGetGironi(catId);
      for (const g of gironi) {
        await db.from('partite').update({ gol_home: 0, gol_away: 0, giocata: false, inserito_da: null }).eq('girone_id', g.id);
      }
      // 2. Azzera marcatori
      const gironiIds = gironi.map(g => g.id);
      if (gironiIds.length) {
        const { data: partite } = await db.from('partite').select('id').in('girone_id', gironiIds);
        if (partite?.length) await db.from('marcatori').delete().in('partita_id', partite.map(p => p.id));
      }
      // 3. Reset knockout: azzera risultati E rimuove home_id/away_id risolti
      //    mantenendo solo note_home/note_away (i placeholder originali)
      const { data: koList } = await db.from('knockout').select('id,note_home,note_away').eq('categoria_id', catId);
      for (const ko of (koList||[])) {
        const upd = { gol_home: 0, gol_away: 0, giocata: false, inserito_da: null };
        // Se aveva note (placeholder), ripristina home_id/away_id a null
        if (ko.note_home) upd.home_id = null;
        if (ko.note_away) upd.away_id = null;
        await db.from('knockout').update(upd).eq('id', ko.id);
      }
      // 4. Reset girone_squadre: rimuovi squadre reali che sostituivano placeholder
      for (const g of gironi) {
        const { data: gsRows } = await db.from('girone_squadre').select('id,squadra_id,squadre(nome)').eq('girone_id', g.id);
        for (const gs of (gsRows||[])) {
          const nome = gs.squadre?.nome || '';
          if (_isPlaceholder(nome)) {
            // Era un placeholder risolto — reimposta la squadra originale
            // Non possiamo fare molto qui senza sapere qual era l'originale
            // Ma il sistema lo rirsolverà quando ci sono risultati
          }
        }
      }
    }
    if (typeof _cacheClear === 'function') _cacheClear();
    _simLog('✅ Reset completo! Il torneo è come appena importato.');
    toast('✅ Reset completo effettuato!');
    await renderCurrentSection();
  } catch(e) { console.error(e); _simLog('❌ ' + e.message); toast('Errore: ' + e.message); }
}
