// ============================================================
//  IMPORTA EXCEL - Soccer Pro Experience
//  Legge il modello SPE e importa tutto nel database
// ============================================================

async function importaExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!STATE.activeTorneo) { toast('Crea prima un torneo!'); return; }

  toast('Lettura file Excel...');

  try {
    if (typeof XLSX === 'undefined') {
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    }

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });

    // Leggi fogli
    const sheetCat = wb.Sheets['CATEGORIE'];
    const sheetGir = wb.Sheets['GIRONI'];
    const sheetP1  = wb.Sheets['PARTITE_FASE1'];
    const sheetFF  = wb.Sheets['FASE_FINALE'];

    if (!sheetCat || !sheetGir || !sheetP1) {
      toast('❌ File non valido — usa il modello SPE corretto');
      return;
    }

    // Funzione per trovare la riga header (quella con CATEGORIA *)
    function findHeaderRow(sheet) {
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z100');
      for (let r = range.s.r; r <= Math.min(range.e.r, 8); r++) {
        let foundCat = false, foundGirone = false;
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = sheet[XLSX.utils.encode_cell({r,c})];
          if (!cell || !cell.v) continue;
          const v = cell.v.toString();
          if (v.includes('CATEGORIA')) foundCat = true;
          if (v.includes('GIRONE') || v.includes('SQUADRA') || v.includes('ROUND') || v.includes('ORE') || v.includes('ORARIO')) foundGirone = true;
        }
        if (foundCat && foundGirone) return r;
      }
      // Fallback: find any row with CATEGORIA *
      for (let r = range.s.r; r <= Math.min(range.e.r, 8); r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = sheet[XLSX.utils.encode_cell({r,c})];
          if (cell && cell.v && cell.v.toString().trim() === 'CATEGORIA *') return r;
        }
      }
      return 0;
    }

    function sheetToJsonFromRow(sheet, headerRow) {
      if (!sheet || !sheet['!ref']) return [];
      const range = XLSX.utils.decode_range(sheet['!ref']);
      const newRange = { s: { r: headerRow, c: range.s.c }, e: range.e };
      const newSheet = Object.assign({}, sheet, { '!ref': XLSX.utils.encode_range(newRange) });
      return XLSX.utils.sheet_to_json(newSheet, { defval: '' });
    }

    const catHeader  = findHeaderRow(sheetCat);
    const girHeader  = findHeaderRow(sheetGir);
    const p1Header   = findHeaderRow(sheetP1);
    const ffHeader   = sheetFF ? findHeaderRow(sheetFF) : 0;

    const cats  = sheetToJsonFromRow(sheetCat, catHeader);
    const girs  = sheetToJsonFromRow(sheetGir, girHeader);
    const parts = sheetToJsonFromRow(sheetP1,  p1Header);
    const finals= sheetFF ? sheetToJsonFromRow(sheetFF, ffHeader) : [];

    // Filtra righe vuote o di esempio
    const catRows  = cats.filter(r  => r['CATEGORIA *'] && r['CATEGORIA *'].toString().trim() && r['CATEGORIA *'] !== 'CATEGORIA *');
    const girRows  = girs.filter(r  => r['CATEGORIA *'] && r['GIRONE *'] && r['CATEGORIA *'] !== 'CATEGORIA *');
    const partRows = parts.filter(r => r['CATEGORIA *'] && r['SQUADRA CASA *'] && r['SQUADRA OSPITE *'] && r['CATEGORIA *'] !== 'CATEGORIA *');
    const finalRows= finals.filter(r => r['CATEGORIA *'] && r['ROUND *'] && r['SQUADRA 1 *'] && r['SQUADRA 2 *'] && r['CATEGORIA *'] !== 'CATEGORIA *');

    if (!catRows.length) { toast('❌ Nessuna categoria trovata — controlla che il file sia il modello SPE'); return; }

    // Mostra preview
    const preview = document.getElementById('import-preview');
    if (preview) {
      preview.innerHTML = `<div style="background:#e3f0fb;border-radius:8px;padding:12px;margin-top:12px;font-size:13px;">
        <div style="font-weight:600;margin-bottom:6px;color:#0c447c;">📋 Anteprima importazione:</div>
        <div>✓ ${catRows.length} categorie</div>
        <div>✓ ${girRows.length} gironi</div>
        <div>✓ ${partRows.length} partite fase 1</div>
        <div>✓ ${finalRows.length} partite fase finale</div>
        <button class="btn btn-p" style="margin-top:10px;width:100%;" 
          onclick="confermaImportazione()">✓ Conferma importazione</button>
        <button class="btn" style="margin-top:6px;width:100%;" 
          onclick="document.getElementById('import-preview').innerHTML=''">Annulla</button>
      </div>`;
      
      // Salva dati temporanei
      window._importData = { catRows, girRows, partRows, finalRows };
    }

  } catch(e) {
    console.error(e);
    toast('❌ Errore lettura file: ' + e.message);
  }
}

