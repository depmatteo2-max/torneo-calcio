// ============================================================
//  IMPORTA EXCEL - Modello SPE Semplice
//  Fogli: SQUADRE, PARTITE
// ============================================================

async function importaExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = ''; // reset input

  toast('⏳ Lettura file Excel...');

  try {
    if (typeof XLSX === 'undefined') {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });

    // Leggi fogli
    const sheetSquadre = wb.Sheets['SQUADRE'];
    const sheetPartite = wb.Sheets['PARTITE'];

    if (!sheetSquadre || !sheetPartite) {
      alert('❌ File non valido!\n\nIl file deve avere i fogli "SQUADRE" e "PARTITE".\nScarica il modello corretto dal sito.');
      return;
    }

    const allSquadre = XLSX.utils.sheet_to_json(sheetSquadre, { defval: '' });
    const allPartite = XLSX.utils.sheet_to_json(sheetPartite, { defval: '' });

    // Filtra righe valide
    const squadreRows = allSquadre.filter(r => {
      const cat = (r['CATEGORIA *'] || '').toString().trim();
      const sq  = (r['NOME SQUADRA *'] || '').toString().trim();
      return cat && sq && cat !== 'CATEGORIA *';
    });

    const partiteRows = allPartite.filter(r => {
      const cat  = (r['CATEGORIA *'] || '').toString().trim();
      const casa = (r['SQUADRA CASA *'] || '').toString().trim();
      const osp  = (r['SQUADRA OSPITE *'] || '').toString().trim();
      return cat && casa && osp && cat !== 'CATEGORIA *';
    });

    if (!squadreRows.length) {
      alert('❌ Nessuna squadra trovata nel foglio SQUADRE!\nControlla che le righe di esempio siano state cancellate.');
      return;
    }
    if (!partiteRows.length) {
      alert('❌ Nessuna partita trovata nel foglio PARTITE!\nControlla che le righe di esempio siano state cancellate.');
      return;
    }

    // Raggruppa per categoria
    const categorie = [...new Set(squadreRows.map(r => r['CATEGORIA *'].toString().trim()))];

    // Costruisci anteprima dettagliata
    let previewHTML = `
      <div style="background:#e3f0fb;border-radius:12px;padding:16px;margin-top:14px;">
        <div style="font-weight:700;font-size:15px;color:#0c447c;margin-bottom:12px;">📋 Anteprima importazione</div>`;

    for (const cat of categorie) {
      const catSquadre = squadreRows.filter(r => r['CATEGORIA *'].toString().trim() === cat);
      const catPartite = partiteRows.filter(r => r['CATEGORIA *'].toString().trim() === cat);
      const gironi = [...new Set(catSquadre.map(r => (r['GIRONE *']||'').toString().trim()).filter(Boolean))];
      const fasi   = [...new Set(catPartite.map(r => (r['FASE *']||'').toString().trim()).filter(Boolean))];
      const campi  = [...new Set(catPartite.map(r => (r['CAMPO']||'').toString().trim()).filter(Boolean))];

      previewHTML += `
        <div style="background:white;border-radius:8px;padding:12px;margin-bottom:10px;border:1px solid #c5ddf5;">
          <div style="font-weight:700;color:#185FA5;font-size:14px;margin-bottom:8px;">📁 ${cat}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">
            <div>🏟️ <strong>${gironi.length} gironi:</strong> ${gironi.join(', ')}</div>
            <div>👥 <strong>${catSquadre.length} squadre</strong></div>
            <div>⚽ <strong>${catPartite.length} partite</strong></div>
            <div>📅 <strong>Fasi:</strong> ${fasi.join(', ')}</div>
            ${campi.length ? `<div>🏟️ <strong>Campi:</strong> ${campi.join(', ')}</div>` : ''}
          </div>
          <div style="margin-top:8px;font-size:11px;color:#888;">
            Prime partite: ${catPartite.slice(0,2).map(p=>`${p['ORARIO *']||''} ${p['SQUADRA CASA *']} vs ${p['SQUADRA OSPITE *']}`).join(' · ')}
          </div>
        </div>`;
    }

    previewHTML += `
        <div style="font-size:12px;color:#555;margin-bottom:12px;">
          Totale: <strong>${squadreRows.length} squadre</strong> · <strong>${partiteRows.length} partite</strong> · <strong>${categorie.length} categorie</strong>
        </div>
        <button class="btn btn-p" style="width:100%;padding:12px;font-size:14px;" onclick="confermaImportazione()">✓ Conferma e importa tutto</button>
        <button class="btn" style="width:100%;margin-top:6px;" onclick="document.getElementById('import-preview').innerHTML=''">✕ Annulla</button>
      </div>`;

    const preview = document.getElementById('import-preview');
    if (preview) {
      preview.innerHTML = previewHTML;
      preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    window._importData = { squadreRows, partiteRows, categorie };

  } catch(e) {
    console.error('Errore importaExcel:', e);
    alert('❌ Errore nella lettura del file:\n' + e.message);
  }
}

