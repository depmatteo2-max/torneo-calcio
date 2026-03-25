// ============================================================
//  DB.JS v4 — ULTRA FAST
//  Cache 60s + preload + invalidazione chirurgica
// ============================================================

let db;
const CLIENTE = (typeof CONFIG !== 'undefined' && CONFIG.CLIENTE) ? CONFIG.CLIENTE : 'spe';

// ── CACHE ──────────────────────────────────────────────────
const _cache = {};
const _CACHE_TTL = 60000; // 60 secondi

function _cacheGet(key) {
  const e = _cache[key];
  if (!e) return null;
  if (Date.now() - e.ts > _CACHE_TTL) { delete _cache[key]; return null; }
  return e.data;
}
function _cacheSet(key, data) { _cache[key] = { data, ts: Date.now() }; }
function _cacheInvalid(prefix) { Object.keys(_cache).forEach(k => { if (k.startsWith(prefix)) delete _cache[k]; }); }
function _cacheClear() { Object.keys(_cache).forEach(k => delete _cache[k]); }

// ── INIT ───────────────────────────────────────────────────
function initDB() {
  db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    realtime: { timeout: 10000 },
    global: { headers: { 'x-my-custom-header': 'spe' } }
  });
}

// Query con timeout automatico — se supera 8s restituisce []
async function _q(queryFn, fallback = []) {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 8000)
    );
    const result = await Promise.race([queryFn(), timeoutPromise]);
    return result;
  } catch(e) {
    console.warn('Query timeout/error:', e.message);
    return { data: fallback, error: e };
  }
}

function subscribeRealtime(cb) {
  // Realtime asincrono — non blocca il caricamento
  try {
    db.channel('rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partite' },
        () => { _cacheInvalid('partite_'); _cacheInvalid('gwd_'); cb(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'knockout' },
        () => { _cacheInvalid('ko_'); cb(); })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') console.warn('Realtime non disponibile');
      });
  } catch(e) { console.warn('Realtime error:', e); }
}

// ── TORNEI ─────────────────────────────────────────────────
async function dbGetTornei() {
  const key = `tornei_${CLIENTE}`;
  const c = _cacheGet(key); if (c) return c;
  const { data } = await db.from('tornei').select('*')
    .eq('cliente', CLIENTE).order('created_at', { ascending: false });
  _cacheSet(key, data || []);
  return data || [];
}
async function dbSaveTorneo(t) {
  const { data, error } = await db.from('tornei').insert({ ...t, cliente: CLIENTE }).select('*').single();
  if (error) throw error;
  _cacheInvalid('tornei_'); return data;
}
async function dbUpdateTorneo(id, fields) {
  const { error } = await db.from('tornei').update(fields).eq('id', id).eq('cliente', CLIENTE);
  if (error) throw error; _cacheInvalid('tornei_');
}
async function dbDeleteTorneo(id) {
  const { error } = await db.from('tornei').delete().eq('id', id).eq('cliente', CLIENTE);
  if (error) throw error; _cacheClear();
}

// ── CATEGORIE ──────────────────────────────────────────────
async function dbGetCategorie(torneoId) {
  if (!torneoId) return [];
  const key = `cat_${torneoId}`;
  const c = _cacheGet(key); if (c) return c;
  const { data } = await db.from('categorie').select('*').eq('torneo_id', torneoId).order('ordine');
  _cacheSet(key, data || []);
  return data || [];
}
async function dbSaveCategoria(c) {
  const { data, error } = await db.from('categorie').insert(c).select('*').single();
  if (error) throw error; _cacheInvalid('cat_'); return data;
}
async function dbDeleteCategoria(id) {
  const { error } = await db.from('categorie').delete().eq('id', id);
  if (error) throw error; _cacheClear();
}
async function dbUpdateCategoria(id, fields) {
  const { error } = await db.from('categorie').update(fields).eq('id', id);
  if (error) throw error; _cacheInvalid('cat_');
}

