import { useState, useEffect, useRef, useMemo } from "react";
import {
  BarChart, Bar, ComposedChart, Area, Line,
  XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell, ReferenceLine,
  CartesianGrid
} from "recharts";

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

const fmt = (v) => `$${Math.abs(v).toLocaleString()}`;
const fmtPct = (v) => v === null ? "—" : `${v.toFixed(1)}%`;
const fmtDur = (m) => m === null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`;

const Sparkline = ({ data, color = "#3b82f6", w = 48, h = 18 }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / range) * h} r="2" fill={color} />
    </svg>
  );
};

// Sparkline variant for dark backgrounds
const SparklineLight = ({ data, w = 44, h = 16 }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 opacity-40">
      <polyline points={pts} fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / range) * h} r="2" fill="white" />
    </svg>
  );
};

const MarginBadge = ({ value }) => {
  const c = value >= 30 ? "bg-green-50 text-green-600" : value >= 15 ? "bg-amber-50 text-amber-700" : value >= 0 ? "bg-red-50 text-red-600" : "bg-red-100 text-red-800";
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${c}`}>{fmtPct(value)}</span>;
};

const ConsistencyBadge = ({ rating, size = "sm" }) => {
  const cfg = { high: { l: "⚡ High Consistency", bg: "bg-green-50 text-green-600 ring-green-200/50" }, medium: { l: "◐ Moderate", bg: "bg-amber-50 text-amber-700 ring-amber-200/50" }, low: { l: "◯ Variable", bg: "bg-red-50 text-red-600 ring-red-200/50" } };
  const c = cfg[rating] || cfg.medium;
  const sz = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return <span className={`inline-flex items-center gap-1.5 rounded-lg font-semibold ring-1 ${sz} ${c.bg}`}>{c.l}</span>;
};

const ComparisonPill = ({ value, unit = "", format = null, invert = false }) => {
  const pos = value > 0;
  const good = invert ? !pos : pos;
  let disp = format === "currency" ? `${pos ? "+" : ""}${fmt(value)}` : `${pos ? "+" : ""}${Math.round(value)}${unit ? ` ${unit}` : ""}`;
  if (Math.abs(value) < 0.5) return <span className="text-xs text-slate-400">{disp}</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${good ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
      <svg className={`w-2.5 h-2.5 ${good ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
      {disp}
    </span>
  );
};

const InfoTip = ({ text }) => (
  <div className="group relative inline-flex">
    <svg className="w-3.5 h-3.5 text-slate-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal z-50 min-w-[180px] max-w-xs text-center shadow-lg normal-case tracking-normal font-normal">{text}</div>
  </div>
);

const ChevronRight = () => <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>;
const ChevronDown = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>;
const ChevronUp = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>;

const PhasePill = ({ label, minutes, color }) => {
  if (minutes === null) return null;
  const colors = { blue: "bg-blue-50 text-blue-700 ring-blue-200/60", green: "bg-green-50 text-green-600 ring-green-200/60", amber: "bg-amber-50 text-amber-700 ring-amber-200/60", violet: "bg-violet-50 text-violet-700 ring-violet-200/60" };
  const dots = { blue: "bg-blue-500", green: "bg-green-500", amber: "bg-amber-500", violet: "bg-violet-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ring-1 ${colors[color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[color]}`} />{label} {minutes}m
    </span>
  );
};

const Breadcrumb = ({ items }) => (
  <nav className="flex items-center gap-1.5 text-sm mb-5">
    {items.map((item, i) => (
      <span key={i} className="flex items-center gap-1.5">
        {i > 0 && <ChevronRight />}
        {item.onClick ? (
          <button onClick={item.onClick} className="text-slate-500 hover:text-blue-600 font-medium transition-colors">{item.label}</button>
        ) : (
          <span className="text-slate-900 font-medium">{item.label}</span>
        )}
      </span>
    ))}
  </nav>
);

// ═══════════════════════════════════════════════════
// SURGEON DATA — Dr. Berra (richest data set)
// ═══════════════════════════════════════════════════

