// ============================================================
//  import_garda_patch.js — PATCH GARDA v7
//  Sovrascrive _parseExcelRiga + include tutte le funzioni
//  di lettura Excel + risoluzione accoppiamenti
// ============================================================

// ── FUNZIONI LETTURA EXCEL ───────────────────────────────────

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
  const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
  const hi = trovaRigaHeader(rows, ['CATEGORIA']);
  const hdrs = rows[hi].map(h => String(h||'').trim());
  const iCat  = hdrs.findIndex(h => h.toUpperCase().includes('CATEGORIA'));
  const iQual = hdrs.findIndex(h => h.toUpperCase().includes('QUALIFICATE') || h.toUpperCase().includes('QUAL'));
  const iForm = hdrs.findIndex(h => h.toUpperCase().includes('FORMATO'));
  return rows.slice(hi+1)
    .filter(r => {
      const cat = String(r[iCat>=0?iCat:0]||'').trim();
      return cat && !cat.toUpperCase().includes('SPAREGGIO') && !cat.startsWith('ℹ') && !cat.startsWith('*');
    })
    .map(r => {
      const codice = String(r[iCat>=0?iCat:0]||'').trim();
      return {
        codice, nome: codice,
        qualificate: parseInt(String(r[iQual>=0?iQual:1]||'')) || 1,
        formato: String(r[iForm>=0?iForm:2]||'').trim() || 'gironi'
      };
    });
}