// ── SQUADRE ────────────────────────────────────────────────
async function dbGetSquadre(torneoId) {
  if (!torneoId) return [];
  const key = `sq_${torneoId}`;
  const c = _cacheGet(key); if (c) return c;
  const { data } = await db.from('squadre').select('id,nome,torneo_id').eq('torneo_id', torneoId).order('nome');
  _cacheSet(key, data || []); return data || [];
}
async function dbGetSquadreFull(torneoId) {
  if (!torneoId) return [];
  const key = `sqf_${torneoId}`;
  const c = _cacheGet(key); if (c) return c;
  const { data } = await db.from('squadre').select('id,nome,logo,torneo_id').eq('torneo_id', torneoId).order('nome');
  _cacheSet(key, data || []); return data || [];
}
async function dbSaveSquadra(s) {
  const { data, error } = await db.from('squadre').insert(s).select('*').single();
  if (error) throw error; _cacheInvalid('sq_'); return data;
}
async function dbUpdateLogo(squadra_id, logo) {
  const { error } = await db.from('squadre').update({ logo }).eq('id', squadra_id);
  if (error) throw error;
  _cacheInvalid('sq_'); _cacheInvalid('gwd_'); _cacheInvalid('gs_'); _cacheInvalid('partite_');
}

// ── GIRONI ─────────────────────────────────────────────────
async function dbGetGironi(categoriaId) {
  const key = `gir_${categoriaId}`;
  const c = _cacheGet(key); if (c) return c;
  const { data } = await db.from('gironi').select('*').eq('categoria_id', categoriaId).order('nome');
  _cacheSet(key, data || []); return data || [];
}
async function dbSaveGirone(g) {
  const { data, error } = await db.from('gironi').insert(g).select('*').single();
  if (error) throw error; _cacheInvalid('gir_'); return data;
}

// ── GIRONE SQUADRE ─────────────────────────────────────────
async function dbGetGironeSquadre(gironeId) {
  const key = `gs_${gironeId}`;
  const c = _cacheGet(key); if (c) return c;
  const { data } = await db.from('girone_squadre').select('*, squadre(id,nome)')
    .eq('girone_id', gironeId).order('posizione');
  _cacheSet(key, data || []); return data || [];
}
async function dbSetGironeSquadre(gironeId, ids) {
  await db.from('girone_squadre').delete().eq('girone_id', gironeId);
  const rows = ids.map((id, i) => ({ girone_id: gironeId, squadra_id: id, posizione: i }));
  if (rows.length) await db.from('girone_squadre').insert(rows);
  _cacheInvalid('gs_');
}

// ── PARTITE ────────────────────────────────────────────────
async function dbGetPartite(gironeId) {
  const key = `partite_${gironeId}`;
  const c = _cacheGet(key); if (c) return c;
  const { data } = await db.from('partite')
    .select('*, home:squadre!home_id(id,nome), away:squadre!away_id(id,nome)')
    .eq('girone_id', gironeId).order('orario');
  _cacheSet(key, data || []); return data || [];
}
async function dbSavePartita(p) {
  const { data, error } = await db.from('partite').upsert({
    id: p.id, girone_id: p.girone_id,
    gol_home: p.gol_home, gol_away: p.gol_away,
    giocata: true, inserito_da: p.inserito_da || null
  }).select('*').single();
  if (error) { console.error(error); return null; }
  _cacheInvalid('partite_'); _cacheInvalid('gwd_'); return data;
}
async function dbGeneraPartite(gironeId, ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i+1; j < ids.length; j++)
      rows.push({ girone_id: gironeId, home_id: ids[i], away_id: ids[j], giocata: false });
  if (rows.length) await db.from('partite').insert(rows);
  _cacheInvalid('partite_');
}

// ── MARCATORI ──────────────────────────────────────────────
async function dbGetMarcatori(partitaId) {
  const key = `marc_${partitaId}`;
  const c = _cacheGet(key); if (c) return c;
  const { data } = await db.from('marcatori').select('*').eq('partita_id', partitaId);
  _cacheSet(key, data || []); return data || [];
}
async function dbSaveMarcatori(partitaId, marcatori) {
  await db.from('marcatori').delete().eq('partita_id', partitaId);
  const rows = marcatori.filter(m => m.nome).map(m => ({ partita_id: partitaId, ...m }));
  if (rows.length) await db.from('marcatori').insert(rows);
  _cacheInvalid('marc_'); _cacheInvalid('gwd_');
}

