window.renderClassifiche = async function() {
  const el = document.getElementById('sec-classifiche');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria.</div>'; return; }
  el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--testo-xs);">⏳ Caricamento...</div>';
  const cat = STATE.categorie.find(c=>c.id===STATE.activeCat);
  const gironi = await getGironiWithData(STATE.activeCat);
  if (!gironi.length) { el.innerHTML='<div class="empty-state">Nessun girone trovato.</div>'; return; }
  let html = '';

  // Banner vincitori gironi (mostrato una sola volta per sessione per categoria)
  const bannerKey = 'vincitori_shown_' + STATE.activeCat;
  const tuttiCompleti = gironi.every(g => g.partite.length > 0 && g.partite.filter(p=>p.giocata).length === g.partite.length);
  if (tuttiCompleti && !sessionStorage.getItem(bannerKey)) {
    sessionStorage.setItem(bannerKey, '1');
    html += `<div id="vincitori-banner" style="
      background:linear-gradient(135deg,#0a2e14 0%,#1a4a2e 100%);
      border-radius:16px;padding:18px 16px;margin-bottom:16px;
      border:1px solid rgba(255,255,255,0.1);position:relative;
      animation:bannerSlideIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) forwards;">
      <button onclick="document.getElementById('vincitori-banner').remove()"
        style="position:absolute;top:10px;right:12px;background:rgba(255,255,255,0.15);
        border:none;color:white;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:13px;">✕</button>
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);
        text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;">🏆 Classifiche finali gironi</div>
      <div style="display:flex;flex-direction:column;gap:10px;">`;

    for (const g of gironi) {
      const cl = calcGironeClassifica(g);
      const top3 = cl.slice(0, 3);
      const medaglie = ['🥇','🥈','🥉'];
      html += `<div style="background:rgba(255,255,255,0.06);border-radius:12px;padding:12px 14px;">
        <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.6);
          text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">${g.nome}</div>`;
      top3.forEach((row, idx) => {
        const isVincitore = idx === 0;
        html += `<div style="display:flex;align-items:center;gap:10px;
          padding:${isVincitore?'8px 10px':'5px 10px'};
          background:${isVincitore?'rgba(255,215,0,0.12)':'rgba(255,255,255,0.04)'};
          border-radius:8px;margin-bottom:4px;
          border:${isVincitore?'1px solid rgba(255,215,0,0.3)':'1px solid transparent'};">
          <span style="font-size:${isVincitore?'22px':'16px'}">${medaglie[idx]}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:${isVincitore?'15px':'13px'};font-weight:${isVincitore?'800':'600'};
              color:${isVincitore?'#FFD700':'rgba(255,255,255,0.8)'};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${logoHTML(row.sq,'sm')} ${row.sq.nome}
            </div>
            ${isVincitore?`<div style="font-size:10px;color:rgba(255,215,0,0.6);margin-top:2px;font-weight:600;">VINCITORE GIRONE</div>`:''}
          </div>
          <div style="font-size:${isVincitore?'18px':'14px'};font-weight:800;
            color:${isVincitore?'#FFD700':'rgba(255,255,255,0.5)'};flex-shrink:0;">
            ${row.pts} pt
          </div>
        </div>`;
      });
      html += `</div>`;
    }
    html += `</div></div>`;
  }

  for (const g of gironi) {
    const cl = calcGironeClassifica(g);
    const played = g.partite.filter(p=>p.giocata).length;
    html += `<div class="card">
      <div class="card-title">${g.nome}<span class="badge badge-gray">${played}/${g.partite.length}</span></div>
      <div style="overflow-x:auto;">
      <table class="standings-table">
        <thead><tr>
          <th></th><th colspan="2">Squadra</th>
          <th>G</th><th>V</th><th>P</th><th>S</th>
          <th style="color:#27ae60;">GF</th>
          <th style="color:#e74c3c;">GS</th>
          <th>GD</th><th>Pt</th>
        </tr></thead><tbody>`;
    cl.forEach((row,idx) => {
      const q = idx < (cat?.qualificate||1);
      const diff = row.gf-row.gs;
      html += `<tr class="${q?'qualifies':''}">
        <td><span class="${q?'q-dot':'nq-dot'}"></span></td>
        <td>${logoHTML(row.sq,'sm')}</td>
        <td style="font-weight:${q?'700':'400'}">${row.sq.nome}</td>
        <td>${row.g}</td><td>${row.v}</td><td>${row.p}</td><td>${row.s}</td>
        <td style="color:#27ae60;font-weight:600;">${row.gf}</td>
        <td style="color:#e74c3c;font-weight:600;">${row.gs}</td>
        <td class="${diff>0?'diff-pos':diff<0?'diff-neg':''}">${diff>0?'+':''}${diff}</td>
        <td class="pts-col">${row.pts}</td>
      </tr>`;
    });
    html += `</tbody></table></div>
      <div style="font-size:10px;color:var(--testo-xs);margin-top:6px;padding-top:6px;border-top:1px solid var(--bordo-lt);">
        Spareggio: punti → scontro diretto → diff. reti → gol fatti → rigori
      </div></div>`;
    if (played === g.partite.length && g.partite.length > 0)
      checkTrophyAnimation(cl[0]?.sq?.nome, cat?.nome);
  }
  el.innerHTML = html;
};
window.saveRisultato = async function(partita_id, girone_id) {
  const sh = document.getElementById('sh_'+partita_id)?.value;
  const sa = document.getElementById('sa_'+partita_id)?.value;
  if (sh===''||sa==='') { toast('Inserisci entrambi i gol'); return; }
  const gironi = await getGironiWithData(STATE.activeCat);
  let hN='?', aN='?';
  outer: for (const g of gironi)
    for (const p of g.partite)
      if (p.id===partita_id) { hN=p.home?.nome||'?'; aN=p.away?.nome||'?'; break outer; }
  try {
    const result = await dbSavePartita({
      id:partita_id, girone_id,
      gol_home:parseInt(sh), gol_away:parseInt(sa),
      giocata:true, inserito_da: STATE.userName||null
    });
    if (result) {
      toast('✓ Salvato!');
      mostraNotificaRisultato(hN, parseInt(sh), aN, parseInt(sa));
      await renderAdminRisultati();
      const {data:gr} = await db.from('gironi').select('categoria_id').eq('id',girone_id).single();
      if (gr?.categoria_id) await verificaEGeneraTriangolari(gr.categoria_id);
    } else toast('Errore salvataggio');
  } catch(e) { toast('Errore: '+(e.message||'sconosciuto')); }
};
function mostraNotificaRisultato(home, golH, away, golA) {
  document.getElementById('result-notification')?.remove();
  const v = golH>golA ? `🏆 ${home} vince!` : golA>golH ? `🏆 ${away} vince!` : '🤝 Pareggio!';
  const div = document.createElement('div');
  div.id = 'result-notification';
  div.innerHTML = `<div class="notif-inner">
    <div class="notif-label">⚽ RISULTATO</div>
    <div class="notif-score">
      <span class="notif-team ${golH>golA?'notif-winner':''}">${home}</span>
      <span class="notif-goals">${golH} — ${golA}</span>
      <span class="notif-team ${golA>golH?'notif-winner':''}">${away}</span>
    </div>
    <div class="notif-vincitore">${v}</div>
    <button onclick="document.getElementById('result-notification').remove()" class="notif-close">✕</button>
  </div>`;
  document.body.appendChild(div);
  setTimeout(()=>{ const e=document.getElementById('result-notification'); if(e){e.style.animation='notifFadeOut 0.5s ease forwards';setTimeout(()=>e.remove(),500);} },6000);
}
const _trophyShown = {};
function checkTrophyAnimation(v, cat) {
  if (!v||!cat) return;
  const k=cat+'_'+v; if(_trophyShown[k])return; _trophyShown[k]=true;
  setTimeout(()=>mostraCoppa(v,cat),800);
}
function mostraCoppa(v, cat) {
  document.getElementById('trophy-overlay')?.remove();
  const div=document.createElement('div'); div.id='trophy-overlay';
  div.innerHTML=`<div class="trophy-box">
    <div class="trophy-confetti" id="trophy-confetti"></div>
    <div class="trophy-emoji">🏆</div>
    <div class="trophy-title">CAMPIONE!</div>
    <div class="trophy-categoria">${cat}</div>
    <div class="trophy-nome">${v}</div>
    <div class="trophy-sub">Vincitore del torneo</div>
    <button onclick="document.getElementById('trophy-overlay').remove()" class="trophy-btn">Chiudi</button>
  </div>`;
  document.body.appendChild(div);
  const colori=['#FFD700','#27ae60','#3498db','#e74c3c','#9b59b6','#f39c12'];
  const c=document.getElementById('trophy-confetti'); if(!c)return;
  for(let i=0;i<60;i++){
    const el=document.createElement('div'); el.className='coriandolo';
    el.style.cssText=`left:${Math.random()*100}%;background:${colori[Math.floor(Math.random()*colori.length)]};width:${Math.random()*8+4}px;height:${Math.random()*8+4}px;animation-delay:${Math.random()*2}s;animation-duration:${Math.random()*2+2}s;border-radius:${Math.random()>.5?'50%':'2px'};`;
    c.appendChild(el);
  }
}
window.testCoppa = ()=>mostraCoppa('Nome Squadra','Under 10');
document.head.insertAdjacentHTML('beforeend',`<style>
@keyframes bannerSlideIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
#result-notification{position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:9999;width:min(400px,92vw);animation:notifSlideIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards}
@keyframes notifSlideIn{from{opacity:0;transform:translateX(-50%) translateY(-20px) scale(0.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
@keyframes notifFadeOut{to{opacity:0;transform:translateX(-50%) translateY(-10px) scale(0.95)}}
.notif-inner{background:white;border:2px solid #27ae60;border-radius:16px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,0.15);position:relative}
.notif-label{font-size:11px;font-weight:700;color:#27ae60;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.notif-score{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.notif-team{font-size:14px;font-weight:600;flex:1;color:#333}.notif-team:last-child{text-align:right}
.notif-team.notif-winner{color:#27ae60;font-weight:800}
.notif-goals{font-size:28px;font-weight:900;color:#1a1a1a;background:#f0faf3;padding:4px 16px;border-radius:10px;border:2px solid #27ae60;min-width:90px;text-align:center}
.notif-vincitore{font-size:13px;font-weight:600;color:#555;text-align:center}
.notif-close{position:absolute;top:8px;right:10px;background:none;border:none;font-size:16px;cursor:pointer;color:#aaa;padding:2px 6px}
#trophy-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center}
.trophy-box{background:linear-gradient(135deg,#1a1a2e,#0f3460);border:2px solid #FFD700;border-radius:24px;padding:40px 48px;text-align:center;position:relative;overflow:hidden;max-width:340px;width:90%}
.trophy-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.coriandolo{position:absolute;top:-20px;animation:coriandoloCade linear forwards}
@keyframes coriandoloCade{from{transform:translateY(0) rotate(0deg);opacity:1}to{transform:translateY(500px) rotate(720deg);opacity:0}}
.trophy-emoji{font-size:72px;margin-bottom:12px;display:block}
.trophy-title{font-size:28px;font-weight:900;color:#FFD700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
.trophy-categoria{font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:12px;text-transform:uppercase}
.trophy-nome{font-size:22px;font-weight:800;color:white;margin-bottom:6px}
.trophy-sub{font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:24px}
.trophy-btn{background:#FFD700;color:#1a1a1a;border:none;padding:10px 28px;border-radius:99px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
.standings-table th,.standings-table td{white-space:nowrap}
</style>`);