function leggiGironi(wb) {
  const ws = wb.Sheets['GIRONI'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
  const hi = trovaRigaHeader(rows, ['CATEGORIA','GIRONE']);
  return rows.slice(hi+1)
    .filter(r => String(r[0]||'').trim() && String(r[1]||'').trim())
    .map(r => {
      const squadre = [];
      for (let i = 2; i < r.length; i++) {
        const s = String(r[i]||'').trim();
        if (s) squadre.push(s);
      }
      return { categoria: String(r[0]||'').trim(), nome: String(r[1]||'').trim(), squadre };
    })
    .filter(g => g.squadre.length > 0);
}

function leggiPartiteFase1(wb) {
  const ws = wb.Sheets['PARTITE_FASE1'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
  const hi = trovaRigaHeader(rows, ['CATEGORIA','GIRONE']);
  const hdrs = rows[hi].map(h => String(h||'').trim());
  const iCat   = hdrs.findIndex(h => h.toUpperCase().includes('CATEGORIA'));
  const iGir   = hdrs.findIndex(h => h.toUpperCase().includes('GIRONE'));
  const iOra   = hdrs.findIndex(h => h.toUpperCase().includes('ORARIO') || h.toUpperCase() === 'ORA');
  const iGior  = hdrs.findIndex(h => h.toUpperCase().includes('GIORNO') || h.toUpperCase().includes('DATA'));
  const iCampo = hdrs.findIndex(h => h.toUpperCase().includes('CAMPO'));
  const iGiorn = hdrs.findIndex(h => h.toUpperCase().includes('GIORNATA'));
  let iHome = hdrs.findIndex(h => h.toUpperCase().includes('CASA') || h.toUpperCase() === 'HOME');
  let iAway = hdrs.findIndex(h => h.toUpperCase().includes('OSPITE') || h.toUpperCase() === 'AWAY');
  if (iHome < 0) iHome = 2;
  if (iAway < 0) iAway = 3;
  return rows.slice(hi+1)
    .filter(r => String(r[iCat>=0?iCat:0]||'').trim() && String(r[iHome]||'').trim() && String(r[iAway]||'').trim())
    .map(r => ({
      categoria: String(r[iCat>=0?iCat:0]||'').trim(),
      girone:    String(r[iGir>=0?iGir:1]||'').trim(),
      home:      String(r[iHome]||'').trim(),
      away:      String(r[iAway]||'').trim(),
      orario:    iOra>=0   ? String(r[iOra]  ||'').trim() : '',
      giorno:    iGior>=0  ? String(r[iGior] ||'').trim() : '',
      campo:     iCampo>=0 ? String(r[iCampo]||'').trim() : '',
      giornata:  iGiorn>=0 ? String(r[iGiorn]||'').trim() : '',
    }));
}

function _getRoundMeta(round) {
  const r = round.toUpperCase().trim();
  const mSem = r.match(/SEMIFINALE\s*(\d+)/);
  if (mSem) {
    const n = parseInt(mSem[1]);
    return { order: 10+n-1, consolazione: false, emoji: '⚔️', desc: 'Semifinale '+n };
  }
  const mFin = r.match(/FINALE\s+(\d+)[°º]?\s*[-–]\s*(\d+)[°º]?\s*POSTO/);
  if (mFin) {
    const p1 = parseInt(mFin[1]), p2 = parseInt(mFin[2]);
    return { order: 20+p1-1, consolazione: p1>2, emoji: p1===1?'🥇':p1===3?'🥉':'🏅', desc: 'Finale '+p1+'°-'+p2+'° posto' };
  }
  return null;
}

function leggiPartiteFase2(wb) {
  const ws = wb.Sheets['FASE_FINALE'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
  const hi = trovaRigaHeader(rows, ['CATEGORIA','ROUND']);
  const hdrs = rows[hi].map(h => String(h||'').trim());
  return rows.slice(hi+1)
    .map((r, idx) => {
      const obj = {};
      hdrs.forEach((h,i) => { if(h) obj[h] = String(r[i]||'').trim(); });
      return { obj, idx };
    })
    .filter(({ obj }) => {
      const cat   = col(obj,'CATEGORIA');
      const round = col(obj,'ROUND').toUpperCase().trim();
      return cat && _getRoundMeta(round) !== null;
    })
    .map(({ obj, idx }) => {
      const round = col(obj,'ROUND').toUpperCase().trim();
      const meta  = _getRoundMeta(round);
      return {
        categoria:    col(obj,'CATEGORIA'),
        round,
        roundLabel:   `${meta.emoji} ${round} — ${meta.desc}`,
        roundOrder:   meta.order,
        matchOrder:   idx,
        consolazione: meta.consolazione,
        orario:       col(obj,'ORARIO','ORA'),
        campo:        col(obj,'CAMPO'),
        giorno:       col(obj,'GIORNO','DATA'),
        sq1raw:       col(obj,'SQUADRA CASA','SQUADRA 1','CASA','HOME'),
        sq2raw:       col(obj,'SQUADRA OSPITE','SQUADRA 2','OSPITE','AWAY'),
      };
    });
}

// ── SOVRASCRIVE _parseExcelRiga ──────────────────────────────
// Necessario perché l'originale chiama leggiCategorie() che non era definita

let _fileRighe = {};

async function _parseExcelRiga(file, idx) {
  const preview = document.getElementById('cat-preview-' + idx);
  const btnDiv  = document.getElementById('cat-btn-' + idx);
  if (preview) { preview.style.display='block'; preview.innerHTML='<div style="font-size:12px;color:var(--testo-xs);">⏳ Lettura file...</div>'; }

  try {
    if (typeof XLSX === 'undefined') {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf, { type:'array' });

    const dati = {
      categorie: leggiCategorie(wb),
      gironi:    leggiGironi(wb),
      partite:   leggiPartiteFase1(wb),
      fase2:     leggiPartiteFase2(wb)
    };

    _fileRighe[idx] = dati;

    const nomeCatInput = document.getElementById('cat-nome-' + idx);
    if (nomeCatInput && !nomeCatInput.value.trim() && dati.categorie.length) {
      nomeCatInput.value = dati.categorie[0].nome;
    }

    if (preview) {
      preview.innerHTML = `
        <div style="background:var(--verde-bg);border:1px solid rgba(22,163,74,0.2);border-radius:8px;padding:10px 12px;font-size:12px;">
          <div style="font-weight:700;color:var(--verde);margin-bottom:6px;">✅ File letto correttamente</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <span style="background:white;padding:2px 8px;border-radius:20px;color:var(--testo-2);">🏟 ${dati.gironi.length} gironi</span>
            <span style="background:white;padding:2px 8px;border-radius:20px;color:var(--testo-2);">⚽ ${dati.partite.length} partite</span>
            ${dati.fase2.length ? `<span style="background:white;padding:2px 8px;border-radius:20px;color:var(--testo-2);">🏆 ${dati.fase2.length} finali</span>` : ''}
          </div>
        </div>`;
    }

    if (btnDiv) {
      btnDiv.style.display = 'block';
      const nome = nomeCatInput?.value || 'categoria';
      const btn  = btnDiv.querySelector('button');
      if (btn) btn.textContent = '✓ Importa "' + nome + '"';
    }

  } catch(e) {
    if (preview) preview.innerHTML = '<div style="color:var(--rosso);font-size:12px;">❌ Errore: ' + e.message + '</div>';
    console.error('[Garda patch] _parseExcelRiga:', e);
  }
}

// ── RISOLUZIONE ACCOPPIAMENTI ────────────────────────────────

window.risolviManuale = async function() {
  if (!STATE.activeCat) return;
  toast('⏳ Calcolo classifiche...');
  try {
    const { data: gironiDB } = await db.from('gironi').select('id,nome').eq('categoria_id', STATE.activeCat);
    if (!gironiDB?.length) { toast('Nessun girone trovato'); return; }

    const cls = {};
    for (const g of gironiDB) {
      const { data: pp } = await db.from('partite')
        .select('home_id,away_id,gol_home,gol_away,giocata').eq('girone_id', g.id);
      const giocate = (pp||[]).filter(p => p.giocata && p.home_id && p.away_id);
      if (!giocate.length) continue;
      const sqIds = [...new Set(giocate.flatMap(p => [p.home_id, p.away_id]))];
      const { data: sqList } = await db.from('squadre').select('id,nome,logo').in('id', sqIds);
      if (!sqList?.length) continue;
      const st = {};
      sqList.forEach(s => st[s.id] = { sq:s, g:0, v:0, p:0, s:0, gf:0, gs:0, pts:0 });
      for (const p of giocate) {
        const h=st[p.home_id], a=st[p.away_id]; if(!h||!a) continue;
        h.g++; a.g++; h.gf+=p.gol_home; h.gs+=p.gol_away; a.gf+=p.gol_away; a.gs+=p.gol_home;
        if(p.gol_home>p.gol_away){h.v++;h.pts+=3;a.s++;}
        else if(p.gol_home<p.gol_away){a.v++;a.pts+=3;h.s++;}
        else{h.p++;h.pts++;a.p++;a.pts++;}
      }
      const srt=(a,b)=>b.pts!==a.pts?b.pts-a.pts:(b.gf-b.gs)!==(a.gf-a.gs)?(b.gf-b.gs)-(a.gf-a.gs):b.gf-a.gf;
      cls[g.nome] = Object.values(st).sort(srt);
    }

    const nG = Object.keys(cls).length;
    if (!nG) { toast('⏳ Inserisci prima i risultati dei gironi'); return; }

    const srt=(a,b)=>b.pts!==a.pts?b.pts-a.pts:(b.gf-b.gs)!==(a.gf-a.gs)?(b.gf-b.gs)-(a.gf-a.gs):b.gf-a.gf;
    const rank=(pos)=>Object.values(cls).map(cl=>cl[pos]).filter(Boolean).sort(srt);
    const P=rank(0), S=rank(1), T=rank(2), Q=rank(3);

    console.log('[Garda] Prime:  ', P.map(r=>r.sq.nome+'('+r.pts+'pt)').join(' | '));
    console.log('[Garda] Seconde:', S.map(r=>r.sq.nome+'('+r.pts+'pt)').join(' | '));
    console.log('[Garda] Terze:  ', T.map(r=>r.sq.nome+'('+r.pts+'pt)').join(' | '));
    console.log('[Garda] Quarte: ', Q.map(r=>r.sq.nome+'('+r.pts+'pt)').join(' | '));

    const map = {
      'migliore i':           P[0]?.sq?.id,
      'migliore ii':          P[1]?.sq?.id,
      'migliore iii':         P[2]?.sq?.id,
      'migliore iv':          S[0]?.sq?.id,
      'seconda migliore i':   S[0]?.sq?.id,
      'seconda migliore ii':  S[1]?.sq?.id,
      'seconda migliore iii': S[2]?.sq?.id,
      'seconda migliore iv':  T[0]?.sq?.id,
      'peggior i':            P[P.length-1]?.sq?.id,
      'peggior ii':           P[P.length-2]?.sq?.id,
      'peggior iii':          T[T.length-1]?.sq?.id,
      'peggior quarta':       Q[Q.length-1]?.sq?.id,
      'peggior quarte':       Q[Q.length-1]?.sq?.id,
    };

    const { data: koList } = await db.from('knockout')
      .select('id,note_home,note_away,home_id,away_id').eq('categoria_id', STATE.activeCat);

    let risolti = 0;
    for (const ko of (koList||[])) {
      const upd = {};
      const nh = (ko.note_home||'').trim().toLowerCase();
      const na = (ko.note_away||'').trim().toLowerCase();
      if (nh && map[nh] && map[nh] !== ko.home_id) upd.home_id = map[nh];
      if (na && map[na] && map[na] !== ko.away_id) upd.away_id = map[na];
      if (Object.keys(upd).length) {
        await db.from('knockout').update(upd).eq('id', ko.id);
        risolti++;
      }
    }

    if (risolti > 0) {
      toast('✅ '+risolti+' accoppiamenti risolti!');
      if (typeof _mostraNotificaTriangolari==='function') _mostraNotificaTriangolari();
      if (typeof renderAdminKnockout==='function') await renderAdminKnockout();
      if (typeof renderTabellone==='function') await renderTabellone();
    } else {
      const nr=(koList||[]).filter(ko=>ko.note_home||ko.note_away);
      console.warn('[Garda] Note non risolte:', nr.map(ko=>`"${ko.note_home}" vs "${ko.note_away}" home_id=${ko.home_id}`));
      toast('ℹ️ '+nG+' gironi calcolati — vedi console F12');
    }
  } catch(e) { console.error('[Garda]',e); toast('❌ '+e.message); }
};

const _verificaOrig = window.verificaEGeneraTriangolari;
window.verificaEGeneraTriangolari = async function(categoriaId) {
  if (typeof _verificaOrig==='function') await _verificaOrig(categoriaId);
  if (categoriaId===STATE.activeCat) try { await window.risolviManuale(); } catch(e) {}
};

console.log('✅ Garda patch v7 — _parseExcelRiga + leggiCategorie inclusi');
