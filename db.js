// ============================================================
//  DB.JS — Soccer Pro Experience
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

async function dbSaveTorneo(obj) {
  const { data, error } = await db.from('tornei').insert(obj).select('id, nome, data, attivo').single();
  if (error) throw error;
  return data;
}

async function dbUpdateTorneo(id, obj) {
  const { error } = await db.from('tornei').update(obj).eq('id', id);
  if (error) throw error;
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
  const { data, error } = await db.from('categorie').insert(obj).select('*').single();
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
  const { data, error } = await db.from('squadre').insert(obj).select('*').single();
  if (error) throw error;
  return data;
}

async function dbUpdateLogo(squadraId, logoBase64) {
  const { error } = await db.from('squadre').update({ logo: logoBase64 }).eq('id', squadraId);
  if (error) throw error;
}

// ============================================================
//  GIRONI
// ============================================================
async function dbGetGironi(categoriaId) {
  const { data, error } = await db.from('gironi').select('*')
    .eq('categoria_id', categoriaId).order('nome');
  if (error) throw error;
  return data || [];
}

async function dbSaveGirone(obj) {
  const { data, error } = await db.from('gironi').insert(obj).select('*').single();
  if (error) throw error;
  return data;
}

async function dbGetGironeSquadre(gironeId) {
  const { data, error } = await db.from('girone_squadre')
    .select('*, squadre(id, nome, logo)')
    .eq('girone_id', gironeId)
    .order('posizione');
  if (error) throw error;
  return data || [];
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

async function dbSavePartita(obj) {
  const { data, error } = await db.from('partite')
    .update({ gol_home: obj.gol_home, gol_away: obj.gol_away, giocata: true })
    .eq('id', obj.id)
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
    marcatori.map(m => ({
      partita_id: partitaId,
      squadra_id: m.squadra_id,
      nome: m.nome,
      minuto: m.minuto || null
    }))
  );
  if (error) throw error;
}

// ============================================================
//  KNOCKOUT
// ============================================================
async function dbGetKnockout(categoriaId) {
  const { data, error } = await db.from('knockout')
    .select('*')
    .eq('categoria_id', categoriaId)
    .order('round_order').order('match_order');
  if (error) throw error;
  return data || [];
}

async function dbSaveKnockout(id, golHome, golAway) {
  const { error } = await db.from('knockout')
    .update({ gol_home: golHome, gol_away: golAway, giocata: true })
    .eq('id', id);
  if (error) throw error;
}

async function dbSaveKnockoutMatch(obj) {
  if (obj.id) {
    const { id, ...rest } = obj;
    const { error } = await db.from('knockout').update(rest).eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await db.from('knockout').insert(obj);
    if (error) throw error;
  }
}

