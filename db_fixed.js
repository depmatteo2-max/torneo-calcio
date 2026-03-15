let db = null;

function initDB() {
  db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

async function unwrap(result, context) {
  const { data, error } = result;
  if (error) {
    console.error(context, error);
    throw error;
  }
  return data;
}

// ---- TORNEO CONFIG ----
async function dbGetTorneo() {
  return await unwrap(db.from('torneo').select('*').eq('id', 1).single(), 'dbGetTorneo');
}
async function dbSaveTorneo(obj) {
  await unwrap(db.from('torneo').upsert({ id: 1, ...obj }), 'dbSaveTorneo');
}

// ---- CATEGORIE ----
async function dbGetCategorie() {
  return (await unwrap(db.from('categorie').select('*').order('ordine'), 'dbGetCategorie')) || [];
}
async function dbSaveCategoria(cat) {
  return await unwrap(db.from('categorie').upsert(cat).select().single(), 'dbSaveCategoria');
}
async function dbDeleteCategoria(id) {
  await unwrap(db.from('categorie').delete().eq('id', id), 'dbDeleteCategoria');
}

// ---- GIRONI ----
async function dbGetGironi(categoria_id) {
  return (await unwrap(db.from('gironi').select('*').eq('categoria_id', categoria_id).order('nome'), 'dbGetGironi')) || [];
}
async function dbSaveGirone(g) {
  return await unwrap(db.from('gironi').upsert(g).select().single(), 'dbSaveGirone');
}

// ---- SQUADRE ----
async function dbGetSquadre() {
  return (await unwrap(db.from('squadre').select('*').order('nome'), 'dbGetSquadre')) || [];
}
async function dbSaveSquadra(s) {
  return await unwrap(db.from('squadre').upsert(s).select().single(), 'dbSaveSquadra');
}

// ---- GIRONE-SQUADRE (membership) ----
async function dbGetGironeSquadre(girone_id) {
  return (await unwrap(db.from('girone_squadre').select('*, squadre(*)').eq('girone_id', girone_id).order('posizione'), 'dbGetGironeSquadre')) || [];
}
async function dbSetGironeSquadre(girone_id, squadra_ids) {
  await unwrap(db.from('girone_squadre').delete().eq('girone_id', girone_id), 'dbSetGironeSquadre.delete');
  if (!squadra_ids.length) return;
  const rows = squadra_ids.map((sid, i) => ({ girone_id, squadra_id: sid, posizione: i }));
  await unwrap(db.from('girone_squadre').insert(rows), 'dbSetGironeSquadre.insert');
}

// ---- PARTITE ----
async function dbGetPartite(girone_id) {
  return (await unwrap(
    db.from('partite')
      .select('*, home:squadre!home_id(*), away:squadre!away_id(*)')
      .eq('girone_id', girone_id)
      .order('created_at'),
    'dbGetPartite'
  )) || [];
}

async function dbSavePartita(p) {
  const payload = {
    id: p.id,
    girone_id: p.girone_id,
    home_id: p.home_id,
    away_id: p.away_id,
    gol_home: p.gol_home === '' || p.gol_home === undefined ? null : Number(p.gol_home),
    gol_away: p.gol_away === '' || p.gol_away === undefined ? null : Number(p.gol_away),
    giocata: !!p.giocata
  };

  return await unwrap(
    db.from('partite').upsert(payload).select().single(),
    'dbSavePartita'
  );
}

async function dbGeneraPartite(girone_id, squadra_ids) {
  await unwrap(db.from('partite').delete().eq('girone_id', girone_id), 'dbGeneraPartite.delete');
  const matches = [];
  for (let i = 0; i < squadra_ids.length; i++) {
    for (let j = i + 1; j < squadra_ids.length; j++) {
      matches.push({ girone_id, home_id: squadra_ids[i], away_id: squadra_ids[j], gol_home: null, gol_away: null, giocata: false });
    }
  }
  if (matches.length) {
    await unwrap(db.from('partite').insert(matches), 'dbGeneraPartite.insert');
  }
}

// ---- MARCATORI ----
async function dbGetMarcatori(partita_id) {
  return (await unwrap(
    db.from('marcatori').select('*, squadre(*)').eq('partita_id', partita_id).order('minuto'),
    'dbGetMarcatori'
  )) || [];
}
async function dbSaveMarcatori(partita_id, marcatori) {
  await unwrap(db.from('marcatori').delete().eq('partita_id', partita_id), 'dbSaveMarcatori.delete');
  if (!marcatori.length) return;
  const rows = marcatori.map(m => ({
    partita_id,
    squadra_id: Number(m.squadra_id),
    nome: (m.nome || '').trim(),
    minuto: m.minuto || null
  })).filter(m => m.nome);
  if (rows.length) {
    await unwrap(db.from('marcatori').insert(rows), 'dbSaveMarcatori.insert');
  }
}

// ---- KNOCKOUT ----
async function dbGetKnockout(categoria_id) {
  return (await unwrap(
    db.from('knockout').select('*').eq('categoria_id', categoria_id).order('round_order').order('match_order'),
    'dbGetKnockout'
  )) || [];
}
async function dbSaveKnockoutMatch(m) {
  const payload = {
    ...m,
    gol_home: m.gol_home === '' || m.gol_home === undefined ? null : Number(m.gol_home),
    gol_away: m.gol_away === '' || m.gol_away === undefined ? null : Number(m.gol_away),
    giocata: !!m.giocata
  };
  return await unwrap(db.from('knockout').upsert(payload).select().single(), 'dbSaveKnockoutMatch');
}
async function dbDeleteKnockout(categoria_id) {
  await unwrap(db.from('knockout').delete().eq('categoria_id', categoria_id), 'dbDeleteKnockout');
}

// ---- LOGHI (base64 su squadre) ----
async function dbUpdateLogo(squadra_id, logo_base64) {
  await unwrap(db.from('squadre').update({ logo: logo_base64 }).eq('id', squadra_id), 'dbUpdateLogo');
}

// ---- REALTIME SUBSCRIPTION ----
function subscribeRealtime(callback) {
  db.channel('torneo-updates')
    .on('postgres_changes', { event: '*', schema: 'public' }, callback)
    .subscribe();
}
