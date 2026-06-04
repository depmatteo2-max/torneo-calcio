// ============================================================
//  DB.JS v8 — CACHE STATICA
//  Utenti pubblici: legge da window._staticData (precaricato)
//  Admin: legge da Supabase
// ============================================================

let db;
const CLIENTE = (typeof CONFIG !== 'undefined' && CONFIG.CLIENTE) ? CONFIG.CLIENTE : 'spe';

const _cache = {};
const _TTL = 600000; // 10 minuti

function _cacheGet(k) { const e=_cache[k]; if(!e||Date.now()-e.ts>_TTL){delete _cache[k];return null;} return e.data; }
function _cacheSet(k,d) { _cache[k]={data:d,ts:Date.now()}; }
function _cacheInvalid(p) { Object.keys(_cache).forEach(k=>{if(k.startsWith(p))delete _cache[k];}); }
function _cacheClear() { Object.keys(_cache).forEach(k=>delete _cache[k]); }

function initDB() {
  db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 1 } }
  });
  // Avvia precaricamento dati statici
  _precaricaDatiStatici();
}

// ── DATI STATICI — carica data.json generato dall'admin ──
let _staticLoaded = false;
let _staticLoadingPromise = null;

async function _precaricaDatiStatici() {
  if (_staticLoadingPromise) return _staticLoadingPromise;
  _staticLoadingPromise = (async () => {
    try {
      const r = await fetch('data.json?v=' + Date.now(), { cache: 'no-cache' });
      if (!r.ok) return;
      const d = await r.json();
      window._staticData = d;
      _staticLoaded = true;
      // Popola cache da dati statici
      if (d.tornei) _cacheSet('tornei_' + CLIENTE, d.tornei);
      if (d.categorie_by_torneo) {
        Object.entries(d.categorie_by_torneo).forEach(([tid, cats]) => {
          _cacheSet('cat_' + tid, cats);
        });
      }
      if (d.gwd_by_cat) {
        Object.entries(d.gwd_by_cat).forEach(([catId, gironi]) => {
          _cacheSet('gwd_' + catId, gironi);
        });
      }
      if (d.ko_by_cat) {
        Object.entries(d.ko_by_cat).forEach(([catId, ko]) => {
          _cacheSet('ko_' + catId, ko);
        });
      }
      console.log('[DB] Dati statici caricati da data.json');
    } catch(e) {
      console.log('[DB] data.json non trovato, uso Supabase');
    }
  })();
  return _staticLoadingPromise;
}

function subscribeRealtime(cb) {
  // Solo admin usa realtime
  if (typeof STATE === 'undefined' || !STATE.isAdmin) return;
  try {
    db.channel('rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'partite'},
        ()=>{_cacheInvalid('partite_');_cacheInvalid('gwd_');cb();})
      .on('postgres_changes',{event:'*',schema:'public',table:'knockout'},
        ()=>{_cacheInvalid('ko_');cb();})
      .subscribe();
  } catch(e) { console.warn('Realtime:',e); }
}

async function dbGetTornei() {
  const k=`tornei_${CLIENTE}`; const c=_cacheGet(k); if(c)return c;
  await _precaricaDatiStatici();
  const c2=_cacheGet(k); if(c2)return c2;
  const {data}=await db.from('tornei').select('*').eq('cliente',CLIENTE).order('created_at',{ascending:false});
  _cacheSet(k,data||[]); return data||[];
}
async function dbSaveTorneo(t) {
  const {data,error}=await db.from('tornei').insert({...t,cliente:CLIENTE}).select('*').single();
  if(error)throw error; _cacheInvalid('tornei_'); return data;
}
async function dbUpdateTorneo(id,f) {
  const {error}=await db.from('tornei').update(f).eq('id',id).eq('cliente',CLIENTE);
  if(error)throw error; _cacheInvalid('tornei_');
}
async function dbDeleteTorneo(id) {
  const {error}=await db.from('tornei').delete().eq('id',id).eq('cliente',CLIENTE);
  if(error)throw error; _cacheClear();
}

