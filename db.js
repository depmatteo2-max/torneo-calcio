// ============================================================
//  DB.JS — Soccer Pro Experience + Rhodense
//  v3: Cache lunga + query ottimizzate + loghi lazy
// ============================================================

let db;
const CLIENTE = (typeof CONFIG !== 'undefined' && CONFIG.CLIENTE) ? CONFIG.CLIENTE : 'spe';

// ── CACHE ──────────────────────────────────────────────────
const _cache = {};
const _CACHE_TTL = 30000; // 30 secondi (era 8)

function _cacheGet(key) {
  const e = _cache[key];
  if (!e) return null;
  if (Date.now() - e.ts > _CACHE_TTL) { delete _cache[key]; return null; }
  return e.data;
}
function _cacheSet(key, data) { _cache[key] = { data, ts: Date.now() }; }
function _cacheInvalid(prefix) {
  Object.keys(_cache).forEach(k => { if (k.startsWith(prefix)) delete _cache[k]; });
}
function _cacheClear() { Object.keys(_cache).forEach(k => delete _cache[k]); }

// ── INIT ───────────────────────────────────────────────────
function initDB() {
  db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

function subscribeRealtime(cb) {
  db.channel('realtime-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'partite' },  () => { _cacheInvalid('partite_'); _cacheInvalid('gironi_data_'); cb(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'marcatori' },() => { _cacheInvalid('marc_');    _cacheInvalid('gironi_data_'); cb(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'knockout' }, () => { _cacheInvalid('ko_');      cb(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tornei' },   () => { _cacheInvalid('tornei_'); cb(); })
    .subscribe();
}

// ── TORNEI ─────────────────────────────────────────────────
async function dbGetTornei() {
  const key = `tornei_${CLIENTE}`;
  const cached = _cacheGet(key); if (cached) return cached;
  const { data, error } = await db.from('tornei').select('*')
    .eq('cliente', CLIENTE).order('created_at', { ascending: false });
  if (error) { console.error('dbGetTornei:', error); return []; }
  _cacheSet(key, data || []);
  return data || [];
}

async function dbSaveTorneo(t) {
  const { data, error } = await db.from('tornei').insert({ ...t, cliente: CLIENTE }).select('*').single();
  if (error) throw error;
  _cacheInvalid('tornei_');
  return data;
}

async function dbUpdateTorneo(id, fields) {
  const { error } = await db.from('tornei').update(fields).eq('id', id).eq('cliente', CLIENTE);
  if (error) throw error;
  _cacheInvalid('tornei_');
}

async function dbDeleteTorneo(id) {
  const { error } = await db.from('tornei').delete().eq('id', id).eq('cliente', CLIENTE);
  if (error) throw error;
  _cacheClear();
}

// ── CATEGORIE ──────────────────────────────────────────────
async function dbGetCategorie(torneoId) {
  if (!torneoId) return [];
  const key = `cat_${torneoId}`;
  const cached = _cacheGet(key); if (cached) return cached;
  const { data, error } = await db.from('categorie').select('*')
    .eq('torneo_id', torneoId).order('ordine');
  if (error) { console.error('dbGetCategorie:', error); return []; }
  _cacheSet(key, data || []);
  return data || [];
}

async function dbSaveCategoria(c) {
  const { data, error } = await db.from('categorie').insert(c).select('*').single();
  if (error) throw error;
  _cacheInvalid('cat_');
  return data;
}

async function dbDeleteCategoria(id) {
  const { error } = await db.from('categorie').delete().eq('id', id);
  if (error) throw error;
  _cacheClear();
}

async function dbUpdateCategoria(id, fields) {
  const { error } = await db.from('categorie').update(fields).eq('id', id);
  if (error) throw error;
  _cacheInvalid('cat_');
}

// ── SQUADRE — senza logo per default (più veloce) ─────────
async function dbGetSquadre(torneoId) {
  if (!torneoId) return [];
  const key = `squadre_${torneoId}`;
  const cached = _cacheGet(key); if (cached) return cached;
  // NON caricare il logo qui — viene caricato solo dove serve
  const { data, error } = await db.from('squadre')
    .select('id,nome,torneo_id')
    .eq('torneo_id', torneoId).order('nome');
  if (error) { console.error('dbGetSquadre:', error); return []; }
  _cacheSet(key, data || []);
  return data || [];
}

