// ============================================================
//  FEATURES.JS — Soccer Pro Experience
//  1. Animazione GOAL! + flash punteggio
//  2. Programma partite con orari e campi
//  3. Notifica WhatsApp
//  4. Bracket visivo tabellone
// ============================================================

// ============================================================
//  1. ANIMAZIONE GOAL!
// ============================================================

let _lastScores = {};

function initGoalTracker() {
  _lastScores = {};
}

function checkGoalAnimation(partitaId, golHome, golAway, prevHome, prevAway) {
  const newGoals = (golHome + golAway) - (prevHome + prevAway);
  if (newGoals > 0) {
    showGoalAnimation();
  }
}

function showGoalAnimation() {
  // Rimuovi eventuale overlay esistente
  const existing = document.getElementById('goal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'goal-overlay';
  overlay.innerHTML = `
    <div class="goal-burst">
      <div class="goal-text">⚽ GOAL!</div>
      <div class="goal-stars">
        ${Array.from({length:12}, (_,i) => `<div class="goal-star" style="--i:${i}">★</div>`).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Rimuovi dopo 2.2s
  setTimeout(() => overlay.remove(), 2200);
}

function flashScoreElement(el) {
  if (!el) return;
  el.classList.remove('score-flash');
  void el.offsetWidth; // reflow
  el.classList.add('score-flash');
  setTimeout(() => el.classList.remove('score-flash'), 900);
}

// Aggiungi stili animazione goal al DOM
(function injectGoalStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* ── GOAL OVERLAY ───────────────────────────── */
    #goal-overlay {
      position: fixed; inset: 0; z-index: 9998;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
      background: radial-gradient(ellipse at center,
        rgba(26,111,219,0.18) 0%, transparent 70%);
      animation: goalFadeOut 2.2s forwards;
    }
    @keyframes goalFadeOut {
      0%   { opacity:0; }
      10%  { opacity:1; }
      70%  { opacity:1; }
      100% { opacity:0; }
    }
    .goal-burst {
      display: flex; flex-direction: column; align-items: center;
      animation: goalBounce .5s cubic-bezier(.34,1.7,.64,1);
    }
    @keyframes goalBounce {
      from { transform: scale(0) rotate(-10deg); }
      to   { transform: scale(1) rotate(0deg); }
    }
    .goal-text {
      font-family: 'Nunito', sans-serif;
      font-size: clamp(52px, 12vw, 100px);
      font-weight: 900; color: #fff;
      text-shadow:
        0 0 40px rgba(26,111,219,0.8),
        0 4px 30px rgba(0,0,0,0.5);
      letter-spacing: .04em; line-height: 1;
      animation: goalPulse 1.8s ease-in-out infinite;
    }
    @keyframes goalPulse {
      0%,100% { transform: scale(1); }
      50%      { transform: scale(1.06); }
    }
    .goal-stars { position: relative; height: 60px; width: 200px; margin-top: 8px; }
    .goal-star {
      position: absolute; left: 50%; top: 50%;
      color: #fbbf24; font-size: 20px;
      animation: goalStar 1.8s ease-out forwards;
      animation-delay: calc(var(--i) * 0.08s);
      --angle: calc(var(--i) * 30deg);
    }
    @keyframes goalStar {
      0%   { transform: translate(-50%,-50%) rotate(var(--angle)) translateY(0); opacity:1; }
      100% { transform: translate(-50%,-50%) rotate(var(--angle)) translateY(-80px); opacity:0; }
    }

    /* ── SCORE FLASH ─────────────────────────────── */
    .score-flash {
      animation: scoreFlash .8s ease !important;
    }
    @keyframes scoreFlash {
      0%   { background: linear-gradient(135deg,#1a6fdb,#3b82f6); color:#fff; transform:scale(1.12); }
      50%  { background: linear-gradient(135deg,#059669,#10b981); color:#fff; transform:scale(1.08); }
      100% { background: linear-gradient(135deg,#f1f5f9,#fff); color:inherit; transform:scale(1); }
    }
  `;
  document.head.appendChild(style);
})();

// ============================================================
//  2. PROGRAMMA PARTITE
// ============================================================

