// Rhodense Config
var CONFIG = (function(){
  var _k = 'RHO2026xK9mQ';
  var _x = function(e){ return e.split(',').map(function(n,i){ return String.fromCharCode(parseInt(n) ^ _k.charCodeAt(i % _k.length)); }).join(''); };
  var _u = [
  {
    "username": "admin1",
    "_pw": "32,32,32,86,85,92,69,29,121,9,95,103,18",
    "ruolo": "admin",
    "nome": "Admin 1"
  },
  {
    "username": "admin2",
    "_pw": "32,32,32,86,85,92,69,29,121,9,95,103,18",
    "ruolo": "admin",
    "nome": "Admin 2"
  },
  {
    "username": "admin3",
    "_pw": "32,32,32,92,84,87,88,11,46,11,93,99,100,8",
    "ruolo": "admin",
    "nome": "Admin 3"
  },
  {
    "username": "arbitro1",
    "_pw": "19,58,45,91,68,64,89,73,106",
    "ruolo": "arbitro",
    "nome": "Arbitro 1"
  },
  {
    "username": "arbitro2",
    "_pw": "19,58,45,91,68,64,89,74,106",
    "ruolo": "arbitro",
    "nome": "Arbitro 2"
  },
  {
    "username": "arbitro3",
    "_pw": "19,58,45,91,68,64,89,75,106",
    "ruolo": "arbitro",
    "nome": "Arbitro 3"
  }
];
  return {
    SUPABASE_URL: 'https://hvakazxnvooffskvoyyl.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2YWthenhudm9vZmZza3ZveXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDQ0NDYsImV4cCI6MjA4OTQyMDQ0Nn0.LfEYuBmb-4f2TuuY1rUGn1SSebMxYN8TNWL4FrfBUZw',
    CLIENTE: 'rhodense',
    USERS: _u.map(function(u){ return { username: u.username, password: _x(u._pw), ruolo: u.ruolo, nome: u.nome }; })
  };
})();