import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, Cell, PieChart, Pie, Legend, LineChart, Line } from "recharts";

// ============================================
// DESIGN SYSTEM — ORbit Light Theme
// ============================================
const COLORS = {
  bg: "#f8f9fb",
  surface: "#ffffff",
  surfaceHover: "#f1f5f9",
  surfaceAlt: "#f8fafc",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  textDim: "#94a3b8",
  accent: {
    sky: "#0284c7",
    skyLight: "#e0f2fe",
    rose: "#e11d48",
    roseLight: "#ffe4e6",
    amber: "#d97706",
    amberLight: "#fef3c7",
    violet: "#7c3aed",
    violetLight: "#ede9fe",
    emerald: "#059669",
    emeraldLight: "#d1fae5",
    orange: "#ea580c",
    orangeLight: "#fff7ed",
    pink: "#db2777",
    cyan: "#0891b2",
    red: "#dc2626",
  },
  severity: {
    critical: { bg: "#fef2f2", text: "#991b1b", dot: "#dc2626", border: "#fecaca", label: "#b91c1c" },
    warning: { bg: "#fffbeb", text: "#92400e", dot: "#d97706", border: "#fde68a", label: "#b45309" },
    info: { bg: "#eff6ff", text: "#1e40af", dot: "#2563eb", border: "#bfdbfe", label: "#1d4ed8" },
  },
};

const SEVERITY_ORDER = ["critical", "warning", "info"];

// ============================================
// MOCK DATA
// ============================================
const generateWeeklyTrend = () => {
  const weeks = [];
  const now = new Date(2026, 1, 19);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const threshold = Math.floor(Math.random() * 8) + 3;
    const delay = Math.floor(Math.random() * 5) + 1;
    weeks.push({ week: label, threshold, delay, total: threshold + delay });
  }
  return weeks;
};

