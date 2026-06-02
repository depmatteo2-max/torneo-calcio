// ============================================================
//  import_garda_patch.js — PATCH per sistema Garda
//  Aggiunge risoluzione: Migliore I/II/III, Peggior I/II,
//  Seconda Migliore I/II/III, Peggior Quarta/Terza
//  Da caricare DOPO app.js nell'index.html del sito Garda
// ============================================================

// Mappa romani → indice 0-based
const _GARDA_ROMANI = { I:0, II:1, III:2, IV:3, V:4 };

// Calcola classifiche globali da tutti i gironi della categoria
async function _gardaCalcolaClassificheGlobali(categoriaId) {
  const { data: gironiDB } = await db.from('gironi').select('id,nome').eq('categoria_id', categoriaId);
  if (!gironiDB?.length) return { prime:[], seconde:[], terze:[], quarte:[] };

  const sortFn = (a,b) => {
    if (b.pts!==a.pts) return b.pts-a.pts;
    const dA=a.gf-a.gs, dB=b.gf-b.gs;
    if (dB!==dA) return dB-dA;
    return b.gf-a.gf;
  };

  const prime=[], seconde=[], terze=[], quarte=[];

  for (const g of gironiDB) {
    // Salta gironi CLASSIFICA
    if (/classif/i.test(g.nome)) continue;

    const { data: partite } = await db.from('partite')
      .select('id,home_id,away_id,gol_home,gol_away,giocata').eq('girone_id', g.id);
    if (!partite?.length) continue;

    const giocate = partite.filter(p => p.giocata && p.home_id && p.away_id);
    if (!giocate.length) continue;

    // Raccoglie squadre reali dalle partite
    const sqIds = new Set();
    giocate.forEach(p => { sqIds.add(p.home_id); sqIds.add(p.away_id); });
    const { data: sqList } = await db.from('squadre').select('id,nome,logo').in('id', [...sqIds]);
    if (!sqList?.length) continue;
    const sqMap = {}; sqList.forEach(s => sqMap[s.id]=s);
    const squadre = [...sqIds].map(id => sqMap[id]).filter(Boolean);
    if (squadre.length < 2) continue;

    const cl = calcGironeClassifica({ squadre, partite: giocate });
    if (cl[0]?.sq) prime.push(cl[0]);
    if (cl[1]?.sq) seconde.push(cl[1]);
    if (cl[2]?.sq) terze.push(cl[2]);
    if (cl[3]?.sq) quarte.push(cl[3]);
  }

  prime.sort(sortFn);
  seconde.sort(sortFn);
  terze.sort(sortFn);
  quarte.sort(sortFn);

  return { prime, seconde, terze, quarte };
}

// Risolve un placeholder Garda → id squadra reale
function _gardaRisolviPlaceholder(placeholder, clGlobali) {
  if (!placeholder || !clGlobali) return null;
  const s = placeholder.trim();
  const { prime, seconde, terze, quarte } = clGlobali;

  // "Migliore I/II/III" = 1ª/2ª/3ª tra le prime classificate
  let m = s.match(/^Migliore\s+(I{1,3}|IV|V)$/i);
  if (m) {
    const idx = _GARDA_ROMANI[m[1].toUpperCase()];
    if (idx !== undefined && prime[idx]) return prime[idx].sq?.id || null;
  }

  // "Migliore IV" con 3 gironi = migliore seconda classificata
  if (/^Migliore\s+IV$/i.test(s)) return seconde[0]?.sq?.id || null;

  // "Seconda Migliore I/II/III/IV" = 1ª/2ª/3ª tra le seconde
  m = s.match(/^Seconda\s+Migliore\s+(I{1,3}|IV|V)$/i);
  if (m) {
    const idx = _GARDA_ROMANI[m[1].toUpperCase()];
    if (idx !== undefined && seconde[idx]) return seconde[idx].sq?.id || null;
  }

  // "Peggior I/II/III" = peggiore/penultima... tra le prime (in ordine inverso)
  m = s.match(/^Peggior[e]?\s+(I{1,3}|IV|V)$/i);
  if (m) {
    const idx = _GARDA_ROMANI[m[1].toUpperCase()];
    if (idx !== undefined) {
      // Peggior I = ultima delle prime, Peggior II = penultima ecc.
      const invIdx = prime.length - 1 - idx;
      return prime[Math.max(0, invIdx)]?.sq?.id || null;
    }
  }

  // "Peggior Quarta" = ultima tra le quarte
  if (/^Peggior[e]?\s+Quart[ae]?$/i.test(s)) {
    return quarte[quarte.length - 1]?.sq?.id || null;
  }

  // "Peggior Terza" = ultima tra le terze
  if (/^Peggior[e]?\s+Terz[ae]?$/i.test(s)) {
    return terze[terze.length - 1]?.sq?.id || null;
  }

  return null;
}

