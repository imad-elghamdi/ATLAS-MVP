# ATLAS MVP (v1.0)

Repository runnable conforme au contrat de livraison ATLAS v1.0.

- **Ruleset actif** : `rulesets/atlas.v1.0.json` (version `v1.0`)
- **Taxonomie d’intention** : `informational / comparative / transactional / navigational / support`
- **Pré-check** : exécute **strictement G0–G3** (aucun scoring)
- **Score** : exécute **A–F + G4–G6** (aucun gate pré)

---

## Prérequis

- Node.js 20+
- Docker + Docker Compose (recommandé pour PostgreSQL)
- npm

---

## Démarrage local (rapide)

1) Copier l’environnement

```bash
cp .env.example .env
```

2) Lancer PostgreSQL

```bash
docker compose up -d
```

3) Installer les dépendances

```bash
npm install
```

4) Appliquer la migration unique

```bash
npm run build
npm run db:migrate
```

5) Démarrer l’API

```bash
npm run dev
# API: http://localhost:3000
```

Healthcheck :

```bash
curl http://localhost:3000/health
```

> Auth MVP : ajoute `Authorization: Bearer dev` (valeur configurable via `AUTH_DEV_TOKEN`).

---

## Structure du projet (où se trouve quoi)

### Base de données
- Migration unique : `migrations/001_atlas_v1.sql`
  - `pgcrypto` activé
  - trigger `updated_at` (content_registry)
  - unicité snapshot : `unique(site_id, url)`
  - FK : `atlas_events.draft_id → drafts(id)` (on delete set null)
  - indexes + index partiel `topic_key`

### Ruleset
- `rulesets/atlas.v1.0.json`
  - contient `high_pre`
  - aucune occurrence de `commercial`

### Gates & engine
- Gates + pipelines :
  - `src/atlas/gates.ts`
    - `precheck()` = **G0–G3 uniquement**
    - `computeAtlasScore()` = **A–F + G4–G6 uniquement**
- Topic key :
  - `src/atlas/topicKey.ts`

### Evaluators A–F
- `src/atlas/evaluators.ts`

### Registry / Snapshot (MVP)
- Registry stocké en DB : `content_registry`
- Snapshot pages : `site_pages`
- API ingestion :
  - `POST /v1/snapshot/pages/upsert`
  - `POST /v1/registry/upsert`
- Snapshot utilisé par l’engine = assemblage DB + `top_matches` fourni à la requête (MVP).

### API routes
- `src/routes.ts`

### Persistance & logs
- Persist score : table `atlas_scores` lors de `POST /v1/atlas/score`
- Logs append-only : table `atlas_events`
  - `SCORE_COMPUTED`
  - `DECISION_MADE`
- Endpoint append-only :
  - `POST /v1/atlas/events/append`
- Lecture :
  - `GET /v1/atlas/events?site_id=...&draft_id=...`

---

## Ordre recommandé pour comprendre le code

1. `rulesets/atlas.v1.0.json` (seuils/poids/similarity)
2. `src/atlas/types.ts` (taxonomie + structures flags/reasons)
3. `src/atlas/gates.ts` (séparation pré/post + décisions G4–G6 + G5 override)
4. `src/atlas/evaluators.ts` (A–F)
5. `src/routes.ts` (wiring API + persistance DB)
6. `migrations/001_atlas_v1.sql` (contrats DB)

---

## Lancer un PRECHECK (G0–G3)

### 1) Créer un site (utilitaire)
```bash
curl -X POST http://localhost:3000/v1/sites \
  -H "Authorization: Bearer dev" \
  -H "Content-Type: application/json" \
  -d '{"workspace_id":"00000000-0000-0000-0000-000000000001","cms_type":"wordpress","policies":{"publish_mode":"semi","high_stakes":false,"hard_cap":false,"cluster_caps":{}}}'
```

Note la valeur `id` retournée => `SITE_ID`.

### 2) Precheck
```bash
curl -X POST http://localhost:3000/v1/atlas/precheck \
  -H "Authorization: Bearer dev" \
  -H "Content-Type: application/json" \
  -d '{
    "site_id":"SITE_ID",
    "primary_intent":"informational",
    "primary_keyword":"guide van aménagé",
    "cluster_id":"vanlife-guides",
    "locale":"fr-FR",
    "top_matches":[
      {"page_id":"p1","url":"https://example.com/guide-van","sim_score":0.40,"overlap_intent_score":0.60}
    ]
  }'
```

---

## Lancer un SCORE (A–F + G4–G6)

```bash
curl -X POST http://localhost:3000/v1/atlas/score \
  -H "Authorization: Bearer dev" \
  -H "Content-Type: application/json" \
  -d '{
    "site_id":"SITE_ID",
    "title":"Guide van aménagé : étapes et erreurs à éviter",
    "content":"<article><h1>Guide van aménagé</h1><h2>Étapes</h2><p>...</p></article>",
    "primary_intent":"informational",
    "role":"unknown",
    "cluster_id":"vanlife-guides",
    "primary_keyword":"guide van aménagé",
    "locale":"fr-FR",
    "top_matches":[
      {"page_id":"p1","url":"https://example.com/guide-van","sim_score":0.30,"overlap_intent_score":0.50}
    ]
  }'
```

- Persiste un `draft`
- Persiste un `atlas_scores`
- Ajoute deux events :
  - `SCORE_COMPUTED`
  - `DECISION_MADE`

---

## Lire les logs `atlas_events`

```bash
curl "http://localhost:3000/v1/atlas/events?site_id=SITE_ID&limit=50" \
  -H "Authorization: Bearer dev"
```

---

## Ajouter un nouveau ruleset (ex: v1.1)

1) Créer `rulesets/atlas.v1.1.json` (nouvelle version)
2) Mettre `ACTIVE_RULESET=atlas.v1.1.json` dans `.env`
3) Redémarrer l’API

> Le champ `ruleset_version` est persisté dans `atlas_scores` + propagé dans `atlas_events`.

---

## Notes

- Ce repo est un MVP backend : la similarité `top_matches` est fournie à l’API (pas de vector DB dans ce scope).
- Les décisions sont **explicables** via `flags` + `reasons` et auditées via `atlas_events`.
