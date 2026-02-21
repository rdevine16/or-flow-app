import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, ComposedChart, Area,
  XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell, ReferenceLine,
  CartesianGrid
} from "recharts";

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

const fmt = (v) => `$${Math.abs(v).toLocaleString()}`;
const fmtK = (v) => Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v.toLocaleString()}`;

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

const MicroBar = ({ value, max, color }) => {
  const pct = Math.min(Math.abs(value) / max * 100, 100);
  return (
    <div className="relative flex items-center gap-2 min-w-[110px]">
      <div className="absolute inset-y-0 left-0 right-10 flex items-center">
        <div className="h-5 rounded-sm opacity-15" style={{ width: `${pct}%`, backgroundColor: color, minWidth: value !== 0 ? "2px" : "0" }} />
      </div>
      <span className="relative font-medium text-sm tabular-nums" style={{ color }}>
        {value < 0 ? `(${fmt(value)})` : fmt(value)}
      </span>
    </div>
  );
};

const MarginDot = ({ margin }) => {
  const c = margin >= 25 ? "#10b981" : margin >= 10 ? "#f59e0b" : "#ef4444";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
      <span className={`text-sm font-medium tabular-nums ${margin < 0 ? "text-red-600" : "text-slate-700"}`}>{margin.toFixed(1)}%</span>
    </span>
  );
};

const RankBadge = ({ rank }) => {
  const styles = rank <= 3
    ? ["bg-amber-400 text-white", "bg-slate-400 text-white", "bg-amber-700 text-white"][rank - 1]
    : "bg-slate-100 text-slate-500";
  return <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0 ${styles}`}>{rank}</span>;
};

