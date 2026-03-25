// ============================================================
//  TV.JS v2 — niente loop, usa cache db.js
// ============================================================

let TV_MODE = false;
let TV_INTERVAL = null;
let TV_CAT_INDEX = 0;
let TV_SECTION_INDEX = 0;
const TV_SECTIONS = ['classifiche', 'risultati'];
const TV_DURATION = 15000; // 15s per schermata

function toggleTVMode() { TV_MODE ? exitTVMode() : enterTVMode(); }

function enterTVMode() {
  TV_MODE = true; TV_CAT_INDEX = 0; TV_SECTION_INDEX = 0;
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(()=>{});
  document.body.classList.add('tv-active');
  creaOverlayTV();
  avviaAutoScorrimento();
  const btn = document.getElementById('tv-btn');
  if (btn) btn.textContent = '✕ Esci TV';
}

function exitTVMode() {
  TV_MODE = false;
  if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  document.body.classList.remove('tv-active');
  document.getElementById('tv-overlay')?.remove();
  if (TV_INTERVAL) { clearInterval(TV_INTERVAL); TV_INTERVAL = null; }
  const btn = document.getElementById('tv-btn');
  if (btn) btn.textContent = '📺 TV';
}

function creaOverlayTV() {
  document.getElementById('tv-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'tv-overlay';
  overlay.innerHTML = `
    <div id="tv-header">
      <div id="tv-logo-area">
        <img id="tv-logo-img" style="display:none;width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.3);" alt="">
        <div id="tv-titolo">Soccer Pro Experience</div>
      </div>
      <div id="tv-info">
        <div id="tv-live-badge">● LIVE</div>
        <div id="tv-orologio">--:--</div>
      </div>
    </div>
    <div id="tv-content"></div>
    <div id="tv-footer">
      <div id="tv-cat-nome"></div>
      <div id="tv-progress-bar"><div id="tv-progress-inner"></div></div>
      <button onclick="exitTVMode()" id="tv-exit-btn">✕ Esci</button>
    </div>`;
  document.body.appendChild(overlay);

  // Orologio
  const tickOrologio = () => {
    const el = document.getElementById('tv-orologio');
    if (el) el.textContent = new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  };
  tickOrologio();
  setInterval(tickOrologio, 1000);

  // Logo e titolo
  const hl = document.getElementById('header-logo');
  if (hl?.src?.length > 50) { const tl=document.getElementById('tv-logo-img'); tl.src=hl.src; tl.style.display='block'; }
  const ht = document.getElementById('header-title');
  if (ht) document.getElementById('tv-titolo').textContent = ht.textContent;

  renderTV();
}

function avviaAutoScorrimento() {
  if (TV_INTERVAL) clearInterval(TV_INTERVAL);
  avviaProgressBar();
  TV_INTERVAL = setInterval(prossimaSchermataTv, TV_DURATION);
}

function avviaProgressBar() {
  const bar = document.getElementById('tv-progress-inner');
  if (!bar) return;
  bar.style.transition = 'none'; bar.style.width = '0%';
  setTimeout(()=>{ bar.style.transition=`width ${TV_DURATION}ms linear`; bar.style.width='100%'; }, 50);
}

function prossimaSchermataTv() {
  if (!STATE.categorie?.length) return;
  TV_SECTION_INDEX++;
  if (TV_SECTION_INDEX >= TV_SECTIONS.length) {
    TV_SECTION_INDEX = 0;
    TV_CAT_INDEX = (TV_CAT_INDEX + 1) % STATE.categorie.length;
  }
  renderTV();
  avviaProgressBar();
}

async function renderTV() {
  if (!TV_MODE) return;
  const cat = STATE.categorie[TV_CAT_INDEX];
  const section = TV_SECTIONS[TV_SECTION_INDEX];
  if (!cat) return;

  const catNomeEl = document.getElementById('tv-cat-nome');
  if (catNomeEl) catNomeEl.textContent = `${section==='classifiche'?'📊 Classifica':'⚽ Risultati'} — ${cat.nome}`;

  const content = document.getElementById('tv-content');
  if (!content) return;
  content.style.opacity = '0';

  // Usa cache — getGironiWithData non fa query se dati già in cache
  const gironi = await getGironiWithData(cat.id);

  let html = '';
  if (section === 'classifiche') {
    for (const g of gironi) {
      const cl = calcGironeClassifica(g);
      html += `<div class="tv-block">
        <div class="tv-block-title">${g.nome} <span class="tv-badge">${g.partite.filter(p=>p.giocata).length}/${g.partite.length}</span></div>
        <table class="tv-table"><thead><tr>
          <th></th><th style="text-align:left">Squadra</th>
          <th>G</th><th>V</th><th>P</th><th>S</th>
          <th style="color:#4ade80">GF</th><th style="color:#f87171">GS</th>
          <th>GD</th><th style="color:#FFD700">Pt</th>
        </tr></thead><tbody>`;
      cl.forEach((row,idx)=>{
        const q=idx<(cat.qualificate||1), diff=row.gf-row.gs;
        html+=`<tr class="${q?'tv-q':''}">
          <td>${q?'<span class="tv-qdot"></span>':''}</td>
          <td style="text-align:left;font-weight:${q?700:400}">${logoHTML(row.sq,'sm')} ${row.sq.nome}</td>
          <td>${row.g}</td><td>${row.v}</td><td>${row.p}</td><td>${row.s}</td>
          <td style="color:#4ade80;font-weight:600">${row.gf}</td>
          <td style="color:#f87171;font-weight:600">${row.gs}</td>
          <td style="color:${diff>0?'#4ade80':diff<0?'#f87171':'#888'}">${diff>0?'+':''}${diff}</td>
          <td style="color:#FFD700;font-weight:800;font-size:20px">${row.pts}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }
  } else {
    // Filtra per oggi se disponibile
    const oggi = typeof _trovaGiornataOggi==='function'
      ? _trovaGiornataOggi(STATE._giornateDisponibili||[]) : null;

    for (const g of gironi) {
      let partite = g.partite;
      if (oggi) {
        const oggi_p = partite.filter(p=>p.giorno===oggi);
        if (oggi_p.length) partite = oggi_p;
      }
      const giocate = partite.filter(p=>p.giocata);
      const daFare  = partite.filter(p=>!p.giocata).slice(0,4);

      if (giocate.length) {
        html += `<div class="tv-block-title">${g.nome}${oggi?' — Oggi':''} — Risultati</div><div class="tv-matches">`;
        for (const p of giocate.slice(-6)) {
          const w1=p.gol_home>p.gol_away, w2=p.gol_away>p.gol_home;
          html+=`<div class="tv-match">
            <div class="tv-team ${w1?'tv-win':''}">${logoHTML(p.home,'sm')} ${p.home?.nome||'?'}</div>
            <div class="tv-score">${p.gol_home} — ${p.gol_away}</div>
            <div class="tv-team right ${w2?'tv-win':''}">${p.away?.nome||'?'} ${logoHTML(p.away,'sm')}</div>
          </div>`;
        }
        html += `</div>`;
      }
      if (daFare.length) {
        html += `<div class="tv-block-title" style="margin-top:10px">${g.nome} — Programma</div><div class="tv-matches">`;
        for (const p of daFare) {
          html+=`<div class="tv-match tv-pending">
            <div class="tv-team">${logoHTML(p.home,'sm')} ${p.home?.nome||'?'}</div>
            <div class="tv-score tv-vs">${p.orario||'vs'}</div>
            <div class="tv-team right">${p.away?.nome||'?'} ${logoHTML(p.away,'sm')}</div>
          </div>`;
        }
        html += `</div>`;
      }
    }
  }

  content.innerHTML = html || '<div class="tv-empty">Nessun dato</div>';
  setTimeout(()=>{ content.style.transition='opacity 0.4s ease'; content.style.opacity='1'; }, 30);
}

// ── CSS ─────────────────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend',`<style>
#tv-overlay{position:fixed;inset:0;background:#060b18;z-index:99998;display:flex;flex-direction:column;font-family:inherit;overflow:hidden}
#tv-header{display:flex;align-items:center;justify-content:space-between;padding:12px 32px;background:linear-gradient(135deg,#0d1b3e,#1a3a6e);border-bottom:2px solid #2563eb;flex-shrink:0}
#tv-logo-area{display:flex;align-items:center;gap:14px}
#tv-titolo{font-size:22px;font-weight:800;color:white;letter-spacing:.02em}
#tv-info{display:flex;align-items:center;gap:16px}
#tv-orologio{font-size:30px;font-weight:900;color:white;font-variant-numeric:tabular-nums}
#tv-live-badge{background:#ef4444;color:white;font-size:12px;font-weight:700;padding:4px 12px;border-radius:99px;animation:tvLivePulse 1.8s ease infinite}
@keyframes tvLivePulse{0%,100%{opacity:1}50%{opacity:.55}}
#tv-content{flex:1;overflow:hidden;padding:14px 32px;display:flex;flex-direction:column;gap:10px}
#tv-footer{display:flex;align-items:center;padding:8px 32px;background:rgba(0,0,0,.5);flex-shrink:0;gap:16px}
#tv-cat-nome{font-size:13px;font-weight:600;color:rgba(255,255,255,.6);white-space:nowrap}
#tv-progress-bar{flex:1;height:3px;background:rgba(255,255,255,.1);border-radius:99px;overflow:hidden}
#tv-progress-inner{height:100%;background:#2563eb;border-radius:99px;width:0%}
#tv-exit-btn{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.6);padding:4px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-family:inherit}
.tv-block{overflow:hidden}
.tv-block-title{font-size:14px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;display:flex;align-items:center;gap:10px}
.tv-badge{font-size:11px;background:rgba(96,165,250,.15);color:#60a5fa;padding:2px 8px;border-radius:99px;font-weight:600}
.tv-table{width:100%;border-collapse:collapse;font-size:17px}
.tv-table th{color:rgba(255,255,255,.35);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:5px 10px;text-align:center;border-bottom:1px solid rgba(255,255,255,.07)}
.tv-table td{padding:9px 10px;text-align:center;color:rgba(255,255,255,.82);border-bottom:1px solid rgba(255,255,255,.04)}
.tv-table tr.tv-q td{background:rgba(37,99,235,.1)}
.tv-qdot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e}
.tv-matches{display:flex;flex-direction:column;gap:5px}
.tv-match{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.04);border-radius:9px;padding:9px 14px}
.tv-match.tv-pending{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06)}
.tv-team{flex:1;font-size:17px;font-weight:600;color:rgba(255,255,255,.82);display:flex;align-items:center;gap:7px}
.tv-team.right{flex-direction:row-reverse;text-align:right}
.tv-team.tv-win{color:#22c55e;font-weight:800}
.tv-score{font-size:26px;font-weight:900;color:white;min-width:86px;text-align:center;background:rgba(37,99,235,.28);border-radius:8px;padding:4px 10px;border:1px solid rgba(37,99,235,.5)}
.tv-score.tv-vs{font-size:13px;color:rgba(255,255,255,.35);background:transparent;border-color:rgba(255,255,255,.1)}
.tv-empty{color:rgba(255,255,255,.25);font-size:16px;text-align:center;margin-top:30px}
body.tv-active #app{visibility:hidden}
</style>`);