async function confermaImportazione() {
  const { squadreRows, partiteRows, categorie } = window._importData || {};
  if (!categorie) { toast('Nessun dato'); return; }

  const preview = document.getElementById('import-preview');
  if (preview) preview.innerHTML = '<div style="padding:16px;color:#185FA5;font-size:14px;text-align:center;">⏳ Importazione in corso...<br><small>Non chiudere la pagina</small></div>';

  try {
    for (const catNome of categorie) {
      const catSquadre = squadreRows.filter(r => r['CATEGORIA *'].toString().trim() === catNome);
      const catPartite = partiteRows.filter(r => r['CATEGORIA *'].toString().trim() === catNome);

      // Calcola qualificate (default 2)
      const qualificate = 2;

      // Crea categoria
      const cat = await dbSaveCategoria({
        nome: catNome,
        qualificate,
        formato: 'semi',
        ordine: categorie.indexOf(catNome),
      });

      // Crea squadre e gironi
      const gironi = [...new Set(catSquadre.map(r => (r['GIRONE *']||'').toString().trim()).filter(Boolean))];
      const gironeMap = {}; // nome girone → { id, squadra_ids }

      for (const girNome of gironi) {
        const girSquadre = catSquadre.filter(r => (r['GIRONE *']||'').toString().trim() === girNome);
        const girone = await dbSaveGirone({ categoria_id: cat.id, nome: 'Girone ' + girNome });

        const squadra_ids = [];
        for (const sq of girSquadre) {
          const nome = sq['NOME SQUADRA *'].toString().trim();
          let sqDb = (await dbGetSquadre()).find(s => s.nome.toLowerCase() === nome.toLowerCase());
          if (!sqDb) sqDb = await dbSaveSquadra({ nome });
          squadra_ids.push(sqDb.id);
        }
        await dbSetGironeSquadre(girone.id, squadra_ids);
        gironeMap[girNome] = { id: girone.id, squadra_ids };
      }

      // Separa partite per fase
      const fase1Rows = catPartite.filter(r => {
        const fase = (r['FASE *']||'').toString().trim().toLowerCase();
        return fase.includes('fase 1') || fase.includes('girone') || fase === '1';
      });
      const fase2Rows = catPartite.filter(r => {
        const fase = (r['FASE *']||'').toString().trim().toLowerCase();
        return !fase.includes('fase 1') && !fase.includes('girone') && fase !== '1';
      });

      // Inserisci partite fase 1
      for (const girNome of gironi) {
        const gInfo = gironeMap[girNome];
        const myParts = fase1Rows.filter(r => (r['GIRONE *']||'').toString().trim() === girNome);

        if (myParts.length > 0) {
          await db.from('partite').delete().eq('girone_id', gInfo.id);
          for (const p of myParts) {
            const sq1Nome = p['SQUADRA CASA *'].toString().trim();
            const sq2Nome = p['SQUADRA OSPITE *'].toString().trim();
            const sq1 = (await dbGetSquadre()).find(s => s.nome.toLowerCase() === sq1Nome.toLowerCase());
            const sq2 = (await dbGetSquadre()).find(s => s.nome.toLowerCase() === sq2Nome.toLowerCase());
            if (sq1 && sq2) {
              await db.from('partite').insert({
                girone_id: gInfo.id,
                home_id:   sq1.id,
                away_id:   sq2.id,
                giocata:   false,
                orario:    p['ORARIO *']?.toString()   || null,
                giorno:    p['GIORNO *']?.toString()   || null,
                campo:     p['CAMPO']?.toString()      || null,
                giornata:  p['GIORNATA']?.toString()   || null,
              });
            }
          }
        } else {
          await dbGeneraPartite(gInfo.id, gInfo.squadra_ids);
        }
      }

      // Inserisci partite fase 2 come knockout
      if (fase2Rows.length > 0) {
        await dbDeleteKnockout(cat.id);
        const fasi2 = [...new Set(fase2Rows.map(r => (r['FASE *']||'').toString().trim()))];
        const roundOrder = ['Semifinali','Finale 3° posto','Finale','5° posto','7° posto','Quarti di finale'];
        const mc = {};

        for (const faseName of fasi2) {
          const fasePartite = fase2Rows.filter(r => (r['FASE *']||'').toString().trim() === faseName);
          if (!mc[faseName]) mc[faseName] = 0;

          for (const p of fasePartite) {
            const sq1Nome = p['SQUADRA CASA *'].toString().trim();
            const sq2Nome = p['SQUADRA OSPITE *'].toString().trim();
            const sq1 = sq1Nome !== 'TBD' ? (await dbGetSquadre()).find(s => s.nome.toLowerCase() === sq1Nome.toLowerCase()) : null;
            const sq2 = sq2Nome !== 'TBD' ? (await dbGetSquadre()).find(s => s.nome.toLowerCase() === sq2Nome.toLowerCase()) : null;

            await dbSaveKnockoutMatch({
              categoria_id:    cat.id,
              round_name:      faseName,
              round_order:     roundOrder.indexOf(faseName) !== -1 ? roundOrder.indexOf(faseName) : 99,
              match_order:     mc[faseName]++,
              home_id:         sq1?.id || null,
              away_id:         sq2?.id || null,
              gol_home: 0, gol_away: 0,
              giocata:         false,
              is_consolazione: faseName.toLowerCase().includes('3°') || faseName.toLowerCase().includes('consol') || faseName.toLowerCase().includes('5°') || faseName.toLowerCase().includes('7°'),
              note_home:       sq1 ? '' : sq1Nome,
              note_away:       sq2 ? '' : sq2Nome,
              orario:          p['ORARIO *']?.toString() || null,
              giorno:          p['GIORNO *']?.toString() || null,
              campo:           p['CAMPO']?.toString()    || null,
            });
          }
        }
      }
    }

    // Aggiorna stato
    STATE.categorie = await dbGetCategorie();
    STATE.activeCat = STATE.categorie[0]?.id || null;
    renderCatBar();
    delete window._importData;

    if (preview) preview.innerHTML = '';
    toast('✅ Importazione completata!');
    await renderAdminSetup();

  } catch(e) {
    console.error('Errore confermaImportazione:', e);
    if (preview) preview.innerHTML = '';
    alert('❌ Errore durante importazione:\n' + e.message);
  }
}
