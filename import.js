// ============================================================
//  IMPORTA EXCEL - Soccer Pro Experience v3
// ============================================================

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function importaExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  toast('⏳ Lettura file Excel...');
  try {
    if (typeof XLSX === 'undefined') {
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    }
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });

    const cats    = wb.Sheets['CATEGORIE']    ? XLSX.utils.sheet_to_json(wb.Sheets['CATEGORIE'],    { defval: '' }) : [];
    const girs    = wb.Sheets['GIRONI']       ? XLSX.utils.sheet_to_json(wb.Sheets['GIRONI'],       { defval: '' }) : [];
    const parts1  = wb.Sheets['PARTITE_FASE1']? XLSX.utils.sheet_to_json(wb.Sheets['PARTITE_FASE1'],{ defval: '' }) : [];
    const sf2     = wb.Sheets['STRUTTURA_FASE2'] ? XLSX.utils.sheet_to_json(wb.Sheets['STRUTTURA_FASE2'],{ defval: '' }) : [];
    const pf2     = wb.Sheets['PARTITE_FASE2']? XLSX.utils.sheet_to_json(wb.Sheets['PARTITE_FASE2'],{ defval: '' }) : [];
    const finals  = wb.Sheets['FASE_FINALE']  ? XLSX.utils.sheet_to_json(wb.Sheets['FASE_FINALE'],  { defval: '' }) : [];

    const catRows  = cats.filter(r => r['CATEGORIA *'] && !r['CATEGORIA *'].toString().includes('CATEGORIA') && !r['CATEGORIA *'].toString().includes('QUALIFICATE'));
    const girRows  = girs.filter(r => r['CATEGORIA *'] && r['GIRONE *'] && r['SQUADRA 1 *']);
    const p1Rows   = parts1.filter(r => r['CATEGORIA *'] && r['SQUADRA CASA *'] && r['SQUADRA OSPITE *']);
    const sf2Rows  = sf2.filter(r => {
      const v = (r['CATEGORIA *'] || '').toString();
      return v && !v.includes('TIPO') && !v.includes('ESEMPIO') && !v.includes('⭐') && !v.includes('CATEGORIA');
    });
    const pf2Rows  = pf2.filter(r => r['CATEGORIA *'] && r['NOME GRUPPO *'] && r['SQUADRA 1'] && r['SQUADRA 2']);
    const ffRows   = finals.filter(r => r['CATEGORIA *'] && r['ROUND *'] && r['SQUADRA 1 *'] && r['SQUADRA 2 *']);

    if (!catRows.length) { toast('❌ Nessuna categoria trovata'); return; }

    const preview = document.getElementById('import-preview');
    if (preview) {
      preview.innerHTML = `<div style="background:#e3f0fb;border-radius:10px;padding:14px;margin-top:14px;font-size:13px;">
        <div style="font-weight:700;margin-bottom:10px;color:#0c447c;">📋 Anteprima importazione</div>
        <div>✅ <strong>${catRows.length} categorie:</strong> ${catRows.map(r=>r['CATEGORIA *']).join(', ')}</div>
        <div style="margin-top:4px;">✅ ${girRows.length} gironi</div>
        <div style="margin-top:4px;">✅ ${p1Rows.length} partite fase 1</div>
        ${sf2Rows.length ? `<div style="margin-top:4px;">✅ ${sf2Rows.length} righe struttura fase 2</div>` : ''}
        ${pf2Rows.length ? `<div style="margin-top:4px;">✅ ${pf2Rows.length} orari fase 2</div>` : ''}
        ${ffRows.length  ? `<div style="margin-top:4px;">✅ ${ffRows.length} partite fase finale</div>` : ''}
        <button class="btn btn-p" style="margin-top:14px;width:100%;" onclick="confermaImportazione()">✓ Conferma e importa</button>
        <button class="btn" style="margin-top:6px;width:100%;" onclick="document.getElementById('import-preview').innerHTML=''">✕ Annulla</button>
      </div>`;
      window._importData = { catRows, girRows, p1Rows, sf2Rows, pf2Rows, ffRows };
    }
  } catch(e) {
    console.error(e);
    toast('❌ Errore lettura: ' + e.message);
  }
}