const MOCK = {
  summary: {
    totalCases: 187, flaggedCases: 54, flagRate: 28.9, flagRateTrend: -3.2,
    totalFlags: 89, avgFlagsPerCase: 1.65, delayedCases: 31,
    delayRate: 16.6, delayRateTrend: +1.8,
    criticalCount: 12, warningCount: 41, infoCount: 36,
  },
  weeklyTrend: generateWeeklyTrend(),
  flagRuleBreakdown: [
    { name: "Long Total Case Time", count: 18, severity: "warning", pct: 20.2 },
    { name: "Late First Case", count: 14, severity: "critical", pct: 15.7 },
    { name: "Long Pre-Op", count: 12, severity: "warning", pct: 13.5 },
    { name: "Slow Turnover", count: 11, severity: "warning", pct: 12.4 },
    { name: "Long Surgical Time", count: 9, severity: "info", pct: 10.1 },
    { name: "Long Anesthesia", count: 8, severity: "info", pct: 9.0 },
    { name: "Long Closing", count: 6, severity: "info", pct: 6.7 },
  ],
  delayTypeBreakdown: [
    { name: "Equipment Not Ready", count: 9, pct: 29.0, avgDuration: 14, color: COLORS.accent.rose },
    { name: "Surgeon Late", count: 7, pct: 22.6, avgDuration: 22, color: COLORS.accent.amber },
    { name: "Patient Prep Delay", count: 5, pct: 16.1, avgDuration: 11, color: COLORS.accent.violet },
    { name: "Consent/Admin", count: 4, pct: 12.9, avgDuration: 8, color: COLORS.accent.sky },
    { name: "Anesthesia Delay", count: 3, pct: 9.7, avgDuration: 16, color: COLORS.accent.emerald },
    { name: "Staffing Issue", count: 2, pct: 6.5, avgDuration: 19, color: COLORS.accent.orange },
    { name: "Other", count: 1, pct: 3.2, avgDuration: 7, color: COLORS.textDim },
  ],
  dayOfWeekHeatmap: [
    { day: "Mon", fcots: 3, timing: 4, turnover: 2, delay: 3, total: 12 },
    { day: "Tue", fcots: 5, timing: 6, turnover: 3, delay: 4, total: 18 },
    { day: "Wed", fcots: 2, timing: 3, turnover: 4, delay: 2, total: 11 },
    { day: "Thu", fcots: 4, timing: 5, turnover: 3, delay: 5, total: 17 },
    { day: "Fri", fcots: 1, timing: 2, turnover: 1, delay: 2, total: 6 },
  ],
  surgeonFlags: [
    { name: "Dr. Martinez", cases: 42, flags: 18, rate: 42.9, trend: -5.1, topFlag: "Long Total Case Time" },
    { name: "Dr. Chen", cases: 38, flags: 14, rate: 36.8, trend: +2.3, topFlag: "Late First Case" },
    { name: "Dr. Thompson", cases: 35, flags: 10, rate: 28.6, trend: -8.4, topFlag: "Slow Turnover" },
    { name: "Dr. Patel", cases: 31, flags: 7, rate: 22.6, trend: -1.2, topFlag: "Long Pre-Op" },
    { name: "Dr. Williams", cases: 24, flags: 4, rate: 16.7, trend: +0.8, topFlag: "Long Surgical Time" },
    { name: "Dr. Rodriguez", cases: 17, flags: 1, rate: 5.9, trend: -2.0, topFlag: "Long Closing" },
  ],
  roomFlags: [
    { room: "OR 1", cases: 48, flags: 22, rate: 45.8, topIssue: "Late First Case", topDelay: "Equipment Not Ready" },
    { room: "OR 2", cases: 45, flags: 18, rate: 40.0, topIssue: "Long Pre-Op", topDelay: "Surgeon Late" },
    { room: "OR 3", cases: 52, flags: 15, rate: 28.8, topIssue: "Slow Turnover", topDelay: "Patient Prep Delay" },
    { room: "OR 4", cases: 42, flags: 8, rate: 19.0, topIssue: "Long Anesthesia", topDelay: "Consent/Admin" },
  ],
  sparkline: {
    flagRate: [32, 34, 29, 31, 28, 33, 27, 30, 26, 29, 31, 28.9],
    delayRate: [14, 13, 15, 17, 14, 18, 15, 16, 19, 15, 17, 16.6],
  },
  recentFlags: [
    { caseNum: "RW-2026-0187", date: "Feb 18", surgeon: "Dr. Martinez", procedure: "TKA", flags: [{ type: "threshold", name: "Long Total Case Time", severity: "warning" }, { type: "delay", name: "Equipment Not Ready", severity: "warning" }] },
    { caseNum: "RW-2026-0185", date: "Feb 18", surgeon: "Dr. Chen", procedure: "Hip Replacement", flags: [{ type: "threshold", name: "Late First Case", severity: "critical" }, { type: "threshold", name: "Long Pre-Op", severity: "warning" }] },
    { caseNum: "RW-2026-0183", date: "Feb 17", surgeon: "Dr. Thompson", procedure: "ACL Repair", flags: [{ type: "threshold", name: "Slow Turnover", severity: "warning" }] },
    { caseNum: "RW-2026-0180", date: "Feb 17", surgeon: "Dr. Martinez", procedure: "Shoulder Arthroscopy", flags: [{ type: "delay", name: "Surgeon Late", severity: "critical" }, { type: "threshold", name: "Long Surgical Time", severity: "info" }, { type: "threshold", name: "Long Closing", severity: "info" }] },
    { caseNum: "RW-2026-0178", date: "Feb 14", surgeon: "Dr. Patel", procedure: "Carpal Tunnel", flags: [{ type: "delay", name: "Consent/Admin", severity: "info" }] },
  ],
  patterns: [
    { type: "trend", icon: "📈", title: "Tuesday Spike", desc: "Tuesdays average 64% more flags than other days. 5 of 14 FCOTS flags occur on Tuesdays.", severity: "warning", metric: "+64%" },
    { type: "correlation", icon: "🔗", title: "Equipment → Cascade", desc: "Equipment delays correlate with 2.3x higher total case time flags in the same room later that day.", severity: "critical", metric: "2.3x" },
    { type: "improvement", icon: "✅", title: "Turnover Improving", desc: "Slow turnover flags down 38% vs. last month. Flip room callback times improving across all rooms.", severity: "good", metric: "-38%" },
    { type: "recurring", icon: "🔄", title: "OR 1 First Case", desc: "OR 1 accounts for 43% of all FCOTS flags despite handling 26% of first cases. Consistently late starts.", severity: "critical", metric: "43%" },
  ],
};

