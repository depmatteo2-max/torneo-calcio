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

    // Squadre valide
    var sqMap = {};
    for (var pi=0; pi<g.partite.length; pi++) {
      var p = g.partite[pi];
      if (p.home && p.home.id && !isPlaceh(p.home.nome)) sqMap[p.home.id]=p.home;
      if (p.away && p.away.id && !isPlaceh(p.away.nome)) sqMap[p.away.id]=p.away;
    }
    var sq = (g.squadre||[]).filter(function(s){return s&&s.id&&!isPlaceh(s.nome);});
    if (sq.length < 2) sq = Object.values(sqMap);
    if (sq.length < 2) continue;

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

  // Debug: show available girone keys
  console.log('[CLASSIF] Chiavi disponibili:', Object.keys(classificheGironi).join(', '));
  var sec=getList(1,null,'migliori seconde');
  var ter=getList(2,null,'migliori terze');
  var qua=getList(3,null,'migliori quarte');
  if(sec.length) html+=mkSpeciale(sec,'🥈 Classifica Migliori Seconde','#d97706');
  if(ter.length) html+=mkSpeciale(ter,'🥉 Classifica Migliori Terze','#78716c');
  if(qua.length) html+=mkSpeciale(qua,'4️⃣ Classifica Migliori Quarte','#6366f1');

  var s123=getList(1,['GIRONE 1','GIRONE 2','GIRONE 3'],'seconde 123');
  var t123=getList(2,['GIRONE 1','GIRONE 2','GIRONE 3'],'terze 123');
  if(s123.length) html+=mkSpeciale(s123,'🥈 Migliori Seconde Gironi 1-2-3','#0891b2');
  if(t123.length) html+=mkSpeciale(t123,'🥉 Migliori Terze Gironi 1-2-3','#0891b2');

  var s456=getList(1,['GIRONE 4','GIRONE 5','GIRONE 6'],'seconde 456');
  var t456=getList(2,['GIRONE 4','GIRONE 5','GIRONE 6'],'terze 456');
  if(s456.length) html+=mkSpeciale(s456,'🥈 Migliori Seconde Gironi 4-5-6','#7c3aed');
  if(t456.length) html+=mkSpeciale(t456,'🥉 Migliori Terze Gironi 4-5-6','#7c3aed');

  el.innerHTML = html || '<div class="empty-state" style="padding:40px;text-align:center;">⏳ Nessun risultato inserito.<br><span style="font-size:13px;">Le classifiche appariranno dopo le prime partite.</span></div>';
};