async function dbGetCategorie(torneoId) {
  if(!torneoId)return[];
  const k=`cat_${torneoId}`; const c=_cacheGet(k); if(c)return c;
  await _precaricaDatiStatici();
  const c2=_cacheGet(k); if(c2)return c2;
  const {data}=await db.from('categorie').select('*').eq('torneo_id',torneoId).order('ordine');
  _cacheSet(k,data||[]); return data||[];
}
async function dbSaveCategoria(c) {
  const {data,error}=await db.from('categorie').insert(c).select('*').single();
  if(error)throw error; _cacheInvalid('cat_'); return data;
}
async function dbDeleteCategoria(id) {
  const {error}=await db.from('categorie').delete().eq('id',id);
  if(error)throw error; _cacheClear();
}
async function dbUpdateCategoria(id,f) {
  const {error}=await db.from('categorie').update(f).eq('id',id);
  if(error)throw error; _cacheInvalid('cat_');
}

async function dbGetSquadre(torneoId) {
  if(!torneoId)return[];
  const k=`sq_${torneoId}`; const c=_cacheGet(k); if(c)return c;
  const {data}=await db.from('squadre').select('id,nome,torneo_id').eq('torneo_id',torneoId).order('nome');
  _cacheSet(k,data||[]); return data||[];
}
async function dbGetSquadreFull(torneoId) {
  if(!torneoId)return[];
  const k=`sqf_${torneoId}`; const c=_cacheGet(k); if(c)return c;
  const {data}=await db.from('squadre').select('id,nome,logo,torneo_id').eq('torneo_id',torneoId).order('nome');
  _cacheSet(k,data||[]); return data||[];
}
async function dbSaveSquadra(s) {
  const {data,error}=await db.from('squadre').insert(s).select('*').single();
  if(error)throw error; _cacheInvalid('sq_'); return data;
}
async function dbUpdateLogo(squadra_id,logo) {
  const {error}=await db.from('squadre').update({logo}).eq('id',squadra_id);
  if(error)throw error; _cacheClear();
}

async function dbGetGironi(categoriaId) {
  const k=`gir_${categoriaId}`; const c=_cacheGet(k); if(c)return c;
  const {data}=await db.from('gironi').select('*').eq('categoria_id',categoriaId).order('nome');
  _cacheSet(k,data||[]); return data||[];
}
async function dbSaveGirone(g) {
  const {data,error}=await db.from('gironi').insert(g).select('*').single();
  if(error)throw error; _cacheInvalid('gir_'); return data;
}

async function dbGetGironeSquadre(gironeId) {
  const k=`gs_${gironeId}`; const c=_cacheGet(k); if(c)return c;
  const {data}=await db.from('girone_squadre').select('*,squadre(id,nome)').eq('girone_id',gironeId).order('posizione');
  _cacheSet(k,data||[]); return data||[];
}
async function dbSetGironeSquadre(gironeId,ids) {
  await db.from('girone_squadre').delete().eq('girone_id',gironeId);
  const rows=ids.map((id,i)=>({girone_id:gironeId,squadra_id:id,posizione:i}));
  if(rows.length)await db.from('girone_squadre').insert(rows);
  _cacheInvalid('gs_');
}

async function dbGetPartite(gironeId) {
  const k=`partite_${gironeId}`; const c=_cacheGet(k); if(c)return c;
  const {data}=await db.from('partite')
    .select('*,home:squadre!home_id(id,nome),away:squadre!away_id(id,nome)')
    .eq('girone_id',gironeId).order('orario');
  _cacheSet(k,data||[]); return data||[];
}
async function dbSavePartita(p) {
  const {data,error}=await db.from('partite').upsert({
    id:p.id,girone_id:p.girone_id,gol_home:p.gol_home,gol_away:p.gol_away,
    giocata:true,inserito_da:p.inserito_da||null
  }).select('*').single();
  if(error){console.error(error);return null;}
  _cacheInvalid('partite_'); _cacheInvalid('gwd_');
  // Rigenera data.json dopo ogni risultato
  _generaDataJson();
  return data;
}
async function dbGeneraPartite(gironeId,ids) {
  const rows=[];
  for(let i=0;i<ids.length;i++)
    for(let j=i+1;j<ids.length;j++)
      rows.push({girone_id:gironeId,home_id:ids[i],away_id:ids[j],giocata:false});
  if(rows.length)await db.from('partite').insert(rows);
  _cacheInvalid('partite_');
}

