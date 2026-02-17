import { useState, useEffect, useMemo } from "react";

// ============================================
// SPARKLINE
// ============================================
const Sparkline = ({ data, color = "#10b981", width = 120, height = 32, showArea = true, strokeWidth = 1.5 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / range) * (height - pad * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      {showArea && <path d={area} fill={color} opacity={0.07} />}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={2.5} fill="#fff" stroke={color} strokeWidth={1.5} />
    </svg>
  );
};

// ============================================
// STATUS INDICATOR
// ============================================
const StatusDot = ({ status, size = 7 }) => {
  const colors = { good: "#10b981", warn: "#f59e0b", bad: "#ef4444" };
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      background: colors[status],
      boxShadow: `0 0 0 3px ${colors[status]}18`,
      display: "inline-block", flexShrink: 0,
    }} />
  );
};

// ============================================
// TREND BADGE
// ============================================
const TrendBadge = ({ value, inverse = false }) => {
  if (value === null || value === undefined) return null;
  const isUp = value > 0;
  const isGood = inverse ? !isUp : isUp;
  const color = isGood ? "#10b981" : "#ef4444";
  const bg = isGood ? "#f0fdf4" : "#fef2f2";
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color, background: bg,
      padding: "2px 7px", borderRadius: 99,
      display: "inline-flex", alignItems: "center", gap: 3,
      fontFamily: "'Geist Mono', monospace", lineHeight: 1,
    }}>
      <span style={{ fontSize: 8 }}>{isUp ? "▲" : "▼"}</span>
      {Math.abs(value)}%
    </span>
  );
};

// ============================================
// MINI TARGET GAUGE
// ============================================
const TargetGauge = ({ value, target, inverse = false, unit = "%" }) => {
  const ratio = inverse ? target / Math.max(value, 1) : value / Math.max(target, 1);
  const isGood = inverse ? value <= target : value >= target;
  const color = isGood ? "#10b981" : ratio > 0.7 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 44, height: 3, borderRadius: 2, background: "#e2e8f0" }}>
        <div style={{
          width: `${Math.min(ratio * 100, 100)}%`, height: "100%",
          borderRadius: 2, background: color, transition: "width 0.6s ease",
        }} />
      </div>
      <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'Geist Mono', monospace" }}>
        {target}{unit}
      </span>
    </div>
  );
};

// ============================================
// RADAR CHART
// ============================================
const RadarChart = ({ scores, size = 150 }) => {
  const cx = size / 2, cy = size / 2, r = size / 2 - 24;
  const labels = Object.keys(scores);
  const values = Object.values(scores);
  const step = (2 * Math.PI) / labels.length;
  const pt = (i, v) => ({
    x: cx + Math.cos(step * i - Math.PI / 2) * r * (v / 100),
    y: cy + Math.sin(step * i - Math.PI / 2) * r * (v / 100),
  });
  const grid = [0.25, 0.5, 0.75, 1];
  const dataPts = values.map((v, i) => pt(i, v));
  const path = dataPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {grid.map(lv => (
        <polygon key={lv}
          points={labels.map((_, i) => { const p = pt(i, lv * 100); return `${p.x},${p.y}`; }).join(" ")}
          fill="none" stroke="#e2e8f0" strokeWidth={0.75}
        />
      ))}
      {labels.map((_, i) => {
        const end = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#e2e8f0" strokeWidth={0.5} />;
      })}
      <polygon points={dataPts.map(p => `${p.x},${p.y}`).join(" ")}
        fill="#4f46e5" fillOpacity={0.1} stroke="#4f46e5" strokeWidth={1.5} />
      {dataPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#4f46e5" stroke="#fff" strokeWidth={1.5} />
      ))}
      {labels.map((label, i) => {
        const p = pt(i, 128);
        return (
          <text key={label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fill="#64748b" fontSize={9} fontWeight={500} fontFamily="'Geist', sans-serif">
            {label}
          </text>
        );
      })}
    </svg>
  );
};

