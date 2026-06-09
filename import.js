// ============================================================
//  IMPORT.JS — MC LION TROPHY 2026
//  Legge file Excel con fogli: CATEGORIE, GIRONI, PARTITE_FASE1, FASE_FINALE
// ============================================================

const ROUND_META = {
  'SEMIFINALE 01': { order:14, consolazione:false, emoji:'⚔️', desc:'Semifinale 1' },
  'SEMIFINALE 02': { order:15, consolazione:false, emoji:'⚔️', desc:'Semifinale 2' },
  'SEMIFINALE 03': { order:16, consolazione:false, emoji:'⚔️', desc:'Semifinale 3' },
  'SEMIFINALE 04': { order:17, consolazione:false, emoji:'⚔️', desc:'Semifinale 4' },
  'FINALE 1-2 POSTO': { order:20, consolazione:false, emoji:'🏆', desc:'Finale 1°-2°' },
  'FINALE 3-4 POSTO': { order:21, consolazione:true,  emoji:'🥉', desc:'Finale 3°-4°' },
  'FINALE 5-6 POSTO': { order:22, consolazione:true,  emoji:'🎖️', desc:'Finale 5°-6°' },
  'FINALE 7-8 POSTO': { order:23, consolazione:true,  emoji:'🎖️', desc:'Finale 7°-8°' },
};

function _getRoundMeta(roundRaw) {
  if (!roundRaw) return null;
  const r = roundRaw.toUpperCase().trim();
  if (ROUND_META[r]) return { key: r, meta: ROUND_META[r] };
  // Girone Champions/Europa League / nomi speciali
  if (/GIRONE\s+(CHAMPIONS|EUROPA|TOPOLINO|PAPERINO|PIPPO|QUI|QUO)/i.test(r))
    return { key: r, meta: { order: 20, consolazione: /EUROPA|QUI|QUO/i.test(r), emoji: /CHAMPIONS/i.test(r)?'🏆':'🌍', desc: r } };
  // Girone numerato 1-10
  if (/^GIRONE\s+\d+$/.test(r)) { const n=parseInt(r.match(/\d+/)[0]); return { key:r, meta:{order:10+n, consolazione:n>6, emoji:'🏟️', desc:r} }; }
  // Girone lettera A-L
  if (/^GIRONE\s+[A-L]$/.test(r)) return { key:r, meta:{order:5, consolazione:false, emoji:'🏟️', desc:r} };
  // Semifinale generica
  if (/^SEMIFINALE\s*\d*/.test(r)) { const n=parseInt(r.match(/\d+/)?.[0]||'1'); return { key:r, meta:{order:14+n, consolazione:false, emoji:'⚔️', desc:r} }; }
  // Quarto di finale
  if (/^QUARTO\s+DI\s+FINALE/i.test(r)) { const n=parseInt(r.match(/\d+/)?.[0]||'1'); return { key:r, meta:{order:30+n, consolazione:n>4, emoji:'⚔️', desc:r} }; }
  // Gara numerica (GARA 1, GARA 12 ecc.) — quarti
  if (/^GARA\s+\d+$/.test(r)) { const n=parseInt(r.match(/\d+/)[0]); return { key:r, meta:{order:40+n, consolazione:n>6, emoji:'⚔️', desc:r} }; }
  // Gara lettera (GARA A, GARA B ... GARA N) — semifinali
  if (/^GARA\s+[A-Z]$/.test(r)) { const code=r.charCodeAt(r.length-1)-64; return { key:r, meta:{order:55+code, consolazione:code>8, emoji:'⚔️', desc:r} }; }
  // FINALI X/Y POSTO (es. FINALI 1/4 POSTO, FINALI 5/8 POSTO)
  if (/^FINALI?\s+\d+\/\d+\s+POSTO/i.test(r)) {
    const m=r.match(/(\d+)\/(\d+)/); const n=m?parseInt(m[1]):99;
    return { key:r, meta:{order:70+n, consolazione:n>4, emoji:'🏅', desc:r} };
  }
  // FINALE generico
  if (/^FINALE/.test(r)) return { key:r, meta:{order:65, consolazione:true, emoji:'🏅', desc:r} };
  // Qualsiasi altro FINALI
  if (/^FINALI/i.test(r)) return { key:r, meta:{order:90, consolazione:true, emoji:'🏅', desc:r} };
  return null;
}

