import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Cell,
} from "recharts";

/* ═══════════════════════════════════════════════
   TOKENS
   ═══════════════════════════════════════════════ */
const T = {
  accent: "#2563eb",
  accentGlow: "rgba(37,99,235,0.08)",
  emerald: "#059669",
  emeraldGlow: "rgba(5,150,105,0.08)",
  amber: "#d97706",
  amberGlow: "rgba(217,119,6,0.08)",
  rose: "#e11d48",
  roseGlow: "rgba(225,29,72,0.06)",
  violet: "#7c3aed",
  violetGlow: "rgba(124,58,237,0.08)",
  teal: "#0d9488",
  tealGlow: "rgba(13,148,136,0.08)",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
  white: "#ffffff",
  radius: 10,
  radiusSm: 6,
  shadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
  shadowHover: "0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
};

/* ═══════ MOCK DATA ═══════ */
const mockRooms = [
  { name: "OR 1", status: "In Surgery", surgeon: "Dr. Swartz", procedure: "Mako TKA", elapsed: "0:42", phase: "surgical", progress: 65 },
  { name: "OR 2", status: "Turnover", surgeon: "—", procedure: "—", elapsed: "0:12", phase: "turnover", progress: 40 },
  { name: "OR 3", status: "Pre-Op", surgeon: "Dr. Berra", procedure: "THA", elapsed: "0:08", phase: "preop", progress: 20 },
  { name: "OR 4", status: "Available", surgeon: "—", procedure: "—", elapsed: "—", phase: "idle", progress: 0 },
];

const mockAlerts = [
  { id: 1, severity: "high", title: "OR 2 turnover exceeding 45 min", detail: "Target: 30 min · Current: 47 min", time: "12 min ago" },
  { id: 2, severity: "high", title: "Dr. Chen — 3 late starts this week", detail: "Avg delay: 14 min · Impact: 42 min lost", time: "2h ago" },
  { id: 3, severity: "medium", title: "OR 1 block utilization at 58%", detail: "Dr. Swartz · Target: 75% · Gap: 17%", time: "Today" },
  { id: 4, severity: "low", title: "Case cancellation — OR 4, 2:30p", detail: "Patient-initiated · No backfill available", time: "1h ago" },
  { id: 5, severity: "medium", title: "Post-op bottleneck building", detail: "3 patients waiting for PACU bed · Avg wait: 18 min", time: "Now" },
];

const mockSurgeons = [
  { name: "Dr. Swartz", initials: "ES", cases: 5, completed: 3, onTime: true, orbitScore: 74, grade: "B" },
  { name: "Dr. Berra", initials: "JB", cases: 4, completed: 1, onTime: true, orbitScore: 71, grade: "B" },
  { name: "Dr. Chen", initials: "MC", cases: 3, completed: 2, onTime: false, orbitScore: 52, grade: "C" },
  { name: "Dr. Park", initials: "HP", cases: 2, completed: 2, onTime: true, orbitScore: 83, grade: "A" },
];

const trendData = [
  { day: "Mon", utilization: 72, turnover: 28, fcots: 75 },
  { day: "Tue", utilization: 68, turnover: 32, fcots: 62 },
  { day: "Wed", utilization: 78, turnover: 25, fcots: 87 },
  { day: "Thu", utilization: 74, turnover: 30, fcots: 75 },
  { day: "Fri", utilization: 65, turnover: 35, fcots: 50 },
  { day: "Today", utilization: 71, turnover: 29, fcots: 68 },
];

