// ============================================================
//  IMPORTA EXCEL — Soccer Pro Experience
//  Legge: CATEGORIE, GIRONI, PARTITE_FASE1, FASE_FINALE
//  Triangolari PLATINO / GOLD / SILVER / BRONZO / WHITE
//  Le squadre "1° Girone X" vengono risolte a fine gironi
// ============================================================

async function importaExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const preview = document.getElementById('import-preview');
  preview.innerHTML = '<div style="padding:16px;color:#888;font-size:13px;">⏳ Lettura file in corso...</div>';

  try {
    console.log('importaExcel: start');
    if (typeof XLSX === 'undefined') {
      console.log('importaExcel: carico XLSX...');
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    console.log('importaExcel: XLSX ok, leggo file...');

    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf, { type: 'array' });
    console.log('importaExcel: fogli trovati:', wb.SheetNames);

    const dati = {
      categorie : leggiCategorie(wb),
      gironi    : leggiGironi(wb),
      partite   : leggiPartiteFase1(wb),
      fase2     : leggiPartiteFase2(wb)
    };
    console.log('importaExcel: dati letti →',
      'cat:', dati.categorie.length,
      'gironi:', dati.gironi.length,
      'partite:', dati.partite.length,
      'fase2:', dati.fase2.length
    );

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

// ============================================================
//  LETTURA FOGLI
// ============================================================

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

  return rows.slice(hi + 1)
    .map(r => {
      const obj = {};
      hdrs.forEach((h, i) => { if (h) obj[h] = String(r[i]||'').trim(); });
      return obj;
    })
    .filter(r => col(r, 'CATEGORIA') && !col(r, 'CATEGORIA').toUpperCase().includes('SPAREGGIO'))
    .map(r => ({
      codice     : col(r, 'CATEGORIA'),
      nome       : col(r, 'NOME COMPLETO', 'NOME') || col(r, 'CATEGORIA'),
      qualificate: parseInt(col(r, 'QUALIFICATE')) || 2,
      formato    : col(r, 'FORMATO') || 'triangolare'
    }));
}

function leggiGironi(wb) {
  const ws = wb.Sheets['GIRONI'];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const hi   = trovaRigaHeader(rows, ['CATEGORIA', 'GIRONE']);
  const hdrs = rows[hi].map(h => String(h||'').trim());

  return rows.slice(hi + 1)
    .map(r => {
      const obj = {};
      hdrs.forEach((h, i) => { if (h) obj[h] = String(r[i]||'').trim(); });
      return obj;
    })
    .filter(r => col(r, 'CATEGORIA') && col(r, 'GIRONE'))
    .map(r => {
      const squadre = Object.keys(r)
        .filter(k => k.toUpperCase().startsWith('SQUADRA'))
        .sort((a, b) => (parseInt(a.replace(/\D/g,''))||0) - (parseInt(b.replace(/\D/g,''))||0))
        .map(k => r[k])
        .filter(s => s);
      return {
        categoria: col(r, 'CATEGORIA'),
        nome     : col(r, 'GIRONE'),
        squadre
      };
    });
}

