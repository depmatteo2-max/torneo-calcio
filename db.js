// ============================================================
//  DB - VERSIONE CORRETTA COMPLETA
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'legenda_torneo' }, onChange)
      .subscribe();
  } catch (e) {
    console.error('Realtime error:', e);
  }
}

// ===== TORNEO =====
async function dbGetTorneo() {
  const { data, error } = await db
    .from('torneo')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) throw error;
  return data;
}

async function dbSaveTorneo(t) {
  const { data, error } = await db
    .from('torneo')
    .upsert({
      id: 1,
      nome: t.nome || '',
      data: t.data || ''
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ===== CATEGORIE =====
async function dbGetCategorie() {
  const { data, error } = await db
    .from('categorie')
    .select('*')
    .order('ordine', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function dbSaveCategoria(c) {
  const payload = {
    nome: c.nome,
    qualificate: c.qualificate ?? 2,
    formato: c.formato || 'semi',
    ordine: c.ordine ?? 0
  };

  if (c.id) {
    const { data, error } = await db
      .from('categorie')
      .update(payload)
      .eq('id', c.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await db
    .from('categorie')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function dbDeleteCategoria(id) {
  const { error } = await db
    .from('categorie')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ===== SQUADRE =====
async function dbGetSquadre() {
  const { data, error } = await db
    .from('squadre')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function dbSaveSquadra(s) {
  const nome = String(s.nome || '').trim();
  if (!nome) throw new Error('Nome squadra mancante');

  // prima prova a vedere se esiste già
  const { data: existing, error: existingError } = await db
    .from('squadre')
    .select('*')
    .ilike('nome', nome)
    .limit(1);

  if (existingError) throw existingError;
  if (existing && existing.length) return existing[0];

  const { data, error } = await db
    .from('squadre')
    .insert({
      nome,
      logo: s.logo || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function dbUpdateLogo(squadra_id, logo) {
  const { error } = await db
    .from('squadre')
    .update({ logo })
    .eq('id', squadra_id);

  if (error) throw error;
}

// ===== GIRONI =====
async function dbGetGironi(categoria_id) {
  const { data, error } = await db
    .from('gironi')
    .select('*')
    .eq('categoria_id', categoria_id)
    .order('nome', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function dbSaveGirone(g) {
  const categoria_id = g.categoria_id;
  const nome = String(g.nome || '').trim();

  if (!categoria_id || !nome) throw new Error('Girone non valido');

  const { data: existing, error: existingError } = await db
    .from('gironi')
    .select('*')
    .eq('categoria_id', categoria_id)
    .ilike('nome', nome)
    .limit(1);

  if (existingError) throw existingError;
  if (existing && existing.length) return existing[0];

  const { data, error } = await db
    .from('gironi')
    .insert({
      categoria_id,
      nome
    })
    .select()
    .single();

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
  const { error: delError } = await db
    .from('girone_squadre')
    .delete()
    .eq('girone_id', girone_id);

  if (delError) throw delError;

  if (!squadra_ids.length) return [];

  const rows = squadra_ids.map((sid, idx) => ({
    girone_id,
    squadra_id: sid,
    posizione: idx + 1
  }));

  const { data, error } = await db
    .from('girone_squadre')
    .insert(rows)
    .select();

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
  squadre.forEach(s => {
    sqMap[s.id] = s;
  });

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

  const { data, error } = await db
    .from('partite')
    .insert(rows)
    .select();

  if (error) throw error;
  return data || [];
}

async function dbInsertPartitaManuale(p) {
  const payload = {
    girone_id: p.girone_id,
    home_id: p.home_id,
    away_id: p.away_id,
    fase: p.fase || 'Fase 1',
    giornata: p.giornata ?? 1,
    orario: p.orario || '',
    campo: p.campo || '',
    ordine: p.ordine ?? 0,
    priorita: p.priorita ?? 0,
    gol_home: p.gol_home ?? 0,
    gol_away: p.gol_away ?? 0,
    giocata: p.giocata ?? false
  };

  const { data, error } = await db
    .from('partite')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function dbSavePartita(p) {
  const payload = {
    girone_id: p.girone_id,
    gol_home: p.gol_home,
    gol_away: p.gol_away,
    giocata: p.giocata
  };

  if (p.fase !== undefined) payload.fase = p.fase;
  if (p.giornata !== undefined) payload.giornata = p.giornata;
  if (p.orario !== undefined) payload.orario = p.orario;
  if (p.campo !== undefined) payload.campo = p.campo;
  if (p.ordine !== undefined) payload.ordine = p.ordine;
  if (p.priorita !== undefined) payload.priorita = p.priorita;
  if (p.home_id !== undefined) payload.home_id = p.home_id;
  if (p.away_id !== undefined) payload.away_id = p.away_id;

  const { data, error } = await db
    .from('partite')
    .update(payload)
    .eq('id', p.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function dbDeletePartita(id) {
  const { error } = await db
    .from('partite')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ===== MARCATORI =====
async function dbGetMarcatori(partita_id) {
  const { data, error } = await db
    .from('marcatori')
    .select('*')
    .eq('partita_id', partita_id)
    .order('id', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function dbSaveMarcatori(partita_id, marcatori) {
  const { error: delError } = await db
    .from('marcatori')
    .delete()
    .eq('partita_id', partita_id);

  if (delError) throw delError;

  if (!marcatori.length) return [];

  const rows = marcatori.map(m => ({
    partita_id,
    squadra_id: m.squadra_id,
    nome: m.nome,
    minuto: m.minuto || null
  }));

  const { data, error } = await db
    .from('marcatori')
    .insert(rows)
    .select();

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
  const payload = {
    categoria_id: m.categoria_id,
    round_name: m.round_name,
    round_order: m.round_order,
    match_order: m.match_order,
    home_id: m.home_id,
    away_id: m.away_id,
    gol_home: m.gol_home ?? 0,
    gol_away: m.gol_away ?? 0,
    giocata: m.giocata ?? false
  };

  if (m.id) {
    const { data, error } = await db
      .from('knockout')
      .update(payload)
      .eq('id', m.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await db
    .from('knockout')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function dbDeleteKnockout(categoria_id) {
  const { error } = await db
    .from('knockout')
    .delete()
    .eq('categoria_id', categoria_id);

  if (error) throw error;
}

// ===== LEGENDA =====
async function dbGetLegenda(categoria_id) {
  const { data, error } = await db
    .from('legenda_torneo')
    .select('*')
    .eq('categoria_id', categoria_id)
    .order('id', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function dbSaveLegenda(item) {
  const payload = {
    categoria_id: item.categoria_id,
    fase: item.fase || '',
    formula: item.formula || '',
    qualificazioni: item.qualificazioni || '',
    criteri_classifica: item.criteri_classifica || '',
    note: item.note || ''
  };

  const { data, error } = await db
    .from('legenda_torneo')
    .insert(payload)
    .select();

  if (error) throw error;
  return data;
}