// ============================================================
//  DATABASE LAYER - Multi-torneo / classifica unica avanzata
// ============================================================

let db = null;
function initDB() {
  db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

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

async function dbGetCategorie(torneo_id) {
  const { data } = await db.from('categorie').select('*').eq('torneo_id', torneo_id).order('ordine');
  return data || [];
}
async function dbSaveCategoria(cat) {
  const { data, error } = await db.from('categorie').upsert(cat).select().single();
  if (error) throw error;
  return data;
}
async function dbDeleteCategoria(id) { await db.from('categorie').delete().eq('id', id); }

async function dbGetGironi(categoria_id) {
  const { data } = await db.from('gironi').select('*').eq('categoria_id', categoria_id).order('nome');
  return data || [];
}
async function dbSaveGirone(g) {
  const { data, error } = await db.from('gironi').upsert(g).select().single();
  if (error) throw error;
  return data;
}

async function dbGetSquadre(torneo_id) {
  const { data } = await db.from('squadre').select('*').eq('torneo_id', torneo_id).order('nome');
  return data || [];
}
async function dbSaveSquadra(s) {
  const { data, error } = await db.from('squadre').upsert(s).select().single();
  if (error) throw error;
  return data;
}
async function dbUpdateSquadra(id, obj) { await db.from('squadre').update(obj).eq('id', id); }

async function dbGetGironeSquadre(girone_id) {
  const { data } = await db.from('girone_squadre').select('*, squadre(*)').eq('girone_id', girone_id).order('posizione');
  return data || [];
}
async function dbSetGironeSquadre(girone_id, squadra_ids) {
  await db.from('girone_squadre').delete().eq('girone_id', girone_id);
  if (!squadra_ids.length) return;
  const rows = squadra_ids.map((sid, i) => ({ girone_id, squadra_id: sid, posizione: i }));
  const { error } = await db.from('girone_squadre').insert(rows);
  if (error) throw error;
}

async function dbGetPartite(girone_id) {
  const { data } = await db.from('partite')
    .select('*, home:squadre!home_id(*), away:squadre!away_id(*)')
    .eq('girone_id', girone_id)
    .order('giornata', { ascending: true })
    .order('ordine', { ascending: true })
    .order('created_at', { ascending: true });
  return data || [];
}
async function dbSavePartita(p) {
  const { id, ...rest } = p;
  const { data, error } = await db.from('partite').update(rest).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
async function dbCreatePartita(p) {
  const { data, error } = await db.from('partite').insert(p).select().single();
  if (error) throw error;
  return data;
}
async function dbDeletePartita(id) {
  const { error } = await db.from('partite').delete().eq('id', id);
  if (error) throw error;
}
async function dbReplaceSchedule(girone_id, scheduleRows) {
  await db.from('partite').delete().eq('girone_id', girone_id);
  if (!scheduleRows.length) return;
  const rows = scheduleRows.map(r => ({ ...r, girone_id, giocata: false, manuale: !!r.manuale }));
  const { error } = await db.from('partite').insert(rows);
  if (error) throw error;
}

async function dbGetMarcatori(partita_id) {
  const { data } = await db.from('marcatori').select('*, squadre(*)').eq('partita_id', partita_id).order('minuto');
  return data || [];
}
async function dbSaveMarcatori(partita_id, marcatori) {
  await db.from('marcatori').delete().eq('partita_id', partita_id);
  if (!marcatori.length) return;
  const rows = marcatori.map(m => ({ partita_id, squadra_id: m.squadra_id, nome: m.nome, minuto: m.minuto || null }));
  const { error } = await db.from('marcatori').insert(rows);
  if (error) throw error;
}

async function dbUpdateLogo(squadra_id, logo_base64) { await db.from('squadre').update({ logo: logo_base64 }).eq('id', squadra_id); }
function subscribeRealtime(callback) {
  db.channel('torneo-updates').on('postgres_changes', { event: '*', schema: 'public' }, callback).subscribe();
}
