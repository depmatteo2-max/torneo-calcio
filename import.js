// ============================================================
//  import_garda_patch.js — PATCH GARDA v5
//  3 gironi da 4 squadre → 12 squadre totali
//  Logica placeholder ESATTA dal calendario PDF:
//
//  Prime (ordinate per punti): P1=migliore, P2=seconda, P3=peggiore
//  Seconde (ordinate per punti): S1=migliore, S2=seconda, S3=peggiore
//  Terze (ordinate per punti): T1=migliore, T2=seconda, T3=peggiore
//  Quarte (ordinate per punti): Q1=migliore, Q2=seconda, Q3=peggiore
//
//  Mappa placeholder → posizione:
//  "Migliore I"         → P1 (1ª tra le prime)
//  "Migliore II"        → P2 (2ª tra le prime)
//  "Migliore III"       → P3 (3ª tra le prime = Peggior I)
//  "Migliore IV"        → S1 (migliore seconda, con 3 gironi la IV classificata globale)
//  "Seconda Migliore I" → S1 (migliore seconda)
//  "Seconda Migliore II"→ S2 (2ª seconda)
//  "Seconda Migliore III"→ S3 (3ª seconda = Peggior II seconde)
//  "Seconda Migliore IV"→ T1 (migliore terza)
//  "Peggior I"          → P3 (peggiore prima)
//  "Peggior II"         → P2 (penultima prima)
//  "Peggior III"        → T3 (peggiore terza)
//  "Peggior Quarta"     → Q3 (peggiore quarta)
// ============================================================