async function renderProgramma() {
  const el = document.getElementById('sec-programma');
  if (!el) return;
  if (!STATE.activeCat) { el.innerHTML = '<div class="empty-state">Nessuna categoria.</div>'; return; }

  const gironi = await getGironiWithData(STATE.activeCat);
  const cat    = STATE.categorie.find(c => c.id === STATE.activeCat);

  // Raccogli tutte le partite con info girone
  const allPartite = [];
  for (const g of gironi) {
    for (const p of g.partite) {
      allPartite.push({ ...p, girone: g.nome });
    }
  }

  // Aggiungi anche knockout
  const ko = await dbGetKnockout(STATE.activeCat);
  const squadre = await dbGetSquadre(STATE.activeTorneo);
  const sqMap = {}; squadre.forEach(s => sqMap[s.id] = s);
  for (const m of ko) {
    allPartite.push({
      ...m,
      home: sqMap[m.home_id] || null,
      away: sqMap[m.away_id] || null,
      girone: m.round_name || 'Fase finale',
    });
  }

  if (!allPartite.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div>Nessuna partita programmata.</div>';
    return;
  }

  // Raggruppa per campo, poi per orario
  const perCampo = {};
  for (const p of allPartite) {
    const campo = p.campo || 'Campo da definire';
    if (!perCampo[campo]) perCampo[campo] = [];
    perCampo[campo].push(p);
  }

  // Ordina per orario
  for (const campo of Object.keys(perCampo)) {
    perCampo[campo].sort((a,b) => {
      if (!a.orario) return 1;
      if (!b.orario) return -1;
      return a.orario.localeCompare(b.orario);
    });
  }

  let html = '';

  // Stats rapide in cima
  const totalPartite   = allPartite.length;
  const partiteGiocate = allPartite.filter(p => p.giocata).length;
  const partiteRimaste = totalPartite - partiteGiocate;
  const prossima = allPartite.filter(p => !p.giocata && p.orario).sort((a,b) => a.orario.localeCompare(b.orario))[0];

  html += `
    <div class="programma-stats">
      <div class="pstat-card">
        <div class="pstat-num">${totalPartite}</div>
        <div class="pstat-label">Totali</div>
      </div>
      <div class="pstat-card pstat-green">
        <div class="pstat-num">${partiteGiocate}</div>
        <div class="pstat-label">Giocate</div>
      </div>
      <div class="pstat-card pstat-blu">
        <div class="pstat-num">${partiteRimaste}</div>
        <div class="pstat-label">Da giocare</div>
      </div>
    </div>
  `;

  if (prossima) {
    const hm = prossima.home;
    const am = prossima.away;
    html += `
      <div class="card prossima-card">
        <div class="prossima-label">⏰ Prossima partita</div>
        <div class="prossima-body">
          <div class="prossima-team">${logoHTML(hm,'sm')} ${hm?.nome||'?'}</div>
          <div class="prossima-center">
            <div class="prossima-orario">${prossima.orario}</div>
            <div class="prossima-campo">${prossima.campo||''}</div>
          </div>
          <div class="prossima-team right">${am?.nome||'?'} ${logoHTML(am,'sm')}</div>
        </div>
      </div>
    `;
  }

  // Per ogni campo
  for (const [campo, partite] of Object.entries(perCampo)) {
    const campoGiocate = partite.filter(p=>p.giocata).length;
    html += `
      <div class="campo-header">
        <span class="campo-icon">📍</span>
        <span class="campo-nome">${campo}</span>
        <span class="campo-badge">${campoGiocate}/${partite.length}</span>
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        <table class="programma-table">
          <thead>
            <tr>
              <th>Ora</th>
              <th>Girone</th>
              <th colspan="3">Partita</th>
              <th>Ris.</th>
            </tr>
          </thead>
          <tbody>
    `;
    for (const p of partite) {
      const hm = p.home;
      const am = p.away;
      const isDone = p.giocata;
      const hWin = isDone && p.gol_home > p.gol_away;
      const aWin = isDone && p.gol_away > p.gol_home;
      html += `
        <tr class="programma-row ${isDone ? 'done' : ''}">
          <td class="ptd-ora">${p.orario || '—'}</td>
          <td class="ptd-girone">${p.girone}</td>
          <td class="ptd-team ${hWin?'winner':''}">${logoHTML(hm,'sm')} <span>${hm?.nome||'?'}</span></td>
          <td class="ptd-vs">vs</td>
          <td class="ptd-team right ${aWin?'winner':''}"><span>${am?.nome||'?'}</span> ${logoHTML(am,'sm')}</td>
          <td class="ptd-score">
            ${isDone
              ? `<span class="prog-score">${p.gol_home}–${p.gol_away}</span>`
              : `<span class="prog-pending">—</span>`
            }
          </td>
        </tr>
      `;
    }
    html += `</tbody></table></div>`;
  }

  el.innerHTML = html;
}

