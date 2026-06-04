// ============================================================
//  genera_data_json.js — Script da eseguire DALL'ADMIN
//  Genera data.json con tutti i dati del torneo
//  Incolla questo nella console F12 quando sei loggato come admin
// ============================================================

async function generaEPubblicaDataJson() {
  toast('⏳ Generazione data.json...');
  try {
    const torneoId = STATE.activeTorneo;
    const cats = await dbGetCategorie(torneoId);
    const catIds = cats.map(c => c.id);

    const gwdAll = {}, koAll = {};
    for (const catId of catIds) {
      _cacheInvalid('gwd_' + catId);
      _cacheInvalid('ko_' + catId);
    }
    await Promise.all(catIds.map(async catId => {
      const [gwd, ko] = await Promise.all([
        getGironiWithData(catId),
        dbGetKnockout(catId)
      ]);
      gwdAll[catId] = gwd;
      koAll[catId] = ko;
    }));

    const tornei = await dbGetTornei();

    const payload = JSON.stringify({
      ts: Date.now(),
      tornei,
      categorie_by_torneo: { [torneoId]: cats },
      gwd_by_cat: gwdAll,
      ko_by_cat: koAll
    });

    // Scarica il file data.json
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);

    toast('✅ data.json scaricato! Caricalo su GitHub/Cloudflare');
    console.log('[data.json] Dimensione:', Math.round(payload.length/1024), 'KB');
  } catch(e) {
    toast('❌ Errore: ' + e.message);
  }
}
