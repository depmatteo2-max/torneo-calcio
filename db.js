// ============================================================
//  DB.JS v9 — CLOUDFLARE KV
//  Utenti pubblici: legge da Cloudflare KV Worker
//  Admin: legge da Supabase + scrive su KV dopo ogni salvataggio
// ============================================================

let db;
const CLIENTE = (typeof CONFIG !== 'undefined' && CONFIG.CLIENTE) ? CONFIG.CLIENTE : 'mclion';
const KV_WORKER_URL = 'https://mclion-api.torneo-live.workers.dev';
const KV_AUTH = 'Bearer mclion2026';

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
  _precaricaDatiStatici();
}

// ── DATI STATICI — carica da Cloudflare KV Worker ──
let _staticLoaded = false;
let _staticLoadingPromise = null;

async function _precaricaDatiStatici() {
  if (_staticLoadingPromise) return _staticLoadingPromise;
  _staticLoadingPromise = (async () => {
    try {
      const r = await fetch(KV_WORKER_URL + '/data', { cache: 'no-cache' });
      if (!r.ok) throw new Error('KV not ok');
      const d = await r.json();
      window._staticData = d;
      _staticLoaded = true;
      // Verifica che i tornei nel KV appartengano al cliente corretto
      if (d.tornei) {
        const torneiCliente = d.tornei.filter(t => !t.cliente || t.cliente === CLIENTE);
        if (torneiCliente.length > 0) {
          _cacheSet('tornei_' + CLIENTE, torneiCliente);
        }
        // Se nessun torneo appartiene a questo cliente, non popolare la cache
        // così dbGetTornei() leggerà dal DB
      }
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
      if (d.logos) {
        window._staticLogos = d.logos;
        window._logoCache = d.logos;
      }
      console.log('[DB] Dati caricati da Cloudflare KV');
    } catch(e) {
      console.log('[DB] KV non disponibile, uso Supabase:', e.message);
    }
  })();
  return _staticLoadingPromise;
}

function subscribeRealtime(cb) {
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
  // Aggiorna loghi nel KV subito
  _aggiornaLoghiKV().catch(()=>{});
}

async function _aggiornaLoghiKV() {
  try {
    const torneoId = (typeof STATE !== 'undefined' && STATE.activeTorneo) ? STATE.activeTorneo : null;
    if (!torneoId) return;
    // Leggi tutti i loghi dal DB
    const {data:sq} = await db.from('squadre').select('id,nome,logo').eq('torneo_id', torneoId);
    const logos = {};
    (sq||[]).forEach(s => { logos[s.id] = {nome: s.nome, logo: s.logo||null}; });
    // Aggiorna KV mantenendo il resto dei dati
    const res = await fetch(KV_WORKER_URL + '/data', {cache:'no-cache'});
    const kvData = res.ok ? await res.json() : {};
    kvData.logos = logos;
    kvData.ts = Date.now();
    await fetch(KV_WORKER_URL + '/update', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization': KV_AUTH},
      body: JSON.stringify(kvData)
    });
    console.log('[DB] Loghi aggiornati nel KV ✓');
  } catch(e) { console.warn('[DB] Loghi KV update fallito:', e); }
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

// ── GENERA E INVIA SU CLOUDFLARE KV ──────────────────────
let _dataJsonTimer = null;
async function _generaDataJson() {
  clearTimeout(_dataJsonTimer);
  _dataJsonTimer = setTimeout(async () => {
    try {
      if (typeof STATE === 'undefined' || !STATE.isAdmin) return;
      const torneoId = STATE.activeTorneo;
      if (!torneoId) return;

      const cats = await dbGetCategorie(torneoId);
      const catIds = cats.map(c => c.id);
      if (!catIds.length) return;

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

      // Includi squadre/loghi nel payload per renderRisultati
      const { data: squadreKV } = await db.from('squadre').select('id,nome,logo,torneo_id').eq('torneo_id', torneoId);
      const logos = {};
      (squadreKV||[]).forEach(s => { logos[s.id] = { nome: s.nome, logo: s.logo||null }; });

      const payload = {
        ts: Date.now(),
        tornei,
        categorie_by_torneo: catsByTorneo,
        gwd_by_cat: gwdAll,
        ko_by_cat: koAll,
        logos
      };

      // Aggiorna cache locale
      window._staticData = payload;
      window._staticDataTs = Date.now();

      // Invia al Worker Cloudflare KV
      const res = await fetch(KV_WORKER_URL + '/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': KV_AUTH
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        console.log('[DB] KV aggiornato su Cloudflare ✓');
      } else {
        console.warn('[DB] KV upload fallito:', res.status);
      }
    } catch(e) {
      console.warn('[DB] _generaDataJson:', e);
    }
  }, 3000);
}

// ── BATCH LOADER ───────────────────────────────────────────
async function getGironiWithData(categoriaId) {
  const k=`gwd_${categoriaId}`; const cached=_cacheGet(k); if(cached)return cached;
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