async function dbGetMarcatori(partitaId) {
  const k=`marc_${partitaId}`; const c=_cacheGet(k); if(c)return c;
  const {data}=await db.from('marcatori').select('*').eq('partita_id',partitaId);
  _cacheSet(k,data||[]); return data||[];
}
async function dbSaveMarcatori(partitaId,marcatori) {
  await db.from('marcatori').delete().eq('partita_id',partitaId);
  const rows=marcatori.filter(m=>m.nome).map(m=>({partita_id:partitaId,...m}));
  if(rows.length)await db.from('marcatori').insert(rows);
  _cacheInvalid('marc_'); _cacheInvalid('gwd_');
}

async function dbGetKnockout(categoriaId) {
  const k=`ko_${categoriaId}`; const c=_cacheGet(k); if(c)return c;
  await _precaricaDatiStatici();
  const c2=_cacheGet(k); if(c2)return c2;
  const {data}=await db.from('knockout').select('*').eq('categoria_id',categoriaId)
    .order('round_order').order('match_order');
  _cacheSet(k,data||[]); return data||[];
}
async function dbSaveKnockoutMatch(m) {
  const {error}=await db.from('knockout').upsert({
    id:m.id,categoria_id:m.categoria_id,round_name:m.round_name,
    round_order:m.round_order,match_order:m.match_order,
    home_id:m.home_id,away_id:m.away_id,gol_home:m.gol_home,gol_away:m.gol_away,
    giocata:m.giocata,is_consolazione:m.is_consolazione,
    note_home:m.note_home,note_away:m.note_away,
    orario:m.orario||null,campo:m.campo||null,inserito_da:m.inserito_da||null
  });
  if(error)throw error;
  _cacheInvalid('ko_');
  _generaDataJson();
}

