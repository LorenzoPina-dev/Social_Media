# INDEX — Documentazione Social Media Microservices Platform

**Versione:** 2.0 — File ottimizzati, indipendenti e basati sul codice reale  
**Aggiornato:** Febbraio 2025

---

## FILE DI RIFERIMENTO (usare questi — non i vecchi)

| File | Scopo | Quando usarlo |
|------|-------|--------------|
| **PROJECT_ARCHITECTURE.md** | Architettura completa del sistema: servizi, stack, pattern, infrastruttura | Prima di qualsiasi sviluppo. Risponde a "come è strutturato il sistema?" |
| **DATABASE_SCHEMA.md** | Tutte le tabelle PostgreSQL, strutture Redis, topic Kafka, indici Elasticsearch | Prima di scrivere migrations o query. Risponde a "quali campi ha questa tabella?" |
| **PROJECT_STATUS.md** | Stato reale file-per-file di ogni servizio al momento del rilevamento | Per sapere cosa è già fatto e cosa manca. Aggiornare dopo ogni fase completata. |
| **TEST_STRATEGY.md** | Struttura dettagliata di tutti i test: unit, integration, e2e, load | Prima di scrivere qualsiasi test. Contiene descrizione di ogni `it()` da implementare. |
| **IMPLEMENTATION_ROADMAP.md** | Ordine di implementazione, dipendenze, checklist per ogni servizio | Per sapere in quale ordine lavorare e quali file creare. |
| **API_CONTRACT.md** | Tutti gli endpoint con request/response/errori per ogni servizio | Per implementare controller/routes o per scrivere test integration. |

---

## FILE DEPRECATI (NON USARE — contenuto superato o ridondante)

I seguenti file erano la documentazione precedente. Contengono informazioni parzialmente errate
rispetto allo stato reale del codice. Sono stati sostituiti dai 6 file sopra:

- `CODE_STRUCTURE.md` → Sostituito da `PROJECT_ARCHITECTURE.md`
- `COMPLETE_IMPLEMENTATION_GUIDE.md` → Sostituito da `IMPLEMENTATION_ROADMAP.md`
- `DELIVERABLES_SUMMARY.md` → Sostituito da `PROJECT_STATUS.md`
- `FINAL_DELIVERY.md` → Sostituito da `PROJECT_STATUS.md`
- `FINAL_DELIVERY_REPORT.md` → Sostituito da `PROJECT_STATUS.md`
- `FINAL_SUMMARY.md` → Sostituito da `PROJECT_STATUS.md`
- `IMPLEMENTATION_COMPLETE_SUMMARY.md` → Sostituito da `PROJECT_STATUS.md`
- `IMPLEMENTATION_STATUS_REPORT.md` → Sostituito da `PROJECT_STATUS.md`
- `PROJECT_DELIVERY.md` → Sostituito da `PROJECT_ARCHITECTURE.md`
- `QUICK_START.md` → Sostituito da `IMPLEMENTATION_ROADMAP.md`
- `SETUP_GUIDE.md` → Sostituito da `IMPLEMENTATION_ROADMAP.md`
- `START-HERE.md` → Questo file

---

## QUICK START

```bash
# 1. Avvia infrastruttura
docker-compose up -d

# 2. Installa dipendenze
npm install

# 3. Esegui migration auth-service
cd auth-service && npx knex migrate:latest --knexfile knexfile.ts

# 4. Avvia auth-service in dev
npm run dev:auth

# 5. Test auth-service
cd auth-service && npm test
```

---

## NAVIGAZIONE PER TASK

| Task | File da leggere |
|------|----------------|
| Capire l'architettura | `PROJECT_ARCHITECTURE.md` |
| Scrivere una migration | `DATABASE_SCHEMA.md` → sezione del servizio |
| Capire cosa è già implementato | `PROJECT_STATUS.md` |
| Implementare un nuovo servizio | `IMPLEMENTATION_ROADMAP.md` → fase corrispondente |
| Scrivere i test | `TEST_STRATEGY.md` → sezione del servizio |
| Implementare un endpoint | `API_CONTRACT.md` → sezione del servizio |
| Aggiungere un evento Kafka | `DATABASE_SCHEMA.md` → Parte 3 (Kafka Topics) |
| Configurare Redis | `DATABASE_SCHEMA.md` → Parte 2 (Redis) |
