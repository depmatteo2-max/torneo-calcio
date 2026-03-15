# Torneo Calcio Giovanile — Guida alla pubblicazione

## Cosa hai in questa cartella

| File | Descrizione |
|------|-------------|
| `index.html` | Pagina principale del sito |
| `style.css` | Stile grafico |
| `app.js` | Logica dell'applicazione |
| `db.js` | Connessione al database |
| `config.js` | **Qui metti le tue credenziali** |
| `supabase-schema.sql` | Schema del database da eseguire una volta |

---

## PASSO 1 — Crea il database su Supabase (5 minuti)

1. Vai su **https://supabase.com** e clicca **Start your project**
2. Registrati con Google o email
3. Clicca **New project** → dai un nome (es. `torneo-calcio`) → scegli una password → regione **West EU (Ireland)** → **Create project** (aspetta ~2 minuti)
4. Nel menu a sinistra clicca **SQL Editor**
5. Apri il file `supabase-schema.sql` con un editor di testo (es. Blocco Note), copia **tutto** il contenuto
6. Incollalo nell'SQL Editor di Supabase e clicca **Run** (tasto verde in basso a destra)
7. Dovresti vedere "Success. No rows returned"

### Copia le credenziali:
- Nel menu a sinistra clicca **Settings → API**
- Copia **Project URL** (es. `https://abcdefgh.supabase.co`)
- Copia **anon public** key (stringa lunga)

---

## PASSO 2 — Configura il file config.js

Apri `config.js` con il Blocco Note e sostituisci i valori:

```js
const CONFIG = {
  SUPABASE_URL: 'https://TUOCODICE.supabase.co',   // <-- incolla qui il Project URL
  SUPABASE_ANON_KEY: 'eyJhbGciOi...',               // <-- incolla qui l'anon key
  ADMIN_PASSWORD: 'scegli-una-password',             // <-- cambia con la tua password
};
```

Salva il file.

---

## PASSO 3 — Pubblica su GitHub Pages (5 minuti)

1. Vai su **https://github.com** e registrati (gratis)
2. Clicca **+** in alto a destra → **New repository**
3. Nome: `torneo-calcio` → spunta **Public** → clicca **Create repository**
4. Nella pagina del repository vuoto, clicca **uploading an existing file**
5. Trascina **tutti i file** della cartella (`index.html`, `style.css`, `app.js`, `db.js`, `config.js`) → **NON caricare** `supabase-schema.sql` e `README.md`
6. In basso clicca **Commit changes**
7. Vai su **Settings** (in alto nel repository) → **Pages** (nel menu a sinistra)
8. In **Branch** seleziona **main** → clicca **Save**
9. Dopo 1-2 minuti apparirà il link del tuo sito, tipo:
   `https://tuonome.github.io/torneo-calcio`

**Condividi questo link con i genitori via WhatsApp!**

---

## Come usare il sito

### Vista pubblica (genitori)
- Aprono il link e vedono classifiche, risultati e tabellone in tempo reale
- Le classifiche si aggiornano automaticamente quando inserisci i risultati

### Accesso admin (tu)
- Clicca il pulsante **Admin** in alto a destra
- Inserisci la password che hai impostato in `config.js`
- Accedi alle sezioni: Setup, Loghi, Risultati, Fase finale

### Ordine consigliato prima del torneo:
1. **Setup** → inserisci nome torneo e aggiungi le categorie con le squadre
2. **Loghi** → carica i loghi delle squadre (opzionale)

### Durante il torneo:
1. **Risultati** → inserisci i punteggi finali e i marcatori
2. **Fase finale** → genera il tabellone e inserisci i risultati degli scontri diretti

---

## Aggiornare il sito in futuro

Se modifichi un file localmente, torna su GitHub, clicca sul file e poi sull'icona della matita per modificarlo, oppure carica di nuovo il file aggiornato.

---

## Problemi comuni

**Il sito non carica i dati**
→ Controlla che in `config.js` l'URL e la chiave Supabase siano corretti (senza spazi extra)

**Errore "Failed to fetch"**
→ Assicurati di aver eseguito lo schema SQL su Supabase

**Non riesco ad accedere come admin**
→ Controlla la password in `config.js` — rispetta maiuscole/minuscole
