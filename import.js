// ============================================================
//  IMPORTA EXCEL - Soccer Pro Experience
//  Modello: CATEGORIE / GIRONI / PARTITE_FASE1 / FASE_FINALE
// ============================================================

async function importaExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  if (!STATE.activeTorneo) {
    alert('⚠️ Crea prima un torneo nella sezione Tornei!');
    return;
  }

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

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    // Verifica fogli obbligatori
    if (!wb.Sheets['CATEGORIE'] || !wb.Sheets['GIRONI']) {
      alert('❌ File non valido!\nIl file deve avere i fogli CATEGORIE e GIRONI.\nScarica il modello corretto.');
      return;
    }

    const allCat  = XLSX.utils.sheet_to_json(wb.Sheets['CATEGORIE'],    { defval: '' });
    const allGir  = XLSX.utils.sheet_to_json(wb.Sheets['GIRONI'],       { defval: '' });
    const allP1   = wb.Sheets['PARTITE_FASE1'] ? XLSX.utils.sheet_to_json(wb.Sheets['PARTITE_FASE1'], { defval: '' }) : [];
    const allFF   = wb.Sheets['FASE_FINALE']   ? XLSX.utils.sheet_to_json(wb.Sheets['FASE_FINALE'],   { defval: '' }) : [];

    // Filtra righe header e vuote
    const catRows = allCat.filter(r => {
      const v = (r['CATEGORIA *'] || '').toString().trim();
      return v && v !== 'CATEGORIA *' && !v.includes('FOGLIO');
    });
    const girRows = allGir.filter(r => r['CATEGORIA *'] && r['GIRONE *'] && r['SQUADRA 1 *']);
    const p1Rows  = allP1.filter(r  => r['CATEGORIA *'] && r['SQUADRA CASA *'] && r['SQUADRA OSPITE *']);
    const ffRows  = allFF.filter(r  => r['CATEGORIA *'] && r['ROUND *'] && r['SQUADRA 1 *'] && r['SQUADRA 2 *']);

    if (!catRows.length) {
      alert('❌ Nessuna categoria trovata!\nControlla il foglio CATEGORIE e assicurati di aver compilato la colonna "CATEGORIA *".');
      return;
    }

    // Costruisci anteprima dettagliata per categoria
    let previewHTML = `
      <div style="margin-top:16px;border-top:2px solid #185FA5;padding-top:14px;">
        <div style="font-weight:700;font-size:15px;color:#0c447c;margin-bottom:12px;">
          📋 Anteprima — verifica prima di importare
        </div>`;

    for (const cat of catRows) {
      const catNome = cat['CATEGORIA *'].toString().trim();
      const nomeCompleto = cat['NOME COMPLETO'] || catNome;
      const qualificate = cat['QUALIFICATE PER GIRONE *'] || 2;

      const myGironi = girRows.filter(r => r['CATEGORIA *'].toString().trim() === catNome);
      const myP1 = p1Rows.filter(r => r['CATEGORIA *'].toString().trim() === catNome);
      const myFF = ffRows.filter(r => r['CATEGORIA *'].toString().trim() === catNome);

      // Conta squadre totali
      let totSquadre = 0;
      const gironiInfo = [];
      for (const g of myGironi) {
        const squadreKeys = Object.keys(g).filter(k => k.startsWith('SQUADRA'));
        const squadre = squadreKeys.map(k => g[k]?.toString().trim()).filter(s => s);
        totSquadre += squadre.length;
        gironiInfo.push({ nome: g['GIRONE *'], squadre });
      }

      previewHTML += `
        <div style="background:white;border:1px solid #c5ddf5;border-radius:10px;padding:12px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="font-weight:700;font-size:14px;color:#185FA5;">📁 ${nomeCompleto}</div>
            <span style="font-size:11px;background:#e3f0fb;color:#0c447c;padding:2px 8px;border-radius:99px;font-weight:600;">
              Top ${qualificate} si qualificano
            </span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
            <div style="background:#f0f6ff;border-radius:6px;padding:6px 8px;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:#185FA5;">${myGironi.length}</div>
              <div style="font-size:10px;color:#888;">Gironi</div>
            </div>
            <div style="background:#f0f6ff;border-radius:6px;padding:6px 8px;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:#185FA5;">${totSquadre}</div>
              <div style="font-size:10px;color:#888;">Squadre</div>
            </div>
            <div style="background:#f0f6ff;border-radius:6px;padding:6px 8px;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:#185FA5;">${myP1.length||'auto'}</div>
              <div style="font-size:10px;color:#888;">Partite</div>
            </div>
          </div>`;

      // Dettaglio gironi
      for (const g of gironiInfo) {
        previewHTML += `
          <div style="font-size:12px;color:#555;margin-bottom:4px;">
            <strong>${g.nome}:</strong> ${g.squadre.join(', ')}
          </div>`;
      }

      if (myFF.length) {
        previewHTML += `<div style="font-size:12px;color:#888;margin-top:6px;">🏆 ${myFF.length} partite fase finale</div>`;
      }

      // Prima partita esempio
      if (myP1.length > 0) {
        const p = myP1[0];
        previewHTML += `
          <div style="font-size:11px;color:#aaa;margin-top:6px;border-top:1px solid #f0f0f0;padding-top:6px;">
            Prima partita: ${p['GIORNO *']||''} ${p['ORARIO *']||''} — ${p['SQUADRA CASA *']} vs ${p['SQUADRA OSPITE *']} (${p['CAMPO']||'campo ?'})
          </div>`;
      }

      previewHTML += `</div>`;
    }

    previewHTML += `
      <div style="margin-top:4px;padding:10px;background:#f5f5f5;border-radius:8px;font-size:12px;color:#666;margin-bottom:12px;">
        Totale: <strong>${catRows.length} categorie</strong> · 
        <strong>${girRows.length} gironi</strong> · 
        <strong>${p1Rows.length} partite fase 1</strong>
        ${ffRows.length ? ` · <strong>${ffRows.length} partite finale</strong>` : ''}
      </div>
      <button onclick="confermaImportazione()" style="width:100%;padding:13px;background:#27ae60;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">
        ✓ Conferma e importa tutto
      </button>
      <button onclick="annullaImportazione()" style="width:100%;padding:10px;background:transparent;color:#666;border:1px solid #ddd;border-radius:10px;font-size:13px;cursor:pointer;font-family:inherit;margin-top:8px;">
        ✕ Annulla
      </button>
    </div>`;

    const preview = document.getElementById('import-preview');
    if (preview) {
      preview.innerHTML = previewHTML;
      preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    window._importData = { catRows, girRows, p1Rows, ffRows };

  } catch(e) {
    console.error('Errore importaExcel:', e);
    alert('❌ Errore nella lettura del file:\n' + e.message);
  }
}

