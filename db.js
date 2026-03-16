let db = null;

function initDB() {
  db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

async function safeSingle(q) {
  const { data, error } = await q.single();
  if (error) throw error;
  return data;
}

async function dbGetTorneo() {
  const { data, error } = await db.from('torneo').select('*').eq('id', 1).single();
  if (error) throw error;
  return data;
}
async function dbSaveTorneo(obj) {
  const { error } = await db.from('torneo').upsert({ id: 1, ...obj });
  if (error) throw error;
}

async function dbGetCategorie() {
  const { data, error } = await db.from('categorie').select('*').order('ordine', { ascending: true }).order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}
async function dbSaveCategoria(cat) {
  return safeSingle(db.from('categorie').upsert(cat).select());
}
async function dbDeleteCategoria(id) {
  const { error } = await db.from('categorie').delete().eq('id', id);
  if (error) throw error;
}

async function dbGetGironi(categoria_id) {
  const { data, error } = await db.from('gironi').select('*').eq('categoria_id', categoria_id).order('nome', { ascending: true });
  if (error) throw error;
  return data || [];
}
async function dbFindGirone(categoria_id, nome) {
  const { data, error } = await db.from('gironi').select('*').eq('categoria_id', categoria_id).eq('nome', nome).maybeSingle();
  if (error) throw error;
  return data;
}
async function dbSaveGirone(g) {
  return safeSingle(db.from('gironi').upsert(g).select());
}

async function dbGetSquadre() {
  const { data, error } = await db.from('squadre').select('*').order('nome', { ascending: true });
  if (error) throw error;
  return data || [];
}
async function dbFindSquadra(nome) {
  const { data, error } = await db.from('squadre').select('*').eq('nome', nome).maybeSingle();
  if (error) throw error;
  return data;
}
async function dbSaveSquadra(s) {
  return safeSingle(db.from('squadre').upsert(s).select());
}
async function dbUpdateLogo(squadra_id, logo_base64) {
  const { error } = await db.from('squadre').update({ logo: logo_base64 }).eq('id', squadra_id);
  if (error) throw error;
}

async function dbGetGironeSquadre(girone_id) {
  const { data, error } = await db.from('girone_squadre').select('*, squadre(*)').eq('girone_id', girone_id).order('posizione', { ascending: true });
  if (error) throw error;
  return data || [];
}
async function dbSetGironeSquadre(girone_id, squadra_ids) {
  let { error } = await db.from('girone_squadre').delete().eq('girone_id', girone_id);
  if (error) throw error;
  if (!squadra_ids.length) return;
  const rows = squadra_ids.map((sid, i) => ({ girone_id, squadra_id: sid, posizione: i }));
  ({ error } = await db.from('girone_squadre').insert(rows));
  if (error) throw error;
}

async function dbGetPartite(girone_id) {
  const { data, error } = await db.from('partite')
    .select('*, home:squadre!home_id(*), away:squadre!away_id(*)')
    .eq('girone_id', girone_id)
    .order('giornata', { ascending: true })
    .order('orario', { ascending: true })
    .order('ordine', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function dbSavePartita(p) {
  if (p.id) {
    const { data, error } = await db.from('partite').update({
      girone_id: p.girone_id,
      home_id: p.home_id,
      away_id: p.away_id,
      gol_home: p.gol_home,
      gol_away: p.gol_away,
      giocata: p.giocata,
      fase: p.fase,
      giornata: p.giornata,
      orario: p.orario,
      campo: p.campo,
      ordine: p.ordine,
      manuale: p.manuale ?? false,
    }).eq('id', p.id).select().single();
    if (error) throw error;
    return data;
  }
  return safeSingle(db.from('partite').insert({
    girone_id: p.girone_id,
    home_id: p.home_id,
    away_id: p.away_id,
    gol_home: p.gol_home ?? 0,
    gol_away: p.gol_away ?? 0,
    giocata: p.giocata ?? false,
    fase: p.fase || 'Fase 1',
    giornata: p.giornata || 1,
    orario: p.orario || '',
    campo: p.campo || '',
    ordine: p.ordine || 0,
    manuale: p.manuale ?? true,
  }).select());
}

async function dbDeletePartiteByGirone(girone_id) {
  const { error } = await db.from('partite').delete().eq('girone_id', girone_id);
  if (error) throw error;
}

async function dbGetMarcatori(partita_id) {
  const { data, error } = await db.from('marcatori').select('*, squadre(*)').eq('partita_id', partita_id).order('minuto', { ascending: true });
  if (error) throw error;
  return data || [];
}
async function dbSaveMarcatori(partita_id, marcatori) {
  let { error } = await db.from('marcatori').delete().eq('partita_id', partita_id);
  if (error) throw error;
  if (!marcatori.length) return;
  const rows = marcatori.map(m => ({ partita_id, squadra_id: m.squadra_id, nome: m.nome, minuto: m.minuto || null }));
  ({ error } = await db.from('marcatori').insert(rows));
  if (error) throw error;
}

function subscribeRealtime(callback) {
  db.channel('torneo-import-excel')
    .on('postgres_changes', { event: '*', schema: 'public' }, callback)
    .subscribe();
}


async function dbDeletePartita(id) {
  const { error } = await db.from('partite').delete().eq('id', id);
  if (error) throw error;
}