async function dbGetSquadreFull(torneoId) {
  // Versione con logo — solo per admin loghi
  if (!torneoId) return [];
  const key = `squadre_full_${torneoId}`;
  const cached = _cacheGet(key); if (cached) return cached;
  const { data, error } = await db.from('squadre')
    .select('id,nome,logo,torneo_id')
    .eq('torneo_id', torneoId).order('nome');
  if (error) { console.error('dbGetSquadreFull:', error); return []; }
  _cacheSet(key, data || []);
  return data || [];
}

async function dbSaveSquadra(s) {
  const { data, error } = await db.from('squadre').insert(s).select('*').single();
  if (error) throw error;
  _cacheInvalid('squadre_');
  return data;
}

async function dbUpdateLogo(squadra_id, logo) {
  const { error } = await db.from('squadre').update({ logo }).eq('id', squadra_id);
  if (error) throw error;
  _cacheInvalid('squadre_');
  _cacheInvalid('gironi_data_'); // invalida solo i dati gironi, non tutto
  _cacheInvalid('gs_');
  _cacheInvalid('partite_');
}

// ── GIRONI ─────────────────────────────────────────────────
async function dbGetGironi(categoriaId) {
  const key = `gironi_${categoriaId}`;
  const cached = _cacheGet(key); if (cached) return cached;
  const { data, error } = await db.from('gironi').select('*')
    .eq('categoria_id', categoriaId).order('nome');
  if (error) { console.error('dbGetGironi:', error); return []; }
  _cacheSet(key, data || []);
  return data || [];
}

async function dbSaveGirone(g) {
  const { data, error } = await db.from('gironi').insert(g).select('*').single();
  if (error) throw error;
  _cacheInvalid('gironi_');
  return data;
}

// ── GIRONE SQUADRE — senza logo per velocità ───────────────
async function dbGetGironeSquadre(gironeId) {
  const key = `gs_${gironeId}`;
  const cached = _cacheGet(key); if (cached) return cached;
  // Seleziona senza logo per velocità
  const { data, error } = await db.from('girone_squadre')
    .select('*, squadre(id,nome)')
    .eq('girone_id', gironeId).order('posizione');
  if (error) { console.error('dbGetGironeSquadre:', error); return []; }
  _cacheSet(key, data || []);
  return data || [];
}

async function dbSetGironeSquadre(gironeId, squadraIds) {
  await db.from('girone_squadre').delete().eq('girone_id', gironeId);
  const rows = squadraIds.map((id, i) => ({ girone_id: gironeId, squadra_id: id, posizione: i }));
  if (rows.length) await db.from('girone_squadre').insert(rows);
  _cacheInvalid('gs_');
}

// ── PARTITE — senza logo nelle squadre join ────────────────
async function dbGetPartite(gironeId) {
  const key = `partite_${gironeId}`;
  const cached = _cacheGet(key); if (cached) return cached;
  const { data, error } = await db.from('partite')
    .select('*, home:squadre!home_id(id,nome), away:squadre!away_id(id,nome)')
    .eq('girone_id', gironeId).order('orario');
  if (error) { console.error('dbGetPartite:', error); return []; }
  _cacheSet(key, data || []);
  return data || [];
}

async function dbSavePartita(p) {
  const { data, error } = await db.from('partite').upsert({
    id: p.id, girone_id: p.girone_id,
    gol_home: p.gol_home, gol_away: p.gol_away, giocata: true,
    inserito_da: p.inserito_da || null
  }).select('*').single();
  if (error) { console.error('dbSavePartita:', error); return null; }
  _cacheInvalid('partite_');
  _cacheInvalid('gironi_data_');
  return data;
}