window.risolviManuale = async function() {
  if (!STATE.activeCat) return;
  toast('⏳ Calcolo classifiche...');

  try {
    // ── Carica gironi ─────────────────────────────────────────
    const { data: gironiDB } = await db
      .from('gironi').select('id,nome')
      .eq('categoria_id', STATE.activeCat);
    if (!gironiDB?.length) { toast('Nessun girone trovato'); return; }

    // ── Calcola classifica di ogni girone ─────────────────────
    const cls = {}; // { 'Girone A': [row0, row1, row2, row3] }

    for (const g of gironiDB) {
      const { data: pp } = await db.from('partite')
        .select('home_id,away_id,gol_home,gol_away,giocata')
        .eq('girone_id', g.id);
      const giocate = (pp||[]).filter(p => p.giocata && p.home_id && p.away_id);
      if (!giocate.length) continue;

      const sqIds = [...new Set(giocate.flatMap(p => [p.home_id, p.away_id]))];
      const { data: sqList } = await db.from('squadre').select('id,nome,logo').in('id', sqIds);
      if (!sqList?.length) continue;

      const st = {};
      sqList.forEach(s => st[s.id] = { sq:s, g:0, v:0, p:0, s:0, gf:0, gs:0, pts:0 });
      for (const p of giocate) {
        const h=st[p.home_id], a=st[p.away_id]; if(!h||!a) continue;
        h.g++; a.g++; h.gf+=p.gol_home; h.gs+=p.gol_away; a.gf+=p.gol_away; a.gs+=p.gol_home;
        if(p.gol_home>p.gol_away){h.v++;h.pts+=3;a.s++;}
        else if(p.gol_home<p.gol_away){a.v++;a.pts+=3;h.s++;}
        else{h.p++;h.pts++;a.p++;a.pts++;}
      }
      const srt = (a,b) => b.pts!==a.pts?b.pts-a.pts:(b.gf-b.gs)!==(a.gf-a.gs)?(b.gf-b.gs)-(a.gf-a.gs):b.gf-a.gf;
      cls[g.nome] = Object.values(st).sort(srt);
    }

    const nG = Object.keys(cls).length;
    if (!nG) { toast('⏳ Inserisci prima i risultati dei gironi A, B, C'); return; }

    // ── Ranking globali per posizione ─────────────────────────
    const srt = (a,b) => b.pts!==a.pts?b.pts-a.pts:(b.gf-b.gs)!==(a.gf-a.gs)?(b.gf-b.gs)-(a.gf-a.gs):b.gf-a.gf;
    const rank = (pos) => Object.values(cls).map(cl=>cl[pos]).filter(Boolean).sort(srt);

    const P = rank(0); // prime classificate   [P1, P2, P3]
    const S = rank(1); // seconde classificate [S1, S2, S3]
    const T = rank(2); // terze classificate   [T1, T2, T3]
    const Q = rank(3); // quarte classificate  [Q1, Q2, Q3]

    // Log per debug
    console.log('[Garda] CLASSIFICHE ('+nG+' gironi):');
    console.log('  Prime:  ', P.map(r=>r.sq.nome+'('+r.pts+'pt)').join(' | '));
    console.log('  Seconde:', S.map(r=>r.sq.nome+'('+r.pts+'pt)').join(' | '));
    console.log('  Terze:  ', T.map(r=>r.sq.nome+'('+r.pts+'pt)').join(' | '));
    console.log('  Quarte: ', Q.map(r=>r.sq.nome+'('+r.pts+'pt)').join(' | '));

    // ── Mappa placeholder → ID squadra ───────────────────────
    const map = {
      // Prime
      'migliore i':             P[0]?.sq?.id,
      'migliore ii':            P[1]?.sq?.id,
      'migliore iii':           P[2]?.sq?.id,
      'migliore iv':            S[0]?.sq?.id,  // 4ª globale = miglior seconda
      // Seconde
      'seconda migliore i':     S[0]?.sq?.id,
      'seconda migliore ii':    S[1]?.sq?.id,
      'seconda migliore iii':   S[2]?.sq?.id,
      'seconda migliore iv':    T[0]?.sq?.id,  // miglior terza
      // Peggiori prime (ordine inverso)
      'peggior i':              P[P.length-1]?.sq?.id,
      'peggior ii':             P[P.length-2]?.sq?.id,
      'peggior iii':            T[T.length-1]?.sq?.id,  // peggiore terza
      'peggior quarta':         Q[Q.length-1]?.sq?.id,
      'peggior quarte':         Q[Q.length-1]?.sq?.id,
    };

    console.log('[Garda] MAPPA ACCOPPIAMENTI:');
    for (const [k,v] of Object.entries(map)) {
      if (v) {
        const sq = [...P,...S,...T,...Q].find(r=>r.sq.id===v);
        console.log('  '+k+' → '+(sq?.sq?.nome||v));
      }
    }

    // ── Aggiorna knockout ─────────────────────────────────────
    const { data: koList } = await db.from('knockout')
      .select('id,note_home,note_away,home_id,away_id')
      .eq('categoria_id', STATE.activeCat);

    let risolti = 0;
    for (const ko of (koList||[])) {
      const upd = {};
      const nh = (ko.note_home||'').trim().toLowerCase();
      const na = (ko.note_away||'').trim().toLowerCase();

      if (nh && map[nh] && map[nh] !== ko.home_id) upd.home_id = map[nh];
      if (na && map[na] && map[na] !== ko.away_id) upd.away_id = map[na];

      if (Object.keys(upd).length) {
        await db.from('knockout').update(upd).eq('id', ko.id);
        risolti++;
        console.log(`[Garda] ✓ "${ko.note_home}" vs "${ko.note_away}" risolto`);
      }
    }

    // ── Feedback ──────────────────────────────────────────────
    if (risolti > 0) {
      toast(`✅ ${risolti} accoppiamenti risolti!`);
      if (typeof _mostraNotificaTriangolari==='function') _mostraNotificaTriangolari();
      if (typeof renderAdminKnockout==='function') await renderAdminKnockout();
      if (typeof renderTabellone==='function') await renderTabellone();
    } else {
      // Debug: mostra note non risolte
      const nr = (koList||[]).filter(ko=>ko.note_home||ko.note_away);
      console.warn('[Garda] Note non risolte:');
      nr.forEach(ko => console.warn('  home="'+ko.note_home+'" away="'+ko.note_away+'" home_id='+ko.home_id+' away_id='+ko.away_id));
      toast('ℹ️ '+nG+' gironi calcolati. Apri console F12 per dettagli.');
    }

  } catch(e) {
    console.error('[Garda patch]', e);
    toast('❌ '+e.message);
  }
};

// Auto-risolvi dopo ogni salvataggio risultato
const _verificaOrig = window.verificaEGeneraTriangolari;
window.verificaEGeneraTriangolari = async function(categoriaId) {
  if (typeof _verificaOrig==='function') await _verificaOrig(categoriaId);
  if (categoriaId===STATE.activeCat) {
    try { await window.risolviManuale(); } catch(e) {}
  }
};

console.log('✅ Garda patch v5 caricata');