// ============================================
// UTILITY COMPONENTS
// ============================================
const MiniSparkline = ({ data, color, width = 64, height = 20 }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`).join(" ");
  const lastX = width;
  const lastY = height - ((data[data.length - 1] - min) / range) * (height - 2) - 1;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
};

const TrendBadge = ({ value, inverse = false }) => {
  if (value === 0) return <span style={{ color: COLORS.textDim, fontSize: 11 }}>—</span>;
  const isPositive = value > 0;
  const isGood = inverse ? isPositive : !isPositive;
  const color = isGood ? COLORS.accent.emerald : COLORS.accent.rose;
  const bg = isGood ? COLORS.accent.emeraldLight : COLORS.accent.roseLight;
  return (
    <span style={{
      color, fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 2,
      padding: "1px 6px", borderRadius: 4, backgroundColor: bg,
    }}>
      {isPositive ? "↑" : "↓"} {Math.abs(value).toFixed(1)}%
    </span>
  );
};

const SeverityDot = ({ severity, size = 8 }) => {
  const cfg = COLORS.severity[severity] || COLORS.severity.info;
  return <span style={{ width: size, height: size, borderRadius: "50%", backgroundColor: cfg.dot, display: "inline-block", flexShrink: 0 }} />;
};

const FlagBadge = ({ flag }) => {
  const cfg = COLORS.severity[flag.severity] || COLORS.severity.info;
  const isDelay = flag.type === "delay";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500,
      backgroundColor: cfg.bg, color: cfg.label || cfg.text, border: `1px solid ${cfg.border}`,
      whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 9, opacity: 0.7 }}>{isDelay ? "◷" : "⚡"}</span>
      {flag.name}
    </span>
  );
};

const SectionHeader = ({ title, subtitle, action }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: 0, letterSpacing: "-0.01em" }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 12, color: COLORS.textMuted, margin: "3px 0 0", lineHeight: 1.3 }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

const Card = ({ children, style, ...props }) => (
  <div style={{
    backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`,
    borderRadius: 12, overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
    ...style,
  }} {...props}>{children}</div>
);

// ============================================
// KPI STRIP
// ============================================
const KPICard = ({ label, value, unit, trend, trendInverse, sparkData, sparkColor, status, detail }) => {
  const statusColors = { good: COLORS.accent.emerald, bad: COLORS.accent.rose, neutral: COLORS.accent.amber };
  const statusBgs = { good: COLORS.accent.emeraldLight, bad: COLORS.accent.roseLight, neutral: COLORS.accent.amberLight };
  const dotColor = status ? statusColors[status] : COLORS.textDim;
  return (
    <Card style={{ padding: "16px 20px", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: dotColor }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: COLORS.text, lineHeight: 1, fontFamily: "'SF Mono', 'JetBrains Mono', monospace" }}>{value}</span>
            {unit && <span style={{ fontSize: 14, color: COLORS.textMuted, fontWeight: 500 }}>{unit}</span>}
          </div>
        </div>
        {sparkData && <MiniSparkline data={sparkData} color={sparkColor || COLORS.accent.sky} />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        {trend !== undefined && <TrendBadge value={trend} inverse={trendInverse} />}
        {detail && <span style={{ fontSize: 11, color: COLORS.textDim }}>{detail}</span>}
      </div>
    </Card>
  );
};

