import { useState, useEffect, useRef, useMemo } from "react";
import {
  BarChart, Bar, ComposedChart, Area,
  XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts";

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

const fmt = (v) => `$${Math.abs(v).toLocaleString()}`;
const fmtK = (v) => Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v.toLocaleString()}`;
const fmtPct = (v) => v === null ? "—" : `${v.toFixed(1)}%`;
const fmtDur = (m) => m === null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`;
const fmtTime = (h, m) => { const suffix = h >= 12 ? "PM" : "AM"; const dh = h > 12 ? h - 12 : h === 0 ? 12 : h; return `${dh}:${String(m).padStart(2, "0")} ${suffix}`; };

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

const MarginBadge = ({ value }) => {
  const c = value >= 30 ? "bg-green-50 text-green-600" : value >= 15 ? "bg-amber-50 text-amber-700" : value >= 0 ? "bg-red-50 text-red-600" : "bg-red-100 text-red-800";
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${c}`}>{fmtPct(value)}</span>;
};

const MarginBar = ({ value }) => {
  const w = Math.min(Math.max(value, 0), 100);
  const c = value >= 30 ? "bg-green-500" : value >= 15 ? "bg-amber-500" : "bg-red-500";
  return <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${c}`} style={{ width: `${w}%` }} /></div>;
};