async function dbDeleteKnockout(id) {
  const { error } = await db.from('knockout').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
//  CLASSIFICA con spareggio completo
// ============================================================
function calcolaClassifica(squadre, partite) {
  const stats = {};
  squadre.forEach(sq => {
    const id   = sq.squadre?.id || sq.id;
    const nome = sq.squadre?.nome || sq.nome || '';
    const logo = sq.squadre?.logo || sq.logo || null;
    stats[id]  = { id, nome, logo, pt:0, g:0, v:0, n:0, p:0, gf:0, gs:0, dr:0 };
  });

  const giocate = partite.filter(p => p.giocata);
  giocate.forEach(p => {
    const hId = p.home?.id || p.home_id;
    const aId = p.away?.id || p.away_id;
    if (!stats[hId] || !stats[aId]) return;
    const gh = p.gol_home, ga = p.gol_away;
    stats[hId].g++; stats[aId].g++;
    stats[hId].gf += gh; stats[hId].gs += ga; stats[hId].dr += gh - ga;
    stats[aId].gf += ga; stats[aId].gs += gh; stats[aId].dr += ga - gh;
    if (gh > ga)      { stats[hId].pt+=3; stats[hId].v++; stats[aId].p++; }
    else if (gh < ga) { stats[aId].pt+=3; stats[aId].v++; stats[hId].p++; }
    else              { stats[hId].pt++; stats[hId].n++; stats[aId].pt++; stats[aId].n++; }
  });

  const lista = Object.values(stats);

  lista.sort((a, b) => {
    if (b.pt !== a.pt) return b.pt - a.pt;
    const sd = _sdStats([a.id, b.id], giocate);
    if (sd[b.id].pt !== sd[a.id].pt) return sd[b.id].pt - sd[a.id].pt;
    if (sd[b.id].dr !== sd[a.id].dr) return sd[b.id].dr - sd[a.id].dr;
    if (sd[b.id].gf !== sd[a.id].gf) return sd[b.id].gf - sd[a.id].gf;
    if (b.dr !== a.dr) return b.dr - a.dr;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return 0;
  });

  return lista.map((s, i) => ({ ...s, pos: i + 1 }));
}

function _sdStats(ids, giocate) {
  const sd = {};
  ids.forEach(id => { sd[id] = { pt:0, dr:0, gf:0 }; });
  giocate.forEach(p => {
    const hId = p.home?.id || p.home_id;
    const aId = p.away?.id || p.away_id;
    if (!ids.includes(hId) || !ids.includes(aId)) return;
    const gh = p.gol_home, ga = p.gol_away;
    sd[hId].gf += gh; sd[hId].dr += gh - ga;
    sd[aId].gf += ga; sd[aId].dr += ga - gh;
    if (gh > ga)      { sd[hId].pt+=3; }
    else if (gh < ga) { sd[aId].pt+=3; }
    else              { sd[hId].pt++; sd[aId].pt++; }
  });
  return sd;
}

// Alias per compatibilità con app.js
function scontroDisetto(ids, partite) { return _sdStats(ids, partite); }

// ============================================================
//  RISOLVI TRIANGOLARI AUTOMATICI
// ============================================================
async function risolviTriangolariSeCompleti(categoriaId) {
  try {
    const { data: gironi } = await db.from('gironi').select('id, nome').eq('categoria_id', categoriaId);
    if (!gironi?.length) return false;

    const classifiche = {};

    for (const g of gironi) {
      const { data: partite } = await db.from('partite')
        .select('id, home_id, away_id, gol_home, gol_away, giocata')
        .eq('girone_id', g.id);
      if (!partite?.length || partite.some(p => !p.giocata)) return false;

      const { data: gsRows } = await db.from('girone_squadre')
        .select('squadra_id, squadre(id, nome, logo)')
        .eq('girone_id', g.id);

      const squadre = (gsRows||[]).map(r => ({
        id: r.squadra_id, nome: r.squadre?.nome||'', logo: r.squadre?.logo||null
      }));

      // Adatta formato per calcolaClassifica
      const partiteAdattate = partite.map(p => ({
        ...p,
        home: { id: p.home_id },
        away: { id: p.away_id }
      }));

      const cl = calcolaClassifica(
        squadre.map(s => ({ id: s.id, nome: s.nome, logo: s.logo })),
        partiteAdattate
      );
      classifiche[g.nome] = cl;
    }

    const { data: knockouts } = await db.from('knockout')
      .select('id, note_home, note_away, home_id, away_id')
      .eq('categoria_id', categoriaId);

    if (!knockouts?.length) return 0;

    let aggiornati = 0;
    for (const ko of knockouts) {
      const newH = _risolviNota(ko.note_home, classifiche);
      const newA = _risolviNota(ko.note_away, classifiche);
      if ((newH && newH !== ko.home_id) || (newA && newA !== ko.away_id)) {
        const upd = {};
        if (newH) upd.home_id = newH;
        if (newA) upd.away_id = newA;
        await db.from('knockout').update(upd).eq('id', ko.id);
        aggiornati++;
      }
    }
    return aggiornati;
  } catch(e) {
    console.error('risolviTriangolariSeCompleti:', e);
    return false;
  }
}

function _risolviNota(nota, classifiche) {
  if (!nota) return null;
  const m = nota.match(/(\d+)[°º]?\s*Girone\s+(.+)/i);
  if (!m) return null;
  const pos = parseInt(m[1]);
  const cl  = classifiche[`Girone ${m[2].trim()}`];
  if (!cl || cl.length < pos) return null;
  return cl[pos-1]?.id || null;
}

// ============================================================
//  REALTIME
// ============================================================
function subscribeRealtime(callback) {
  db.channel('spe-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'partite' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'knockout' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tornei' }, callback)
    .subscribe();
}