// ============================================
// HEATMAP
// ============================================
const DayHeatmap = ({ data }) => {
  const categories = [
    { key: "fcots", label: "FCOTS", color: COLORS.accent.rose },
    { key: "timing", label: "Timing", color: COLORS.accent.amber },
    { key: "turnover", label: "Turnover", color: COLORS.accent.violet },
    { key: "delay", label: "Delays", color: COLORS.accent.orange },
  ];
  const maxVal = Math.max(...data.flatMap(d => categories.map(c => d[c.key])));

  const getCellBg = (value, baseColor) => {
    if (value === 0) return COLORS.borderLight;
    const intensity = Math.max(0.1, value / maxVal);
    return `${baseColor}${Math.round(intensity * 35).toString(16).padStart(2, "0")}`;
  };
  const getCellText = (value, baseColor) => {
    if (value === 0) return COLORS.textDim;
    const intensity = value / maxVal;
    return intensity > 0.6 ? baseColor : COLORS.textSecondary;
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "60px repeat(5, 1fr)", gap: 3, minWidth: 380 }}>
        <div />
        {data.map(d => (
          <div key={d.day} style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textAlign: "center", padding: "4px 0" }}>{d.day}</div>
        ))}
        {categories.map(cat => (
          <>
            <div key={cat.key} style={{ fontSize: 11, fontWeight: 500, color: COLORS.textMuted, display: "flex", alignItems: "center", paddingRight: 8 }}>{cat.label}</div>
            {data.map(d => {
              const val = d[cat.key];
              return (
                <div key={`${cat.key}-${d.day}`} style={{
                  backgroundColor: getCellBg(val, cat.color),
                  borderRadius: 6, padding: "10px 0", textAlign: "center",
                  fontSize: 13, fontWeight: 600,
                  color: getCellText(val, cat.color),
                  fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
                  border: `1px solid ${val > 0 ? cat.color + "18" : COLORS.border}`,
                  transition: "all 0.15s ease", cursor: "default",
                }}>
                  {val}
                </div>
              );
            })}
          </>
        ))}
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, display: "flex", alignItems: "center", paddingRight: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, marginTop: 4 }}>Total</div>
        {data.map(d => (
          <div key={`total-${d.day}`} style={{
            textAlign: "center", fontSize: 14, fontWeight: 700, color: COLORS.text,
            fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
            borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, marginTop: 4,
          }}>{d.total}</div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// PATTERN INSIGHT CARDS
// ============================================
const PatternCard = ({ pattern }) => {
  const config = {
    warning: { border: COLORS.accent.amber, bg: COLORS.accent.amberLight + "60", text: COLORS.accent.amber },
    critical: { border: COLORS.accent.rose, bg: COLORS.accent.roseLight + "60", text: COLORS.accent.rose },
    good: { border: COLORS.accent.emerald, bg: COLORS.accent.emeraldLight + "60", text: COLORS.accent.emerald },
  };
  const c = config[pattern.severity] || config.warning;
  return (
    <div style={{
      backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderLeft: `3px solid ${c.border}`, borderRadius: 8,
      padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12,
      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
    }}>
      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{pattern.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{pattern.title}</span>
          <span style={{
            fontSize: 12, fontWeight: 700, color: c.text,
            fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
            backgroundColor: c.bg, padding: "2px 8px", borderRadius: 4,
          }}>{pattern.metric}</span>
        </div>
        <p style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5, margin: 0 }}>{pattern.desc}</p>
      </div>
    </div>
  );
};

// ============================================
// HORIZONTAL BAR LIST
// ============================================
const HorizontalBarList = ({ items, maxCount }) => {
  const max = maxCount || Math.max(...items.map(i => i.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {item.severity && <SeverityDot severity={item.severity} size={6} />}
              {item.color && <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: item.color, flexShrink: 0 }} />}
              <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 12 }}>
              {item.avgDuration && (
                <span style={{ fontSize: 11, color: COLORS.textDim, fontFamily: "'SF Mono', 'JetBrains Mono', monospace" }}>~{item.avgDuration}m</span>
              )}
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: "'SF Mono', 'JetBrains Mono', monospace", width: 28, textAlign: "right" }}>{item.count}</span>
              <span style={{ fontSize: 11, color: COLORS.textDim, width: 36, textAlign: "right" }}>{item.pct.toFixed(0)}%</span>
            </div>
          </div>
          <div style={{ height: 4, backgroundColor: COLORS.borderLight, borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${(item.count / max) * 100}%`,
              backgroundColor: item.color || (item.severity ? COLORS.severity[item.severity]?.dot : COLORS.accent.sky),
              opacity: 0.75, transition: "width 0.5s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// CUSTOM TOOLTIP
// ============================================
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: "10px 14px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, margin: "0 0 6px" }}>Week of {label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: p.color }} />
          <span style={{ fontSize: 12, color: COLORS.text }}>{p.name}: <strong>{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

// ============================================
// DATE RANGE SELECTOR
// ============================================
const DateRangeSelector = ({ value, onChange }) => {
  const options = ["This Week", "This Month", "Last 30 Days", "Last 90 Days", "YTD"];
  return (
    <div style={{ display: "flex", gap: 1, backgroundColor: COLORS.borderLight, borderRadius: 8, padding: 3, border: `1px solid ${COLORS.border}` }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
          backgroundColor: value === opt ? COLORS.surface : "transparent",
          color: value === opt ? COLORS.text : COLORS.textMuted,
          boxShadow: value === opt ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
          transition: "all 0.15s ease",
        }}>
          {opt}
        </button>
      ))}
    </div>
  );
};

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function CaseFlagsAnalytics() {
  const [loaded, setLoaded] = useState(false);
  const [dateRange, setDateRange] = useState("This Month");
  const [hoveredSurgeon, setHoveredSurgeon] = useState(null);

  useEffect(() => { const t = setTimeout(() => setLoaded(true), 80); return () => clearTimeout(t); }, []);

  const s = MOCK.summary;

  return (
    <div style={{
      backgroundColor: COLORS.bg, minHeight: "100vh", color: COLORS.text,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
      opacity: loaded ? 1 : 0, transition: "opacity 0.35s ease",
    }}>

      {/* ====== HEADER ====== */}
      <div style={{ backgroundColor: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "16px 32px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button style={{
              display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500,
              color: COLORS.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0,
            }}>
              ← Analytics
            </button>
            <DateRangeSelector value={dateRange} onChange={setDateRange} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `linear-gradient(135deg, ${COLORS.accent.roseLight}, ${COLORS.accent.violetLight})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, border: `1px solid ${COLORS.border}`,
            }}>⚑</div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.025em", color: COLORS.text }}>Case & Flag Analytics</h1>
              <p style={{ fontSize: 13, color: COLORS.textMuted, margin: "2px 0 0" }}>
                {s.totalCases} cases · {s.flaggedCases} flagged · {dateRange.toLowerCase()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 32px 64px" }}>

        {/* ====== KPI STRIP ====== */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          <KPICard
            label="Flagged Cases"
            value={s.flagRate.toFixed(1)} unit="%"
            trend={s.flagRateTrend} trendInverse
            sparkData={MOCK.sparkline.flagRate} sparkColor={COLORS.accent.rose}
            status={s.flagRate > 30 ? "bad" : s.flagRate > 20 ? "neutral" : "good"}
            detail={`${s.flaggedCases} of ${s.totalCases} cases`}
          />
          <KPICard
            label="Delay Rate"
            value={s.delayRate.toFixed(1)} unit="%"
            trend={s.delayRateTrend} trendInverse
            sparkData={MOCK.sparkline.delayRate} sparkColor={COLORS.accent.amber}
            status={s.delayRate > 20 ? "bad" : s.delayRate > 15 ? "neutral" : "good"}
            detail={`${s.delayedCases} user-reported delays`}
          />
          <KPICard label="Critical Flags" value={s.criticalCount} status="bad" detail={`${s.warningCount} warnings · ${s.infoCount} info`} />
          <KPICard label="Total Flags" value={s.totalFlags} detail={`${s.avgFlagsPerCase.toFixed(1)} avg per flagged case`} />
        </div>

        {/* ====== SEVERITY STRIP ====== */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {SEVERITY_ORDER.map(sev => {
            const cfg = COLORS.severity[sev];
            const count = sev === "critical" ? s.criticalCount : sev === "warning" ? s.warningCount : s.infoCount;
            const pct = ((count / s.totalFlags) * 100).toFixed(0);
            return (
              <div key={sev} style={{
                flex: `${count} 0 0`, minWidth: 100,
                backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: "10px 14px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: cfg.dot }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: cfg.label, textTransform: "uppercase", letterSpacing: "0.04em" }}>{sev}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: cfg.label, fontFamily: "'SF Mono', 'JetBrains Mono', monospace" }}>{count}</span>
                  <span style={{ fontSize: 11, color: cfg.text, opacity: 0.6 }}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ====== PATTERN INSIGHTS ====== */}
        <SectionHeader title="Detected Patterns" subtitle="Auto-analyzed trends and correlations from your flag data" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 32 }}>
          {MOCK.patterns.map((p, i) => <PatternCard key={i} pattern={p} />)}
        </div>

        {/* ====== TWO COLUMN: TREND + HEATMAP ====== */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
          <Card style={{ padding: 20 }}>
            <SectionHeader title="Flag Trend" subtitle="Weekly auto-detected vs. user-reported" />
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={MOCK.weeklyTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradThreshold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.accent.violet} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={COLORS.accent.violet} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradDelay" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.accent.orange} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={COLORS.accent.orange} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderLight} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: COLORS.textDim }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.textDim }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="threshold" name="Auto-detected" stackId="1" stroke={COLORS.accent.violet} fill="url(#gradThreshold)" strokeWidth={2} />
                <Area type="monotone" dataKey="delay" name="User-reported" stackId="1" stroke={COLORS.accent.orange} fill="url(#gradDelay)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 16, marginTop: 8, justifyContent: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: COLORS.textMuted }}>
                <span style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: COLORS.accent.violet }} /> Auto-detected
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: COLORS.textMuted }}>
                <span style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: COLORS.accent.orange }} /> User-reported
              </span>
            </div>
          </Card>

          <Card style={{ padding: 20 }}>
            <SectionHeader title="Day of Week Heatmap" subtitle="Flag distribution by day and category" />
            <DayHeatmap data={MOCK.dayOfWeekHeatmap} />
          </Card>
        </div>

        {/* ====== TWO COLUMN: FLAG RULES + DELAY TYPES ====== */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
          <Card style={{ padding: 20 }}>
            <SectionHeader title="Auto-Detected Flags" subtitle={`${MOCK.flagRuleBreakdown.reduce((a, b) => a + b.count, 0)} threshold flags by rule`} />
            <HorizontalBarList items={MOCK.flagRuleBreakdown} maxCount={20} />
          </Card>
          <Card style={{ padding: 20 }}>
            <SectionHeader title="Reported Delays" subtitle={`${MOCK.delayTypeBreakdown.reduce((a, b) => a + b.count, 0)} delays by category · avg duration shown`} />
            <HorizontalBarList items={MOCK.delayTypeBreakdown} />
          </Card>
        </div>

        {/* ====== SURGEON FLAG DISTRIBUTION ====== */}
        <Card style={{ marginBottom: 32 }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
            <SectionHeader title="Surgeon Flag Distribution" subtitle="Flag rate by surgeon with top flag category" />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.surfaceAlt }}>
                  {["Surgeon", "Cases", "Flags", "Flag Rate", "Trend", "Top Flag"].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", fontSize: 11, fontWeight: 700, color: COLORS.textDim,
                      textTransform: "uppercase", letterSpacing: "0.05em",
                      textAlign: h === "Surgeon" || h === "Top Flag" ? "left" : "right",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK.surgeonFlags.map((sg, i) => (
                  <tr key={i}
                    onMouseEnter={() => setHoveredSurgeon(i)}
                    onMouseLeave={() => setHoveredSurgeon(null)}
                    style={{
                      borderBottom: `1px solid ${COLORS.border}`,
                      backgroundColor: hoveredSurgeon === i ? COLORS.surfaceHover : "transparent",
                      transition: "background-color 0.1s ease", cursor: "pointer",
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{sg.name}</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'SF Mono', 'JetBrains Mono', monospace", fontSize: 13, color: COLORS.textMuted }}>{sg.cases}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'SF Mono', 'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: COLORS.text }}>{sg.flags}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
                        padding: "2px 8px", borderRadius: 4,
                        color: sg.rate > 35 ? COLORS.accent.rose : sg.rate > 25 ? COLORS.accent.amber : COLORS.accent.emerald,
                        backgroundColor: sg.rate > 35 ? COLORS.accent.roseLight : sg.rate > 25 ? COLORS.accent.amberLight : COLORS.accent.emeraldLight,
                      }}>{sg.rate.toFixed(1)}%</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <TrendBadge value={sg.trend} inverse />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, color: COLORS.textMuted }}>{sg.topFlag}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ====== ROOM ANALYSIS ====== */}
        <SectionHeader title="Room Analysis" subtitle="Flag and delay concentration by operating room" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
          {MOCK.roomFlags.map((room, i) => {
            const barColor = room.rate > 40 ? COLORS.accent.rose : room.rate > 25 ? COLORS.accent.amber : COLORS.accent.emerald;
            const barBg = room.rate > 40 ? COLORS.accent.roseLight : room.rate > 25 ? COLORS.accent.amberLight : COLORS.accent.emeraldLight;
            return (
              <Card key={i} style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{room.room}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                    backgroundColor: barBg, color: barColor,
                  }}>{room.rate.toFixed(0)}%</span>
                </div>
                <div style={{ height: 4, backgroundColor: COLORS.borderLight, borderRadius: 2, marginBottom: 14 }}>
                  <div style={{ height: "100%", borderRadius: 2, width: `${room.rate}%`, backgroundColor: barColor, opacity: 0.7, transition: "width 0.5s ease" }} />
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: COLORS.text }}>{room.flags}</span> flags across <span style={{ fontWeight: 600, color: COLORS.text }}>{room.cases}</span> cases
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                  <div style={{ color: COLORS.textMuted }}>
                    <span style={{ color: COLORS.textDim }}>Top auto:</span>{" "}
                    <span style={{ color: COLORS.accent.violet, fontWeight: 500 }}>{room.topIssue}</span>
                  </div>
                  <div style={{ color: COLORS.textMuted }}>
                    <span style={{ color: COLORS.textDim }}>Top delay:</span>{" "}
                    <span style={{ color: COLORS.accent.orange, fontWeight: 500 }}>{room.topDelay}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* ====== RECENT FLAGGED CASES ====== */}
        <Card>
          <div style={{
            padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            backgroundColor: COLORS.surfaceAlt,
          }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: 0 }}>Recent Flagged Cases</h3>
              <p style={{ fontSize: 12, color: COLORS.textMuted, margin: "2px 0 0" }}>Latest cases with flags attached</p>
            </div>
            <button style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              backgroundColor: COLORS.accent.sky, color: "#fff",
              border: "none", cursor: "pointer",
              boxShadow: `0 1px 3px ${COLORS.accent.sky}40`,
            }}>
              View All →
            </button>
          </div>
          <div>
            {MOCK.recentFlags.map((c, i) => (
              <div key={i} style={{
                padding: "14px 20px",
                borderBottom: i < MOCK.recentFlags.length - 1 ? `1px solid ${COLORS.borderLight}` : "none",
                display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
                transition: "background-color 0.1s ease",
              }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = COLORS.surfaceHover}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <div style={{ width: 115, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent.sky, fontFamily: "'SF Mono', 'JetBrains Mono', monospace" }}>{c.caseNum}</span>
                </div>
                <div style={{ width: 56, flexShrink: 0, fontSize: 12, color: COLORS.textDim }}>{c.date}</div>
                <div style={{ width: 120, flexShrink: 0, fontSize: 13, fontWeight: 500, color: COLORS.text }}>{c.surgeon}</div>
                <div style={{ width: 150, flexShrink: 0, fontSize: 12, color: COLORS.textMuted }}>{c.procedure}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
                  {c.flags.map((f, j) => <FlagBadge key={j} flag={f} />)}
                </div>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
}