async function dbGeneraPartite(gironeId, squadraIds) {
  const partite = [];
  for (let i = 0; i < squadraIds.length; i++)
    for (let j = i + 1; j < squadraIds.length; j++)
      partite.push({ girone_id: gironeId, home_id: squadraIds[i], away_id: squadraIds[j], giocata: false });
  if (partite.length) {
    const { error } = await db.from('partite').insert(partite);
    if (error) console.error('dbGeneraPartite:', error);
  }
  _cacheInvalid('partite_');
}

// ── MARCATORI ──────────────────────────────────────────────
async function dbGetMarcatori(partitaId) {
  const key = `marc_${partitaId}`;
  const cached = _cacheGet(key); if (cached) return cached;
  const { data, error } = await db.from('marcatori').select('*').eq('partita_id', partitaId);
  if (error) { console.error('dbGetMarcatori:', error); return []; }
  _cacheSet(key, data || []);
  return data || [];
}

async function dbSaveMarcatori(partitaId, marcatori) {
  await db.from('marcatori').delete().eq('partita_id', partitaId);
  if (marcatori.length) {
    const rows = marcatori.filter(m => m.nome).map(m => ({ partita_id: partitaId, ...m }));
    if (rows.length) await db.from('marcatori').insert(rows);
  }
  _cacheInvalid('marc_');
}

// ── KNOCKOUT ───────────────────────────────────────────────
async function dbGetKnockout(categoriaId) {
  const key = `ko_${categoriaId}`;
  const cached = _cacheGet(key); if (cached) return cached;
  const { data, error } = await db.from('knockout')
    .select('*').eq('categoria_id', categoriaId)
    .order('round_order').order('match_order');
  if (error) { console.error('dbGetKnockout:', error); return []; }
  _cacheSet(key, data || []);
  return data || [];
}

async function dbSaveKnockoutMatch(m) {
  const { error } = await db.from('knockout').upsert({
    id: m.id, categoria_id: m.categoria_id,
    round_name: m.round_name, round_order: m.round_order, match_order: m.match_order,
    home_id: m.home_id, away_id: m.away_id,
    gol_home: m.gol_home, gol_away: m.gol_away,
    giocata: m.giocata, is_consolazione: m.is_consolazione,
    note_home: m.note_home, note_away: m.note_away,
    orario: m.orario || null, campo: m.campo || null,
    inserito_da: m.inserito_da || null
  });
  if (error) throw error;
  _cacheInvalid('ko_');
}

// ── BATCH LOADER — 3 query invece di N*3 ──────────────────
async function getGironiWithData(categoriaId) {
  const key = `gironi_data_${categoriaId}`;
  const cached = _cacheGet(key); if (cached) return cached;

  const gironi = await dbGetGironi(categoriaId);
  if (!gironi.length) return [];

  const gironeIds = gironi.map(g => g.id);

  // Tutto in parallelo — senza logo nelle join (molto più veloce)
  const [partiteRes, gsRes] = await Promise.all([
    db.from('partite')
      .select('*, home:squadre!home_id(id,nome), away:squadre!away_id(id,nome)')
      .in('girone_id', gironeIds)
      .order('orario'),
    db.from('girone_squadre')
      .select('*, squadre(id,nome)')
      .in('girone_id', gironeIds)
      .order('posizione'),
  ]);

  const tutte_partite = partiteRes.data || [];
  const tutte_gs = gsRes.data || [];

  // Marcatori solo per partite giocate
  const giocateIds = tutte_partite.filter(p => p.giocata).map(p => p.id);
  let tuttiMarcatori = [];
  if (giocateIds.length) {
    const { data: marc } = await db.from('marcatori')
      .select('*').in('partita_id', giocateIds);
    tuttiMarcatori = marc || [];
  }

  const result = gironi.map(g => ({
    ...g,
    squadre: tutte_gs.filter(gs => gs.girone_id === g.id).map(m => m.squadre),
    partite: tutte_partite
      .filter(p => p.girone_id === g.id)
      .map(p => ({ ...p, marcatori: tuttiMarcatori.filter(m => m.partita_id === p.id) }))
  }));

  _cacheSet(key, result);
  return result;
}
