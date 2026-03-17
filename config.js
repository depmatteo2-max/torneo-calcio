// ============================================================
//  CONFIGURAZIONE - Soccer Pro Experience
// ============================================================

const CONFIG = {
  SUPABASE_URL: 'https://rapusxysanvicnnkssph.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhcHVzeHlzYW52aWNubmtzc3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzE0MDIsImV4cCI6MjA4OTE0NzQwMn0.dwGf9F8DqUUTXVBpk2Ja7HW87le0TscBkRccGEsVGPE',

  // ============================================================
  //  UTENTI ADMIN
  //  Modifica username e password come vuoi
  //  ruolo: 'admin' = accesso completo
  //  ruolo: 'arbitro' = solo inserimento risultati
  // ============================================================
  USERS: [
    // ADMIN COMPLETI (3)
    { username: 'admin1',   password: 'Spe_2026@',   ruolo: 'admin',   nome: 'Admin 1' },
    { username: 'admin2',   password: 'Spe_2026@',   ruolo: 'admin',   nome: 'Admin 2' },
    { username: 'admin3',   password: 'Spe_2026@',   ruolo: 'admin',   nome: 'Admin 3' },

    // ARBITRI / OPERATORI (10)
    { username: 'arbitro1',  password: 'Arbitro1!',  ruolo: 'arbitro', nome: 'Arbitro 1'  },
    { username: 'arbitro2',  password: 'Arbitro2!',  ruolo: 'arbitro', nome: 'Arbitro 2'  },
    { username: 'arbitro3',  password: 'Arbitro3!',  ruolo: 'arbitro', nome: 'Arbitro 3'  },
    { username: 'arbitro4',  password: 'Arbitro4!',  ruolo: 'arbitro', nome: 'Arbitro 4'  },
    { username: 'arbitro5',  password: 'Arbitro5!',  ruolo: 'arbitro', nome: 'Arbitro 5'  },
    { username: 'arbitro6',  password: 'Arbitro6!',  ruolo: 'arbitro', nome: 'Arbitro 6'  },
    { username: 'arbitro7',  password: 'Arbitro7!',  ruolo: 'arbitro', nome: 'Arbitro 7'  },
    { username: 'arbitro8',  password: 'Arbitro8!',  ruolo: 'arbitro', nome: 'Arbitro 8'  },
    { username: 'arbitro9',  password: 'Arbitro9!',  ruolo: 'arbitro', nome: 'Arbitro 9'  },
    { username: 'arbitro10', password: 'Arbitro10!', ruolo: 'arbitro', nome: 'Arbitro 10' },
  ],

  // Mantieni per compatibilità
  ADMIN_PASSWORD: 'Spe_2026@',
};