async function confermaImportazione() {
  const { catRows, girRows, partRows, finalRows } = window._importData || {};
  if (!catRows) { toast('Nessun dato da importare'); return; }

  const preview = document.getElementById('import-preview');
  if (preview) preview.innerHTML = '<div style="padding:12px;color:#185FA5;font-size:13px;">⏳ Importazione in corso...</div>';

  try {
    const formatoMap = { 'final':'final', 'semi':'semi', 'quarter':'quarter', 'quarti':'quarter', 'semifinali':'semi', 'solo finale':'final' };

    for (const catRow of catRows) {
      const catNome = catRow['CATEGORIA *'].toString().trim();
      const qualificate = parseInt(catRow['QUALIFICATE PER GIRONE *']) || 2;
      const formatoRaw = (catRow['FORMATO FINALE *'] || 'semi').toString().toLowerCase().trim();
      const formato = formatoMap[formatoRaw] || 'semi';

      // Crea categoria
      const cat = await dbSaveCategoria({
        nome: catRow['NOME COMPLETO'] || catNome,
        qualificate, formato,
        ordine: catRows.indexOf(catRow),
        torneo_id: STATE.activeTorneo
      });

      // Gironi di questa categoria
      const myGironi = girRows.filter(r => r['CATEGORIA *'].toString().trim() === catNome);
      
      // Carica squadre UNA VOLTA SOLA per tutto il torneo (ottimizzazione)
      let cacheSquadre = await dbGetSquadre(STATE.activeTorneo);

      for (const girRow of myGironi) {
        const girNome = girRow['GIRONE *'].toString().trim();
        const girone = await dbSaveGirone({ categoria_id: cat.id, nome: girNome });

        // Legge tutte le colonne SQUADRA dinamicamente (senza limite)
        const squadreNomi = [];
        for (const key of Object.keys(girRow)) {
          if (key.toString().toUpperCase().startsWith('SQUADRA')) {
            const v = girRow[key]?.toString().trim();
            if (v && v.length > 0 && !v.toUpperCase().startsWith('SQUADRA')) squadreNomi.push(v);
          }
        }

        const squadra_ids = [];
        for (const nome of squadreNomi) {
          // Cerca nella cache locale (nessuna chiamata DB extra!)
          let sq = cacheSquadre.find(s => s.nome.toLowerCase() === nome.toLowerCase());
          if (!sq) {
            // Crea squadra nuova e aggiorna la cache
            const { data } = await db.from('squadre').insert({ nome, torneo_id: STATE.activeTorneo }).select().single();
            sq = data;
            if (sq) cacheSquadre.push(sq);
          }
          if (sq) squadra_ids.push(sq.id);
        }
        await dbSetGironeSquadre(girone.id, squadra_ids);

        // Partite fase 1 di questo girone
        const myParts = partRows.filter(r =>
          r['CATEGORIA *'].toString().trim() === catNome &&
          r['GIRONE *'].toString().trim() === girNome
        );

        if (myParts.length > 0) {
          // Usa le partite dal file (con orari)
          await db.from('partite').delete().eq('girone_id', girone.id);
          for (const p of myParts) {
            const sq1Nome = p['SQUADRA CASA *'].toString().trim();
            const sq2Nome = p['SQUADRA OSPITE *'].toString().trim();
            // Usa la cache locale invece di chiamare DB ogni volta!
            const sq1 = cacheSquadre.find(s => s.nome.toLowerCase() === sq1Nome.toLowerCase());
            const sq2 = cacheSquadre.find(s => s.nome.toLowerCase() === sq2Nome.toLowerCase());
            if (sq1 && sq2) {
              await db.from('partite').insert({
                girone_id: girone.id,
                home_id: sq1.id,
                away_id: sq2.id,
                giocata: false,
                orario: p['ORARIO *']?.toString() || null,
                giorno: p['GIORNO *']?.toString() || null,
                campo: p['CAMPO']?.toString() || null,
                giornata: p['GIORNATA']?.toString() || null,
              });
            }
          }
        } else {
          // Genera partite automaticamente (tutti vs tutti)
          await dbGeneraPartite(girone.id, squadra_ids);
        }
      }

      // Fase finale
      const myFinals = finalRows.filter(r => r['CATEGORIA *'].toString().trim() === catNome);
      if (myFinals.length > 0) {
        await dbDeleteKnockout(cat.id);
        // Aggiorna cache squadre prima della fase finale
        cacheSquadre = await dbGetSquadre(STATE.activeTorneo);
        const roundOrder = ['Quarti di finale','Semifinali','3° posto','Finale','5° posto','7° posto',
                           'Consolazione semifinali','Consolazione finale','Consolazione 3° posto'];
        const matchCount = {};
        for (const f of myFinals) {
          const round_name = f['ROUND *'].toString().trim();
          if (!matchCount[round_name]) matchCount[round_name] = 0;
          const sq1Nome = f['SQUADRA 1 *'].toString().trim();
          const sq2Nome = f['SQUADRA 2 *'].toString().trim();
          // Usa cache locale!
          const sq1 = sq1Nome !== 'TBD' ? cacheSquadre.find(s => s.nome.toLowerCase() === sq1Nome.toLowerCase()) : null;
          const sq2 = sq2Nome !== 'TBD' ? cacheSquadre.find(s => s.nome.toLowerCase() === sq2Nome.toLowerCase()) : null;
          const is_consolazione = (f['TIPO']?.toString().toLowerCase() || '').includes('consol');
          await dbSaveKnockoutMatch({
            categoria_id: cat.id,
            round_name,
            round_order: roundOrder.indexOf(round_name) !== -1 ? roundOrder.indexOf(round_name) : 99,
            match_order: matchCount[round_name]++,
            home_id: sq1?.id || null,
            away_id: sq2?.id || null,
            gol_home: 0, gol_away: 0,
            giocata: false,
            is_consolazione,
            note_home: sq1 ? '' : sq1Nome,
            note_away: sq2 ? '' : sq2Nome,
          });
        }
      }
    }

    // Aggiorna stato
    STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
    STATE.activeCat = STATE.categorie[0]?.id || null;
    renderCatBar();
    delete window._importData;
    toast('✅ Importazione completata!');
    await renderAdminSetup();

  } catch(e) {
    console.error(e);
    toast('❌ Errore importazione: ' + e.message);
  }
}
