# Meridian Wind Desk

Meridian is a day-ahead wind-generation forecast review dashboard for a UK
electricity trading desk. It is built for the January 2026 scope in the REint
Full Stack SWE challenge.

## Challenge deliverables

- **Deployed frontend:** [https://ksjdhfa.vercel.app](https://ksjdhfa.vercel.app)
- **Backend API:** deploy the Render service from `render.yaml`, then add its
  public URL here.
- **Demo video:** add the unlisted YouTube link here before submission. The
  challenge asks for a video of no more than 10 minutes, with a customer-facing
  product overview and a technical handover.
- **Source repository:** [WebDevHarsha/ksjdhfa](https://github.com/WebDevHarsha/ksjdhfa).
  Confirm the repository is public before submitting.

## What the application does

- Shows Elexon national wind-generation actuals and eligible day-ahead
  forecasts for a selected January 2026 delivery day.
- Lets the user choose a previous-day UTC decision cutoff.
- Reports MAE, RMSE, signed forecast bias, and actual/forecast interval
  coverage.
- Distinguishes missing actuals, missing eligible forecasts, partial coverage,
  and complete coverage.
- Compares forecast and actual generation in a half-hourly chart, with a
  historical January forecast-error range and overforecast summary.
- Provides a daily accuracy table and exports the selected day's intervals to
  CSV.

This is a wind-only decision-support view. It does not include demand,
generation from other sources, wholesale prices, or a recommended procurement
quantity.

## Data and analysis

The backend retrieves:

- Actual wind generation from Elexon's [FUELHH dataset](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream), filtered to `fuelType=WIND`.
- Forecasts from Elexon's [WINDFOR dataset](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream).

For each delivery half-hour, the backend selects the latest forecast issue
published by the chosen cutoff on the previous UTC day that contains that
delivery hour. Since WINDFOR is hourly and FUELHH is half-hourly, each hourly
forecast is aligned to the two half-hours it covers. Metrics use only matched
actual/forecast intervals; missing values are not treated as zero.

The chart's P10–P90 error range and P90 overforecast statistic are calculated
from matched January forecast-minus-actual errors for the selected cutoff.
They are retrospective descriptive statistics for the observed sample, not
calibrated probability guarantees or a forecast of future error. Times and
cutoffs are UTC.

Elexon limits dataset requests to seven days. The backend fetches January data
in date chunks and caches the assembled records in memory for 15 minutes.

## Project structure

- `frontend/` — Next.js App Router application, configured for Vercel.
- `frontend/app/page.tsx` — Dashboard UI, Tailwind styling, chart, filters,
  coverage indicators, and CSV export.
- `frontend/app/globals.css` — Tailwind CSS import and Spotlight animation.
- `frontend/app/layout.tsx` — App metadata and root layout.
- `frontend/app/icon.svg` — Meridian browser-tab icon.
- `frontend/vercel.json` — Vercel build configuration.
- `backend/app/main.py` — FastAPI API, Elexon data retrieval, forecast
  eligibility, interval matching, and error calculations.
- `backend/tests/test_analysis.py` — Tests for cutoff eligibility, hourly to
  half-hourly alignment, coverage states, and error metrics.
- `backend/requirements.txt` — Python backend dependencies.
- `render.yaml` — Render web service blueprint and production CORS origin.

## Frameworks and tools

### Frontend

- **Next.js 16** with the **App Router**, built on **React 19**.
- **TypeScript** for the application code.
- **Tailwind CSS 4** for utility-first styling.
- **CSS animations** for the Spotlight effect in the hero. The effect is
  Aceternity UI-inspired, implemented with CSS in this project; the
  `aceternity-ui` package is not installed.
- **ESLint** with the Next.js configuration for linting.

### Backend

- **Python** and **FastAPI** for the HTTP API.
- **HTTPX** for asynchronous requests to Elexon's public API.
- **Uvicorn** as the ASGI development and production server.
- **Python `unittest`** for backend tests.

### Deployment and data

- **Vercel** hosts the Next.js frontend.
- **Render** hosts the FastAPI backend.
- **Elexon BMRS API** provides the wind actual and forecast datasets.
- **Git and GitHub** are used for version control and source hosting.

## Run locally

Docker is optional. The manual setup below works without it.

### With Docker Compose

From the repository root, start both development services:

```powershell
docker compose up --build
```

Open `http://localhost:3000`; the API is available at `http://localhost:8000`.
Stop the services with `Ctrl+C`, then run `docker compose down`.

This Compose setup is for local development only. It does not change the
Vercel or Render deployment configuration.

### Backend

From the repository root, create and activate a virtual environment, then
install dependencies and start the API:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`; interactive documentation is
at `http://localhost:8000/docs`.

### Frontend

In a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. Locally, the frontend defaults to the backend at
`http://localhost:8000`. To use a different API URL, create
`frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Restart the frontend after changing the environment variable.

## Tests

```powershell
cd backend
python -m unittest discover -s tests -v
cd ..\frontend
npm run lint
npm run build
```

## Deployment

### Vercel frontend

The frontend is deployed at [https://ksjdhfa.vercel.app](https://ksjdhfa.vercel.app).
In Vercel project settings, set the environment variable `NEXT_PUBLIC_API_URL`
to the Render backend's public base URL (for example,
`https://your-service.onrender.com`, with no trailing slash), then redeploy the
frontend.

### Render backend

Create a Render Blueprint from this repository and use `render.yaml`. The
blueprint configures the backend root directory, Python build command, Uvicorn
start command, `/health` health check, and CORS for `https://ksjdhfa.vercel.app`.
After deployment, verify that `<render-service-url>/health` returns a healthy
status and put the actual Render service URL above and in Vercel's
`NEXT_PUBLIC_API_URL`.

No API key is required for the Elexon public dataset endpoints. `NEXT_PUBLIC_API_URL`
is an API base URL, not a secret.

## AI tools

- GitHub Copilot
- v0
- ChatGPT
- Claude