// ── KNOCKOUT ───────────────────────────────────────────────
async function dbGetKnockout(categoriaId) {
  const key = `ko_${categoriaId}`;
  const c = _cacheGet(key); if (c) return c;
  const { data } = await db.from('knockout').select('*')
    .eq('categoria_id', categoriaId).order('round_order').order('match_order');
  _cacheSet(key, data || []); return data || [];
}
async function dbSaveKnockoutMatch(m) {
  const { error } = await db.from('knockout').upsert({
    id: m.id, categoria_id: m.categoria_id,
    round_name: m.round_name, round_order: m.round_order, match_order: m.match_order,
    home_id: m.home_id, away_id: m.away_id, gol_home: m.gol_home, gol_away: m.gol_away,
    giocata: m.giocata, is_consolazione: m.is_consolazione,
    note_home: m.note_home, note_away: m.note_away,
    orario: m.orario||null, campo: m.campo||null, inserito_da: m.inserito_da||null
  });
  if (error) throw error; _cacheInvalid('ko_');
}

// ── MEGA BATCH LOADER ──────────────────────────────────────
// UNA SOLA chiamata per caricare tutto: gironi + squadre + partite + marcatori
async function getGironiWithData(categoriaId) {
  const key = `gwd_${categoriaId}`;
  const cached = _cacheGet(key); if (cached) return cached;

  // Tutto in parallelo con timeout
  const [r1, r2] = await Promise.all([
    db.from('gironi').select('*').eq('categoria_id', categoriaId).order('nome'),
    db.from('partite')
      .select('id,girone_id,home_id,away_id,gol_home,gol_away,giocata,orario,campo,giorno,giornata,inserito_da,home:squadre!home_id(id,nome),away:squadre!away_id(id,nome)')
      .eq('girone_id.categoria_id', categoriaId) // filtro diretto
      .order('orario')
  ]);

  // Se il join non funziona, fallback a query separate
  const gironi = r1.data || [];
  if (!gironi.length) return [];
  const gironeIds = gironi.map(g => g.id);

  const [r2b, r3] = await Promise.all([
    r2.data ? Promise.resolve(r2) :
      db.from('partite')
        .select('id,girone_id,home_id,away_id,gol_home,gol_away,giocata,orario,campo,giorno,giornata,inserito_da,home:squadre!home_id(id,nome),away:squadre!away_id(id,nome)')
        .in('girone_id', gironeIds).order('orario'),
    db.from('girone_squadre')
      .select('girone_id,squadra_id,squadre(id,nome)')
      .in('girone_id', gironeIds).order('posizione')
  ]);

  const tuttePartite = r2b.data || [];
  const tutteGs = r3.data || [];

  // Marcatori solo per giocate
  let marcatori = [];
  const giocateIds = tuttePartite.filter(p => p.giocata).map(p => p.id);
  if (giocateIds.length) {
    const { data: m } = await db.from('marcatori')
      .select('partita_id,squadra_id,nome,minuto')
      .in('partita_id', giocateIds);
    marcatori = m || [];
  }

  const result = gironi.map(g => ({
    ...g,
    squadre: tutteGs.filter(x => x.girone_id === g.id).map(x => x.squadre),
    partite: tuttePartite.filter(p => p.girone_id === g.id)
      .map(p => ({ ...p, marcatori: marcatori.filter(m => m.partita_id === p.id) }))
  }));

  _cacheSet(key, result);
  return result;
}

// ── PRELOAD categoria al cambio ─────────────────────────────
// Chiama questa quando l'utente seleziona una categoria
// così quando arriva alla pagina i dati sono già pronti
async function preloadCategoria(categoriaId) {
  if (!categoriaId) return;
  // Avvia in background senza aspettare
  getGironiWithData(categoriaId).catch(() => {});
  dbGetKnockout(categoriaId).catch(() => {});
}
