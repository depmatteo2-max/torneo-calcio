window._aggiornaResolver = async function(categoriaId) {
  var gironi = await getGironiWithData(categoriaId);
  var isP = function(s){ return !s || /^\d+[°º]?\s/.test(s) || /^(miglior|peggior)/i.test(s); };
  var srt = function(a,b){ return b.pts!==a.pts ? b.pts-a.pts : (b.gf-b.gs)!==(a.gf-a.gs) ? (b.gf-b.gs)-(a.gf-a.gs) : b.gf-a.gf; };
  var clG = {}, clSp = {};
  var isC = function(g){ var n=(g.nome||'').toLowerCase(); return n.includes('classif')||n.includes('migliori'); };

  var res = function(nome) {
    if (!nome) return null;
    var s = String(nome).trim();
    var m = s.match(/^(\d+)[°º]?\s+Girone\s+([A-Z0-9]+)$/i);
    if (m) { var cl=clG['GIRONE '+m[2].toUpperCase()]; return cl && cl[parseInt(m[1])-1] && cl[parseInt(m[1])-1].sq || null; }
    m = s.match(/^(\d+)[°º]?\s+(.+)$/i);
    if (m) {
      var pos=parseInt(m[1])-1, key=m[2].trim().toUpperCase(), kn=key.replace(/-/g,'');
      if (clG[key] && clG[key][pos] && clG[key][pos].sq) return clG[key][pos].sq;
      for (var k in clSp) { if (k.replace(/-/g,'')===kn) { return clSp[k] && clSp[k][pos] && clSp[k][pos].sq || null; } }
      return null;
    }
    m = s.match(/^Miglior[ei]?\s+(second|terz|quart)[ao]\s*([\d\-]+)?$/i);
    if (m) {
      var t=m[1].toLowerCase(), g2=(m[2]||'').replace(/-/g,'');
      var key2 = t==='second' ? 'CLASSIFICA MIGLIORI SECONDE' : t==='terz' ? 'CLASSIFICA MIGLIORI TERZE' : 'CLASSIFICA MIGLIORI QUARTE';
      if (g2==='123') key2+=' 123'; else if (g2==='456') key2+=' 456';
      return clSp[key2] && clSp[key2][0] && clSp[key2][0].sq || null;
    }
    return null;
  };

  var proc = function(g) {
    var sm = {};
    g.partite.forEach(function(p) {
      var h = (p.home && !isP(p.home.nome)) ? p.home : res(p.home && p.home.nome);
      var a = (p.away && !isP(p.away.nome)) ? p.away : res(p.away && p.away.nome);
      if (h && h.id) sm[h.id] = h;
      if (a && a.id) sm[a.id] = a;
    });
    var sq = Object.values(sm);
    if (sq.length < 2) return null;
    var pr = g.partite.map(function(p) {
      var h = (p.home && !isP(p.home.nome)) ? p.home : res(p.home && p.home.nome);
      var a = (p.away && !isP(p.away.nome)) ? p.away : res(p.away && p.away.nome);
      return { home_id: h&&h.id, away_id: a&&a.id, gol_home: p.gol_home, gol_away: p.gol_away, giocata: p.giocata };
    });
    return calcGironeClassifica({ squadre: sq, partite: pr });
  };

  var mk = function(keys, pos) {
    var l = [];
    keys.forEach(function(k) { var cl=clG[k.toUpperCase()]; if (cl && cl[pos] && cl[pos].g>0) l.push(cl[pos]); });
    l.sort(srt);
    return l;
  };

  // P1: gironi A-L
  gironi.forEach(function(g) {
    if (isC(g)) return;
    var sm = {};
    g.partite.forEach(function(p) {
      if (p.home && p.home.id && !isP(p.home.nome)) sm[p.home.id] = p.home;
      if (p.away && p.away.id && !isP(p.away.nome)) sm[p.away.id] = p.away;
    });
    var sq = Object.values(sm);
    if (sq.length < 2) return;
    var cl = calcGironeClassifica({ squadre: sq, partite: g.partite });
    if (cl.length) clG[g.nome.toUpperCase().trim()] = cl;
  });

  // P2: speciali A-L
  var kal = Object.keys(clG).filter(function(k){ return /^GIRONE [A-Z]$/.test(k); });
  clSp['CLASSIFICA MIGLIORI SECONDE'] = mk(kal, 1);
  clSp['CLASSIFICA MIGLIORI TERZE']   = mk(kal, 2);
  clSp['CLASSIFICA MIGLIORI QUARTE']  = mk(kal, 3);

  // P3: gironi 1-10
  gironi.forEach(function(g) {
    if (isC(g)) return;
    var key = g.nome.toUpperCase().trim();
    if (clG[key] && clG[key].length >= 4) return;
    if (!/GIRONE\s+\d+$/i.test(g.nome)) return;
    var cl = proc(g);
    if (cl && cl.length) clG[key] = cl;
  });

  // P4: speciali 123/456
  clSp['CLASSIFICA MIGLIORI SECONDE 123'] = mk(['GIRONE 1','GIRONE 2','GIRONE 3'], 1);
  clSp['CLASSIFICA MIGLIORI TERZE 123']   = mk(['GIRONE 1','GIRONE 2','GIRONE 3'], 2);
  clSp['CLASSIFICA MIGLIORI SECONDE 456'] = mk(['GIRONE 4','GIRONE 5','GIRONE 6'], 1);
  clSp['CLASSIFICA MIGLIORI TERZE 456']   = mk(['GIRONE 4','GIRONE 5','GIRONE 6'], 2);

  // P5: Champions/Europa
  gironi.forEach(function(g) {
    if (isC(g)) return;
    var key = g.nome.toUpperCase().trim();
    if (clG[key] && clG[key].length >= 3) return;
    if (/GIRONE\s+\d+$/i.test(g.nome)) return;
    var cl = proc(g);
    if (cl && cl.length) clG[key] = cl;
  });

  window._clGlobale   = clG;
  window._clSpecGlobale = clSp;
  window._resolveNome = function(nome) { var sq = res(nome); return sq ? sq.nome : nome; };
  console.log('_aggiornaResolver OK: clG='+Object.keys(clG).length+' clSp='+Object.keys(clSp).length);
};

// Esegui subito e ricarica classifiche
if (typeof STATE !== 'undefined' && STATE.activeCat) {
  window._aggiornaResolver(STATE.activeCat).then(function() {
    if (typeof renderClassifiche === 'function') renderClassifiche();
  });
}