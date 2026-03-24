// ============================================================
//  FEATURES.JS — Miglioramenti Soccer Pro Experience
//  1. Gol Fatti / Gol Subiti in classifica
//  2. Notifica lampeggiante risultato
//  3. Animazione coppa a fine torneo
// ============================================================

// ============================================================
//  1. PATCH CLASSIFICA — aggiunge GF e GS
// ============================================================
const _origRenderClassifiche = window.renderClassifiche;

window.renderClassifiche = async function() {
  const el = document.getElementById('sec-classifiche');
  if (!STATE.activeCat) { el.innerHTML='<div class="empty-state">Nessuna categoria configurata.</div>'; return; }
  const cat = STATE.categorie.find(c=>c.id===STATE.activeCat);
  const gironi = await getGironiWithData(STATE.activeCat);
  if (!gironi.length) { el.innerHTML='<div class="empty-state">Nessun girone trovato.</div>'; return; }

  let html = '';
  for (const g of gironi) {
    const cl = calcGironeClassifica(g);
    const played = g.partite.filter(p=>p.giocata).length;
    const totale = g.partite.length;

    html += `<div class="card">
      <div class="card-title">${g.nome}
        <span class="badge badge-gray">${played}/${totale} partite</span>
      </div>
      <div style="overflow-x:auto;">
      <table class="standings-table">
        <thead><tr>
          <th></th>
          <th colspan="2">Squadra</th>
          <th title="Partite giocate">G</th>
          <th title="Vittorie">V</th>
          <th title="Pareggi">P</th>
          <th title="Sconfitte">S</th>
          <th title="Gol Fatti" style="color:#27ae60;">GF</th>
          <th title="Gol Subiti" style="color:#e74c3c;">GS</th>
          <th title="Differenza Reti">GD</th>
          <th title="Punti">Pt</th>
        </tr></thead>
        <tbody>`;

    cl.forEach((row, idx) => {
      const q = idx < (cat.qualificate || 2);
      const diff = row.gf - row.gs;
      html += `<tr class="${q ? 'qualifies' : ''}">
        <td><span class="${q ? 'q-dot' : 'nq-dot'}"></span></td>
        <td style="padding-right:4px;">${logoHTML(row.sq, 'sm')}</td>
        <td style="font-weight:${q?'700':'400'}">${row.sq.nome}</td>
        <td>${row.g}</td>
        <td>${row.v}</td>
        <td>${row.p}</td>
        <td>${row.s}</td>
        <td style="color:#27ae60;font-weight:600;">${row.gf}</td>
        <td style="color:#e74c3c;font-weight:600;">${row.gs}</td>
        <td class="${diff>0?'diff-pos':diff<0?'diff-neg':''}">${diff>0?'+':''}${diff}</td>
        <td class="pts-col">${row.pts}</td>
      </tr>`;
    });

    html += `</tbody></table></div>
      <div style="font-size:11px;color:#aaa;margin-top:8px;padding-top:8px;border-top:1px solid #f5f5f5;">
        Spareggio: punti → scontro diretto → diff. reti → gol fatti → gol subiti → rigori
      </div>
    </div>`;

    // Controlla se il torneo è finito (tutte le partite giocate)
    if (played === totale && totale > 0) {
      const vincitore = cl[0];
      if (vincitore) checkTrophyAnimation(vincitore.sq.nome, cat.nome);
    }
  }

  el.innerHTML = html;
};

// ============================================================
//  2. NOTIFICA LAMPEGGIANTE RISULTATO
// ============================================================
let _lastResults = {};

