# TDIS-ML Knowledge Base (for agents and new developers)

Read this folder before changing anything in the repo. It was written from a full read of the repo on 2026-10-12.

| File | Read it when |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | You need the big picture: what each folder is, how they connect, data flow |
| [FEATURES.md](FEATURES.md) | You need to know what the portal and the ML pipeline already do |
| [FRONTEND.md](FRONTEND.md) | You are touching `tdis-portal-frontend` (tabs, services, config, tests) |
| [ML_AND_IGNITION_API.md](ML_AND_IGNITION_API.md) | You are touching the models, scoring job, ignition API or its DB tables |
| [SETUP_AND_GITIGNORE.md](SETUP_AND_GITIGNORE.md) | You are setting up a fresh clone, or wondering why something is missing |
| [ADDING_A_FEATURE.md](ADDING_A_FEATURE.md) | You are about to add a new feature (recipes and checklists) |

## One-paragraph summary

The repo has two systems. (1) The **TDIS Portal**: `tdis-portal-frontend` (React map UI), `tdis-portal-backend`
(tiny Express email server) and `tdis-portal-db` (PostgreSQL migrations). (2) The **wildfire ignition ML system**:
`TDIS_Ignition_BIT` (model v1), `TDIS_Ignition_BIT_V2` (model v2, the deployed one) and `tdis-ignition-api`
(FastAPI + scoring job). They meet in three places: migration 042 in the portal DB, the `WildfireIgnitionTab` in the
frontend, and the `VITE_IGNITION_API_URL` setting.

## Ground rules learned so far

- The portal's main data API (events, hazards, flood, outages) is **not in this repo**. The frontend calls it through `VITE_API_URL`.
- `tdis-portal-backend` only handles `/api/emails/*` and `/health`. Do not expect data routes there.
- Secrets and `.env` files are gitignored and absent on a fresh clone.
- The large training datasets are gitignored, so models cannot be retrained from the repo alone.
- Follow the style of the surrounding code. The frontend mixes 2-space and 4-space indentation by file; match the file you edit.

## Keeping this folder current

When you add a feature, update FEATURES.md and, if architecture changed, ARCHITECTURE.md. Mark anything you did not verify
as "unverified" rather than guessing.

## Verification status of these docs

Read in full: root and portal `.gitignore` files, all four READMEs, `app.js`, `main.py`, `ignitionService.js`, `App.jsx`,
`featureFlags.js`, `.env.example`, `WILDFIRE_IGNITION_SCHEMA.md`, first 90 lines of `BIT_V2_TRAINING_REPORT.md`.
Only listed (names, sizes), not read: most frontend components/hooks/services, `score_job.py`, `db.py`, `ignition_core.py`,
the 45 migrations, all tests, and the Azure pipeline files. Statements about those are inferred from file names.
