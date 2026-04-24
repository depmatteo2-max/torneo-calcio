const ROUND_META = {
  'PLATINO'              : { order: 0,  consolazione: false, emoji: '🥇', desc: '1° classificate' },
  'GOLD'                 : { order: 1,  consolazione: false, emoji: '🥈', desc: '2° classificate' },
  'SILVER'               : { order: 2,  consolazione: true,  emoji: '🥉', desc: '3° classificate' },
  'BRONZO'               : { order: 3,  consolazione: true,  emoji: '🏅', desc: '4° classificate' },
  'WHITE'                : { order: 4,  consolazione: true,  emoji: '⬜', desc: '5° classificate' },
  'ARANCIO'              : { order: 5,  consolazione: false, emoji: '🟠', desc: 'Fase Arancio' },
  'VERDE'                : { order: 6,  consolazione: false, emoji: '🟢', desc: 'Fase Verde' },
  'BLU'                  : { order: 7,  consolazione: false, emoji: '🔵', desc: 'Fase Blu' },
  'GIRONE 1'             : { order: 8,  consolazione: false, emoji: '1️⃣', desc: 'Girone 1' },
  'GIRONE 2'             : { order: 9,  consolazione: false, emoji: '2️⃣', desc: 'Girone 2' },
  'FINALE SILVER 1-2 POSTO': { order: 10, consolazione: true,  emoji: '🥈', desc: 'Finale Silver 1°-2°' },
  'FINALE SILVER 3-4 POSTO': { order: 11, consolazione: true,  emoji: '🥉', desc: 'Finale Silver 3°-4°' },
  'FINALE GOLD 1-2 POSTO'  : { order: 12, consolazione: false, emoji: '🥇', desc: 'Finale Gold 1°-2°' },
  'FINALE GOLD 3-4 POSTO'  : { order: 13, consolazione: false, emoji: '🏅', desc: 'Finale Gold 3°-4°' },
  'SEMIFINALE 01'        : { order: 14, consolazione: false, emoji: '⚔️', desc: 'Semifinale 1' },
  'SEMIFINALE 02'        : { order: 15, consolazione: false, emoji: '⚔️', desc: 'Semifinale 2' },
  'SEMIFINALE 03'        : { order: 16, consolazione: false, emoji: '⚔️', desc: 'Semifinale 3' },
  'SEMIFINALE 04'        : { order: 17, consolazione: false, emoji: '⚔️', desc: 'Semifinale 4' },
  'FINALE 1-2 POSTO'     : { order: 18, consolazione: false, emoji: '🏆', desc: 'Finale 1°-2°' },
  'FINALE 3-4 POSTO'     : { order: 19, consolazione: true,  emoji: '🥉', desc: 'Finale 3°-4°' },
  'FINALE 5-6 POSTO'     : { order: 20, consolazione: true,  emoji: '🎖️', desc: 'Finale 5°-6°' },
  'FINALE 7-8 POSTO'     : { order: 21, consolazione: true,  emoji: '🎖️', desc: 'Finale 7°-8°' },
  'FINALE 9-10 POSTO'    : { order: 22, consolazione: true,  emoji: '🎖️', desc: 'Finale 9°-10°' },
  'FINALE 11-12 POSTO'   : { order: 23, consolazione: true,  emoji: '🎖️', desc: 'Finale 11°-12°' },
};

function _getRoundMeta(roundRaw) {
  const r = roundRaw.toUpperCase().trim();
  if (ROUND_META[r]) return { key: r, meta: ROUND_META[r] };
  if (/^FINALE\s+\d+[-–]\d+\s+POSTO$/.test(r)) return { key: r, meta: { order: 30, consolazione: true, emoji: '🎖️', desc: r } };
  if (/^SEMIFINALE\s+\d+$/.test(r)) return { key: r, meta: { order: 14, consolazione: false, emoji: '⚔️', desc: r } };
  return null;
}

