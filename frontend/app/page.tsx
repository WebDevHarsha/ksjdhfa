"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Interval = {
  start_time: string;
  actual_mw: number | null;
  forecast_mw: number | null;
  error_mw: number | null;
};

type DailyResult = {
  date: string;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  interval_coverage: number;
  actual_intervals: number;
  forecast_intervals: number;
  forecast_publish_time: string | null;
};

type Dashboard = {
  month: string;
  date: string;
  decision_time: string;
  forecast_publish_time: string | null;
  forecast_lead_hours: number | null;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  interval_coverage: number;
  actual_intervals: number;
  forecast_intervals: number;
  actual_average_mw: number | null;
  forecast_average_mw: number | null;
  daily: DailyResult[];
  intervals: Interval[];
  source: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
const DECISION_TIMES = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
];

function formatMw(value: number | null, digits = 0) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })} MW`;
}

function formatShortDate(value: string | null) {
  if (!value) return "No issue found";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  const weekdays = [
    "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
  ];

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  return `${weekdays[date.getUTCDay()]} ${day} ${months[month - 1]}`;
}

function makeMonthDays() {
  return Array.from({ length: 31 }, (_, index) =>
    `2026-01-${String(index + 1).padStart(2, "0")}`,
  );
}

function Icon({
  name,
  size = 18,
}: {
  name: "grid" | "chart" | "database" | "download" | "arrow" | "wind" | "refresh";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h17" />
          <path d="m7 15 4-5 3 2 5-7" />
        </svg>
      );
    case "database":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v12m-5-5 5 5 5-5M4 20h16" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      );
    case "wind":
      return (
        <svg {...common}>
          <path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 16h7a3 3 0 1 1-3 3" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M5.5 9a7 7 0 0 1 12-2L20 12M4 12l2.5 5a7 7 0 0 0 12-2" />
        </svg>
      );
  }
}

function ForecastChart({ intervals }: { intervals: Interval[] }) {
  const chart = useMemo(() => {
    const valid = intervals.filter(
      (point) => point.actual_mw !== null && point.forecast_mw !== null,
    );
    if (!valid.length) return null;

    const width = 920;
    const height = 260;
    const left = 62;
    const right = 18;
    const top = 14;
    const bottom = 34;
    const innerWidth = width - left - right;
    const innerHeight = height - top - bottom;
    const peak = Math.max(
      ...valid.flatMap((point) => [point.actual_mw!, point.forecast_mw!]),
    );
    const ceiling = Math.max(5_000, Math.ceil(peak / 5_000) * 5_000);
    const x = (index: number) =>
      left + (valid.length > 1 ? (index / (valid.length - 1)) * innerWidth : 0);
    const y = (value: number) => top + (1 - value / ceiling) * innerHeight;
    const path = (key: "actual_mw" | "forecast_mw") =>
      valid
        .map((point, index) => {
          const command = index === 0 ? "M" : "L";
          return `${command}${x(index).toFixed(1)},${y(point[key]!).toFixed(1)}`;
        })
        .join(" ");

    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      innerHeight,
      innerWidth,
      ceiling,
      valid,
      x,
      y,
      actualPath: path("actual_mw"),
      forecastPath: path("forecast_mw"),
    };
  }, [intervals]);

  if (!chart) {
    return (
      <div className="chart-empty">
        There are no matched actual and forecast intervals for this delivery day.
      </div>
    );
  }

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((fraction) =>
    Math.round((chart.ceiling * fraction) / 1_000),
  );
  const hourTicks = [
    { label: "00:00", fraction: 0 },
    { label: "06:00", fraction: 0.25 },
    { label: "12:00", fraction: 0.5 },
    { label: "18:00", fraction: 0.75 },
    { label: "24:00", fraction: 1 },
  ];

  return (
    <svg
      className="forecast-chart"
      viewBox={`0 0 ${chart.width} ${chart.height}`}
      role="img"
      aria-label="Actual and day-ahead forecast wind generation in megawatts"
    >
      {gridValues.map((value, index) => {
        const y =
          chart.top + (index / (gridValues.length - 1)) * chart.innerHeight;
        return (
          <g key={value}>
            <line
              x1={chart.left}
              x2={chart.width - chart.right}
              y1={y}
              y2={y}
              className="chart-grid"
            />
            <text x={chart.left - 12} y={y + 4} textAnchor="end" className="chart-axis">
              {value === 0 ? "0" : `${value}k`}
            </text>
          </g>
        );
      })}
      {hourTicks.map((tick) => {
        const x = chart.left + tick.fraction * chart.innerWidth;
        return (
          <text
            key={tick.label}
            x={x}
            y={chart.height - 7}
            textAnchor={tick.fraction === 0 ? "start" : tick.fraction === 1 ? "end" : "middle"}
            className="chart-axis"
          >
            {tick.label}
          </text>
        );
      })}
      <path
        d={`${chart.forecastPath} L${chart.width - chart.right},${chart.height - chart.bottom} L${chart.left},${chart.height - chart.bottom} Z`}
        className="chart-area"
      />
      <path d={chart.forecastPath} className="chart-line chart-line-forecast" />
      <path d={chart.actualPath} className="chart-line chart-line-actual" />
      {chart.valid.map((point, index) => (
        <circle
          key={point.start_time}
          cx={chart.x(index)}
          cy={chart.y(point.actual_mw!)}
          r="2.1"
          className="chart-point"
        >
          <title>
            {new Intl.DateTimeFormat("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            }).format(new Date(point.start_time))}: actual{" "}
            {formatMw(point.actual_mw)}; forecast {formatMw(point.forecast_mw)}
          </title>
        </circle>
      ))}
    </svg>
  );
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState("2026-01-15");
  const [decisionTime, setDecisionTime] = useState("11:00");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const days = useMemo(() => makeMonthDays(), []);

  const loadDashboard = useCallback(async (signal?: AbortSignal) => {
    const query = new URLSearchParams({
      date: selectedDate,
      decision_time: decisionTime,
    });
    const response = await fetch(`${API_BASE}/api/dashboard?${query}`, {
      signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail ?? `Dashboard request failed (${response.status}).`);
    }
    return (await response.json()) as Dashboard;
  }, [decisionTime, selectedDate]);

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboard(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setDashboard(data);
        setError(null);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load wind data. Please try again.",
        );
        setDashboard(null);
        setLoading(false);
      });
    return () => controller.abort();
  }, [loadDashboard, reloadKey]);

  function exportCsv() {
    if (!dashboard) return;
    const rows = [
      ["start_time_utc", "actual_wind_mw", "forecast_wind_mw", "error_mw"],
      ...dashboard.intervals.map((row) => [
        row.start_time,
        row.actual_mw ?? "",
        row.forecast_mw ?? "",
        row.error_mw ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `wind-review-${dashboard.date}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const currentDay = dashboard?.daily.find((day) => day.date === selectedDate);
  const forecastCount = dashboard?.forecast_intervals ?? 0;
  const totalIntervals = dashboard?.actual_intervals ?? 48;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Meridian wind desk home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="brand-name">meridian</span>
        </a>
        <div className="workspace-label">TRADING DESK</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a href="#overview" className="nav-link active">
            <Icon name="grid" />
            <span>Overview</span>
          </a>
          <a href="#accuracy" className="nav-link">
            <Icon name="chart" />
            <span>Forecast review</span>
          </a>
          <a href="#sources" className="nav-link">
            <Icon name="database" />
            <span>Data &amp; method</span>
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="market-card">
            <span className="market-dot" />
            <div>
              <strong>Great Britain</strong>
              <span>Day-ahead market</span>
            </div>
          </div>
          <div className="sidebar-footnote">WIND GENERATION · UK</div>
        </div>
      </aside>

      <section className="main-column">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Markets</span>
            <span className="crumb-slash">/</span>
            <strong>Wind desk</strong>
          </div>
          <div className="topbar-meta">
            <span className="period-pill"><span /> JANUARY 2026</span>
            <span className="topbar-divider" />
            <span className="timezone-label">All times UTC</span>
          </div>
        </header>

        <div className="content" id="overview">
          <div className="page-heading">
            <div>
              <div className="eyebrow">POWER PROCUREMENT · UK DAY-AHEAD</div>
              <h1>Wind forecast desk</h1>
              <p className="page-subtitle">
                Review the latest available wind outlook against delivered generation.
              </p>
            </div>
            <button
              className="button button-secondary export-button"
              type="button"
              onClick={exportCsv}
              disabled={!dashboard || loading}
            >
              <Icon name="download" size={16} />
              Export day
            </button>
          </div>

          <div className="filter-row">
            <div className="filter-context">
              <span className="filter-icon"><Icon name="wind" size={17} /></span>
              <span className="filter-label">DELIVERY DAY</span>
              <select
                aria-label="Select delivery day"
                value={selectedDate}
                onChange={(event) => {
                  setLoading(true);
                  setError(null);
                  setSelectedDate(event.target.value);
                }}
              >
                {days.map((day) => (
                  <option key={day} value={day}>{formatDay(day)}</option>
                ))}
              </select>
            </div>
            <span className="filter-divider" />
            <label className="filter-context decision-filter">
              <span className="filter-label">DECISION CUTOFF</span>
              <select
                aria-label="Select decision cutoff time"
                value={decisionTime}
                onChange={(event) => {
                  setLoading(true);
                  setError(null);
                  setDecisionTime(event.target.value);
                }}
              >
                {DECISION_TIMES.map((time) => (
                  <option key={time} value={time}>{time} UTC</option>
                ))}
              </select>
            </label>
            <div className="filter-note">
              Forecasts published by {decisionTime} UTC on the previous day
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <div>
                <strong>Live data could not be loaded.</strong>
                <span>{error} Check the backend is running and NEXT_PUBLIC_API_URL is set.</span>
              </div>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setReloadKey((key) => key + 1);
                }}
              >
                <Icon name="refresh" size={15} />
                Retry
              </button>
            </div>
          )}

          <section className="metrics-grid" aria-label="Selected day forecast accuracy">
            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-label">MEAN ABSOLUTE ERROR</span>
                <span className="metric-icon"><Icon name="chart" size={16} /></span>
              </div>
              <div className="metric-value">{loading ? "—" : formatMw(dashboard?.mae_mw ?? null)}</div>
              <div className="metric-foot">Average miss per half-hour</div>
            </article>
            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-label">ROOT MEAN SQUARED ERROR</span>
                <span className="metric-icon"><Icon name="wind" size={16} /></span>
              </div>
              <div className="metric-value">{loading ? "—" : formatMw(dashboard?.rmse_mw ?? null)}</div>
              <div className="metric-foot">Places more weight on larger misses</div>
            </article>
            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-label">FORECAST BIAS</span>
                <span className="metric-icon"><span className="bias-mark">±</span></span>
              </div>
              <div className="metric-value">{loading ? "—" : formatMw(dashboard?.bias_mw ?? null)}</div>
              <div className="metric-foot">Forecast minus actual · + means high</div>
            </article>
            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-label">INTERVAL COVERAGE</span>
                <span className="metric-icon"><Icon name="database" size={16} /></span>
              </div>
              <div className="metric-value">
                {loading || !dashboard ? "—" : `${Math.round(dashboard.interval_coverage * 100)}%`}
              </div>
              <div className="metric-foot">
                {loading ? "Loading source data" : `${forecastCount} of ${totalIntervals} half-hours matched`}
              </div>
            </article>
          </section>

          <section className="panel chart-panel" aria-labelledby="generation-title">
            <div className="panel-heading chart-heading">
              <div>
                <div className="section-kicker">DELIVERY PROFILE</div>
                <h2 id="generation-title">{formatDay(selectedDate)}</h2>
                <p>National wind generation · half-hourly actuals and matched forecast</p>
              </div>
              <div className="chart-legend" aria-label="Chart legend">
                <span><i className="legend-line legend-actual" />Actual</span>
                <span><i className="legend-line legend-forecast" />Day-ahead forecast</span>
              </div>
            </div>
            {loading ? (
              <div className="chart-skeleton" aria-label="Loading chart" />
            ) : dashboard ? (
              <ForecastChart intervals={dashboard.intervals} />
            ) : (
              <div className="chart-empty">Connect to the API to view the delivery profile.</div>
            )}
            <div className="chart-footer">
              <span>Generation (MW)</span>
              <span>Delivery time, 00:00–24:00 UTC</span>
            </div>
          </section>

          <div className="detail-grid">
            <section className="panel vintage-panel" aria-labelledby="vintage-title">
              <div className="panel-heading compact-heading">
                <div>
                  <div className="section-kicker">FORECAST VINTAGE</div>
                  <h2 id="vintage-title">What was known</h2>
                </div>
                <span className="vintage-status"><span /> AS-OF VIEW</span>
              </div>
              <div className="vintage-body">
                <div className="vintage-date">
                  <span>Latest issue before cutoff</span>
                  <strong>{loading ? "Loading…" : formatShortDate(dashboard?.forecast_publish_time ?? null)}</strong>
                </div>
                <div className="vintage-stats">
                  <div>
                    <span>Lead time</span>
                    <strong>
                      {dashboard?.forecast_lead_hours === null || dashboard?.forecast_lead_hours === undefined
                        ? "—"
                        : `${Math.floor(dashboard.forecast_lead_hours)}h ${Math.round((dashboard.forecast_lead_hours % 1) * 60)}m`}
                    </strong>
                  </div>
                  <div>
                    <span>Matched intervals</span>
                    <strong>{loading ? "—" : `${forecastCount} / ${totalIntervals}`}</strong>
                  </div>
                  <div>
                    <span>Actual mean</span>
                    <strong>{loading ? "—" : formatMw(dashboard?.actual_average_mw ?? null)}</strong>
                  </div>
                  <div>
                    <span>Forecast mean</span>
                    <strong>{loading ? "—" : formatMw(dashboard?.forecast_average_mw ?? null)}</strong>
                  </div>
                </div>
              </div>
              <div className="vintage-note">
                The selected vintage is the latest issue available at the chosen previous-day cutoff.
              </div>
            </section>

            <section className="panel reading-panel" aria-label="Reading the forecast">
              <div className="section-kicker">AT A GLANCE</div>
              <h2>Reading the numbers</h2>
              <p>
                A positive bias means the forecast expected more wind than was delivered;
                a negative bias means it expected less.
              </p>
              <div className="reading-rule" />
              <span className="reading-caption">All errors compare matched half-hour values in MW.</span>
            </section>
          </div>

          <section className="panel accuracy-panel" id="accuracy" aria-labelledby="accuracy-title">
            <div className="panel-heading accuracy-heading">
              <div>
                <div className="section-kicker">MONTHLY REVIEW</div>
                <h2 id="accuracy-title">January forecast accuracy</h2>
                <p>Day-ahead forecast quality by delivery day · cutoff {decisionTime} UTC</p>
              </div>
              <span className="table-unit">ERROR · MW</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Delivery day</th>
                    <th scope="col">MAE</th>
                    <th scope="col">RMSE</th>
                    <th scope="col">Bias</th>
                    <th scope="col">Coverage</th>
                    <th scope="col" aria-label="Open delivery day" />
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }, (_, index) => (
                        <tr key={index} className="loading-row">
                          <td colSpan={6}>Loading Elexon records…</td>
                        </tr>
                      ))
                    : dashboard?.daily.map((day) => (
                        <tr
                          key={day.date}
                          className={day.date === selectedDate ? "selected-row" : ""}
                        >
                          <td>
                            <button
                              className="day-link"
                              type="button"
                              onClick={() => {
                                setLoading(true);
                                setError(null);
                                setSelectedDate(day.date);
                              }}
                            >
                              {formatDay(day.date)}
                            </button>
                          </td>
                          <td>{formatMw(day.mae_mw)}</td>
                          <td>{formatMw(day.rmse_mw)}</td>
                          <td className={day.bias_mw !== null && day.bias_mw > 0 ? "bias-positive" : ""}>
                            {formatMw(day.bias_mw)}
                          </td>
                          <td>
                            <span className="coverage-cell">
                              <span className="coverage-track">
                                <span style={{ width: `${Math.round(day.interval_coverage * 100)}%` }} />
                              </span>
                              {Math.round(day.interval_coverage * 100)}%
                            </span>
                          </td>
                          <td>
                            <button
                              className="row-action"
                              type="button"
                              aria-label={`View ${formatDay(day.date)}`}
                              onClick={() => {
                                setLoading(true);
                                setError(null);
                                setSelectedDate(day.date);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                            >
                              <Icon name="arrow" size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
              {!loading && dashboard && dashboard.daily.length === 0 && (
                <div className="table-empty">No delivery-day records were returned for January.</div>
              )}
            </div>
            <div className="table-footer">
              <span>{dashboard?.daily.length ?? 31} delivery days</span>
              <span>Only complete source records are scored; coverage is shown per day.</span>
            </div>
          </section>

          <section className="sources-section" id="sources">
            <div className="source-heading">
              <div className="section-kicker">DATA &amp; METHOD</div>
              <h2>One source. A clear comparison.</h2>
            </div>
            <div className="source-grid">
              <article className="source-item">
                <span className="source-number">01</span>
                <div>
                  <h3>Wind actuals</h3>
                  <p>National generation from Elexon BMRS FUELHH, filtered to WIND.</p>
                  <a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer">
                    FUELHH dataset <span>↗</span>
                  </a>
                </div>
              </article>
              <article className="source-item">
                <span className="source-number">02</span>
                <div>
                  <h3>Forecast vintages</h3>
                  <p>WINDFOR records published by the selected cutoff on the previous day.</p>
                  <a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer">
                    WINDFOR dataset <span>↗</span>
                  </a>
                </div>
              </article>
              <article className="source-item">
                <span className="source-number">03</span>
                <div>
                  <h3>Comparable intervals</h3>
                  <p>Hourly forecast values are aligned to the two half-hourly actual periods they cover.</p>
                  <span className="method-note">MAE · RMSE · signed bias</span>
                </div>
              </article>
            </div>
            <div className="source-disclaimer">
              This view covers wind generation only. It does not include demand, other generation,
              prices, or a recommended procurement volume.
            </div>
          </section>

          <footer className="page-footer">
            <span>MERIDIAN <i /> UK WIND DESK</span>
            <span>
              {currentDay?.forecast_publish_time
                ? `Forecast issue ${formatShortDate(currentDay.forecast_publish_time)} UTC`
                : "Elexon BMRS data"}
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}