function annullaImportazione() {
  const preview = document.getElementById('import-preview');
  if (preview) preview.innerHTML = '';
  delete window._importData;
}

async function confermaImportazione() {
  const { catRows, girRows, p1Rows, ffRows } = window._importData || {};
  if (!catRows) { toast('Nessun dato da importare'); return; }

  const preview = document.getElementById('import-preview');
  if (preview) preview.innerHTML = `
    <div style="padding:20px;text-align:center;color:#185FA5;">
      <div style="font-size:24px;margin-bottom:8px;">⏳</div>
      <div style="font-weight:600;">Importazione in corso...</div>
      <div style="font-size:12px;color:#888;margin-top:4px;">Non chiudere la pagina</div>
    </div>`;

  try {
    const formatoMap = {
      'final':'final','semi':'semi','quarter':'quarter',
      'quarti':'quarter','semifinali':'semi','solo finale':'final'
    };

    for (const catRow of catRows) {
      const catNome      = catRow['CATEGORIA *'].toString().trim();
      const nomeCompleto = (catRow['NOME COMPLETO'] || catNome).toString().trim();
      const qualificate  = parseInt(catRow['QUALIFICATE PER GIRONE *']) || 2;
      const formatoRaw   = (catRow['FORMATO FINALE *'] || 'semi').toString().toLowerCase().trim();
      const formato      = formatoMap[formatoRaw] || 'semi';

      const cat = await dbSaveCategoria({
        nome: nomeCompleto,
        qualificate,
        formato,
        ordine: catRows.indexOf(catRow),
        torneo_id: STATE.activeTorneo
      });

      const myGironi = girRows.filter(r => r['CATEGORIA *'].toString().trim() === catNome);

      for (const girRow of myGironi) {
        const girNome  = girRow['GIRONE *'].toString().trim();
        const girone   = await dbSaveGirone({ categoria_id: cat.id, nome: girNome });

        // Colonne squadre dinamiche
        const squadreKeys = Object.keys(girRow).filter(k => k.startsWith('SQUADRA'));
        const squadreNomi = squadreKeys.map(k => girRow[k]?.toString().trim()).filter(s => s);

        const squadra_ids = [];
        for (const nome of squadreNomi) {
          let sq = (await dbGetSquadre(STATE.activeTorneo)).find(s => s.nome.toLowerCase() === nome.toLowerCase());
          if (!sq) sq = await dbSaveSquadra({ nome, torneo_id: STATE.activeTorneo });
          squadra_ids.push(sq.id);
        }
        await dbSetGironeSquadre(girone.id, squadra_ids);

        // Partite fase 1
        const myP1 = p1Rows.filter(r =>
          r['CATEGORIA *'].toString().trim() === catNome &&
          r['GIRONE *'].toString().trim() === girNome
        );

        if (myP1.length > 0) {
          await db.from('partite').delete().eq('girone_id', girone.id);
          for (const p of myP1) {
            const s1 = (await dbGetSquadre(STATE.activeTorneo)).find(s => s.nome.toLowerCase() === p['SQUADRA CASA *'].toString().trim().toLowerCase());
            const s2 = (await dbGetSquadre(STATE.activeTorneo)).find(s => s.nome.toLowerCase() === p['SQUADRA OSPITE *'].toString().trim().toLowerCase());
            if (s1 && s2) {
              await db.from('partite').insert({
                girone_id: girone.id,
                home_id:   s1.id,
                away_id:   s2.id,
                giocata:   false,
                orario:    p['ORARIO *']?.toString()  || null,
                giorno:    p['GIORNO *']?.toString()  || null,
                campo:     p['CAMPO']?.toString()     || null,
                giornata:  p['GIORNATA']?.toString()  || null,
              });
            }
          }
        } else {
          await dbGeneraPartite(girone.id, squadra_ids);
        }
      }

      // Fase finale
      const myFF = ffRows.filter(r => r['CATEGORIA *'].toString().trim() === catNome);
      if (myFF.length > 0) {
        await dbDeleteKnockout(cat.id);
        const roundOrder = ['Quarti di finale','Semifinali','3° posto','Finale','5° posto','7° posto',
                            'Consolazione semifinali','Consolazione finale','Consolazione 3° posto'];
        const mc = {};
        for (const f of myFF) {
          const rn = f['ROUND *'].toString().trim();
          if (!mc[rn]) mc[rn] = 0;
          const s1Nome = f['SQUADRA 1 *'].toString().trim();
          const s2Nome = f['SQUADRA 2 *'].toString().trim();
          const s1 = s1Nome !== 'TBD' ? (await dbGetSquadre(STATE.activeTorneo)).find(s => s.nome.toLowerCase() === s1Nome.toLowerCase()) : null;
          const s2 = s2Nome !== 'TBD' ? (await dbGetSquadre(STATE.activeTorneo)).find(s => s.nome.toLowerCase() === s2Nome.toLowerCase()) : null;
          await dbSaveKnockoutMatch({
            categoria_id:    cat.id,
            round_name:      rn,
            round_order:     roundOrder.indexOf(rn) !== -1 ? roundOrder.indexOf(rn) : 99,
            match_order:     mc[rn]++,
            home_id:         s1?.id || null,
            away_id:         s2?.id || null,
            gol_home: 0, gol_away: 0,
            giocata:         false,
            is_consolazione: (f['TIPO']?.toString().toLowerCase() || '').includes('consol'),
            note_home:       s1 ? '' : s1Nome,
            note_away:       s2 ? '' : s2Nome,
          });
        }
      }
    }

    STATE.categorie = await dbGetCategorie(STATE.activeTorneo);
    STATE.activeCat = STATE.categorie[0]?.id || null;
    renderCatBar();
    delete window._importData;

    if (preview) preview.innerHTML = `
      <div style="padding:16px;text-align:center;background:#e8f8ee;border-radius:10px;margin-top:12px;">
        <div style="font-size:24px;margin-bottom:6px;">✅</div>
        <div style="font-weight:700;color:#1a7335;font-size:15px;">Importazione completata!</div>
        <div style="font-size:13px;color:#555;margin-top:4px;">${STATE.categorie.length} categorie caricate</div>
      </div>`;

    setTimeout(async () => {
      await renderAdminSetup();
    }, 1500);

  } catch(e) {
    console.error('Errore confermaImportazione:', e);
    if (preview) preview.innerHTML = '';
    alert('❌ Errore durante importazione:\n' + e.message);
  }
}
