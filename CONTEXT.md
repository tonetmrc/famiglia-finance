# FamilyFinance — Contesto progetto

## Scopo

App web per tracciare spese, entrate, investimenti e divisione spese tra
Marco (proprietario) e sua moglie/partner "Sara", con split proporzionale
agli stipendi (tipo Splitwise ma con logica custom). Multi-utente: anche
un'altra coppia (Enrico e sua moglie) usa la stessa app con dati
completamente separati via autenticazione Supabase.

## Stack

- **Frontend**: React (Vite), single file `src/App.jsx` (~1200 righe),
  nessuna libreria UI esterna oltre `recharts` per i grafici
- **Backend**: Supabase (Postgres + Auth), un'unica tabella `ff_data`
- **Deploy**: Vercel, collegato a GitHub (`tonetmrc/famiglia-finance`,
  branch `main`) — push su main = deploy automatico in produzione
- **Repo locale**: `~/Downloads/famiglia-finance` (Mac di Marco)

## Credenziali e riferimenti

- Supabase project URL: `https://xqnvjdmdlysbaonxqfcd.supabase.co`
- Supabase anon key: hardcoded in `App.jsx` (cerca `SUPABASE_KEY`)
- App live: `https://famiglia-finance.vercel.app`
- GitHub repo: `https://github.com/tonetmrc/famiglia-finance`
- User Marco (UID Supabase): `60c9f3dc-aedc-4f17-8ef5-0a2337c0e85f`
- User Enrico (UID Supabase): `b7d75571-453f-479e-9229-f500d4480b93`
- Password app rimossa in favore di login email/password reale via
  Supabase Auth (`signIn`/`signOut` in App.jsx)

## Architettura dati (tabella `ff_data`)

Una riga per utente, chiave primaria `user_id` (uuid, FK verso
`auth.users`), colonna `payload` (jsonb) con l'intero stato dell'app:

```
{
  settings: { stipendioIO, stipendioSara, nomeIO, nomeSara },
  categories: [{id, name, icon}],
  recurring: [{id, name, amount, category, type: "fixed"|"variable",
               who: "comune"|"io"|"sara", paidBy: "io"|"sara", essential}],
  expenses: [{id, date, amount, category, description, who: "io"|"sara",
              type: "comune"|"solo-io"|"solo-sara"|"per-sara"|"per-io",
              essential}],
  incomes: { [month]: {stipendioIO, stipendioSara, extraIO:[], extraSara:[]} },
  recurringValues: { [month]: { [recurringId]: amount } },  // per le variabili
  carryover: { [month]: number },  // base esplicita, opzionale
  investments: [{id, name, owner, monthlyContrib, currentValue,
                 lastUpdated, history:[{date,value}]}],
  settlements: [{id, date, amount, payer: "io"|"sara", note, month}],
  debitoIniziale: { [month]: number },  // positivo = Marco deve a Sara
  entrateCondivise: { [month]: [{id, date, amount,
                                  ricevutoDa: "io"|"sara", description}] },
  realHistory: [{month, label, shortLabel, base, entrate, uscite}],
  // dati storici "reali" inseriti a mano per i mesi precedenti
  // all'uso dell'app (set 2025 - mag 2026 per Marco)
}
```

**IMPORTANTE**: `debitoIniziale` ed `entrateCondivise` sono STATE
recentemente convertiti da valore/array globale a oggetto keyed per
mese (`{[month]: ...}`). Se in futuro si trovano dati col vecchio
formato (numero semplice o array piatto), serve gestire la retro-
compatibilità o migrare manualmente su Supabase.

## Logica di business chiave

### Split spese comuni (sezione "Divisione")
- Le spese `type: "comune"` si dividono proporzionalmente agli stipendi
  del mese (`pctIO`, `pctSara` calcolati da `income.stipendioIO` /
  `stipendioSara` di quel mese specifico, non dai default in Settings)
