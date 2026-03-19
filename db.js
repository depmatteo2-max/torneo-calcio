// ============================================================
//  DB.JS — Soccer Pro Experience
//  Tutte le query Supabase + logica classifica + risoluzione triangolari
// ============================================================

let db = null;

function initDB() {
  const { createClient } = supabase;
  db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 10 } }
  });
}

// ============================================================
//  TORNEI
// ============================================================
async function dbGetTornei() {
  const { data, error } = await db.from('tornei').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
async function dbGetTorneoAttivo() {
  const { data } = await db.from('tornei').select('*').eq('attivo', true).limit(1);
  return data?.[0] || null;
}
async function dbSaveTorneo(obj) {
  // Accetta sia oggetto {nome,data,attivo} che parametri separati per retrocompatibilità
  const payload = (typeof obj === 'object') ? obj : { nome: obj, data: arguments[1], attivo: true };
  const { data, error } = await db.from('tornei').insert(payload).select('id').single();
  if (error) throw error;
  return data;
}
async function dbUpdateTorneo(id, obj) {
  const { error } = await db.from('tornei').update(obj).eq('id', id);
  if (error) throw error;
}
async function dbSetTorneoAttivo(id) {
  await db.from('tornei').update({ attivo: false }).neq('id', id);
  await db.from('tornei').update({ attivo: true }).eq('id', id);
}
async function dbDeleteTorneo(id) {
  const { error } = await db.from('tornei').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
//  CATEGORIE
// ============================================================
async function dbGetCategorie(torneoId) {
  const { data, error } = await db.from('categorie').select('*')
    .eq('torneo_id', torneoId).order('ordine');
  if (error) throw error;
  return data || [];
}
async function dbSaveCategoria(obj) {
  // Accetta oggetto {nome, qualificate, formato, ordine, torneo_id}
  const { data, error } = await db.from('categorie').insert(obj).select('id').single();
  if (error) throw error;
  return data;
}
async function dbDeleteCategoria(id) {
  const { error } = await db.from('categorie').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
//  SQUADRE
// ============================================================
async function dbGetSquadre(torneoId) {
  const { data, error } = await db.from('squadre').select('*')
    .eq('torneo_id', torneoId).order('nome');
  if (error) throw error;
  return data || [];
}
async function dbSaveSquadra(obj) {
  // Accetta oggetto {nome, torneo_id} o (torneoId, nome) per retrocompatibilità
  const payload = (typeof obj === 'object') ? obj : { torneo_id: obj, nome: arguments[1] };
  const { data, error } = await db.from('squadre').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}
async function dbSaveLogo(squadraId, logoBase64) {
  const { error } = await db.from('squadre').update({ logo: logoBase64 }).eq('id', squadraId);
  if (error) throw error;
}
async function dbUpdateLogo(squadraId, logoBase64) {
  return dbSaveLogo(squadraId, logoBase64);
}

// ============================================================
//  GIRONI
// ============================================================
async function dbGetGironi(categoriaId) {
  const { data, error } = await db.from('gironi').select('*').eq('categoria_id', categoriaId).order('nome');
  if (error) throw error;
  return data || [];
}
async function dbSaveGirone(obj) {
  const { data, error } = await db.from('gironi').insert(obj).select('id').single();
  if (error) throw error;
  return data;
}
async function dbSetGironeSquadre(gironeId, squadraIds) {
  await db.from('girone_squadre').delete().eq('girone_id', gironeId);
  if (!squadraIds.length) return;
  const rows = squadraIds.map((sid, i) => ({ girone_id: gironeId, squadra_id: sid, posizione: i }));
  const { error } = await db.from('girone_squadre').insert(rows);
  if (error) throw error;
}
async function dbGeneraPartite(gironeId, squadraIds) {
  await db.from('partite').delete().eq('girone_id', gironeId);
  const matches = [];
  for (let i = 0; i < squadraIds.length; i++)
    for (let j = i + 1; j < squadraIds.length; j++)
      matches.push({ girone_id: gironeId, home_id: squadraIds[i], away_id: squadraIds[j], giocata: false });
  if (matches.length) {
    const { error } = await db.from('partite').insert(matches);
    if (error) throw error;
  }
}
async function dbGetGironeSquadre(gironeId) {
  const { data, error } = await db.from('girone_squadre')
    .select('*, squadre(id, nome, logo)')
    .eq('girone_id', gironeId)
    .order('posizione');
  if (error) throw error;
  return data || [];
}

// ============================================================
//  PARTITE
// ============================================================
async function dbGetPartite(gironeId) {
  const { data, error } = await db.from('partite')
    .select('*, home:squadre!home_id(id,nome,logo), away:squadre!away_id(id,nome,logo)')
    .eq('girone_id', gironeId)
    .order('orario');
  if (error) throw error;
  return data || [];
}

async function dbGetTuttePartiteCategoria(categoriaId) {
  // Recupera tutti i gironi della categoria, poi tutte le partite
  const { data: gironi } = await db.from('gironi').select('id').eq('categoria_id', categoriaId);
  if (!gironi?.length) return [];
  const girIds = gironi.map(g => g.id);
  const { data, error } = await db.from('partite')
    .select('*, home:squadre!home_id(id,nome,logo), away:squadre!away_id(id,nome,logo)')
    .in('girone_id', girIds);
  if (error) throw error;
  return data || [];
}

async function dbSavePartita(obj) {
  // Accetta oggetto {id, girone_id, gol_home, gol_away, giocata}
  const { id, girone_id, ...rest } = obj;
  const { data, error } = await db.from('partite')
    .update({ gol_home: rest.gol_home, gol_away: rest.gol_away, giocata: rest.giocata ?? true })
    .eq('id', id)
    .select().single();
  if (error) throw error;
  return data;
}

async function dbGetMarcatori(partitaId) {
  const { data, error } = await db.from('marcatori')
    .select('*, squadre(nome)')
    .eq('partita_id', partitaId)
    .order('minuto');
  if (error) throw error;
  return data || [];
}
async function dbSaveMarcatori(partitaId, marcatori) {
  await db.from('marcatori').delete().eq('partita_id', partitaId);
  if (!marcatori.length) return;
  const { error } = await db.from('marcatori').insert(
    marcatori.map(m => ({ partita_id: partitaId, squadra_id: m.squadra_id, nome: m.nome, minuto: m.minuto }))
  );
  if (error) throw error;
}

// ============================================================
//  KNOCKOUT
// ============================================================
async function dbGetKnockout(categoriaId) {
  const { data, error } = await db.from('knockout')
    .select('*, home:squadre!home_id(id,nome,logo), away:squadre!away_id(id,nome,logo)')
    .eq('categoria_id', categoriaId)
    .order('round_order').order('match_order');
  if (error) throw error;
  return data || [];
}
async function dbSaveKnockoutMatch(obj) {
  const { id, ...rest } = obj;
  if (id) {
    const { data, error } = await db.from('knockout').update(rest).eq('id', id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await db.from('knockout').insert(rest).select().single();
    if (error) throw error;
    return data;
  }
}
async function dbSaveKnockout(id, golHome, golAway) {
  const { error } = await db.from('knockout')
    .update({ gol_home: golHome, gol_away: golAway, giocata: true })
    .eq('id', id);
  if (error) throw error;
}
async function dbAddKnockout(categoriaId, roundName, roundOrder, matchOrder, homeId, awayId, isConsolazione) {
  const { error } = await db.from('knockout').insert({
    categoria_id: categoriaId, round_name: roundName, round_order: roundOrder,
    match_order: matchOrder, home_id: homeId, away_id: awayId,
    giocata: false, is_consolazione: isConsolazione || false
  });
  if (error) throw error;
}
async function dbDeleteKnockout(id) {
  const { error } = await db.from('knockout').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
//  CLASSIFICA GIRONE
//  Criteri spareggio: punti → scontro diretto → diff reti SD → gol fatti SD → diff reti gen → gol fatti gen → rigori
// ============================================================
function calcolaClassifica(squadre, partite) {
  const sqIds = squadre.map(s => s.squadre?.id || s.id);

  // Stats generali
  const stats = {};
  sqIds.forEach(id => {
    stats[id] = { id, pt: 0, g: 0, v: 0, n: 0, p: 0, gf: 0, gs: 0, dr: 0 };
  });

  partite.filter(p => p.giocata).forEach(p => {
    const hId = p.home?.id || p.home_id;
    const aId = p.away?.id || p.away_id;
    if (!stats[hId] || !stats[aId]) return;
    const gh = p.gol_home, ga = p.gol_away;
    stats[hId].g++; stats[aId].g++;
    stats[hId].gf += gh; stats[hId].gs += ga; stats[hId].dr += (gh - ga);
    stats[aId].gf += ga; stats[aId].gs += gh; stats[aId].dr += (ga - gh);
    if (gh > ga)      { stats[hId].pt += 3; stats[hId].v++; stats[aId].p++; }
    else if (gh < ga) { stats[aId].pt += 3; stats[aId].v++; stats[hId].p++; }
    else              { stats[hId].pt += 1; stats[hId].n++; stats[aId].pt += 1; stats[aId].n++; }
  });

  const arr = Object.values(stats);

  // Sort con spareggio completo
  arr.sort((a, b) => {
    if (b.pt !== a.pt) return b.pt - a.pt;
    // Scontro diretto
    const sd = scontroDisetto([a.id, b.id], partite);
    const ptA = sd[a.id]?.pt || 0, ptB = sd[b.id]?.pt || 0;
    if (ptB !== ptA) return ptB - ptA;
    const drA = sd[a.id]?.dr || 0, drB = sd[b.id]?.dr || 0;
    if (drB !== drA) return drB - drA;
    const gfA = sd[a.id]?.gf || 0, gfB = sd[b.id]?.gf || 0;
    if (gfB !== gfA) return gfB - gfA;
    // Differenza reti generale
    if (b.dr !== a.dr) return b.dr - a.dr;
    // Gol fatti generale
    if (b.gf !== a.gf) return b.gf - a.gf;
    return 0; // rigori → manuale
  });

  return arr.map((s, i) => ({
    ...s,
    pos: i + 1,
    nome: (squadre.find(sq => (sq.squadre?.id || sq.id) === s.id)?.squadre?.nome ||
           squadre.find(sq => (sq.squadre?.id || sq.id) === s.id)?.nome || ''),
    logo: (squadre.find(sq => (sq.squadre?.id || sq.id) === s.id)?.squadre?.logo ||
           squadre.find(sq => (sq.squadre?.id || sq.id) === s.id)?.logo || null)
  }));
}

function scontroDisetto(ids, partite) {
  const sd = {};
  ids.forEach(id => { sd[id] = { pt: 0, dr: 0, gf: 0 }; });
  partite.filter(p => p.giocata).forEach(p => {
    const hId = p.home?.id || p.home_id;
    const aId = p.away?.id || p.away_id;
    if (!ids.includes(hId) || !ids.includes(aId)) return;
    const gh = p.gol_home, ga = p.gol_away;
    sd[hId].gf += gh; sd[hId].dr += (gh - ga);
    sd[aId].gf += ga; sd[aId].dr += (ga - gh);
    if (gh > ga)      { sd[hId].pt += 3; }
    else if (gh < ga) { sd[aId].pt += 3; }
    else              { sd[hId].pt += 1; sd[aId].pt += 1; }
  });
  return sd;
}

// ============================================================
//  RISOLVI TRIANGOLARI — cuore del sistema automatico
//
//  Chiamata dopo ogni salvataggio risultato.
//  1. Verifica se TUTTI i gironi della categoria hanno finito
//  2. Calcola classifica per ogni girone
//  3. Legge i knockout con note_home/note_away tipo "1° Girone 1"
//  4. Risolve ogni placeholder con la squadra reale
//  5. Aggiorna i record su Supabase
// ============================================================
async function risolviTriangolariSeCompleti(categoriaId) {
  try {
    // 1. Recupera tutti i gironi della categoria
    const { data: gironi } = await db.from('gironi').select('id, nome').eq('categoria_id', categoriaId);
    if (!gironi?.length) return false;

    // 2. Per ogni girone verifica che tutte le partite siano giocate
    let tuttiCompleti = true;
    const classifichePerGirone = {}; // 'Girone 1' → [{ pos:1, id, nome }, ...]

    for (const girone of gironi) {
      const { data: partite } = await db.from('partite')
        .select('*, home:squadre!home_id(id,nome), away:squadre!away_id(id,nome)')
        .eq('girone_id', girone.id);

      const { data: gSquadre } = await db.from('girone_squadre')
        .select('*, squadre(id,nome,logo)')
        .eq('girone_id', girone.id);

      if (!partite?.length) { tuttiCompleti = false; continue; }

      const totPartite    = partite.length;
      const partiteGiocate = partite.filter(p => p.giocata).length;

      if (partiteGiocate < totPartite) {
        tuttiCompleti = false;
        continue;
      }

      // Girone completo → calcola classifica
      const classifica = calcolaClassifica(gSquadre, partite);
      classifichePerGirone[girone.nome] = classifica;
    }

    if (!tuttiCompleti) return false; // ancora partite da giocare

    // 3. Tutti i gironi completati → risolvi i placeholder nei knockout
    const { data: knockouts } = await db.from('knockout')
      .select('id, note_home, note_away, home_id, away_id')
      .eq('categoria_id', categoriaId);

    if (!knockouts?.length) return true;

    let aggiornamenti = 0;

    for (const ko of knockouts) {
      const newHomeId = risolviPlaceholder(ko.note_home, classifichePerGirone) || ko.home_id;
      const newAwayId = risolviPlaceholder(ko.note_away, classifichePerGirone) || ko.away_id;

      // Aggiorna solo se cambia qualcosa
      if (newHomeId !== ko.home_id || newAwayId !== ko.away_id) {
        await db.from('knockout').update({ home_id: newHomeId, away_id: newAwayId }).eq('id', ko.id);
        aggiornamenti++;
      }
    }

    return aggiornamenti; // restituisce numero di accoppiamenti risolti

  } catch (e) {
    console.error('Errore risolviTriangolari:', e);
    return false;
  }
}

/**
 * Risolve un placeholder tipo "1° Girone 1" → id squadra reale
 * Formati supportati: "1° Girone 1", "2° Girone 2", "3° Girone A", ecc.
 */
function risolviPlaceholder(nota, classifichePerGirone) {
  if (!nota) return null;

  // Pattern: numero° Girone nome
  const m = nota.match(/(\d+)[°oa°]?\s+Girone\s+(\S+)/i);
  if (!m) return null;

  const pos       = parseInt(m[1]);
  const nomeGirone = `Girone ${m[2]}`;
  const classifica = classifichePerGirone[nomeGirone];

  if (!classifica) return null;

  const squadra = classifica.find(s => s.pos === pos);
  return squadra?.id || null;
}

// ============================================================
//  REALTIME SUBSCRIPTIONS
// ============================================================
function subscribePartite(callback) {
  return db.channel('partite-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'partite' }, callback)
    .subscribe();
}
function subscribeKnockout(callback) {
  return db.channel('knockout-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'knockout' }, callback)
    .subscribe();
}
function subscribeTornei(callback) {
  return db.channel('tornei-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tornei' }, callback)
    .subscribe();
}

// ============================================================
//  REALTIME — funzione generica usata da app.js
// ============================================================
function subscribeRealtime(callback) {
  db.channel('all-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'partite' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'knockout' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tornei' }, callback)
    .subscribe();
}