function _isPlaceholder(nome) {
  if (!nome) return false;
  const n = String(nome).trim();
  if (/^\d+[\u00b0\u00ba*]?\s*(Girone|GIRONE)/i.test(n)) return true;
  if (/^\d+[\u00b0\u00ba*]?\s+[A-Z]$/.test(n)) return true;
  if (/^(Vincente|Perdente)\s+/i.test(n)) return true;
  if (/^(miglior|peggior)/i.test(n)) return true;
  if (/^(PRIMA|SECONDA|TERZA|QUARTA|QUINTA|SESTA)\s+(GIRONE|MIGLIOR)/i.test(n)) return true;
  if (/^MIGLIOR[EI]?\s+(SECOND|TERZ|QUART)/i.test(n)) return true;
  return false;
}

// ── LETTURA FOGLI ────────────────────────────────────────────

function leggiCategorie(wb) {
  const ws = wb.Sheets['CATEGORIE'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return rows
    .filter(r => {
      const nome = String(r.nome || r.NOME || r.categoria || r.CATEGORIA || '').trim();
      return nome && !nome.startsWith('ℹ') && !nome.startsWith('*');
    })
    .map(r => ({
      codice     : String(r.nome || r.NOME || r.categoria || r.CATEGORIA || '').trim(),
      nome       : String(r.nome || r.NOME || r.categoria || r.CATEGORIA || '').trim(),
      qualificate: parseInt(r.qualificate || r.QUALIFICATE || 2) || 2,
      formato    : String(r.formato || r.FORMATO || 'gironi').trim(),
    }));
}

function leggiGironi(wb) {
  const ws = wb.Sheets['GIRONI'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const map = {};
  for (const r of rows) {
    const cat = String(r.categoria || r.CATEGORIA || r.nome || '').trim();
    const gir = String(r.girone || r.GIRONE || '').trim();
    const sq  = String(r.squadra || r.SQUADRA || '').trim();
    if (!cat || !gir || !sq) continue;
    const key = `${cat}||${gir}`;
    if (!map[key]) map[key] = { categoria: cat, nome: gir, squadre: [] };
    map[key].squadre.push(sq);
  }
  return Object.values(map);
}

function leggiPartiteFase1(wb) {
  const ws = wb.Sheets['PARTITE_FASE1'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return rows
    .filter(r => {
      const cat  = String(r.categoria || r.CATEGORIA || '').trim();
      const home = String(r.squadra_casa || r.home || r.CASA || '').trim();
      const away = String(r.squadra_trasferta || r.away || r.TRASFERTA || '').trim();
      return cat && home && away;
    })
    .map(r => ({
      categoria: String(r.categoria || r.CATEGORIA || '').trim(),
      girone   : String(r.girone || r.GIRONE || '').trim(),
      home     : String(r.squadra_casa || r.home || r.CASA || '').trim(),
      away     : String(r.squadra_trasferta || r.away || r.TRASFERTA || '').trim(),
      orario   : String(r.orario || r.ORARIO || '').trim(),
      giorno   : String(r.giornata || r.GIORNATA || r.giorno || r.GIORNO || '').trim(),
      campo    : String(r.campo || r.CAMPO || '').trim(),
      giornata : String(r.giornata || r.GIORNATA || r.giorno || '').trim(),
    }));
}

function leggiPartiteFase2(wb) {
  const ws = wb.Sheets['FASE_FINALE'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return rows
    .filter(r => {
      const cat   = String(r.categoria || r.CATEGORIA || '').trim();
      const round = String(r.round || r.ROUND || '').trim();
      if (!cat || !round) return false;
      // Accetta qualsiasi round riconoscibile O qualsiasi GARA/FINALE
      const meta = _getRoundMeta(round);
      if (meta) return true;
      // Fallback: accetta comunque se ha squadra_casa e squadra_trasferta
      const home = String(r.squadra_casa || r.home || '').trim();
      const away = String(r.squadra_trasferta || r.away || '').trim();
      return !!(home && away);
    })
    .map((r, idx) => {
      const roundRaw = String(r.round || r.ROUND || '').trim();
      const rm = _getRoundMeta(roundRaw);
      const key = rm ? rm.key : roundRaw.toUpperCase().trim();
      const meta = rm ? rm.meta : { order: 99+idx, consolazione: false, emoji: '⚔️', desc: roundRaw };
      return {
        categoria   : String(r.categoria || r.CATEGORIA || '').trim(),
        round       : key,
        roundLabel  : `${meta.emoji} ${key}`,
        roundOrder  : meta.order,
        matchOrder  : idx,
        consolazione: meta.consolazione,
        orario      : String(r.orario || r.ORARIO || '').trim(),
        campo       : String(r.campo || r.CAMPO || '').trim(),
        giorno      : String(r.giornata || r.GIORNATA || r.giorno || '').trim(),
        sq1raw      : String(r.squadra_casa || r.home || '').trim(),
        sq2raw      : String(r.squadra_trasferta || r.away || '').trim(),
      };
    });
}

// ── IMPORTAZIONE PRINCIPALE ───────────────────────────────────

async function eseguiImportazioneConTorneo(torneoId, dati, btn) {
  const { data: sqEsistenti } = await db.from('squadre').select('id,nome').eq('torneo_id', torneoId);
  const squadreMap = {};
  (sqEsistenti||[]).forEach(sq => { squadreMap[`${torneoId}||${sq.nome}`] = sq.id; });

  const { data: catEsistenti } = await db.from('categorie').select('nome').eq('torneo_id', torneoId);
  const nomiCatEsistenti = new Set((catEsistenti||[]).map(c => c.nome));
  let ordineBase = catEsistenti?.length || 0;

  for (let ci = 0; ci < dati.categorie.length; ci++) {
    const cat = dati.categorie[ci];
    if (nomiCatEsistenti.has(cat.nome)) { if(typeof toast==='function') toast(`⚠️ "${cat.nome}" già presente — saltata`); continue; }

    const { data: catR, error: cErr } = await db.from('categorie').insert({
      torneo_id: torneoId, nome: cat.nome,
      qualificate: cat.qualificate||2, formato: cat.formato||'gironi', ordine: ordineBase+ci
    }).select('id').single();
    if (cErr) throw new Error('Errore categoria: ' + cErr.message);
    const catId = catR.id;

    const gironiCat = dati.gironi.filter(g => g.categoria===cat.codice || g.categoria===cat.nome);
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
        const key = `${torneoId}||${nomeSq}`;
        if (!squadreMap[key]) {
          const { data: sqR, error: sqErr } = await db.from('squadre').insert({
            torneo_id: torneoId, nome: nomeSq
          }).select('id').single();
          if (sqErr) throw new Error('Errore squadra ' + nomeSq + ': ' + sqErr.message);
          squadreMap[key] = sqR.id;
        }
        await db.from('girone_squadre').insert({ girone_id: girId, squadra_id: squadreMap[key], posizione: si });
      }

      const pGir = dati.partite.filter(p =>
        (p.categoria===cat.codice||p.categoria===cat.nome) && p.girone===girone.nome
      );
      for (const p of pGir) {
        const hPH = _isPlaceholder(p.home);
        const aPH = _isPlaceholder(p.away);
        const hId = squadreMap[`${torneoId}||${p.home}`] || null;
        const aId = squadreMap[`${torneoId}||${p.away}`] || null;
        const giornoVal = p.giornata || p.giorno || null;
        await db.from('partite').insert({
          girone_id: girId,
          home_id  : hId,
          away_id  : aId,
          note_home: hPH ? p.home : null,
          note_away: aPH ? p.away : null,
          orario   : p.orario || null,
          giorno   : giornoVal,
          giornata : giornoVal,
          campo    : p.campo || null,
          giocata  : false
        });
      }
    }

    // Fase finale (knockout)
    const fase2Cat = dati.fase2.filter(p => p.categoria===cat.codice||p.categoria===cat.nome);
    for (let mi = 0; mi < fase2Cat.length; mi++) {
      const p   = fase2Cat[mi];
      const hId = _isPlaceholder(p.sq1raw) ? null : (squadreMap[`${torneoId}||${p.sq1raw}`]||null);
      const aId = _isPlaceholder(p.sq2raw) ? null : (squadreMap[`${torneoId}||${p.sq2raw}`]||null);
      const giornoVal = p.giorno || null;
      await db.from('knockout').insert({
        categoria_id   : catId,
        round_name     : p.roundLabel,
        round_order    : p.roundOrder,
        match_order    : p.matchOrder,
        home_id        : hId,
        away_id        : aId,
        giocata        : false,
        is_consolazione: p.consolazione,
        note_home      : p.sq1raw || null,
        note_away      : p.sq2raw || null,
        orario         : p.orario || null,
        campo          : p.campo  || null,
        giorno         : giornoVal,
      }).then(({error}) => { if(error) console.warn('KO insert:', error.message); });
    }
  }

  if (typeof STATE !== 'undefined' && typeof dbGetCategorie === 'function') {
    STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
    STATE.activeCat = STATE.categorie.length ? STATE.categorie[0].id : null;
    if (typeof renderCatBar === 'function') renderCatBar();
    if (typeof _cacheClear === 'function') _cacheClear();
  }

  if (btn) { btn.disabled = true; btn.textContent = '✅ Importata'; btn.style.background='var(--verde)'; }

  try {
    if (typeof _generaDataJson === 'function') {
      if (typeof _dataJsonTimer !== 'undefined') clearTimeout(_dataJsonTimer);
      const cats = await dbGetCategorie(torneoId);
      const catIds = cats.map(c => c.id);
      const gwdAll = {}, koAll = {};
      await Promise.all(catIds.map(async catId => {
        const [gwd, ko] = await Promise.all([
          getGironiWithData(catId),
          dbGetKnockout(catId)
        ]);
        gwdAll[catId] = gwd;
        koAll[catId] = ko;
      }));
      const tornei = await dbGetTornei();
      const catsByTorneo = {}; catsByTorneo[torneoId] = cats;
      const { data: squadreKV } = await db.from('squadre').select('id,nome,logo,torneo_id').eq('torneo_id', torneoId);
      const logos = {};
      (squadreKV||[]).forEach(s => { logos[s.id] = { nome: s.nome, logo: s.logo||null }; });
      const payload = { ts: Date.now(), tornei, categorie_by_torneo: catsByTorneo, gwd_by_cat: gwdAll, ko_by_cat: koAll, logos };
      window._staticData = payload;
      await fetch('https://mclion-api.torneo-live.workers.dev/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer mclion2026' },
        body: JSON.stringify(payload)
      });
      try { localStorage.setItem('spe_torneo', String(torneoId)); } catch(e) {}
      console.log('[Import] KV aggiornato automaticamente ✓');
    }
  } catch(e) { console.warn('[Import] KV update fallito:', e); }

  if (document.getElementById('import-preview')) {
    document.getElementById('import-preview').innerHTML = `
      <div style="padding:16px;background:#d5f5e3;border-radius:8px;border:1px solid #27ae60;margin-top:12px;">
        <div style="font-size:16px;font-weight:700;color:#1e8449;">✅ Categorie importate!</div>
        <div style="font-size:13px;color:#333;margin-top:6px;">${dati.categorie.length} categorie con gironi e partite.</div>
        <button onclick="location.reload()" style="margin-top:12px;background:#D42B2B;color:white;border:none;padding:10px 22px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700;">
          🔄 Ricarica pagina
        </button>
        <div id="kv-status" style="font-size:12px;color:#666;margin-top:8px;">⏳ Aggiornamento dati in corso...</div>
        <script>setTimeout(()=>{document.getElementById('kv-status').textContent='✅ Dati pronti — puoi ricaricare!';},4000);</script>
      </div>`;
  }
}

async function eseguiImportazione() {
  const torneoId = window._selectedTorneoId;
  const dati = window._importDati;
  if (!torneoId || !dati) return;
  try { await eseguiImportazioneConTorneo(torneoId, dati, null); }
  catch(e) { console.error(e); alert('❌ Errore:\n' + e.message); }
}
