// ============================================================
//  DATABASE LAYER - Multi-torneo
// ============================================================

let db = null;

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
async function dbUpdateTorneo(id, obj) {
  await db.from('tornei').update(obj).eq('id', id);
}
async function dbDeleteTorneo(id) {
  await db.from('tornei').delete().eq('id', id);
}

// ---- CATEGORIE ----
async function dbGetCategorie(torneo_id) {
  const { data } = await db.from('categorie').select('*').eq('torneo_id', torneo_id).order('ordine');
  return data || [];
}
async function dbSaveCategoria(cat) {
  const { data } = await db.from('categorie').upsert(cat).select().single();
  return data;
}
async function dbDeleteCategoria(id) {
  await db.from('categorie').delete().eq('id', id);
}

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
  const { data } = await db.from('squadre').select('*').eq('torneo_id', torneo_id).order('nome');
  return data || [];
}
async function dbSaveSquadra(s) {
  const { data } = await db.from('squadre').upsert(s).select().single();
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
  const { data } = await db.from('partite').select('*, home:squadre!home_id(*), away:squadre!away_id(*)').eq('girone_id', girone_id).order('created_at');
  return data || [];
}
async function dbSavePartita(p) {
  const { data, error } = await db.from('partite').update({ girone_id: p.girone_id, gol_home: p.gol_home, gol_away: p.gol_away, giocata: p.giocata }).eq('id', p.id).select().single();
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
  const { data } = await db.from('marcatori').select('*, squadre(*)').eq('partita_id', partita_id).order('minuto');
  return data || [];
}
async function dbSaveMarcatori(partita_id, marcatori) {
  await db.from('marcatori').delete().eq('partita_id', partita_id);
  if (!marcatori.length) return;
  await db.from('marcatori').insert(marcatori.map(m => ({ partita_id, squadra_id: m.squadra_id, nome: m.nome, minuto: m.minuto || null })));
}

// ---- KNOCKOUT ----
async function dbGetKnockout(categoria_id) {
  const { data } = await db.from('knockout').select('*').eq('categoria_id', categoria_id).order('round_order').order('match_order');
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
  await db.from('squadre').update({ logo: logo_base64 }).eq('id', squadra_id);
}

// ---- REALTIME ----
function subscribeRealtime(callback) {
  db.channel('torneo-updates')
    .on('postgres_changes', { event: '*', schema: 'public' }, callback)
    .subscribe();
}