// Stili programma
(function injectProgrammaStyles() {
  const s = document.createElement('style');
  s.textContent = `
    .programma-stats {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 10px; margin-bottom: 14px;
    }
    .pstat-card {
      background: var(--bianco); border: 1px solid var(--bordo);
      border-radius: var(--radius); padding: 14px 8px; text-align: center;
      box-shadow: var(--shadow-sm);
    }
    .pstat-card.pstat-green { border-top: 3px solid var(--verde); }
    .pstat-card.pstat-blu   { border-top: 3px solid var(--blu); }
    .pstat-num {
      font-family: var(--font-display); font-size: 28px; font-weight: 900; color: var(--testo);
    }
    .pstat-label { font-size: 11px; color: var(--testo-lt); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; }

    .prossima-card {
      border-left: 4px solid var(--blu) !important;
      background: linear-gradient(135deg, var(--blu-xlt) 0%, var(--bianco) 100%) !important;
    }
    .prossima-label {
      font-family: var(--font-display); font-size: 11px; font-weight: 800;
      color: var(--blu); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 10px;
    }
    .prossima-body {
      display: flex; align-items: center; gap: 10px;
    }
    .prossima-team {
      flex: 1; display: flex; align-items: center; gap: 6px;
      font-size: 14px; font-weight: 800; color: var(--testo);
    }
    .prossima-team.right { justify-content: flex-end; flex-direction: row-reverse; }
    .prossima-center { text-align: center; flex-shrink: 0; }
    .prossima-orario {
      font-family: var(--font-display); font-size: 22px; font-weight: 900; color: var(--blu);
    }
    .prossima-campo { font-size: 11px; color: var(--testo-lt); margin-top: 2px; }

    .campo-header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 4px 6px;
    }
    .campo-icon { font-size: 16px; }
    .campo-nome {
      font-family: var(--font-display); font-size: 14px; font-weight: 900;
      color: var(--testo); text-transform: uppercase; letter-spacing: .04em; flex: 1;
    }
    .campo-badge {
      font-family: var(--font-display); font-size: 11px; font-weight: 800;
      background: var(--blu-xlt); color: var(--blu);
      border-radius: 20px; padding: 2px 10px;
    }

    .programma-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .programma-table thead tr { background: var(--sfondo); border-bottom: 2px solid var(--bordo); }
    .programma-table th {
      padding: 8px 8px; font-family: var(--font-display); font-size: 10px; font-weight: 800;
      color: var(--testo-xlt); text-transform: uppercase; letter-spacing: .06em; text-align: center;
    }
    .programma-table th:nth-child(3) { text-align: right; }
    .programma-table th:nth-child(5) { text-align: left; }
    .programma-row { border-bottom: 1px solid var(--bordo-lt); transition: background .15s; }
    .programma-row:last-child { border-bottom: none; }
    .programma-row:hover { background: var(--sfondo); }
    .programma-row.done { opacity: .75; }
    .ptd-ora   { padding: 10px 8px; font-family: var(--font-display); font-weight: 800; color: var(--arancio); font-size: 13px; text-align: center; white-space: nowrap; }
    .ptd-girone { padding: 10px 6px; font-size: 11px; color: var(--testo-lt); font-weight: 700; white-space: nowrap; }
    .ptd-team {
      padding: 10px 6px; display: flex; align-items: center; gap: 5px;
      font-weight: 700; color: var(--testo);
    }
    .ptd-team.right { justify-content: flex-end; flex-direction: row-reverse; }
    .ptd-team.winner { color: var(--verde); font-weight: 900; }
    .ptd-vs { padding: 10px 4px; color: var(--testo-xlt); font-size: 11px; font-weight: 700; text-align: center; }
    .ptd-score { padding: 10px 8px; text-align: center; }
    .prog-score {
      font-family: var(--font-display); font-size: 15px; font-weight: 900; color: var(--testo);
      background: var(--sfondo); border-radius: 6px; padding: 2px 8px;
      border: 1px solid var(--bordo);
    }
    .prog-pending { color: var(--testo-xlt); font-size: 12px; font-weight: 600; }

    @media (max-width: 480px) {
      .ptd-girone { display: none; }
      .ptd-ora { font-size: 12px; }
      .ptd-team { font-size: 11px; }
    }
  `;
  document.head.appendChild(s);
})();


