// ============================================================
//  DATABASE LAYER - Supabase
// ============================================================

let db = null;

function initDB() {
  db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

// ---- TORNEO CONFIG ----
async function dbGetTorneo() {
  const { data } = await db.from('torneo').select('*').eq('id', 1).single();
  return data;
}
async function dbSaveTorneo(obj) {
  await db.from('torneo').upsert({ id: 1, ...obj });
}

// ---- CATEGORIE ----
async function dbGetCategorie() {
  const { data } = await db.from('categorie').select('*').order('ordine');
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
async function dbGetSquadre() {
  const { data } = await db.from('squadre').select('*').order('nome');
  return data || [];
}
async function dbSaveSquadra(s) {
  const { data } = await db.from('squadre').upsert(s).select().single();
  return data;
}

// ---- GIRONE-SQUADRE (membership) ----
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
  const { data } = await db.from('partite').select('*, home:squadre!home_id(*), away:squadre!away_id(*)').eq('girone_id', girone_id).order('giornata', {ascending:true}).order('ordine', {ascending:true}).order('orario', {ascending:true}).order('created_at', {ascending:true});
  return data || [];
}
async function dbGetAllPartite(categoria_id) {
  const { data } = await db.from('partite')
    .select('*, home:squadre!home_id(*), away:squadre!away_id(*), gironi(*)')
    .eq('gironi.categoria_id', categoria_id);
  return data || [];
}
async function dbSavePartita(p) {
  const { data } = await db.from('partite').upsert(p).select().single();
  return data;
}
async function dbGeneraPartite(girone_id, squadra_ids) {
  await db.from('partite').delete().eq('girone_id', girone_id);
  const matches = [];
  for (let i = 0; i < squadra_ids.length; i++) {
    for (let j = i + 1; j < squadra_ids.length; j++) {
      matches.push({ girone_id, home_id: squadra_ids[i], away_id: squadra_ids[j], giocata: false });
    }
  }
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
  const rows = marcatori.map(m => ({ partita_id, squadra_id: m.squadra_id, nome: m.nome, minuto: m.minuto || null }));
  await db.from('marcatori').insert(rows);
}

// ---- KNOCKOUT ----
async function dbGetKnockout(categoria_id) {
  const { data } = await db.from('knockout').select('*').eq('categoria_id', categoria_id).order('round_order').order('match_order');
  return data || [];
}
async function dbSaveKnockoutMatch(m) {
  const { data } = await db.from('knockout').upsert(m).select().single();
  return data;
}
async function dbDeleteKnockout(categoria_id) {
  await db.from('knockout').delete().eq('categoria_id', categoria_id);
}

// ---- LOGHI (base64 su squadre) ----
async function dbUpdateLogo(squadra_id, logo_base64) {
  await db.from('squadre').update({ logo: logo_base64 }).eq('id', squadra_id);
}

// ---- REALTIME SUBSCRIPTION ----
function subscribeRealtime(callback) {
  db.channel('torneo-updates')
    .on('postgres_changes', { event: '*', schema: 'public' }, callback)
    .subscribe();
}


// ---- IMPORT EXCEL / PARTITE MANUALI ----
async function dbInsertPartitaManuale(p) {
  const { data, error } = await db
    .from('partite')
    .insert({
      girone_id: p.girone_id,
      home_id: p.home_id,
      away_id: p.away_id,
      fase: p.fase || 'Fase 1',
      giornata: p.giornata || 1,
      orario: p.orario || '',
      campo: p.campo || '',
      ordine: p.ordine || 0,
      priorita: p.priorita || 0,
      giocata: false
    })
    .select()
    .single();

  if (error) {
    console.error('dbInsertPartitaManuale:', error);
    throw error;
  }
  return data;
}

async function dbSaveLegenda(item) {
  const { data, error } = await db
    .from('legenda_torneo')
    .upsert(item)
    .select();

  if (error) {
    console.error('dbSaveLegenda:', error);
    throw error;
  }
  return data;
}

async function dbGetLegenda(categoria_id) {
  const { data, error } = await db
    .from('legenda_torneo')
    .select('*')
    .eq('categoria_id', categoria_id)
    .order('id');

  if (error) {
    console.error('dbGetLegenda:', error);
    return [];
  }
  return data || [];
}
