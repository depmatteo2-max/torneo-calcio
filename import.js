// ============================================================
//  import_garda_patch.js — PATCH per sistema Garda
//  Legge classifiche direttamente dal DB e risolve:
//  Migliore I/II/III, Peggior I/II, Seconda Migliore I/II/III
// ============================================================

// Override risolviManuale — legge dal DB direttamente
const _risolviManuale_orig = window.risolviManuale;

window.risolviManuale = async function() {
  if (!STATE.activeCat) return;
  toast('⏳ Calcolo classifiche e risoluzione...');

  try {
    // 1. Carica tutti i gironi della categoria
    const { data: gironiDB } = await db.from('gironi')
      .select('id,nome')
      .eq('categoria_id', STATE.activeCat);
    if (!gironiDB?.length) { toast('Nessun girone trovato'); return; }

    // 2. Per ogni girone calcola la classifica leggendo le partite giocate
    const classifiche = {}; // { 'Girone A': [{sq, pts, gf, gs, ...}], ... }

    for (const g of gironiDB) {
      // Prendi le partite giocate
      const { data: partite } = await db.from('partite')
        .select('id,home_id,away_id,gol_home,gol_away,giocata')
        .eq('girone_id', g.id);

      const giocate = (partite || []).filter(p => p.giocata && p.home_id && p.away_id);
      if (!giocate.length) continue;

      // Raccoglie ID squadre dalle partite giocate
      const sqIds = new Set();
      giocate.forEach(p => { sqIds.add(p.home_id); sqIds.add(p.away_id); });

      // Carica dati squadre
      const { data: sqList } = await db.from('squadre')
        .select('id,nome,logo')
        .in('id', [...sqIds]);
      if (!sqList?.length) continue;

      const sqMap = {};
      sqList.forEach(s => sqMap[s.id] = s);

      // Calcola classifica manualmente
      const stats = {};
      sqList.forEach(s => {
        stats[s.id] = { sq: s, g: 0, v: 0, p: 0, s: 0, gf: 0, gs: 0, pts: 0 };
      });

      for (const p of giocate) {
        const h = stats[p.home_id];
        const a = stats[p.away_id];
        if (!h || !a) continue;
        h.g++; a.g++;
        h.gf += p.gol_home; h.gs += p.gol_away;
        a.gf += p.gol_away; a.gs += p.gol_home;
        if (p.gol_home > p.gol_away) { h.v++; h.pts += 3; a.s++; }
        else if (p.gol_home < p.gol_away) { a.v++; a.pts += 3; h.s++; }
        else { h.p++; h.pts++; a.p++; a.pts++; }
      }

      // Ordina per punti → diff reti → gol fatti
      const lista = Object.values(stats).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        const dA = a.gf - a.gs, dB = b.gf - b.gs;
        if (dB !== dA) return dB - dA;
        return b.gf - a.gf;
      });

      classifiche[g.nome] = lista;
      console.log(`[Garda] ${g.nome}: ${lista.map(r => r.sq.nome + '(' + r.pts + 'pt)').join(', ')}`);
    }

    const nGironi = Object.keys(classifiche).length;
    if (nGironi === 0) {
      toast('⏳ Inserisci prima i risultati dei gironi A, B, C');
      return;
    }

    // 3. Calcola ranking globali
    const sortFn = (a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const dA = a.gf - a.gs, dB = b.gf - b.gs;
      if (dB !== dA) return dB - dA;
      return b.gf - a.gf;
    };

    const prime   = Object.values(classifiche).filter(cl => cl[0]).map(cl => cl[0]).sort(sortFn);
    const seconde = Object.values(classifiche).filter(cl => cl[1]).map(cl => cl[1]).sort(sortFn);
    const terze   = Object.values(classifiche).filter(cl => cl[2]).map(cl => cl[2]).sort(sortFn);
    const quarte  = Object.values(classifiche).filter(cl => cl[3]).map(cl => cl[3]).sort(sortFn);

    console.log('[Garda] Prime:', prime.map(r => r.sq.nome + '(' + r.pts + 'pt)').join(', '));
    console.log('[Garda] Seconde:', seconde.map(r => r.sq.nome + '(' + r.pts + 'pt)').join(', '));
    console.log('[Garda] Terze:', terze.map(r => r.sq.nome + '(' + r.pts + 'pt)').join(', '));
    console.log('[Garda] Quarte:', quarte.map(r => r.sq.nome + '(' + r.pts + 'pt)').join(', '));

    // 4. Funzione di risoluzione placeholder
    const risolvi = (placeholder) => {
      if (!placeholder) return null;
      const s = placeholder.trim();
      const ROMANI = { I:0, II:1, III:2, IV:3, V:4 };
      const toIdx = (str) => ROMANI[str.toUpperCase()] ?? -1;

      // "Migliore I/II/III" = prime classificate ordinate
      let m = s.match(/^Migliore\s+(I{1,3}|IV|V)$/i);
      if (m) {
        const idx = toIdx(m[1]);
        // Con 3 gironi: Migliore IV = migliore seconda
        if (m[1].toUpperCase() === 'IV') return seconde[0]?.sq?.id || null;
        return prime[idx]?.sq?.id || null;
      }

      // "Seconda Migliore I/II/III/IV" = seconde classificate ordinate
      m = s.match(/^Seconda\s+Migliore\s+(I{1,3}|IV|V)$/i);
      if (m) {
        const idx = toIdx(m[1]);
        if (m[1].toUpperCase() === 'IV') return terze[0]?.sq?.id || null;
        return seconde[idx]?.sq?.id || null;
      }

      // "Peggior I/II/III" = peggiori tra le prime (ordine inverso)
      m = s.match(/^Peggior[e]?\s+(I{1,3}|IV|V)$/i);
      if (m) {
        const idx = toIdx(m[1]);
        const invIdx = prime.length - 1 - idx;
        return prime[Math.max(0, invIdx)]?.sq?.id || null;
      }

      // "Peggior Quarta"
      if (/^Peggior[e]?\s+Quart[ae]?$/i.test(s)) {
        return quarte[quarte.length - 1]?.sq?.id || null;
      }

      // "Peggior Terza"
      if (/^Peggior[e]?\s+Terz[ae]?$/i.test(s)) {
        return terze[terze.length - 1]?.sq?.id || null;
      }

      // Placeholder originali Garda: "N° Girone X", "Vincente SEMIFINALE XX" ecc.
      if (typeof _resolvePlaceholder === 'function') {
        const miglioriSecondi = seconde.map(r => ({ sq: r.sq, stat: r }));
        return _resolvePlaceholder(placeholder, classifiche, miglioriSecondi, {});
      }

      return null;
    };

    // 5. Aggiorna knockout
    const { data: koList } = await db.from('knockout')
      .select('id,note_home,note_away,home_id,away_id')
      .eq('categoria_id', STATE.activeCat);

    let risolti = 0;
    for (const ko of (koList || [])) {
      const upd = {};

      if (ko.note_home && !ko.home_id) {
        const sqId = risolvi(ko.note_home);
        if (sqId) { upd.home_id = sqId; console.log(`[Garda] ${ko.note_home} → ${sqId}`); }
      }
      if (ko.note_away && !ko.away_id) {
        const sqId = risolvi(ko.note_away);
        if (sqId) { upd.away_id = sqId; console.log(`[Garda] ${ko.note_away} → ${sqId}`); }
      }

      if (Object.keys(upd).length) {
        await db.from('knockout').update(upd).eq('id', ko.id);
        risolti++;
      }
    }

    if (risolti > 0) {
      toast(`✅ ${risolti} accoppiamenti risolti!`);
      if (typeof _mostraNotificaTriangolari === 'function') _mostraNotificaTriangolari();
      if (typeof renderAdminKnockout === 'function') await renderAdminKnockout();
      if (typeof renderTabellone === 'function') await renderTabellone();
    } else {
      // Mostra debug info
      const pendenti = (koList || []).filter(ko =>
        (ko.note_home && !ko.home_id) || (ko.note_away && !ko.away_id)
      );
      console.log('[Garda] Pendenti non risolti:', pendenti.map(ko =>
        `"${ko.note_home}" vs "${ko.note_away}"`
      ));
      toast(`ℹ️ ${nGironi} gironi calcolati, ${pendenti.length} accoppiamenti ancora in attesa`);
    }

  } catch(e) {
    console.error('[Garda patch] Errore:', e);
    toast('❌ Errore: ' + e.message);
  }
};

// Estende anche verificaEGeneraTriangolari per auto-risolvere dopo ogni risultato
const _verificaOrig = window.verificaEGeneraTriangolari;
window.verificaEGeneraTriangolari = async function(categoriaId) {
  if (typeof _verificaOrig === 'function') await _verificaOrig(categoriaId);
  // Dopo la verifica originale, prova a risolvere i placeholder Garda
  if (categoriaId === STATE.activeCat) {
    try { await window.risolviManuale(); } catch(e) {}
  }
};

console.log('✅ Garda patch v3 caricata — legge classifiche dal DB');