// ============================================================
//  3. NOTIFICA WHATSAPP
// ============================================================

function sendWhatsAppNotify(homeNome, awayNome, golHome, golAway, campo, catNome) {
  const torneo = STATE.tornei?.find(t => t.id === STATE.activeTorneo);
  const torneoNome = torneo?.nome || 'Soccer Pro Experience';

  const vincitore = golHome > golAway ? homeNome : golAway > golHome ? awayNome : null;
  const esito = vincitore ? `✅ Vince ${vincitore}!` : '🤝 Pareggio!';

  const msg = [
    `⚽ *RISULTATO FINALE*`,
    `🏆 ${torneoNome}${catNome ? ' — ' + catNome : ''}`,
    ``,
    `*${homeNome}* ${golHome} — ${golAway} *${awayNome}*`,
    ``,
    esito,
    campo ? `📍 ${campo}` : '',
    ``,
    `📱 Segui live: https://depmatteo2-max.github.io/torneo-calcio`,
  ].filter(l => l !== undefined).join('\n');

  const encoded = encodeURIComponent(msg);
  const url = `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank');
}

function showWhatsAppModal(homeNome, awayNome, golHome, golAway, campo, catNome) {
  // Rimuovi modal esistente
  const existing = document.getElementById('wa-modal');
  if (existing) existing.remove();

  const torneo = STATE.tornei?.find(t => t.id === STATE.activeTorneo);
  const torneoNome = torneo?.nome || 'Soccer Pro Experience';
  const vincitore = golHome > golAway ? homeNome : golAway > golHome ? awayNome : null;
  const esito = vincitore ? `✅ Vince <strong>${vincitore}</strong>!` : '🤝 <strong>Pareggio!</strong>';

  const modal = document.createElement('div');
  modal.id = 'wa-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:360px;">
      <div class="modal-title" style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:28px;">📲</span> Condividi risultato
      </div>
      <div class="wa-preview">
        <div class="wa-bubble">
          <div style="font-size:13px;font-weight:800;color:#25D366;margin-bottom:8px;">⚽ RISULTATO FINALE</div>
          <div style="font-size:12px;color:#555;margin-bottom:6px;">🏆 ${torneoNome}${catNome?' — '+catNome:''}</div>
          <div style="font-size:18px;font-weight:900;color:#111;margin:10px 0;">
            ${homeNome} <span style="color:var(--blu)">${golHome} — ${golAway}</span> ${awayNome}
          </div>
          <div style="font-size:13px;margin-bottom:4px;">${esito}</div>
          ${campo ? `<div style="font-size:12px;color:#888;">📍 ${campo}</div>` : ''}
        </div>
      </div>
      <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px;">
        <button class="btn btn-success" style="width:100%;font-size:14px;padding:12px;"
          onclick="sendWhatsAppNotify('${homeNome.replace(/'/g,"\\'")}','${awayNome.replace(/'/g,"\\'")}',${golHome},${golAway},'${(campo||'').replace(/'/g,"\\'")}','${(catNome||'').replace(/'/g,"\\'")}');document.getElementById('wa-modal').remove();">
          📤 Apri WhatsApp e condividi
        </button>
        <button class="btn" style="width:100%;"
          onclick="document.getElementById('wa-modal').remove();">
          Chiudi
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// Stili WhatsApp modal
(function injectWAStyles() {
  const s = document.createElement('style');
  s.textContent = `
    .wa-preview { background: #e5ddd5; border-radius: 10px; padding: 12px; margin-top: 4px; }
    .wa-bubble {
      background: #fff; border-radius: 8px; padding: 12px 14px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
      border-left: 4px solid #25D366;
    }
  `;
  document.head.appendChild(s);
})();


// ============================================================
//  4. BRACKET VISIVO TABELLONE
// ============================================================

async function renderTabelloneBracket() {
  const el = document.getElementById('sec-tabellone');
  if (!el || !STATE.activeCat) return;

  const ko      = await dbGetKnockout(STATE.activeCat);
  const squadre = await dbGetSquadre(STATE.activeTorneo);
  const sqMap   = {}; squadre.forEach(s => sqMap[s.id] = s);

  if (!ko.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏆</div>Tabellone non ancora generato.</div>';
    return;
  }

  const ROUND_ORDER = ['Quarti di finale','Semifinali','3° posto','Finale','5° posto','7° posto'];
  const CONS_ORDER  = ['Consolazione quarti','Consolazione semifinali','Consolazione 3° posto','Consolazione finale'];

  const main = ko.filter(m => !m.is_consolazione);
  const cons = ko.filter(m =>  m.is_consolazione);

  const buildBracket = (matches, title, icon) => {
    if (!matches.length) return '';

    // Raggruppa per round
    const rounds = {};
    matches.forEach(m => {
      if (!rounds[m.round_name]) rounds[m.round_name] = [];
      rounds[m.round_name].push(m);
    });

    const sortedRounds = Object.keys(rounds).sort((a,b) => {
      const order = [...ROUND_ORDER, ...CONS_ORDER];
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia===-1?99:ia) - (ib===-1?99:ib);
    });

    // Determina colori per round
    const ROUND_STYLE = {
      'Finale':        { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', glow: 'rgba(245,158,11,0.4)' },
      '3° posto':      { bg: 'linear-gradient(135deg,#94a3b8,#64748b)', color: '#fff', glow: 'rgba(100,116,139,0.4)' },
      'Semifinali':    { bg: 'linear-gradient(135deg,#1a6fdb,#3b82f6)', color: '#fff', glow: 'var(--shadow-blu)' },
      'Quarti di finale': { bg: 'linear-gradient(135deg,#059669,#10b981)', color: '#fff', glow: 'rgba(5,150,105,0.4)' },
    };

    let html = `
      <div class="bracket-title">${icon} ${title}</div>
      <div class="bracket-wrapper">
        <div class="bracket-rounds">
    `;

    for (const rname of sortedRounds) {
      const rmatches = rounds[rname];
      const style = ROUND_STYLE[rname] || { bg: 'linear-gradient(135deg,var(--blu-dark),var(--blu))', color:'#fff', glow:'var(--shadow-blu)' };

      html += `
        <div class="bracket-col">
          <div class="bracket-col-header" style="background:${style.bg};color:${style.color};">
            ${rname}
          </div>
          <div class="bracket-matches">
      `;

      for (const m of rmatches) {
        const hm = m.home_id ? sqMap[m.home_id] : null;
        const am = m.away_id ? sqMap[m.away_id] : null;
        const hmNome = hm?.nome || (m.note_home ? `↑ ${m.note_home}` : 'In attesa...');
        const amNome = am?.nome || (m.note_away ? `↑ ${m.note_away}` : 'In attesa...');
        const isPending = !hm || !am;
        const hWin = m.giocata && m.gol_home > m.gol_away;
        const aWin = m.giocata && m.gol_away > m.gol_home;
        const isPari = m.giocata && m.gol_home === m.gol_away;

        // Determina vincitore per mostrare la medaglia
        let medalH = '', medalA = '';
        if (rname === 'Finale') {
          if (hWin) { medalH = '🥇'; medalA = '🥈'; }
          else if (aWin) { medalA = '🥇'; medalH = '🥈'; }
        } else if (rname === '3° posto') {
          if (hWin) { medalH = '🥉'; }
          else if (aWin) { medalA = '🥉'; }
        }

        html += `
          <div class="bracket-match ${isPending?'bracket-pending':''}">
            <div class="bm-team ${hWin?'bm-winner':''} ${isPending?'bm-tbd':''}">
              <div class="bm-team-left">
                ${isPending ? '<span class="bm-dot"></span>' : logoHTML(hm,'sm')}
                <span class="bm-name">${hmNome}</span>
                ${medalH ? `<span class="bm-medal">${medalH}</span>` : ''}
              </div>
              <span class="bm-score ${hWin?'bm-score-win':''}">${m.giocata ? m.gol_home : ''}</span>
            </div>
            <div class="bm-sep"></div>
            <div class="bm-team ${aWin?'bm-winner':''} ${isPending?'bm-tbd':''}">
              <div class="bm-team-left">
                ${isPending ? '<span class="bm-dot"></span>' : logoHTML(am,'sm')}
                <span class="bm-name">${amNome}</span>
                ${medalA ? `<span class="bm-medal">${medalA}</span>` : ''}
              </div>
              <span class="bm-score ${aWin?'bm-score-win':''}">${m.giocata ? m.gol_away : ''}</span>
            </div>
          </div>
        `;
      }

      html += `</div></div>`;
    }

    html += `</div></div>`;
    return html;
  };

  // Anche: mini classifica triangolari (mantieni da codice originale)
  const ROUND_COLORS = { 'PLATINO':'#FFD700','GOLD':'#FFA500','SILVER':'#C0C0C0','BRONZO':'#CD7F32','WHITE':'#B0BEC5' };
  const renderTriangolari = (matches) => {
    if (!matches.length) return '';
    const rounds = {};
    matches.forEach(m => { if (!rounds[m.round_name]) rounds[m.round_name] = []; rounds[m.round_name].push(m); });
    let h = '';
    for (const [rname, rmatch] of Object.entries(rounds)) {
      const rkey = Object.keys(ROUND_COLORS).find(k => rname.toUpperCase().includes(k));
      const color = ROUND_COLORS[rkey] || '#2e86c1';
      const giocateRound = rmatch.filter(m => m.giocata && m.home_id && m.away_id);
      let miniClass = '';
      if (giocateRound.length > 0) {
        const sqIds = [...new Set(rmatch.flatMap(m=>[m.home_id,m.away_id]).filter(Boolean))];
        const sqRnd = sqIds.map(id=>sqMap[id]).filter(Boolean);
        const pRnd  = giocateRound.map(m=>({home_id:m.home_id,away_id:m.away_id,gol_home:m.gol_home,gol_away:m.gol_away,giocata:true}));
        const cl    = calcGironeClassifica({squadre:sqRnd,partite:pRnd});
        miniClass = `<div style="margin-top:10px;border-top:1px solid #eee;padding-top:8px;">
          <div style="font-size:11px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Classifica</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse;">
            <thead><tr style="color:#aaa;"><th style="text-align:left;padding:3px 4px;">#</th><th style="text-align:left;padding:3px 4px;">Squadra</th><th style="padding:3px 4px;">Pt</th><th style="padding:3px 4px;">GD</th><th style="padding:3px 4px;">GF</th></tr></thead>
            <tbody>${cl.map((row,i) => { const diff=row.gf-row.gs; return `<tr style="${i===0?'font-weight:700;':''} border-top:1px solid #f5f5f5;"><td style="padding:3px 4px;">${i+1}</td><td style="padding:3px 4px;display:flex;align-items:center;gap:4px;">${logoHTML(row.sq,'sm')} ${row.sq.nome}</td><td style="padding:3px 4px;text-align:center;">${row.pts}</td><td style="padding:3px 4px;text-align:center;color:${diff>0?'#27ae60':diff<0?'#e74c3c':'inherit'}">${diff>0?'+':''}${diff}</td><td style="padding:3px 4px;text-align:center;">${row.gf}</td></tr>`; }).join('')}</tbody>
          </table></div>`;
      }
      h += `<div class="card" style="border-top:4px solid ${color};margin-bottom:12px;">
        <div class="card-title">${rname}</div>`;
      for (const m of rmatch) {
        const hm=m.home_id?sqMap[m.home_id]:null, am=m.away_id?sqMap[m.away_id]:null;
        const hmNome=hm?hm.nome:(m.note_home||'In attesa...'), amNome=am?am.nome:(m.note_away||'In attesa...');
        const isPending=!hm||!am;
        h += `<div class="match-result ${isPending?'pending-match':''}">
          <div class="match-team">${isPending?'':logoHTML(hm,'sm')}<span style="${isPending?'color:#bbb;font-style:italic;':''}">${hmNome}</span></div>
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div class="match-score ${!m.giocata?'pending':''}">${m.giocata?m.gol_home+' — '+m.gol_away:'vs'}</div>
          </div>
          <div class="match-team right"><span style="${isPending?'color:#bbb;font-style:italic;':''}">${amNome}</span>${isPending?'':logoHTML(am,'sm')}</div>
        </div>`;
      }
      h += miniClass + `</div>`;
    }
    return h;
  };

  const mainBracket = buildBracket(main, 'Tabellone principale', '🏆');
  const consBracket = ko.filter(m=>m.is_consolazione && !['PLATINO','GOLD','SILVER','BRONZO','WHITE'].some(k=>m.round_name?.toUpperCase().includes(k))).length
    ? buildBracket(cons.filter(m=>!['PLATINO','GOLD','SILVER','BRONZO','WHITE'].some(k=>m.round_name?.toUpperCase().includes(k))), 'Consolazione', '🥉')
    : '';
  const triangolariMain = renderTriangolari(main.filter(m => ['PLATINO','GOLD','SILVER','BRONZO','WHITE'].some(k=>m.round_name?.toUpperCase().includes(k))));
  const triangolariCons = renderTriangolari(cons.filter(m => ['PLATINO','GOLD','SILVER','BRONZO','WHITE'].some(k=>m.round_name?.toUpperCase().includes(k))));

  el.innerHTML = mainBracket + consBracket + triangolariMain + triangolariCons ||
    '<div class="empty-state">Tabellone non ancora generato.</div>';
}

// Stili bracket
(function injectBracketStyles() {
  const s = document.createElement('style');
  s.textContent = `
    .bracket-title {
      font-family: var(--font-display); font-size: 14px; font-weight: 900;
      color: var(--testo); text-transform: uppercase; letter-spacing: .05em;
      margin: 0 0 10px; display: flex; align-items: center; gap: 8px;
    }
    .bracket-wrapper { overflow-x: auto; padding-bottom: 12px; margin-bottom: 20px; }
    .bracket-rounds { display: flex; gap: 12px; min-width: max-content; }
    .bracket-col { width: 200px; flex-shrink: 0; }
    .bracket-col-header {
      font-family: var(--font-display); font-size: 11px; font-weight: 900;
      letter-spacing: .07em; text-transform: uppercase;
      padding: 8px 12px; border-radius: var(--radius) var(--radius) 0 0;
      text-align: center; margin-bottom: 1px;
    }
    .bracket-matches { display: flex; flex-direction: column; gap: 10px; padding-top: 10px; }

    .bracket-match {
      background: var(--bianco); border: 1.5px solid var(--bordo);
      border-radius: var(--radius); overflow: hidden;
      box-shadow: var(--shadow); transition: all .2s;
    }
    .bracket-match:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
    .bracket-pending { opacity: .65; }

    .bm-team {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 10px; font-size: 12px; font-weight: 700; color: var(--testo);
      transition: background .15s;
    }
    .bm-team.bm-winner {
      background: linear-gradient(90deg, rgba(5,150,105,0.08) 0%, transparent 100%);
      color: var(--verde); font-weight: 900;
    }
    .bm-team.bm-tbd { color: var(--testo-xlt); font-style: italic; }
    .bm-team-left { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
    .bm-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bm-medal { font-size: 14px; margin-left: 3px; flex-shrink: 0; }
    .bm-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--bordo); flex-shrink: 0;
    }
    .bm-score {
      font-family: var(--font-display); font-size: 18px; font-weight: 900;
      color: var(--testo-lt); min-width: 22px; text-align: right; flex-shrink: 0;
    }
    .bm-score.bm-score-win { color: var(--blu); }
    .bm-sep { height: 1px; background: var(--bordo); }
  `;
  document.head.appendChild(s);
})();


// ============================================================
//  OVERRIDE: aggancia le nuove funzionalità al sistema esistente
// ============================================================

// Override renderTabellone con versione bracket
const _origRenderTabellone = window.renderTabellone;
window.renderTabellone = async function() {
  await renderTabelloneBracket();
};

// Override renderCurrentSection per aggiungere 'programma'
const _origRenderCurrentSection = window.renderCurrentSection;
window.renderCurrentSection = async function() {
  const s = STATE.currentSection;
  if (s === 'programma') {
    updateHeader && updateHeader();
    await renderProgramma();
  } else {
    await _origRenderCurrentSection();
  }
};

// Override showSection per supportare 'programma'
const _origShowSection = window.showSection;
window.showSection = function(section, btn) {
  // Gestione bottoni attivi
  const navParent = btn?.closest('.nav-inner') || btn?.closest('.tv-nav');
  if (navParent) {
    navParent.querySelectorAll('.nav-btn, .tv-nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  // Nascondi tutte le sezioni
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));

  // Sezione programma — gestione speciale
  if (section === 'programma') {
    let el = document.getElementById('sec-programma');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sec-programma';
      el.className = 'sec';
      document.getElementById('main-content').appendChild(el);
    }
    el.classList.add('active');
    STATE.currentSection = 'programma';
    renderProgramma();
    return;
  }

  // Sezioni normali
  const el = document.getElementById('sec-' + section);
  if (el) el.classList.add('active');
  STATE.currentSection = section;
  _origRenderCurrentSection && _origRenderCurrentSection();
};

// Aggiungi tasto "Programma" nella nav pubblica dopo il DOM
document.addEventListener('DOMContentLoaded', function() {
  // Attendi che app.js finisca l'init
  setTimeout(() => {
    const pubNav = document.getElementById('pub-nav');
    if (pubNav && !pubNav.querySelector('[data-section="programma"]')) {
      const btn = document.createElement('button');
      btn.className = 'nav-btn';
      btn.setAttribute('data-section', 'programma');
      btn.textContent = 'Programma';
      btn.onclick = function() { showSection('programma', this); };
      // Inserisci dopo "Risultati"
      const risultatiBtn = pubNav.querySelector('[data-section="risultati"]');
      if (risultatiBtn && risultatiBtn.nextSibling) {
        pubNav.insertBefore(btn, risultatiBtn.nextSibling);
      } else {
        pubNav.appendChild(btn);
      }
    }

    // Aggiungi tasto WhatsApp alla funzione salva risultato
    patchSalvaRisultato();
  }, 500);
});

// Patch: aggiungi pulsante WhatsApp dopo salvataggio risultato
function patchSalvaRisultato() {
  const _origSalva = window.salvaRisultato;
  if (!_origSalva) return;
  window.salvaRisultato = async function(partitaId, gironeId) {
    const hInput = document.getElementById(`gh-${partitaId}`);
    const aInput = document.getElementById(`ga-${partitaId}`);
    if (!hInput || !aInput) return;

    const golHome = parseInt(hInput.value) || 0;
    const golAway = parseInt(aInput.value) || 0;

    // Leggi dati partita per il nome squadre
    try {
      const gironi = await getGironiWithData(STATE.activeCat);
      let homeNome = '?', awayNome = '?', campo = '';
      for (const g of gironi) {
        const p = g.partite.find(x => x.id === partitaId);
        if (p) {
          homeNome = p.home?.nome || '?';
          awayNome = p.away?.nome || '?';
          campo    = p.campo || '';
          break;
        }
      }

      // Prima, salva il risultato originale
      const prevEl = document.getElementById(`score-display-${partitaId}`);
      const prevText = prevEl?.textContent || '0 — 0';
      const [prevH, prevA] = prevText.split('—').map(s => parseInt(s.trim()) || 0);

      await _origSalva(partitaId, gironeId);

      // Controlla se c'è stato un gol
      if (golHome + golAway > prevH + prevA) {
        showGoalAnimation();
        const scoreEl = document.querySelector(`[data-score-id="${partitaId}"]`);
        flashScoreElement(scoreEl);
      }

      // Mostra modal WhatsApp
      const cat = STATE.categorie?.find(c => c.id === STATE.activeCat);
      showWhatsAppModal(homeNome, awayNome, golHome, golAway, campo, cat?.nome || '');

    } catch(e) {
      await _origSalva(partitaId, gironeId);
    }
  };
}