async function confermaImportazione() {
  const { catRows, girRows, p1Rows, sf2Rows, pf2Rows, ffRows } = window._importData || {};
  if (!catRows) { toast('Nessun dato'); return; }
  document.getElementById('import-preview').innerHTML = '<div style="padding:14px;color:#185FA5;">⏳ Importazione in corso...</div>';

  try {
    for (const catRow of catRows) {
      const catNome = (catRow['CATEGORIA *'] || '').toString().trim();
      const nomeCompleto = (catRow['NOME COMPLETO'] || catNome).toString().trim();
      const qualificate = parseInt(catRow['QUALIFICATE PER GIRONE *']) || 2;
      const haFase2 = (catRow['HA FASE 2? *'] || 'SI').toString().toUpperCase().trim() === 'SI';
      if (!catNome) continue;

      const cat = await dbSaveCategoria({
        nome: nomeCompleto,
        qualificate,
        formato: haFase2 ? 'semi' : 'girone',
        ordine: catRows.indexOf(catRow),
      });

      // --- GIRONI ---
      const gironeMap = {};
      const myGironi = girRows.filter(r => r['CATEGORIA *'].toString().trim() === catNome);

      for (const girRow of myGironi) {
        const girNome = girRow['GIRONE *'].toString().trim();
        const girone = await dbSaveGirone({ categoria_id: cat.id, nome: girNome });

        const colSquadre = Object.keys(girRow).filter(k => k.startsWith('SQUADRA'));
        const squadreNomi = colSquadre.map(k => girRow[k]?.toString().trim()).filter(s => s);

        const squadra_ids = [];
        for (const nome of squadreNomi) {
          let sq = (await dbGetSquadre()).find(s => s.nome.toLowerCase() === nome.toLowerCase());
          if (!sq) sq = await dbSaveSquadra({ nome });
          squadra_ids.push(sq.id);
        }
        await dbSetGironeSquadre(girone.id, squadra_ids);
        gironeMap[girNome] = { id: girone.id, squadra_ids };

        const myP1 = p1Rows.filter(r =>
          r['CATEGORIA *'].toString().trim() === catNome &&
          r['GIRONE *'].toString().trim() === girNome
        );
        if (myP1.length > 0) {
          await db.from('partite').delete().eq('girone_id', girone.id);
          for (const p of myP1) {
            const s1 = (await dbGetSquadre()).find(s => s.nome.toLowerCase() === p['SQUADRA CASA *'].toString().trim().toLowerCase());
            const s2 = (await dbGetSquadre()).find(s => s.nome.toLowerCase() === p['SQUADRA OSPITE *'].toString().trim().toLowerCase());
            if (s1 && s2) await db.from('partite').insert({
              girone_id: girone.id, home_id: s1.id, away_id: s2.id, giocata: false,
              orario: p['ORARIO *']?.toString() || null,
              giorno: p['GIORNO *']?.toString() || null,
              campo:  p['CAMPO']?.toString()    || null,
              giornata: p['GIORNATA']?.toString() || null,
            });
          }
        } else {
          await dbGeneraPartite(girone.id, squadra_ids);
        }
      }

      // --- FASE 2 ---
      const mySF2 = sf2Rows.filter(r => r['CATEGORIA *'].toString().trim() === catNome);
      if (mySF2.length > 0) {
        await dbDeleteKnockout(cat.id);
        const gruppi = {};
        for (const row of mySF2) {
          const g = (row['NOME GRUPPO *'] || row['NOME GRUPPO'] || '').toString().trim();
          if (!g) continue;
          if (!gruppi[g]) gruppi[g] = {
            tipo: (row['TIPO *'] || 'triangolare').toString().toLowerCase(),
            isConsol: (row['TIPO GRUPPO'] || '').toString().toLowerCase().includes('consol'),
            ordine: parseInt(row['ORDINE'] || 0) || 0,
            partite: []
          };
          gruppi[g].partite.push({
            sq1Ref: (row['SQUADRA 1 *'] || row['SQUADRA 1'] || '').toString().trim(),
            sq2Ref: (row['SQUADRA 2 *'] || row['SQUADRA 2'] || '').toString().trim(),
          });
        }

        const resolveRef = async (ref) => {
          if (!ref || ref === 'TBD') return null;
          const m = ref.match(/^(\d+)[°oa]\s+(.+)$/i);
          if (m) {
            const pos = parseInt(m[1]) - 1;
            const gNome = m[2].trim();
            const gInfo = gironeMap[gNome];
            if (gInfo) {
              const partite = await dbGetPartite(gInfo.id);
              const cl = calcClSimple(gInfo.squadra_ids, partite);
              return cl[pos] || null;
            }
          }
          const sq = (await dbGetSquadre()).find(s => s.nome.toLowerCase() === ref.toLowerCase());
          return sq?.id || null;
        };

        const mc = {};
        for (const [nome, g] of Object.entries(gruppi)) {
          if (!mc[nome]) mc[nome] = 0;
          const orariG = pf2Rows.filter(r =>
            r['CATEGORIA *'].toString().trim() === catNome &&
            (r['NOME GRUPPO *'] || '').toString().trim() === nome
          );
          for (let i = 0; i < g.partite.length; i++) {
            const { sq1Ref, sq2Ref } = g.partite[i];
            const h = await resolveRef(sq1Ref);
            const a = await resolveRef(sq2Ref);
            const or = orariG[i] || null;
            await dbSaveKnockoutMatch({
              categoria_id: cat.id, round_name: nome,
              round_order: g.ordine, match_order: mc[nome]++,
              home_id: h, away_id: a,
              gol_home: 0, gol_away: 0, giocata: false,
              is_consolazione: g.isConsol,
              note_home: h ? '' : sq1Ref,
              note_away: a ? '' : sq2Ref,
              orario: or?.['ORARIO *']?.toString() || null,
              giorno: or?.['GIORNO *']?.toString() || null,
              campo:  or?.['CAMPO']?.toString()    || null,
            });
          }
        }
      }

      // --- FASE FINALE ---
      const myFF = ffRows.filter(r => r['CATEGORIA *'].toString().trim() === catNome);
      if (myFF.length > 0) {
        const ro = ['Quarti di finale','Semifinali','3° posto','Finale','5° posto','7° posto'];
        const mc2 = {};
        for (const f of myFF) {
          const rn = f['ROUND *'].toString().trim();
          if (!mc2[rn]) mc2[rn] = 0;
          const s1 = (await dbGetSquadre()).find(s => s.nome.toLowerCase() === f['SQUADRA 1 *'].toString().trim().toLowerCase());
          const s2 = (await dbGetSquadre()).find(s => s.nome.toLowerCase() === f['SQUADRA 2 *'].toString().trim().toLowerCase());
          await dbSaveKnockoutMatch({
            categoria_id: cat.id, round_name: rn,
            round_order: ro.indexOf(rn) !== -1 ? ro.indexOf(rn) : 99,
            match_order: mc2[rn]++,
            home_id: s1?.id || null, away_id: s2?.id || null,
            gol_home: 0, gol_away: 0, giocata: false,
            is_consolazione: (f['TIPO']?.toString() || '').toLowerCase().includes('consol'),
            note_home: s1 ? '' : f['SQUADRA 1 *'].toString().trim(),
            note_away: s2 ? '' : f['SQUADRA 2 *'].toString().trim(),
          });
        }
      }
    }

    STATE.categorie = await dbGetCategorie();
    STATE.activeCat = STATE.categorie[0]?.id || null;
    renderCatBar();
    delete window._importData;
    toast('✅ Importazione completata!');
    await renderAdminSetup();

  } catch(e) {
    console.error(e);
    toast('❌ Errore: ' + e.message);
  }
}

function calcClSimple(squadra_ids, partite) {
  const map = {};
  for (const id of squadra_ids) map[id] = { id, pts: 0, gf: 0, gs: 0 };
  for (const p of partite) {
    if (!p.giocata) continue;
    if (map[p.home_id]) { map[p.home_id].gf += p.gol_home; map[p.home_id].gs += p.gol_away; }
    if (map[p.away_id]) { map[p.away_id].gf += p.gol_away; map[p.away_id].gs += p.gol_home; }
    if (p.gol_home > p.gol_away) { if(map[p.home_id]) map[p.home_id].pts += 3; }
    else if (p.gol_home < p.gol_away) { if(map[p.away_id]) map[p.away_id].pts += 3; }
    else { if(map[p.home_id]) map[p.home_id].pts++; if(map[p.away_id]) map[p.away_id].pts++; }
  }
  return Object.values(map).sort((a,b) => b.pts-a.pts || (b.gf-b.gs)-(a.gf-a.gs)).map(r => r.id);
}
