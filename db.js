// ============================================================
//  DATABASE LAYER - Multi-torneo OTTIMIZZATO
// ============================================================

let db = null;

// Cache semplice per ridurre le chiamate ripetute
const _cache = {};
function cacheGet(key) { return _cache[key]; }
function cacheSet(key, val, ttl=5000) { _cache[key]=val; setTimeout(()=>delete _cache[key], ttl); }
function cacheClear(prefix) { Object.keys(_cache).forEach(k=>{ if(k.startsWith(prefix)) delete _cache[k]; }); }

function initDB() {
  db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

// ---- TORNEI ----
async function dbGetTornei() {
  const { data } = await db.from('tornei').select('*').order('created_at', { ascending: false });
  return data || [];
}
async function dbSaveTorneo(obj) {
  const { data } = await db.from('tornei').insert(obj).select().single();
  return data;
}
async function dbUpdateTorneo(id, obj) { await db.from('tornei').update(obj).eq('id', id); }
async function dbDeleteTorneo(id) { await db.from('tornei').delete().eq('id', id); }

// ---- CATEGORIE ----
async function dbGetCategorie(torneo_id) {
  const { data } = await db.from('categorie').select('*').eq('torneo_id', torneo_id).order('ordine');
  return data || [];
}
async function dbSaveCategoria(cat) {
  const { data } = await db.from('categorie').upsert(cat).select().single();
  return data;
}
async function dbDeleteCategoria(id) { await db.from('categorie').delete().eq('id', id); }

// ---- GIRONI ----
async function dbGetGironi(categoria_id) {
  const { data } = await db.from('gironi').select('*').eq('categoria_id', categoria_id).order('nome');
  return data || [];
}
async function dbSaveGirone(g) {
  const { data } = await db.from('gironi').upsert(g).select().single();
  return data;
}

// ---- SQUADRE ----
async function dbGetSquadre(torneo_id) {
  const ckey = 'sq_' + torneo_id;
  if (cacheGet(ckey)) return cacheGet(ckey);
  const { data } = await db.from('squadre').select('*').eq('torneo_id', torneo_id).order('nome');
  const result = data || [];
  cacheSet(ckey, result, 10000);
  return result;
}
async function dbSaveSquadra(s) {
  cacheClear('sq_');
  const { data } = await db.from('squadre').insert(s).select().single();
  return data;
}

// ---- GIRONE-SQUADRE ----
async function dbGetGironeSquadre(girone_id) {
  const { data } = await db.from('girone_squadre').select('*, squadre(*)').eq('girone_id', girone_id).order('posizione');
  return data || [];
}
async function dbSetGironeSquadre(girone_id, squadra_ids) {
  await db.from('girone_squadre').delete().eq('girone_id', girone_id);
  if (!squadra_ids.length) return;
  const rows = squadra_ids.map((sid, i) => ({ girone_id, squadra_id: sid, posizione: i }));
  await db.from('girone_squadre').insert(rows);
}

// ---- PARTITE ----
async function dbGetPartite(girone_id) {
  const { data } = await db.from('partite')
    .select('*, home:squadre!home_id(*), away:squadre!away_id(*)')
    .eq('girone_id', girone_id)
    .order('id', { ascending: true });
  return data || [];
}
async function dbSavePartita(p) {
  const { data, error } = await db.from('partite')
    .update({ girone_id: p.girone_id, gol_home: p.gol_home, gol_away: p.gol_away, giocata: p.giocata })
    .eq('id', p.id).select().single();
  if (error) { console.error('dbSavePartita:', error); throw error; }
  return data;
}
async function dbGeneraPartite(girone_id, squadra_ids) {
  await db.from('partite').delete().eq('girone_id', girone_id);
  const matches = [];
  for (let i = 0; i < squadra_ids.length; i++)
    for (let j = i + 1; j < squadra_ids.length; j++)
      matches.push({ girone_id, home_id: squadra_ids[i], away_id: squadra_ids[j], giocata: false });
  if (matches.length) await db.from('partite').insert(matches);
}

// ---- MARCATORI ----
async function dbGetMarcatori(partita_id) {
  const { data } = await db.from('marcatori').select('*').eq('partita_id', partita_id).order('minuto');
  return data || [];
}
async function dbSaveMarcatori(partita_id, marcatori) {
  await db.from('marcatori').delete().eq('partita_id', partita_id);
  if (!marcatori.length) return;
  await db.from('marcatori').insert(marcatori.map(m => ({
    partita_id, squadra_id: m.squadra_id, nome: m.nome, minuto: m.minuto || null
  })));
}

// ---- KNOCKOUT ----
async function dbGetKnockout(categoria_id) {
  const { data } = await db.from('knockout').select('*').eq('categoria_id', categoria_id)
    .order('round_order').order('match_order');
  return data || [];
}
async function dbSaveKnockoutMatch(m) {
  const { data, error } = await db.from('knockout').upsert(m).select().single();
  if (error) { console.error('dbSaveKnockoutMatch:', error); throw error; }
  return data;
}
async function dbDeleteKnockout(categoria_id) {
  await db.from('knockout').delete().eq('categoria_id', categoria_id);
}

// ---- LOGHI ----
async function dbUpdateLogo(squadra_id, logo_base64) {
  cacheClear('sq_');
  await db.from('squadre').update({ logo: logo_base64 }).eq('id', squadra_id);
}

// ---- REALTIME ----
function subscribeRealtime(callback) {
  db.channel('torneo-updates')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => {
      cacheClear('sq_');
      callback();
    })
    .subscribe();
}

// ---- OTTIMIZZAZIONE CHIAVE: carica tutto un girone in 3 query invece di N*3 ----
async function getGironiWithData(categoria_id) {
  const gironi = await dbGetGironi(categoria_id);
  if (!gironi.length) return [];

  const gironiIds = gironi.map(g => g.id);

  // 3 query parallele invece di N query sequenziali
  const [gsRes, partiteRes] = await Promise.all([
    db.from('girone_squadre').select('*, squadre(*)').in('girone_id', gironiIds).order('posizione'),
    db.from('partite').select('*, home:squadre!home_id(*), away:squadre!away_id(*)').in('girone_id', gironiIds).order('id', { ascending: true })
  ]);

  const partiteData = partiteRes.data || [];
  const partiteIds = partiteData.map(p => p.id);

  // Carica marcatori solo se ci sono partite giocate
  let marcatoriMap = {};
  const giocateIds = partiteData.filter(p => p.giocata).map(p => p.id);
  if (giocateIds.length) {
    const { data: marcData } = await db.from('marcatori').select('*').in('partita_id', giocateIds).order('minuto');
    for (const m of (marcData || [])) {
      if (!marcatoriMap[m.partita_id]) marcatoriMap[m.partita_id] = [];
      marcatoriMap[m.partita_id].push(m);
    }
  }

  // Assembla tutto in memoria
  const gsByGirone = {};
  for (const gs of (gsRes.data || [])) {
    if (!gsByGirone[gs.girone_id]) gsByGirone[gs.girone_id] = [];
    gsByGirone[gs.girone_id].push(gs);
  }
  const pByGirone = {};
  for (const p of partiteData) {
    if (!pByGirone[p.girone_id]) pByGirone[p.girone_id] = [];
    p.marcatori = marcatoriMap[p.id] || [];
    pByGirone[p.girone_id].push(p);
  }

  return gironi.map(g => ({
    ...g,
    squadre: (gsByGirone[g.id] || []).map(gs => gs.squadre),
    partite: pByGirone[g.id] || []
  }));
}
