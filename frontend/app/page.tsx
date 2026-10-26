"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Interval = {
  start_time: string;
  actual_mw: number | null;
  forecast_mw: number | null;
  forecast_publish_time: string | null;
  error_mw: number | null;
};

type CoverageStatus = "no_actuals" | "no_forecast" | "partial" | "complete";

type DailyResult = {
  date: string;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  interval_coverage: number;
  actual_intervals: number;
  forecast_intervals: number;
  expected_intervals: number;
  coverage_status: CoverageStatus;
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
  expected_intervals: number;
  coverage_status: CoverageStatus;
  actual_average_mw: number | null;
  forecast_average_mw: number | null;
  historical_error_p10_mw: number | null;
  historical_error_p90_mw: number | null;
  historical_overforecast_p90_mw: number | null;
  historical_error_intervals: number;
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

const ui = {
  "chart-empty": "grid min-h-[225px] place-items-center rounded-md px-4 text-center text-xs text-[#89938d]",
  "forecast-chart": "mt-3 block h-auto max-h-[300px] w-full overflow-visible",
  "chart-grid": "stroke-[#edf0ed] [stroke-width:1]",
  "chart-axis": "fill-[#87918c] font-sans [font-size:10px]",
  "chart-area": "fill-[#dfeae2] opacity-60",
  "chart-risk-band": "fill-[#a5d9ad] opacity-25",
  "chart-line": "fill-none stroke-linecap-round stroke-linejoin-round [stroke-width:2.15] [vector-effect:non-scaling-stroke]",
  "chart-line-forecast": "stroke-[#99a99e] [stroke-dasharray:4_4] [stroke-width:1.8]",
  "chart-line-actual": "stroke-[#256b53]",
  "chart-point": "fill-[#256b53] stroke-white [stroke-width:1]",
  "app-shell": "min-h-screen bg-[#f3f5f0] font-sans text-[#202b29]",
  sidebar: "fixed inset-y-0 left-0 z-20 flex w-[232px] flex-col border-r border-[#e2e7df] bg-white px-4 py-7 max-md:sticky max-md:inset-auto max-md:h-[58px] max-md:w-full max-md:flex-row max-md:items-center max-md:justify-between max-md:border-r-0 max-md:border-b max-md:px-[18px] max-md:py-0",
  brand: "mb-[47px] ml-[7px] flex w-fit items-center gap-2.5 text-[#202b29] no-underline max-md:m-0",
  "brand-mark": "flex h-[25px] w-[25px] rotate-[-8deg] items-end gap-[3px] rounded-[7px] bg-[#174a3a] p-1 shadow-sm",
  "brand-bar-one": "h-[7px] w-1 rounded-full bg-[#e8eee6]",
  "brand-bar-two": "h-[13px] w-1 rounded-full bg-[#a5d9ad]",
  "brand-bar-three": "h-[9px] w-1 rounded-full bg-[#e8eee6]",
  "brand-name": "text-xl font-bold tracking-[-1.05px] max-md:text-lg",
  "workspace-label": "mb-3 px-3 text-[10px] font-bold tracking-[0.105em] text-[#7f8985] max-md:hidden",
  "side-nav": "grid gap-1 max-md:flex max-md:gap-[3px]",
  "nav-link": "flex min-h-[42px] items-center gap-[11px] rounded-lg px-3 text-[13px] font-medium text-[#67736f] no-underline transition-colors hover:bg-[#f5f7f4] hover:text-[#202b29] max-md:min-h-9 max-md:w-[38px] max-md:justify-center max-md:px-0",
  "nav-link-active": "bg-[#edf4ef] font-semibold text-[#174a3a] hover:bg-[#e6f0e9] hover:text-[#174a3a]",
  "nav-label": "max-md:absolute max-md:h-px max-md:w-px max-md:overflow-hidden max-md:[clip:rect(0,0,0,0)]",
  "sidebar-bottom": "mt-auto max-md:hidden",
  "market-card": "flex items-start gap-2.5 rounded-lg border border-[#e2e7df] bg-white p-3",
  "market-dot": "mt-1 h-[7px] w-[7px] shrink-0 rounded-full bg-[#4b946e] shadow-[0_0_0_3px_#e9f3ec]",
  "market-copy": "grid gap-1",
  "market-name": "text-xs font-semibold",
  "market-subtitle": "text-[11px] text-[#74807c]",
  "sidebar-footnote": "px-3 pt-[18px] text-[9px] font-bold tracking-[0.105em] text-[#7f8985]",
  "main-column": "ml-[232px] min-h-screen max-md:ml-0",
  topbar: "flex h-[62px] items-center justify-between border-b border-[#e2e7df] bg-white/80 px-12 max-lg:px-[30px] max-md:h-12 max-md:px-5 max-[500px]:px-[15px]",
  breadcrumbs: "flex items-center gap-2.5 text-xs text-[#808a86] max-[500px]:text-[11px]",
  "crumb-slash": "text-[#c2c9c4]",
  "breadcrumb-current": "font-semibold text-[#34403c]",
  "topbar-meta": "flex items-center gap-[17px] max-[500px]:gap-[9px]",
  "period-pill": "inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.06em] text-[#56655e] max-[500px]:text-[9px]",
  "period-dot": "h-[6px] w-[6px] rounded-full bg-[#4b946e]",
  "topbar-divider": "h-[15px] w-px bg-[#e2e7df] max-[500px]:hidden",
  "timezone-label": "text-[11px] text-[#74807c] max-[500px]:hidden",
  content: "mx-auto w-full max-w-[1360px] px-12 pb-7 pt-[38px] max-lg:px-[30px] max-md:px-5 max-md:pb-6 max-md:pt-[27px] max-[500px]:px-[14px]",
  "page-heading": "relative isolate mb-6 flex min-h-[170px] items-center justify-between gap-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#123b30] via-[#1c5943] to-[#287354] px-7 py-6 text-white shadow-[0_14px_36px_-24px_rgba(23,74,58,0.75)] max-md:min-h-[150px] max-md:px-5 max-md:py-5 max-[500px]:gap-2 max-[500px]:px-4",
  "hero-glow": "pointer-events-none absolute -right-8 -top-24 -z-10 h-64 w-64 rounded-full bg-[#a9d591]/15 blur-3xl",
  "hero-grid": "pointer-events-none absolute inset-0 -z-10 opacity-[0.11] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(90deg,transparent,black)]",
  spotlight: "pointer-events-none absolute left-1/2 top-0 z-0 h-[145%] w-[120%] -translate-x-1/2 rounded-full opacity-0 blur-[80px] animate-spotlight motion-reduce:animate-none motion-reduce:opacity-20",
  "hero-copy": "relative z-10",
  eyebrow: "mb-2.5 text-[9px] font-bold tracking-[0.13em] text-[#b6dfbd]",
  "hero-title": "mb-2 text-[30px] font-semibold leading-[1.13] tracking-[-1.25px] max-[500px]:text-[23px]",
  "page-subtitle": "mb-0 max-w-[440px] text-[13px] leading-relaxed text-white/75 max-md:text-xs max-[500px]:max-w-[240px] max-[500px]:text-[11px]",
  "hero-art": "pointer-events-none absolute right-[205px] top-1/2 hidden -translate-y-1/2 text-white/[0.13] md:block",
  "hero-art-icon": "h-[148px] w-[148px]",
  button: "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-transparent px-[13px] text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  "button-secondary": "border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20",
  "export-button": "relative z-10 mt-0 shrink-0 max-md:min-h-[34px] max-md:px-2.5 max-[500px]:h-9 max-[500px]:w-9 max-[500px]:min-w-9 max-[500px]:overflow-hidden max-[500px]:p-0 max-[500px]:text-[0px]",
  "filter-row": "mb-[17px] flex min-h-[58px] items-center gap-[17px] rounded-lg border border-[#e2e7df] bg-white px-[15px] shadow-[0_3px_10px_-9px_rgba(32,43,41,.3)] max-lg:gap-3 max-md:flex-wrap max-md:gap-x-3.5 max-md:gap-y-2.5 max-md:px-3 max-md:py-[11px]",
  "filter-context": "flex items-center gap-2.5 whitespace-nowrap max-md:gap-[7px]",
  "filter-icon": "grid h-[29px] w-[29px] place-items-center rounded-md bg-[#edf4ef] text-[#256b53]",
  "filter-label": "text-[9px] font-bold tracking-[0.07em] text-[#7f8985] max-md:text-[8px]",
  select: "max-w-[145px] cursor-pointer border-0 bg-transparent py-1 pl-px pr-[19px] text-xs font-semibold text-[#2b3732] outline-none max-md:max-w-[122px] max-md:text-[11px]",
  "filter-divider": "h-[25px] w-px bg-[#e2e7df]",
  "decision-filter": "gap-2",
  "decision-select": "max-w-[110px] max-md:max-w-[89px]",
  "filter-note": "ml-auto border-l border-[#e2e7df] pl-3.5 text-[11px] text-[#86918b] max-lg:text-[10px] max-md:ml-0 max-md:w-full max-md:border-l-0 max-md:border-t max-md:pt-2 max-md:whitespace-normal",
  "error-banner": "mb-4 flex items-center justify-between gap-5 rounded-lg border border-[#ebd5ca] bg-[#fff9f5] px-[15px] py-[13px]",
  "error-copy": "grid gap-1",
  "error-title": "text-xs font-semibold text-[#884f35]",
  "error-message": "text-[11px] text-[#8a6a5d]",
  "error-button": "border-[#dfe5df] bg-white text-[#35413c] hover:bg-[#f8faf7]",
  "metrics-grid": "mb-[15px] grid grid-cols-4 gap-[13px] max-lg:grid-cols-2 max-md:gap-[9px]",
  "metric-card": "min-h-[119px] rounded-lg border border-[#e2e7df] bg-white px-4 py-[15px] shadow-[0_4px_14px_-12px_rgba(32,43,41,.32)] max-lg:min-h-[110px] max-[500px]:min-h-[107px] max-[500px]:px-[11px] max-[500px]:py-3",
  "metric-top": "flex items-center justify-between gap-2",
  "metric-label": "text-[9px] font-bold tracking-[0.065em] text-[#7f8985] max-[500px]:text-[8px] max-[500px]:leading-[1.3]",
  "metric-icon": "grid h-[27px] w-[27px] shrink-0 place-items-center rounded-md bg-[#f1f5f0] text-[#78857e] max-[500px]:h-[23px] max-[500px]:w-[23px]",
  "bias-mark": "text-[17px] font-medium",
  "metric-value": "mt-2 text-2xl font-semibold leading-none tracking-[-0.85px] tabular-nums text-[#26332e] max-[500px]:mt-[9px] max-[500px]:text-[21px]",
  "metric-foot": "mt-2 text-[10px] leading-[1.35] text-[#85908a] max-[500px]:text-[9px]",
  panel: "rounded-lg border border-[#e2e7df] bg-white shadow-[0_5px_18px_-14px_rgba(32,43,41,.28)]",
  "chart-panel": "mb-[14px] px-5 pb-3 pt-5 max-[500px]:px-3 max-[500px]:pb-2.5 max-[500px]:pt-[15px]",
  "panel-heading": "flex items-start justify-between",
  "chart-heading": "items-end px-0.5 max-[500px]:block",
  "section-kicker": "mb-[7px] text-[9px] font-bold tracking-[0.12em] text-[#7f8985]",
  "panel-title": "mb-[5px] text-base font-semibold tracking-[-0.35px] text-[#202b29]",
  "panel-description": "mb-0 text-[11px] text-[#84908a]",
  "chart-legend": "flex gap-[17px] pb-[3px] text-[10px] text-[#66726c] max-[500px]:pt-[13px]",
  "legend-item": "inline-flex items-center gap-[7px]",
  "legend-line": "relative inline-block h-0.5 w-[15px] bg-[#256b53]",
  "legend-actual-dot": "after:absolute after:left-[6px] after:top-[-2px] after:h-[5px] after:w-[5px] after:rounded-full after:bg-[#256b53] after:content-['']",
  "legend-forecast": "bg-[#8aa292] [background-image:linear-gradient(90deg,white_50%,transparent_50%)] [background-size:6px_1px] [background-repeat:repeat-x]",
  "legend-risk-band": "inline-block h-[9px] w-[14px] rounded-sm border border-[#9fc9a6] bg-[#a5d9ad]/40",
  "chart-skeleton": "mt-3 min-h-[225px] animate-pulse rounded-md bg-gradient-to-r from-[#f0f4ee] via-[#f9faf8] to-[#f0f4ee]",
  "chart-footer": "flex justify-between pl-[61px] pt-[3px] text-[9px] text-[#9aa39e] max-[500px]:pl-[38px] max-[500px]:text-[8px]",
  "detail-grid": "mb-[15px] grid grid-cols-[minmax(0,1.5fr)_minmax(230px,.9fr)] gap-[14px] max-md:grid-cols-1",
  "vintage-panel": "p-[17px_18px_15px] max-[500px]:p-[14px]",
  "compact-heading": "items-center",
  "compact-kicker": "mb-[6px]",
  "compact-title": "mb-0 text-base font-semibold tracking-[-0.35px] text-[#202b29]",
  "vintage-status": "inline-flex items-center gap-[7px] rounded border border-[#e4ede6] bg-[#f8fbf8] px-2 py-1.5 text-[8px] font-bold tracking-[0.07em] text-[#547360]",
  "vintage-status-dot": "h-[5px] w-[5px] rounded-full bg-[#4b946e]",
  "vintage-body": "grid grid-cols-[minmax(130px,.8fr)_minmax(0,1.5fr)] gap-[17px] pt-[17px] max-[500px]:grid-cols-[minmax(95px,.75fr)_minmax(0,1.25fr)] max-[500px]:gap-3",
  "vintage-date": "grid content-start gap-[7px] border-r border-[#e2e7df] pr-4 max-[500px]:pr-2.5",
  "muted-label": "text-[10px] text-[#818c86] max-[500px]:text-[9px]",
  "vintage-date-value": "text-xs font-semibold leading-[1.4] text-[#35413b] max-[500px]:text-[10px]",
  "vintage-stats": "grid grid-cols-2 gap-x-[15px] gap-y-3 max-[500px]:gap-x-2 max-[500px]:gap-y-[11px]",
  "vintage-stat": "grid gap-1",
  "vintage-stat-value": "text-[11px] font-semibold tabular-nums text-[#35413b] max-[500px]:text-[10px]",
  "vintage-note": "mt-[14px] border-t border-[#edf0ed] pt-3 text-[10px] leading-[1.45] text-[#89938e]",
  "reading-panel": "flex min-h-[160px] flex-col p-[17px_18px_15px] max-[500px]:p-[14px]",
  "reading-kicker": "mb-[6px]",
  "reading-title": "mb-2 text-base font-semibold tracking-[-0.35px] text-[#202b29]",
  "reading-copy": "mb-0 max-w-[380px] text-[11px] leading-[1.55] text-[#75817b]",
  "reading-rule": "mb-2.5 mt-auto h-px w-full bg-[#edf0ed]",
  "reading-caption": "text-[9px] text-[#909a94]",
  "accuracy-panel": "mb-8 scroll-mt-5",
  "accuracy-heading": "items-end px-[19px] pb-[15px] pt-[17px] max-[500px]:px-[13px] max-[500px]:pb-[13px] max-[500px]:pt-[15px]",
  "accuracy-title": "mb-[5px] text-base font-semibold tracking-[-0.35px] text-[#202b29]",
  "table-unit": "pb-0.5 text-[9px] font-bold tracking-[0.105em] text-[#7f8985]",
  "table-scroll": "overflow-x-auto border-t border-[#edf0ed]",
  table: "w-full border-collapse text-left",
  "table-head": "h-[34px] bg-[#fafbf9] px-4 text-[9px] font-semibold tracking-[0.045em] text-[#89938e] max-[500px]:px-2.5",
  "table-cell": "h-10 border-t border-[#f0f2ef] px-4 text-[11px] tabular-nums text-[#505d56] max-[500px]:px-2.5",
  "table-row": "transition-colors hover:bg-[#f5f9f5]",
  "table-row-selected": "bg-[#f5f9f5] [&>td:first-child]:shadow-[inset_2px_0_0_#256b53]",
  "day-link": "cursor-pointer border-0 bg-transparent py-[5px] text-[11px] font-semibold text-[#35433c] hover:text-[#256b53] hover:underline hover:underline-offset-[3px]",
  "bias-positive": "text-[#bd7046]",
  "coverage-cell": "inline-flex min-w-[70px] items-center gap-2",
  "coverage-track": "inline-block h-1 w-[34px] overflow-hidden rounded bg-[#e8ece8]",
  "coverage-fill": "block h-full rounded bg-[#5e9271]",
  "coverage-status": "text-[9px] text-[#84908a]",
  "risk-note": "mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#eadfc4] bg-[#fbf8ef] px-3.5 py-3",
  "risk-copy": "grid gap-1",
  "risk-title": "text-[9px] font-bold tracking-[0.08em] text-[#826b37]",
  "risk-detail": "text-[11px] leading-relaxed text-[#635b48]",
  "risk-sample": "shrink-0 text-[9px] text-[#857b64]",
  "row-action": "grid h-6 w-6 cursor-pointer place-items-center rounded border-0 bg-transparent text-[#84918a] hover:bg-[#e8f0e9] hover:text-[#256b53]",
  "loading-cell": "h-9 border-t border-[#f0f2ef] px-4 text-[10px] text-[#9aa39e]",
  "table-empty": "p-6 text-center text-xs text-[#7e8983]",
  "table-footer": "flex justify-between gap-3 border-t border-[#edf0ed] px-[18px] py-[11px] text-[9px] text-[#909a94] max-[500px]:px-[13px] max-[500px]:text-[8px]",
  "sources-section": "scroll-mt-5 pb-1 pt-2",
  "source-heading": "mb-[17px]",
  "source-title": "mb-0 text-base font-semibold tracking-[-0.35px] text-[#202b29]",
  "source-grid": "grid grid-cols-3 overflow-hidden rounded-lg border border-[#e2e7df] bg-white max-[500px]:grid-cols-1",
  "source-item": "flex min-h-[136px] gap-3 p-4 max-[500px]:min-h-0 max-[500px]:p-[14px]",
  "source-item-divider": "border-l border-[#e2e7df] max-[500px]:border-l-0 max-[500px]:border-t",
  "source-number": "font-serif text-[13px] italic text-[#9baa9e]",
  "source-copy": "min-w-0",
  "source-title-small": "mb-[7px] text-xs font-semibold text-[#202b29]",
  "source-description": "mb-[7px] min-h-[35px] text-[10px] leading-[1.5] text-[#7c8781] max-[500px]:min-h-0",
  "source-link": "text-[10px] font-semibold text-[#256b53] no-underline hover:underline hover:underline-offset-[3px]",
  "method-note": "text-[10px] font-semibold text-[#77867d]",
  "source-disclaimer": "pt-[11px] text-[10px] leading-[1.5] text-[#87918b] max-[500px]:text-[9px]",
  "page-footer": "mt-[27px] flex justify-between border-t border-[#e2e7df] pt-[22px] text-[9px] text-[#8c9690] max-[500px]:items-start max-[500px]:gap-[15px] max-[500px]:text-[8px]",
  "footer-brand": "inline-flex items-center gap-[7px] text-[8px] font-bold tracking-[0.08em] text-[#69756e]",
  "footer-dot": "h-[3px] w-[3px] rounded-full bg-[#9ea9a1]",
} as const;

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

function coverageStatusLabel(status: CoverageStatus) {
  switch (status) {
    case "no_actuals":
      return "No actual data";
    case "no_forecast":
      return "No eligible forecast";
    case "partial":
      return "Partial coverage";
    case "complete":
      return "Complete";
  }
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

function Spotlight({ fill = "#b7f4c8" }: { fill?: string }) {
  return (
    <div
      aria-hidden="true"
      className={ui.spotlight}
      style={{
        background: `radial-gradient(ellipse at center, ${fill} 0%, transparent 68%)`,
      }}
    />
  );
}

function ForecastChart({
  intervals,
  errorP10,
  errorP90,
}: {
  intervals: Interval[];
  errorP10: number | null;
  errorP90: number | null;
}) {
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
    const bandPath =
      errorP10 === null || errorP90 === null
        ? null
        : [
            ...valid.map((point, index) => {
              const command = index === 0 ? "M" : "L";
              return `${command}${x(index).toFixed(1)},${y(Math.max(0, point.forecast_mw! - errorP10)).toFixed(1)}`;
            }),
            ...valid
              .slice()
              .reverse()
              .map((point, index) => {
                const forecast = point.forecast_mw!;
                const lowerValue = Math.max(0, forecast - errorP90);
                const reverseIndex = valid.length - index - 1;
                return `L${x(reverseIndex).toFixed(1)},${y(lowerValue).toFixed(1)}`;
              }),
            "Z",
          ].join(" ");

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
      bandPath,
    };
  }, [errorP10, errorP90, intervals]);

  if (!chart) {
    return (
      <div className={ui["chart-empty"]}>
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
      className={ui["forecast-chart"]}
      viewBox={`0 0 ${chart.width} ${chart.height}`}
      role="img"
      aria-label="Actual, day-ahead forecast, and historical forecast-error range in megawatts"
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
              className={ui["chart-grid"]}
            />
            <text x={chart.left - 12} y={y + 4} textAnchor="end" className={ui["chart-axis"]}>
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
            className={ui["chart-axis"]}
          >
            {tick.label}
          </text>
        );
      })}
      {chart.bandPath && (
        <path d={chart.bandPath} className={ui["chart-risk-band"]} />
      )}
      <path
        d={chart.forecastPath}
        className={`${ui["chart-line"]} ${ui["chart-line-forecast"]}`}
      />
      <path
        d={chart.actualPath}
        className={`${ui["chart-line"]} ${ui["chart-line-actual"]}`}
      />
      {chart.valid.map((point, index) => (
        <circle
          key={point.start_time}
          cx={chart.x(index)}
          cy={chart.y(point.actual_mw!)}
          r="2.1"
          className={ui["chart-point"]}
        >
          <title>
            {new Intl.DateTimeFormat("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            }).format(new Date(point.start_time))}: actual{" "}
            {formatMw(point.actual_mw)}; forecast {formatMw(point.forecast_mw)};
            eligible issue {formatShortDate(point.forecast_publish_time)}
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
      [
        "start_time_utc",
        "actual_wind_mw",
        "forecast_wind_mw",
        "forecast_publish_time_utc",
        "error_mw",
      ],
      ...dashboard.intervals.map((row) => [
        row.start_time,
        row.actual_mw ?? "",
        row.forecast_mw ?? "",
        row.forecast_publish_time ?? "",
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
  const actualCount = dashboard?.actual_intervals ?? 0;
  const totalIntervals = dashboard?.expected_intervals ?? 48;

  return (
    <main className={ui["app-shell"]}>
      <aside className={ui.sidebar}>
        <a className={ui.brand} href="#overview" aria-label="Meridian wind desk home">
          <span className={ui["brand-mark"]} aria-hidden="true">
            <span className={ui["brand-bar-one"]} />
            <span className={ui["brand-bar-two"]} />
            <span className={ui["brand-bar-three"]} />
          </span>
          <span className={ui["brand-name"]}>meridian</span>
        </a>
        <div className={ui["workspace-label"]}>TRADING DESK</div>
        <nav className={ui["side-nav"]} aria-label="Main navigation">
          <a href="#overview" className={`${ui["nav-link"]} ${ui["nav-link-active"]}`}>
            <Icon name="grid" />
            <span className={ui["nav-label"]}>Overview</span>
          </a>
          <a href="#accuracy" className={ui["nav-link"]}>
            <Icon name="chart" />
            <span className={ui["nav-label"]}>Forecast review</span>
          </a>
          <a href="#sources" className={ui["nav-link"]}>
            <Icon name="database" />
            <span className={ui["nav-label"]}>Data &amp; method</span>
          </a>
        </nav>
        <div className={ui["sidebar-bottom"]}>
          <div className={ui["market-card"]}>
            <span className={ui["market-dot"]} />
            <div className={ui["market-copy"]}>
              <strong className={ui["market-name"]}>Great Britain</strong>
              <span className={ui["market-subtitle"]}>Day-ahead market</span>
            </div>
          </div>
          <div className={ui["sidebar-footnote"]}>WIND GENERATION · UK</div>
        </div>
      </aside>

      <section className={ui["main-column"]}>
        <header className={ui.topbar}>
          <div className={ui.breadcrumbs}>
            <span>Markets</span>
            <span className={ui["crumb-slash"]}>/</span>
            <strong className={ui["breadcrumb-current"]}>Wind desk</strong>
          </div>
          <div className={ui["topbar-meta"]}>
            <span className={ui["period-pill"]}><span className={ui["period-dot"]} /> JANUARY 2026</span>
            <span className={ui["topbar-divider"]} />
            <span className={ui["timezone-label"]}>All times UTC</span>
          </div>
        </header>

        <div className={ui.content} id="overview">
          <div className={ui["page-heading"]}>
            <Spotlight />
            <div className={ui["hero-glow"]} />
            <div className={ui["hero-grid"]} />
            <div className={ui["hero-copy"]}>
              <div className={ui.eyebrow}>POWER PROCUREMENT · UK DAY-AHEAD</div>
              <h1 className={ui["hero-title"]}>Wind forecast desk</h1>
              <p className={ui["page-subtitle"]}>
                Review the latest available wind outlook against delivered generation.
              </p>
            </div>
            <div className={ui["hero-art"]} aria-hidden="true">
              <Icon name="wind" size={148} />
            </div>
            <button
              className={`${ui.button} ${ui["button-secondary"]} ${ui["export-button"]}`}
              type="button"
              onClick={exportCsv}
              disabled={!dashboard || loading}
            >
              <Icon name="download" size={16} />
              <span className="hidden min-[501px]:inline">Export day</span>
            </button>
          </div>

          <div className={ui["filter-row"]}>
            <div className={ui["filter-context"]}>
              <span className={ui["filter-icon"]}><Icon name="wind" size={17} /></span>
              <span className={ui["filter-label"]}>DELIVERY DAY</span>
              <select
                className={ui.select}
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
            <span className={ui["filter-divider"]} />
            <label className={`${ui["filter-context"]} ${ui["decision-filter"]}`}>
              <span className={ui["filter-label"]}>DECISION CUTOFF</span>
              <select
                className={`${ui.select} ${ui["decision-select"]}`}
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
            <div className={ui["filter-note"]}>
              Forecasts published by {decisionTime} UTC on the previous day
            </div>
          </div>

          {error && (
            <div className={ui["error-banner"]} role="alert">
              <div className={ui["error-copy"]}>
                <strong className={ui["error-title"]}>Live data could not be loaded.</strong>
                <span className={ui["error-message"]}>{error} Check the backend is running and NEXT_PUBLIC_API_URL is set.</span>
              </div>
              <button
                className={`${ui.button} ${ui["error-button"]}`}
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

          <section className={ui["metrics-grid"]} aria-label="Selected day forecast accuracy">
            <article className={ui["metric-card"]}>
              <div className={ui["metric-top"]}>
                <span className={ui["metric-label"]}>MEAN ABSOLUTE ERROR</span>
                <span className={ui["metric-icon"]}><Icon name="chart" size={16} /></span>
              </div>
              <div className={ui["metric-value"]}>{loading ? "—" : formatMw(dashboard?.mae_mw ?? null)}</div>
              <div className={ui["metric-foot"]}>Average miss per half-hour</div>
            </article>
            <article className={ui["metric-card"]}>
              <div className={ui["metric-top"]}>
                <span className={ui["metric-label"]}>ROOT MEAN SQUARED ERROR</span>
                <span className={ui["metric-icon"]}><Icon name="wind" size={16} /></span>
              </div>
              <div className={ui["metric-value"]}>{loading ? "—" : formatMw(dashboard?.rmse_mw ?? null)}</div>
              <div className={ui["metric-foot"]}>Places more weight on larger misses</div>
            </article>
            <article className={ui["metric-card"]}>
              <div className={ui["metric-top"]}>
                <span className={ui["metric-label"]}>FORECAST BIAS</span>
                <span className={ui["metric-icon"]}><span className={ui["bias-mark"]}>±</span></span>
              </div>
              <div className={ui["metric-value"]}>{loading ? "—" : formatMw(dashboard?.bias_mw ?? null)}</div>
              <div className={ui["metric-foot"]}>Forecast minus actual · + means high</div>
            </article>
            <article className={ui["metric-card"]}>
              <div className={ui["metric-top"]}>
                <span className={ui["metric-label"]}>INTERVAL COVERAGE</span>
                <span className={ui["metric-icon"]}><Icon name="database" size={16} /></span>
              </div>
              <div className={ui["metric-value"]}>
                {loading || !dashboard ? "—" : `${Math.round(dashboard.interval_coverage * 100)}%`}
              </div>
              <div className={ui["metric-foot"]}>
                {loading
                  ? "Checking actual and forecast data"
                  : dashboard
                    ? `${coverageStatusLabel(dashboard.coverage_status)} · ${forecastCount}/${totalIntervals} matched, ${actualCount} actuals`
                    : "Coverage unavailable"}
              </div>
            </article>
          </section>

          <section className={`${ui.panel} ${ui["chart-panel"]}`} aria-labelledby="generation-title">
            <div className={`${ui["panel-heading"]} ${ui["chart-heading"]}`}>
              <div>
                <div className={ui["section-kicker"]}>DELIVERY PROFILE</div>
                <h2 id="generation-title" className={ui["panel-title"]}>{formatDay(selectedDate)}</h2>
                <p className={ui["panel-description"]}>National wind generation · half-hourly actuals and matched forecast</p>
              </div>
              <div className={ui["chart-legend"]} aria-label="Chart legend">
                <span className={ui["legend-item"]}><i className={`${ui["legend-line"]} ${ui["legend-actual-dot"]}`} />Actual</span>
                <span className={ui["legend-item"]}><i className={`${ui["legend-line"]} ${ui["legend-forecast"]}`} />Day-ahead forecast</span>
                <span className={ui["legend-item"]}><i className={ui["legend-risk-band"]} />January historical 10–90% range</span>
              </div>
            </div>
            {loading ? (
              <div className={ui["chart-skeleton"]} aria-label="Loading chart" />
            ) : dashboard ? (
              <ForecastChart
                intervals={dashboard.intervals}
                errorP10={dashboard.historical_error_p10_mw}
                errorP90={dashboard.historical_error_p90_mw}
              />
            ) : (
              <div className={ui["chart-empty"]}>Connect to the API to view the delivery profile.</div>
            )}
            <div className={ui["chart-footer"]}>
              <span>Generation (MW)</span>
              <span>Delivery time, 00:00–24:00 UTC</span>
            </div>
            <div className={ui["risk-note"]}>
              <div className={ui["risk-copy"]}>
                <span className={ui["risk-title"]}>JANUARY HISTORICAL OVERFORECAST EXPOSURE · P90</span>
                <span className={ui["risk-detail"]}>
                  {dashboard?.historical_overforecast_p90_mw === null ||
                  dashboard?.historical_overforecast_p90_mw === undefined
                    ? "Not enough matched records to estimate historical overforecast error."
                    : `Across the matched January sample, forecast overstatement was at or below ${formatMw(dashboard.historical_overforecast_p90_mw)} at the 90th percentile.`}
                </span>
                <span className={ui["risk-sample"]}>
                  Shaded band translates January signed-error P10–P90 to an illustrative actual-generation range. Historical sample only; not a probability guarantee.
                </span>
              </div>
              <span className={ui["risk-sample"]}>
                n = {dashboard?.historical_error_intervals ?? 0} matched half-hours
              </span>
            </div>
          </section>

          <div className={ui["detail-grid"]}>
            <section className={`${ui.panel} ${ui["vintage-panel"]}`} aria-labelledby="vintage-title">
              <div className={`${ui["panel-heading"]} ${ui["compact-heading"]}`}>
                <div>
                  <div className={`${ui["section-kicker"]} ${ui["compact-kicker"]}`}>FORECAST VINTAGE</div>
                  <h2 id="vintage-title" className={ui["compact-title"]}>What was known</h2>
                </div>
                <span className={ui["vintage-status"]}><span className={ui["vintage-status-dot"]} /> AS-OF VIEW</span>
              </div>
              <div className={ui["vintage-body"]}>
                <div className={ui["vintage-date"]}>
                  <span className={ui["muted-label"]}>Latest selected issue</span>
                  <strong className={ui["vintage-date-value"]}>{loading ? "Loading…" : formatShortDate(dashboard?.forecast_publish_time ?? null)}</strong>
                </div>
                <div className={ui["vintage-stats"]}>
                  <div className={ui["vintage-stat"]}>
                    <span className={ui["muted-label"]}>Lead time</span>
                    <strong className={ui["vintage-stat-value"]}>
                      {dashboard?.forecast_lead_hours === null || dashboard?.forecast_lead_hours === undefined
                        ? "—"
                        : `${Math.floor(dashboard.forecast_lead_hours)}h ${Math.round((dashboard.forecast_lead_hours % 1) * 60)}m`}
                    </strong>
                  </div>
                  <div className={ui["vintage-stat"]}>
                    <span className={ui["muted-label"]}>Matched intervals</span>
                    <strong className={ui["vintage-stat-value"]}>{loading ? "—" : `${forecastCount} / ${totalIntervals}`}</strong>
                  </div>
                  <div className={ui["vintage-stat"]}>
                    <span className={ui["muted-label"]}>Actual mean</span>
                    <strong className={ui["vintage-stat-value"]}>{loading ? "—" : formatMw(dashboard?.actual_average_mw ?? null)}</strong>
                  </div>
                  <div className={ui["vintage-stat"]}>
                    <span className={ui["muted-label"]}>Forecast mean</span>
                    <strong className={ui["vintage-stat-value"]}>{loading ? "—" : formatMw(dashboard?.forecast_average_mw ?? null)}</strong>
                  </div>
                </div>
              </div>
              <div className={ui["vintage-note"]}>
                Each delivery half-hour uses its own latest eligible hourly forecast issue published by {decisionTime} UTC on the previous day.
              </div>
            </section>

            <section className={`${ui.panel} ${ui["reading-panel"]}`} aria-label="Reading the forecast">
              <div className={`${ui["section-kicker"]} ${ui["reading-kicker"]}`}>AT A GLANCE</div>
              <h2 className={ui["reading-title"]}>Reading the numbers</h2>
              <p className={ui["reading-copy"]}>
                A positive bias means the forecast expected more wind than was delivered;
                a negative bias means it expected less.
              </p>
              <div className={ui["reading-rule"]} />
              <span className={ui["reading-caption"]}>All errors compare matched half-hour values in MW.</span>
            </section>
          </div>

          <section className={`${ui.panel} ${ui["accuracy-panel"]}`} id="accuracy" aria-labelledby="accuracy-title">
            <div className={`${ui["panel-heading"]} ${ui["accuracy-heading"]}`}>
              <div>
                <div className={ui["section-kicker"]}>MONTHLY REVIEW</div>
                <h2 id="accuracy-title" className={ui["accuracy-title"]}>January forecast accuracy</h2>
                <p className={ui["panel-description"]}>Day-ahead forecast quality by delivery day · cutoff {decisionTime} UTC</p>
              </div>
              <span className={ui["table-unit"]}>ERROR · MW</span>
            </div>
            <div className={ui["table-scroll"]}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th className={ui["table-head"]} scope="col">Delivery day</th>
                    <th className={ui["table-head"]} scope="col">MAE</th>
                    <th className={ui["table-head"]} scope="col">RMSE</th>
                    <th className={ui["table-head"]} scope="col">Bias</th>
                    <th className={ui["table-head"]} scope="col">Coverage status</th>
                    <th className={ui["table-head"]} scope="col" aria-label="Open delivery day" />
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }, (_, index) => (
                        <tr key={index}>
                          <td className={ui["loading-cell"]} colSpan={6}>Loading Elexon records…</td>
                        </tr>
                      ))
                    : dashboard?.daily.map((day) => (
                        <tr
                          key={day.date}
                          className={`${ui["table-row"]} ${day.date === selectedDate ? ui["table-row-selected"] : ""}`}
                        >
                          <td className={ui["table-cell"]}>
                            <button
                              className={ui["day-link"]}
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
                          <td className={ui["table-cell"]}>{formatMw(day.mae_mw)}</td>
                          <td className={ui["table-cell"]}>{formatMw(day.rmse_mw)}</td>
                          <td className={`${ui["table-cell"]} ${day.bias_mw !== null && day.bias_mw > 0 ? ui["bias-positive"] : ""}`}>
                            {formatMw(day.bias_mw)}
                          </td>
                          <td className={ui["table-cell"]}>
                            <span
                              className={ui["coverage-cell"]}
                              title={`${coverageStatusLabel(day.coverage_status)}: ${day.forecast_intervals} of ${day.expected_intervals} intervals matched; ${day.actual_intervals} actuals available`}
                            >
                              <span className={ui["coverage-track"]}>
                                <span className={ui["coverage-fill"]} style={{ width: `${Math.round(day.interval_coverage * 100)}%` }} />
                              </span>
                              {Math.round(day.interval_coverage * 100)}%
                              <span className={ui["coverage-status"]}>{coverageStatusLabel(day.coverage_status)}</span>
                            </span>
                          </td>
                          <td className={ui["table-cell"]}>
                            <button
                              className={ui["row-action"]}
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
                <div className={ui["table-empty"]}>No delivery-day records were returned for January.</div>
              )}
            </div>
            <div className={ui["table-footer"]}>
              <span>{dashboard?.daily.length ?? 31} delivery days</span>
              <span>Only complete source records are scored; coverage is shown per day.</span>
            </div>
          </section>

          <section className={ui["sources-section"]} id="sources">
            <div className={ui["source-heading"]}>
              <div className={ui["section-kicker"]}>DATA &amp; METHOD</div>
              <h2 className={ui["source-title"]}>One source. A clear comparison.</h2>
            </div>
            <div className={ui["source-grid"]}>
              <article className={ui["source-item"]}>
                <span className={ui["source-number"]}>01</span>
                <div className={ui["source-copy"]}>
                  <h3 className={ui["source-title-small"]}>Wind actuals</h3>
                  <p className={ui["source-description"]}>National generation from Elexon BMRS FUELHH, filtered to WIND.</p>
                  <a className={ui["source-link"]} href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer">
                    FUELHH dataset <span>-&gt;</span>
                  </a>
                </div>
              </article>
              <article className={`${ui["source-item"]} ${ui["source-item-divider"]}`}>
                <span className={ui["source-number"]}>02</span>
                <div className={ui["source-copy"]}>
                  <h3 className={ui["source-title-small"]}>Forecast vintages</h3>
                  <p className={ui["source-description"]}>WINDFOR records published by the selected cutoff on the previous day.</p>
                  <a className={ui["source-link"]} href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer">
                    WINDFOR dataset <span>-&gt;</span>
                  </a>
                </div>
              </article>
              <article className={`${ui["source-item"]} ${ui["source-item-divider"]}`}>
                <span className={ui["source-number"]}>03</span>
                <div className={ui["source-copy"]}>
                  <h3 className={ui["source-title-small"]}>Comparable intervals</h3>
                  <p className={ui["source-description"]}>Hourly forecast values are aligned to the two half-hourly actual periods they cover.</p>
                  <span className={ui["method-note"]}>MAE · RMSE · signed bias</span>
                </div>
              </article>
            </div>
            <div className={ui["source-disclaimer"]}>
              This view covers wind generation only. It does not include demand, other generation,
              prices, or a recommended procurement volume.
            </div>
          </section>

          <footer className={ui["page-footer"]}>
            <span className={ui["footer-brand"]}>MERIDIAN <i className={ui["footer-dot"]} /> UK WIND DESK</span>
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
