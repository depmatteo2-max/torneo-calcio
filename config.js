// ============================================================
//  CONFIGURAZIONE — Soccer Pro Experience
// ============================================================
const CONFIG = {
  SUPABASE_URL     : 'https://hvakazxnvooffskvoyyl.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_JRJmEOL1ne439tC3vzaqyw_H9CZwlIZ',

  // ============================================================
  //  UTENTI
  //  ruolo 'admin'  → accesso completo (tornei, setup, risultati, fase finale, loghi)
  //  ruolo 'arbitro'→ solo inserimento risultati (gironi + knockout)
  // ============================================================
  USERS: [
    // ── ADMIN (accesso completo) ──────────────────────────────
    { username: 'admin1',    password: 'Spe_Admin1!',   ruolo: 'admin',   nome: 'Admin 1'    },
    { username: 'admin2',    password: 'Spe_Admin2!',   ruolo: 'admin',   nome: 'Admin 2'    },
    { username: 'admin3',    password: 'Spe_Admin3!',   ruolo: 'admin',   nome: 'Admin 3'    },
    // ── ARBITRI (solo risultati) ──────────────────────────────
    { username: 'arbitro1',  password: 'Arb2026_1!',   ruolo: 'arbitro', nome: 'Arbitro 1'  },
    { username: 'arbitro2',  password: 'Arb2026_2!',   ruolo: 'arbitro', nome: 'Arbitro 2'  },
    { username: 'arbitro3',  password: 'Arb2026_3!',   ruolo: 'arbitro', nome: 'Arbitro 3'  },
    { username: 'arbitro4',  password: 'Arb2026_4!',   ruolo: 'arbitro', nome: 'Arbitro 4'  },
    { username: 'arbitro5',  password: 'Arb2026_5!',   ruolo: 'arbitro', nome: 'Arbitro 5'  },
    { username: 'arbitro6',  password: 'Arb2026_6!',   ruolo: 'arbitro', nome: 'Arbitro 6'  },
    { username: 'arbitro7',  password: 'Arb2026_7!',   ruolo: 'arbitro', nome: 'Arbitro 7'  },
    { username: 'arbitro8',  password: 'Arb2026_8!',   ruolo: 'arbitro', nome: 'Arbitro 8'  },
    { username: 'arbitro9',  password: 'Arb2026_9!',   ruolo: 'arbitro', nome: 'Arbitro 9'  },
    { username: 'arbitro10', password: 'Arb2026_10!',  ruolo: 'arbitro', nome: 'Arbitro 10' },
  ],

  // Mantieni per compatibilità con vecchio codice
  ADMIN_PASSWORD: 'Spe_Admin1!',
};