const ROUND_COLORS = {
  'PLATINO': '#FFD700', 'GOLD': '#FFA500', 'SILVER': '#C0C0C0',
  'BRONZO': '#CD7F32', 'WHITE': '#B0BEC5',
  'ARANCIO': '#FF8C00', 'VERDE': '#4CAF50', 'BLU': '#2196F3',
  'GIRONE 1': '#90CAF9', 'GIRONE 2': '#A5D6A7',
  'FINALE SILVER 1-2 POSTO': '#A9D18E', 'FINALE SILVER 3-4 POSTO': '#C8E6C9',
  'FINALE GOLD 1-2 POSTO': '#FFD700',   'FINALE GOLD 3-4 POSTO': '#FFE082',
  'SEMIFINALE 01': '#90CAF9', 'SEMIFINALE 02': '#90CAF9',
  'SEMIFINALE 03': '#90CAF9', 'SEMIFINALE 04': '#90CAF9',
  'FINALE 1-2 POSTO': '#FFD700', 'FINALE 3-4 POSTO': '#CD7F32',
  'FINALE 5-6 POSTO': '#B0BEC5', 'FINALE 7-8 POSTO': '#B0BEC5',
  'FINALE 9-10 POSTO': '#CFD8DC', 'FINALE 11-12 POSTO': '#ECEFF1',
};

function _isPlaceholder(nome) {
  if (!nome) return false;
  const n = nome.trim();
  if (/^\d+[°oa*]\s+(Girone|GIR\.?|GIRONE)/i.test(n)) return true;
  if (/^(Vincente|Perdente)\s+SEMIFINALE\s+\d+/i.test(n)) return true;
  if (/^(Vincente|Perdente)\s+(GOLD|SILVER|PLATINO|BRONZO|ARANCIO|VERDE|BLU)/i.test(n)) return true;
  if (/^\d+\s+(SILVER|GOLD|PLATINO|BRONZO|ARANCIO|VERDE|BLU)\s+\d+$/i.test(n)) return true;
  if (/^\d+[°oa*]?\s*(Arancio|Verde|Blu)$/i.test(n)) return true;
  if (/^(MIGLIOR|PEGGIOR)\s+(SECONDA|TERZA|QUARTA)/i.test(n)) return true;
  if (/^(SECONDA|TERZA|QUARTA)\s*\d*$/i.test(n)) return true;
  return false;
}

async function importaExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  const preview = document.getElementById('import-preview');
  preview.innerHTML = '<div style="padding:16px;color:#888;font-size:13px;">⏳ Lettura file in corso...</div>';
  try {
    if (typeof XLSX === 'undefined') {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf, { type: 'array' });
    const dati = {
      categorie : leggiCategorie(wb),
      gironi    : leggiGironi(wb),
      partite   : leggiPartiteFase1(wb),
      fase2     : leggiPartiteFase2(wb)
    };
    if (!dati.categorie.length) {
      preview.innerHTML = '<div style="padding:16px;color:#c00;">❌ Nessuna categoria trovata. Controlla il foglio CATEGORIE.</div>';
      return;
    }
    mostraAnteprima(dati, preview);
  } catch (e) {
    console.error('Errore import:', e);
    preview.innerHTML = `<div style="padding:16px;color:#c00;">❌ Errore lettura: ${e.message}</div>`;
  }
}

function trovaRigaHeader(rows, keywords) {
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const joined = rows[i].map(c => String(c||'').toUpperCase()).join('|');
    if (keywords.every(kw => joined.includes(kw.toUpperCase()))) return i;
  }
  return 0;
}

function col(obj, ...keywords) {
  for (const kw of keywords) {
    const k = Object.keys(obj).find(k => k.toUpperCase().includes(kw.toUpperCase()));
    if (k !== undefined && String(obj[k]||'').trim() !== '') return String(obj[k]).trim();
  }
  return '';
}

