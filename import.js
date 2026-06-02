// ============================================================
//  import_garda_patch.js
//  Aggiunge al sistema Garda la risoluzione automatica dei
//  placeholder: Migliore I/II, Peggior I, Seconda Migliore I ecc.
//  Da caricare DOPO import.js nel sito Garda
// ============================================================

// ── Estende _isPlaceholder per riconoscere i placeholder Garda ──
const _isPlaceholder_base = window._isPlaceholder || function(){ return false; };
window._isPlaceholder = function(nome) {
  if (_isPlaceholder_base(nome)) return true;
  if (!nome) return false;
  const s = nome.trim();
  if (/^(Migliore|Peggior[e]?)\s+(I{1,3}V?|IV|V)$/i.test(s)) return true;
  if (/^Seconda\s+Migliore\s+(I{1,3}V?|IV|V)$/i.test(s)) return true;
  if (/^Peggior[e]?\s+(Quart[ae]?|Terz[ae]?)$/i.test(s)) return true;
  return false;
};

// ── Mappa romani → indice 0-based ──
const _ROMANI = { I:0, II:1, III:2, IV:3, V:4 };

// ── Calcola classifiche globali da tutti i gironi ──
function _calcolaClassificheGardaGlobali(gironi) {
  const sortFn = (a,b) => {
    if (b.pts!==a.pts) return b.pts-a.pts;
    const dA=a.gf-a.gs, dB=b.gf-b.gs;
    if (dB!==dA) return dB-dA;
    return b.gf-a.gf;
  };
  const prime=[], seconde=[], terze=[], quarte=[];

  for (const g of gironi) {
    const sqMap={};
    for (const p of g.partite||[]) {
      if (p.home?.id && p.home.nome && !window._isPlaceholder(p.home.nome)) sqMap[p.home.id]=p.home;
      if (p.away?.id && p.away.nome && !window._isPlaceholder(p.away.nome)) sqMap[p.away.id]=p.away;
    }
    const sq = Object.values(sqMap);
    if (sq.length < 2) continue;
    if (typeof calcGironeClassifica !== 'function') continue;
    const cl = calcGironeClassifica({squadre:sq, partite:g.partite||[]});
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

// ── Risolve un placeholder Garda in squadra reale ──
function _risolviPlaceholderGarda(placeholder, clGlobali) {
  if (!placeholder || !clGlobali) return null;
  const s = placeholder.trim();
  const { prime, seconde, terze, quarte } = clGlobali;

  // "Migliore I/II/III" = 1ª/2ª/3ª tra le prime
  let m = s.match(/^Migliore\s+(I{1,3}|IV|V)$/i);
  if (m) {
    const idx = _ROMANI[m[1].toUpperCase()];
    if (idx !== undefined && prime[idx]) return prime[idx].sq;
  }

  // "Migliore IV" con 3 gironi = migliore seconda
  if (/^Migliore\s+IV$/i.test(s)) return seconde[0]?.sq || null;

  // "Seconda Migliore I/II/III/IV" = 1ª/2ª/3ª tra le seconde
  m = s.match(/^Seconda\s+Migliore\s+(I{1,3}|IV|V)$/i);
  if (m) {
    const idx = _ROMANI[m[1].toUpperCase()];
    if (idx !== undefined && seconde[idx]) return seconde[idx].sq;
  }

  // "Peggior I" = peggiore tra le prime (ultima)
  m = s.match(/^Peggior[e]?\s+(I{1,3}|IV|V)$/i);
  if (m) {
    const idx = _ROMANI[m[1].toUpperCase()];
    if (idx !== undefined) {
      // Peggior I = ultima, Peggior II = penultima ecc.
      const invIdx = prime.length - 1 - idx;
      return prime[Math.max(0, invIdx)]?.sq || null;
    }
  }

  // "Peggior Quarta" = ultima tra le quarte
  if (/^Peggior[e]?\s+Quart[ae]?$/i.test(s)) return quarte[quarte.length-1]?.sq || null;

  // "Peggior Terza" = ultima tra le terze
  if (/^Peggior[e]?\s+Terz[ae]?$/i.test(s)) return terze[terze.length-1]?.sq || null;

  return null;
}

// ── Hook nel ciclo di risoluzione accoppiamenti ──
// Estende verificaEGeneraTriangolari per usare i placeholder Garda
const _verificaOrig = window.verificaEGeneraTriangolari;
window.verificaEGeneraTriangolari = async function(categoriaId) {
  // Prima esegui la logica originale
  if (typeof _verificaOrig === 'function') await _verificaOrig(categoriaId);

  // Poi risolvi i placeholder Garda nel knockout
  try {
    if (!categoriaId || typeof db === 'undefined') return;
    if (typeof getGironiWithData !== 'function') return;

    const gironi = await getGironiWithData(categoriaId);
    const clGlobali = _calcolaClassificheGardaGlobali(gironi);

    // Controlla se ci sono abbastanza risultati
    const totGironi = gironi.filter(g => !/classif/i.test(g.nome)).length;
    const gironiCompleti = gironi.filter(g =>
      !/classif/i.test(g.nome) &&
      g.partite.length > 0 &&
      g.partite.every(p => p.giocata)
    ).length;

    if (gironiCompleti < totGironi) return; // Aspetta che tutti i gironi siano completati

    const { data: koList } = await db.from('knockout')
      .select('id,note_home,note_away,home_id,away_id,giocata')
      .eq('categoria_id', categoriaId);

    let aggiornati = 0;
    for (const ko of (koList||[])) {
      const upd = {};
      if (ko.note_home && window._isPlaceholder(ko.note_home) && !ko.home_id) {
        const sq = _risolviPlaceholderGarda(ko.note_home, clGlobali);
        if (sq?.id) upd.home_id = sq.id;
      }
      if (ko.note_away && window._isPlaceholder(ko.note_away) && !ko.away_id) {
        const sq = _risolviPlaceholderGarda(ko.note_away, clGlobali);
        if (sq?.id) upd.away_id = sq.id;
      }
      if (Object.keys(upd).length) {
        await db.from('knockout').update(upd).eq('id', ko.id);
        aggiornati++;
      }
    }

    if (aggiornati > 0) {
      console.log(`✅ Garda patch: ${aggiornati} accoppiamenti risolti`);
      if (typeof toast === 'function') toast(`✅ ${aggiornati} accoppiamenti aggiornati!`);
      if (typeof _cacheClear === 'function') _cacheClear();
    }
  } catch(e) {
    console.warn('Garda patch error:', e);
  }
};

// ── Bottone manuale per forzare risoluzione ──
window._forzaRisoluzioneGarda = async function() {
  if (!STATE?.activeCat) { alert('Seleziona una categoria'); return; }
  if (typeof toast === 'function') toast('⏳ Risoluzione accoppiamenti...');
  await window.verificaEGeneraTriangolari(STATE.activeCat);
  if (typeof renderAdminKnockout === 'function') await renderAdminKnockout();
  if (typeof renderTabellone === 'function') await renderTabellone();
};

console.log('✅ Garda patch caricata — placeholder Migliore/Peggior riconosciuti');