const surgeon = {
  id: "s1", name: "Dr. Berra", caseCount: 9,
  totalProfit: 22340, medianProfit: 3200, avgProfit: 2482,
  profitPerORHour: 2628, avgMarginPercent: 26.3,
  durationVsFacilityMinutes: -2, profitImpact: 50,
  procedureCount: 3,
  efficiency: { medianDuration: 85, consistencyRating: "high", avgSurgicalTime: 62 },
  costBreakdown: { avgReimbursement: 8500, avgDebits: 4200, avgCredits: 0, avgORCost: 1818, avgProfit: 2482 },
  // Sparkline trends (6 months)
  trends: {
    profit: [14200, 16800, 18400, 19200, 21100, 22340],
    profitPerCase: [2050, 2200, 2350, 2400, 2600, 2482],
    perHr: [1900, 2100, 2200, 2350, 2500, 2628],
    margin: [21.4, 22.8, 24.1, 25.0, 26.8, 26.3],
    caseCount: [7, 8, 8, 8, 9, 9],
    duration: [90, 88, 87, 86, 85, 85],
  },
};

// Monthly volume + profit trend
const monthlyTrend = [
  { month: "Sep", cases: 7, profit: 14200, avgProfit: 2029, margin: 21.4 },
  { month: "Oct", cases: 8, profit: 16800, avgProfit: 2100, margin: 22.8 },
  { month: "Nov", cases: 8, profit: 18400, avgProfit: 2300, margin: 24.1 },
  { month: "Dec", cases: 8, profit: 19200, avgProfit: 2400, margin: 25.0 },
  { month: "Jan", cases: 9, profit: 21100, avgProfit: 2344, margin: 26.8 },
  { month: "Feb*", cases: 9, profit: 22340, avgProfit: 2482, margin: 26.3 },
];

// Per-case profit distribution
const profitBins = [
  { range: "$1-1.5k", count: 1, label: "$1–1.5k" },
  { range: "$1.5-2k", count: 2, label: "$1.5–2k" },
  { range: "$2-2.5k", count: 1, label: "$2–2.5k" },
  { range: "$2.5-3k", count: 1, label: "$2.5–3k" },
  { range: "$3-3.5k", count: 1, label: "$3–3.5k" },
  { range: "$3.5-4k", count: 1, label: "$3.5–4k" },
  { range: "$4-4.5k", count: 1, label: "$4–4.5k" },
  { range: "$4.5-5k", count: 0, label: "$4.5–5k" },
  { range: "$5-5.5k", count: 1, label: "$5–5.5k" },
];

// Payer mix
const payerMix = [
  { payer: "BlueCross", cases: 4, avgReimbursement: 10200, avgProfit: 3800, margin: 37.3, color: "#3b82f6" },
  { payer: "Aetna", cases: 2, avgReimbursement: 9800, avgProfit: 2900, margin: 29.6, color: "#8b5cf6" },
  { payer: "Medicare", cases: 2, avgReimbursement: 8200, avgProfit: 1400, margin: 17.1, color: "#ef4444" },
  { payer: "Cigna", cases: 1, avgReimbursement: 8800, avgProfit: 1800, margin: 20.5, color: "#f59e0b" },
];

// Procedure breakdown for the "By Procedure" stub
const procedureBreakdown = [
  { id: "p1", name: "Mako THA", caseCount: 3, totalProfit: 12800, medianDuration: 80, facilityMedian: 85 },
  { id: "p2", name: "THA", caseCount: 4, totalProfit: 5400, medianDuration: 96, facilityMedian: 95 },
  { id: "p3", name: "Mako TKA", caseCount: 2, totalProfit: 4200, medianDuration: 82, facilityMedian: 78 },
];

// Daily activity data
const dailyStats = [
  { date: "Feb 13", dow: "Thu", cases: 3, totalProfit: 6340, totalDuration: 250, avgProfit: 2113 },
  { date: "Feb 5", dow: "Wed", cases: 3, totalProfit: 8200, totalDuration: 268, avgProfit: 2733 },
  { date: "Feb 3", dow: "Mon", cases: 3, totalProfit: 7800, totalDuration: 255, avgProfit: 2600 },
];