// Override di risolviManuale per aggiungere la logica Garda
const _risolviManuale_orig = window.risolviManuale;
window.risolviManuale = async function() {
  if (!STATE.activeCat) return;

  toast('⏳ Risoluzione accoppiamenti...');

  // 1. Prima prova la logica originale
  if (typeof _risolviManuale_orig === 'function') {
    await _risolviManuale_orig();
  }

  // 2. Poi risolvi i placeholder Garda (Migliore I, Peggior II ecc.)
  try {
    const clGlobali = await _gardaCalcolaClassificheGlobali(STATE.activeCat);
    const totGironi = clGlobali.prime.length;

    if (totGironi === 0) {
      toast('⏳ Inserisci prima i risultati dei gironi');
      return;
    }

    const { data: koList } = await db.from('knockout')
      .select('id,note_home,note_away,home_id,away_id')
      .eq('categoria_id', STATE.activeCat);

    let risolti = 0;
    for (const ko of (koList||[])) {
      const upd = {};

      // Risolvi home
      if (ko.note_home && !ko.home_id) {
        const sqId = _gardaRisolviPlaceholder(ko.note_home, clGlobali);
        if (sqId) upd.home_id = sqId;
      }

      // Risolvi away
      if (ko.note_away && !ko.away_id) {
        const sqId = _gardaRisolviPlaceholder(ko.note_away, clGlobali);
        if (sqId) upd.away_id = sqId;
      }

      if (Object.keys(upd).length) {
        await db.from('knockout').update(upd).eq('id', ko.id);
        risolti++;
      }
    }

    if (risolti > 0) {
      toast(`✅ ${risolti} accoppiamenti risolti!`);
      if (typeof renderAdminKnockout === 'function') await renderAdminKnockout();
      if (typeof renderTabellone === 'function') await renderTabellone();
    } else {
      // Controlla se ci sono ancora placeholder da risolvere
      const rimasti = (koList||[]).filter(ko =>
        (ko.note_home && !ko.home_id) || (ko.note_away && !ko.away_id)
      ).length;
      if (rimasti > 0) {
        toast(`⏳ ${rimasti} accoppiamenti in attesa — completa i gironi`);
      } else {
        toast('✅ Tutti gli accoppiamenti già risolti!');
      }
    }
  } catch(e) {
    console.error('Garda patch error:', e);
    toast('❌ Errore: ' + e.message);
  }
};

// Anche verificaEGeneraTriangolari viene esteso
const _verificaOrig = window.verificaEGeneraTriangolari;
window.verificaEGeneraTriangolari = async function(categoriaId) {
  if (typeof _verificaOrig === 'function') await _verificaOrig(categoriaId);

  try {
    const clGlobali = await _gardaCalcolaClassificheGlobali(categoriaId);
    if (!clGlobali.prime.length) return;

    const { data: koList } = await db.from('knockout')
      .select('id,note_home,note_away,home_id,away_id')
      .eq('categoria_id', categoriaId);

    let risolti = 0;
    for (const ko of (koList||[])) {
      const upd = {};
      if (ko.note_home && !ko.home_id) {
        const sqId = _gardaRisolviPlaceholder(ko.note_home, clGlobali);
        if (sqId) upd.home_id = sqId;
      }
      if (ko.note_away && !ko.away_id) {
        const sqId = _gardaRisolviPlaceholder(ko.note_away, clGlobali);
        if (sqId) upd.away_id = sqId;
      }
      if (Object.keys(upd).length) {
        await db.from('knockout').update(upd).eq('id', ko.id);
        risolti++;
      }
    }

    if (risolti > 0 && typeof _mostraNotificaTriangolari === 'function') {
      _mostraNotificaTriangolari();
    }
  } catch(e) {
    console.warn('Garda patch verificaEGeneraTriangolari:', e);
  }
};

console.log('✅ Garda patch caricata — Migliore/Peggior/Seconda Migliore riconosciuti');
