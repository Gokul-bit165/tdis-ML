# event-detection-frontend

## Prerequisites

- Node.js (version 20 or higher — required by Vitest 4)
- npm package manager
- Mapbox access token

## Environment Variables

The following environment variables are required to run the project:

1. `VITE_MAPBOX_TOKEN`
   - Purpose: Mapbox public access token for map rendering and services

2. `VITE_CUBE_API_BASE_URL`
   - Purpose: Base URL for the Cube.js backend API

3. `VITE_CUBEJS_TOKEN`
   - Purpose: Authentication token for Cube.js

4. `VITE_GOOGLE_ANALYTICS_TRACKING_ID`
   - Purpose: Google Analytics token

5. `VITE_TDIS_API_KEY`
   - Purpose: App Intake API key

6. `VITE_TDIS_HELPDESK_API_URL`
   - Purpose: Base URL for the helpdesk

7. `VITE_API_URL` (and related portal keys — see [.env.example](.env.example))
   - Purpose: Base URL for the TDIS Portal FastAPI (events, LTS, hazards, Flood Hub, etc.). Include `/api/v1` when the backend mounts routes under that prefix.

8. `VITE_EMAIL_API_URL` _(optional locally)_
   - Purpose: Base URL **only** for the Contact Us and email-subscribe mutations in `src/services/api.js`.
   - If unset, those mutations reuse `VITE_API_URL`.

9. `VITE_DAMAGE_API_URL` _(optional locally)_
   - Purpose: Base URL for the TDIS Damage Assessment API (`tdis-damage-api`). Defaults to `http://localhost:8002`.

10. `VITE_ENABLE_DAMAGE_ASSESSMENT` _(optional)_
   - Purpose: Build-time flag to show the Damage Assessment tab. Unset: shown in `npm run dev` only. Set `true` to enable or `false` to disable.

## Notes — Portal vs email API (CI)

These are reminders for onboarding and deployments; authoritative wiring lives in [`azure-pipelines.yml`](azure-pipelines.yml).

| Build env var        | Azure pipeline source (from Key Vault) | Key Vault secret name (typical) |
| -------------------- | -------------------------------------- | ------------------------------- |
| `VITE_API_URL`       | `$(portal_api_new_url)`                | `tdis-portal-api-new-url`       |
| `VITE_EMAIL_API_URL` | `$(portal_api_url)`                    | `tdis-portal-api-url`           |
| `VITE_RAMP_API_ROOT` | `$(ramp_api_root)`                     | `tdis-dev-ramp-api-root`        |

- **Portal API** (`VITE_API_URL`): used across the app (e.g. `portalApiConfig`, power outage, LTS, Flood Hub). **`VITE_EVENTS_API_KEY`** is paired with this “new portal” deployment (`portal_api_new_key` / Key Vault `tdis-portal-api-new-key`).
- **Email/contact base** (`VITE_EMAIL_API_URL`): RTK Query `fetchBaseQuery` base for **`POST /api/emails/send-email`** and **`POST /api/emails/subscribe-user-request`** only. The **`/api/emails/...`** path segment is intentional for the host behind `tdis-portal-api-url`.
- **RAMP API** (`VITE_RAMP_API_ROOT`): Critical facilities GeoJSON (schools / hospitals / fire stations) on Live Weather. Optional `VITE_RAMP_POI_COUNTY` (e.g. `201`) filters by county FIPS.
- Locally, you normally set **`VITE_API_URL`** only; add **`VITE_EMAIL_API_URL`** if the contact endpoints live on a different host than the main portal API. Add **`VITE_RAMP_API_ROOT`** to load critical facilities locally.

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/TexasDIS/event-detection-frontend.git
cd event-detection-frontend
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Add your environment variables to the `.env` file
   - Make sure all required variables are set before starting the application

4. Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Tech Stack

- React 19
- Vite
- Mapbox GL JS
- Tailwind CSS
- Radix UI Components
- Framer Motion (for animations)
- React Router (for routing)
- ESLint for code quality

## Project Structure

```
event-detection-frontend/
├── src/           # Source files
├── public/        # Static assets
├── dist/          # Production build
├── .env          # Environment variables
└── vite.config.js # Vite configuration
```
