# Meridian Wind Desk

A UK wind-generation forecast review desk for January 2026. It puts the forecast
vintage available at a chosen day-ahead decision cutoff beside actual wind
generation and quantifies the error over matched intervals.

## Project structure

- `frontend/` — Next.js App Router dashboard, interactive delivery-day and
  cutoff selectors, forecast chart, accuracy table, and CSV export.
- `frontend/app/page.tsx` — Dashboard UI, Tailwind utility styling, and
  client-side API integration.
- `frontend/app/globals.css` — Tailwind CSS entry point.
- `backend/app/main.py` — FastAPI endpoints, Elexon retrieval, forecast-vintage
  selection, interval alignment, and accuracy calculations.
- `backend/tests/test_analysis.py` — Focused tests for forecast vintage
  selection and scoring.
- `backend/requirements.txt` — Python runtime dependencies.
- `render.yaml` — Render backend service blueprint.
- `frontend/vercel.json` — Vercel frontend build configuration.

## Run locally

Docker is intentionally not used.

### Backend

From the repository root, create and activate a Python virtual environment,
then install and run the API:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Visit
`http://localhost:8000/docs` for the interactive API documentation.

### Frontend

In a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. The local frontend defaults to the API at
`http://localhost:8000`; to use another API, set `NEXT_PUBLIC_API_URL` in
`frontend/.env.local` and restart Next.js:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Tests and checks

```powershell
cd backend
python -m unittest discover -s tests -v
cd ..\frontend
npm run lint
npm run build
```

## Deployment

### Render API

Create a Render **Blueprint** from this repository and select `render.yaml`, or
create a Python web service with:

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`
- Environment variable: `CORS_ORIGINS=https://<your-vercel-domain>`

The API's base URL is the Render service URL. The dashboard endpoint is
`/api/dashboard`.

### Vercel frontend

Import the repository into Vercel and set the project root directory to
`frontend`. Add this environment variable, using the deployed Render service
URL:

```dotenv
NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com
```

After deploying, replace `<your-vercel-domain>` in the Render `CORS_ORIGINS`
value with the production Vercel domain (and redeploy the backend). The Vercel
deployment URL: **not deployed yet**.

## Data and analysis

The backend fetches January 2026 actual national wind generation from Elexon
BMRS `FUELHH` (`fuelType=WIND`) and forecasts from `WINDFOR`. Elexon limits
requests to seven days, so the backend requests non-overlapping chunks and
caches the assembled source data for 15 minutes.

For each delivery half-hour and selected decision cutoff, the backend chooses
the latest `WINDFOR` issue published on the previous UTC day at or before the
cutoff that contains that delivery hour. Elexon `WINDFOR` values are hourly and
`FUELHH` values are half-hourly, so each eligible hourly forecast is aligned to
both half-hour periods it covers. MAE, RMSE, and signed bias are calculated
only for matched periods. Coverage distinguishes missing actuals, missing
eligible forecasts, partial records, and complete days.

The chart's shaded range uses the January P10–P90 distribution of
forecast-minus-actual errors for the selected cutoff, translated to an
illustrative actual-generation range. The overforecast summary reports the
90th percentile of `max(forecast - actual, 0)` across matched January
half-hours. Both are retrospective descriptive statistics for the displayed
sample, not calibrated probability guarantees or a forecast of future error.

This pilot covers wind generation only. It does not model demand, other
generation, wholesale prices, or a recommended procurement quantity. Times
and forecast cutoffs are UTC.

## AI tools

AI tools were used to assist with implementation and documentation.

## Challenge deliverables

The Vercel application URL and unlisted video demo have not been created yet.
Add both links here before submitting the challenge.
