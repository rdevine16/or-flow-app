import { useState, useEffect, useRef, useMemo } from "react";
import {
  BarChart, Bar, ComposedChart, Area, Line,
  XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell, ReferenceLine,
  ScatterChart, Scatter, CartesianGrid
} from "recharts";

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

const fmt = (v) => `$${Math.abs(v).toLocaleString()}`;
const fmtK = (v) => Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v.toLocaleString()}`;
const fmtPct = (v) => v === null ? "—" : `${v.toFixed(1)}%`;
const fmtDur = (m) => m === null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`;

const Sparkline = ({ data, color = "#3b82f6", w = 56, h = 20 }) => {
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

const MarginBadge = ({ value }) => {
  const c = value >= 30 ? "bg-green-50 text-green-600" : value >= 15 ? "bg-amber-50 text-amber-700" : value >= 0 ? "bg-red-50 text-red-600" : "bg-red-100 text-red-800";
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${c}`}>{fmtPct(value)}</span>;
};

const MarginBar = ({ value }) => {
  const w = Math.min(Math.max(value, 0), 100);
  const c = value >= 30 ? "bg-green-500" : value >= 15 ? "bg-amber-500" : "bg-red-500";
  return <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${c}`} style={{ width: `${w}%` }} /></div>;
};

const ConsistencyBadge = ({ rating }) => {
  const cfg = { high: { l: "⚡ High", bg: "bg-green-50 text-green-600 ring-green-200/50" }, medium: { l: "◐ Moderate", bg: "bg-amber-50 text-amber-700 ring-amber-200/50" }, low: { l: "◯ Variable", bg: "bg-red-50 text-red-600 ring-red-200/50" } };
  const c = cfg[rating] || cfg.medium;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ring-1 ${c.bg}`}>{c.l}</span>;
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

const SortTH = ({ label, sortKey, current, dir, onClick, align = "right" }) => {
  const active = current === sortKey;
  const al = align === "center" ? "text-center" : align === "left" ? "text-left" : "text-right";
  return (
    <th className={`px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors ${al} ${active ? "text-slate-700" : "text-slate-400"}`} onClick={() => onClick(sortKey)}>
      <span className="inline-flex items-center gap-0.5">{label}{active && (dir === "desc" ? <ChevronDown /> : <ChevronUp />)}</span>
    </th>
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
// PROCEDURE DATA — Mako THA (richest data set)
// ═══════════════════════════════════════════════════

const proc = {
  id: "p1", name: "Mako THA", surgeonCount: 4, caseCount: 7,
  totalProfit: 28198, medianProfit: 3800, avgProfit: 4028,
  profitPerORHour: 2897, avgMarginPercent: 41.9,
  medianDurationMinutes: 85, avgDurationMinutes: 88,
  totalReimbursement: 67200, totalDebits: 28400, totalCredits: 0, totalORCost: 10602,
  profitRange: { p25: 2800, p75: 5200 },
  durationRange: { p25: 78, p75: 95 },
  // Sparkline data for KPI cards (7 months of history)
  profitTrend: [18200, 22400, 19800, 24100, 26500, 25800, 28198],
  marginTrend: [35.2, 38.1, 36.8, 40.2, 42.5, 41.1, 41.9],
  durationTrend: [92, 90, 91, 88, 86, 87, 85],
  perHrTrend: [2100, 2350, 2200, 2550, 2750, 2680, 2897],
  volumeTrend: [5, 6, 5, 7, 8, 6, 7],
};

const surgeonBreakdown = [
  { surgeonId: "s1", surgeonName: "Dr. Berra", caseCount: 3, totalProfit: 12800, medianProfit: 4100, avgProfit: 4267, profitPerORHour: 3200, medianDurationMinutes: 80, avgDurationMinutes: 82, durationVsFacilityMinutes: -5, profitImpact: 125, consistencyRating: "high" },
  { surgeonId: "s2", surgeonName: "Dr. Swartz", caseCount: 2, totalProfit: 8400, medianProfit: 4200, avgProfit: 4200, profitPerORHour: 2800, medianDurationMinutes: 88, avgDurationMinutes: 90, durationVsFacilityMinutes: 3, profitImpact: -75, consistencyRating: "medium" },
  { surgeonId: "s3", surgeonName: "Dr. Farmer", caseCount: 1, totalProfit: 3800, medianProfit: 3800, avgProfit: 3800, profitPerORHour: 2500, medianDurationMinutes: 92, avgDurationMinutes: 92, durationVsFacilityMinutes: 7, profitImpact: -175, consistencyRating: null },
  { surgeonId: "s4", surgeonName: "Dr. Camp", caseCount: 1, totalProfit: 3198, medianProfit: 3198, avgProfit: 3198, profitPerORHour: 2600, medianDurationMinutes: 84, avgDurationMinutes: 84, durationVsFacilityMinutes: -1, profitImpact: 25, consistencyRating: null },
];

// Monthly volume + profit trend
const monthlyTrend = [
  { month: "Sep", cases: 5, profit: 18200, avgProfit: 3640 },
  { month: "Oct", cases: 6, profit: 22400, avgProfit: 3733 },
  { month: "Nov", cases: 5, profit: 19800, avgProfit: 3960 },
  { month: "Dec", cases: 7, profit: 24100, avgProfit: 3443 },
  { month: "Jan", cases: 8, profit: 26500, avgProfit: 3313 },
  { month: "Feb*", cases: 7, profit: 28198, avgProfit: 4028 },
];

// Individual case profit distribution (scatter data)
const caseDistribution = [
  { id: 1, profit: 5200, duration: 78, surgeon: "Dr. Berra", payer: "BlueCross", date: "Feb 3" },
  { id: 2, profit: 4100, duration: 80, surgeon: "Dr. Berra", payer: "Aetna", date: "Feb 5" },
  { id: 3, profit: 4200, duration: 85, surgeon: "Dr. Swartz", payer: "BlueCross", date: "Feb 4" },
  { id: 4, profit: 4200, duration: 92, surgeon: "Dr. Swartz", payer: "UHC", date: "Feb 4" },
  { id: 5, profit: 3800, duration: 92, surgeon: "Dr. Farmer", payer: "Cigna", date: "Feb 2" },
  { id: 6, profit: 3500, duration: 84, surgeon: "Dr. Camp", payer: "BlueCross", date: "Feb 3" },
  { id: 7, profit: 3198, duration: 95, surgeon: "Dr. Berra", payer: "Medicare", date: "Feb 13" },
];

// Payer mix
const payerMix = [
  { payer: "BlueCross", cases: 3, avgReimbursement: 10200, avgProfit: 4300, margin: 48.2, color: "#3b82f6" },
  { payer: "Aetna", cases: 1, avgReimbursement: 9800, avgProfit: 4100, margin: 44.5, color: "#8b5cf6" },
  { payer: "UHC", cases: 1, avgReimbursement: 9400, avgProfit: 4200, margin: 42.1, color: "#06b6d4" },
  { payer: "Cigna", cases: 1, avgReimbursement: 8800, avgProfit: 3800, margin: 38.6, color: "#f59e0b" },
  { payer: "Medicare", cases: 1, avgReimbursement: 8200, avgProfit: 3198, margin: 28.4, color: "#ef4444" },
];

// Recent cases for the table
const recentCases = [
  { id: "ORB-2026-102", date: "Feb 13", surgeon: "Dr. Berra", payer: "Medicare", duration: 95, profit: 3198, reimbursement: 8200, debits: 3480, orCost: 1522, room: "OR 1" },
  { id: "ORB-2026-091", date: "Feb 5", surgeon: "Dr. Berra", payer: "Aetna", duration: 80, profit: 4100, reimbursement: 9800, debits: 4100, orCost: 1600, room: "OR 1" },
  { id: "ORB-2026-085", date: "Feb 4", surgeon: "Dr. Swartz", payer: "BlueCross", duration: 85, profit: 4200, reimbursement: 10200, debits: 4200, orCost: 1800, room: "OR 2" },
  { id: "ORB-2026-086", date: "Feb 4", surgeon: "Dr. Swartz", payer: "UHC", duration: 92, profit: 4200, reimbursement: 9400, debits: 3600, orCost: 1600, room: "OR 2" },
  { id: "ORB-2026-078", date: "Feb 3", surgeon: "Dr. Camp", payer: "BlueCross", duration: 84, profit: 3500, reimbursement: 10200, debits: 4900, orCost: 1800, room: "OR 3" },
  { id: "ORB-2026-075", date: "Feb 3", surgeon: "Dr. Berra", payer: "BlueCross", duration: 78, profit: 5200, reimbursement: 10200, debits: 3200, orCost: 1800, room: "OR 1" },
  { id: "ORB-2026-065", date: "Feb 2", surgeon: "Dr. Farmer", payer: "Cigna", duration: 92, profit: 3800, reimbursement: 8800, debits: 3400, orCost: 1600, room: "OR 2" },
];

// Histogram bins for profit distribution
const profitBins = [
  { range: "$2.5-3k", count: 1, min: 2500, max: 3000 },
  { range: "$3-3.5k", count: 2, min: 3000, max: 3500 },
  { range: "$3.5-4k", count: 1, min: 3500, max: 4000 },
  { range: "$4-4.5k", count: 2, min: 4000, max: 4500 },
  { range: "$4.5-5k", count: 0, min: 4500, max: 5000 },
  { range: "$5-5.5k", count: 1, min: 5000, max: 5500 },
];

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function ProcedureDetailRedesign() {
  const [loaded, setLoaded] = useState(false);
  const [caseSortKey, setCaseSortKey] = useState("date");
  const [caseSortDir, setCaseSortDir] = useState("desc");
  const [surgSortKey, setSurgSortKey] = useState("totalProfit");
  const [surgSortDir, setSurgSortDir] = useState("desc");
  const [expandedCase, setExpandedCase] = useState(null);

  useEffect(() => { setTimeout(() => setLoaded(true), 50); }, []);

  const toggleCaseSort = (k) => { if (caseSortKey === k) setCaseSortDir(d => d === "desc" ? "asc" : "desc"); else { setCaseSortKey(k); setCaseSortDir("desc"); } };
  const toggleSurgSort = (k) => { if (surgSortKey === k) setSurgSortDir(d => d === "desc" ? "asc" : "desc"); else { setSurgSortKey(k); setSurgSortDir("desc"); } };

  const sortedSurgeons = useMemo(() => {
    const key = (s) => ({ totalProfit: s.totalProfit, caseCount: s.caseCount, medianDurationMinutes: s.medianDurationMinutes, profitPerORHour: s.profitPerORHour, durationVsFacilityMinutes: s.durationVsFacilityMinutes }[surgSortKey] ?? 0);
    return [...surgeonBreakdown].sort((a, b) => surgSortDir === "desc" ? key(b) - key(a) : key(a) - key(b));
  }, [surgSortKey, surgSortDir]);

  const sortedCases = useMemo(() => {
    const key = (c) => ({ date: c.date, profit: c.profit, duration: c.duration, reimbursement: c.reimbursement }[caseSortKey] ?? 0);
    if (caseSortKey === "date") return [...recentCases].sort((a, b) => caseSortDir === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
    return [...recentCases].sort((a, b) => caseSortDir === "desc" ? key(b) - key(a) : key(a) - key(b));
  }, [caseSortKey, caseSortDir]);

  const loss = proc.totalProfit < 0;
  const avgR = proc.totalReimbursement / proc.caseCount;
  const avgD = proc.totalDebits / proc.caseCount;
  const avgOR = proc.totalORCost / proc.caseCount;
  const avgP = proc.totalProfit / proc.caseCount;
  const maxPayerCases = Math.max(...payerMix.map(p => p.cases));

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

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
            {["Overview", "By Procedure", "By Surgeon"].map((t, i) => (
              <button key={t} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${i === 1 ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{t}</button>
            ))}
          </div>

          {/* Breadcrumb */}
          <Breadcrumb items={[{ label: "All Procedures", onClick: () => {} }, { label: "Mako THA" }]} />
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* SECTION 1: KPI Cards — Matching Overview Style */}
        {/* ══════════════════════════════════════════════ */}
        <div className={`grid grid-cols-5 gap-3 mb-4 transition-all duration-500 delay-100 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>

          {/* Total Profit — hero card */}
          <div className={`rounded-xl border p-4 ${loss ? "bg-red-50 border-red-200" : "bg-emerald-50/70 border-emerald-200"}`}>
            <p className={`text-xs font-medium mb-1.5 ${loss ? "text-red-500" : "text-emerald-600"}`}>Total Profit</p>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-2xl font-bold tracking-tight ${loss ? "text-red-600" : "text-emerald-700"}`}>{fmt(proc.totalProfit)}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full text-emerald-700 bg-emerald-100/80">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>+9.3%
                  </span>
                  <span className="text-[10px] text-slate-400">vs last month</span>
                </div>
              </div>
              <Sparkline data={proc.profitTrend} color={loss ? "#ef4444" : "#10b981"} w={52} h={24} />
            </div>
          </div>

          {/* Median Profit */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-slate-300 transition-all group">
            <div className="flex items-center gap-1 mb-1.5"><p className="text-xs text-slate-400 font-medium">Median Profit</p><InfoTip text={`Avg: ${fmt(proc.avgProfit)} · IQR: ${fmt(proc.profitRange.p25)}–${fmt(proc.profitRange.p75)}`} /></div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xl font-semibold text-slate-900 tracking-tight">{fmt(proc.medianProfit)}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full text-emerald-700 bg-emerald-50">+4.1%</span>
                  <span className="text-[10px] text-slate-400">IQR: $2.8k–$5.2k</span>
                </div>
              </div>
              <div className="opacity-60 group-hover:opacity-100 transition-opacity"><Sparkline data={[3200, 3500, 3400, 3700, 3900, 3750, 3800]} color="#6366f1" w={48} h={20} /></div>
            </div>
          </div>

          {/* Typical Duration */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-slate-300 transition-all group">
            <div className="flex items-center gap-1 mb-1.5"><p className="text-xs text-slate-400 font-medium">Typical Duration</p><InfoTip text={`Avg: ${proc.avgDurationMinutes} min · IQR: ${proc.durationRange.p25}–${proc.durationRange.p75} min`} /></div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xl font-semibold text-slate-900 tracking-tight">{proc.medianDurationMinutes} min</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full text-emerald-700 bg-emerald-50">
                    <svg className="w-2.5 h-2.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>-3 min
                  </span>
                  <span className="text-[10px] text-slate-400">improving</span>
                </div>
              </div>
              <div className="opacity-60 group-hover:opacity-100 transition-opacity"><Sparkline data={proc.durationTrend} color="#0ea5e9" w={48} h={20} /></div>
            </div>
          </div>

          {/* Margin */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-slate-300 transition-all group">
            <p className="text-xs text-slate-400 font-medium mb-1.5">Margin</p>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xl font-semibold text-slate-900 tracking-tight">{fmtPct(proc.avgMarginPercent)}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full text-emerald-700 bg-emerald-50">+1.8%</span>
                  <span className="text-[10px] text-slate-400">6mo trend</span>
                </div>
              </div>
              <div className="opacity-60 group-hover:opacity-100 transition-opacity"><Sparkline data={proc.marginTrend} color="#8b5cf6" w={48} h={20} /></div>
            </div>
          </div>

          {/* $/OR Hour */}
          <div className="bg-white rounded-xl border border-blue-200 ring-1 ring-blue-100 shadow-sm p-4 hover:border-blue-300 transition-all group">
            <div className="flex items-center gap-1 mb-1.5"><p className="text-xs text-blue-500 font-medium">$/OR Hour</p></div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xl font-semibold text-blue-700 tracking-tight">${proc.profitPerORHour.toLocaleString()}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full text-emerald-700 bg-emerald-50">+8.1%</span>
                  <span className="text-[10px] text-slate-400">{proc.caseCount} cases · {proc.surgeonCount} surgeons</span>
                </div>
              </div>
              <div className="opacity-60 group-hover:opacity-100 transition-opacity"><Sparkline data={proc.perHrTrend} color="#3b82f6" w={48} h={20} /></div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* SECTION 2: Trend + Distribution (side by side) */}
        {/* ══════════════════════════════════════════════ */}
        <div className={`grid grid-cols-3 gap-4 mb-4 transition-all duration-500 delay-200 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>

          {/* Volume & Profit Trend (takes 2 cols) */}
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-semibold text-slate-900">Volume & Profit Trend</h3><p className="text-xs text-slate-400 mt-0.5">Monthly case volume and total profit</p></div>
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
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
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
                  <Area yAxisId="left" type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#profGrad)" dot={{ r: 3, fill: "#10b981", stroke: "white", strokeWidth: 2 }} />
                  <Line yAxisId="left" type="monotone" dataKey="avgProfit" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2.5, fill: "#3b82f6", stroke: "white", strokeWidth: 1.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Profit Distribution (1 col) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="mb-4"><h3 className="text-sm font-semibold text-slate-900">Profit Distribution</h3><p className="text-xs text-slate-400 mt-0.5">Per-case profit spread across {proc.caseCount} cases</p></div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitBins} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8" }} dy={4} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} width={20} />
                  <ReTooltip contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }} formatter={(v) => [`${v} cases`, "Count"]} />
                  <ReferenceLine y={0} stroke="#e2e8f0" />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {profitBins.map((b, i) => <Cell key={i} fill={b.count === 0 ? "#f1f5f9" : "#10b981"} opacity={b.count === 0 ? 0.5 : 0.7} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Distribution summary */}
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-[10px] text-slate-400 uppercase">Min</p><p className="text-sm font-semibold text-slate-700 tabular-nums">$3,198</p></div>
              <div><p className="text-[10px] text-slate-400 uppercase">Median</p><p className="text-sm font-semibold text-emerald-600 tabular-nums">$3,800</p></div>
              <div><p className="text-[10px] text-slate-400 uppercase">Max</p><p className="text-sm font-semibold text-slate-700 tabular-nums">$5,200</p></div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* SECTION 3: Avg Case Economics + Payer Mix     */}
        {/* ══════════════════════════════════════════════ */}
        <div className={`grid grid-cols-2 gap-4 mb-4 transition-all duration-500 delay-300 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>

          {/* Average Case Economics */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Average Case Economics</h3>
            <div className="space-y-0">
              {/* Waterfall-style with bars */}
              {[
                { label: "Reimbursement", value: avgR, color: "#3b82f6", isTotal: false, indent: false },
                { label: "Implants & Supplies", value: -avgD, color: "#ef4444", isTotal: false, indent: true },
                { label: "OR Time Cost", value: -avgOR, color: "#f59e0b", isTotal: false, indent: true },
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
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-sm font-semibold text-slate-900">Net Profit / Case</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(avgP / avgR) * 100}%`, opacity: 0.7 }} />
                  </div>
                  <span className={`text-sm font-bold tabular-nums w-20 text-right ${avgP >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(avgP)}</span>
                </div>
              </div>
            </div>
            {/* Cost percentage breakdown */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1 h-4 rounded-full overflow-hidden">
                <div className="h-full bg-red-400 rounded-l-full" style={{ width: `${(avgD / avgR) * 100}%` }} title="Implants" />
                <div className="h-full bg-amber-400" style={{ width: `${(avgOR / avgR) * 100}%` }} title="OR Cost" />
                <div className="h-full bg-emerald-400 rounded-r-full" style={{ width: `${(avgP / avgR) * 100}%` }} title="Profit" />
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Implants {((avgD / avgR) * 100).toFixed(0)}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />OR Cost {((avgOR / avgR) * 100).toFixed(0)}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Profit {((avgP / avgR) * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Payer Mix */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="mb-4"><h3 className="text-sm font-semibold text-slate-900">Payer Mix</h3><p className="text-xs text-slate-400 mt-0.5">Reimbursement and margin by payer for this procedure</p></div>
            <div className="space-y-0 divide-y divide-slate-50">
              {/* Header */}
              <div className="grid grid-cols-12 pb-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                <div className="col-span-4">Payer</div>
                <div className="col-span-2 text-center">Cases</div>
                <div className="col-span-3 text-right">Avg Reimb.</div>
                <div className="col-span-3 text-right">Margin</div>
              </div>
              {payerMix.map((p, i) => (
                <div key={i} className="grid grid-cols-12 items-center py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="col-span-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-sm font-medium text-slate-800">{p.payer}</span>
                  </div>
                  <div className="col-span-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-sm text-slate-600 tabular-nums">{p.cases}</span>
                      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(p.cases / maxPayerCases) * 100}%`, backgroundColor: p.color, opacity: 0.5 }} />
                      </div>
                    </div>
                  </div>
                  <div className="col-span-3 text-right text-sm text-slate-700 tabular-nums">{fmt(p.avgReimbursement)}</div>
                  <div className="col-span-3 text-right"><MarginBadge value={p.margin} /></div>
                </div>
              ))}
            </div>
            {/* Insight callout */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
                <div>
                  <p className="text-xs font-semibold text-blue-800">Payer Insight</p>
                  <p className="text-[11px] text-blue-600 mt-0.5">BlueCross cases average 48.2% margin vs 28.4% for Medicare — a $1,102 profit difference per case driven primarily by higher reimbursement rates.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* SECTION 4: Surgeon Breakdown Table             */}
        {/* ══════════════════════════════════════════════ */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4 transition-all duration-500 delay-[400ms] ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          <div className="px-5 py-4 border-b border-slate-100"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-slate-900">Surgeon Breakdown</h3><InfoTip text="Each surgeon compared to facility median for Mako THA" /></div><p className="text-xs text-slate-400 mt-0.5">{proc.surgeonCount} surgeons · Facility median: {proc.medianDurationMinutes} min</p></div>
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">Surgeon</th>
                <SortTH label="Cases" sortKey="caseCount" current={surgSortKey} dir={surgSortDir} onClick={toggleSurgSort} align="center" />
                <SortTH label="Median Profit" sortKey="totalProfit" current={surgSortKey} dir={surgSortDir} onClick={toggleSurgSort} />
                <th className="px-4 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase tracking-wider">Impact</th>
                <SortTH label="$/OR Hr" sortKey="profitPerORHour" current={surgSortKey} dir={surgSortDir} onClick={toggleSurgSort} />
                <SortTH label="Typical Time" sortKey="medianDurationMinutes" current={surgSortKey} dir={surgSortDir} onClick={toggleSurgSort} />
                <SortTH label="vs Facility" sortKey="durationVsFacilityMinutes" current={surgSortKey} dir={surgSortDir} onClick={toggleSurgSort} />
                <th className="px-4 py-2.5 text-center text-[10px] font-medium text-slate-400 uppercase tracking-wider">Consistency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedSurgeons.map(s => (
                <tr key={s.surgeonId} className="hover:bg-slate-50/80 transition-colors cursor-pointer">
                  <td className="px-4 py-3"><span className="text-sm font-medium text-slate-800">{s.surgeonName}</span>{s.caseCount < 5 && <span className="ml-1 text-amber-500 text-[10px]">*</span>}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-600">{s.caseCount}</td>
                  <td className="px-4 py-3 text-right"><span className="font-medium text-green-600 tabular-nums">{fmt(s.medianProfit)}</span></td>
                  <td className="px-4 py-3 text-right">{Math.abs(s.profitImpact) >= 10 ? <ComparisonPill value={s.profitImpact} format="currency" /> : <span className="text-sm text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-slate-900 tabular-nums">{fmt(s.profitPerORHour)}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">{s.medianDurationMinutes} min</td>
                  <td className="px-4 py-3 text-right"><ComparisonPill value={s.durationVsFacilityMinutes} unit="min" invert /></td>
                  <td className="px-4 py-3 text-center">{s.consistencyRating ? <ConsistencyBadge rating={s.consistencyRating} /> : <span className="text-slate-400 text-xs">Insufficient data</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {surgeonBreakdown.some(s => s.caseCount < 5) && <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100"><p className="text-[10px] text-slate-500">* Below minimum threshold — interpret with caution</p></div>}
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* SECTION 5: Recent Cases Table                  */}
        {/* ══════════════════════════════════════════════ */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-500 delay-500 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div><h3 className="text-sm font-semibold text-slate-900">Recent Cases</h3><p className="text-xs text-slate-400 mt-0.5">{recentCases.length} Mako THA cases in period · Click to expand</p></div>
            </div>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider w-8" />
                <SortTH label="Date" sortKey="date" current={caseSortKey} dir={caseSortDir} onClick={toggleCaseSort} align="left" />
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">Case #</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">Surgeon</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">Payer</th>
                <SortTH label="Duration" sortKey="duration" current={caseSortKey} dir={caseSortDir} onClick={toggleCaseSort} />
                <SortTH label="Reimb." sortKey="reimbursement" current={caseSortKey} dir={caseSortDir} onClick={toggleCaseSort} />
                <SortTH label="Profit" sortKey="profit" current={caseSortKey} dir={caseSortDir} onClick={toggleCaseSort} />
                <th className="px-4 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase tracking-wider">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedCases.map((c, i) => {
                const margin = c.reimbursement > 0 ? (c.profit / c.reimbursement) * 100 : 0;
                const profitDiff = c.profit - proc.medianProfit;
                const durDiff = c.duration - proc.medianDurationMinutes;
                const isExpanded = expandedCase === c.id;

                return (
                  <React.Fragment key={c.id}>
                    <tr
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${isExpanded ? "bg-slate-50" : ""} ${c.profit < 0 ? "bg-red-50/30" : ""}`}
                      style={c.profit < 0 ? { borderLeft: "3px solid #fca5a5" } : { borderLeft: "3px solid transparent" }}
                      onClick={() => setExpandedCase(isExpanded ? null : c.id)}
                    >
                      <td className="px-4 py-3">
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{c.date}</td>
                      <td className="px-4 py-3"><span className="text-xs font-mono text-slate-500">{c.id}</span></td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{c.surgeon}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{c.payer}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-sm text-slate-700 tabular-nums">{c.duration} min</span>
                          <ComparisonPill value={durDiff} unit="min" invert />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{fmt(c.reimbursement)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`text-sm font-semibold tabular-nums ${c.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(c.profit)}</span>
                          <ComparisonPill value={profitDiff} format="currency" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right"><MarginBadge value={margin} /></td>
                    </tr>

                    {/* Expanded row detail */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={9} className="px-8 py-4">
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Room</p>
                              <p className="text-sm font-medium text-slate-700">{c.room}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Reimbursement</p>
                              <p className="text-sm font-medium text-slate-700 tabular-nums">{fmt(c.reimbursement)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Implants & Supplies</p>
                              <p className="text-sm font-medium text-red-600 tabular-nums">({fmt(c.debits)})</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">OR Cost</p>
                              <p className="text-sm font-medium text-red-600 tabular-nums">({fmt(c.orCost)})</p>
                            </div>
                          </div>
                          {/* Mini cost waterfall bar */}
                          <div className="mt-3 flex items-center gap-0.5 h-2.5 rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-l-full" style={{ width: `${(c.debits / c.reimbursement) * 100}%` }} />
                            <div className="h-full bg-amber-400" style={{ width: `${(c.orCost / c.reimbursement) * 100}%` }} />
                            <div className="h-full bg-emerald-400 rounded-r-full" style={{ width: `${(c.profit / c.reimbursement) * 100}%` }} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-center mt-8 pb-4"><p className="text-[10px] text-slate-300 uppercase tracking-widest">ORbit Financial Analytics · Procedure Detail Reference v4</p></div>
      </div>
    </div>
  );
}
