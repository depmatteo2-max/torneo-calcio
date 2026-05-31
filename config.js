// ============================================================
//  CONFIG.JS — MC LION TROPHY 2026
//  Branch: mc-lion-trophy
//  Modifica SUPABASE_URL e SUPABASE_ANON_KEY con le tue credenziali
// ============================================================
const CONFIG = {
  SUPABASE_URL     : 'https://hvakazxnvooffskvoyyl.supabase.co',          // ← inserisci la tua URL Supabase
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2YWthenhudm9vZmZza3ZveXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDQ0NDYsImV4cCI6MjA4OTQyMDQ0Nn0.LfEYuBmb-4f2TuuY1rUGn1SSebMxYN8TNWL4FrfBUZw',                             // ← inserisci la tua anon key
  CLIENTE          : 'mclion',                               // identificatore univoco nel DB
  NOME_SITO        : '🦁 MC Lion Trophy 2026',
  USERS: [
    { username: 'admin',    password: 'mclion2026',  role: 'admin'  },
    { username: 'arbitro1', password: 'arbitro2026', role: 'scorer' },
    { username: 'arbitro2', password: 'scorer2026',  role: 'scorer' },
  ]
};