function leggiPartiteFase1(wb) {
  const ws = wb.Sheets['PARTITE_FASE1'];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const hi   = trovaRigaHeader(rows, ['CATEGORIA', 'GIRONE']);
  const hdrs = rows[hi].map(h => String(h||'').trim());

  // Rileva indice colonne dalla riga header
  const iCat      = hdrs.findIndex(h => h.toUpperCase().includes('CATEGORIA'));
  const iGir      = hdrs.findIndex(h => h.toUpperCase().includes('GIRONE'));
  const iGiornata = hdrs.findIndex(h => h.toUpperCase().includes('GIORNATA') || h.toUpperCase().includes('NOME PARTITA'));
  const iGiorno   = hdrs.findIndex(h => h.toUpperCase().includes('GIORNO') || h.toUpperCase().includes('DATA'));
  const iOra      = hdrs.findIndex(h => h.toUpperCase().includes('ORARIO') || h.toUpperCase() === 'ORA');
  const iCampo    = hdrs.findIndex(h => h.toUpperCase().includes('CAMPO'));

  // Prima riga dati per rilevare separatore "vs"
  const primaRiga = rows.slice(hi + 1).find(r => String(r[iCat>=0?iCat:0]||'').trim());
  // Se colonna 6 (0-based) contiene "vs" → home=5, away=7
  let iHome, iAway;
  if (primaRiga && String(primaRiga[6]||'').toLowerCase().trim() === 'vs') {
    iHome = 5; iAway = 7;
  } else {
    // Cerca per nome colonna
    iHome = hdrs.findIndex(h => h.toUpperCase().includes('CASA') || h.toUpperCase().includes('HOME'));
    iAway = hdrs.findIndex(h => h.toUpperCase().includes('OSPITE') || h.toUpperCase().includes('AWAY'));
    if (iHome < 0) iHome = 5;
    if (iAway < 0) iAway = 7;
  }

  return rows.slice(hi + 1)
    .filter(r => {
      const cat  = String(r[iCat >= 0 ? iCat : 0]||'').trim();
      const home = String(r[iHome]||'').trim();
      const away = String(r[iAway]||'').trim();
      if (!cat || cat.startsWith('—') || cat.startsWith('-')) return false;
      return home && away && home.toLowerCase() !== 'vs' && away.toLowerCase() !== 'vs';
    })
    .map(r => ({
      categoria: String(r[iCat      >= 0 ? iCat      : 0]||'').trim(),
      girone   : String(r[iGir      >= 0 ? iGir      : 1]||'').trim(),
      giornata : String(r[iGiornata >= 0 ? iGiornata : 2]||'').trim(),
      giorno   : String(r[iGiorno   >= 0 ? iGiorno   : 3]||'').trim(),
      orario   : String(r[iOra      >= 0 ? iOra      : 4]||'').trim(),
      home     : String(r[iHome]||'').trim(),
      away     : String(r[iAway]||'').trim(),
      campo    : String(r[iCampo    >= 0 ? iCampo    : 8]||'').trim()
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
      const round = col(obj, 'ROUND').toUpperCase();
      if (!cat || cat.toUpperCase().includes('LEGENDA')) return false;
      return ROUND_META[round] !== undefined;
    })
    .map(({ obj, idx }) => {
      const round  = col(obj, 'ROUND').toUpperCase();
      const meta   = ROUND_META[round];
      const sq1raw = col(obj, 'SQUADRA 1');
      const sq2raw = col(obj, 'SQUADRA 2');
      return {
        categoria   : col(obj, 'CATEGORIA'),
        round,
        roundLabel  : `${meta.emoji} ${round} — ${meta.desc}`,
        roundOrder  : meta.order,
        matchOrder  : idx,
        consolazione: meta.consolazione,
        giorno      : col(obj, 'GIORNO', 'DATA'),
        orario      : col(obj, 'ORARIO', 'ORA'),
        campo       : col(obj, 'CAMPO'),
        sq1raw,
        sq2raw
      };
    });
}

// ============================================================
//  ANTEPRIMA
// ============================================================

function mostraAnteprima(dati, container) {
  window._importDati = dati;

  const girCat = {};
  const p1Cat  = {};
  const p2Cat  = {};
  dati.gironi.forEach(g  => { (girCat[g.categoria] = girCat[g.categoria]||[]).push(g); });
  dati.partite.forEach(p => { (p1Cat[p.categoria]  = p1Cat[p.categoria] ||[]).push(p); });
  dati.fase2.forEach(p   => { (p2Cat[p.categoria]  = p2Cat[p.categoria] ||[]).push(p); });

  let html = `
    <div style="margin-top:20px;border:1px solid #ddd;border-radius:10px;overflow:hidden;font-family:Arial,sans-serif;">
      <div style="background:#1a5276;color:white;padding:14px 18px;font-size:15px;font-weight:700;">
        📋 Anteprima importazione — controlla e conferma
      </div>
      <div style="padding:16px;">`;

  dati.categorie.forEach(cat => {
    const gironi  = girCat[cat.codice] || girCat[cat.nome] || [];
    const partite = p1Cat[cat.codice]  || p1Cat[cat.nome]  || [];
    const fase2   = p2Cat[cat.codice]  || p2Cat[cat.nome]  || [];
    const totSq   = gironi.reduce((s, g) => s + g.squadre.length, 0);

    // Round presenti
    const roundsPresenti = [...new Set(fase2.map(p => p.round))]
      .sort((a, b) => (ROUND_META[a]?.order||99) - (ROUND_META[b]?.order||99));

    html += `
      <div style="margin-bottom:18px;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
        <div style="background:#2e86c1;color:white;padding:10px 14px;font-weight:700;font-size:14px;">
          📁 ${cat.nome}
        </div>
        <div style="padding:12px 14px;font-size:13px;">
          <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
            <span style="background:#eaf4fb;padding:4px 10px;border-radius:20px;">🏟 <strong>${gironi.length}</strong> gironi</span>
            <span style="background:#eaf4fb;padding:4px 10px;border-radius:20px;">👥 <strong>${totSq}</strong> squadre</span>
            <span style="background:#eaf4fb;padding:4px 10px;border-radius:20px;">⚽ <strong>${partite.length}</strong> partite girone</span>
            <span style="background:#fef9e7;padding:4px 10px;border-radius:20px;">🏆 <strong>${fase2.length}</strong> partite triangolari</span>
          </div>`;

    // Gironi
    const BG_GIRONI = ['#eaf4fb','#e9f7ef','#fef9e7','#fdf2f8','#f4ecf7'];
    gironi.forEach((g, gi) => {
      html += `<div style="display:inline-block;background:${BG_GIRONI[gi%BG_GIRONI.length]};border-radius:6px;padding:5px 10px;margin:3px 3px 3px 0;font-size:12px;">
        <strong>${g.nome}</strong>: ${g.squadre.join(' · ')}
      </div>`;
    });

    // Triangolari
    if (roundsPresenti.length) {
      html += `<div style="border-top:1px solid #eee;margin-top:10px;padding-top:10px;">
        <div style="font-weight:700;color:#1a5276;margin-bottom:8px;">🔁 Triangolari:</div>`;

      roundsPresenti.forEach(rnd => {
        const meta  = ROUND_META[rnd] || {};
        const colr  = ROUND_COLORS[rnd] || '#999';
        const pRnd  = fase2.filter(p => p.round === rnd);
        html += `<div style="margin-bottom:6px;padding:7px 12px;border-radius:6px;border-left:4px solid ${colr};background:#fafafa;font-size:12px;">
          <strong>${meta.emoji||''} ${rnd}</strong> <span style="color:#666;">— ${meta.desc||''}</span>
          &nbsp;(${pRnd.length} partite):<br>
          <span style="color:#555;line-height:1.8;">
            ${pRnd.map(p => `${p.sq1raw} vs ${p.sq2raw}${p.orario?' <em>('+p.orario+')</em>':''}`).join(' &nbsp;·&nbsp; ')}
          </span>
        </div>`;
      });

      html += `<div style="font-size:11px;color:#999;font-style:italic;margin-top:4px;">
        ℹ️ "1° Girone X" viene sostituito con la squadra reale al termine dei gironi
      </div></div>`;
    }

    html += `</div></div>`;
  });

  const totP2 = dati.fase2.length;
  html += `
    <div style="background:#f0f4f8;border-radius:8px;padding:12px 14px;font-size:13px;">
      <strong>Totale:</strong> ${dati.categorie.length} categorie · ${dati.gironi.length} gironi · ${dati.partite.length} partite girone · ${totP2} partite triangolari
    </div>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
      <button onclick="confermaImportazione()"
        style="background:#27ae60;color:white;border:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">
        ✓ Conferma e importa tutto
      </button>
      <button onclick="document.getElementById('import-preview').innerHTML=''"
        style="background:#e0e0e0;color:#333;border:none;padding:12px 20px;border-radius:8px;font-size:14px;cursor:pointer;">
        Annulla
      </button>
    </div>
  </div></div>`;

  container.innerHTML = html;
}

// ============================================================
//  CONFERMA IMPORTAZIONE
// ============================================================

async function confermaImportazione() {
  const dati = window._importDati;
  if (!dati) return;

  const btn = document.querySelector('button[onclick="confermaImportazione()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Importazione in corso...'; }

  try {
    // Torneo attivo
    const { data: tornei, error: tErr } = await db.from('tornei').select('id').eq('attivo', true).limit(1);
    if (tErr) throw new Error('Errore lettura tornei: ' + tErr.message);
    const torneoId = tornei?.[0]?.id;
    if (!torneoId) throw new Error('Nessun torneo attivo. Vai su Tornei e crea/attiva un torneo prima di importare.');

    // Pulizia
    await pulisciTorneo(torneoId);

    const squadreMap = {}; // `torneoId||nomeSq` → sqId

    // Importa per categoria
    for (let ci = 0; ci < dati.categorie.length; ci++) {
      const cat = dati.categorie[ci];

      const { data: catR, error: cErr } = await db.from('categorie').insert({
        torneo_id  : torneoId,
        nome       : cat.nome,
        qualificate: cat.qualificate || 2,
        formato    : cat.formato || 'triangolare',
        ordine     : ci
      }).select('id').single();
      if (cErr) throw new Error('Errore cat ' + cat.nome + ': ' + cErr.message);
      const catId = catR.id;

      // Gironi (match per codice o nome)
      const gironiCat = dati.gironi.filter(g => g.categoria === cat.codice || g.categoria === cat.nome);
      const gironiMap = {}; // 'Girone 1' → girId

      for (const girone of gironiCat) {
        const { data: girR, error: gErr } = await db.from('gironi').insert({
          categoria_id: catId, nome: girone.nome
        }).select('id').single();
        if (gErr) throw new Error('Errore girone ' + girone.nome + ': ' + gErr.message);
        const girId = girR.id;
        gironiMap[girone.nome] = girId;

        // Squadre
        for (let si = 0; si < girone.squadre.length; si++) {
          const nomeSq = girone.squadre[si];
          if (!nomeSq) continue;
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

        // Partite fase1
        const pGir = dati.partite.filter(p =>
          (p.categoria === cat.codice || p.categoria === cat.nome) && p.girone === girone.nome
        );
        for (const p of pGir) {
          const hId = squadreMap[`${torneoId}||${p.home}`];
          const aId = squadreMap[`${torneoId}||${p.away}`];
          if (!hId || !aId) { console.warn('Squadra mancante fase1:', p.home, '/', p.away); continue; }
          await db.from('partite').insert({
            girone_id: girId, home_id: hId, away_id: aId,
            orario: p.orario||null, giorno: p.giorno||null,
            campo: p.campo||null, giornata: p.giornata||null, giocata: false
          });
        }
      }

      // Partite fase2 (triangolari) — salva con note_home/note_away come placeholder
      const fase2Cat = dati.fase2.filter(p => p.categoria === cat.codice || p.categoria === cat.nome);
      for (let mi = 0; mi < fase2Cat.length; mi++) {
        const p   = fase2Cat[mi];
        // Prova lookup diretto (se le note sono nomi reali di squadre)
        const hId = squadreMap[`${torneoId}||${p.sq1raw}`] || null;
        const aId = squadreMap[`${torneoId}||${p.sq2raw}`] || null;

        await db.from('knockout').insert({
          categoria_id   : catId,
          round_name     : p.roundLabel,
          round_order    : p.roundOrder,
          match_order    : p.matchOrder,
          home_id        : hId,
          away_id        : aId,
          giocata        : false,
          is_consolazione: p.consolazione,
          note_home      : p.sq1raw,   // es. "1° Girone 1" — usato da app.js per risolvere
          note_away      : p.sq2raw
        });
      }
    }

    document.getElementById('import-preview').innerHTML = `
      <div style="margin-top:16px;padding:16px 20px;background:#d5f5e3;border-radius:8px;border:1px solid #27ae60;font-family:Arial,sans-serif;">
        <div style="font-size:16px;font-weight:700;color:#1e8449;">✅ Importazione completata!</div>
        <div style="font-size:13px;color:#333;margin-top:6px;">
          ${dati.categorie.length} categorie · ${dati.gironi.length} gironi ·
          ${dati.partite.length} partite girone ·
          ${dati.fase2.length} partite triangolari (🥇PLATINO 🥈GOLD 🥉SILVER 🏅BRONZO ⬜WHITE)
        </div>
        <div style="font-size:12px;color:#666;margin-top:6px;font-style:italic;">
          Quando finiscono i gironi, vai su <strong>Fase Finale</strong> → clicca "Risolvi squadre" per assegnare le qualificate ai triangolari.
        </div>
        <button onclick="location.reload()"
          style="margin-top:12px;background:#27ae60;color:white;border:none;padding:10px 22px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;">
          🔄 Ricarica il sito
        </button>
      </div>`;
    window._importDati = null;

  } catch (e) {
    console.error('Errore importazione:', e);
    if (btn) { btn.disabled = false; btn.textContent = '✓ Conferma e importa tutto'; }
    alert('❌ Errore:\n' + e.message);
  }
}

// ============================================================
//  PULIZIA TORNEO
// ============================================================

async function pulisciTorneo(torneoId) {
  const { data: cats } = await db.from('categorie').select('id').eq('torneo_id', torneoId);
  const catIds = (cats||[]).map(c => c.id);
  if (!catIds.length) { await db.from('squadre').delete().eq('torneo_id', torneoId); return; }

  const { data: girs } = await db.from('gironi').select('id').in('categoria_id', catIds);
  const girIds = (girs||[]).map(g => g.id);

  if (girIds.length) {
    await db.from('partite').delete().in('girone_id', girIds);
    await db.from('girone_squadre').delete().in('girone_id', girIds);
    await db.from('gironi').delete().in('id', girIds);
  }
  await db.from('knockout').delete().in('categoria_id', catIds);
  await db.from('categorie').delete().in('id', catIds);
  await db.from('squadre').delete().eq('torneo_id', torneoId);
}