const AnimatedNumber = ({ value, prefix = "$", duration = 900 }) => {
  const [disp, setDisp] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      setDisp(Math.round((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value, duration]);
  return <span>{prefix}{disp.toLocaleString()}</span>;
};

// ═══════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════

const secondaryMetrics = [
  { label: "Profit / OR Hour", value: "$1,229", trend: "+8.3%", up: true, spark: [980, 1050, 1100, 1020, 1150, 1180, 1229], detail: "vs $1,135 last month", color: "#3b82f6" },
  { label: "Average Margin", value: "20.7%", trend: "+2.1%", up: true, spark: [16.2, 17.5, 18.1, 19.0, 18.8, 20.1, 20.7], detail: "Target: 22%", color: "#8b5cf6" },
  { label: "Median Profit / Case", value: "$2,010", trend: "-3.4%", up: false, spark: [2200, 2150, 2080, 2100, 2010, 2050, 2010], detail: "vs $2,081 last month", color: "#0ea5e9" },
  { label: "Total OR Hours", value: "62h 55m", trend: "+12.1%", up: true, spark: [48, 52, 55, 50, 58, 60, 63], detail: "44 cases completed", color: "#6366f1" },
];

const procedures = [
  { name: "Mako THA", surgeons: 4, cases: 7, profit: 28198, perHr: 2897, margin: 41.9 },
  { name: "THA", surgeons: 5, cases: 14, profit: 25321, perHr: 1141, margin: 18.8 },
  { name: "Mako TKA", surgeons: 4, cases: 10, profit: 22625, perHr: 1703, margin: 24.4 },
  { name: "TFCC Repair", surgeons: 1, cases: 2, profit: 4525, perHr: 1899, margin: 47.6 },
  { name: "Trigger Finger", surgeons: 1, cases: 2, profit: -75, perHr: -54, margin: -3.1 },
  { name: "Carpal Tunnel", surgeons: 1, cases: 2, profit: -990, perHr: -521, margin: -37.2 },
  { name: "TKA", surgeons: 4, cases: 7, profit: -2290, perHr: -190, margin: -3.5 },
];

const surgeons = [
  { rank: 1, name: "Dr. Berra", lowVol: true, cases: 9, profit: 22340, perHr: 2628, margin: 26.3 },
  { rank: 2, name: "Dr. Swartz", lowVol: false, cases: 11, profit: 22118, perHr: 1266, margin: 21.2 },
  { rank: 3, name: "Dr. Farmer", lowVol: false, cases: 10, profit: 17661, perHr: 1112, margin: 18.8 },
  { rank: 4, name: "Dr. Camp", lowVol: true, cases: 4, profit: 11422, perHr: 1771, margin: 30.0 },
  { rank: 5, name: "Dr. Simmons", lowVol: true, cases: 6, profit: 3460, perHr: 611, margin: 23.8 },
  { rank: 6, name: "Dr. Jensen", lowVol: true, cases: 4, profit: 313, perHr: 35, margin: 0.8 },
];

const dailyProfit = [
  { date: "Feb 2", daily: 18200, cumulative: 18200 },
  { date: "Feb 3", daily: 22400, cumulative: 40600 },
  { date: "Feb 4", daily: 15800, cumulative: 56400 },
  { date: "Feb 5", daily: 12100, cumulative: 68500 },
  { date: "Feb 6", daily: -2400, cumulative: 66100 },
  { date: "Feb 7", daily: 3200, cumulative: 69300 },
  { date: "Feb 10", daily: 4800, cumulative: 74100 },
  { date: "Feb 13", daily: 3214, cumulative: 77314 },
];

// Previous period comparison
const priorPeriod = {
  reimbursement: 342100,
  debits: 208400,
  otherCosts: 61200,
  orCost: 85400,
  netProfit: 68814,
  margin: 18.4,
  cases: 39,
};

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function FinancialOverviewRedesign() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 50); }, []);

  const maxProfit = Math.max(...procedures.map(p => Math.abs(p.profit)));
  const maxSP = Math.max(...surgeons.map(s => s.profit));

  // Cost composition percentages
  const rev = 373789;
  const implants = 227600;
  const other = 68875;
  const orCost = 94375;
  const profit = 77314;
  const implantPct = ((implants / rev) * 100).toFixed(1);
  const otherPct = ((other / rev) * 100).toFixed(1);
  const orPct = ((orCost / rev) * 100).toFixed(1);
  const profitPct = ((profit / rev) * 100).toFixed(1);

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
            <button className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              This Month
              <svg className="w-3.5 h-3.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
          </div>
          <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
            {["Overview", "By Procedure", "By Surgeon"].map((t, i) => (
              <button key={t} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${i === 0 ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{t}</button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* HERO P&L — REDESIGNED TO FILL FULL WIDTH              */}
        {/* ══════════════════════════════════════════════════════ */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm mb-4 transition-all duration-500 delay-100 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>

          <div className="p-6">
            <div className="grid grid-cols-12 gap-6">

              {/* Net Profit hero — col 1-3 */}
              <div className="col-span-3 border-r border-slate-100 pr-6">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Net Profit</p>
                <div className="text-4xl font-bold text-emerald-600 tracking-tight" style={{ fontFeatureSettings: "'tnum'" }}>
                  <AnimatedNumber value={77314} />
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
                    +12.4%
                  </span>
                  <span className="text-xs text-slate-400">vs last month</span>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Margin</span>
                    <span className="font-semibold text-slate-700">20.7%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Per Case</span>
                    <span className="font-semibold text-slate-700">$1,757</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Per OR Hour</span>
                    <span className="font-semibold text-blue-700">$1,229</span>
                  </div>
                </div>
              </div>

              {/* Line items breakdown — col 4-8 */}
              <div className="col-span-5 border-r border-slate-100 pr-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">P&L Breakdown</p>
                  <p className="text-[10px] text-slate-400">44 cases · Feb 1–20</p>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Reimbursement", value: 373789, color: "#3b82f6", sub: "$8,495/case avg", prior: priorPeriod.reimbursement },
                    { label: "Implants & Supplies", value: -227600, color: "#ef4444", sub: "60.9% of revenue", prior: -priorPeriod.debits },
                    { label: "Other Costs", value: -68875, color: "#f97316", sub: "18.4% of revenue", prior: -priorPeriod.otherCosts },
                    { label: "OR Time Cost", value: -94375, color: "#f59e0b", sub: "$1,500/hr × 62.9 hrs", prior: -priorPeriod.orCost },
                  ].map((row, i) => {
                    const pctChange = row.prior !== 0 ? (((Math.abs(row.value) - Math.abs(row.prior)) / Math.abs(row.prior)) * 100) : 0;
                    return (
                      <div key={i} className="group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                            <span className="text-sm text-slate-700">{row.label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-semibold tabular-nums ${row.value < 0 ? "text-red-600" : "text-slate-900"}`}>
                              {row.value < 0 ? `(${fmt(Math.abs(row.value))})` : fmt(row.value)}
                            </span>
                            {/* Period delta */}
                            <span className={`text-[10px] font-medium tabular-nums ${
                              (row.label === "Reimbursement" ? pctChange > 0 : pctChange < 0) ? "text-emerald-600" : 
                              (row.label === "Reimbursement" ? pctChange < 0 : pctChange > 0) ? "text-red-500" : "text-slate-400"
                            }`}>
                              {pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        {/* Proportional bar */}
                        <div className="ml-[18px] mt-1 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(Math.abs(row.value) / 373789) * 100}%`, backgroundColor: row.color, opacity: 0.5 }} />
                          </div>
                          <span className="text-[10px] text-slate-400 w-20 shrink-0">{row.sub}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Period comparison — col 9-12 */}
              <div className="col-span-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">vs Prior Month</p>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Jan 2026 · 39 cases</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Revenue", current: 373789, prior: 342100, prefix: "$", up: true },
                    { label: "Total Costs", current: 296475, prior: 273286, prefix: "$", up: false },
                    { label: "Profit", current: 77314, prior: 68814, prefix: "$", up: true },
                    { label: "Margin", current: 20.7, prior: 18.4, suffix: "%", up: true },
                    { label: "Cases", current: 44, prior: 39, up: true },
                    { label: "Profit/Case", current: 1757, prior: 1764, prefix: "$", up: false },
                  ].map((m, i) => {
                    const delta = m.suffix === "%" ? m.current - m.prior : ((m.current - m.prior) / m.prior) * 100;
                    const positive = delta > 0;
                    const good = m.up ? positive : !positive;
                    return (
                      <div key={i} className="rounded-lg bg-slate-50/80 p-2.5 hover:bg-slate-100/80 transition-colors">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{m.label}</p>
                        <div className="flex items-end justify-between mt-1">
                          <span className="text-sm font-bold text-slate-800 tabular-nums">
                            {m.prefix || ""}{typeof m.current === "number" && m.current >= 1000 ? m.current.toLocaleString() : m.current}{m.suffix || ""}
                          </span>
                          <span className={`text-[10px] font-semibold tabular-nums ${good ? "text-emerald-600" : positive ? "text-red-500" : "text-red-500"}`}>
                            {positive ? "+" : ""}{delta.toFixed(m.suffix === "%" ? 1 : 1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Composition bar — compact footer */}
          <div className="px-6 pb-5 pt-4 mt-2 border-t border-slate-100">
            <div className="flex items-center gap-4">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider shrink-0">Revenue Split</p>
              <div className="flex-1 flex items-center h-4 rounded-full overflow-hidden">
                <div className="h-full bg-red-400 transition-all duration-700 flex items-center justify-center" style={{ width: `${implantPct}%` }}>
                  <span className="text-[8px] font-bold text-white/80">{implantPct}%</span>
                </div>
                <div className="h-full bg-orange-400 transition-all duration-700 flex items-center justify-center" style={{ width: `${otherPct}%` }}>
                  <span className="text-[8px] font-bold text-white/80">{otherPct}%</span>
                </div>
                <div className="h-full bg-amber-400 transition-all duration-700 flex items-center justify-center" style={{ width: `${orPct}%` }}>
                  <span className="text-[8px] font-bold text-white/80">{orPct}%</span>
                </div>
                <div className="h-full bg-emerald-500 transition-all duration-700 rounded-r-full flex items-center justify-center" style={{ width: `${profitPct}%` }}>
                  <span className="text-[8px] font-bold text-white/90">{profitPct}%</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Implants</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />Other</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />OR</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Profit</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* SECONDARY METRICS — Same as before              */}
        {/* ══════════════════════════════════════════════ */}
        <div className={`grid grid-cols-4 gap-3 mb-4 transition-all duration-500 delay-200 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          {secondaryMetrics.map((m, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-slate-300 transition-all group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-medium mb-1.5">{m.label}</p>
                  <p className="text-xl font-semibold text-slate-900 tracking-tight">{m.value}</p>
                </div>
                <div className="ml-2 opacity-60 group-hover:opacity-100 transition-opacity"><Sparkline data={m.spark} color={m.color} /></div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${m.up ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>
                  <svg className={`w-2.5 h-2.5 ${m.up ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
                  {m.trend}
                </span>
                <span className="text-xs text-slate-400">{m.detail}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* TABLES — Same as before                         */}
        {/* ══════════════════════════════════════════════ */}
        <div className={`grid grid-cols-2 gap-4 mb-4 transition-all duration-500 delay-300 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          {/* Procedures */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">Top Procedures</h3></div>
            <div className="divide-y divide-slate-50">
              <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                <div className="col-span-4">Procedure</div><div className="col-span-1 text-center">Cases</div><div className="col-span-3">Profit</div><div className="col-span-2 text-right">$/OR Hr</div><div className="col-span-2 text-right">Margin</div>
              </div>
              {procedures.map((p, i) => {
                const loss = p.profit < 0;
                return (
                  <div key={i} className={`grid grid-cols-12 items-center px-5 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer group ${loss ? "bg-red-50/30" : ""}`} style={loss ? { borderLeft: "3px solid #fca5a5" } : { borderLeft: "3px solid transparent" }}>
                    <div className="col-span-4"><span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{p.name}</span><span className="text-[10px] text-slate-400 ml-1.5">{p.surgeons}s</span></div>
                    <div className="col-span-1 text-center text-sm text-slate-600 tabular-nums">{p.cases}</div>
                    <div className="col-span-3"><MicroBar value={p.profit} max={maxProfit} color={loss ? "#ef4444" : "#10b981"} /></div>
                    <div className={`col-span-2 text-right text-sm tabular-nums ${loss ? "text-red-500" : "text-slate-600"}`}>{p.perHr < 0 ? `($${Math.abs(p.perHr)})` : `$${p.perHr.toLocaleString()}`}</div>
                    <div className="col-span-2 text-right"><MarginDot margin={p.margin} /></div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Surgeons */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">Top Surgeons</h3></div>
            <div className="divide-y divide-slate-50">
              <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                <div className="col-span-4">Surgeon</div><div className="col-span-1 text-center">Cases</div><div className="col-span-3">Profit</div><div className="col-span-2 text-right">$/OR Hr</div><div className="col-span-2 text-right">Margin</div>
              </div>
              {surgeons.map((s, i) => (
                <div key={i} className="grid grid-cols-12 items-center px-5 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer group">
                  <div className="col-span-4 flex items-center gap-2.5">
                    <RankBadge rank={s.rank} />
                    <div><span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{s.name}</span>
                      {s.lowVol && <span className="ml-1.5 text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Low vol</span>}
                    </div>
                  </div>
                  <div className="col-span-1 text-center text-sm text-slate-600 tabular-nums">{s.cases}</div>
                  <div className="col-span-3"><MicroBar value={s.profit} max={maxSP} color="#3b82f6" /></div>
                  <div className="col-span-2 text-right text-sm text-slate-600 tabular-nums">${s.perHr.toLocaleString()}</div>
                  <div className="col-span-2 text-right"><MarginDot margin={s.margin} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* PROFIT TREND — Same as before                   */}
        {/* ══════════════════════════════════════════════ */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-6 transition-all duration-500 delay-[400ms] ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          <div className="flex items-start justify-between mb-4">
            <div><h3 className="text-sm font-semibold text-slate-900">Profit Trend</h3><p className="text-xs text-slate-400 mt-0.5">Daily profit with cumulative trajectory</p></div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 rounded-full" />Daily</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 rounded-full" />Cumulative</span>
              <span className="flex items-center gap-1.5"><span className="w-6 h-0 border-t border-dashed border-slate-300" />Target</span>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyProfit} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} dy={8} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={44} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} domain={[0, 100000]} width={44} />
                <ReTooltip contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)", fontSize: "12px" }} formatter={(v, n) => [`$${v.toLocaleString()}`, n === "daily" ? "Daily" : "Cumulative"]} />
                <ReferenceLine yAxisId="right" y={95000} stroke="#94a3b8" strokeDasharray="6 3" strokeWidth={1} />
                <Area yAxisId="right" type="monotone" dataKey="cumulative" stroke="#3b82f6" strokeWidth={2} fill="url(#cg)" dot={{ r: 3, fill: "#3b82f6", stroke: "white", strokeWidth: 2 }} />
                <Bar yAxisId="left" dataKey="daily" radius={[4, 4, 0, 0]} maxBarSize={32}>{dailyProfit.map((d, i) => <Cell key={i} fill={d.daily >= 0 ? "#10b981" : "#ef4444"} opacity={0.75} />)}</Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-500">Monthly target progress</span><span className="text-xs font-medium text-slate-700 tabular-nums">$77,314 / $95,000 <span className="text-slate-400">(81.4%)</span></span></div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: "81.4%", background: "linear-gradient(90deg, #3b82f6, #10b981)" }} /></div>
            <div className="flex justify-between mt-1.5"><span className="text-[10px] text-slate-400">$17,686 remaining · 8 operating days left</span><span className="text-[10px] text-slate-400">~$2,211/day needed</span></div>
          </div>
        </div>

        <div className="text-center mt-8 pb-4"><p className="text-[10px] text-slate-300 uppercase tracking-widest">ORbit Financial Analytics · Overview v5</p></div>
      </div>
    </div>
  );
}