// Patch saveRisultato per mostrare notifica dopo salvataggio
const _origSaveRisultato = window.saveRisultato;
window.saveRisultato = async function(partita_id, girone_id) {
  const sh = document.getElementById('sh_' + partita_id)?.value;
  const sa = document.getElementById('sa_' + partita_id)?.value;
  if (sh === '' || sa === '') { toast('Inserisci entrambi i gol'); return; }

  // Cerca le squadre prima di salvare
  const gironi = await getGironiWithData(STATE.activeCat);
  let homeNome = '?', awayNome = '?';
  for (const g of gironi) {
    for (const p of g.partite) {
      if (p.id === partita_id) {
        homeNome = p.home?.nome || '?';
        awayNome = p.away?.nome || '?';
      }
    }
  }

  try {
    const result = await dbSavePartita({ id: partita_id, girone_id, gol_home: parseInt(sh), gol_away: parseInt(sa), giocata: true });
    if (result) {
      toast('✓ Salvato!');
      // Mostra notifica lampeggiante
      mostraNotificaRisultato(homeNome, parseInt(sh), awayNome, parseInt(sa));
      await renderAdminRisultati();
    } else {
      toast('Errore nel salvataggio');
    }
  } catch(e) {
    console.error(e);
    toast('Errore: ' + (e.message || 'sconosciuto'));
  }
};

function mostraNotificaRisultato(home, golH, away, golA) {
  // Rimuovi notifica precedente
  const old = document.getElementById('result-notification');
  if (old) old.remove();

  let vincitore = '';
  if (golH > golA) vincitore = `🏆 ${home} vince!`;
  else if (golA > golH) vincitore = `🏆 ${away} vince!`;
  else vincitore = '🤝 Pareggio!';

  const div = document.createElement('div');
  div.id = 'result-notification';
  div.innerHTML = `
    <div class="notif-inner">
      <div class="notif-label">⚽ RISULTATO</div>
      <div class="notif-score">
        <span class="notif-team ${golH > golA ? 'notif-winner' : ''}">${home}</span>
        <span class="notif-goals">${golH} — ${golA}</span>
        <span class="notif-team ${golA > golH ? 'notif-winner' : ''}">${away}</span>
      </div>
      <div class="notif-vincitore">${vincitore}</div>
      <button onclick="document.getElementById('result-notification').remove()" class="notif-close">✕</button>
    </div>
  `;
  document.body.appendChild(div);

  // Rimuovi automaticamente dopo 6 secondi
  setTimeout(() => {
    const el = document.getElementById('result-notification');
    if (el) { el.style.animation = 'notifFadeOut 0.5s ease forwards'; setTimeout(() => el.remove(), 500); }
  }, 6000);
}

// ============================================================
//  3. ANIMAZIONE COPPA 🏆
// ============================================================
let _trophyShown = {};

function checkTrophyAnimation(vincitore, categoria) {
  const key = categoria + '_' + vincitore;
  if (_trophyShown[key]) return;
  _trophyShown[key] = true;

  // Mostra dopo un piccolo delay
  setTimeout(() => mostraCoppa(vincitore, categoria), 500);
}

function mostraCoppa(vincitore, categoria) {
  const old = document.getElementById('trophy-overlay');
  if (old) old.remove();

  const div = document.createElement('div');
  div.id = 'trophy-overlay';
  div.innerHTML = `
    <div class="trophy-box">
      <div class="trophy-confetti" id="trophy-confetti"></div>
      <div class="trophy-emoji">🏆</div>
      <div class="trophy-title">CAMPIONE!</div>
      <div class="trophy-categoria">${categoria}</div>
      <div class="trophy-nome">${vincitore}</div>
      <div class="trophy-sub">Vincitore del torneo</div>
      <button onclick="document.getElementById('trophy-overlay').remove()" class="trophy-btn">Chiudi</button>
    </div>
  `;
  document.body.appendChild(div);

  // Genera coriandoli
  generaCoriandoli();
}

function generaCoriandoli() {
  const container = document.getElementById('trophy-confetti');
  if (!container) return;
  const colori = ['#FFD700','#27ae60','#3498db','#e74c3c','#9b59b6','#f39c12','#1abc9c'];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement('div');
    c.className = 'coriandolo';
    c.style.cssText = `
      left: ${Math.random()*100}%;
      background: ${colori[Math.floor(Math.random()*colori.length)]};
      width: ${Math.random()*10+5}px;
      height: ${Math.random()*10+5}px;
      animation-delay: ${Math.random()*2}s;
      animation-duration: ${Math.random()*2+2}s;
      border-radius: ${Math.random()>0.5?'50%':'2px'};
    `;
    container.appendChild(c);
  }
}

