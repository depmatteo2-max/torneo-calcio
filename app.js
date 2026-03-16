// ===== IMPORT EXCEL =====
async function importExcel() {
  const input = document.getElementById('excelFile');
  const file = input?.files?.[0];

  if (!file) {
    alert('Seleziona un file Excel');
    return;
  }

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });

    const partiteSheet = workbook.Sheets['partite'];
    const legendaSheet = workbook.Sheets['legenda'];
    const squadreSheet = workbook.Sheets['squadre'];

    const partiteRows = partiteSheet
      ? XLSX.utils.sheet_to_json(partiteSheet, { defval: '' })
      : [];

    const legendaRows = legendaSheet
      ? XLSX.utils.sheet_to_json(legendaSheet, { defval: '' })
      : [];

    const squadreRows = squadreSheet
      ? XLSX.utils.sheet_to_json(squadreSheet, { defval: '' })
      : [];

    if (!partiteRows.length) {
      alert('Il foglio "partite" è vuoto o mancante');
      return;
    }

    const categorie = await dbGetCategorie();
    const squadre = await dbGetSquadre();

    const catMap = new Map(
      categorie.map(c => [String(c.nome).trim().toLowerCase(), c])
    );

    const teamMap = new Map(
      squadre.map(s => [String(s.nome).trim().toLowerCase(), s])
    );

    const gironeCache = new Map();
    let createdMatches = 0;
    let lastImportedCat = null;

    // ===== CREA/AGGIORNA SQUADRE DAL FOGLIO "squadre" =====
    for (const row of squadreRows) {
      const categoriaNome = String(row.categoria || '').trim();
      const squadraNome = String(row.squadra || '').trim();

      if (!categoriaNome || !squadraNome) continue;

      let cat = catMap.get(categoriaNome.toLowerCase());

      if (!cat) {
        cat = await dbSaveCategoria({
          nome: categoriaNome,
          qualificate: 2,
          formato: 'semi',
          ordine: catMap.size
        });
        catMap.set(categoriaNome.toLowerCase(), cat);
      }

      let sq = teamMap.get(squadraNome.toLowerCase());

      if (!sq) {
        sq = await dbSaveSquadra({ nome: squadraNome });
        teamMap.set(squadraNome.toLowerCase(), sq);
      }
    }

    // ===== CREA PARTITE DAL FOGLIO "partite" =====
    for (const row of partiteRows) {
      const categoriaNome = String(row.categoria || '').trim();
      const gironeNome = String(row.girone || '').trim() || 'Girone A';
      const fase = String(row.fase || '').trim() || 'Fase 1';
      const giornata = Number(row.giornata || 1);
      const orario = String(row.orario || '').trim();
      const campo = String(row.campo || '').trim();
      const casa = String(row['squadra casa'] || row.casa || '').trim();
      const ospite = String(row['squadra ospite'] || row.ospite || '').trim();
      const ordine = Number(row.ordine || 0);
      const priorita = Number(row.priorita || 0);

      if (!categoriaNome || !casa || !ospite) continue;

      let cat = catMap.get(categoriaNome.toLowerCase());

      if (!cat) {
        cat = await dbSaveCategoria({
          nome: categoriaNome,
          qualificate: 2,
          formato: 'semi',
          ordine: catMap.size
        });
        catMap.set(categoriaNome.toLowerCase(), cat);
      }

      lastImportedCat = cat;

      let squadraCasa = teamMap.get(casa.toLowerCase());
      if (!squadraCasa) {
        squadraCasa = await dbSaveSquadra({ nome: casa });
        teamMap.set(casa.toLowerCase(), squadraCasa);
      }

      let squadraOspite = teamMap.get(ospite.toLowerCase());
      if (!squadraOspite) {
        squadraOspite = await dbSaveSquadra({ nome: ospite });
        teamMap.set(ospite.toLowerCase(), squadraOspite);
      }

      const gironeKey = `${cat.id}__${gironeNome}`;
      let girone = gironeCache.get(gironeKey);

      if (!girone) {
        const existingGironi = await dbGetGironi(cat.id);

        girone = existingGironi.find(
          g => String(g.nome).trim().toLowerCase() === gironeNome.toLowerCase()
        );

        if (!girone) {
          girone = await dbSaveGirone({
            categoria_id: cat.id,
            nome: gironeNome
          });
        }

        gironeCache.set(gironeKey, girone);
      }

      const members = await dbGetGironeSquadre(girone.id);
      const currentIds = members
        .map(m => m.squadra_id || m.squadre?.id)
        .filter(Boolean);

      const updatedIds = Array.from(
        new Set([...currentIds, squadraCasa.id, squadraOspite.id])
      );

      await dbSetGironeSquadre(girone.id, updatedIds);

      await dbInsertPartitaManuale({
        girone_id: girone.id,
        home_id: squadraCasa.id,
        away_id: squadraOspite.id,
        fase,
        giornata,
        orario,
        campo,
        ordine,
        priorita
      });

      createdMatches++;
    }

    // ===== IMPORTA LEGENDA =====
    for (const row of legendaRows) {
      const categoriaNome = String(row.categoria || '').trim();
      if (!categoriaNome) continue;

      const cat = catMap.get(categoriaNome.toLowerCase());
      if (!cat) continue;

      await dbSaveLegenda({
        categoria_id: cat.id,
        fase: String(row.fase || '').trim(),
        formula: String(row.formula || '').trim(),
        qualificazioni: String(row.qualificazioni || '').trim(),
        criteri_classifica: String(
          row['criteri classifica'] || row.criteri_classifica || ''
        ).trim(),
        note: String(row.note || '').trim()
      });
    }

    // ===== AGGIORNA INTERFACCIA =====
    STATE.categorie = await dbGetCategorie();

    if (lastImportedCat) {
      const found = STATE.categorie.find(c => c.id === lastImportedCat.id);
      if (found) STATE.activeCat = found.id;
    } else if (!STATE.activeCat && STATE.categorie.length) {
      STATE.activeCat = STATE.categorie[0].id;
    }

    renderCatBar();
    await renderAdminSetup();
    await renderAdminRisultati();
    await renderClassifiche();
    await renderRisultati();

    console.log('Import completato:', {
      partite_importate: createdMatches,
      categoria_attiva: lastImportedCat?.nome || null
    });

    alert(
      `Import Excel completato.\n\nPartite create: ${createdMatches}` +
      `${lastImportedCat ? `\nCategoria attivata: ${lastImportedCat.nome}` : ''}`
    );

  } catch (err) {
    console.error(err);
    alert('Errore import Excel: ' + err.message);
  }
}