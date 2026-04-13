// Coaching Sport Italia — Garda Coaching Trophy
var CONFIG = (function(){
  var _k = 'GARDA2026xK9mQ';
  var _x = function(e){ return e.split(',').map(function(n,i){ return String.fromCharCode(parseInt(n) ^ _k.charCodeAt(i % _k.length)); }).join(''); };
  var _u = [
    { "username": "admin1",   "_pw": "0,32,32,32,32,109,113,86,91,17,37,8,76",   "ruolo": "admin",   "nome": "Admin 1" },
    { "username": "admin2",   "_pw": "0,32,32,32,32,109,113,86,91,17,37,11,76",  "ruolo": "admin",   "nome": "Admin 2" },
    { "username": "admin3",   "_pw": "0,32,32,32,32,109,113,86,91,17,37,10,76",  "ruolo": "admin",   "nome": "Admin 3" },
    { "username": "arbitro1", "_pw": "6,51,48,27,6,83,66,86,87,39,122,24",       "ruolo": "arbitro", "nome": "Arbitro 1" },
    { "username": "arbitro2", "_pw": "6,51,48,27,6,83,66,86,87,39,121,24",       "ruolo": "arbitro", "nome": "Arbitro 2" },
    { "username": "arbitro3", "_pw": "6,51,48,27,6,83,66,86,87,39,120,24",       "ruolo": "arbitro", "nome": "Arbitro 3" },
    { "username": "arbitro4", "_pw": "6,51,48,27,6,83,66,86,87,39,127,24",       "ruolo": "arbitro", "nome": "Arbitro 4" },
    { "username": "arbitro5", "_pw": "6,51,48,27,6,83,66,86,87,39,126,24",       "ruolo": "arbitro", "nome": "Arbitro 5" },
    { "username": "arbitro6", "_pw": "6,51,48,27,6,83,66,86,87,39,125,24",       "ruolo": "arbitro", "nome": "Arbitro 6" }
  ];
  return {
    SUPABASE_URL     : 'https://hvakazxnvooffskvoyyl.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2YWthenhudm9vZmZza3ZveXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDQ0NDYsImV4cCI6MjA4OTQyMDQ0Nn0.LfEYuBmb-4f2TuuY1rUGn1SSebMxYN8TNWL4FrfBUZw',
    CLIENTE          : 'coachingsportitalia',
    NOME_SITO        : 'Coaching Sport Italia',
    LOGO             : 'logo_csi.png',
    USERS: _u.map(function(u){ return { username: u.username, password: _x(u._pw), ruolo: u.ruolo, nome: u.nome }; })
  };
})();