/* Schedule adherence data — per-room, scheduled vs actual blocks */
const scheduleData = [
  {
    room: "OR 1",
    blocks: [
      { sched: [7.0, 8.5], actual: [7.15, 8.75], label: "Mako TKA", status: "late" },
      { sched: [9.0, 10.5], actual: [9.25, 10.9], label: "Mako THA", status: "late" },
      { sched: [11.0, 12.5], actual: [11.4, 13.0], label: "THA", status: "late" },
      { sched: [13.5, 15.0], actual: [13.5, 14.8], label: "THA", status: "ontime" },
      { sched: [15.5, 17.0], actual: null, label: "TKA", status: "upcoming" },
    ],
  },
  {
    room: "OR 2",
    blocks: [
      { sched: [7.5, 9.0], actual: [7.5, 8.8], label: "TKA", status: "ontime" },
      { sched: [9.5, 11.0], actual: [9.3, 10.9], label: "Revision TKA", status: "ontime" },
      { sched: [11.5, 13.5], actual: [11.5, 13.25], label: "THA", status: "ontime" },
      { sched: [14.0, 15.5], actual: null, label: "Mako TKA", status: "upcoming" },
    ],
  },
  {
    room: "OR 3",
    blocks: [
      { sched: [8.0, 9.5], actual: [8.25, 10.0], label: "Mako THA", status: "late" },
      { sched: [10.0, 11.5], actual: [10.5, 12.1], label: "THA", status: "late" },
      { sched: [12.5, 14.0], actual: null, label: "TKA", status: "upcoming" },
    ],
  },
  {
    room: "OR 4",
    blocks: [
      { sched: [7.0, 8.5], actual: [7.0, 8.4], label: "TKA", status: "ontime" },
      { sched: [9.0, 10.5], actual: [9.0, 10.3], label: "Mako TKA", status: "ontime" },
      { sched: [11.0, 12.5], actual: null, label: "THA", status: "upcoming" },
    ],
  },
];

/* AI Insights */
const aiInsights = [
  {
    id: 1,
    priority: "high",
    title: "First Case Delays",
    headline: "Late starts are costing 47 min/day",
    detail: "3 of 4 rooms started late this week. OR 1 and OR 3 average 14 min behind schedule. Primary cause: patient not in room at block start.",
    impact: "Improving FCOTS from 68% → 85% would recover ~3.2 hrs/week of OR capacity",
    action: "Review pre-op workflow with nursing team",
    pillar: "Schedule Adherence",
    pillarColor: T.amber,
  },
  {
    id: 2,
    priority: "high",
    title: "Turnover Bottleneck — OR 2",
    headline: "OR 2 turnovers run 58% longer than other rooms",
    detail: "Median turnover in OR 2 is 38 min vs 24 min facility-wide. 4 of 6 turnovers this week exceeded 35 min. Cleaning crew overlap with OR 3 appears to be the constraint.",
    impact: "Reducing OR 2 turnover to facility median would add 1 case slot per day",
    action: "Stagger OR 2 / OR 3 schedules by 15 min",
    pillarColor: T.rose,
  },
  {
    id: 3,
    priority: "medium",
    title: "Dr. Chen — Consistency Opportunity",
    headline: "Case duration CV is 2.1× peer average",
    detail: "Dr. Chen's TKA times range from 38–72 min (CV: 0.31) vs peer average of 0.15. Last 3 cases trended longer. ORbit Consistency score: 41/100 (D).",
    impact: "Reaching peer CV would improve schedule adherence by ~20 min/day for Dr. Chen's block",
    action: "Share case-over-case trend with Dr. Chen",
    pillarColor: T.accent,
  },
];

const sparkUtil = [{ v: 72 }, { v: 68 }, { v: 78 }, { v: 74 }, { v: 65 }, { v: 71 }];
const sparkTurn = [{ v: 28 }, { v: 32 }, { v: 25 }, { v: 30 }, { v: 35 }, { v: 29 }];
const sparkFcots = [{ v: 75 }, { v: 62 }, { v: 87 }, { v: 75 }, { v: 50 }, { v: 68 }];
const sparkCases = [{ v: 22 }, { v: 18 }, { v: 25 }, { v: 20 }, { v: 15 }, { v: 12 }];

