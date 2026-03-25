// ============================================================
//  DB.JS — Soccer Pro Experience + Rhodense
//  Filtro per cliente: ogni sito vede solo i propri tornei
// ============================================================

let db;
const CLIENTE = (typeof CONFIG !== 'undefined' && CONFIG.CLIENTE) ? CONFIG.CLIENTE : 'spe';

function initDB() {
  db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

function subscribeRealtime(cb) {
  db.channel('realtime-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'partite' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'marcatori' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'knockout' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tornei' }, cb)
    .subscribe();
}

// ===== TORNEI =====
async function dbGetTornei() {
  const { data, error } = await db.from('tornei').select('*').eq('cliente', CLIENTE).order('created_at', { ascending: false });
  if (error) { console.error('dbGetTornei:', error); return []; }
  return data || [];
}

async function dbSaveTorneo(t) {
  const { data, error } = await db.from('tornei').insert({ ...t, cliente: CLIENTE }).select('*').single();
  if (error) throw error;
  return data;
}

async function dbUpdateTorneo(id, fields) {
  const { error } = await db.from('tornei').update(fields).eq('id', id).eq('cliente', CLIENTE);
  if (error) throw error;
}

async function dbDeleteTorneo(id) {
  const { error } = await db.from('tornei').delete().eq('id', id).eq('cliente', CLIENTE);
  if (error) throw error;
}

// ===== CATEGORIE =====
async function dbGetCategorie(torneoId) {
  if (!torneoId) return [];
  const { data, error } = await db.from('categorie').select('*').eq('torneo_id', torneoId).order('ordine');
  if (error) { console.error('dbGetCategorie:', error); return []; }
  return data || [];
}

async function dbSaveCategoria(c) {
  const { data, error } = await db.from('categorie').insert(c).select('*').single();
  if (error) throw error;
  return data;
}

async function dbDeleteCategoria(id) {
  const { error } = await db.from('categorie').delete().eq('id', id);
  if (error) throw error;
}

async function dbUpdateCategoria(id, fields) {
  const { error } = await db.from('categorie').update(fields).eq('id', id);
  if (error) throw error;
}

// ===== SQUADRE =====
async function dbGetSquadre(torneoId) {
  if (!torneoId) return [];
  const { data, error } = await db.from('squadre').select('*').eq('torneo_id', torneoId).order('nome');
  if (error) { console.error('dbGetSquadre:', error); return []; }
  return data || [];
}

async function dbSaveSquadra(s) {
  const { data, error } = await db.from('squadre').insert(s).select('*').single();
  if (error) throw error;
  return data;
}

async function dbUpdateLogo(squadra_id, logo) {
  const { error } = await db.from('squadre').update({ logo }).eq('id', squadra_id);
  if (error) throw error;
}

// ===== GIRONI =====
async function dbGetGironi(categoriaId) {
  const { data, error } = await db.from('gironi').select('*').eq('categoria_id', categoriaId).order('nome');
  if (error) { console.error('dbGetGironi:', error); return []; }
  return data || [];
}

async function dbSaveGirone(g) {
  const { data, error } = await db.from('gironi').insert(g).select('*').single();
  if (error) throw error;
  return data;
}

// ===== GIRONE SQUADRE =====
async function dbGetGironeSquadre(gironeId) {
  const { data, error } = await db.from('girone_squadre')
    .select('*, squadre(*)')
    .eq('girone_id', gironeId)
    .order('posizione');
  if (error) { console.error('dbGetGironeSquadre:', error); return []; }
  return data || [];
}

async function dbSetGironeSquadre(gironeId, squadraIds) {
  await db.from('girone_squadre').delete().eq('girone_id', gironeId);
  for (let i = 0; i < squadraIds.length; i++) {
    await db.from('girone_squadre').insert({ girone_id: gironeId, squadra_id: squadraIds[i], posizione: i });
  }
}

// ===== PARTITE =====
async function dbGetPartite(gironeId) {
  const { data, error } = await db.from('partite')
    .select('*, home:squadre!home_id(*), away:squadre!away_id(*)')
    .eq('girone_id', gironeId)
    .order('orario');
  if (error) { console.error('dbGetPartite:', error); return []; }
  return data || [];
}

async function dbSavePartita(p) {
  const { data, error } = await db.from('partite').upsert({
    id: p.id, girone_id: p.girone_id,
    gol_home: p.gol_home, gol_away: p.gol_away, giocata: true,
    inserito_da: p.inserito_da || null
  }).select('*').single();
  if (error) { console.error('dbSavePartita:', error); return null; }
  return data;
}

async function dbGeneraPartite(gironeId, squadraIds) {
  for (let i = 0; i < squadraIds.length; i++) {
    for (let j = i + 1; j < squadraIds.length; j++) {
      await db.from('partite').insert({
        girone_id: gironeId, home_id: squadraIds[i], away_id: squadraIds[j], giocata: false
      });
    }
  }
}

// ===== MARCATORI =====
async function dbGetMarcatori(partitaId) {
  const { data, error } = await db.from('marcatori').select('*').eq('partita_id', partitaId);
  if (error) { console.error('dbGetMarcatori:', error); return []; }
  return data || [];
}

async function dbSaveMarcatori(partitaId, marcatori) {
  await db.from('marcatori').delete().eq('partita_id', partitaId);
  for (const m of marcatori) {
    if (!m.nome) continue;
    await db.from('marcatori').insert({ partita_id: partitaId, ...m });
  }
}

// ===== KNOCKOUT =====
async function dbGetKnockout(categoriaId) {
  const { data, error } = await db.from('knockout')
    .select('*')
    .eq('categoria_id', categoriaId)
    .order('round_order')
    .order('match_order');
  if (error) { console.error('dbGetKnockout:', error); return []; }
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
    orario: m.orario || null, campo: m.campo || null
  });
  if (error) throw error;
}
