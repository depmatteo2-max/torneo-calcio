// ============================================================
//  SCRIPT COMPRESSIONE LOGHI ESISTENTI — esegui in console
//  Vai su torneo-rhodense.pages.dev → F12 → Console → incolla
// ============================================================
(async function() {
  console.log('🔄 Inizio compressione loghi...');

  function comprimiBase64(base64, maxSize = 80, quality = 0.70) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
        else        { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = base64;
    });
  }

  // Legge tutte le squadre con logo
  const { data: squadre, error } = await db
    .from('squadre')
    .select('id, nome, logo')
    .not('logo', 'is', null);

  if (error) { console.error('Errore lettura:', error); return; }
  
  const conLogo = squadre.filter(s => s.logo && s.logo.startsWith('data:'));
  console.log(`📋 Trovate ${conLogo.length} squadre con logo da comprimere`);

  let ok = 0, skipped = 0;

  for (const sq of conLogo) {
    const originalKB = Math.round(sq.logo.length * 0.75 / 1024);
    
    // Salta se già piccolo (< 15KB)
    if (originalKB < 15) {
      console.log(`⏩ ${sq.nome} — già piccolo (${originalKB}KB)`);
      skipped++;
      continue;
    }

    try {
      const compressed = await comprimiBase64(sq.logo, 80, 0.70);
      const newKB = Math.round(compressed.length * 0.75 / 1024);

      const { error: updateErr } = await db
        .from('squadre')
        .update({ logo: compressed })
        .eq('id', sq.id);

      if (updateErr) {
        console.error(`❌ ${sq.nome}:`, updateErr.message);
      } else {
        console.log(`✅ ${sq.nome}: ${originalKB}KB → ${newKB}KB (-${Math.round((1-newKB/originalKB)*100)}%)`);
        ok++;
      }
    } catch(e) {
      console.error(`❌ ${sq.nome}:`, e);
    }

    // Pausa per non sovraccaricare
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n🏁 Completato! ${ok} loghi compressi, ${skipped} saltati`);
  console.log('🔄 Ricarica la pagina per vedere i miglioramenti');
})();