/* ═══════ SHARED ═══════ */
function ChartTooltipContent({ active, payload, label, unit }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{ background: T.slate800, color: "white", padding: "8px 12px", borderRadius: 8, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: T.slate400, fontSize: 10 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color || p.stroke }} />
          <span style={{ color: T.slate400, fontSize: 11 }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{p.value}{unit || ""}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LIVE PULSE BANNER
   ═══════════════════════════════════════════════ */
function LivePulseBanner() {
  const [pulse, setPulse] = useState(true);
  useEffect(() => { const i = setInterval(() => setPulse(p => !p), 1500); return () => clearInterval(i); }, []);
  const active = mockRooms.filter(r => r.phase === "surgical").length;
  const inTurnover = mockRooms.filter(r => r.phase === "turnover").length;
  const inPreop = mockRooms.filter(r => r.phase === "preop").length;

  return (
    <div style={{ background: T.white, border: "1px solid " + T.slate200, borderRadius: T.radius, boxShadow: T.shadow, padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ position: "relative", width: 10, height: 10 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: T.emerald, opacity: pulse ? 0.3 : 0, transition: "opacity 0.8s", transform: "scale(1.8)" }} />
          <div style={{ position: "relative", width: 10, height: 10, borderRadius: "50%", background: T.emerald }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 650, color: T.slate800, textTransform: "uppercase", letterSpacing: 0.5 }}>Live</span>
      </div>
      <div style={{ width: 1, height: 20, background: T.slate200 }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatusPill count={active} label="In Surgery" color={T.emerald} bg={T.emeraldGlow} />
        <StatusPill count={inTurnover} label="Turnover" color={T.amber} bg={T.amberGlow} />
        <StatusPill count={inPreop} label="Pre-Op" color={T.accent} bg={T.accentGlow} />
        <StatusPill count={4 - active - inTurnover - inPreop} label="Available" color={T.slate400} bg={T.slate100} />
      </div>
      <div style={{ marginLeft: "auto", fontSize: 12, color: T.slate400 }}>
        <span style={{ fontWeight: 600, color: T.slate700 }}>12 / 18</span> cases completed · Next: <span style={{ fontWeight: 600, color: T.slate700 }}>OR 3 @ 1:45p</span>
      </div>
    </div>
  );
}
function StatusPill({ count, label, color, bg }) {
  return <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: bg, fontSize: 11.5, fontWeight: 600, color }}><span style={{ fontSize: 13, fontWeight: 750 }}>{count}</span>{label}</div>;
}

/* ═══════════════════════════════════════════════
   KPI CARDS
   ═══════════════════════════════════════════════ */
function KpiCard({ title, value, trendPct, trendDir, subtitle, target, sparkData, sparkColor }) {
  const isGood = trendDir === "up";
  const statusColor = target ? (target.pct >= 80 ? T.emerald : target.pct >= 50 ? T.amber : T.rose) : (isGood ? T.emerald : T.rose);
  const sparkId = "kpi-" + title.replace(/\s/g, "");
  return (
    <div style={{ background: T.white, border: "1px solid " + T.slate200, borderRadius: T.radius, padding: "16px 20px 14px", boxShadow: T.shadow, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 120 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor }} />
          <span style={{ fontSize: 12.5, fontWeight: 500, color: T.slate600 }}>{title}</span>
        </div>
        {sparkData && (
          <div style={{ width: 72, height: 28, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <defs><linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={sparkColor || statusColor} stopOpacity={0.15} /><stop offset="100%" stopColor={sparkColor || statusColor} stopOpacity={0} /></linearGradient></defs>
                <Area type="monotone" dataKey="v" stroke={sparkColor || statusColor} strokeWidth={1.8} fill={"url(#" + sparkId + ")"} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 750, color: T.slate900, letterSpacing: -0.5, lineHeight: 1 }}>{value}</span>
        {trendPct && <span style={{ fontSize: 12, fontWeight: 650, color: isGood ? T.emerald : T.rose, display: "inline-flex", alignItems: "center", gap: 3 }}>{isGood ? "▲" : "▼"} {trendPct}</span>}
      </div>
      <div style={{ marginTop: 8 }}>
        {target ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: T.slate400, flex: 1 }}>{subtitle}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <div style={{ width: 48, height: 4, borderRadius: 2, background: T.slate100, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, width: Math.min(100, target.pct) + "%", background: target.pct >= 80 ? T.emerald : target.pct >= 50 ? T.amber : T.rose }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: T.slate500 }}>{target.label}</span>
            </div>
          </div>
        ) : <span style={{ fontSize: 11, color: T.slate400 }}>{subtitle}</span>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   FACILITY SCORE MINI
   ═══════════════════════════════════════════════ */
function FacilityScoreMini() {
  const score = 68; const r = 22; const circ = 2 * Math.PI * r; const offset = circ - (score / 100) * circ;
  const grade = score >= 80 ? { l: "A", c: T.emerald } : score >= 65 ? { l: "B", c: T.accent } : score >= 50 ? { l: "C", c: T.amber } : { l: "D", c: T.rose };
  return (
    <div style={{ background: T.white, border: "1px solid " + T.slate200, borderRadius: T.radius, padding: "16px 20px 14px", boxShadow: T.shadow, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 120 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: grade.c }} />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: T.slate600 }}>Facility ORbit Score</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
        <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
          <svg width={52} height={52} viewBox="0 0 52 52" style={{ transform: "rotate(-90deg)" }}>
            <circle cx={26} cy={26} r={r} fill="none" stroke={T.slate200} strokeWidth={4} />
            <circle cx={26} cy={26} r={r} fill="none" stroke={grade.c} strokeWidth={4} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><span style={{ fontSize: 14, fontWeight: 800, color: T.slate900 }}>{score}</span></div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 750, color: T.slate900, lineHeight: 1 }}>{grade.l}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.emerald }}>▲ +3</span>
          </div>
          <div style={{ fontSize: 11, color: T.slate400, marginTop: 2 }}>vs last week</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SCHEDULE ADHERENCE TIMELINE
   Horizontal Gantt — scheduled (ghost) vs actual (solid)
   ═══════════════════════════════════════════════ */