function leggiCategorie(wb) {
  const ws = wb.Sheets['CATEGORIE'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const hi   = trovaRigaHeader(rows, ['CATEGORIA']);
  const hdrs = rows[hi].map(h => String(h||'').trim());
  const iCat  = hdrs.findIndex(h => h.toUpperCase().includes('CATEGORIA') || h.toUpperCase() === 'NOME');
  const iQual = hdrs.findIndex(h => h.toUpperCase().includes('QUALIFICATE') || h.toUpperCase().includes('QUAL'));
  const iForm = hdrs.findIndex(h => h.toUpperCase().includes('FORMATO'));
  return rows.slice(hi + 1)
    .filter(r => {
      const cat = String(r[iCat >= 0 ? iCat : 0]||'').trim();
      return cat && !cat.toUpperCase().includes('SPAREGGIO') && !cat.startsWith('ℹ') && !cat.startsWith('*');
    })
    .map(r => {
      const codice = String(r[iCat >= 0 ? iCat : 0]||'').trim();
      return {
        codice,
        nome       : codice,
        qualificate: parseInt(String(r[iQual >= 0 ? iQual : 1]||'')) || 1,
        formato    : String(r[iForm >= 0 ? iForm : 2]||'').trim() || 'triangolare'
      };
    });
}

function leggiGironi(wb) {
  const ws = wb.Sheets['GIRONI'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const hi   = trovaRigaHeader(rows, ['CATEGORIA', 'GIRONE']);
  const hdrs = rows[hi].map(h => String(h||'').trim().toUpperCase());

  // Trova indici colonne
  const iCat = hdrs.findIndex(h => h.includes('CATEGORIA') || h === 'NOME');
  const iGir = hdrs.findIndex(h => h.includes('GIRONE'));
  const iSq  = hdrs.findIndex(h => h.includes('SQUADRA'));

  // Se c'è colonna SQUADRA esplicita → una squadra per riga
  if (iSq >= 0) {
    const righe = rows.slice(hi + 1).filter(r => {
      const cat = String(r[iCat >= 0 ? iCat : 0]||'').trim();
      const gir = String(r[iGir >= 0 ? iGir : 1]||'').trim();
      const sq  = String(r[iSq]||'').trim();
      return cat && gir && sq && !cat.startsWith('ℹ') && !cat.startsWith('—');
    });

    // Raggruppa per categoria+girone
    const map = {};
    for (const r of righe) {
      const cat = String(r[iCat >= 0 ? iCat : 0]||'').trim();
      const gir = String(r[iGir >= 0 ? iGir : 1]||'').trim();
      const sq  = String(r[iSq]||'').trim();
      const key = `${cat}||${gir}`;
      if (!map[key]) map[key] = { categoria: cat, nome: gir, squadre: [] };
      if (sq && !sq.startsWith('ℹ')) map[key].squadre.push(sq);
    }
    return Object.values(map).filter(g => g.nome && g.squadre.length > 0);
  }

  // Fallback: squadre in colonne dalla 2 in poi (formato vecchio)
  return rows.slice(hi + 1)
    .filter(r => {
      const cat = String(r[0]||'').trim();
      const gir = String(r[1]||'').trim();
      return cat && gir && !cat.startsWith('ℹ') && !cat.startsWith('—');
    })
    .map(r => {
      const squadre = [];
      for (let i = 2; i < r.length; i++) {
        const s = String(r[i]||'').trim();
        if (s && !s.startsWith('ℹ') && isNaN(Number(s))) squadre.push(s);
      }
      return { categoria: String(r[0]||'').trim(), nome: String(r[1]||'').trim(), squadre };
    })
    .filter(g => g.nome && g.squadre.length > 0);
}

function leggiPartiteFase1(wb) {
  const ws = wb.Sheets['PARTITE_FASE1'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const hi   = trovaRigaHeader(rows, ['CATEGORIA', 'GIRONE']);
  const hdrs = rows[hi].map(h => String(h||'').trim());
  const iCat   = hdrs.findIndex(h => h.toUpperCase().includes('CATEGORIA'));
  const iGir   = hdrs.findIndex(h => h.toUpperCase().includes('GIRONE'));
  const iOra   = hdrs.findIndex(h => h.toUpperCase().includes('ORARIO') || h.toUpperCase() === 'ORA');
  const iGior  = hdrs.findIndex(h => h.toUpperCase().includes('GIORNO') || h.toUpperCase().includes('DATA'));
  const iCampo = hdrs.findIndex(h => h.toUpperCase().includes('CAMPO'));
  const iGiorn = hdrs.findIndex(h => h.toUpperCase().includes('GIORNATA'));
  let iHome = hdrs.findIndex(h => h.toUpperCase().includes('CASA') || h.toUpperCase().includes('HOME'));
  let iAway = hdrs.findIndex(h => h.toUpperCase().includes('OSPITE') || h.toUpperCase().includes('AWAY') || h.toUpperCase().includes('TRASFERTA'));
  if (iHome < 0) iHome = 2;
  if (iAway < 0) iAway = 3;
  return rows.slice(hi + 1)
    .filter(r => {
      const cat  = String(r[iCat >= 0 ? iCat : 0]||'').trim();
      const home = String(r[iHome]||'').trim();
      const away = String(r[iAway]||'').trim();
      return cat && !cat.startsWith('—') && !cat.startsWith('-') && !cat.startsWith('ℹ') && home && away;
    })
    .map(r => ({
      categoria: String(r[iCat  >= 0 ? iCat  : 0]||'').trim(),
      girone   : String(r[iGir  >= 0 ? iGir  : 1]||'').trim(),
      home     : String(r[iHome]||'').trim(),
      away     : String(r[iAway]||'').trim(),
      orario   : iOra   >= 0 ? String(r[iOra]  ||'').trim() : '',
      giorno   : iGior  >= 0 ? String(r[iGior] ||'').trim() : '',
      campo    : iCampo >= 0 ? String(r[iCampo]||'').trim() : '',
      giornata : iGiorn >= 0 ? String(r[iGiorn]||'').trim() : '',
    }));
}

function leggiPartiteFase2(wb) {
  const ws = wb.Sheets['FASE_FINALE'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const hi   = trovaRigaHeader(rows, ['CATEGORIA', 'ROUND']);
  const hdrs = rows[hi].map(h => String(h||'').trim());
  return rows.slice(hi + 1)
    .map((r, idx) => {
      const obj = {};
      hdrs.forEach((h, i) => { if (h) obj[h] = String(r[i]||'').trim(); });
      return { obj, idx };
    })
    .filter(({ obj }) => {
      const cat   = col(obj, 'CATEGORIA');
      const round = col(obj, 'ROUND').toUpperCase().trim();
      return cat && !cat.toUpperCase().includes('LEGENDA') && _getRoundMeta(round) !== null;
    })
    .map(({ obj, idx }) => {
      const roundRaw = col(obj, 'ROUND').toUpperCase().trim();
      const { key, meta } = _getRoundMeta(roundRaw);
      return {
        categoria   : col(obj, 'CATEGORIA'),
        round       : key,
        roundLabel  : `${meta.emoji} ${key} — ${meta.desc}`,
        roundOrder  : meta.order,
        matchOrder  : idx,
        consolazione: meta.consolazione,
        orario      : col(obj, 'ORARIO', 'ORA'),
        campo       : col(obj, 'CAMPO'),
        giorno      : col(obj, 'GIORNO', 'DATA', 'GIORNATA'),
        sq1raw      : col(obj, 'SQUADRA_CASA', 'SQUADRA CASA', 'CASA', 'HOME'),
        sq2raw      : col(obj, 'SQUADRA_TRASFERTA', 'SQUADRA OSPITE', 'TRASFERTA', 'OSPITE', 'AWAY'),
      };
    });
}

function mostraAnteprima(dati, container) {
  window._importDati = dati;
  const girCat = {};
  const p1Cat  = {};
  const p2Cat  = {};
  dati.gironi.forEach(g  => { (girCat[g.categoria] = girCat[g.categoria]||[]).push(g); });
  dati.partite.forEach(p => { (p1Cat[p.categoria]  = p1Cat[p.categoria] ||[]).push(p); });
  dati.fase2.forEach(p   => { (p2Cat[p.categoria]  = p2Cat[p.categoria] ||[]).push(p); });
  let html = `
    <div style="margin-top:20px;border:1px solid #ddd;border-radius:10px;overflow:hidden;">
      <div style="background:#E85C00;color:white;padding:14px 18px;font-size:15px;font-weight:700;">
        📋 Anteprima importazione — controlla e conferma
      </div>
      <div style="padding:16px;">`;
  dati.categorie.forEach(cat => {
    const gironi  = girCat[cat.codice] || [];
    const partite = p1Cat[cat.codice]  || [];
    const fase2   = p2Cat[cat.codice]  || [];
    const totSq   = gironi.reduce((s, g) => s + g.squadre.length, 0);
    const roundsPresenti = [...new Set(fase2.map(p => p.round))].sort((a, b) => {
      const ma = _getRoundMeta(a); const mb = _getRoundMeta(b);
      return (ma?.meta?.order||99) - (mb?.meta?.order||99);
    });
    html += `
      <div style="margin-bottom:16px;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
        <div style="background:#111;color:#E85C00;padding:10px 14px;font-weight:700;font-size:14px;">
          📁 ${cat.nome}
        </div>
        <div style="padding:12px 14px;font-size:13px;">
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
            <span style="background:#fff3e0;border:1px solid #ffcc80;padding:3px 10px;border-radius:20px;">🏟 <b>${gironi.length}</b> gironi</span>
            <span style="background:#fff3e0;border:1px solid #ffcc80;padding:3px 10px;border-radius:20px;">👥 <b>${totSq}</b> squadre</span>
            <span style="background:#fff3e0;border:1px solid #ffcc80;padding:3px 10px;border-radius:20px;">⚽ <b>${partite.length}</b> partite gironi</span>
            <span style="background:#fff3e0;border:1px solid #ffcc80;padding:3px 10px;border-radius:20px;">🏆 <b>${fase2.length}</b> partite finali</span>
          </div>`;
    gironi.forEach(g => {
      html += `<div style="display:inline-block;background:#f5f5f5;border-radius:6px;padding:4px 10px;margin:2px;font-size:12px;">
        <b>${g.nome}</b>: ${g.squadre.join(' · ')}
      </div>`;
    });
    if (roundsPresenti.length) {
      html += `<div style="border-top:1px solid #eee;margin-top:10px;padding-top:10px;">
        <div style="font-weight:700;color:#E85C00;margin-bottom:6px;">🔁 Fase finale:</div>`;
      roundsPresenti.forEach(rnd => {
        const rm   = _getRoundMeta(rnd);
        const meta = rm?.meta || {};
        const colr = ROUND_COLORS[rnd] || '#999';
        const pRnd = fase2.filter(p => p.round === rnd);
        html += `<div style="margin-bottom:5px;padding:6px 10px;border-radius:6px;border-left:4px solid ${colr};background:#fafafa;font-size:12px;">
          <b>${meta.emoji||''} ${rnd}</b> (${pRnd.length} partite):
          ${pRnd.map(p => `${p.sq1raw} vs ${p.sq2raw}${p.orario?' <em>'+p.orario+'</em>':''}${p.campo?' ['+p.campo+']':''}`).join(' · ')}
        </div>`;
      });
      html += `</div>`;
    }
    html += `</div></div>`;
  });
  html += `
    <div style="margin-top:12px;padding:10px 14px;background:#fff3e0;border-radius:8px;font-size:12px;color:#bf360c;">
      ℹ️ <b>Questa importazione AGGIUNGE le categorie</b> al torneo attivo senza cancellare quelle già presenti.
    </div>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
      <button onclick="confermaImportazione()"
        style="background:#E85C00;color:white;border:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">
        ✓ Aggiungi al torneo
      </button>
      <button onclick="document.getElementById('import-preview').innerHTML=''"
        style="background:#e0e0e0;color:#333;border:none;padding:12px 20px;border-radius:8px;font-size:14px;cursor:pointer;">
        Annulla
      </button>
    </div>
  </div></div>`;
  container.innerHTML = html;
}

async function confermaImportazione() {
  const dati = window._importDati;
  if (!dati) return;
  const btn = document.querySelector('button[onclick="confermaImportazione()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Importazione in corso...'; }
  try {
    const { data: tornei } = await db.from('tornei').select('id, nome')
      .eq('cliente', CONFIG.CLIENTE || 'spe')
      .eq('attivo', true).order('created_at', { ascending: false });
    if (!tornei?.length) throw new Error('Nessun torneo attivo. Crea prima un torneo.');
    let torneoId = null;
    if (tornei.length === 1) {
      torneoId = tornei[0].id;
    } else {
      const preview = document.getElementById('import-preview');
      const optionsHtml = tornei.map(t =>
        `<button onclick="window._selectedTorneoId=${t.id};document.getElementById('torneo-select-box').remove();eseguiImportazione();"
          style="display:block;width:100%;text-align:left;padding:12px 16px;margin-bottom:8px;
                 background:white;border:2px solid #e0e0e0;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;font-family:inherit;"
          onmouseover="this.style.borderColor='#E85C00'" onmouseout="this.style.borderColor='#e0e0e0'">
          📁 ${t.nome}
        </button>`
      ).join('');
      const box = document.createElement('div');
      box.id = 'torneo-select-box';
      box.style.cssText = 'margin-top:16px;padding:16px;background:#fff8e6;border:1px solid #f39c12;border-radius:8px;';
      box.innerHTML = `<div style="font-size:14px;font-weight:700;color:#e67e22;margin-bottom:12px;">
        In quale torneo vuoi importare?</div>${optionsHtml}
        <button onclick="document.getElementById('torneo-select-box').remove()"
          style="background:#e0e0e0;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;">
          Annulla</button>`;
      preview.appendChild(box);
      if (btn) { btn.disabled = false; btn.textContent = '✓ Aggiungi al torneo'; }
      return;
    }
    await eseguiImportazioneConTorneo(torneoId, dati, btn);
  } catch(e) {
    console.error('Errore:', e);
    if (btn) { btn.disabled = false; btn.textContent = '✓ Aggiungi al torneo'; }
    alert('❌ Errore:\n' + e.message);
  }
}

async function eseguiImportazione() {
  const torneoId = window._selectedTorneoId;
  const dati     = window._importDati;
  if (!torneoId || !dati) return;
  try { await eseguiImportazioneConTorneo(torneoId, dati, null); }
  catch(e) { console.error(e); alert('❌ Errore:\n' + e.message); }
}

async function eseguiImportazioneConTorneo(torneoId, dati, btn) {
  const { data: sqEsistenti } = await db.from('squadre').select('id, nome').eq('torneo_id', torneoId);
  const squadreMap = {};
  (sqEsistenti || []).forEach(sq => { squadreMap[`${torneoId}||${sq.nome}`] = sq.id; });
  const { data: catEsistenti } = await db.from('categorie').select('nome').eq('torneo_id', torneoId);
  const nomiCatEsistenti = new Set((catEsistenti || []).map(c => c.nome));
  let ordineBase = catEsistenti?.length || 0;
  for (let ci = 0; ci < dati.categorie.length; ci++) {
    const cat = dati.categorie[ci];
    if (nomiCatEsistenti.has(cat.nome)) {
      toast(`⚠️ Categoria "${cat.nome}" già presente — saltata`);
      continue;
    }
    const { data: catR, error: cErr } = await db.from('categorie').insert({
      torneo_id  : torneoId,
      nome       : cat.nome,
      qualificate: cat.qualificate || 1,
      formato    : cat.formato || 'triangolare',
      ordine     : ordineBase + ci
    }).select('id').single();
    if (cErr) throw new Error('Errore cat ' + cat.nome + ': ' + cErr.message);
    const catId = catR.id;
    const gironiCat = dati.gironi.filter(g => g.categoria === cat.codice || g.categoria === cat.nome);
    const gironiMap = {};
    for (const girone of gironiCat) {
      const { data: girR, error: gErr } = await db.from('gironi').insert({
        categoria_id: catId, nome: girone.nome
      }).select('id').single();
      if (gErr) throw new Error('Errore girone ' + girone.nome + ': ' + gErr.message);
      const girId = girR.id;
      gironiMap[girone.nome] = girId;
      for (let si = 0; si < girone.squadre.length; si++) {
        const nomeSq = girone.squadre[si];
        if (!nomeSq) continue;
        if (_isPlaceholder(nomeSq)) continue;
        const key = `${torneoId}||${nomeSq}`;
        if (!squadreMap[key]) {
          const { data: sqR, error: sqErr } = await db.from('squadre').insert({
            torneo_id: torneoId, nome: nomeSq
          }).select('id').single();
          if (sqErr) throw new Error('Errore squadra ' + nomeSq + ': ' + sqErr.message);
          squadreMap[key] = sqR.id;
        }
        await db.from('girone_squadre').insert({
          girone_id: girId, squadra_id: squadreMap[key], posizione: si
        });
      }
      const pGir = dati.partite.filter(p =>
        (p.categoria === cat.codice || p.categoria === cat.nome) && p.girone === girone.nome
      );
      for (const p of pGir) {
        const hIsPlaceholder = _isPlaceholder(p.home);
        const aIsPlaceholder = _isPlaceholder(p.away);
        const hId = hIsPlaceholder ? null : (squadreMap[`${torneoId}||${p.home}`] || null);
        const aId = aIsPlaceholder ? null : (squadreMap[`${torneoId}||${p.away}`] || null);
        if (!hIsPlaceholder && !hId) console.warn('Squadra home mancante:', p.home);
        if (!aIsPlaceholder && !aId) console.warn('Squadra away mancante:', p.away);
        await db.from('partite').insert({
          girone_id: girId,
          home_id  : hId,
          away_id  : aId,
          note_home: hIsPlaceholder ? p.home : null,
          note_away: aIsPlaceholder ? p.away : null,
          orario   : p.orario   || null,
          giorno   : p.giorno   || null,
          campo    : p.campo    || null,
          giornata : p.giornata || null,
          giocata  : false
        });
      }
    }
    const fase2Cat = dati.fase2.filter(p => p.categoria === cat.codice || p.categoria === cat.nome);
    for (let mi = 0; mi < fase2Cat.length; mi++) {
      const p   = fase2Cat[mi];
      const hId = _isPlaceholder(p.sq1raw) ? null : (squadreMap[`${torneoId}||${p.sq1raw}`] || null);
      const aId = _isPlaceholder(p.sq2raw) ? null : (squadreMap[`${torneoId}||${p.sq2raw}`] || null);
      const koRow = {
        categoria_id   : catId,
        round_name     : p.roundLabel,
        round_order    : p.roundOrder,
        match_order    : p.matchOrder,
        home_id        : hId,
        away_id        : aId,
        giocata        : false,
        is_consolazione: p.consolazione,
        note_home      : p.sq1raw,
        note_away      : p.sq2raw,
      };
      if (p.orario) koRow.orario = p.orario;
      if (p.campo)  koRow.campo  = p.campo;
      if (p.giorno) koRow.giorno = p.giorno;
      const { error: koErr } = await db.from('knockout').insert(koRow);
      if (koErr) console.warn('Knockout insert warning:', koErr.message);
    }
  }
  window._importDati = null;
  if (typeof STATE !== 'undefined' && typeof dbGetCategorie === 'function') {
    STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
    STATE.activeCat = STATE.categorie.length ? STATE.categorie[0].id : null;
    if (typeof renderCatBar === 'function') renderCatBar();
  }
  document.getElementById('import-preview').innerHTML = `
    <div style="margin-top:16px;padding:16px 20px;background:#d5f5e3;border-radius:8px;border:1px solid #27ae60;">
      <div style="font-size:16px;font-weight:700;color:#1e8449;">✅ Categorie aggiunte!</div>
      <div style="font-size:13px;color:#333;margin-top:6px;">
        ${dati.categorie.length} categorie importate con gironi, partite e fase finale.
      </div>
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
        <button onclick="aggiornaDopoImport()"
          style="background:#E85C00;color:white;border:none;padding:10px 22px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;">
          ✅ Vai ai Risultati
        </button>
        <button onclick="location.reload()"
          style="background:#f0f4f8;color:#333;border:1px solid #ddd;padding:10px 22px;border-radius:6px;cursor:pointer;font-size:14px;">
          🔄 Ricarica
        </button>
      </div>
    </div>`;
}

async function aggiornaDopoImport() {
  try {
    if (typeof STATE !== 'undefined' && typeof dbGetCategorie === 'function') {
      STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
      STATE.activeCat = STATE.categorie.length ? STATE.categorie[0].id : null;
      if (typeof renderCatBar === 'function') renderCatBar();
      if (typeof showSection === 'function') {
        const btn = document.querySelector('[data-section="a-risultati"]');
        showSection('a-risultati', btn);
        
      }
    }
  } catch(e) { location.reload(); }
}
