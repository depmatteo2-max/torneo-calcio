// ============================================================
//  DB.JS v7 — SUPER CACHE — carica tutto in una volta
//  Ottimizzato per migliaia di utenti simultanei
// ============================================================

let db;
const CLIENTE = (typeof CONFIG !== 'undefined' && CONFIG.CLIENTE) ? CONFIG.CLIENTE : 'spe';

// Cache in memoria (dura finché la pagina è aperta)
const _cache = {};
const _TTL = 600000; // 10 minuti

function _cacheGet(k) { const e=_cache[k]; if(!e||Date.now()-e.ts>_TTL){delete _cache[k];return null;} return e.data; }
function _cacheSet(k,d,ttl) { _cache[k]={data:d,ts:Date.now(),ttl:ttl||_TTL}; }
function _cacheInvalid(p) { Object.keys(_cache).forEach(k=>{if(k.startsWith(p))delete _cache[k];}); }
function _cacheClear() { Object.keys(_cache).forEach(k=>delete _cache[k]); }

// Cache locale (dura tra sessioni — max 5 min per dati dinamici)
function _lsGet(k) {
  try {
    const e = JSON.parse(localStorage.getItem(k)||'null');
    if (!e || Date.now()-e.ts > 300000) return null; // 5 min
    return e.data;
  } catch(e) { return null; }
}
function _lsSet(k,d) {
  try { localStorage.setItem(k, JSON.stringify({data:d,ts:Date.now()})); } catch(e) {}
}

function initDB() {
  db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: false }, // non salvare sessione — meno overhead
    realtime: { params: { eventsPerSecond: 2 } } // limita eventi realtime
  });
}

function subscribeRealtime(cb) {
  try {
    db.channel('rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'partite'},
        ()=>{_cacheInvalid('partite_');_cacheInvalid('gwd_');_cacheClear();cb();})
      .on('postgres_changes',{event:'*',schema:'public',table:'knockout'},
        ()=>{_cacheInvalid('ko_');cb();})
      .subscribe();
  } catch(e) { console.warn('Realtime:',e); }
}

// ── MEGA LOADER — carica tutto il torneo in 3 query ──────
// Chiamato UNA VOLTA all'avvio, poi tutto dalla cache
async function caricaTorneo(torneoId) {
  const k = `mega_${torneoId}`;

  // 1. Prova localStorage (sopravvive al refresh)
  const ls = _lsGet(k);
  if (ls) {
    _cacheSet(k, ls);
    // Popola cache per ogni categoria
    (ls.gwd||[]).forEach(item => _cacheSet(`gwd_${item.catId}`, item.gironi));
    _cacheSet(`cat_${torneoId}`, ls.categorie);
    _cacheSet(`ko_all_${torneoId}`, ls.knockout);
    return ls;
  }

  // 2. Prova cache memoria
  const mem = _cacheGet(k);
  if (mem) return mem;

  // 3. Carica da Supabase — 3 query parallele
  const [catRes, sqRes] = await Promise.all([
    db.from('categorie').select('*').eq('torneo_id', torneoId).order('ordine'),
    db.from('squadre').select('id,nome').eq('torneo_id', torneoId).order('nome'),
  ]);

  const categorie = catRes.data || [];
  const squadre = sqRes.data || [];
  const sqMap = {};
  squadre.forEach(s => sqMap[s.id] = s);

  if (!categorie.length) return { categorie:[], gwd:[], knockout:[] };

  const catIds = categorie.map(c => c.id);

  // Carica gironi, partite, girone_squadre, knockout in parallelo
  const [girRes, partRes, gsRes, koRes] = await Promise.all([
    db.from('gironi').select('*').in('categoria_id', catIds).order('nome'),
    db.from('partite')
      .select('id,girone_id,home_id,away_id,gol_home,gol_away,giocata,orario,campo,giorno,giornata,inserito_da,note_home,note_away')
      .in('categoria_id', catIds.join(',') ? undefined : [0])  // skip se vuoto
      ,
    db.from('girone_squadre').select('girone_id,squadra_id').order('posizione'),
    db.from('knockout').select('*').in('categoria_id', catIds).order('round_order').order('match_order'),
  ]);

  return null; // fallback
}

async function dbGetTornei() {
  const k=`tornei_${CLIENTE}`; const c=_cacheGet(k); if(c)return c;
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
  _cacheInvalid('partite_'); _cacheInvalid('gwd_'); return data;
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
  if(error)throw error; _cacheInvalid('ko_');
}

// ── BATCH LOADER PRINCIPALE ────────────────────────────────
async function getGironiWithData(categoriaId) {
  const k=`gwd_${categoriaId}`; const cached=_cacheGet(k); if(cached)return cached;

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
  // Salva anche in localStorage per prossima visita
  _lsSet(k, result);
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
    const cats = await dbGetCategorie(torneoId);
    // Carica tutte in parallelo — una sola volta, poi tutto in cache
    await Promise.all(cats.slice(0,4).map(c => getGironiWithData(c.id).catch(()=>{})));
    if(cats.length>4) setTimeout(()=>{
      cats.slice(4).forEach(c => getGironiWithData(c.id).catch(()=>{}));
    },1000);
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