const ConsistencyBadge = ({ rating, size = "sm" }) => {
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

const RankBadge = ({ rank }) => {
  const styles = rank <= 3
    ? ["bg-amber-400 text-white", "bg-slate-400 text-white", "bg-amber-700 text-white"][rank - 1]
    : "bg-slate-100 text-slate-500";
  return <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0 ${styles}`}>{rank}</span>;
};

const AnimatedNumber = ({ value, prefix = "$", duration = 800 }) => {
  const [disp, setDisp] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => { const p = Math.min((now - start) / duration, 1); setDisp(Math.round((1 - Math.pow(1 - p, 3)) * value)); if (p < 1) ref.current = requestAnimationFrame(tick); };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value, duration]);
  return <span>{prefix}{disp.toLocaleString()}</span>;
};

// Chevron icons
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

const InfoTip = ({ text }) => (
  <div className="group relative inline-flex">
    <svg className="w-3.5 h-3.5 text-slate-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal z-50 min-w-[180px] max-w-xs text-center shadow-lg normal-case tracking-normal font-normal">{text}</div>
  </div>
);

// ═══════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════

const procedures = [
  { id: "p1", name: "Mako THA", surgeonCount: 4, caseCount: 7, totalProfit: 28198, medianProfit: 3800, avgProfit: 4028, profitPerORHour: 2897, avgMarginPercent: 41.9, medianDurationMinutes: 85, avgDurationMinutes: 88, totalReimbursement: 67200, totalDebits: 28400, totalCredits: 0, totalORCost: 10602,
    profitRange: { p25: 2800, p75: 5200 }, durationRange: { p25: 78, p75: 95 },
    surgeonBreakdown: [
      { surgeonId: "s1", surgeonName: "Dr. Berra", caseCount: 3, totalProfit: 12800, medianProfit: 4100, avgProfit: 4267, profitPerORHour: 3200, medianDurationMinutes: 80, avgDurationMinutes: 82, durationVsFacilityMinutes: -5, profitImpact: 125, consistencyRating: "high" },
      { surgeonId: "s2", surgeonName: "Dr. Swartz", caseCount: 2, totalProfit: 8400, medianProfit: 4200, avgProfit: 4200, profitPerORHour: 2800, medianDurationMinutes: 88, avgDurationMinutes: 90, durationVsFacilityMinutes: 3, profitImpact: -75, consistencyRating: "medium" },
      { surgeonId: "s3", surgeonName: "Dr. Farmer", caseCount: 1, totalProfit: 3800, medianProfit: 3800, avgProfit: 3800, profitPerORHour: 2500, medianDurationMinutes: 92, avgDurationMinutes: 92, durationVsFacilityMinutes: 7, profitImpact: -175, consistencyRating: null },
      { surgeonId: "s4", surgeonName: "Dr. Camp", caseCount: 1, totalProfit: 3198, medianProfit: 3198, avgProfit: 3198, profitPerORHour: 2600, medianDurationMinutes: 84, avgDurationMinutes: 84, durationVsFacilityMinutes: -1, profitImpact: 25, consistencyRating: null },
    ]
  },
  { id: "p2", name: "THA", surgeonCount: 5, caseCount: 14, totalProfit: 25321, medianProfit: 1800, avgProfit: 1809, profitPerORHour: 1141, avgMarginPercent: 18.8, medianDurationMinutes: 95, avgDurationMinutes: 98, totalReimbursement: 134400, totalDebits: 85200, totalCredits: 0, totalORCost: 23879,
    profitRange: { p25: 900, p75: 2600 }, durationRange: { p25: 88, p75: 108 },
    surgeonBreakdown: [
      { surgeonId: "s2", surgeonName: "Dr. Swartz", caseCount: 4, totalProfit: 8200, medianProfit: 2050, avgProfit: 2050, profitPerORHour: 1300, medianDurationMinutes: 92, avgDurationMinutes: 94, durationVsFacilityMinutes: -3, profitImpact: 75, consistencyRating: "high" },
      { surgeonId: "s3", surgeonName: "Dr. Farmer", caseCount: 4, totalProfit: 7200, medianProfit: 1800, avgProfit: 1800, profitPerORHour: 1050, medianDurationMinutes: 98, avgDurationMinutes: 100, durationVsFacilityMinutes: 3, profitImpact: -50, consistencyRating: "medium" },
      { surgeonId: "s1", surgeonName: "Dr. Berra", caseCount: 3, totalProfit: 5400, medianProfit: 1800, avgProfit: 1800, profitPerORHour: 1100, medianDurationMinutes: 96, avgDurationMinutes: 96, durationVsFacilityMinutes: 1, profitImpact: -25, consistencyRating: "medium" },
      { surgeonId: "s5", surgeonName: "Dr. Simmons", caseCount: 2, totalProfit: 2800, medianProfit: 1400, avgProfit: 1400, profitPerORHour: 900, medianDurationMinutes: 102, avgDurationMinutes: 102, durationVsFacilityMinutes: 7, profitImpact: -175, consistencyRating: "low" },
      { surgeonId: "s6", surgeonName: "Dr. Jensen", caseCount: 1, totalProfit: 1721, medianProfit: 1721, avgProfit: 1721, profitPerORHour: 1000, medianDurationMinutes: 100, avgDurationMinutes: 100, durationVsFacilityMinutes: 5, profitImpact: -125, consistencyRating: null },
    ]
  },
  { id: "p3", name: "Mako TKA", surgeonCount: 4, caseCount: 10, totalProfit: 22625, medianProfit: 2200, avgProfit: 2263, profitPerORHour: 1703, avgMarginPercent: 24.4, medianDurationMinutes: 78, avgDurationMinutes: 80, totalReimbursement: 92800, totalDebits: 52400, totalCredits: 0, totalORCost: 17775,
    profitRange: { p25: 1600, p75: 2900 }, durationRange: { p25: 72, p75: 86 },
    surgeonBreakdown: [
      { surgeonId: "s3", surgeonName: "Dr. Farmer", caseCount: 4, totalProfit: 9600, medianProfit: 2400, avgProfit: 2400, profitPerORHour: 1850, medianDurationMinutes: 75, avgDurationMinutes: 76, durationVsFacilityMinutes: -3, profitImpact: 75, consistencyRating: "high" },
      { surgeonId: "s2", surgeonName: "Dr. Swartz", caseCount: 3, totalProfit: 7200, medianProfit: 2400, avgProfit: 2400, profitPerORHour: 1700, medianDurationMinutes: 80, avgDurationMinutes: 80, durationVsFacilityMinutes: 2, profitImpact: -50, consistencyRating: "medium" },
      { surgeonId: "s1", surgeonName: "Dr. Berra", caseCount: 2, totalProfit: 4200, medianProfit: 2100, avgProfit: 2100, profitPerORHour: 1600, medianDurationMinutes: 82, avgDurationMinutes: 82, durationVsFacilityMinutes: 4, profitImpact: -100, consistencyRating: "medium" },
      { surgeonId: "s4", surgeonName: "Dr. Camp", caseCount: 1, totalProfit: 1625, medianProfit: 1625, avgProfit: 1625, profitPerORHour: 1400, medianDurationMinutes: 84, avgDurationMinutes: 84, durationVsFacilityMinutes: 6, profitImpact: -150, consistencyRating: null },
    ]
  },
  { id: "p4", name: "TFCC Repair", surgeonCount: 1, caseCount: 2, totalProfit: 4525, medianProfit: 2263, avgProfit: 2263, profitPerORHour: 1899, avgMarginPercent: 47.6, medianDurationMinutes: 65, avgDurationMinutes: 65, totalReimbursement: 9500, totalDebits: 3200, totalCredits: 0, totalORCost: 1775,
    profitRange: { p25: 2100, p75: 2425 }, durationRange: { p25: 62, p75: 68 },
    surgeonBreakdown: [{ surgeonId: "s4", surgeonName: "Dr. Camp", caseCount: 2, totalProfit: 4525, medianProfit: 2263, avgProfit: 2263, profitPerORHour: 1899, medianDurationMinutes: 65, avgDurationMinutes: 65, durationVsFacilityMinutes: 0, profitImpact: 0, consistencyRating: "high" }]
  },
  { id: "p5", name: "Trigger Finger", surgeonCount: 1, caseCount: 2, totalProfit: -75, medianProfit: -38, avgProfit: -38, profitPerORHour: -54, avgMarginPercent: -3.1, medianDurationMinutes: 35, avgDurationMinutes: 35, totalReimbursement: 2400, totalDebits: 1200, totalCredits: 0, totalORCost: 1275,
    profitRange: { p25: -50, p75: -25 }, durationRange: { p25: 33, p75: 37 },
    surgeonBreakdown: [{ surgeonId: "s5", surgeonName: "Dr. Simmons", caseCount: 2, totalProfit: -75, medianProfit: -38, avgProfit: -38, profitPerORHour: -54, medianDurationMinutes: 35, avgDurationMinutes: 35, durationVsFacilityMinutes: 0, profitImpact: 0, consistencyRating: "medium" }]
  },
  { id: "p6", name: "Carpal Tunnel", surgeonCount: 1, caseCount: 2, totalProfit: -990, medianProfit: -495, avgProfit: -495, profitPerORHour: -521, avgMarginPercent: -37.2, medianDurationMinutes: 40, avgDurationMinutes: 40, totalReimbursement: 2660, totalDebits: 1900, totalCredits: 0, totalORCost: 1750,
    profitRange: { p25: -520, p75: -470 }, durationRange: { p25: 38, p75: 42 },
    surgeonBreakdown: [{ surgeonId: "s5", surgeonName: "Dr. Simmons", caseCount: 2, totalProfit: -990, medianProfit: -495, avgProfit: -495, profitPerORHour: -521, medianDurationMinutes: 40, avgDurationMinutes: 40, durationVsFacilityMinutes: 0, profitImpact: 0, consistencyRating: "high" }]
  },
  { id: "p7", name: "TKA", surgeonCount: 4, caseCount: 7, totalProfit: -2290, medianProfit: -327, avgProfit: -327, profitPerORHour: -190, avgMarginPercent: -3.5, medianDurationMinutes: 90, avgDurationMinutes: 92, totalReimbursement: 65400, totalDebits: 48200, totalCredits: 0, totalORCost: 19490,
    profitRange: { p25: -600, p75: 100 }, durationRange: { p25: 84, p75: 98 },
    surgeonBreakdown: [
      { surgeonId: "s6", surgeonName: "Dr. Jensen", caseCount: 3, totalProfit: -1408, medianProfit: -470, avgProfit: -469, profitPerORHour: -280, medianDurationMinutes: 95, avgDurationMinutes: 96, durationVsFacilityMinutes: 5, profitImpact: -125, consistencyRating: "low" },
      { surgeonId: "s4", surgeonName: "Dr. Camp", caseCount: 2, totalProfit: -500, medianProfit: -250, avgProfit: -250, profitPerORHour: -150, medianDurationMinutes: 88, avgDurationMinutes: 88, durationVsFacilityMinutes: -2, profitImpact: 50, consistencyRating: "medium" },
      { surgeonId: "s5", surgeonName: "Dr. Simmons", caseCount: 2, totalProfit: -382, medianProfit: -191, avgProfit: -191, profitPerORHour: -100, medianDurationMinutes: 86, avgDurationMinutes: 86, durationVsFacilityMinutes: -4, profitImpact: 100, consistencyRating: "high" },
    ]
  },
];

const surgeons = [
  { id: "s1", name: "Dr. Berra", lowVol: true, caseCount: 9, totalProfit: 22340, medianProfit: 3200, avgProfit: 2482, profitPerORHour: 2628, avgMarginPercent: 26.3, durationVsFacilityMinutes: -2, profitImpact: 50, procedureCount: 3,
    sparkProfit: [1800, 2200, 3800, 2600, 4100, 2100, 3200, 1800, 2740],
    procedureBreakdown: [
      { procedureId: "p1", procedureName: "Mako THA", caseCount: 3, totalProfit: 12800, medianDuration: 80 },
      { procedureId: "p2", procedureName: "THA", caseCount: 4, totalProfit: 5400, medianDuration: 96 },
      { procedureId: "p3", procedureName: "Mako TKA", caseCount: 2, totalProfit: 4200, medianDuration: 82 },
    ],
    dailyStats: [
      { date: "Feb 5", dow: "Wed", cases: 3, totalProfit: 8200, totalDuration: 268, avgProfit: 2733 },
      { date: "Feb 3", dow: "Mon", cases: 3, totalProfit: 7800, totalDuration: 255, avgProfit: 2600 },
      { date: "Feb 13", dow: "Thu", cases: 3, totalProfit: 6340, totalDuration: 250, avgProfit: 2113 },
    ],
    costBreakdown: { avgReimbursement: 8500, avgDebits: 4200, avgCredits: 0, avgORCost: 1818, avgProfit: 2482 },
    efficiency: { medianDuration: 85, consistencyRating: "high", avgSurgicalTime: 62 }
  },
  { id: "s2", name: "Dr. Swartz", lowVol: false, caseCount: 11, totalProfit: 22118, medianProfit: 2050, avgProfit: 2011, profitPerORHour: 1266, avgMarginPercent: 21.2, durationVsFacilityMinutes: 1, profitImpact: -25, procedureCount: 3,
    sparkProfit: [1600, 2400, 2050, 1800, 2200, 2400, 1900, 2050, 2100, 1800, 1798],
    procedureBreakdown: [
      { procedureId: "p1", procedureName: "Mako THA", caseCount: 2, totalProfit: 8400, medianDuration: 88 },
      { procedureId: "p2", procedureName: "THA", caseCount: 4, totalProfit: 8200, medianDuration: 92 },
      { procedureId: "p3", procedureName: "Mako TKA", caseCount: 3, totalProfit: 7200, medianDuration: 80 },
    ],
    dailyStats: [
      { date: "Feb 4", dow: "Tue", cases: 4, totalProfit: 8400, totalDuration: 365, avgProfit: 2100 },
      { date: "Feb 2", dow: "Mon", cases: 4, totalProfit: 7500, totalDuration: 350, avgProfit: 1875 },
      { date: "Feb 5", dow: "Wed", cases: 3, totalProfit: 6218, totalDuration: 280, avgProfit: 2073 },
    ],
    costBreakdown: { avgReimbursement: 9500, avgDebits: 5400, avgCredits: 0, avgORCost: 2089, avgProfit: 2011 },
    efficiency: { medianDuration: 88, consistencyRating: "medium", avgSurgicalTime: 65 }
  },
  { id: "s3", name: "Dr. Farmer", lowVol: false, caseCount: 10, totalProfit: 17661, medianProfit: 1800, avgProfit: 1766, profitPerORHour: 1112, avgMarginPercent: 18.8, durationVsFacilityMinutes: 2, profitImpact: -50, procedureCount: 3,
    sparkProfit: [1500, 1800, 2400, 1600, 2000, 1800, 1400, 2400, 1600, 1861],
    procedureBreakdown: [
      { procedureId: "p3", procedureName: "Mako TKA", caseCount: 4, totalProfit: 9600, medianDuration: 75 },
      { procedureId: "p2", procedureName: "THA", caseCount: 4, totalProfit: 7200, medianDuration: 98 },
      { procedureId: "p1", procedureName: "Mako THA", caseCount: 1, totalProfit: 3800, medianDuration: 92 },
    ],
    dailyStats: [
      { date: "Feb 2", dow: "Mon", cases: 3, totalProfit: 6200, totalDuration: 275, avgProfit: 2067 },
      { date: "Feb 4", dow: "Tue", cases: 4, totalProfit: 7200, totalDuration: 340, avgProfit: 1800 },
      { date: "Feb 5", dow: "Wed", cases: 3, totalProfit: 4261, totalDuration: 260, avgProfit: 1420 },
    ],
    costBreakdown: { avgReimbursement: 9400, avgDebits: 5600, avgCredits: 0, avgORCost: 2034, avgProfit: 1766 },
    efficiency: { medianDuration: 88, consistencyRating: "medium", avgSurgicalTime: 68 }
  },
  { id: "s4", name: "Dr. Camp", lowVol: true, caseCount: 4, totalProfit: 11422, medianProfit: 2412, avgProfit: 2856, profitPerORHour: 1771, avgMarginPercent: 30.0, durationVsFacilityMinutes: -1, profitImpact: 25, procedureCount: 3,
    sparkProfit: [3198, 1625, 2263, 4336],
    procedureBreakdown: [
      { procedureId: "p4", procedureName: "TFCC Repair", caseCount: 2, totalProfit: 4525, medianDuration: 65 },
      { procedureId: "p1", procedureName: "Mako THA", caseCount: 1, totalProfit: 3198, medianDuration: 84 },
      { procedureId: "p7", procedureName: "TKA", caseCount: 1, totalProfit: -500, medianDuration: 88 },
    ],
    dailyStats: [
      { date: "Feb 3", dow: "Mon", cases: 2, totalProfit: 6723, totalDuration: 150, avgProfit: 3362 },
      { date: "Feb 13", dow: "Thu", cases: 2, totalProfit: 4699, totalDuration: 155, avgProfit: 2350 },
    ],
    costBreakdown: { avgReimbursement: 9500, avgDebits: 4800, avgCredits: 0, avgORCost: 1844, avgProfit: 2856 },
    efficiency: { medianDuration: 76, consistencyRating: "medium", avgSurgicalTime: 52 }
  },
  { id: "s5", name: "Dr. Simmons", lowVol: true, caseCount: 6, totalProfit: 3460, medianProfit: 577, avgProfit: 577, profitPerORHour: 611, avgMarginPercent: 23.8, durationVsFacilityMinutes: 3, profitImpact: -75, procedureCount: 4,
    sparkProfit: [1400, -38, -495, 1400, -191, 1384],
    procedureBreakdown: [
      { procedureId: "p2", procedureName: "THA", caseCount: 2, totalProfit: 2800, medianDuration: 102 },
      { procedureId: "p5", procedureName: "Trigger Finger", caseCount: 2, totalProfit: -75, medianDuration: 35 },
      { procedureId: "p6", procedureName: "Carpal Tunnel", caseCount: 2, totalProfit: -990, medianDuration: 40 },
    ],
    dailyStats: [
      { date: "Feb 2", dow: "Mon", cases: 3, totalProfit: 2100, totalDuration: 175, avgProfit: 700 },
      { date: "Feb 3", dow: "Mon", cases: 3, totalProfit: 1360, totalDuration: 170, avgProfit: 453 },
    ],
    costBreakdown: { avgReimbursement: 4100, avgDebits: 2500, avgCredits: 0, avgORCost: 1023, avgProfit: 577 },
    efficiency: { medianDuration: 58, consistencyRating: "low", avgSurgicalTime: 38 }
  },
  { id: "s6", name: "Dr. Jensen", lowVol: true, caseCount: 4, totalProfit: 313, medianProfit: 78, avgProfit: 78, profitPerORHour: 35, avgMarginPercent: 0.8, durationVsFacilityMinutes: 5, profitImpact: -125, procedureCount: 2,
    sparkProfit: [1721, -470, -470, -468],
    procedureBreakdown: [
      { procedureId: "p2", procedureName: "THA", caseCount: 1, totalProfit: 1721, medianDuration: 100 },
      { procedureId: "p7", procedureName: "TKA", caseCount: 3, totalProfit: -1408, medianDuration: 95 },
    ],
    dailyStats: [
      { date: "Feb 3", dow: "Mon", cases: 2, totalProfit: 1251, totalDuration: 195, avgProfit: 626 },
      { date: "Feb 4", dow: "Tue", cases: 2, totalProfit: -938, totalDuration: 190, avgProfit: -469 },
    ],
    costBreakdown: { avgReimbursement: 8200, avgDebits: 5900, avgCredits: 0, avgORCost: 2222, avgProfit: 78 },
    efficiency: { medianDuration: 96, consistencyRating: "low", avgSurgicalTime: 72 }
  },
];

const dayCases = {
  "s1-Feb 5": [
    { id: "c1", num: "ORB-2026-089", proc: "Mako THA", room: "OR 1", start: [7, 15], dur: 88, surgDur: 62, profit: 4100, medianDur: 85, medianProfit: 3200, phases: { preOp: 12, surgical: 62, closing: 8, emergence: 6 } },
    { id: "c2", num: "ORB-2026-090", proc: "THA", room: "OR 1", start: [9, 30], dur: 96, surgDur: 68, profit: 1800, medianDur: 96, medianProfit: 1800, phases: { preOp: 14, surgical: 68, closing: 9, emergence: 5 } },
    { id: "c3", num: "ORB-2026-091", proc: "Mako TKA", room: "OR 3", start: [12, 0], dur: 84, surgDur: 58, profit: 2300, medianDur: 82, medianProfit: 2100, phases: { preOp: 11, surgical: 58, closing: 10, emergence: 5 } },
  ],
};

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

const secondaryMetrics = [
  { label: "Profit / OR Hour", value: "$1,229", trend: "+8.3%", up: true, spark: [980, 1050, 1100, 1020, 1150, 1180, 1229], detail: "vs $1,135 last month", color: "#3b82f6" },
  { label: "Average Margin", value: "20.7%", trend: "+2.1%", up: true, spark: [16.2, 17.5, 18.1, 19.0, 18.8, 20.1, 20.7], detail: "Target: 22%", color: "#8b5cf6" },
  { label: "Median Profit / Case", value: "$2,010", trend: "-3.4%", up: false, spark: [2200, 2150, 2080, 2100, 2010, 2050, 2010], detail: "vs $2,081 last month", color: "#0ea5e9" },
  { label: "Total OR Hours", value: "62h 55m", trend: "+12.1%", up: true, spark: [48, 52, 55, 50, 58, 60, 63], detail: "44 cases completed", color: "#6366f1" },
];

// ═══════════════════════════════════════════════════
// WATERFALL
// ═══════════════════════════════════════════════════

const WaterfallChart = () => {
  const steps = [
    { label: "Revenue", value: 373789, color: "#3b82f6" },
    { label: "Implants", value: 227600, color: "#ef4444" },
    { label: "Other", value: 68875, color: "#f97316" },
    { label: "OR Cost", value: 94375, color: "#f59e0b" },
  ];
  const net = 77314, maxVal = 373789, chartH = 120, barW = 48, gap = 20;
  let running = 373789;
  const bars = [{ label: "Revenue", y: 0, h: 373789, color: "#3b82f6", value: 373789 }];
  for (let i = 1; i < steps.length; i++) { const nr = running - steps[i].value; bars.push({ label: steps[i].label, y: nr, h: steps[i].value, color: steps[i].color, value: steps[i].value }); running = nr; }
  const totalW = (bars.length + 1) * barW + bars.length * gap + 40;
  const scale = (v) => (v / maxVal) * chartH;

  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={chartH + 40} className="mx-auto block">
        {bars.map((b, i) => {
          const x = 20 + i * (barW + gap), barH = scale(b.h), barY = chartH - scale(b.y) - barH;
          return (
            <g key={i}>
              <rect x={x} y={barY} width={barW} height={barH} rx="3" fill={b.color} opacity={0.85} />
              <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" style={{ fontSize: 9 }} className="fill-slate-500">{b.label}</text>
              <text x={x + barW / 2} y={barY - 5} textAnchor="middle" style={{ fontSize: 9 }} className="fill-slate-600 font-medium">{i === 0 ? "" : "-"}{fmtK(b.value)}</text>
            </g>
          );
        })}
        {(() => { const x = 20 + bars.length * (barW + gap), barH = scale(net), barY = chartH - barH; return (
          <g><rect x={x} y={barY} width={barW} height={barH} rx="3" fill="#10b981" opacity={0.9} />
          <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" style={{ fontSize: 10 }} className="fill-emerald-700 font-semibold">Profit</text>
          <text x={x + barW / 2} y={barY - 5} textAnchor="middle" style={{ fontSize: 10 }} className="fill-emerald-700 font-semibold">{fmtK(net)}</text></g>
        );})()}
      </svg>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// BREADCRUMB
// ═══════════════════════════════════════════════════

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
// OVERVIEW TAB
// ═══════════════════════════════════════════════════

function OverviewTab({ onProcedureClick, onSurgeonClick }) {
  const maxProfit = Math.max(...procedures.map(p => Math.abs(p.totalProfit)));
  const maxSP = Math.max(...surgeons.map(s => s.totalProfit));

  return (
    <div className="space-y-4">
      {/* Hero P&L */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="grid grid-cols-12 gap-6 items-center">
          <div className="col-span-4 border-r border-slate-100 pr-6">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Net Profit</p>
            <div className="text-4xl font-bold text-emerald-600 tracking-tight"><AnimatedNumber value={77314} /></div>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>+12.4%
              </span>
              <span className="text-xs text-slate-400">vs last month</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <span>20.7% margin</span><span className="text-slate-200">·</span><span>$1,757/case</span>
            </div>
          </div>
          <div className="col-span-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Revenue → Profit Flow</p>
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                {[["Revenue","bg-blue-500"],["Implants","bg-red-500"],["Other","bg-orange-500"],["OR Cost","bg-amber-500"],["Profit","bg-emerald-500"]].map(([l,c])=>(
                  <span key={l} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-sm ${c}`} />{l}</span>
                ))}
              </div>
            </div>
            <WaterfallChart />
          </div>
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-4 gap-3">
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
                <svg className={`w-2.5 h-2.5 ${m.up ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>{m.trend}
              </span>
              <span className="text-xs text-slate-400">{m.detail}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tables */}
      <div className="grid grid-cols-2 gap-4">
        {/* Procedures */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">Top Procedures</h3></div>
          <div className="divide-y divide-slate-50">
            <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              <div className="col-span-4">Procedure</div><div className="col-span-1 text-center">Cases</div><div className="col-span-3">Profit</div><div className="col-span-2 text-right">$/OR Hr</div><div className="col-span-2 text-right">Margin</div>
            </div>
            {procedures.map((p, i) => {
              const loss = p.totalProfit < 0;
              return (
                <div key={p.id} onClick={() => onProcedureClick(p.id)} className={`grid grid-cols-12 items-center px-5 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer group ${loss ? "bg-red-50/30" : ""}`} style={loss ? { borderLeft: "3px solid #fca5a5" } : { borderLeft: "3px solid transparent" }}>
                  <div className="col-span-4"><span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{p.name}</span><span className="text-[10px] text-slate-400 ml-1.5">{p.surgeonCount}s</span></div>
                  <div className="col-span-1 text-center text-sm text-slate-600 tabular-nums">{p.caseCount}</div>
                  <div className="col-span-3"><MicroBar value={p.totalProfit} max={maxProfit} color={loss ? "#ef4444" : "#10b981"} /></div>
                  <div className={`col-span-2 text-right text-sm tabular-nums ${loss ? "text-red-500" : "text-slate-600"}`}>{p.profitPerORHour < 0 ? `($${Math.abs(p.profitPerORHour).toLocaleString()})` : `$${p.profitPerORHour.toLocaleString()}`}</div>
                  <div className="col-span-2 text-right"><MarginDot margin={p.avgMarginPercent} /></div>
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
              <div key={s.id} onClick={() => onSurgeonClick(s.id)} className="grid grid-cols-12 items-center px-5 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer group">
                <div className="col-span-4 flex items-center gap-2.5">
                  <RankBadge rank={i + 1} />
                  <div><span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{s.name}</span>
                    {s.lowVol && <span className="ml-1.5 text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Low vol</span>}
                  </div>
                </div>
                <div className="col-span-1 text-center text-sm text-slate-600 tabular-nums">{s.caseCount}</div>
                <div className="col-span-3"><MicroBar value={s.totalProfit} max={maxSP} color="#3b82f6" /></div>
                <div className="col-span-2 text-right text-sm text-slate-600 tabular-nums">${s.profitPerORHour.toLocaleString()}</div>
                <div className="col-span-2 text-right"><MarginDot margin={s.avgMarginPercent} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cumulative trend */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
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
    </div>
  );
}

// ═══════════════════════════════════════════════════
// PROCEDURE TAB
// ═══════════════════════════════════════════════════

function ProcedureTab({ selectedProcedure, onProcedureSelect }) {
  const [sortKey, setSortKey] = useState("totalProfit");
  const [sortDir, setSortDir] = useState("desc");
  const toggle = (k) => { if (sortKey === k) setSortDir(d => d === "desc" ? "asc" : "desc"); else { setSortKey(k); setSortDir("desc"); } };

  const sorted = useMemo(() => {
    const key = (p) => { const m = { totalProfit: p.totalProfit, caseCount: p.caseCount, medianProfit: p.medianProfit, medianDurationMinutes: p.medianDurationMinutes, avgMarginPercent: p.avgMarginPercent, profitPerORHour: p.profitPerORHour }; return m[sortKey] ?? 0; };
    return [...procedures].sort((a, b) => sortDir === "desc" ? key(b) - key(a) : key(a) - key(b));
  }, [sortKey, sortDir]);

  const proc = selectedProcedure ? procedures.find(p => p.id === selectedProcedure) : null;

  const crumbs = [{ label: "All Procedures", onClick: proc ? () => onProcedureSelect(null) : null }];
  if (proc) crumbs.push({ label: proc.name });

  return (
    <div>
      <Breadcrumb items={crumbs} />

      {proc ? (
        <ProcedureDetail proc={proc} />
      ) : (
        /* All Procedures Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">All Procedures</h3><p className="text-xs text-slate-400 mt-0.5">Click a procedure for detailed breakdown</p></div>
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">Procedure</th>
                <SortTH label="Cases" sortKey="caseCount" current={sortKey} dir={sortDir} onClick={toggle} align="center" />
                <SortTH label="Total Profit" sortKey="totalProfit" current={sortKey} dir={sortDir} onClick={toggle} />
                <SortTH label="Median Profit" sortKey="medianProfit" current={sortKey} dir={sortDir} onClick={toggle} />
                <SortTH label="$/OR Hr" sortKey="profitPerORHour" current={sortKey} dir={sortDir} onClick={toggle} />
                <SortTH label="Typical Time" sortKey="medianDurationMinutes" current={sortKey} dir={sortDir} onClick={toggle} />
                <SortTH label="Margin" sortKey="avgMarginPercent" current={sortKey} dir={sortDir} onClick={toggle} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(p => {
                const loss = p.totalProfit < 0;
                return (
                  <tr key={p.id} onClick={() => onProcedureSelect(p.id)} className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${loss ? "bg-red-50/30" : ""}`} style={loss ? { borderLeft: "3px solid #fca5a5" } : {}}>
                    <td className="px-4 py-3"><span className="text-sm font-medium text-slate-800">{p.name}</span><span className="text-[10px] text-slate-400 ml-1.5">{p.surgeonCount} surgeons</span></td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{p.caseCount}</td>
                    <td className="px-4 py-3 text-right"><span className={`font-semibold tabular-nums ${loss ? "text-red-600" : "text-green-600"}`}>{loss ? `(${fmt(p.totalProfit)})` : fmt(p.totalProfit)}</span></td>
                    <td className="px-4 py-3 text-right text-sm text-slate-900 tabular-nums">{fmt(p.medianProfit)}</td>
                    <td className={`px-4 py-3 text-right text-sm font-medium tabular-nums ${loss ? "text-red-500" : "text-blue-700"}`}>{p.profitPerORHour < 0 ? `($${Math.abs(p.profitPerORHour)})` : `$${p.profitPerORHour}`}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">{p.medianDurationMinutes} min</td>
                    <td className="px-4 py-3 text-right"><MarginBadge value={p.avgMarginPercent} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProcedureDetail({ proc }) {
  const [sortKey, setSortKey] = useState("totalProfit");
  const [sortDir, setSortDir] = useState("desc");
  const toggle = (k) => { if (sortKey === k) setSortDir(d => d === "desc" ? "asc" : "desc"); else { setSortKey(k); setSortDir("desc"); } };
  const sorted = useMemo(() => {
    const key = (s) => { const m = { totalProfit: s.totalProfit, caseCount: s.caseCount, medianDurationMinutes: s.medianDurationMinutes, profitPerORHour: s.profitPerORHour, durationVsFacilityMinutes: s.durationVsFacilityMinutes }; return m[sortKey] ?? 0; };
    return [...proc.surgeonBreakdown].sort((a, b) => sortDir === "desc" ? key(b) - key(a) : key(a) - key(b));
  }, [proc.surgeonBreakdown, sortKey, sortDir]);

  const loss = proc.totalProfit < 0;
  const avgR = proc.caseCount > 0 ? proc.totalReimbursement / proc.caseCount : 0;
  const avgD = proc.caseCount > 0 ? proc.totalDebits / proc.caseCount : 0;
  const avgC = proc.caseCount > 0 ? proc.totalCredits / proc.caseCount : 0;
  const avgOR = proc.caseCount > 0 ? proc.totalORCost / proc.caseCount : 0;
  const avgP = proc.caseCount > 0 ? proc.totalProfit / proc.caseCount : 0;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3">
        <div className={`rounded-xl border p-4 ${loss ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
          <p className={`text-xs font-semibold mb-1 ${loss ? "text-red-600" : "text-green-600"}`}>Total Profit</p>
          <p className={`text-2xl font-bold ${loss ? "text-red-600" : "text-green-600"}`}>{loss ? `(${fmt(proc.totalProfit)})` : fmt(proc.totalProfit)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-1 mb-1"><p className="text-xs font-semibold text-slate-500">Median Profit</p><InfoTip text={`Avg: ${fmt(proc.avgProfit)}`} /></div>
          <p className="text-xl font-bold text-slate-900">{fmt(proc.medianProfit)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{fmt(proc.profitRange.p25)} – {fmt(proc.profitRange.p75)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-1 mb-1"><p className="text-xs font-semibold text-slate-500">Typical Duration</p><InfoTip text={`Avg: ${proc.avgDurationMinutes} min`} /></div>
          <p className="text-xl font-bold text-slate-900">{proc.medianDurationMinutes} min</p>
          <p className="text-[10px] text-slate-400 mt-1">{proc.durationRange.p25} – {proc.durationRange.p75} min</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 mb-1">Margin</p>
          <p className="text-xl font-bold text-slate-900">{fmtPct(proc.avgMarginPercent)}</p>
          <MarginBar value={proc.avgMarginPercent} />
        </div>
        <div className="bg-white rounded-xl border border-blue-200 ring-1 ring-blue-100 p-4">
          <div className="flex items-center gap-1 mb-1"><p className="text-xs font-semibold text-slate-500">$/OR Hour</p></div>
          <p className="text-xl font-bold text-blue-700">{proc.profitPerORHour < 0 ? `($${Math.abs(proc.profitPerORHour)})` : `$${proc.profitPerORHour}`}</p>
          <p className="text-[10px] text-slate-400 mt-1">{proc.caseCount} cases · {proc.surgeonCount} surgeons</p>
        </div>
      </div>

      {/* Avg Case Economics */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Average Case Economics</h3>
        <div className="space-y-1.5">
          {[["Reimbursement", avgR, "text-slate-900"], ["Debits (implants, supplies)", -avgD, "text-red-600"], ...(avgC > 0 ? [["Credits (rebates)", avgC, "text-green-600"]] : []), ["OR Time Cost", -avgOR, "text-red-600"]].map(([l, v, c]) => (
            <div key={l} className="flex items-center justify-between py-1.5"><span className="text-sm text-slate-500">{l}</span><span className={`text-sm font-medium tabular-nums ${c}`}>{v < 0 ? `(${fmt(Math.abs(v))})` : fmt(v)}</span></div>
          ))}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-200">
            <span className="text-sm font-semibold text-slate-900">Net Profit</span>
            <span className={`text-sm font-bold tabular-nums ${avgP >= 0 ? "text-green-600" : "text-red-600"}`}>{avgP < 0 ? `(${fmt(Math.abs(avgP))})` : fmt(avgP)}</span>
          </div>
        </div>
      </div>

      {/* Surgeon Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-slate-900">Surgeon Breakdown</h3><InfoTip text="Each surgeon compared to facility median" /></div></div>
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">Surgeon</th>
              <SortTH label="Cases" sortKey="caseCount" current={sortKey} dir={sortDir} onClick={toggle} align="center" />
              <SortTH label="Median Profit" sortKey="totalProfit" current={sortKey} dir={sortDir} onClick={toggle} />
              <th className="px-4 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase tracking-wider">Impact</th>
              <SortTH label="$/OR Hr" sortKey="profitPerORHour" current={sortKey} dir={sortDir} onClick={toggle} />
              <SortTH label="Typical Time" sortKey="medianDurationMinutes" current={sortKey} dir={sortDir} onClick={toggle} />
              <SortTH label="vs Facility" sortKey="durationVsFacilityMinutes" current={sortKey} dir={sortDir} onClick={toggle} />
              <th className="px-4 py-2.5 text-center text-[10px] font-medium text-slate-400 uppercase tracking-wider">Consistency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.map(s => (
              <tr key={s.surgeonId} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3"><span className="text-sm font-medium text-slate-800">{s.surgeonName}</span>{s.caseCount < 10 && <span className="ml-1 text-amber-500 text-[10px]">*</span>}</td>
                <td className="px-4 py-3 text-center text-sm text-slate-600">{s.caseCount}</td>
                <td className="px-4 py-3 text-right"><span className="font-medium text-green-600 tabular-nums">{fmt(s.medianProfit)}</span></td>
                <td className="px-4 py-3 text-right">{Math.abs(s.profitImpact) >= 10 ? <ComparisonPill value={s.profitImpact} format="currency" /> : <span className="text-sm text-slate-400">—</span>}</td>
                <td className="px-4 py-3 text-right text-sm font-medium text-slate-900 tabular-nums">{s.profitPerORHour !== null ? fmt(s.profitPerORHour) : "—"}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">{s.medianDurationMinutes} min</td>
                <td className="px-4 py-3 text-right"><ComparisonPill value={s.durationVsFacilityMinutes} unit="min" invert /></td>
                <td className="px-4 py-3 text-center">{s.consistencyRating ? <ConsistencyBadge rating={s.consistencyRating} /> : <span className="text-slate-400">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {proc.surgeonBreakdown.some(s => s.caseCount < 10) && <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100"><p className="text-[10px] text-slate-500">* Below minimum threshold (10 cases) for statistical reliability</p></div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SURGEON TAB
// ═══════════════════════════════════════════════════

function SurgeonTab({ selectedSurgeon, onSurgeonSelect }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [surgeonSortKey, setSurgeonSortKey] = useState("totalProfit");
  const [surgeonSortDir, setSurgeonSortDir] = useState("desc");
  const [detailTab, setDetailTab] = useState("overview");

  const toggleSurgeonSort = (k) => { if (surgeonSortKey === k) setSurgeonSortDir(d => d === "desc" ? "asc" : "desc"); else { setSurgeonSortKey(k); setSurgeonSortDir("desc"); } };

  const sortedSurgeons = useMemo(() => {
    const key = (s) => { const m = { totalProfit: s.totalProfit, caseCount: s.caseCount, profitPerORHour: s.profitPerORHour, avgMarginPercent: s.avgMarginPercent, medianProfit: s.medianProfit }; return m[surgeonSortKey] ?? 0; };
    return [...surgeons].sort((a, b) => surgeonSortDir === "desc" ? key(b) - key(a) : key(a) - key(b));
  }, [surgeonSortKey, surgeonSortDir]);

  const surgeon = selectedSurgeon ? surgeons.find(s => s.id === selectedSurgeon) : null;
  const view = selectedDate ? "day" : surgeon ? "detail" : "list";

  const crumbs = [{ label: "All Surgeons", onClick: surgeon ? () => { onSurgeonSelect(null); setSelectedDate(null); setDetailTab("overview"); } : null }];
  if (surgeon) crumbs.push({ label: surgeon.name, onClick: selectedDate ? () => setSelectedDate(null) : null });
  if (selectedDate) crumbs.push({ label: selectedDate });

  const maxSP = Math.max(...surgeons.map(s => s.totalProfit));

  return (
    <div>
      <Breadcrumb items={crumbs} />

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { l: "Total Surgeons", v: surgeons.length, c: "text-slate-900" },
              { l: "Total Profit", v: fmt(surgeons.reduce((s, x) => s + x.totalProfit, 0)), c: "text-green-600" },
              { l: "Total Cases", v: surgeons.reduce((s, x) => s + x.caseCount, 0), c: "text-slate-900" },
              { l: "Avg $/OR Hour", v: "$1,229", c: "text-blue-700" },
            ].map((m, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs text-slate-400 font-medium mb-1">{m.l}</p>
                <p className={`text-xl font-bold ${m.c}`}>{m.v}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">Surgeon Leaderboard</h3><p className="text-xs text-slate-400 mt-0.5">Click a surgeon for detailed performance</p></div>
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider w-8">#</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">Surgeon</th>
                  <SortTH label="Cases" sortKey="caseCount" current={surgeonSortKey} dir={surgeonSortDir} onClick={toggleSurgeonSort} align="center" />
                  <SortTH label="Total Profit" sortKey="totalProfit" current={surgeonSortKey} dir={surgeonSortDir} onClick={toggleSurgeonSort} />
                  <SortTH label="Typical/Case" sortKey="medianProfit" current={surgeonSortKey} dir={surgeonSortDir} onClick={toggleSurgeonSort} />
                  <SortTH label="$/OR Hr" sortKey="profitPerORHour" current={surgeonSortKey} dir={surgeonSortDir} onClick={toggleSurgeonSort} />
                  <SortTH label="Margin" sortKey="avgMarginPercent" current={surgeonSortKey} dir={surgeonSortDir} onClick={toggleSurgeonSort} />
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedSurgeons.map((s, idx) => (
                  <tr key={s.id} onClick={() => { onSurgeonSelect(s.id); setDetailTab("overview"); }} className="hover:bg-slate-50/80 cursor-pointer transition-colors">
                    <td className="px-4 py-3"><RankBadge rank={idx + 1} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{s.name}</span>{s.lowVol && <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full uppercase">Low vol</span>}</div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{s.procedureCount} procedures</p>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{s.caseCount}</td>
                    <td className="px-4 py-3 text-right"><span className="text-base font-bold text-green-600 tabular-nums">{fmt(s.totalProfit)}</span></td>
                    <td className="px-4 py-3 text-right text-sm text-slate-900 tabular-nums">{fmt(s.medianProfit)}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-blue-700 tabular-nums">${s.profitPerORHour.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right"><MarginBadge value={s.avgMarginPercent} /></td>
                    <td className="px-4 py-3"><ChevronRight /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DETAIL VIEW ── */}
      {view === "detail" && surgeon && (
        <div className="space-y-4">
          {/* Hero header */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center"><span className="text-lg font-bold">{surgeon.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</span></div>
              <div><h2 className="text-2xl font-bold">{surgeon.name}</h2><p className="text-slate-400 mt-0.5">{surgeon.caseCount} cases in period</p></div>
            </div>
            <div className="grid grid-cols-6 gap-6 mt-6 pt-6 border-t border-white/10">
              {[["Total Profit", fmt(surgeon.totalProfit), ""], ["Typical/Case", fmt(surgeon.medianProfit), ""], ["$/OR Hour", `$${surgeon.profitPerORHour}`, "text-blue-300"], ["Margin", fmtPct(surgeon.avgMarginPercent), ""], ["Cases", surgeon.caseCount, ""], ["Typical Duration", fmtDur(surgeon.efficiency.medianDuration), ""]].map(([l, v, c]) => (
                <div key={l}><div className="text-slate-400 text-sm">{l}</div><div className={`text-2xl font-bold mt-1 ${c}`}>{v}</div></div>
              ))}
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {["overview", "daily", "procedures"].map(t => (
              <button key={t} onClick={() => setDetailTab(t)} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${detailTab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {t === "overview" ? "Overview" : t === "daily" ? "Daily Activity" : "By Procedure"}
              </button>
            ))}
          </div>

          {/* Overview subtab */}
          {detailTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center gap-1 mb-2"><p className="text-xs font-medium text-slate-400">Time vs Facility</p><InfoTip text="Weighted avg comparing to facility median per procedure" /></div>
                  <p className={`text-2xl font-bold ${surgeon.durationVsFacilityMinutes < 0 ? "text-green-600" : surgeon.durationVsFacilityMinutes > 5 ? "text-red-600" : "text-slate-900"}`}>{surgeon.durationVsFacilityMinutes > 0 ? "+" : ""}{surgeon.durationVsFacilityMinutes} min</p>
                  <p className="text-xs text-slate-400 mt-1">{surgeon.durationVsFacilityMinutes < 0 ? "Faster" : "Slower"} than facility typical</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center gap-1 mb-2"><p className="text-xs font-medium text-slate-400">Profit Impact</p><InfoTip text="Estimated profit impact from time efficiency" /></div>
                  <p className={`text-2xl font-bold ${surgeon.profitImpact >= 0 ? "text-green-600" : "text-red-600"}`}>{surgeon.profitImpact >= 0 ? "+" : ""}{fmt(surgeon.profitImpact)}/case</p>
                  <p className="text-xs text-slate-400 mt-1">From time efficiency</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-400 mb-2">Typical Surgical Time</p>
                  <p className="text-2xl font-bold text-slate-900">{fmtDur(surgeon.efficiency.avgSurgicalTime)}</p>
                  <p className="text-xs text-slate-400 mt-1">Incision to closing</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-400 mb-2">Consistency</p>
                  <ConsistencyBadge rating={surgeon.efficiency.consistencyRating} />
                  <p className="text-xs text-slate-400 mt-2">Case duration variance</p>
                </div>
              </div>

              {/* Avg Case Economics */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Average Case Economics</h3>
                <div className="space-y-1.5">
                  <div className="flex justify-between py-1.5"><span className="text-sm text-slate-500">Reimbursement</span><span className="text-sm font-medium text-slate-900 tabular-nums">{fmt(surgeon.costBreakdown.avgReimbursement)}</span></div>
                  <div className="flex justify-between py-1.5 pl-4"><span className="text-sm text-slate-500">Debits (implants, supplies)</span><span className="text-sm font-medium text-red-600 tabular-nums">({fmt(surgeon.costBreakdown.avgDebits)})</span></div>
                  <div className="flex justify-between py-1.5 pl-4"><span className="text-sm text-slate-500">OR Time Cost</span><span className="text-sm font-medium text-red-600 tabular-nums">({fmt(surgeon.costBreakdown.avgORCost)})</span></div>
                  <div className="flex justify-between pt-2.5 mt-2 border-t border-slate-200"><span className="text-sm font-semibold text-slate-900">Avg Profit/Case</span><span className={`text-sm font-bold tabular-nums ${surgeon.costBreakdown.avgProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(surgeon.costBreakdown.avgProfit)}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Daily subtab */}
          {detailTab === "daily" && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">Daily Activity</h3><p className="text-xs text-slate-400 mt-0.5">Click a day to view detailed breakdown</p></div>
              <div className="divide-y divide-slate-50">
                {surgeon.dailyStats.map(day => (
                  <div key={day.date} onClick={() => setSelectedDate(day.date)} className="flex items-center gap-4 px-5 py-4 hover:bg-blue-50/50 cursor-pointer transition-all group">
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

          {/* Procedures subtab */}
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
                  {surgeon.procedureBreakdown.map(pb => {
                    const facProc = procedures.find(p => p.id === pb.procedureId);
                    const facMedian = facProc?.medianDurationMinutes || null;
                    const diff = pb.medianDuration && facMedian ? pb.medianDuration - facMedian : null;
                    return (
                      <tr key={pb.procedureId} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{pb.procedureName}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">{pb.caseCount}{pb.caseCount < 5 && <span className="ml-1 text-amber-500 text-[10px]">*</span>}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600 tabular-nums">{fmt(pb.totalProfit)}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-900 tabular-nums">{fmtDur(pb.medianDuration)}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">{fmtDur(facMedian)}</td>
                        <td className="px-4 py-3 text-right">{diff !== null ? <ComparisonPill value={diff} unit="min" invert /> : <span className="text-slate-400">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {surgeon.procedureBreakdown.some(p => p.caseCount < 5) && <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100"><p className="text-[10px] text-slate-500">* Low sample size — interpret with caution</p></div>}
            </div>
          )}
        </div>
      )}

      {/* ── DAY VIEW ── */}
      {view === "day" && surgeon && selectedDate && (() => {
        const cases = dayCases[`${surgeon.id}-${selectedDate}`] || [];
        const dayDay = surgeon.dailyStats.find(d => d.date === selectedDate);
        const totalDur = cases.reduce((s, c) => s + c.dur, 0);
        const totalSurg = cases.reduce((s, c) => s + c.surgDur, 0);
        const totalProfit = cases.reduce((s, c) => s + c.profit, 0);
        const uptime = totalDur > 0 ? Math.round((totalSurg / totalDur) * 100) : 0;

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">{selectedDate}, 2026</h2><p className="text-slate-500 text-sm mt-0.5">Daily breakdown for {surgeon.name}</p></div>
            </div>

            {/* Day overview card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-xl p-4 bg-slate-50"><div className="text-xs text-slate-500 mb-1.5">First Case Start</div><div className="text-xl font-bold text-slate-900">{cases[0] ? fmtTime(cases[0].start[0], cases[0].start[1]) : "—"}</div></div>
                <div className="rounded-xl p-4 bg-slate-50"><div className="text-xs text-slate-500 mb-1.5">Total Cases</div><div className="text-xl font-bold text-slate-900">{cases.length}</div></div>
                <div className="rounded-xl p-4 bg-slate-50"><div className="text-xs text-slate-500 mb-1.5">Total OR Time</div><div className="text-xl font-bold text-slate-900">{fmtDur(totalDur)}</div></div>
                <div className="rounded-xl p-4 bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200"><div className="text-xs text-slate-500 mb-1.5">Total Profit</div><div className="text-xl font-bold text-green-600">{fmt(totalProfit)}</div></div>
              </div>

              {totalDur > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-700">Surgical Uptime</span><span className="text-sm font-bold text-slate-900">{uptime}%</span></div>
                  <div className="h-3 w-full rounded-full overflow-hidden bg-slate-100 flex"><div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all" style={{ width: `${uptime}%` }} /></div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Surgical ({fmtDur(totalSurg)})</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-200" />Non-Surgical ({fmtDur(totalDur - totalSurg)})</span>
                  </div>
                </div>
              )}
            </div>

            {/* Cases list */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div><h3 className="text-sm font-semibold text-slate-900">Cases</h3><p className="text-xs text-slate-400 mt-0.5">{cases.length} cases completed</p></div>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  {[["Pre-Op","bg-blue-500"],["Surgical","bg-green-500"],["Closing","bg-amber-500"],["Emergence","bg-violet-500"]].map(([l,c])=><span key={l} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${c}`} />{l}</span>)}
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {cases.map((c, idx) => {
                  const durDiff = c.dur - c.medianDur;
                  const profDiff = c.profit - c.medianProfit;
                  return (
                    <div key={c.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${idx === 0 ? "bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-slate-100 text-slate-600"}`}>{idx + 1}</div>
                          {idx === 0 && <span className="text-[10px] font-medium text-amber-700">First</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{c.proc}</span><span className="text-slate-400">·</span><span className="text-sm text-slate-500">{c.room}</span></div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500"><span className="font-mono text-xs">{c.num}</span><span className="text-slate-300">·</span><span>{fmtTime(c.start[0], c.start[1])}</span></div>
                          <div className="flex items-center gap-1.5 mt-2.5">
                            <PhasePill label="Pre-Op" minutes={c.phases.preOp} color="blue" />
                            <PhasePill label="Surgical" minutes={c.phases.surgical} color="green" />
                            <PhasePill label="Closing" minutes={c.phases.closing} color="amber" />
                            <PhasePill label="Emergence" minutes={c.phases.emergence} color="violet" />
                          </div>
                        </div>
                        <div className="flex items-center gap-6 shrink-0">
                          <div className="text-right"><div className="text-[10px] text-slate-400 uppercase mb-1">Duration</div><div className="flex items-center justify-end gap-2"><span className="text-sm font-semibold text-slate-900">{fmtDur(c.dur)}</span><ComparisonPill value={durDiff} unit="min" invert /></div></div>
                          <div className="text-right min-w-[130px]"><div className="text-[10px] text-slate-400 uppercase mb-1">Profit</div><div className="flex items-center justify-end gap-2"><span className="text-sm font-bold text-green-600">{fmt(c.profit)}</span><ComparisonPill value={profDiff} format="currency" /></div></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════

export default function FinancialAnalyticsRedesign() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedProcedure, setSelectedProcedure] = useState(null);
  const [selectedSurgeon, setSelectedSurgeon] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setTimeout(() => setLoaded(true), 50); }, []);

  const handleProcedureClick = (id) => { setSelectedProcedure(id); setActiveTab("procedure"); };
  const handleSurgeonClick = (id) => { setSelectedSurgeon(id); setActiveTab("surgeon"); };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "procedure", label: "By Procedure" },
    { id: "surgeon", label: "By Surgeon" },
  ];

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className="max-w-[1400px] mx-auto px-6 py-8" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div className={`transition-all duration-500 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
          <div className="flex items-start justify-between mb-6">
            <div><h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Financial Analytics</h1><p className="text-sm text-slate-500 mt-0.5">44 cases analyzed · Feb 1–20, 2026</p></div>
            <button className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              This Month<svg className="w-3.5 h-3.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
          </div>
          <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
            {tabs.map(t => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); if (t.id === "procedure") setSelectedProcedure(null); if (t.id === "surgeon") setSelectedSurgeon(null); }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className={`transition-all duration-500 delay-100 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
          {activeTab === "overview" && <OverviewTab onProcedureClick={handleProcedureClick} onSurgeonClick={handleSurgeonClick} />}
          {activeTab === "procedure" && <ProcedureTab selectedProcedure={selectedProcedure} onProcedureSelect={setSelectedProcedure} />}
          {activeTab === "surgeon" && <SurgeonTab selectedSurgeon={selectedSurgeon} onSurgeonSelect={setSelectedSurgeon} />}
        </div>

        <div className="text-center mt-8 pb-4"><p className="text-[10px] text-slate-300 uppercase tracking-widest">ORbit Financial Analytics · Design Reference v3</p></div>
      </div>
    </div>
  );
}
