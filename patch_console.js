renderClassifiche = async function() {
  var el = document.getElementById('sec-classifiche');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }
  el.innerHTML = '<div style="padding:20px;text-align:center;">⏳ Caricamento...</div>';
  if (typeof _cacheInvalid === 'function') _cacheInvalid('gwd_');
  var gironi = await getGironiWithData(STATE.activeCat);
  var cat = STATE.categorie.find(function(c){return c.id===STATE.activeCat;});

  var isClassif = function(g) { var n=(g.nome||'').toLowerCase(); return n.includes('classif')||n.includes('migliori')||g.partite.length===0; };
  var isPlaceh = function(s) { if(!s)return true; return /^\d+[°º]?\s/.test(s)||/^(miglior|peggior)/i.test(s); };

  // Costruisce statsPerSquadra da gironi normali
  var statsPerSquadra = {};
  var classificheGironi = {};
  var html = '';

  for (var gi=0; gi<gironi.length; gi++) {
    var g = gironi[gi];
    if (isClassif(g)) continue;

    // Squadre valide (solo primo passaggio - senza placeholder)
    var sqMap = {};
    for (var pi=0; pi<g.partite.length; pi++) {
      var p = g.partite[pi];
      if (p.home && p.home.id && !isPlaceh(p.home.nome)) sqMap[p.home.id]=p.home;
      if (p.away && p.away.id && !isPlaceh(p.away.nome)) sqMap[p.away.id]=p.away;
    }
    var sq = Object.values(sqMap);
    if (sq.length < 2) sq = (g.squadre||[]).filter(function(s){return s&&s.id&&!isPlaceh(s.nome);});
    if (sq.length < 2) continue;
    // Se non abbiamo tutte le squadre, salta - sarà il secondo passaggio a gestirlo
    var expectedSq = 4; // ogni girone ha 4 squadre
    if (sq.length < expectedSq) continue;

    var cl = calcGironeClassifica({squadre:sq, partite:g.partite});
    if (!cl.length) continue;
    var key = g.nome.toUpperCase().trim();
    classificheGironi[key] = cl;

    cl.forEach(function(row,idx){
      if (!row.sq||!row.sq.id) return;
      statsPerSquadra[row.sq.id] = {sq:row.sq,pts:row.pts,g:row.g,v:row.v,p:row.p,s:row.s,gf:row.gf,gs:row.gs,gironeNome:key};
    });

    var played = g.partite.filter(function(p){return p.giocata;}).length;
    if (played===0) continue;

    html += '<div class="card" style="margin-bottom:8px;">';
    html += '<div class="card-title">'+g.nome+'<span class="badge badge-gray">'+played+'/'+g.partite.length+'</span></div>';
    html += '<table class="standings-table"><thead><tr><th></th><th colspan="2">Squadra</th><th>G</th><th>V</th><th>P</th><th>S</th><th>GD</th><th>Pt</th></tr></thead><tbody>';
    cl.forEach(function(row,idx){
      var q=idx<(cat&&cat.qualificate||1);
      var diff=row.gf-row.gs;
      html += '<tr class="'+(q?'qualifies':'')+'"><td><span class="'+(q?'q-dot':'nq-dot')+'"></span></td>';
      html += '<td>'+logoHTML(row.sq,'sm')+'</td><td>'+row.sq.nome+'</td>';
      html += '<td>'+row.g+'</td><td>'+row.v+'</td><td>'+row.p+'</td><td>'+row.s+'</td>';
      html += '<td class="'+(diff>0?'diff-pos':diff<0?'diff-neg':'')+'>'+(diff>0?'+':'')+diff+'</td>';
      html += '<td class="pts-col">'+row.pts+'</td></tr>';
    });
    html += '</tbody></table></div>';
  }

  // Classifiche speciali
  var mkSpeciale = function(lista, titolo, colore) {
    if (!lista.length) return '';
    var rows='';
    lista.forEach(function(row,idx){
      var dr=row.gf-row.gs;
      rows+='<tr class="'+(idx===0?'qualifies':'')+'"><td style="text-align:center;font-weight:800;color:'+colore+';">'+(idx+1)+'</td>';
      rows+='<td>'+logoHTML(row.sq,'sm')+'</td><td style="font-weight:600;">'+row.sq.nome+'</td>';
      rows+='<td style="font-size:11px;color:var(--testo-xs);">'+(row.girone||'')+'</td>';
      rows+='<td>'+row.g+'</td><td>'+row.v+'</td><td>'+row.p+'</td><td>'+row.s+'</td>';
      rows+='<td class="'+(dr>0?'diff-pos':dr<0?'diff-neg':'')+'">'+( dr>0?'+':'')+dr+'</td>';
      rows+='<td class="pts-col">'+row.pts+'</td></tr>';
    });
    return '<div class="card" style="margin-bottom:8px;border-left:4px solid '+colore+';"><div class="card-title" style="color:'+colore+';">'+titolo+'<span class="badge badge-gray">'+lista.length+' squadre</span></div><table class="standings-table"><thead><tr><th>#</th><th colspan="2">Squadra</th><th>G.ne</th><th>G</th><th>V</th><th>P</th><th>S</th><th>GD</th><th>Pt</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  };

  var buildPos = function(pos, chiavi) {
    var lista=[];
    var keys = chiavi || Object.keys(classificheGironi).filter(function(k){return /^GIRONE [A-Z]$/.test(k);});
    // Also try fuzzy match for numbered gironi (GIRONE 1, GIRONE 2 etc)
    var resolveKey = function(wanted) {
      if(classificheGironi[wanted]) return wanted;
      // Try case variations
      var up = wanted.toUpperCase().trim();
      if(classificheGironi[up]) return up;
      // Try finding partial match
      var found = Object.keys(classificheGironi).find(function(k){ return k.toUpperCase().replace(/\s+/g,' ').trim() === up; });
      return found || null;
    };
    keys.forEach(function(k){
      var rk = resolveKey(k);
      if(!rk) return;
      var cl=classificheGironi[rk]; if(!cl||cl.length<=pos) return;
      var row=cl[pos]; if(!row||!row.sq||row.g===0) return;
      lista.push({sq:row.sq,pts:row.pts,g:row.g,v:row.v,p:row.p,s:row.s,gf:row.gf,gs:row.gs,girone:rk.replace('GIRONE ','')});
    });
    lista.sort(function(a,b){return b.pts!==a.pts?b.pts-a.pts:(b.gf-b.gs)!==(a.gf-a.gs)?(b.gf-b.gs)-(a.gf-a.gs):b.gf-a.gf;});
    return lista;
  };

  var buildGironeVirt = function(nomeConj) {
    var gv=gironi.find(function(g){return isClassif(g)&&(g.nome||'').toLowerCase().includes(nomeConj.toLowerCase());});
    if(!gv) return [];
    var lista=[];
    (gv.squadre||[]).forEach(function(sq){
      if(!sq||!sq.id||isPlaceh(sq.nome)) return;
      var stat=statsPerSquadra[sq.id];
      if(stat&&stat.g>0) lista.push({sq:stat.sq,pts:stat.pts,g:stat.g,v:stat.v,p:stat.p,s:stat.s,gf:stat.gf,gs:stat.gs,girone:stat.gironeNome.replace('GIRONE ','')});
    });
    lista.sort(function(a,b){return b.pts!==a.pts?b.pts-a.pts:(b.gf-b.gs)!==(a.gf-a.gs)?(b.gf-b.gs)-(a.gf-a.gs):b.gf-a.gf;});
    return lista;
  };

  var getList = function(pos, chiavi, nomeConj) {
    var r=buildPos(pos,chiavi); return r.length?r:buildGironeVirt(nomeConj);
  };

  // Costruisce prima le classifiche speciali da A-L (seconde/terze/quarte)
  // così possono essere usate per risolvere Gironi 4-10
  var clSpeciali = {};
  // Seconde da A-L
  var keysAL = Object.keys(classificheGironi).filter(function(k){return /^GIRONE [A-Z]$/.test(k);});
  var listaSec=[],listaTer=[],listaQua=[];
  keysAL.forEach(function(k){
    var cl=classificheGironi[k];
    if(cl&&cl[1]&&cl[1].g>0) listaSec.push({rank:null,sq:cl[1].sq,pts:cl[1].pts,g:cl[1].g,v:cl[1].v,p:cl[1].p,s:cl[1].s,gf:cl[1].gf,gs:cl[1].gs});
    if(cl&&cl[2]&&cl[2].g>0) listaTer.push({rank:null,sq:cl[2].sq,pts:cl[2].pts,g:cl[2].g,v:cl[2].v,p:cl[2].p,s:cl[2].s,gf:cl[2].gf,gs:cl[2].gs});
    if(cl&&cl[3]&&cl[3].g>0) listaQua.push({rank:null,sq:cl[3].sq,pts:cl[3].pts,g:cl[3].g,v:cl[3].v,p:cl[3].p,s:cl[3].s,gf:cl[3].gf,gs:cl[3].gs});
  });
  var sortFn = function(a,b){return b.pts!==a.pts?b.pts-a.pts:(b.gf-b.gs)!==(a.gf-a.gs)?(b.gf-b.gs)-(a.gf-a.gs):b.gf-a.gf;};
  listaSec.sort(sortFn); listaTer.sort(sortFn); listaQua.sort(sortFn);
  // Assegna rank e salva in clSpeciali
  listaSec.forEach(function(r,i){r.rank=i+1;}); 
  listaTer.forEach(function(r,i){r.rank=i+1;});
  listaQua.forEach(function(r,i){r.rank=i+1;});
  clSpeciali['CLASSIFICA MIGLIORI SECONDE'] = listaSec;
  clSpeciali['CLASSIFICA MIGLIORI TERZE'] = listaTer;
  clSpeciali['CLASSIFICA MIGLIORI QUARTE'] = listaQua;

  // SECONDO PASSAGGIO: gironi 1-10 e finali con placeholder
  // Risolve placeholder come "3° CLASSIFICA MIGLIORI SECONDE" o "1° Girone A"
  var resolvePhName = function(nome) {
    if (!nome) return null;
    var m = nome.match(/^(\d+)[°º]?\s+(.+)$/i);
    if (!m) return null;
    var pos = parseInt(m[1]) - 1;
    var gname = m[2].trim().toUpperCase();
    // Cerca prima in classificheGironi (gironi normali)
    var cl = classificheGironi[gname];
    if (cl && cl.length > pos) return cl[pos].sq || null;
    // Poi cerca in clSpeciali (classifiche speciali da A-L)
    var sp = clSpeciali[gname] || clSpeciali[m[2].trim()];
    if (sp && sp.length > pos) return sp[pos].sq || null;
    return null;
  };

  for (var gi2=0; gi2<gironi.length; gi2++) {
    var g2 = gironi[gi2];
    if (isClassif(g2)) continue;
    var key2 = g2.nome.toUpperCase().trim();
    // Salta solo se già processato con tutte le squadre (4)
    var existing = classificheGironi[key2];
    if (existing && existing.length >= 4) continue;

    // Prova a risolvere le squadre dai placeholder
    var sqMap2 = {};
    for (var pi2=0; pi2<g2.partite.length; pi2++) {
      var p2 = g2.partite[pi2];
      var hSq = (p2.home && !isPlaceh(p2.home.nome)) ? p2.home : resolvePhName(p2.home && p2.home.nome);
      var aSq = (p2.away && !isPlaceh(p2.away.nome)) ? p2.away : resolvePhName(p2.away && p2.away.nome);
      if (hSq && hSq.id) sqMap2[hSq.id] = hSq;
      if (aSq && aSq.id) sqMap2[aSq.id] = aSq;
    }
    var sq2 = Object.values(sqMap2);
    if (sq2.length < 2) continue;

    // Ricalcola le partite con home_id/away_id risolti
    var partiteRisolte = g2.partite.map(function(p2) {
      var hSq = (p2.home && !isPlaceh(p2.home.nome)) ? p2.home : resolvePhName(p2.home && p2.home.nome);
      var aSq = (p2.away && !isPlaceh(p2.away.nome)) ? p2.away : resolvePhName(p2.away && p2.away.nome);
      return {home_id: hSq&&hSq.id, away_id: aSq&&aSq.id, gol_home: p2.gol_home, gol_away: p2.gol_away, giocata: p2.giocata};
    });

    var cl2 = calcGironeClassifica({squadre: sq2, partite: partiteRisolte});
    if (!cl2.length) continue;
    classificheGironi[key2] = cl2;
    cl2.forEach(function(row) {
      if (!row.sq||!row.sq.id) return;
      statsPerSquadra[row.sq.id] = {sq:row.sq,pts:row.pts,g:row.g,v:row.v,p:row.p,s:row.s,gf:row.gf,gs:row.gs,gironeNome:key2};
    });

    var played2 = g2.partite.filter(function(p){return p.giocata;}).length;
    if (played2===0) continue;
    html += '<div class="card" style="margin-bottom:8px;">';
    html += '<div class="card-title">'+g2.nome+'<span class="badge badge-gray">'+played2+'/'+g2.partite.length+'</span></div>';
    html += '<table class="standings-table"><thead><tr><th></th><th colspan="2">Squadra</th><th>G</th><th>V</th><th>P</th><th>S</th><th>GD</th><th>Pt</th></tr></thead><tbody>';
    cl2.forEach(function(row,idx){
      var q=idx<(cat&&cat.qualificate||1);
      var diff=row.gf-row.gs;
      html += '<tr class="'+(q?'qualifies':'')+'"><td><span class="'+(q?'q-dot':'nq-dot')+'"></span></td>';
      html += '<td>'+logoHTML(row.sq,'sm')+'</td><td>'+row.sq.nome+'</td>';
      html += '<td>'+row.g+'</td><td>'+row.v+'</td><td>'+row.p+'</td><td>'+row.s+'</td>';
      html += '<td class="'+(diff>0?'diff-pos':diff<0?'diff-neg':'')+'">'+( diff>0?'+':'')+diff+'</td>';
      html += '<td class="pts-col">'+row.pts+'</td></tr>';
    });
    html += '</tbody></table></div>';
  }

  // Mostra classifiche speciali da A-L
  var fmtSp = function(lista) { return lista.map(function(r){ return {sq:r.sq,pts:r.pts,g:r.g,v:r.v,p:r.p,s:r.s,gf:r.gf,gs:r.gs,girone:''}; }); };
  if(listaSec.length) html+=mkSpeciale(fmtSp(listaSec),'🥈 Classifica Migliori Seconde (Gironi A-L)','#d97706');
  if(listaTer.length) html+=mkSpeciale(fmtSp(listaTer),'🥉 Classifica Migliori Terze (Gironi A-L)','#78716c');
  if(listaQua.length) html+=mkSpeciale(fmtSp(listaQua),'4️⃣ Classifica Migliori Quarte (Gironi A-L)','#6366f1');

  // Classifiche speciali 123 e 456 dai gironi 1-2-3 e 4-5-6
  var buildPosDirect = function(pos, chiavi) {
    var lista=[];
    chiavi.forEach(function(k){
      var cl=classificheGironi[k.toUpperCase()]; 
      if(!cl||cl.length<=pos) return;
      var row=cl[pos]; if(!row||!row.sq||row.g===0) return;
      lista.push({sq:row.sq,pts:row.pts,g:row.g,v:row.v,p:row.p,s:row.s,gf:row.gf,gs:row.gs,girone:k.replace(/GIRONE /i,'')});
    });
    lista.sort(sortFn);
    return lista;
  };
  var s123=buildPosDirect(1,['GIRONE 1','GIRONE 2','GIRONE 3']);
  var t123=buildPosDirect(2,['GIRONE 1','GIRONE 2','GIRONE 3']);
  if(s123.length) html+=mkSpeciale(s123,'🥈 Migliori Seconde Gironi 1-2-3','#0891b2');
  if(t123.length) html+=mkSpeciale(t123,'🥉 Migliori Terze Gironi 1-2-3','#0891b2');

  var s456=buildPosDirect(1,['GIRONE 4','GIRONE 5','GIRONE 6']);
  var t456=buildPosDirect(2,['GIRONE 4','GIRONE 5','GIRONE 6']);
  if(s456.length) html+=mkSpeciale(s456,'🥈 Migliori Seconde Gironi 4-5-6','#7c3aed');
  if(t456.length) html+=mkSpeciale(t456,'🥉 Migliori Terze Gironi 4-5-6','#7c3aed');

  // Salva globalmente per renderRisultati
  window._classificheGironi = classificheGironi;
  window._clSpeciali = clSpeciali;
  window._resolveNome = function(nome) {
    if (!nome) return nome;
    var m = (nome+'').match(/^(\d+)[°\u00ba\u00b0]?\s+(.+)$/i);
    if (!m) return nome;
    var pos = parseInt(m[1]) - 1;
    var gname = m[2].trim().toUpperCase();
    var cl = classificheGironi[gname];
    if (cl && cl.length > pos && cl[pos] && cl[pos].sq) return cl[pos].sq.nome;
    var sp = clSpeciali[gname];
    if (sp && sp.length > pos && sp[pos] && sp[pos].sq) return sp[pos].sq.nome;
    return nome;
  };

  el.innerHTML = html || '<div class="empty-state" style="padding:40px;text-align:center;">⏳ Nessun risultato inserito.<br><span style="font-size:13px;">Le classifiche appariranno dopo le prime partite.</span></div>';
};