- Le ricorrenti `who: "comune"` usano `paidBy` per sapere chi le ha
  pagate fisicamente (diverso da `who` che indica l'appartenenza)
- Spese `type: "per-sara"` (pagate da Marco per Sara) e `"per-io"`
  (pagate da Sara per Marco) sono rimborsi al 100%, NON entrano nello
  split proporzionale — vanno gestite come credito/debito diretto

### Saldo netto (il numero che conta davvero)
`netBalance = diffIO - settlTotal - debitoIniziale - debitoEntrateIO + creditoEntrateIO + creditoIO_perSara - creditoIO_perIO`

Dove:
- `diffIO` = quanto Marco ha pagato in più/meno della sua quota nelle
  spese comuni del mese
- `settlTotal` = saldi già registrati manualmente (pulsante "Registra
  saldo")
- `debitoIniziale` = debito pregresso per quel mese specifico (si
  riporta manualmente da un mese all'altro, NON è automatico)
- `entrateCondivise` (es. assegno unico INPS): chi riceve il bonifico
  deve la metà all'altro

**UI**: la Dashboard e la pagina Spese mostrano SOLO `netBalance`
(tramite `netMsg`). In precedenza mostravano anche il saldo del solo
mese corrente ("Questo mese: ...") ma creava confusione (sembravano
due debiti diversi da sommare invece che due viste dello stesso dato)
— è stato rimosso.

### Carryover (base del mese, "quanto avevo sul conto a inizio mese")
Fix più recente e più delicato del progetto. Funzione
`computeCarryover(data, month, depth)` in App.jsx:
- Se `data.carryover[month]` è esplicito (inserito a mano o importato),
  usa quello
- Altrimenti lo **deriva ricorsivamente** dal residuo del mese
  precedente: `carryover(m) = totalIncome(prev) + carryover(prev) -
  totalExpenses(prev) - totalInvestments(prev)`
- **Bug corretto oggi**: prima la ricorsione si fermava al primo
  livello (guardava solo `data.carryover[prevMonth]`, non lo
  ricalcolava se anch'esso era implicito), quindi la catena si
  azzerava dopo un mese. Ora `computeCarryover` chiama se stessa
  ricorsivamente con un `_depth` di sicurezza (max 240) contro loop
  infiniti
- **Bug corretto oggi**: il calcolo del reddito del mese precedente
  non includeva `entrateCondivise` (es. assegno unico), causando un
  disallineamento sistematico di importo pari all'assegno ogni volta
  che mancava

### Report storico (tab "Report")
- `REAL_HISTORY` = array `data.realHistory`, dati inseriti a mano per
  i mesi "storici" prima dell'uso dell'app (set 2025 → mag 2026 per
  Marco). Contiene `{month, base, entrate, uscite}` con `entrate:
  null` per il mese "corrente" al momento della creazione
- **Bug corretto oggi**: la tabella mostrava SOLO `REAL_HISTORY` + il
  mese corrente (`CURRENT_MONTH()`), saltando completamente tutti i
  mesi intermedi calcolati dall'app (es. giugno/luglio/agosto 2026
  erano invisibili in tabella). Ora genera anche i mesi calcolati
  dall'app tra l'ultimo `REAL_HISTORY` e il mese corrente incluso

### Stipendi mese per mese
- Sezione Entrate: si può modificare lo stipendio per ogni mese
  singolarmente (salvato in `data.incomes[month]`)
- Quando si apre un mese senza dati, lo stipendio si pre-compila col
  valore del mese precedente (non torna a 0 o al default globale)
- I valori in Impostazioni (`data.settings.stipendioIO/Sara`) sono
  SOLO il default per mesi mai toccati, non la fonte di verità per lo
  split — quella è sempre `data.incomes[selectedMonth]`

## Storia dei bug più insidiosi (per non ripeterli)

1. **Vercel/Vite build cache fantasma**: per un lungo periodo i push
   su GitHub arrivavano, il deploy risultava "Ready" in 5-10 secondi
   (troppo veloce per una vera build), ma il bundle JS servito era
   sempre lo stesso hash — il codice nuovo non veniva mai eseguito
   nonostante fosse su GitHub. Soluzione che ha funzionato: da
   `vercel.com → Deployments`, trovare il deployment giusto e cliccare
   **"Promote to Production"** manualmente (a volte il dominio
   principale restava agganciato a un deployment vecchio anche con
   commit nuovi pushati). Se càpita di nuovo: verificare SEMPRE che il
   bundle online contenga le stringhe attese
   (`fetch('/assets/index-XXX.js').then(r=>r.text()).then(t=>t.includes('stringa'))`)
   prima di dare per scontato che un fix sia live.

2. **Merge dati Supabase → localStorage**: quando un nuovo utente fa
   login la prima volta, `loadFromSupabase()` deve fare merge dei
   campi mancanti con `initialState` (altrimenti crash su
   `undefined.reduce`/`undefined[key]` in giro per tutto il codice).
   Il merge è in App.jsx dentro lo `useEffect` di caricamento iniziale
   — se si aggiungono NUOVI campi allo state, vanno SEMPRE aggiunti
   anche lì con un default sensato.

3. **`initialState` NON deve contenere dati storici hardcoded**: in
   una versione avevamo messo le spese/carryover storici di Marco
   direttamente nel codice sorgente come default per tutti — un nuovo
   utente (Enrico) si è ritrovato con i dati finanziari di Marco.
   `initialState` deve essere sempre vuoto/neutro; i dati storici di
   Marco vivono SOLO nella sua riga Supabase (`realHistory`,
   `carryover`, ecc.), mai nel codice.

4. **Autenticazione**: prima c'era una password unica hardcoded
   (`APP_PASSWORD`) nel codice sorgente. È stata sostituita con vero
   login email/password via Supabase Auth (endpoint
   `/auth/v1/token?grant_type=password`), sessione salvata in
   `sessionStorage` (`ff_token`, `ff_uid`). Ogni utente vede/scrive
   solo la propria riga in `ff_data` grazie a una RLS policy su
   `user_id = auth.uid()`.

## Cose ancora da verificare / possibili prossimi passi

- Verificare che dopo il fix del carryover ricorsivo, agosto 2026 (e i
  mesi successivi) mostrino un residuo coerente con la catena da
  maggio in poi
- Pulire eventuali spese "placeholder"/di esempio rimaste nei mesi
  storici che potrebbero ancora gonfiare artificialmente dei totali
- Valutare se aggiungere un pulsante che riporta automaticamente il
  `netBalance` di fine mese come `debitoIniziale` del mese successivo
  (oggi è un'operazione manuale — l'utente deve leggere il saldo netto
  e ridigitarlo nel mese dopo)
- Il repo locale di Marco ha avuto ripetuti problemi di token GitHub
  scaduto/PAT da rigenerare per il push via HTTPS — valutare SSH key o
  GitHub CLI (`gh auth login`) per un'autenticazione più stabile,
  oppure GitKraken (già installato) come alternativa grafica

## Workflow di deploy (finché si lavora da terminale)

```bash
cd ~/Downloads/famiglia-finance
# dopo aver aggiornato src/App.jsx
git add src/App.jsx
git commit -m "descrizione"
git push
# poi verificare su vercel.com che il deployment sia "Ready" E
# promosso a Production con l'hash commit corretto
```