function ScheduleAdherenceTimeline() {
  const startHour = 7;
  const endHour = 17;
  const totalHours = endHour - startHour;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

  // Now marker (simulated at 1:30 PM = 13.5)
  const nowHour = 13.5;
  const nowPct = ((nowHour - startHour) / totalHours) * 100;

  // Summary stats
  const allBlocks = scheduleData.flatMap(r => r.blocks);
  const completed = allBlocks.filter(b => b.actual !== null);
  const late = completed.filter(b => b.status === "late");
  const avgDrift = late.length > 0 ? Math.round(late.reduce((sum, b) => sum + (b.actual[0] - b.sched[0]) * 60, 0) / late.length) : 0;

  return (
    <div style={{ background: T.white, border: "1px solid " + T.slate200, borderRadius: T.radius, padding: "18px 20px", boxShadow: T.shadow }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 650, color: T.slate800 }}>Schedule Adherence</div>
          <div style={{ fontSize: 11, color: T.slate400, marginTop: 1 }}>Scheduled vs actual — are we on track?</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.slate500 }}>
            <div style={{ width: 16, height: 6, borderRadius: 2, background: T.slate200 }} />
            Scheduled
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.slate500 }}>
            <div style={{ width: 16, height: 6, borderRadius: 2, background: T.emerald }} />
            On time
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.slate500 }}>
            <div style={{ width: 16, height: 6, borderRadius: 2, background: T.rose }} />
            Late
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.slate500 }}>
            <div style={{ width: 16, height: 6, borderRadius: 2, background: T.slate300, opacity: 0.5 }} />
            Upcoming
          </div>
        </div>
      </div>

      {/* Summary badges */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.emerald, background: T.emeraldGlow, padding: "3px 10px", borderRadius: 10 }}>
          {completed.length - late.length} on time
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.rose, background: T.roseGlow, padding: "3px 10px", borderRadius: 10 }}>
          {late.length} late · avg drift {avgDrift} min
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.slate500, background: T.slate100, padding: "3px 10px", borderRadius: 10 }}>
          {allBlocks.filter(b => b.status === "upcoming").length} upcoming
        </span>
      </div>

      {/* Time axis */}
      <div style={{ marginLeft: 52, display: "flex", position: "relative", marginBottom: 4 }}>
        {hours.map(h => (
          <div key={h} style={{ flex: 1, fontSize: 9, fontWeight: 500, color: T.slate400, textAlign: "left" }}>
            {h <= 12 ? h + "a" : (h - 12) + "p"}
          </div>
        ))}
      </div>

      {/* Gantt rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {scheduleData.map(room => (
          <div key={room.room} style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {/* Room label */}
            <div style={{ width: 48, flexShrink: 0, fontSize: 11, fontWeight: 650, color: T.slate600, textAlign: "right", paddingRight: 8 }}>
              {room.room}
            </div>

            {/* Timeline bar */}
            <div style={{ flex: 1, position: "relative", height: 28, background: T.slate50, borderRadius: 4, overflow: "hidden", border: "1px solid " + T.slate100 }}>
              {/* Grid lines */}
              {hours.map((h, i) => i > 0 && (
                <div key={h} style={{ position: "absolute", left: ((h - startHour) / totalHours * 100) + "%", top: 0, bottom: 0, width: 1, background: T.slate100 }} />
              ))}

              {/* Now marker */}
              <div style={{ position: "absolute", left: nowPct + "%", top: 0, bottom: 0, width: 1.5, background: T.accent, zIndex: 10, opacity: 0.6 }} />

              {/* Blocks */}
              {room.blocks.map((block, bi) => {
                const schedLeft = ((block.sched[0] - startHour) / totalHours) * 100;
                const schedWidth = ((block.sched[1] - block.sched[0]) / totalHours) * 100;

                const hasActual = block.actual !== null;
                const actLeft = hasActual ? ((block.actual[0] - startHour) / totalHours) * 100 : 0;
                const actWidth = hasActual ? ((block.actual[1] - block.actual[0]) / totalHours) * 100 : 0;

                const isLate = block.status === "late";
                const isUpcoming = block.status === "upcoming";
                const actColor = isLate ? T.rose : T.emerald;

                return (
                  <div key={bi}>
                    {/* Scheduled ghost */}
                    <div style={{
                      position: "absolute",
                      left: schedLeft + "%", width: schedWidth + "%",
                      top: 3, bottom: 3,
                      borderRadius: 3,
                      background: T.slate200,
                      opacity: 0.5,
                    }} />

                    {/* Actual bar */}
                    {hasActual && (
                      <div style={{
                        position: "absolute",
                        left: actLeft + "%", width: actWidth + "%",
                        top: 3, bottom: 3,
                        borderRadius: 3,
                        background: actColor,
                        opacity: 0.75,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        overflow: "hidden",
                      }}>
                        <span style={{ fontSize: 8, fontWeight: 700, color: "white", whiteSpace: "nowrap", opacity: actWidth > 4 ? 1 : 0 }}>{block.label}</span>
                      </div>
                    )}

                    {/* Upcoming — dashed outline */}
                    {isUpcoming && (
                      <div style={{
                        position: "absolute",
                        left: schedLeft + "%", width: schedWidth + "%",
                        top: 3, bottom: 3,
                        borderRadius: 3,
                        border: "1.5px dashed " + T.slate300,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontSize: 8, fontWeight: 600, color: T.slate400, whiteSpace: "nowrap" }}>{block.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   "WHAT SHOULD WE FIX?" — AI INSIGHTS
   ═══════════════════════════════════════════════ */
function InsightsSection() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ background: T.white, border: "1px solid " + T.slate200, borderRadius: T.radius, padding: "18px 20px", boxShadow: T.shadow }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: T.violetGlow, display: "grid", placeItems: "center" }}>
            <span style={{ fontSize: 14 }}>✦</span>
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 650, color: T.slate800 }}>What should we fix?</div>
            <div style={{ fontSize: 11, color: T.slate400, marginTop: 1 }}>AI-generated insights ranked by recoverable OR time</div>
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: T.violet, background: T.violetGlow, padding: "3px 10px", borderRadius: 10 }}>
          {aiInsights.length} insights
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {aiInsights.map((insight, idx) => {
          const isOpen = expanded === insight.id;
          return (
            <InsightCard key={insight.id} insight={insight} index={idx} isOpen={isOpen} onToggle={() => setExpanded(isOpen ? null : insight.id)} />
          );
        })}
      </div>
    </div>
  );
}