// Recent 5 cases for overview preview
const recentCases = [
  { id: "ORB-2026-102", date: "Feb 13", proc: "Mako TKA", payer: "Medicare", room: "OR 1", duration: 84, surgDur: 58, profit: 2100, medianProfit: 3200, medianDur: 85, phases: { preOp: 12, surgical: 58, closing: 9, emergence: 5 } },
  { id: "ORB-2026-101", date: "Feb 13", proc: "THA", payer: "BlueCross", room: "OR 1", duration: 92, surgDur: 66, profit: 1800, medianProfit: 1800, medianDur: 96, phases: { preOp: 13, surgical: 66, closing: 8, emergence: 5 } },
  { id: "ORB-2026-100", date: "Feb 13", proc: "Mako THA", payer: "Aetna", room: "OR 3", duration: 74, surgDur: 56, profit: 2440, medianProfit: 3200, medianDur: 85, phases: { preOp: 8, surgical: 56, closing: 6, emergence: 4 } },
  { id: "ORB-2026-091", date: "Feb 5", proc: "Mako THA", payer: "Aetna", room: "OR 1", duration: 80, surgDur: 62, profit: 4100, medianProfit: 3200, medianDur: 85, phases: { preOp: 8, surgical: 62, closing: 6, emergence: 4 } },
  { id: "ORB-2026-090", date: "Feb 5", proc: "THA", payer: "BlueCross", room: "OR 1", duration: 96, surgDur: 68, profit: 1800, medianProfit: 1800, medianDur: 96, phases: { preOp: 14, surgical: 68, closing: 9, emergence: 5 } },
];

