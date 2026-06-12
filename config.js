// ============================================================
//  CONFIG.JS — MC LION TROPHY 2026
//  Branch: mc-lion-trophy
// ============================================================
const CONFIG = {
  SUPABASE_URL     : 'https://hvakazxnvooffskvoyyl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2YWthenhudm9vZmZza3ZveXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDQ0NDYsImV4cCI6MjA4OTQyMDQ0Nn0.LfEYuBmb-4f2TuuY1rUGn1SSebMxYN8TNWL4FrfBUZw',
  CLIENTE          : 'mclion',
  NOME_SITO        : '🦁 MC Lion Trophy 2026',
  USERS: [
    // ── ADMIN (6) ──
    { username: 'admin',    password: 'mclion2026',  role: 'admin', nome: 'Admin'    },
    { username: 'admin2',   password: 'mclion2026b', role: 'admin', nome: 'Admin 2'  },
    { username: 'admin3',   password: 'mclion2026c', role: 'admin', nome: 'Admin 3'  },
    { username: 'admin4',   password: 'mclion2026d', role: 'admin', nome: 'Admin 4'  },
    { username: 'admin5',   password: 'mclion2026e', role: 'admin', nome: 'Admin 5'  },
    { username: 'admin6',   password: 'mclion2026f', role: 'admin', nome: 'Admin 6'  },
    // ── ARBITRI (6) ──
    { username: 'arbitro1', password: 'arbitro2026a', role: 'scorer', nome: 'Arbitro 1' },
    { username: 'arbitro2', password: 'arbitro2026b', role: 'scorer', nome: 'Arbitro 2' },
    { username: 'arbitro3', password: 'arbitro2026c', role: 'scorer', nome: 'Arbitro 3' },
    { username: 'arbitro4', password: 'arbitro2026d', role: 'scorer', nome: 'Arbitro 4' },
    { username: 'arbitro5', password: 'arbitro2026e', role: 'scorer', nome: 'Arbitro 5' },
    { username: 'arbitro6', password: 'arbitro2026f', role: 'scorer', nome: 'Arbitro 6' },
  ]
};

// Logo del torneo
function getLogo() {
  return 'logo.png';
}