function InsightCard({ insight, index, isOpen, onToggle }) {
  const [h, setH] = useState(false);
  const priorityConfig = {
    high: { dot: T.rose, bg: T.roseGlow, label: "#" + (index + 1) + " Priority" },
    medium: { dot: T.amber, bg: T.amberGlow, label: "#" + (index + 1) + " Priority" },
  };
  const pc = priorityConfig[insight.priority] || priorityConfig.medium;

  return (
    <div
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      onClick={onToggle}
      style={{
        borderRadius: 8,
        border: "1px solid " + (isOpen ? insight.pillarColor + "33" : T.slate100),
        background: isOpen ? (insight.pillarColor + "06") : (h ? T.slate50 : T.white),
        overflow: "hidden", cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {/* Header row */}
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Priority rank */}
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: pc.bg, display: "grid", placeItems: "center",
          flexShrink: 0, marginTop: 1,
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: pc.dot }}>{index + 1}</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 650, color: T.slate800 }}>{insight.title}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: insight.pillarColor, background: insight.pillarColor + "15", padding: "1px 6px", borderRadius: 8 }}>
              {insight.pillar || "Operations"}
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.slate600, marginTop: 3, lineHeight: 1.4 }}>{insight.headline}</div>
        </div>

        {/* Expand indicator */}
        <div style={{
          width: 20, height: 20, borderRadius: 4,
          background: T.slate100, display: "grid", placeItems: "center",
          flexShrink: 0, transition: "transform 0.2s",
          transform: isOpen ? "rotate(180deg)" : "none",
        }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={T.slate400} strokeWidth="3" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>

      {/* Expanded detail */}
      {isOpen && (
        <div style={{ padding: "0 14px 14px 48px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: T.slate600, lineHeight: 1.5 }}>{insight.detail}</div>

          {/* Impact callout */}
          <div style={{
            background: T.emeraldGlow, border: "1px solid rgba(5,150,105,0.15)",
            borderRadius: 6, padding: "10px 12px",
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <div style={{ width: 20, height: 20, borderRadius: 4, background: T.emeraldGlow, display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="2.5" strokeLinecap="round"><path d="M22 17l-7-7-4 4L3 6"/><path d="M16 17h6v-6"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 650, color: T.emerald, marginBottom: 2 }}>Projected Impact</div>
              <div style={{ fontSize: 12, color: "#166534", lineHeight: 1.4 }}>{insight.impact}</div>
            </div>
          </div>

          {/* Recommended action */}
          <div style={{
            background: T.accentGlow, border: "1px solid rgba(37,99,235,0.12)",
            borderRadius: 6, padding: "10px 12px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.accent }}>→</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 650, color: T.accent, marginBottom: 1 }}>Recommended Action</div>
              <div style={{ fontSize: 12, color: T.slate700 }}>{insight.action}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ROOM STATUS
   ═══════════════════════════════════════════════ */
const phaseColors = {
  surgical: { bg: T.emeraldGlow, color: T.emerald, label: "In Surgery" },
  turnover: { bg: T.amberGlow, color: T.amber, label: "Turnover" },
  preop: { bg: T.accentGlow, color: T.accent, label: "Pre-Op" },
  idle: { bg: T.slate100, color: T.slate400, label: "Available" },
};

function RoomStatusSection() {
  return (
    <div style={{ background: T.white, border: "1px solid " + T.slate200, borderRadius: T.radius, padding: "16px 20px", boxShadow: T.shadow }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, color: T.slate800 }}>OR Status</div>
        <span style={{ fontSize: 11, color: T.slate400 }}>4 rooms</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {mockRooms.map(room => {
          const phase = phaseColors[room.phase];
          return (
            <div key={room.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, background: T.slate50, border: "1px solid " + T.slate100 }}>
              <div style={{ width: 44, height: 36, borderRadius: 6, background: phase.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: phase.color }}>{room.name}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.slate800 }}>{phase.label}</span>
                  {room.phase === "surgical" && <span style={{ fontSize: 11, color: T.slate500 }}>· {room.procedure}</span>}
                </div>
                {room.surgeon !== "—" && <div style={{ fontSize: 11, color: T.slate400, marginTop: 1 }}>{room.surgeon}</div>}
              </div>
              {room.phase !== "idle" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <div style={{ width: 48, height: 4, borderRadius: 2, background: T.slate100, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 2, width: room.progress + "%", background: phase.color }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.slate600, fontVariantNumeric: "tabular-nums", width: 32, textAlign: "right" }}>{room.elapsed}</span>
                </div>
              ) : <span style={{ fontSize: 11, color: T.slate400 }}>No cases</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   NEEDS ATTENTION
   ═══════════════════════════════════════════════ */
const sevCfg = {
  high: { dot: T.rose, bg: T.roseGlow, border: "rgba(225,29,72,0.15)" },
  medium: { dot: T.amber, bg: T.amberGlow, border: "rgba(217,119,6,0.12)" },
  low: { dot: T.slate400, bg: T.slate100, border: T.slate200 },
};

function NeedsAttentionSection() {
  return (
    <div style={{ background: T.white, border: "1px solid " + T.slate200, borderRadius: T.radius, padding: "16px 20px", boxShadow: T.shadow }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 650, color: T.slate800 }}>Needs Attention</div>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.rose, background: T.roseGlow, padding: "2px 8px", borderRadius: 10 }}>{mockAlerts.filter(a => a.severity === "high").length} urgent</span>
        </div>
        <span style={{ fontSize: 11, color: T.accent, fontWeight: 600, cursor: "pointer" }}>View all</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {mockAlerts.map(alert => {
          const s = sevCfg[alert.severity];
          return (
            <div key={alert.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 8, background: T.slate50, border: "1px solid " + T.slate100, cursor: "pointer" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.slate800, lineHeight: 1.3 }}>{alert.title}</div>
                <div style={{ fontSize: 11, color: T.slate500, marginTop: 2 }}>{alert.detail}</div>
              </div>
              <span style={{ fontSize: 10, color: T.slate400, flexShrink: 0, whiteSpace: "nowrap", marginTop: 2 }}>{alert.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TODAY'S SURGEONS
   ═══════════════════════════════════════════════ */
function TodaysSurgeonsSection() {
  return (
    <div style={{ background: T.white, border: "1px solid " + T.slate200, borderRadius: T.radius, padding: "16px 20px", boxShadow: T.shadow }}>
      <div style={{ fontSize: 13.5, fontWeight: 650, color: T.slate800, marginBottom: 12 }}>Today's Surgeons</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {mockSurgeons.map(s => {
          const gc = s.grade === "A" ? T.emerald : s.grade === "B" ? T.accent : s.grade === "C" ? T.amber : T.rose;
          const gbg = s.grade === "A" ? T.emeraldGlow : s.grade === "B" ? T.accentGlow : s.grade === "C" ? T.amberGlow : T.roseGlow;
          return (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: T.slate50, border: "1px solid " + T.slate100 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accent, color: "white", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center" }}>{s.initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.slate800 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: T.slate400, marginTop: 1 }}>{s.completed}/{s.cases} cases{!s.onTime && <span style={{ color: T.rose, fontWeight: 600, marginLeft: 6 }}>· Late start</span>}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.slate800, fontVariantNumeric: "tabular-nums" }}>{s.orbitScore}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: gc, background: gbg, padding: "2px 6px", borderRadius: 8 }}>{s.grade}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TREND CHART
   ═══════════════════════════════════════════════ */
function WeeklyTrendChart() {
  const [metric, setMetric] = useState("utilization");
  const configs = { utilization: { label: "OR Utilization", color: T.accent, unit: "%" }, turnover: { label: "Median Turnover", color: T.amber, unit: " min" }, fcots: { label: "On-Time Starts", color: T.emerald, unit: "%" } };
  const cfg = configs[metric];
  return (
    <div style={{ background: T.white, border: "1px solid " + T.slate200, borderRadius: T.radius, padding: "18px 20px", boxShadow: T.shadow }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, color: T.slate800 }}>Weekly Trend</div>
        <div style={{ display: "flex", border: "1px solid " + T.slate200, borderRadius: T.radiusSm, overflow: "hidden" }}>
          {Object.entries(configs).map(([key, c]) => (
            <button key={key} onClick={() => setMetric(key)} style={{ padding: "3px 10px", fontSize: 11, fontWeight: 500, border: "none", fontFamily: "inherit", cursor: "pointer", background: metric === key ? T.slate800 : "transparent", color: metric === key ? "white" : T.slate500 }}>{c.label}</button>
          ))}
        </div>
      </div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cfg.color} stopOpacity={0.12} /><stop offset="100%" stopColor={cfg.color} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.slate100} vertical={false} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: T.slate400 }} dy={6} />
            <YAxis axisLine={false} tickLine={false} width={32} tick={{ fontSize: 11, fill: T.slate400 }} />
            <Tooltip content={({ active, payload, label }) => <ChartTooltipContent active={active} payload={payload} label={label} unit={cfg.unit} />} />
            <Area type="monotone" dataKey={metric} name={cfg.label} stroke={cfg.color} strokeWidth={2.5} fill="url(#trendGrad)" dot={{ r: 3, fill: T.white, stroke: cfg.color, strokeWidth: 2 }} activeDot={{ r: 5, fill: cfg.color, stroke: T.white, strokeWidth: 2 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   QUICK ACTIONS
   ═══════════════════════════════════════════════ */
const quickActions = [
  { label: "Block Schedule", desc: "Manage OR block assignments", icon: "◫", color: T.accent, bg: T.accentGlow },
  { label: "Case Calendar", desc: "View upcoming cases", icon: "◷", color: T.emerald, bg: T.emeraldGlow },
  { label: "ORbit Scores", desc: "Surgeon performance scorecards", icon: "◎", color: T.violet, bg: T.violetGlow },
  { label: "Reports", desc: "Analytics & export data", icon: "▤", color: T.amber, bg: T.amberGlow },
];

function QuickActionsRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
      {quickActions.map(a => {
        const [h, setH] = useState(false);
        return (
          <div key={a.label} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
            background: T.white, border: "1px solid " + (h ? a.color : T.slate200), borderRadius: T.radius, padding: "14px 16px",
            boxShadow: h ? T.shadowHover : T.shadow, transition: "all 0.15s", cursor: "pointer", transform: h ? "translateY(-1px)" : "none",
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: a.bg, display: "grid", placeItems: "center", fontSize: 16, color: a.color, marginBottom: 10 }}>{a.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.slate800 }}>{a.label}</div>
            <div style={{ fontSize: 11, color: T.slate400, marginTop: 2 }}>{a.desc}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════ */
export default function Dashboard() {
  const [timeRange, setTimeRange] = useState("today");
  return (
    <div style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", WebkitFontSmoothing: "antialiased", background: T.slate50, minHeight: "100vh", color: T.slate800, padding: "16px 20px" }}>
      <div style={{ maxWidth: 1260, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.slate900 }}>Good afternoon, Ryan</div>
            <div style={{ fontSize: 12, color: T.slate400, marginTop: 2 }}>Riverwalk Surgery Center · Tue, Feb 18</div>
          </div>
          <div style={{ display: "flex", border: "1px solid " + T.slate200, borderRadius: T.radiusSm, overflow: "hidden", background: T.white }}>
            {["Today", "This Week", "This Month"].map(label => {
              const val = label.toLowerCase().replace("this ", "");
              return <button key={label} onClick={() => setTimeRange(val)} style={{ padding: "5px 14px", fontSize: 12, fontWeight: 500, border: "none", fontFamily: "inherit", cursor: "pointer", background: timeRange === val ? T.accent : "transparent", color: timeRange === val ? "white" : T.slate500 }}>{label}</button>;
            })}
          </div>
        </div>

        {/* Live Pulse */}
        <LivePulseBanner />

        {/* KPI Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 12 }}>
          <KpiCard title="OR Utilization" value="71.2%" trendPct="+3.1%" trendDir="up" subtitle="4/4 rooms tracked" target={{ pct: 71, label: "80%" }} sparkData={sparkUtil} sparkColor={T.accent} />
          <KpiCard title="Cases" value="12 / 18" trendPct="" trendDir="up" subtitle="6 remaining today" sparkData={sparkCases} sparkColor={T.emerald} />
          <KpiCard title="Median Turnover" value="29 min" trendPct="-4 min" trendDir="up" subtitle="vs 33 min last week" target={{ pct: 87, label: "25m" }} sparkData={sparkTurn} sparkColor={T.amber} />
          <KpiCard title="On-Time Starts" value="68%" trendPct="-7%" trendDir="down" subtitle="11 of 16 first cases" target={{ pct: 68, label: "85%" }} sparkData={sparkFcots} sparkColor={T.rose} />
          <FacilityScoreMini />
        </div>

        {/* Schedule Adherence Timeline — full width */}
        <div style={{ marginTop: 12 }}>
          <ScheduleAdherenceTimeline />
        </div>

        {/* Needs Attention + "What should we fix?" — side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <NeedsAttentionSection />
          <InsightsSection />
        </div>

        {/* OR Status + Surgeons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <RoomStatusSection />
          <TodaysSurgeonsSection />
        </div>

        {/* Trend Chart */}
        <div style={{ marginTop: 12 }}>
          <WeeklyTrendChart />
        </div>

        {/* Quick Actions */}
        <div style={{ marginTop: 12 }}>
          <QuickActionsRow />
        </div>
      </div>
    </div>
  );
}
