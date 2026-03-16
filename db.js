// ============================================================
//  DB - VERSIONE CORRETTA
// ============================================================

let db;
let realtimeChannel;

function initDB() {
  db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

function subscribeRealtime(onChange) {
  try {
    if (realtimeChannel) db.removeChannel(realtimeChannel);
    realtimeChannel = db
      .channel('torneo-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partite' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marcatori' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'knockout' }, onChange)
      .subscribe();
  } catch (e) {
    console.error('Realtime error:', e);
  }
}

// ===== TORNEO =====
async function dbGetTorneo() {
  const { data, error } = await db.from('torneo').select('*').eq('id', 1).single();
  if (error) throw error;
  return data;
}

async function dbSaveTorneo(t) {
  const { data, error } = await db.from('torneo').upsert({ id: 1, nome: t.nome || '', data: t.data || '' }).select().single();
  if (error) throw error;
  return data;
}

// ===== CATEGORIE =====
async function dbGetCategorie() {
  const { data, error } = await db.from('categorie').select('*').order('ordine', { ascending: true }).order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function dbSaveCategoria(c) {
  const payload = {
    id: c.id,
    nome: c.nome,
    qualificate: c.qualificate ?? 2,
    formato: c.formato || 'semi',
    ordine: c.ordine ?? 0
  };

  let q = db.from('categorie');
  const { data, error } = c.id
    ? await q.update(payload).eq('id', c.id).select().single()
    : await q.insert(payload).select().single();

  if (error) throw error;
  return data;
}

async function dbDeleteCategoria(id) {
  const { error } = await db.from('categorie').delete().eq('id', id);
  if (error) throw error;
}

// ===== SQUADRE =====
async function dbGetSquadre() {
  const { data, error } = await db.from('squadre').select('*').order('nome', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function dbSaveSquadra(s) {
  const { data, error } = await db.from('squadre').insert({ nome: s.nome, logo: s.logo || null }).select().single();
  if (error) throw error;
  return data;
}

async function dbUpdateLogo(squadra_id, logo) {
  const { error } = await db.from('squadre').update({ logo }).eq('id', squadra_id);
  if (error) throw error;
}

// ===== GIRONI =====
async function dbGetGironi(categoria_id) {
  const { data, error } = await db.from('gironi').select('*').eq('categoria_id', categoria_id).order('nome', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function dbSaveGirone(g) {
  const payload = { categoria_id: g.categoria_id, nome: g.nome };
  const { data, error } = await db.from('gironi').insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function dbGetGironeSquadre(girone_id) {
  const { data, error } = await db
    .from('girone_squadre')
    .select('id, girone_id, squadra_id, posizione, squadre(*)')
    .eq('girone_id', girone_id)
    .order('posizione', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function dbSetGironeSquadre(girone_id, squadra_ids) {
  const { error: delError } = await db.from('girone_squadre').delete().eq('girone_id', girone_id);
  if (delError) throw delError;

  if (!squadra_ids.length) return [];

  const rows = squadra_ids.map((sid, idx) => ({ girone_id, squadra_id: sid, posizione: idx + 1 }));
  const { data, error } = await db.from('girone_squadre').insert(rows).select();
  if (error) throw error;
  return data || [];
}

// ===== PARTITE =====
async function dbGetPartite(girone_id) {
  const { data, error } = await db
    .from('partite')
    .select('*')
    .eq('girone_id', girone_id)
    .order('giornata', { ascending: true })
    .order('ordine', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;

  const squadre = await dbGetSquadre();
  const sqMap = {};
  squadre.forEach(s => sqMap[s.id] = s);

  return (data || []).map(p => ({
    ...p,
    home: sqMap[p.home_id] || null,
    away: sqMap[p.away_id] || null
  }));
}

async function dbGeneraPartite(girone_id, squadra_ids) {
  const rows = [];
  let giornata = 1;
  let ordine = 1;

  for (let i = 0; i < squadra_ids.length; i++) {
    for (let j = i + 1; j < squadra_ids.length; j++) {
      rows.push({
        girone_id,
        home_id: squadra_ids[i],
        away_id: squadra_ids[j],
        gol_home: 0,
        gol_away: 0,
        giocata: false,
        fase: 'Fase 1',
        giornata,
        orario: '',
        campo: '',
        ordine,
        priorita: 0
      });
      ordine++;
      if (ordine > 4) {
        ordine = 1;
        giornata++;
      }
    }
  }

  if (!rows.length) return [];
  const { data, error } = await db.from('partite').insert(rows).select();
  if (error) throw error;
  return data || [];
}

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
      gol_home: 0,
      gol_away: 0,
      giocata: false
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function dbSavePartita(p) {
  const { data, error } = await db
    .from('partite')
    .update({
      girone_id: p.girone_id,
      gol_home: p.gol_home,
      gol_away: p.gol_away,
      giocata: p.giocata
    })
    .eq('id', p.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ===== MARCATORI =====
async function dbGetMarcatori(partita_id) {
  const { data, error } = await db.from('marcatori').select('*').eq('partita_id', partita_id).order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function dbSaveMarcatori(partita_id, marcatori) {
  const { error: delError } = await db.from('marcatori').delete().eq('partita_id', partita_id);
  if (delError) throw delError;

  if (!marcatori.length) return [];

  const rows = marcatori.map(m => ({
    partita_id,
    squadra_id: m.squadra_id,
    nome: m.nome,
    minuto: m.minuto || null
  }));

  const { data, error } = await db.from('marcatori').insert(rows).select();
  if (error) throw error;
  return data || [];
}

// ===== KNOCKOUT =====
async function dbGetKnockout(categoria_id) {
  const { data, error } = await db
    .from('knockout')
    .select('*')
    .eq('categoria_id', categoria_id)
    .order('round_order', { ascending: true })
    .order('match_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function dbSaveKnockoutMatch(m) {
  let query = db.from('knockout');

  if (m.id) {
    const { data, error } = await query
      .update({
        categoria_id: m.categoria_id,
        round_name: m.round_name,
        round_order: m.round_order,
        match_order: m.match_order,
        home_id: m.home_id,
        away_id: m.away_id,
        gol_home: m.gol_home ?? 0,
        gol_away: m.gol_away ?? 0,
        giocata: m.giocata ?? false
      })
      .eq('id', m.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await query
    .insert({
      categoria_id: m.categoria_id,
      round_name: m.round_name,
      round_order: m.round_order,
      match_order: m.match_order,
      home_id: m.home_id,
      away_id: m.away_id,
      gol_home: m.gol_home ?? 0,
      gol_away: m.gol_away ?? 0,
      giocata: m.giocata ?? false
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbDeleteKnockout(categoria_id) {
  const { error } = await db.from('knockout').delete().eq('categoria_id', categoria_id);
  if (error) throw error;
}

// ===== LEGENDA =====
async function dbSaveLegenda(item) {
  const { data, error } = await db
    .from('legenda_torneo')
    .insert({
      categoria_id: item.categoria_id,
      fase: item.fase || '',
      formula: item.formula || '',
      qualificazioni: item.qualificazioni || '',
      criteri_classifica: item.criteri_classifica || '',
      note: item.note || ''
    })
    .select();
  if (error) throw error;
  return data;
}