// ============================================================
//  CSS DINAMICO
// ============================================================
const featureCSS = `
/* NOTIFICA RISULTATO */
#result-notification {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  width: min(400px, 92vw);
  animation: notifSlideIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards,
             notifBlink 1s ease 0.4s 3;
}
@keyframes notifSlideIn {
  from { opacity:0; transform:translateX(-50%) translateY(-20px) scale(0.9); }
  to   { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
}
@keyframes notifBlink {
  0%,100% { box-shadow: 0 8px 32px rgba(39,174,96,0.3); }
  50%      { box-shadow: 0 8px 48px rgba(39,174,96,0.8), 0 0 0 8px rgba(39,174,96,0.15); }
}
@keyframes notifFadeOut {
  to { opacity:0; transform:translateX(-50%) translateY(-10px) scale(0.95); }
}
.notif-inner {
  background: white;
  border: 2px solid #27ae60;
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  position: relative;
}
.notif-label {
  font-size: 11px;
  font-weight: 700;
  color: #27ae60;
  text-transform: uppercase;
  letter-spacing: .08em;
  margin-bottom: 8px;
}
.notif-score {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.notif-team {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
  color: #333;
}
.notif-team:last-child { text-align: right; }
.notif-team.notif-winner { color: #27ae60; font-weight: 800; }
.notif-goals {
  font-size: 28px;
  font-weight: 900;
  color: #1a1a1a;
  background: #f0faf3;
  padding: 4px 16px;
  border-radius: 10px;
  border: 2px solid #27ae60;
  min-width: 90px;
  text-align: center;
}
.notif-vincitore {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  text-align: center;
}
.notif-close {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #aaa;
  padding: 2px 6px;
}
.notif-close:hover { color: #333; }

/* COPPA ANIMAZIONE */
#trophy-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: trophyFadeIn 0.5s ease forwards;
}
@keyframes trophyFadeIn {
  from { opacity:0; }
  to   { opacity:1; }
}
.trophy-box {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border: 2px solid #FFD700;
  border-radius: 24px;
  padding: 40px 48px;
  text-align: center;
  position: relative;
  overflow: hidden;
  max-width: 340px;
  width: 90%;
  animation: trophyPop 0.6s cubic-bezier(0.175,0.885,0.32,1.275) 0.2s both;
}
@keyframes trophyPop {
  from { transform: scale(0.5); opacity:0; }
  to   { transform: scale(1); opacity:1; }
}
.trophy-confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.coriandolo {
  position: absolute;
  top: -20px;
  animation: coriandoloCade linear forwards;
}
@keyframes coriandoloCade {
  from { transform: translateY(0) rotate(0deg); opacity:1; }
  to   { transform: translateY(500px) rotate(720deg); opacity:0; }
}
.trophy-emoji {
  font-size: 72px;
  margin-bottom: 12px;
  animation: trophyBounce 1s ease-in-out infinite;
  display: block;
}
@keyframes trophyBounce {
  0%,100% { transform: translateY(0) scale(1); }
  50%      { transform: translateY(-10px) scale(1.05); }
}
.trophy-title {
  font-size: 28px;
  font-weight: 900;
  color: #FFD700;
  letter-spacing: .1em;
  text-transform: uppercase;
  margin-bottom: 6px;
  text-shadow: 0 0 20px rgba(255,215,0,0.5);
}
.trophy-categoria {
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: .06em;
}
.trophy-nome {
  font-size: 22px;
  font-weight: 800;
  color: white;
  margin-bottom: 6px;
}
.trophy-sub {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 24px;
}
.trophy-btn {
  background: #FFD700;
  color: #1a1a1a;
  border: none;
  padding: 10px 28px;
  border-radius: 99px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.trophy-btn:hover { background: #ffe234; }

/* TABELLA con scroll orizzontale su mobile */
.standings-table th, .standings-table td { white-space: nowrap; }
`;

// Inietta CSS
const styleEl = document.createElement('style');
styleEl.textContent = featureCSS;
document.head.appendChild(styleEl);

// Esponi funzione per test coppa (da console: testCoppa())
window.testCoppa = () => mostraCoppa('Nome Squadra', 'Under 10');
