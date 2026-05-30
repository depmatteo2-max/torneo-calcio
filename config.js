// ============================================================
//  CONFIG.JS — MC LION TROPHY 2026
//  Branch: mc-lion-trophy
//  Modifica SUPABASE_URL e SUPABASE_ANON_KEY con le tue credenziali
// ============================================================
const CONFIG = {
  SUPABASE_URL     : 'https://XXXXXX.supabase.co',          // ← inserisci la tua URL Supabase
  SUPABASE_ANON_KEY: 'eyXXXXXX',                             // ← inserisci la tua anon key
  CLIENTE          : 'mclion',                               // identificatore univoco nel DB
  NOME_SITO        : '🦁 MC Lion Trophy 2026',
  USERS: [
    { username: 'admin',    password: 'mclion2026',  role: 'admin'  },
    { username: 'arbitro1', password: 'arbitro2026', role: 'scorer' },
    { username: 'arbitro2', password: 'scorer2026',  role: 'scorer' },
  ]
};