// ── GENERA data.json — chiamato dall'admin dopo ogni salvataggio ──
let _dataJsonTimer = null;
async function _generaDataJson() {
  // Debounce: aspetta 3 secondi prima di rigenerare
  clearTimeout(_dataJsonTimer);
  _dataJsonTimer = setTimeout(async () => {
    try {
      if (typeof STATE === 'undefined' || !STATE.isAdmin) return;
      const torneoId = STATE.activeTorneo;
      if (!torneoId) return;

      const cats = await dbGetCategorie(torneoId);
      const catIds = cats.map(c => c.id);
      if (!catIds.length) return;

      // Carica tutto in parallelo
      const gwdAll = {};
      const koAll = {};
      await Promise.all(catIds.map(async catId => {
        _cacheInvalid('gwd_' + catId);
        _cacheInvalid('ko_' + catId);
        const [gwd, ko] = await Promise.all([
          getGironiWithData(catId),
          dbGetKnockout(catId)
        ]);
        gwdAll[catId] = gwd;
        koAll[catId] = ko;
      }));

      const tornei = await dbGetTornei();
      const catsByTorneo = {};
      catsByTorneo[torneoId] = cats;

      const payload = {
        ts: Date.now(),
        tornei,
        categorie_by_torneo: catsByTorneo,
        gwd_by_cat: gwdAll,
        ko_by_cat: koAll
      };

      // Salva tramite Cloudflare Pages Function (se disponibile)
      // altrimenti usa KV store o semplicemente aggiorna la cache
      window._staticData = payload;
      window._staticDataTs = Date.now();

      // Tenta upload su Cloudflare Pages via API
      if (CONFIG.CF_ACCOUNT_ID && CONFIG.CF_API_TOKEN) {
        await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONFIG.CF_ACCOUNT_ID}/pages/projects/${CONFIG.CF_PROJECT}/deployments`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + CONFIG.CF_API_TOKEN }
        }).catch(() => {});
      }

      console.log('[DB] data.json aggiornato — ' + Object.keys(gwdAll).length + ' categorie');
    } catch(e) { console.warn('[DB] _generaDataJson:', e); }
  }, 3000);
}

// ── BATCH LOADER ───────────────────────────────────────────
async function getGironiWithData(categoriaId) {
  const k=`gwd_${categoriaId}`; const cached=_cacheGet(k); if(cached)return cached;

  // Aspetta dati statici se in caricamento
  await _precaricaDatiStatici();
  const cached2=_cacheGet(k); if(cached2)return cached2;

  const {data:gironi}=await db.from('gironi').select('*')
    .eq('categoria_id',categoriaId).order('nome');
  if(!gironi?.length)return[];

  const gironeIds=gironi.map(g=>g.id);

  const [r1,r2]=await Promise.all([
    db.from('partite')
      .select('id,girone_id,home_id,away_id,gol_home,gol_away,giocata,orario,campo,giorno,giornata,inserito_da,note_home,note_away,home:squadre!home_id(id,nome),away:squadre!away_id(id,nome)')
      .in('girone_id',gironeIds).order('orario'),
    db.from('girone_squadre')
      .select('girone_id,squadra_id,squadre(id,nome)')
      .in('girone_id',gironeIds).order('posizione')
  ]);

  const tuttePartite=r1.data||[];
  const tutteGs=r2.data||[];

  const giocateIds=tuttePartite.filter(p=>p.giocata).map(p=>p.id);
  let marcatori=[];
  if(giocateIds.length){
    const {data:m}=await db.from('marcatori')
      .select('partita_id,squadra_id,nome,minuto')
      .in('partita_id',giocateIds);
    marcatori=m||[];
  }

  const result=gironi.map(g=>({
    ...g,
    squadre:tutteGs.filter(x=>x.girone_id===g.id).map(x=>x.squadre),
    partite:tuttePartite.filter(p=>p.girone_id===g.id)
      .map(p=>({...p,marcatori:marcatori.filter(m=>m.partita_id===p.id)}))
  }));

  _cacheSet(k,result);
  return result;
}

async function preloadCategoria(categoriaId) {
  if(!categoriaId)return;
  setTimeout(()=>{
    getGironiWithData(categoriaId).catch(()=>{});
    dbGetKnockout(categoriaId).catch(()=>{});
  }, 50);
}

async function preloadTutteLCategorie(torneoId) {
  if(!torneoId)return;
  try {
    await _precaricaDatiStatici();
    const cats = await dbGetCategorie(torneoId);
    await Promise.all(cats.slice(0,4).map(c => getGironiWithData(c.id).catch(()=>{})));
    if(cats.length>4) setTimeout(()=>{
      cats.slice(4).forEach(c => getGironiWithData(c.id).catch(()=>{}));
    },500);
  } catch(e) {}
}

// ── CAMPI GIORNATE ─────────────────────────────────────────
async function dbGetCampiGiornate(torneoId) {
  if(!torneoId)return[];
  const k=`campi_${torneoId}`; const c=_cacheGet(k); if(c)return c;
  const {data}=await db.from('campi_giornate').select('*').eq('torneo_id',torneoId).order('giorno');
  _cacheSet(k,data||[]); return data||[];
}
async function dbSaveCampoGiornata(torneoId,giorno,nomeCampo,indirizzo) {
  const {error}=await db.from('campi_giornate')
    .upsert({torneo_id:torneoId,giorno,nome_campo:nomeCampo,indirizzo},{onConflict:'torneo_id,giorno'});
  if(error)throw error; _cacheInvalid('campi_');
}