// Facility-wide averages for comparison context
const facilityAvg = {
  profitPerORHour: 1229,
  avgMarginPercent: 20.7,
  medianProfit: 2010,
};

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function SurgeonDetailRedesign() {
  const [loaded, setLoaded] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");

  useEffect(() => { setTimeout(() => setLoaded(true), 50); }, []);

  const maxPayerCases = Math.max(...payerMix.map(p => p.cases));
  const { avgReimbursement: avgR, avgDebits: avgD, avgORCost: avgOR, avgProfit: avgP } = surgeon.costBreakdown;

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className="max-w-[1400px] mx-auto px-6 py-8" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>

        {/* Header */}
        <div className={`transition-all duration-500 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Financial Analytics</h1>
              <p className="text-sm text-slate-500 mt-0.5">44 cases analyzed · Feb 1–20, 2026</p>
            </div>
            <button className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:border-slate-300 transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              This Month
            </button>
          </div>

          {/* Top-level tabs */}
          <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
            {["Overview", "By Procedure", "By Surgeon"].map((t, i) => (
              <button key={t} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${i === 2 ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{t}</button>
            ))}
          </div>

          <Breadcrumb items={[{ label: "All Surgeons", onClick: () => {} }, { label: "Dr. Berra" }]} />
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* HERO HEADER — Now with sparklines per stat     */}
        {/* ══════════════════════════════════════════════ */}
        <div className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-xl mb-5 transition-all duration-500 delay-100 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span className="text-lg font-bold">DB</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">Dr. Berra</h2>
                <span className="text-[10px] font-medium text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded-full uppercase tracking-wider">Low volume</span>
              </div>
              <p className="text-slate-400 mt-0.5">{surgeon.caseCount} cases in period · {surgeon.procedureCount} procedures</p>
            </div>
            {/* Facility comparison badges */}
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-center">
                <p className="text-[9px] text-slate-400 uppercase tracking-wider">vs Facility $/Hr</p>
                <p className="text-sm font-bold text-emerald-400 mt-0.5">+$1,399</p>
              </div>
              <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-center">
                <p className="text-[9px] text-slate-400 uppercase tracking-wider">vs Facility Margin</p>
                <p className="text-sm font-bold text-emerald-400 mt-0.5">+5.6%</p>
              </div>
            </div>
          </div>

          {/* Stats grid with sparklines */}
          <div className="grid grid-cols-6 gap-4 mt-6 pt-6 border-t border-white/10">
            {[
              { label: "Total Profit", value: fmt(surgeon.totalProfit), trend: "+5.9%", up: true, spark: surgeon.trends.profit, color: "#10b981" },
              { label: "Typical / Case", value: fmt(surgeon.medianProfit), trend: "-4.5%", up: false, spark: surgeon.trends.profitPerCase, color: "#a78bfa" },
              { label: "$ / OR Hour", value: `$${surgeon.profitPerORHour.toLocaleString()}`, trend: "+5.1%", up: true, spark: surgeon.trends.perHr, color: "#60a5fa", accent: "text-blue-300" },
              { label: "Margin", value: fmtPct(surgeon.avgMarginPercent), trend: "-0.5%", up: false, spark: surgeon.trends.margin, color: "#fbbf24" },
              { label: "Cases", value: surgeon.caseCount, trend: "—", up: null, spark: surgeon.trends.caseCount, color: "#94a3b8" },
              { label: "Typical Duration", value: fmtDur(surgeon.efficiency.medianDuration), trend: "-3 min", up: true, spark: surgeon.trends.duration, color: "#2dd4bf" },
            ].map((s, i) => (
              <div key={i} className="group">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{s.label}</span>
                  <SparklineLight data={s.spark} />
                </div>
                <div className={`text-2xl font-bold mt-1 ${s.accent || "text-white"}`}>{s.value}</div>
                {s.up !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium mt-1 ${s.up ? "text-emerald-400" : "text-red-400"}`}>
                    <svg className={`w-2.5 h-2.5 ${s.up ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
                    {s.trend} <span className="text-slate-500 ml-0.5">6mo</span>
                  </span>
                )}
                {s.up === null && <span className="text-[10px] text-slate-500 mt-1">Stable</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className={`flex gap-1 p-1 bg-slate-100 rounded-lg w-fit mb-5 transition-all duration-500 delay-150 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          {[
            { id: "overview", label: "Overview" },
            { id: "daily", label: "Daily Activity" },
            { id: "procedures", label: "By Procedure" },
          ].map(t => (
            <button key={t.id} onClick={() => setDetailTab(t.id)} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${detailTab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{t.label}</button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* OVERVIEW TAB                                   */}
        {/* ══════════════════════════════════════════════ */}
        {detailTab === "overview" && (
          <div className="space-y-4">

            {/* Row 1: Performance metric cards */}
            <div className={`grid grid-cols-4 gap-3 transition-all duration-500 delay-200 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all group">
                <div className="flex items-center gap-1 mb-2"><p className="text-xs font-medium text-slate-400">Time vs Facility</p><InfoTip text="Weighted avg comparing surgeon's duration to facility median per procedure type" /></div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-2xl font-bold ${surgeon.durationVsFacilityMinutes < 0 ? "text-green-600" : surgeon.durationVsFacilityMinutes > 5 ? "text-red-600" : "text-slate-900"}`}>{surgeon.durationVsFacilityMinutes > 0 ? "+" : ""}{surgeon.durationVsFacilityMinutes} min</p>
                    <p className="text-xs text-slate-400 mt-1">{surgeon.durationVsFacilityMinutes < 0 ? "Faster" : "Slower"} than facility typical</p>
                  </div>
                  <div className="opacity-60 group-hover:opacity-100 transition-opacity"><Sparkline data={[5, 3, 1, 0, -1, -2]} color="#10b981" /></div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all group">
                <div className="flex items-center gap-1 mb-2"><p className="text-xs font-medium text-slate-400">Profit Impact</p><InfoTip text="Estimated profit impact per case from time efficiency vs facility baseline" /></div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-2xl font-bold ${surgeon.profitImpact >= 0 ? "text-green-600" : "text-red-600"}`}>{surgeon.profitImpact >= 0 ? "+" : ""}{fmt(surgeon.profitImpact)}/case</p>
                    <p className="text-xs text-slate-400 mt-1">From time efficiency</p>
                  </div>
                  <div className="opacity-60 group-hover:opacity-100 transition-opacity"><Sparkline data={[-25, 0, 15, 30, 40, 50]} color="#10b981" /></div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all group">
                <div className="flex items-center gap-1 mb-2"><p className="text-xs font-medium text-slate-400">Typical Surgical Time</p><InfoTip text="Median incision-to-closing across all procedures" /></div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{fmtDur(surgeon.efficiency.avgSurgicalTime)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full text-emerald-700 bg-emerald-50">-4 min</span>
                      <span className="text-[10px] text-slate-400">6mo trend</span>
                    </div>
                  </div>
                  <div className="opacity-60 group-hover:opacity-100 transition-opacity"><Sparkline data={[68, 66, 65, 64, 63, 62]} color="#0ea5e9" /></div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-400 mb-2">Consistency</p>
                <ConsistencyBadge rating={surgeon.efficiency.consistencyRating} size="lg" />
                <p className="text-xs text-slate-400 mt-2">Case duration variance</p>
                {/* Mini variance visualization */}
                <div className="mt-2 flex items-end gap-0.5 h-6">
                  {[82, 80, 84, 78, 88, 80, 85, 82, 84].map((d, i) => {
                    const h = ((d - 75) / 15) * 100;
                    return <div key={i} className="flex-1 bg-green-200 rounded-t-sm" style={{ height: `${h}%` }} />;
                  })}
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-slate-400"><span>Narrow range</span><span>78–88 min</span></div>
              </div>
            </div>

            {/* Row 2: Trend chart + Distribution */}
            <div className={`grid grid-cols-3 gap-4 transition-all duration-500 delay-300 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>

              {/* Monthly Trend */}
              <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div><h3 className="text-sm font-semibold text-slate-900">Volume & Profit Trend</h3><p className="text-xs text-slate-400 mt-0.5">Monthly case volume, total profit, and margin</p></div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-emerald-500/70 rounded-sm" />Profit</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 rounded-full" />Avg/Case</span>
                    <span className="flex items-center gap-1.5"><span className="w-5 h-3 bg-slate-200/60 rounded-sm text-[8px] text-slate-400 flex items-center justify-center">n</span>Volume</span>
                  </div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} dy={8} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={44} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} domain={[0, 'auto']} width={28} />
                      <ReTooltip contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)", fontSize: "12px" }} formatter={(v, n) => [n === "cases" ? `${v} cases` : `$${v.toLocaleString()}`, n === "cases" ? "Volume" : n === "profit" ? "Total Profit" : "Avg/Case"]} />
                      <Bar yAxisId="right" dataKey="cases" fill="#e2e8f0" radius={[3, 3, 0, 0]} maxBarSize={28} />
                      <Area yAxisId="left" type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#spGrad)" dot={{ r: 3, fill: "#10b981", stroke: "white", strokeWidth: 2 }} />
                      <Line yAxisId="left" type="monotone" dataKey="avgProfit" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2.5, fill: "#3b82f6", stroke: "white", strokeWidth: 1.5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Profit Distribution */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="mb-4"><h3 className="text-sm font-semibold text-slate-900">Profit Distribution</h3><p className="text-xs text-slate-400 mt-0.5">Per-case profit spread across {surgeon.caseCount} cases</p></div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profitBins} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "#94a3b8" }} dy={4} interval={0} angle={-25} textAnchor="end" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} width={18} />
                      <ReTooltip contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }} formatter={(v) => [`${v} case${v !== 1 ? "s" : ""}`, "Count"]} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                        {profitBins.map((b, i) => <Cell key={i} fill={b.count === 0 ? "#f1f5f9" : "#10b981"} opacity={b.count === 0 ? 0.5 : 0.7} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Facility median reference */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-[10px] text-slate-400 uppercase">Min</p><p className="text-sm font-semibold text-slate-700 tabular-nums">$1,200</p></div>
                    <div><p className="text-[10px] text-slate-400 uppercase">Median</p><p className="text-sm font-semibold text-emerald-600 tabular-nums">$3,200</p></div>
                    <div><p className="text-[10px] text-slate-400 uppercase">Max</p><p className="text-sm font-semibold text-slate-700 tabular-nums">$5,200</p></div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[5px] border-l-transparent border-r-transparent border-b-blue-400" />
                    Facility median: $2,010
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Case Economics + Payer Mix */}
            <div className={`grid grid-cols-2 gap-4 transition-all duration-500 delay-[400ms] ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>

              {/* Enhanced Case Economics */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Average Case Economics</h3>
                <div className="space-y-0">
                  {[
                    { label: "Reimbursement", value: avgR, color: "#3b82f6", indent: false },
                    { label: "Implants & Supplies", value: -avgD, color: "#ef4444", indent: true },
                    { label: "OR Time Cost", value: -avgOR, color: "#f59e0b", indent: true },
                  ].map((row, i) => (
                    <div key={i} className={`flex items-center justify-between py-2.5 ${row.indent ? "pl-4" : ""}`}>
                      <div className="flex items-center gap-3 flex-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                        <span className="text-sm text-slate-600">{row.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(Math.abs(row.value) / avgR) * 100}%`, backgroundColor: row.color, opacity: 0.6 }} />
                        </div>
                        <span className={`text-sm font-medium tabular-nums w-20 text-right ${row.value < 0 ? "text-red-600" : "text-slate-900"}`}>
                          {row.value < 0 ? `(${fmt(Math.abs(row.value))})` : fmt(row.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-200">
                    <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /><span className="text-sm font-semibold text-slate-900">Net Profit / Case</span></div>
                    <div className="flex items-center gap-3">
                      <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(avgP / avgR) * 100}%`, opacity: 0.7 }} /></div>
                      <span className={`text-sm font-bold tabular-nums w-20 text-right ${avgP >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(avgP)}</span>
                    </div>
                  </div>
                </div>
                {/* Stacked bar */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-0.5 h-4 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-l-full" style={{ width: `${(avgD / avgR) * 100}%` }} />
                    <div className="h-full bg-amber-400" style={{ width: `${(avgOR / avgR) * 100}%` }} />
                    <div className="h-full bg-emerald-400 rounded-r-full" style={{ width: `${(avgP / avgR) * 100}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Implants {((avgD / avgR) * 100).toFixed(0)}%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />OR {((avgOR / avgR) * 100).toFixed(0)}%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Profit {((avgP / avgR) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Payer Mix */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="mb-4"><h3 className="text-sm font-semibold text-slate-900">Payer Mix</h3><p className="text-xs text-slate-400 mt-0.5">Reimbursement and margin by payer</p></div>
                <div className="space-y-0 divide-y divide-slate-50">
                  <div className="grid grid-cols-12 pb-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    <div className="col-span-4">Payer</div><div className="col-span-2 text-center">Cases</div><div className="col-span-3 text-right">Avg Reimb.</div><div className="col-span-3 text-right">Margin</div>
                  </div>
                  {payerMix.map((p, i) => (
                    <div key={i} className="grid grid-cols-12 items-center py-3 hover:bg-slate-50/50 transition-colors">
                      <div className="col-span-4 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} /><span className="text-sm font-medium text-slate-800">{p.payer}</span></div>
                      <div className="col-span-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-sm text-slate-600 tabular-nums">{p.cases}</span>
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(p.cases / maxPayerCases) * 100}%`, backgroundColor: p.color, opacity: 0.5 }} /></div>
                        </div>
                      </div>
                      <div className="col-span-3 text-right text-sm text-slate-700 tabular-nums">{fmt(p.avgReimbursement)}</div>
                      <div className="col-span-3 text-right"><MarginBadge value={p.margin} /></div>
                    </div>
                  ))}
                </div>
                {/* Insight */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
                    <div>
                      <p className="text-xs font-semibold text-blue-800">Payer Insight</p>
                      <p className="text-[11px] text-blue-600 mt-0.5">BlueCross cases average 37.3% margin vs 17.1% for Medicare — a $2,400 profit difference per case. 4 of 9 cases are BlueCross, which significantly lifts Dr. Berra's overall profitability.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 4: Recent Cases Preview */}
            <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-500 delay-500 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div><h3 className="text-sm font-semibold text-slate-900">Recent Cases</h3><p className="text-xs text-slate-400 mt-0.5">Last 5 cases · View Daily Activity for full breakdown</p></div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    {[["Pre-Op","bg-blue-500"],["Surgical","bg-green-500"],["Closing","bg-amber-500"],["Emergence","bg-violet-500"]].map(([l,c])=><span key={l} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${c}`} />{l}</span>)}
                  </div>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {recentCases.map((c, idx) => {
                  const durDiff = c.duration - c.medianDur;
                  const profDiff = c.profit - c.medianProfit;
                  return (
                    <div key={c.id} className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${idx === 0 ? "bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm" : "bg-slate-100 text-slate-500"}`}>{idx + 1}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">{c.proc}</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-xs text-slate-500">{c.room}</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-xs text-slate-400">{c.date}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[10px] text-slate-400">{c.id}</span>
                            <span className="text-[10px] text-slate-300">·</span>
                            <span className="text-[10px] text-slate-400">{c.payer}</span>
                          </div>
                          {/* Phase pills */}
                          <div className="flex items-center gap-1 mt-2">
                            <PhasePill label="Pre-Op" minutes={c.phases.preOp} color="blue" />
                            <PhasePill label="Surgical" minutes={c.phases.surgical} color="green" />
                            <PhasePill label="Closing" minutes={c.phases.closing} color="amber" />
                            <PhasePill label="Emergence" minutes={c.phases.emergence} color="violet" />
                          </div>
                        </div>
                        <div className="flex items-center gap-5 shrink-0">
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400 uppercase mb-0.5">Duration</div>
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-sm font-semibold text-slate-900 tabular-nums">{fmtDur(c.duration)}</span>
                              <ComparisonPill value={durDiff} unit="min" invert />
                            </div>
                          </div>
                          <div className="text-right min-w-[120px]">
                            <div className="text-[10px] text-slate-400 uppercase mb-0.5">Profit</div>
                            <div className="flex items-center justify-end gap-1.5">
                              <span className={`text-sm font-bold tabular-nums ${c.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(c.profit)}</span>
                              <ComparisonPill value={profDiff} format="currency" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Footer link to Daily Activity */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                <button onClick={() => setDetailTab("daily")} className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1">
                  View all days in Daily Activity
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════ */}
        {/* DAILY ACTIVITY TAB (preserved — stub here)     */}
        {/* ══════════════════════════════════════════════ */}
        {detailTab === "daily" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">Daily Activity</h3><p className="text-xs text-slate-400 mt-0.5">Click a day to view detailed case breakdown</p></div>
            <div className="divide-y divide-slate-50">
              {dailyStats.map(day => (
                <div key={day.date} className="flex items-center gap-4 px-5 py-4 hover:bg-blue-50/50 cursor-pointer transition-all group">
                  <div className="w-16"><div className="text-base font-bold text-slate-900">{day.date}</div><div className="text-xs text-slate-500">{day.dow}</div></div>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">{day.cases} cases</span>
                  <div className="flex-1 flex items-center gap-6 justify-end">
                    <div className="text-right"><div className="text-[10px] text-slate-400 uppercase">Duration</div><div className="text-sm font-semibold text-slate-900">{fmtDur(day.totalDuration)}</div></div>
                    <div className="text-right"><div className="text-[10px] text-slate-400 uppercase">Total Profit</div><div className="text-sm font-bold text-green-600">{fmt(day.totalProfit)}</div></div>
                    <div className="text-right"><div className="text-[10px] text-slate-400 uppercase">Avg/Case</div><div className="text-sm font-semibold text-slate-900">{fmt(day.avgProfit)}</div></div>
                    <ChevronRight />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════ */}
        {/* BY PROCEDURE TAB (preserved — stub here)       */}
        {/* ══════════════════════════════════════════════ */}
        {detailTab === "procedures" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">Performance by Procedure</h3><p className="text-xs text-slate-400 mt-0.5">Comparing surgeon median to facility median</p></div>
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">Procedure</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-medium text-slate-400 uppercase tracking-wider">Cases</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Profit</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase tracking-wider">Surgeon Median</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase tracking-wider">Facility Median</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase tracking-wider">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {procedureBreakdown.map(pb => {
                  const diff = pb.medianDuration - pb.facilityMedian;
                  return (
                    <tr key={pb.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{pb.name}</td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">{pb.caseCount}{pb.caseCount < 5 && <span className="ml-1 text-amber-500 text-[10px]">*</span>}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600 tabular-nums">{fmt(pb.totalProfit)}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-900 tabular-nums">{fmtDur(pb.medianDuration)}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">{fmtDur(pb.facilityMedian)}</td>
                      <td className="px-4 py-3 text-right"><ComparisonPill value={diff} unit="min" invert /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {procedureBreakdown.some(p => p.caseCount < 5) && <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100"><p className="text-[10px] text-slate-500">* Low sample size — interpret with caution</p></div>}
          </div>
        )}

        <div className="text-center mt-8 pb-4"><p className="text-[10px] text-slate-300 uppercase tracking-widest">ORbit Financial Analytics · Surgeon Detail Reference v4</p></div>
      </div>
    </div>
  );
}