// ── OVERRIDE renderRisultati — risolve placeholder nei nomi ──────────────
// Costruisce il resolver in modo autonomo senza toccare il DOM
async function _buildResolverIfNeeded() {
  if (window._resolveNome) return;
  try {
    var gironi = await getGironiWithData(STATE.activeCat);
    var isPlacehR = function(s) { if(!s)return true; return /^\d+[°\u00ba\u00b0]?\s/.test(s)||/^(miglior|peggior)/i.test(s); };
    var clG = {};
    var clSp = {};
    // Primo passaggio: gironi con squadre reali
    for (var i=0; i<gironi.length; i++) {
      var g = gironi[i];
      var n = (g.nome||'').toLowerCase();
      if (n.includes('classif')||n.includes('migliori')) continue;
      var sqMap = {};
      for (var j=0; j<g.partite.length; j++) {
        var p = g.partite[j];
        if (p.home&&p.home.id&&!isPlacehR(p.home.nome)) sqMap[p.home.id]=p.home;
        if (p.away&&p.away.id&&!isPlacehR(p.away.nome)) sqMap[p.away.id]=p.away;
      }
      var sq = Object.values(sqMap);
      if (sq.length < 2) continue;
      var cl = calcGironeClassifica({squadre:sq, partite:g.partite});
      if (cl.length) clG[g.nome.toUpperCase().trim()] = cl;
    }
    // Classifiche speciali A-L
    var keysAL = Object.keys(clG).filter(function(k){return /^GIRONE [A-Z]$/.test(k);});
    var sortFn = function(a,b){return b.pts!==a.pts?b.pts-a.pts:(b.gf-b.gs)!==(a.gf-a.gs)?(b.gf-b.gs)-(a.gf-a.gs):b.gf-a.gf;};
    ['CLASSIFICA MIGLIORI SECONDE','CLASSIFICA MIGLIORI TERZE','CLASSIFICA MIGLIORI QUARTE'].forEach(function(nome, idx) {
      var pos = idx + 1;
      var lista = [];
      keysAL.forEach(function(k){ var cl=clG[k]; if(cl&&cl[pos]&&cl[pos].g>0) lista.push(cl[pos]); });
      lista.sort(sortFn);
      clSp[nome] = lista;
    });
    // Funzione resolver
    window._resolveNome = function(nome) {
      if (!nome) return nome;
      var m = (nome+'').match(/^(\d+)[°\u00ba\u00b0]?\s+(.+)$/i);
      if (!m) return nome;
      var pos = parseInt(m[1]) - 1;
      var gname = m[2].trim().toUpperCase();
      var cl = clG[gname];
      if (cl && cl[pos] && cl[pos].sq) return cl[pos].sq.nome;
      var sp = clSp[gname];
      if (sp && sp[pos] && sp[pos].sq) return sp[pos].sq.nome;
      return nome;
    };
  } catch(e) { console.warn('_buildResolverIfNeeded error:', e); }
}

var _origRenderRisultati = renderRisultati;
renderRisultati = async function() {
  await _buildResolverIfNeeded();
  await _origRenderRisultati.apply(this, arguments);
  var resolve = window._resolveNome;
  if (!resolve) return;
  var el = document.getElementById('sec-risultati');
  if (!el) return;
  el.querySelectorAll('.match-team span').forEach(function(span) {
    var txt = span.textContent.trim();
    if (/^\d+[°\u00ba\u00b0]?\s+\S/.test(txt)) {
      var resolved = resolve(txt);
      if (resolved !== txt) span.textContent = resolved;
    }
  });
};
