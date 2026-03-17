// ============================================================
// APP.JS
// ============================================================

window.addEventListener('DOMContentLoaded', async () => {
  try {
    initDB();
    console.log('DB inizializzato');
  } catch (err) {
    console.error('Errore initDB:', err);
    alert('Errore inizializzazione database');
  }
});

function norm(v) {
  return String(v || '').trim();
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function getOrCreateCategoria(nome) {
  const clean = norm(nome);
  if (!clean) throw new Error('Nome categoria mancante');

  const categorie = await dbGetCategorie();
  let cat = categorie.find(c => norm(c.nome).toLowerCase() === clean.toLowerCase());

  if (!cat) {
    cat = await dbSaveCategoria({
      nome: clean,
      qualificate: 2,
      formato: 'semi',
      ordine: categorie.length
    });
  }

  return cat;
}

async function getOrCreateSquadra(nome) {
  const clean = norm(nome);
  if (!clean) throw new Error('Nome squadra mancante');

  const squadre = await dbGetSquadre();
  let sq = squadre.find(s => norm(s.nome).toLowerCase() === clean.toLowerCase());

  if (!sq) {
    sq = await dbSaveSquadra({ nome: clean });
  }

  return sq;
}

async function getOrCreateGirone(categoria_id, nome) {
  const clean = norm(nome) || 'Girone A';

  const gironi = await dbGetGironi(categoria_id);
  let girone = gironi.find(g => norm(g.nome).toLowerCase() === clean.toLowerCase());

  if (!girone) {
    girone = await dbSaveGirone({
      categoria_id,
      nome: clean
    });
  }

  return girone;
}

async function ensureGironeHasTeams(girone_id, squadraIdsDaAggiungere) {
  const members = await dbGetGironeSquadre(girone_id);
  const currentIds = members
    .map(m => m.squadra_id || m.squadre?.id)
    .filter(Boolean);

  const updatedIds = Array.from(
    new Set([...currentIds, ...squadraIdsDaAggiungere])
  );

  await dbSetGironeSquadre(girone_id, updatedIds);
}

function findSheet(workbook, name) {
  const found = workbook.SheetNames.find(
    s => s.trim().toLowerCase() === name.toLowerCase()
  );
  return found ? workbook.Sheets[found] : null;
}

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

    console.log('Fogli trovati:', workbook.SheetNames);

    const partiteSheet = findSheet(workbook, 'partite');
    const legendaSheet = findSheet(workbook, 'legenda');
    const squadreSheet = findSheet(workbook, 'squadre');

    if (!partiteSheet) {
      alert(
        'Foglio "partite" non trovato.\n\nFogli presenti: ' +
        workbook.SheetNames.join(', ')
      );
      return;
    }

    const partiteRows = XLSX.utils.sheet_to_json(partiteSheet, { defval: '' });
    const legendaRows = legendaSheet
      ? XLSX.utils.sheet_to_json(legendaSheet, { defval: '' })
      : [];
    const squadreRows = squadreSheet
      ? XLSX.utils.sheet_to_json(squadreSheet, { defval: '' })
      : [];

    if (!partiteRows.length) {
      alert('Il foglio "partite" è vuoto');
      return;
    }

    let createdMatches = 0;
    let skippedRows = 0;
    let createdLegends = 0;

    // 1) Squadre opzionali dal foglio "squadre"
    for (const row of squadreRows) {
      const categoriaNome = norm(row.categoria);
      const squadraNome = norm(row.squadra || row.nome);

      if (!categoriaNome || !squadraNome) continue;

      await getOrCreateCategoria(categoriaNome);
      await getOrCreateSquadra(squadraNome);
    }

    // 2) Partite
    for (const row of partiteRows) {
      const categoriaNome = norm(row.categoria);
      const gironeNome = norm(row.girone) || 'Girone A';
      const fase = norm(row.fase) || 'Fase 1';
      const giornata = num(row.giornata, 1);
      const orario = norm(row.orario);
      const campo = norm(row.campo);

      const casa = norm(
        row['squadra casa'] ||
        row.squadra_casa ||
        row.casa ||
        row.home
      );

      const ospite = norm(
        row['squadra ospite'] ||
        row.squadra_ospite ||
        row.ospite ||
        row.away
      );

      const ordine = num(row.ordine, 0);
      const priorita = num(row.priorita, 0);

      if (!categoriaNome || !casa || !ospite) {
        skippedRows++;
        console.log('Riga scartata:', row);
        continue;
      }

      const categoria = await getOrCreateCategoria(categoriaNome);
      const squadraCasa = await getOrCreateSquadra(casa);
      const squadraOspite = await getOrCreateSquadra(ospite);
      const girone = await getOrCreateGirone(categoria.id, gironeNome);

      await ensureGironeHasTeams(girone.id, [squadraCasa.id, squadraOspite.id]);

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

    // 3) Legenda
    for (const row of legendaRows) {
      const categoriaNome = norm(row.categoria);
      if (!categoriaNome) continue;

      const categoria = await getOrCreateCategoria(categoriaNome);

      await dbSaveLegenda({
        categoria_id: categoria.id,
        fase: norm(row.fase),
        formula: norm(row.formula),
        qualificazioni: norm(row.qualificazioni),
        criteri_classifica: norm(
          row['criteri classifica'] || row.criteri_classifica
        ),
        note: norm(row.note)
      });

      createdLegends++;
    }

    console.log('Import completato', {
      righePartite: partiteRows.length,
      partiteCreate: createdMatches,
      righeScartate: skippedRows,
      legendeCreate: createdLegends
    });

    alert(
      'Import Excel completato.\n\n' +
      'Righe lette: ' + partiteRows.length + '\n' +
      'Partite create: ' + createdMatches + '\n' +
      'Righe scartate: ' + skippedRows + '\n' +
      'Legende create: ' + createdLegends
    );
  } catch (err) {
    console.error('Errore importExcel:', err);
    alert('Errore import Excel: ' + err.message);
  }
}