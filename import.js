// ============================================================
//  import_garda_patch.js — PATCH per sistema Garda
//  Sostituisce _resolvePlaceholder con versione che gestisce:
//  Migliore I/II/III/IV, Peggior I/II/III, Seconda Migliore I/II/III
//  Peggior Quarta/Terza
// ============================================================

// Mappa romani → indice 0-based (maiuscolo e minuscolo)
const _GARDA_ROMANI = { I:0,II:1,III:2,IV:3,V:4, i:0,ii:1,iii:2,iv:3,v:4 };

// Salva la funzione originale per i placeholder che già gestisce
const _resolvePlaceholder_orig = window._resolvePlaceholder;

// Override completo di _resolvePlaceholder
window._resolvePlaceholder = function(placeholder, classificheGironi, miglioriSecondi, risultatiKnockout) {
  if (!placeholder) return null;
  const s = placeholder.trim();

  // ── Calcola miglioriSecondi/Terze/Quarte se non passati ──
  // (risolviManuale chiama con solo 2 argomenti)
  if (!miglioriSecondi || !miglioriSecondi.length) {
    miglioriSecondi = _gardaCalcolaRanking(classificheGironi, 1); // seconde
  }
  const miglioriTerze  = _gardaCalcolaRanking(classificheGironi, 2);
  const miglioriQuarte = _gardaCalcolaRanking(classificheGironi, 3);
  // Prime classificate ordinate (per Migliore I/II/III e Peggior I/II/III)
  const miglioriPrime  = _gardaCalcolaRanking(classificheGironi, 0);

  // ── "Migliore I/II/III" = 1ª/2ª/3ª tra le prime classificate ──
  // Con 3 gironi: Migliore IV = migliore seconda
  let m = s.match(/^Migliore\s+(I{1,3}|IV|V)$/i);
  if (m) {
    const key = m[1].toUpperCase();
    const idx = _GARDA_ROMANI[key];
    if (key === 'IV') return miglioriSeconde?.[0]?.sq?.id || null;
    if (idx !== undefined && miglioriPrime[idx]) return miglioriPrime[idx].sq?.id || null;
  }

  // ── "Seconda Migliore I/II/III/IV" = 1ª/2ª/3ª tra le seconde ──
  // "Seconda Migliore IV" con 3 gironi = migliore terza
  m = s.match(/^Seconda\s+Migliore\s+(I{1,3}|IV|V)$/i);
  if (m) {
    const key = m[1].toUpperCase();
    const idx = _GARDA_ROMANI[key];
    if (key === 'IV') return miglioriTerze?.[0]?.sq?.id || null;
    if (idx !== undefined && miglioriSecondi[idx]) return miglioriSecondi[idx].sq?.id || null;
  }

  // ── "Peggior I/II/III" = peggiore/penultima... tra le prime (inverso) ──
  m = s.match(/^Peggior[e]?\s+(I{1,3}|IV|V)$/i);
  if (m) {
    const idx = _GARDA_ROMANI[m[1].toUpperCase()];
    if (idx !== undefined) {
      // Peggior I = ultima delle prime, Peggior II = penultima ecc.
      const invIdx = miglioriPrime.length - 1 - idx;
      return miglioriPrime[Math.max(0, invIdx)]?.sq?.id || null;
    }
  }

  // ── "Peggior Quarta" = ultima tra le quarte ──
  if (/^Peggior[e]?\s+Quart[ae]?$/i.test(s)) {
    return miglioriQuarte[miglioriQuarte.length - 1]?.sq?.id || null;
  }

  // ── "Peggior Terza" = ultima tra le terze ──
  if (/^Peggior[e]?\s+Terz[ae]?$/i.test(s)) {
    return miglioriTerze[miglioriTerze.length - 1]?.sq?.id || null;
  }

  // ── Tutti gli altri placeholder: usa la funzione originale ──
  if (typeof _resolvePlaceholder_orig === 'function') {
    return _resolvePlaceholder_orig(placeholder, classificheGironi, miglioriSecondi, risultatiKnockout || {});
  }

  return null;
};

// Funzione helper: calcola ranking globale per posizione
// pos=0 → prime classificate, pos=1 → seconde, pos=2 → terze, pos=3 → quarte
function _gardaCalcolaRanking(classificheGironi, pos) {
  const sortFn = (a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const dA = a.gf - a.gs, dB = b.gf - b.gs;
    if (dB !== dA) return dB - dA;
    return b.gf - a.gf;
  };
  const lista = [];
  for (const [nome, cl] of Object.entries(classificheGironi || {})) {
    if (cl && cl[pos] && cl[pos].sq && cl[pos].g > 0) {
      lista.push(cl[pos]);
    }
  }
  return lista.sort(sortFn);
}

// Variabile locale per riferimento interno
let miglioriSeconde = [];

console.log('✅ Garda patch caricata — Migliore/Peggior/Seconda Migliore riconosciuti');
