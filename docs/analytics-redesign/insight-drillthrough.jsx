import { useState, useEffect, useRef } from "react";

// ============================================
// SPARKLINE (reused)
// ============================================
const Sparkline = ({ data, color = "#10b981", width = 100, height = 28 }) => {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1, pad = 2;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / range) * (height - pad * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;
  return (
    <svg width={width} height={height}>
      <path d={area} fill={color} opacity={0.07} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={2} fill="#fff" stroke={color} strokeWidth={1.5} />
    </svg>
  );
};

// ============================================
// HORIZONTAL BAR
// ============================================
const HBar = ({ value, max, target, color = "#4f46e5", height = 6 }) => {
  const pct = Math.min((value / max) * 100, 100);
  const targetPct = target ? Math.min((target / max) * 100, 100) : null;
  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <div style={{ width: "100%", height, borderRadius: height / 2, background: "#f1f5f9" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: `${pct}%`, height, borderRadius: height / 2, background: color, transition: "width 0.5s ease" }} />
      {targetPct && (
        <div style={{ position: "absolute", top: -2, left: `${targetPct}%`, width: 1.5, height: height + 4, background: "#94a3b8", borderRadius: 1 }} />
      )}
    </div>
  );
};

// ============================================
// MAIN APP — INSIGHT CARDS + DRILL-THROUGH
// ============================================
export default function InsightDrillThrough() {
  const [activePanel, setActivePanel] = useState(null); // null | 'callback' | 'fcots' | 'utilization'
  const [panelVisible, setPanelVisible] = useState(false);
  const [exportingId, setExportingId] = useState(null);

  const openPanel = (id) => { setActivePanel(id); setTimeout(() => setPanelVisible(true), 20); };
  const closePanel = () => { setPanelVisible(false); setTimeout(() => setActivePanel(null), 300); };

  const handleExport = (id) => {
    setExportingId(id);
    setTimeout(() => setExportingId(null), 2000); // Simulated export
  };

  const mono = "'Geist Mono', monospace";
  const sans = "'Geist', sans-serif";

  // ---- INSIGHT DATA (from insightsEngine.ts output) ----
  const insights = [
    {
      id: "callback",
      severity: "warning",
      title: "Callback Timing Opportunity",
      body: "2 surgeons with flip rooms could benefit from earlier patient callbacks — 34 total idle minutes identified. Dr. Martinez's 4 min flip idle is the facility benchmark. Applying similar timing to Dr. Williams (currently 12 min) could save ~7 min per transition.",
      action: "View surgeon callback details →",
      financial: "~$24K/year if optimized",
      hasPanel: true,
    },
    {
      id: "fcots",
      severity: "critical",
      title: "First Case On-Time Below Target",
      body: "11 of 16 first cases started late — a 31% on-time rate against an 85% target. Wednesdays are the weakest day at 0% on-time. This is 33% worse than the previous period.",
      action: "View delay breakdown →",
      financial: "~$108K/year estimated impact",
      hasPanel: true,
    },
    {
      id: "utilization",
      severity: "warning",
      title: "OR Utilization Below Target",
      body: "42% utilization across 4 rooms against a 75% target. 4 of 4 rooms are underperforming. 2 rooms using default 10h availability.",
      action: "View room breakdown →",
      financial: "~$540K/year in unused capacity",
      hasPanel: true,
    },
    {
      id: "cancellation",
      severity: "positive",
      title: "Zero Same-Day Cancellations",
      body: "No same-day cancellations for 22 consecutive operating days — an exceptional streak reflecting strong pre-op screening.",
      action: "View cancellation history →",
      financial: null,
      hasPanel: false,
    },
  ];

  const severityCfg = {
    critical: { border: "#ef4444", labelBg: "#fee2e2", labelText: "#991b1b" },
    warning: { border: "#f59e0b", labelBg: "#fef3c7", labelText: "#92400e" },
    positive: { border: "#10b981", labelBg: "#dcfce7", labelText: "#166534" },
    info: { border: "#6366f1", labelBg: "#e0e7ff", labelText: "#3730a3" },
  };

  // ---- CALLBACK DETAIL DATA (from analytics.flipRoomAnalysis + surgeonIdleSummaries) ----
  const callbackDetail = {
    summaries: [
      {
        name: "Dr. Martinez", status: "on_track", caseCount: 28, flipGaps: 8, sameGaps: 0,
        medianFlip: 4, medianSame: null, callbackDelta: 0,
        dailyIdle: [6, 3, 5, 4, 2, 5, 4, 3],
        gaps: [
          { date: "Feb 3", from: "Case 1041", to: "Case 1042", fromRoom: "OR-1", toRoom: "OR-3", idle: 4, optimal: 0 },
          { date: "Feb 3", from: "Case 1042", to: "Case 1043", fromRoom: "OR-3", toRoom: "OR-1", idle: 3, optimal: 0 },
          { date: "Feb 5", from: "Case 1058", to: "Case 1059", fromRoom: "OR-1", toRoom: "OR-2", idle: 6, optimal: 1 },
          { date: "Feb 5", from: "Case 1059", to: "Case 1060", fromRoom: "OR-2", toRoom: "OR-1", idle: 2, optimal: 0 },
          { date: "Feb 7", from: "Case 1072", to: "Case 1073", fromRoom: "OR-1", toRoom: "OR-3", idle: 5, optimal: 0 },
        ],
      },
      {
        name: "Dr. Williams", status: "call_sooner", caseCount: 15, flipGaps: 3, sameGaps: 5,
        medianFlip: 12, medianSame: 52, callbackDelta: 7,
        dailyIdle: [14, 10, 12, 15, 8],
        gaps: [
          { date: "Feb 4", from: "Case 1048", to: "Case 1049", fromRoom: "OR-2", toRoom: "OR-4", idle: 14, optimal: 9 },
          { date: "Feb 6", from: "Case 1065", to: "Case 1066", fromRoom: "OR-4", toRoom: "OR-2", idle: 10, optimal: 5 },
          { date: "Feb 10", from: "Case 1089", to: "Case 1090", fromRoom: "OR-2", toRoom: "OR-4", idle: 12, optimal: 7 },
        ],
      },
      {
        name: "Dr. Chen", status: "call_sooner", caseCount: 22, flipGaps: 5, sameGaps: 4,
        medianFlip: 6, medianSame: 42, callbackDelta: 3,
        dailyIdle: [8, 5, 6, 7, 4],
        gaps: [
          { date: "Feb 3", from: "Case 1044", to: "Case 1045", fromRoom: "OR-2", toRoom: "OR-3", idle: 8, optimal: 3 },
          { date: "Feb 5", from: "Case 1055", to: "Case 1056", fromRoom: "OR-3", toRoom: "OR-2", idle: 5, optimal: 0 },
          { date: "Feb 7", from: "Case 1070", to: "Case 1071", fromRoom: "OR-2", toRoom: "OR-1", idle: 6, optimal: 1 },
        ],
      },
    ],
  };

  const statusCfg = {
    on_track: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0", dot: "#22c55e", label: "On Track" },
    call_sooner: { bg: "#fffbeb", text: "#d97706", border: "#fde68a", dot: "#f59e0b", label: "Call Sooner" },
    call_later: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe", dot: "#3b82f6", label: "Call Later" },
    turnover_only: { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", dot: "#94a3b8", label: "Turnover Only" },
  };

  // ---- FCOTS DETAIL DATA (would come from extended calculateFCOTS) ----
  const fcotsDetail = [
    { date: "Feb 3", room: "OR-1", surgeon: "Dr. Martinez", scheduled: "7:30 AM", actual: "7:32 AM", delay: 2, onTime: true },
    { date: "Feb 3", room: "OR-2", surgeon: "Dr. Williams", scheduled: "7:30 AM", actual: "7:48 AM", delay: 18, onTime: false },
    { date: "Feb 3", room: "OR-3", surgeon: "Dr. Chen", scheduled: "8:00 AM", actual: "8:14 AM", delay: 14, onTime: false },
    { date: "Feb 5", room: "OR-1", surgeon: "Dr. Martinez", scheduled: "7:30 AM", actual: "7:31 AM", delay: 1, onTime: true },
    { date: "Feb 5", room: "OR-2", surgeon: "Dr. Patel", scheduled: "7:30 AM", actual: "7:52 AM", delay: 22, onTime: false },
    { date: "Feb 5", room: "OR-4", surgeon: "Dr. Thompson", scheduled: "8:00 AM", actual: "8:25 AM", delay: 25, onTime: false },
    { date: "Feb 7", room: "OR-1", surgeon: "Dr. Martinez", scheduled: "7:30 AM", actual: "7:29 AM", delay: 0, onTime: true },
    { date: "Feb 7", room: "OR-2", surgeon: "Dr. Williams", scheduled: "7:30 AM", actual: "7:55 AM", delay: 25, onTime: false },
    { date: "Feb 7", room: "OR-3", surgeon: "Dr. Chen", scheduled: "8:00 AM", actual: "8:06 AM", delay: 6, onTime: false },
    { date: "Feb 10", room: "OR-1", surgeon: "Dr. Patel", scheduled: "7:30 AM", actual: "7:44 AM", delay: 14, onTime: false },
    { date: "Feb 10", room: "OR-2", surgeon: "Dr. Williams", scheduled: "7:30 AM", actual: "8:02 AM", delay: 32, onTime: false },
    { date: "Feb 10", room: "OR-4", surgeon: "Dr. Thompson", scheduled: "8:00 AM", actual: "8:18 AM", delay: 18, onTime: false },
  ];

  const [selectedSurgeon, setSelectedSurgeon] = useState(null);

  return (
    <div style={{ fontFamily: sans, background: "#f8fafc", color: "#0f172a", minHeight: "100vh", position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "28px 24px 72px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.025em" }}>AI Insights</h1>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 24px" }}>Click any insight to drill into the supporting data. Export to share with your team.</p>

        {/* ---- INSIGHT CARDS ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {insights.map((ins) => {
            const sev = severityCfg[ins.severity];
            return (
              <div key={ins.id}
                onClick={() => ins.hasPanel && openPanel(ins.id)}
                style={{
                  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                  borderLeft: `3px solid ${sev.border}`,
                  padding: "16px 20px", cursor: ins.hasPanel ? "pointer" : "default",
                  transition: "all 0.15s ease",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
                }}
                onMouseEnter={e => { if (ins.hasPanel) { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.borderLeftColor = sev.border; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: sev.labelText, background: sev.labelBg, padding: "2px 8px", borderRadius: 4 }}>{ins.severity}</span>
                    <span style={{ fontSize: 14, fontWeight: 650, color: "#0f172a" }}>{ins.title}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, margin: "0 0 8px" }}>{ins.body}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#4f46e5" }}>{ins.action}</span>
                    {ins.financial && (
                      <span style={{ fontSize: 11, fontWeight: 600, fontFamily: mono, color: "#64748b", background: "#f1f5f9", padding: "3px 8px", borderRadius: 6 }}>{ins.financial}</span>
                    )}
                  </div>
                </div>

                {/* Right side: export button + chevron */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExport(ins.id); }}
                    style={{
                      padding: "6px 12px", fontSize: 11, fontWeight: 600, fontFamily: sans,
                      background: exportingId === ins.id ? "#f0fdf4" : "#f8fafc",
                      color: exportingId === ins.id ? "#16a34a" : "#64748b",
                      border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer",
                      transition: "all 0.15s ease", display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    {exportingId === ins.id ? (
                      <><span style={{ fontSize: 12 }}>✓</span> Exported</>
                    ) : (
                      <><span style={{ fontSize: 12 }}>↓</span> Export</>
                    )}
                  </button>
                  {ins.hasPanel && (
                    <span style={{ color: "#cbd5e1", fontSize: 18, fontWeight: 300 }}>›</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================ */}
      {/* SLIDE-OVER PANEL                            */}
      {/* ============================================ */}
      {activePanel && (
        <>
          {/* Backdrop */}
          <div onClick={closePanel} style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.3)",
            backdropFilter: "blur(2px)", zIndex: 40,
            opacity: panelVisible ? 1 : 0, transition: "opacity 0.25s ease",
          }} />

          {/* Panel */}
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0,
            width: 640, background: "#fff", zIndex: 50,
            boxShadow: "-8px 0 32px rgba(0,0,0,0.08)",
            borderLeft: "1px solid #e2e8f0",
            transform: panelVisible ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            display: "flex", flexDirection: "column",
          }}>
            {/* Panel Header */}
            <div style={{
              padding: "16px 24px", borderBottom: "1px solid #f1f5f9",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#fafbfc", flexShrink: 0,
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    color: severityCfg[insights.find(i => i.id === activePanel)?.severity || "info"].labelText,
                    background: severityCfg[insights.find(i => i.id === activePanel)?.severity || "info"].labelBg,
                    padding: "2px 8px", borderRadius: 4, letterSpacing: "0.06em",
                  }}>{insights.find(i => i.id === activePanel)?.severity}</span>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                    {insights.find(i => i.id === activePanel)?.title}
                  </h2>
                </div>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                  Supporting data for this insight · This Month
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleExport(activePanel)} style={{
                  padding: "7px 14px", fontSize: 12, fontWeight: 600, fontFamily: sans,
                  background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                }}>
                  <span style={{ fontSize: 13 }}>↓</span> Export XLSX
                </button>
                <button onClick={closePanel} style={{
                  padding: "7px 10px", background: "transparent", border: "1px solid #e2e8f0",
                  borderRadius: 8, cursor: "pointer", color: "#94a3b8", fontSize: 16,
                  display: "flex", alignItems: "center",
                }}>✕</button>
              </div>
            </div>

            {/* Panel Content */}
            <div style={{ flex: 1, overflow: "auto", padding: 24 }}>

              {/* ===== CALLBACK PANEL ===== */}
              {activePanel === "callback" && (
                <div>
                  {/* Benchmark comparison */}
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 650, color: "#0f172a", margin: "0 0 12px" }}>Surgeon Comparison</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {callbackDetail.summaries.map(s => {
                        const sc = statusCfg[s.status];
                        const maxIdle = 20;
                        return (
                          <div key={s.name}
                            onClick={() => setSelectedSurgeon(selectedSurgeon === s.name ? null : s.name)}
                            style={{
                              background: selectedSurgeon === s.name ? "#fafbfc" : "#fff",
                              border: `1px solid ${selectedSurgeon === s.name ? "#cbd5e1" : "#f1f5f9"}`,
                              borderRadius: 10, padding: "14px 16px", cursor: "pointer",
                              transition: "all 0.12s ease",
                            }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{s.name}</span>
                                <span style={{
                                  fontSize: 10, fontWeight: 600, color: sc.text, background: sc.bg,
                                  padding: "2px 8px", borderRadius: 99, border: `1px solid ${sc.border}`,
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                }}>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot }} />
                                  {sc.label}
                                </span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <Sparkline data={s.dailyIdle} color={s.status === "on_track" ? "#10b981" : "#f59e0b"} width={64} height={22} />
                                <span style={{ fontSize: 10, color: "#94a3b8" }}>{selectedSurgeon === s.name ? "▾" : "▸"}</span>
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                              <div>
                                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>Flip Idle</div>
                                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: mono, color: s.medianFlip <= 5 ? "#10b981" : s.medianFlip <= 10 ? "#d97706" : "#ef4444" }}>
                                  {s.medianFlip}m
                                </div>
                                <HBar value={s.medianFlip} max={maxIdle} target={5} color={s.medianFlip <= 5 ? "#10b981" : s.medianFlip <= 10 ? "#f59e0b" : "#ef4444"} />
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>Call Δ</div>
                                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: mono, color: s.callbackDelta > 3 ? "#d97706" : "#64748b" }}>
                                  {s.callbackDelta > 0 ? `${s.callbackDelta}m` : "—"}
                                </div>
                                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                                  {s.callbackDelta > 0 ? "call earlier" : "on time"}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>Cases</div>
                                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: mono, color: "#1e293b" }}>{s.caseCount}</div>
                                <div style={{ fontSize: 10, color: "#94a3b8" }}>{s.flipGaps} flips</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>Same Rm</div>
                                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: mono, color: s.medianSame ? (s.medianSame <= 30 ? "#10b981" : "#d97706") : "#cbd5e1" }}>
                                  {s.medianSame ? `${s.medianSame}m` : "—"}
                                </div>
                                {s.sameGaps > 0 && <div style={{ fontSize: 10, color: "#94a3b8" }}>{s.sameGaps} gaps</div>}
                              </div>
                            </div>

                            {/* Expanded: gap-by-gap detail */}
                            {selectedSurgeon === s.name && (
                              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
                                <div style={{ fontSize: 11, fontWeight: 650, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                                  Flip Room Transitions
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 50px 50px 64px", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                                  {["Date", "From", "To", "Idle", "Save", ""].map(h => (
                                    <span key={h} style={{ fontSize: 9, fontWeight: 650, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
                                  ))}
                                </div>
                                {s.gaps.map((g, i) => (
                                  <div key={i} style={{
                                    display: "grid", gridTemplateColumns: "60px 1fr 1fr 50px 50px 64px",
                                    padding: "8px 0", borderBottom: "1px solid #fafbfc", alignItems: "center",
                                  }}>
                                    <span style={{ fontSize: 12, color: "#64748b" }}>{g.date}</span>
                                    <div>
                                      <span style={{ fontSize: 12, color: "#1e293b", fontWeight: 500 }}>{g.from}</span>
                                      <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 4 }}>{g.fromRoom}</span>
                                    </div>
                                    <div>
                                      <span style={{ fontSize: 12, color: "#1e293b", fontWeight: 500 }}>{g.to}</span>
                                      <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 4 }}>{g.toRoom}</span>
                                    </div>
                                    <span style={{
                                      fontSize: 13, fontWeight: 600, fontFamily: mono,
                                      color: g.idle <= 5 ? "#10b981" : g.idle <= 10 ? "#d97706" : "#ef4444",
                                    }}>{g.idle}m</span>
                                    <span style={{
                                      fontSize: 13, fontWeight: 600, fontFamily: mono,
                                      color: g.optimal > 0 ? "#d97706" : "#cbd5e1",
                                    }}>{g.optimal > 0 ? `${g.optimal}m` : "—"}</span>
                                    <HBar value={g.idle} max={20} target={5}
                                      color={g.idle <= 5 ? "#10b981" : g.idle <= 10 ? "#f59e0b" : "#ef4444"} height={4} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recommendation box */}
                  <div style={{
                    background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10,
                    padding: "14px 16px", marginBottom: 24,
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 14, lineHeight: 1 }}>💡</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>Recommendation</div>
                        <p style={{ fontSize: 12, color: "#78350f", lineHeight: 1.5, margin: 0 }}>
                          For Dr. Williams, call the next patient to the flip room <strong>7 minutes earlier</strong> than current practice.
                          For Dr. Chen, a <strong>3 minute</strong> earlier callback would close the gap. Dr. Martinez is the benchmark — no change needed.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Financial summary */}
                  <div style={{
                    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
                    padding: "14px 16px",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 650, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                      Financial Impact Estimate
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>Recoverable min/day</div>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: mono, color: "#0f172a" }}>11</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>Revenue rate</div>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: mono, color: "#0f172a" }}>$36<span style={{ fontSize: 11, color: "#94a3b8" }}>/min</span></div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>Annual projection</div>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: mono, color: "#4f46e5" }}>$24K</div>
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: "10px 0 0", fontStyle: "italic" }}>
                      Based on $36/OR minute, 250 operating days/year. Configure in Settings.
                    </p>
                  </div>
                </div>
              )}

              {/* ===== FCOTS PANEL ===== */}
              {activePanel === "fcots" && (
                <div>
                  {/* Summary strip */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                    {[
                      { label: "On-Time Rate", value: "31%", color: "#ef4444" },
                      { label: "Late Cases", value: "11", color: "#ef4444" },
                      { label: "Total First Cases", value: "16", color: "#1e293b" },
                      { label: "Avg Delay", value: "16m", color: "#d97706" },
                    ].map((s, i) => (
                      <div key={i} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", border: "1px solid #f1f5f9" }}>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" }}>{s.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: mono, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Per-case table */}
                  <h3 style={{ fontSize: 13, fontWeight: 650, color: "#0f172a", margin: "0 0 10px" }}>First Case Detail</h3>
                  <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "60px 56px 110px 72px 72px 56px 60px", padding: "8px 14px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                      {["Date", "Room", "Surgeon", "Sched", "Actual", "Delay", "Status"].map(h => (
                        <span key={h} style={{ fontSize: 9, fontWeight: 650, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
                      ))}
                    </div>
                    {fcotsDetail.map((c, i) => (
                      <div key={i} style={{
                        display: "grid", gridTemplateColumns: "60px 56px 110px 72px 72px 56px 60px",
                        padding: "9px 14px", borderBottom: i < fcotsDetail.length - 1 ? "1px solid #fafbfc" : "none",
                        alignItems: "center",
                      }}>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{c.date}</span>
                        <span style={{ fontSize: 12, color: "#1e293b", fontWeight: 500 }}>{c.room}</span>
                        <span style={{ fontSize: 12, color: "#1e293b" }}>{c.surgeon}</span>
                        <span style={{ fontSize: 12, color: "#64748b", fontFamily: mono }}>{c.scheduled}</span>
                        <span style={{ fontSize: 12, color: c.onTime ? "#10b981" : "#ef4444", fontFamily: mono, fontWeight: 600 }}>{c.actual}</span>
                        <span style={{
                          fontSize: 12, fontFamily: mono, fontWeight: 600,
                          color: c.delay <= 2 ? "#10b981" : c.delay <= 10 ? "#d97706" : "#ef4444",
                        }}>{c.delay > 0 ? `+${c.delay}m` : "0m"}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                          background: c.onTime ? "#f0fdf4" : "#fef2f2",
                          color: c.onTime ? "#16a34a" : "#991b1b",
                        }}>{c.onTime ? "On Time" : "Late"}</span>
                      </div>
                    ))}
                  </div>

                  {/* Pattern analysis */}
                  <div style={{ marginTop: 20, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 14, lineHeight: 1 }}>📊</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#991b1b", marginBottom: 4 }}>Pattern Detected</div>
                        <p style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.5, margin: 0 }}>
                          <strong>Dr. Williams</strong> was late for 3 of 3 first cases (avg +25 min). <strong>OR-2</strong> had the most delays (4 of 4 days).
                          Consider scheduling Dr. Williams in later slots or addressing arrival timing directly.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== UTILIZATION PANEL ===== */}
              {activePanel === "utilization" && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                    {[
                      { label: "Above Target", value: "0", color: "#10b981", bg: "#f0fdf4" },
                      { label: "Near Target", value: "1", color: "#d97706", bg: "#fffbeb" },
                      { label: "Below 60%", value: "3", color: "#64748b", bg: "#f8fafc" },
                    ].map((s, i) => (
                      <div key={i} style={{ background: s.bg, borderRadius: 8, padding: "12px 14px", border: "1px solid #f1f5f9", textAlign: "center" }}>
                        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: mono, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {[
                    { room: "OR-1", util: 58, cases: 42, days: 18, hours: "5.2h avg / 10h", status: "near" },
                    { room: "OR-2", util: 44, cases: 35, days: 17, hours: "4.4h avg / 10h", status: "below" },
                    { room: "OR-3", util: 38, cases: 28, days: 15, hours: "3.8h avg / 10h", status: "below" },
                    { room: "OR-4", util: 28, cases: 22, days: 12, hours: "2.8h avg / 10h", status: "below" },
                  ].map((r, i) => (
                    <div key={i} style={{
                      background: "#fff", border: "1px solid #f1f5f9", borderRadius: 10,
                      padding: "14px 16px", marginBottom: 8,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 650, color: "#0f172a" }}>{r.room}</span>
                          {r.status === "below" && <span style={{ fontSize: 10, color: "#d97706", background: "#fffbeb", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>Default hours</span>}
                        </div>
                        <span style={{
                          fontSize: 20, fontWeight: 700, fontFamily: mono,
                          color: r.util >= 75 ? "#10b981" : r.util >= 60 ? "#d97706" : "#64748b",
                        }}>{r.util}%</span>
                      </div>
                      <HBar value={r.util} max={100} target={75}
                        color={r.util >= 75 ? "#10b981" : r.util >= 60 ? "#f59e0b" : "#94a3b8"} height={8} />
                      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
                        <span>{r.cases} cases</span>
                        <span>{r.days} days active</span>
                        <span>{r.hours}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