// ============================================
// SECTION HEADING
// ============================================
const Section = ({ title, subtitle, children, badge }) => (
  <section style={{ marginBottom: 28 }}>
    <div style={{ marginBottom: 14, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <div>
        <h2 style={{
          fontSize: 15, fontWeight: 650, color: "#0f172a", margin: 0,
          fontFamily: "'Geist', sans-serif", letterSpacing: "-0.01em",
        }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0" }}>{subtitle}</p>}
      </div>
      {badge}
    </div>
    {children}
  </section>
);

// ============================================
// MAIN DASHBOARD
// ============================================
export default function ORbitDashboard() {
  const [period, setPeriod] = useState("This Month");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 80); }, []);

  const periods = ["Today", "Yesterday", "This Week", "This Month", "All Time"];

  // ---- DATA (matches analyticsV2 output) ----
  const kpis = [
    { label: "First Case On-Time", value: "31%", num: 31, target: 85, trend: -33, status: "bad", detail: "11 of 16 first cases late", spark: [45,38,52,20,35,18,31], icon: "⏱" },
    { label: "OR Utilization", value: "42%", num: 42, target: 75, trend: -7, status: "bad", detail: "0/4 rooms above 75% target", spark: [50,48,55,42,38,45,42], icon: "📊" },
    { label: "Case Volume", value: "127", num: 127, target: null, trend: 15, status: "good", detail: "48 completed · 127 total", spark: [98,105,112,108,118,122,127], icon: "📦", trendUp: true },
    { label: "Same-Day Cancellation", value: "0.0%", num: 0, target: 5, status: "good", detail: "0 same-day of 0 total", spark: [2,1,0,1,0,0,0], icon: "✓", inverse: true },
  ];

  const turnovers = [
    { label: "Same Room Turnover", value: 40, unit: "min", target: 30, trend: -26, status: "bad", detail: "41% under 30 min target", spark: [35,42,38,45,32,44,40] },
    { label: "Same-Room Surgical", value: 54, unit: "min", target: 45, trend: -4, status: "warn", detail: "28% ≤45 min · 18 turnovers", spark: [58,52,56,50,55,48,54] },
    { label: "Flip-Room Surgical", value: 24, unit: "min", target: 15, trend: 4, status: "warn", detail: "30% ≤15 min · 20 flips", spark: [28,22,26,20,25,22,24] },
    { label: "Non-Operative Time", value: 27, unit: "min", target: null, trend: null, status: "warn", detail: "33% of total case time · 49 cases", spark: [32,28,30,25,29,26,27] },
  ];

  const orbitScores = { Profit: 72, Consistency: 58, Adherence: 34, Availability: 65, Efficiency: 45, Volume: 78 };
  const overallScore = Math.round(Object.values(orbitScores).reduce((a, b) => a + b, 0) / Object.keys(orbitScores).length);

  const surgeons = [
    { name: "Dr. Martinez", flipIdle: 4, sameIdle: null, cases: 28, flips: 8, sameGaps: 0, status: "on_track", statusLabel: "On Track" },
    { name: "Dr. Chen", flipIdle: 6, sameIdle: 42, cases: 22, flips: 5, sameGaps: 4, status: "call_sooner", statusLabel: "Call Sooner" },
    { name: "Dr. Patel", flipIdle: null, sameIdle: 68, cases: 18, flips: 0, sameGaps: 6, status: "turnover_only", statusLabel: "Turnover Only" },
    { name: "Dr. Williams", flipIdle: 12, sameIdle: 52, cases: 15, flips: 3, sameGaps: 5, status: "call_sooner", statusLabel: "Call Sooner" },
    { name: "Dr. Thompson", flipIdle: null, sameIdle: 61, cases: 12, flips: 0, sameGaps: 4, status: "turnover_only", statusLabel: "Turnover Only" },
  ];

  const insights = [
    {
      severity: "critical", title: "First Case On-Time Below Target",
      body: "11 of 16 first cases started late — a 31% on-time rate against an 85% target. Wednesdays are the weakest day at 0% on-time. This is 33% worse than the previous period.",
      action: "View delay breakdown →", financial: "~$108K/year estimated impact",
    },
    {
      severity: "warning", title: "Callback Timing Opportunity",
      body: "2 surgeons with flip rooms could benefit from earlier patient callbacks — 34 total idle minutes identified. Dr. Martinez's 4 min flip idle is the facility benchmark. Applying similar timing to Dr. Williams (currently 12 min) could save ~7 min per transition.",
      action: "View surgeon callback details →", financial: "~$24K/year if optimized",
    },
    {
      severity: "warning", title: "OR Utilization Below Target",
      body: "42% utilization across 4 rooms against a 75% target. 4 of 4 rooms are underperforming. Note: 2 rooms are using default 10h availability — configuring actual hours in Settings may change these numbers significantly.",
      action: "View room breakdown →", financial: "~$540K/year in unused capacity",
    },
    {
      severity: "positive", title: "Zero Same-Day Cancellations",
      body: "No same-day cancellations for 22 consecutive operating days — an exceptional streak. This reflects strong pre-operative screening and patient preparation processes.",
      action: "View cancellation history →", financial: null,
    },
    {
      severity: "warning", title: "Non-Operative Time Opportunity",
      body: "33% of total case time is non-operative (27 min average). The pre-op phase at 18 min is the larger contributor. A 20% reduction in pre-op time would recover ~4 min per case — equivalent to 48 min of OR capacity daily.",
      action: "View time breakdown →", financial: "~$43K/year if pre-op reduced 20%",
    },
  ];

  // ---- STYLES ----
  const card = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    transition: "all 0.15s ease",
  };
  const hoverCard = (e, enter) => {
    e.currentTarget.style.borderColor = enter ? "#cbd5e1" : "#e2e8f0";
    e.currentTarget.style.boxShadow = enter ? "0 2px 8px rgba(0,0,0,0.04)" : "none";
  };

  const statusCfg = {
    on_track: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0", dot: "#22c55e" },
    call_sooner: { bg: "#fffbeb", text: "#d97706", border: "#fde68a", dot: "#f59e0b" },
    call_later: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe", dot: "#3b82f6" },
    turnover_only: { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", dot: "#94a3b8" },
  };

  const severityCfg = {
    critical: { border: "#ef4444", bg: "#fef2f2", icon: "🔴", labelBg: "#fee2e2", labelText: "#991b1b" },
    warning: { border: "#f59e0b", bg: "#fffbeb", icon: "🟡", labelBg: "#fef3c7", labelText: "#92400e" },
    positive: { border: "#10b981", bg: "#f0fdf4", icon: "🟢", labelBg: "#dcfce7", labelText: "#166534" },
    info: { border: "#6366f1", bg: "#eef2ff", icon: "🔵", labelBg: "#e0e7ff", labelText: "#3730a3" },
  };

  const mono = "'Geist Mono', monospace";
  const sans = "'Geist', sans-serif";

  return (
    <div style={{ fontFamily: sans, background: "#f8fafc", color: "#0f172a", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "28px 24px 72px" }}>

        {/* ========= HEADER ========= */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28,
          opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(-6px)", transition: "all 0.35s ease",
        }}>
          <div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px", letterSpacing: "0.02em" }}>
              Riverwalk Surgery Center <span style={{ color: "#cbd5e1", margin: "0 6px" }}>›</span> Analytics
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.025em", color: "#0f172a" }}>
              Analytics Overview
            </h1>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 0" }}>48 completed cases analyzed · 127 total</p>
          </div>
          <div style={{ display: "flex", gap: 2, background: "#fff", borderRadius: 10, padding: 3, border: "1px solid #e2e8f0" }}>
            {periods.map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: "6px 14px", fontSize: 12, fontWeight: period === p ? 600 : 450,
                border: "none", borderRadius: 8, cursor: "pointer", fontFamily: sans,
                background: period === p ? "#4f46e5" : "transparent",
                color: period === p ? "#fff" : "#64748b",
                transition: "all 0.12s ease",
              }}>{p}</button>
            ))}
          </div>
        </div>

        {/* ========= LAYER 1: HEALTH OVERVIEW ========= */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 260px", gap: 16, marginBottom: 28,
          opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(6px)", transition: "all 0.4s ease 0.08s",
        }}>
          {/* ORbit Score */}
          <div style={{ ...card, display: "flex", alignItems: "center", gap: 28, padding: "20px 24px" }}>
            <RadarChart scores={orbitScores} size={146} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", fontFamily: mono, letterSpacing: "-0.03em" }}>{overallScore}</span>
                <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>/ 100 ORbit Score</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 20px" }}>
                {Object.entries(orbitScores).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <StatusDot status={v >= 70 ? "good" : v >= 50 ? "warn" : "bad"} size={6} />
                    <span style={{ fontSize: 12, color: "#64748b", flex: 1 }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", fontFamily: mono }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Items */}
          <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 10, fontWeight: 650, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Action Items
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1 }}>
              {[
                { text: "First case on-time at 31%", s: "bad" },
                { text: "OR utilization below 50%", s: "bad" },
                { text: "2 surgeons need earlier callbacks", s: "warn" },
                { text: "22-day zero cancellation streak", s: "good" },
              ].map((a, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 0",
                  borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
                }}>
                  <StatusDot status={a.s} size={6} />
                  <span style={{ fontSize: 12, color: "#475569", lineHeight: 1.35 }}>{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========= LAYER 2: KPI STRIP ========= */}
        <div style={{ opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(6px)", transition: "all 0.4s ease 0.12s" }}>
          <Section title="How are we tracking?" subtitle="Core KPIs vs targets">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {kpis.map(kpi => (
                <div key={kpi.label} style={{ ...card, padding: "16px 18px", cursor: "default" }}
                  onMouseEnter={e => hoverCard(e, true)} onMouseLeave={e => hoverCard(e, false)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                        <StatusDot status={kpi.status} size={6} />
                        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{kpi.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", fontFamily: mono, letterSpacing: "-0.02em" }}>
                          {kpi.value}
                        </span>
                        {kpi.trend !== null && <TrendBadge value={kpi.trend} inverse={kpi.inverse} />}
                      </div>
                    </div>
                    <Sparkline data={kpi.spark}
                      color={kpi.status === "good" ? "#10b981" : kpi.status === "warn" ? "#f59e0b" : "#ef4444"}
                      width={68} height={30} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{kpi.detail}</span>
                    {kpi.target && <TargetGauge value={kpi.num} target={kpi.target} inverse={kpi.inverse} />}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ========= LAYER 3: TWO-COLUMN OPERATIONAL ========= */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28,
          opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(6px)", transition: "all 0.4s ease 0.16s",
        }}>
          {/* LEFT: Turnover */}
          <Section title="Where are we losing time?" subtitle="Room turnover & non-operative time">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {turnovers.map(t => (
                <div key={t.label} style={{
                  ...card, padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 12, cursor: "default",
                }}
                  onMouseEnter={e => hoverCard(e, true)} onMouseLeave={e => hoverCard(e, false)}>
                  <StatusDot status={t.status} size={6} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#334155", marginBottom: 2 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.detail}</div>
                  </div>
                  <Sparkline data={t.spark}
                    color={t.status === "good" ? "#10b981" : t.status === "warn" ? "#f59e0b" : "#ef4444"}
                    width={68} height={24} />
                  <div style={{ textAlign: "right", minWidth: 56 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 2 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: mono }}>{t.value}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{t.unit}</span>
                    </div>
                    {t.trend !== null && <TrendBadge value={t.trend} inverse />}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* RIGHT: Callback */}
          <Section title="What should we fix?" subtitle="Surgeon callback optimization & idle time">
            <div style={{ ...card, overflow: "hidden" }}>
              {/* Summary strip */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid #f1f5f9" }}>
                {[
                  { label: "Overall Median", value: "38 min", sub: "5 surgeons", color: "#0f172a" },
                  { label: "Flip Room Idle", value: "8 min", sub: "2 w/ flips", color: "#4f46e5" },
                  { label: "Same Room Idle", value: "56 min", sub: "3 same-room", color: "#d97706" },
                ].map((s, i) => (
                  <div key={i} style={{
                    padding: "14px 16px",
                    borderRight: i < 2 ? "1px solid #f1f5f9" : "none",
                  }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: mono }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Table header */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 56px 56px 44px 80px",
                padding: "8px 16px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9",
              }}>
                {["Surgeon", "Flip", "Same", "Cases", "Status"].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 650, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
                ))}
              </div>

              {/* Rows */}
              {surgeons.map((s, i) => {
                const sc = statusCfg[s.status];
                return (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "1fr 56px 56px 44px 80px",
                    padding: "10px 16px", alignItems: "center",
                    borderBottom: i < surgeons.length - 1 ? "1px solid #f8fafc" : "none",
                    transition: "background 0.1s", cursor: "default",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fafbfc"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 550, color: "#1e293b" }}>{s.name}</span>
                      <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                        {s.flips > 0 && <span style={{ fontSize: 10, color: "#6366f1", background: "#eef2ff", padding: "1px 5px", borderRadius: 4 }}>{s.flips} flips</span>}
                        {s.sameGaps > 0 && <span style={{ fontSize: 10, color: "#d97706", background: "#fffbeb", padding: "1px 5px", borderRadius: 4 }}>{s.sameGaps} same</span>}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 13, fontFamily: mono, fontWeight: 600,
                      color: s.flipIdle !== null ? (s.flipIdle <= 5 ? "#10b981" : s.flipIdle <= 10 ? "#d97706" : "#ef4444") : "#cbd5e1",
                    }}>{s.flipIdle !== null ? `${s.flipIdle}m` : "—"}</span>
                    <span style={{
                      fontSize: 13, fontFamily: mono, fontWeight: 500,
                      color: s.sameIdle !== null ? (s.sameIdle <= 30 ? "#10b981" : s.sameIdle <= 50 ? "#d97706" : "#ef4444") : "#cbd5e1",
                    }}>{s.sameIdle !== null ? `${s.sameIdle}m` : "—"}</span>
                    <span style={{ fontSize: 13, color: "#64748b", fontFamily: mono }}>{s.cases}</span>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 10, fontWeight: 600,
                      color: sc.text, background: sc.bg,
                      padding: "3px 8px", borderRadius: 99,
                      border: `1px solid ${sc.border}`,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot }} />
                      {s.statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* ========= LAYER 4: AI INSIGHTS ========= */}
        <div style={{ opacity: loaded ? 1 : 0, transform: loaded ? "none" : "translateY(6px)", transition: "all 0.4s ease 0.2s" }}>
          <Section title="AI Insights"
            subtitle="Prioritized opportunities ranked by financial impact"
            badge={
              <span style={{
                fontSize: 10, fontWeight: 650, color: "#4f46e5", background: "#eef2ff",
                padding: "4px 10px", borderRadius: 99, letterSpacing: "0.04em",
              }}>POWERED BY ORBIT ENGINE</span>
            }>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {insights.map((ins, i) => {
                const cfg = severityCfg[ins.severity];
                return (
                  <div key={i} style={{
                    ...card, padding: "16px 20px",
                    borderLeft: `3px solid ${cfg.border}`,
                    display: "flex", gap: 16, alignItems: "flex-start",
                    cursor: "pointer",
                  }}
                    onMouseEnter={e => hoverCard(e, true)} onMouseLeave={e => hoverCard(e, false)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                          color: cfg.labelText, background: cfg.labelBg,
                          padding: "2px 8px", borderRadius: 4,
                        }}>{ins.severity}</span>
                        <span style={{ fontSize: 14, fontWeight: 650, color: "#0f172a" }}>{ins.title}</span>
                      </div>
                      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.55, margin: "0 0 10px" }}>{ins.body}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#4f46e5" }}>{ins.action}</span>
                        {ins.financial && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, fontFamily: mono,
                            color: "#64748b", background: "#f1f5f9",
                            padding: "3px 8px", borderRadius: 6,
                          }}>{ins.financial}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
