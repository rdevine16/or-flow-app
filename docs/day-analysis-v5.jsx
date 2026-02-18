import { useState, useMemo } from "react";

// ============================================
// DATA MODEL
// ============================================
const PHASE_TREE = [
  { key: "preOp", label: "Pre-Op", color: "#60a5fa", subphases: [{ key: "anesthesia", label: "Anesthesia", color: "#ef4444" }] },
  { key: "surgical", label: "Surgical", color: "#818cf8", subphases: [] },
  { key: "closing", label: "Closing", color: "#34d399", subphases: [] },
  { key: "emergence", label: "Emergence", color: "#fbbf24", subphases: [] },
];

const PHASE_COLOR_MAP = {};
const PHASE_LABEL_MAP = {};
PHASE_TREE.forEach((p) => {
  PHASE_COLOR_MAP[p.key] = p.color;
  PHASE_LABEL_MAP[p.key] = p.label;
  p.subphases.forEach((s) => { PHASE_COLOR_MAP[s.key] = s.color; PHASE_LABEL_MAP[s.key] = s.label; });
});

const HISTORICAL_MEDIANS = {
  global: { preOp: 18, surgical: 38, closing: 4, emergence: 3, anesthesia: 10 },
  byProcedure: {
    TKA: { preOp: 19, surgical: 45, closing: 5, emergence: 3, anesthesia: 11, orTime: 72 },
    "Mako TKA": { preOp: 20, surgical: 40, closing: 4, emergence: 3, anesthesia: 12, orTime: 67 },
    "Mako THA": { preOp: 19, surgical: 35, closing: 5, emergence: 3, anesthesia: 10, orTime: 62 },
  },
};

const FACILITY_THRESHOLDS = { lateStartMinutes: 10, longTurnoverMinutes: 30 };

const MOCK_CASES = [
  { id: "1", caseNumber: "RW-00299", procedure: "TKA", room: "OR 1", startTime: "07:08", endTime: "08:17", scheduledStart: "07:00", phases: { preOp: 20, surgical: 47, closing: 5, emergence: 3 }, subphases: { anesthesia: { parent: "preOp", offset: 3, duration: 12 } }, totalMin: 69 },
  { id: "2", caseNumber: "RW-00300", procedure: "TKA", room: "OR 1", startTime: "08:42", endTime: "09:42", scheduledStart: null, phases: { preOp: 20, surgical: 30, closing: 6, emergence: 4 }, subphases: { anesthesia: { parent: "preOp", offset: 2, duration: 14 } }, totalMin: 60 },
  { id: "3", caseNumber: "RW-00301", procedure: "Mako TKA", room: "OR 2", startTime: "09:00", endTime: "10:04", scheduledStart: null, phases: { preOp: 20, surgical: 42, closing: 1, emergence: 1 }, subphases: { anesthesia: { parent: "preOp", offset: 4, duration: 11 } }, totalMin: 64 },
  { id: "4", caseNumber: "RW-00302", procedure: "TKA", room: "OR 1", startTime: "10:05", endTime: "11:09", scheduledStart: null, phases: { preOp: 20, surgical: 42, closing: 1, emergence: 1 }, subphases: { anesthesia: { parent: "preOp", offset: 3, duration: 10 } }, totalMin: 64 },
  { id: "5", caseNumber: "RW-00303", procedure: "TKA", room: "OR 2", startTime: "10:30", endTime: "11:39", scheduledStart: null, phases: { preOp: 20, surgical: 47, closing: 1, emergence: 1 }, subphases: { anesthesia: { parent: "preOp", offset: 2, duration: 13 } }, totalMin: 69 },
  { id: "6", caseNumber: "RW-00304", procedure: "Mako THA", room: "OR 1", startTime: "11:30", endTime: "12:34", scheduledStart: null, phases: { preOp: 20, surgical: 34, closing: 6, emergence: 4 }, subphases: { anesthesia: { parent: "preOp", offset: 3, duration: 11 } }, totalMin: 64 },
  { id: "7", caseNumber: "RW-00305", procedure: "Mako THA", room: "OR 2", startTime: "12:10", endTime: "13:20", scheduledStart: null, phases: { preOp: 22, surgical: 38, closing: 5, emergence: 5 }, subphases: { anesthesia: { parent: "preOp", offset: 4, duration: 12 } }, totalMin: 70 },
  { id: "8", caseNumber: "RW-00306", procedure: "Mako THA", room: "OR 1", startTime: "13:10", endTime: "14:12", scheduledStart: null, phases: { preOp: 18, surgical: 36, closing: 4, emergence: 4 }, subphases: { anesthesia: { parent: "preOp", offset: 2, duration: 10 } }, totalMin: 62 },
];

const MOCK_DAY = { firstCaseStart: "07:08 am", scheduledStart: "7:00 am", totalCases: 8, totalORTime: "8:32:00", totalSurgicalTime: "5:04:00", uptimePercent: 59 };

// ============================================
// FLAG DETECTION
// ============================================
function detectCaseFlags(c, caseIndex, allCases) {
  const flags = [];
  const procMedians = HISTORICAL_MEDIANS.byProcedure[c.procedure];
  if (caseIndex === 0 && c.scheduledStart) {
    const delay = timeToMinutes(c.startTime) - timeToMinutes(c.scheduledStart);
    if (delay > FACILITY_THRESHOLDS.lateStartMinutes) flags.push({ type: "late_start", severity: "warning", label: "Late Start", detail: `+${delay}m vs scheduled`, icon: "⏰" });
    else if (delay > 0) flags.push({ type: "late_start", severity: "info", label: "Late Start", detail: `+${delay}m`, icon: "⏰" });
  }
  const samePrior = allCases.filter((o) => o.room === c.room && timeToMinutes(o.endTime) <= timeToMinutes(c.startTime) && o.id !== c.id).sort((a, b) => timeToMinutes(b.endTime) - timeToMinutes(a.endTime));
  if (samePrior.length > 0) {
    const gap = timeToMinutes(c.startTime) - timeToMinutes(samePrior[0].endTime);
    if (gap >= FACILITY_THRESHOLDS.longTurnoverMinutes) flags.push({ type: "long_turnover", severity: "warning", label: "Long Turnover", detail: `${gap}m gap`, icon: "🔄" });
  }
  if (procMedians) {
    Object.entries(c.phases).forEach(([phase, dur]) => { const med = procMedians[phase]; if (med && (dur - med) / med > 0.4) flags.push({ type: `ext_${phase}`, severity: "caution", label: `Extended ${PHASE_LABEL_MAP[phase]}`, detail: `${dur}m vs ${med}m med`, icon: phase === "surgical" ? "🔪" : phase === "closing" ? "🩹" : phase === "preOp" ? "📋" : "💤" }); });
    if (c.subphases) Object.entries(c.subphases).forEach(([key, sp]) => { const med = procMedians[key]; if (med && (sp.duration - med) / med > 0.3) flags.push({ type: `ext_${key}`, severity: "caution", label: `Extended ${PHASE_LABEL_MAP[key]}`, detail: `${sp.duration}m vs ${med}m med`, icon: "💉" }); });
  }
  if (procMedians?.orTime && ((procMedians.orTime - c.totalMin) / procMedians.orTime) * 100 > 15) flags.push({ type: "fast_case", severity: "positive", label: "Fast Case", detail: `${c.totalMin}m vs ${procMedians.orTime}m med`, icon: "⚡" });
  return flags;
}

// ============================================
// HELPERS
// ============================================
function timeToMinutes(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minutesToTime(m) { const h = Math.floor(m / 60); const min = m % 60; const suffix = h >= 12 ? "PM" : "AM"; const dh = h > 12 ? h - 12 : h === 0 ? 12 : h; return `${dh}:${String(min).padStart(2, "0")} ${suffix}`; }
function medianOf(arr) { if (!arr.length) return 0; const sorted = [...arr].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; }

const FLAG_STYLES = {
  warning: { bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.3)", text: "#c2410c" },
  caution: { bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.25)", text: "#a16207" },
  info: { bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)", text: "#2563eb" },
  positive: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)", text: "#16a34a" },
};

const SUB_PHASE_COLOR = "#ef4444"; // red for anesthesia pill

// ============================================
// SHARED COMPONENTS
// ============================================
function MetricPill({ label, value, sub, accent = false }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium tracking-wide uppercase" style={{ color: "#94a3b8", letterSpacing: "0.05em" }}>{label}</span>
      <span className={`text-lg font-semibold tabular-nums ${accent ? "text-blue-600" : "text-slate-900"}`} style={{ fontFeatureSettings: "'tnum'" }}>{value}</span>
      {sub && <span className="text-xs text-slate-400 -mt-0.5">{sub}</span>}
    </div>
  );
}

function UptimeRing({ percent }) {
  const r = 28, circ = 2 * Math.PI * r, offset = circ - (percent / 100) * circ;
  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: 64, height: 64 }}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
          <circle cx="32" cy="32" r={r} fill="none" stroke="#3b82f6" strokeWidth="5" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 32 32)" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center"><span className="text-sm font-bold text-slate-900">{percent}%</span></div>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium tracking-wide uppercase" style={{ color: "#94a3b8", letterSpacing: "0.05em" }}>Utilization</span>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Surgical</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "#fca5a5" }} />Other</span>
        </div>
      </div>
    </div>
  );
}

function FlagCountPills({ allFlags }) {
  const warnings = allFlags.filter((f) => f.flag.severity === "warning" || f.flag.severity === "caution").length;
  const positives = allFlags.filter((f) => f.flag.severity === "positive").length;
  if (warnings + positives === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      {warnings > 0 && <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(251,146,60,0.1)", color: "#c2410c" }}><span style={{ fontSize: 10 }}>●</span> {warnings} {warnings === 1 ? "flag" : "flags"}</span>}
      {positives > 0 && <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.08)", color: "#16a34a" }}>⚡ {positives} fast</span>}
    </div>
  );
}

function FlagBadge({ flag, compact = false }) {
  const s = FLAG_STYLES[flag.severity];
  if (compact) return <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }} title={`${flag.label}: ${flag.detail}`}>{flag.icon}</span>;
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>{flag.icon} {flag.label}</span>;
}

function SidebarFlagList({ allFlags }) {
  if (allFlags.length === 0) return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <span className="text-lg mb-1">✓</span>
      <span className="text-xs font-medium text-slate-500">No flags today</span>
      <span className="text-[10px] text-slate-400 mt-0.5">All cases within thresholds</span>
    </div>
  );
  return (
    <div className="space-y-1.5">
      {allFlags.map(({ caseNumber, flag }, i) => {
        const s = FLAG_STYLES[flag.severity];
        return (
          <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ background: s.bg }}>
            <span className="text-sm flex-shrink-0 mt-0.5">{flag.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold" style={{ color: s.text }}>{flag.label}</span>
                <span className="text-[10px] font-mono text-slate-400">{caseNumber}</span>
              </div>
              <span className="text-[10px] text-slate-500 block">{flag.detail}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PhaseMedianComparison({ dayMedians, historicalMedians }) {
  const rows = [];
  PHASE_TREE.forEach((phase) => {
    rows.push({ key: phase.key, label: phase.label, color: phase.color, isSubphase: false });
    phase.subphases.forEach((sp) => { rows.push({ key: sp.key, label: sp.label, color: sp.color, isSubphase: true }); });
  });
  const maxVal = Math.max(...rows.map((r) => Math.max(dayMedians[r.key] || 0, historicalMedians[r.key] || 0)));
  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const today = dayMedians[row.key] || 0;
        const hist = historicalMedians[row.key] || 0;
        const diff = today - hist;
        const pctDiff = hist > 0 ? Math.round((diff / hist) * 100) : 0;
        const isImproved = diff <= 0;
        return (
          <div key={row.key} style={{ marginLeft: row.isSubphase ? 12 : 0 }}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                {row.isSubphase && <span className="text-slate-300 text-[10px]">└</span>}
                <span className="rounded-sm" style={{ width: row.isSubphase ? 7 : 8, height: row.isSubphase ? 7 : 8, background: row.color }} />
                <span style={{ fontSize: row.isSubphase ? 11 : 12 }}>{row.label}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold tabular-nums text-slate-900">{today}m</span>
                {pctDiff !== 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums" style={{ background: isImproved ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: isImproved ? "#16a34a" : "#dc2626" }}>{isImproved ? "↓" : "↑"} {Math.abs(pctDiff)}%</span>}
              </div>
            </div>
            <div className="relative rounded overflow-hidden bg-slate-50" style={{ height: row.isSubphase ? 10 : 14 }}>
              <div className="absolute top-0 rounded-t" style={{ width: `${(hist / maxVal) * 100}%`, height: "50%", background: row.color, opacity: 0.2 }} />
              <div className="absolute bottom-0 rounded-b" style={{ width: `${(today / maxVal) * 100}%`, height: "50%", background: row.color, opacity: 0.85, transition: "width 0.4s ease" }} />
              {hist > 0 && <div className="absolute top-0 bottom-0" style={{ left: `${(hist / maxVal) * 100}%`, width: 1.5, background: "#64748b", opacity: 0.35 }} />}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">hist: {hist}m</div>
          </div>
        );
      })}
    </div>
  );
}

function PhaseTreeLegend() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {PHASE_TREE.map((phase) => (
        <div key={phase.key} className="flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: phase.color }} />
            {phase.label}
          </span>
          {phase.subphases.map((sp) => (
            <span key={sp.key} className="flex items-center gap-1 text-[11px] text-slate-400">
              <span className="w-[7px] h-[7px] rounded-sm inline-block" style={{ background: sp.color }} />
              {sp.label}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================
// Helper: compute sub-phase position within a phase segment
// Returns { leftPct, widthPct } relative to the PARENT PHASE segment
// ============================================
function getSubphasePositionInParent(phases, sp) {
  const parentDur = phases[sp.parent] || 1;
  return {
    leftPct: (sp.offset / parentDur) * 100,
    widthPct: (sp.duration / parentDur) * 100,
  };
}

// ============================================
// TIMELINE — sub-phase rendered as inset pill inside parent segment
// ============================================
function TimelineView({ cases, caseFlags }) {
  const rooms = [...new Set(cases.map((c) => c.room))].sort();
  const allStarts = cases.map((c) => timeToMinutes(c.startTime));
  const allEnds = cases.map((c) => timeToMinutes(c.endTime));
  const dayStart = Math.floor(Math.min(...allStarts) / 30) * 30;
  const dayEnd = Math.ceil(Math.max(...allEnds) / 30) * 30;
  const totalSpan = dayEnd - dayStart;
  const hourMarkers = []; for (let m = dayStart; m <= dayEnd; m += 60) hourMarkers.push(m);
  const halfHourMarkers = []; for (let m = dayStart; m <= dayEnd; m += 30) { if (m % 60 !== 0) halfHourMarkers.push(m); }
  const [hoveredCase, setHoveredCase] = useState(null);

  const turnovers = useMemo(() => {
    const result = [];
    rooms.forEach((room) => {
      const rc = cases.filter((c) => c.room === room).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      for (let i = 1; i < rc.length; i++) {
        const gap = timeToMinutes(rc[i].startTime) - timeToMinutes(rc[i - 1].endTime);
        if (gap > 0) result.push({ room, start: timeToMinutes(rc[i - 1].endTime), end: timeToMinutes(rc[i].startTime), duration: gap });
      }
    });
    return result;
  }, [cases, rooms]);

  // Track height for the main bar
  const TRACK_H = 38;

  return (
    <div className="mt-4">
      <div className="flex">
        <div style={{ width: 72, flexShrink: 0 }} />
        <div className="flex-1 relative" style={{ height: 24 }}>
          {hourMarkers.map((m) => <div key={m} className="absolute text-xs font-medium text-slate-400" style={{ left: `${((m - dayStart) / totalSpan) * 100}%`, transform: "translateX(-50%)" }}>{minutesToTime(m)}</div>)}
        </div>
      </div>

      {rooms.map((room, ri) => {
        const roomCases = cases.filter((c) => c.room === room);
        const roomTurnovers = turnovers.filter((t) => t.room === room);
        return (
          <div key={room} className="flex items-center" style={{ height: TRACK_H + 16, marginBottom: ri < rooms.length - 1 ? 4 : 0 }}>
            <div className="flex items-center justify-center text-xs font-semibold text-slate-500 bg-slate-100 rounded-md" style={{ width: 64, height: 32, flexShrink: 0, marginRight: 8 }}>{room}</div>
            <div className="flex-1 relative rounded-lg" style={{ height: TRACK_H, background: "#f8fafc" }}>
              {hourMarkers.map((m) => <div key={m} className="absolute top-0 bottom-0" style={{ left: `${((m - dayStart) / totalSpan) * 100}%`, width: 1, background: "#e2e8f0" }} />)}
              {halfHourMarkers.map((m) => <div key={m} className="absolute top-0 bottom-0" style={{ left: `${((m - dayStart) / totalSpan) * 100}%`, width: 1, background: "#f1f5f9" }} />)}

              {/* Turnovers */}
              {roomTurnovers.map((t, i) => (
                <div key={`t-${i}`} className="absolute top-1 bottom-1 rounded flex items-center justify-center" style={{ left: `${((t.start - dayStart) / totalSpan) * 100}%`, width: `${(t.duration / totalSpan) * 100}%`, background: "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(251,146,60,0.08) 3px, rgba(251,146,60,0.08) 6px)", border: "1px dashed rgba(251,146,60,0.3)", minWidth: 20 }}>
                  <span className="text-[10px] font-semibold text-amber-600/70 whitespace-nowrap">{t.duration}m</span>
                </div>
              ))}

              {/* Case blocks with inset sub-phase pills */}
              {roomCases.map((c) => {
                const cStart = timeToMinutes(c.startTime);
                const cDuration = timeToMinutes(c.endTime) - cStart;
                const leftPct = ((cStart - dayStart) / totalSpan) * 100;
                const widthPct = (cDuration / totalSpan) * 100;
                const isHovered = hoveredCase === c.id;
                const totalPhase = Object.values(c.phases).reduce((a, b) => a + b, 0);
                const flags = caseFlags[c.id] || [];
                const hasWarning = flags.some((f) => f.severity === "warning" || f.severity === "caution");
                const hasPositive = flags.some((f) => f.severity === "positive");

                // Pre-compute cumulative phase offsets for positioning sub-phase pills
                const phaseOffsets = {};
                let cumulative = 0;
                for (const [pk, pv] of Object.entries(c.phases)) {
                  phaseOffsets[pk] = { startPct: (cumulative / totalPhase) * 100, widthPct: (pv / totalPhase) * 100 };
                  cumulative += pv;
                }

                return (
                  <div key={c.id} className="absolute overflow-visible cursor-pointer" style={{ left: `${leftPct}%`, width: `${widthPct}%`, top: 2, bottom: 2, minWidth: 30, zIndex: isHovered ? 10 : 1 }}
                    onMouseEnter={() => setHoveredCase(c.id)} onMouseLeave={() => setHoveredCase(null)}>

                    {/* Phase segments */}
                    <div className="absolute inset-0 rounded-md overflow-hidden flex" style={{ boxShadow: isHovered ? "0 2px 8px rgba(0,0,0,0.15)" : "0 1px 2px rgba(0,0,0,0.06)", transform: isHovered ? "translateY(-1px)" : "none", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}>
                      {Object.entries(c.phases).map(([phase, dur]) => (
                        <div key={phase} className="h-full relative" style={{ width: `${(dur / totalPhase) * 100}%`, background: PHASE_COLOR_MAP[phase], opacity: isHovered ? 1 : 0.85 }} />
                      ))}
                    </div>

                    {/* Sub-phase inset pills — rendered INSIDE parent segment at bottom 25% */}
                    {c.subphases && Object.entries(c.subphases).map(([spKey, sp]) => {
                      const parentInfo = phaseOffsets[sp.parent];
                      if (!parentInfo) return null;
                      const posInParent = getSubphasePositionInParent(c.phases, sp);
                      // Convert from parent-relative to case-relative percentages
                      const pillLeft = parentInfo.startPct + (posInParent.leftPct / 100) * parentInfo.widthPct;
                      const pillWidth = (posInParent.widthPct / 100) * parentInfo.widthPct;

                      return (
                        <div
                          key={spKey}
                          className="absolute rounded-sm"
                          style={{
                            left: `${pillLeft}%`,
                            width: `${pillWidth}%`,
                            bottom: 0,
                            height: "25%",
                            background: SUB_PHASE_COLOR,
                            opacity: isHovered ? 0.9 : 0.7,
                            transition: "opacity 0.15s ease",
                            minWidth: 3,
                            borderRadius: "0 0 2px 2px",
                          }}
                          title={`${PHASE_LABEL_MAP[spKey]}: ${sp.duration}m`}
                        />
                      );
                    })}

                    {/* Label */}
                    <div className="absolute inset-0 flex items-center px-1.5" style={{ pointerEvents: "none" }}>
                      <span className="text-[10px] font-bold text-white truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>{c.procedure}</span>
                    </div>

                    {/* Flag dots */}
                    {(hasWarning || hasPositive) && (
                      <div className="absolute -top-1.5 -right-1 flex gap-0.5" style={{ pointerEvents: "none" }}>
                        {hasWarning && <span className="w-2.5 h-2.5 rounded-full border border-white" style={{ background: "#f97316", boxShadow: "0 1px 3px rgba(249,115,22,0.4)" }} />}
                        {hasPositive && <span className="w-2.5 h-2.5 rounded-full border border-white" style={{ background: "#22c55e", boxShadow: "0 1px 3px rgba(34,197,94,0.4)" }} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-4 mt-3 ml-[72px] text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(251,146,60,0.15) 2px, rgba(251,146,60,0.15) 4px)", border: "1px dashed rgba(251,146,60,0.4)" }} /> Turnover
        </span>
        <span className="text-slate-400">Avg: {turnovers.length > 0 ? Math.round(turnovers.reduce((a, t) => a + t.duration, 0) / turnovers.length) : 0}m</span>
        <span className="text-slate-300">|</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-sm inline-block" style={{ background: SUB_PHASE_COLOR, opacity: 0.7 }} /> Sub-phase (bottom 25%)
        </span>
      </div>
    </div>
  );
}

// ============================================
// CASE BREAKDOWN BAR — sub-phase as inset pill at bottom 25%
// ============================================
function CasePhaseBarNested({ c, maxTotal, isSelected, onSelect, flags }) {
  const totalPhase = Object.values(c.phases).reduce((a, b) => a + b, 0);
  const barWidthPct = (totalPhase / maxTotal) * 100;

  // Pre-compute phase positions
  const phaseOffsets = {};
  let cumulative = 0;
  for (const [pk, pv] of Object.entries(c.phases)) {
    phaseOffsets[pk] = { startPct: (cumulative / totalPhase) * 100, widthPct: (pv / totalPhase) * 100 };
    cumulative += pv;
  }

  const BAR_HEIGHT = 24;

  return (
    <div
      className={`py-2.5 px-3 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"}`}
      onClick={() => onSelect(isSelected ? null : c.id)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono font-semibold text-blue-600">{c.caseNumber}</span>
          <span className="text-[11px] text-slate-500">{c.procedure}</span>
          {flags.map((f, i) => <FlagBadge key={i} flag={f} compact />)}
        </div>
        <span className="text-sm font-semibold tabular-nums text-slate-700">{totalPhase}m</span>
      </div>

      {/* Phase bar with inset sub-phase pill */}
      <div className="relative" style={{ height: BAR_HEIGHT }}>
        {/* Parent phases */}
        <div className="absolute top-0 left-0 h-full flex rounded overflow-hidden" style={{ width: `${barWidthPct}%`, minWidth: 40 }}>
          {Object.entries(c.phases).map(([phase, dur]) => (
            <div key={phase} className="h-full flex items-center justify-center relative" style={{ width: `${(dur / totalPhase) * 100}%`, background: PHASE_COLOR_MAP[phase], minWidth: dur > 5 ? 24 : 0 }}>
              {dur >= 8 && <span className="text-[10px] font-semibold text-white/90 relative z-10">{dur}m</span>}
            </div>
          ))}
        </div>

        {/* Sub-phase inset pills at bottom 25% */}
        {c.subphases && Object.entries(c.subphases).map(([spKey, sp]) => {
          const parentInfo = phaseOffsets[sp.parent];
          if (!parentInfo) return null;
          const posInParent = getSubphasePositionInParent(c.phases, sp);
          const pillLeft = (parentInfo.startPct + (posInParent.leftPct / 100) * parentInfo.widthPct) / 100 * barWidthPct;
          const pillWidth = ((posInParent.widthPct / 100) * parentInfo.widthPct) / 100 * barWidthPct;

          return (
            <div
              key={spKey}
              className="absolute rounded-sm"
              style={{
                left: `${pillLeft}%`,
                width: `${pillWidth}%`,
                bottom: 0,
                height: "25%",
                background: SUB_PHASE_COLOR,
                opacity: 0.8,
                minWidth: 3,
                borderRadius: "0 0 3px 3px",
              }}
              title={`${PHASE_LABEL_MAP[spKey]}: ${sp.duration}m`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// CASE DETAIL PANEL
// ============================================
function CaseDetailPanel({ c, flags }) {
  if (!c) return null;
  const procMedians = HISTORICAL_MEDIANS.byProcedure[c.procedure];
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-mono font-semibold text-blue-600">{c.caseNumber}</span>
          <h4 className="text-sm font-semibold text-slate-900 mt-0.5">{c.procedure}</h4>
        </div>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{c.room}</span>
      </div>
      {flags.length > 0 && <div className="space-y-1.5 mb-4">{flags.map((f, i) => <FlagBadge key={i} flag={f} />)}</div>}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Start</span><span className="font-medium text-slate-900 tabular-nums">{minutesToTime(timeToMinutes(c.startTime))}</span></div>
        <div className="flex items-center justify-between text-sm"><span className="text-slate-500">End</span><span className="font-medium text-slate-900 tabular-nums">{minutesToTime(timeToMinutes(c.endTime))}</span></div>
        <div className="h-px bg-slate-100 my-2" />

        {Object.entries(c.phases).map(([phase, dur]) => {
          const hist = procMedians?.[phase];
          const diff = hist ? dur - hist : null;
          const childSps = c.subphases ? Object.entries(c.subphases).filter(([, sp]) => sp.parent === phase) : [];
          return (
            <div key={phase} className="mb-1">
              <div className="flex items-center justify-between py-0.5">
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: PHASE_COLOR_MAP[phase] }} />
                  {PHASE_LABEL_MAP[phase]}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{dur}m</span>
                  {diff !== null && diff !== 0 && <span className="text-[10px] font-semibold tabular-nums" style={{ color: diff <= 0 ? "#16a34a" : "#dc2626" }}>{diff > 0 ? "+" : ""}{diff}m</span>}
                </div>
              </div>
              {hist && <div className="ml-[18px] text-[10px] text-slate-400 -mt-0.5 mb-0.5">med: {hist}m</div>}
              {childSps.map(([spKey, sp]) => {
                const spHist = procMedians?.[spKey];
                const spDiff = spHist ? sp.duration - spHist : null;
                return (
                  <div key={spKey} className="ml-4 border-l-2 pl-2 py-0.5" style={{ borderColor: SUB_PHASE_COLOR + "50" }}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
                        <span className="w-[7px] h-[7px] rounded-sm" style={{ background: SUB_PHASE_COLOR }} />
                        {PHASE_LABEL_MAP[spKey]}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold tabular-nums text-slate-800">{sp.duration}m</span>
                        {spDiff !== null && spDiff !== 0 && <span className="text-[10px] font-semibold tabular-nums" style={{ color: spDiff <= 0 ? "#16a34a" : "#dc2626" }}>{spDiff > 0 ? "+" : ""}{spDiff}m</span>}
                      </div>
                    </div>
                    {spHist && <div className="ml-[15px] text-[10px] text-slate-400 -mt-0.5">med: {spHist}m</div>}
                  </div>
                );
              })}
            </div>
          );
        })}
        <div className="h-px bg-slate-100 my-2" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Total</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold tabular-nums text-slate-900">{c.totalMin}m</span>
            {procMedians?.orTime && <span className="text-[10px] font-semibold tabular-nums" style={{ color: c.totalMin <= procMedians.orTime ? "#16a34a" : "#dc2626" }}>{c.totalMin - procMedians.orTime > 0 ? "+" : ""}{c.totalMin - procMedians.orTime}m</span>}
          </div>
        </div>
        {procMedians?.orTime && <div className="text-[10px] text-slate-400 text-right -mt-1">med: {procMedians.orTime}m</div>}
      </div>
    </div>
  );
}

// ============================================
// MAIN
// ============================================
export default function DayAnalysisV5() {
  const [selectedCase, setSelectedCase] = useState(null);
  const cases = MOCK_CASES;
  const day = MOCK_DAY;
  const maxTotal = Math.max(...cases.map((c) => Object.values(c.phases).reduce((a, b) => a + b, 0)));

  const caseFlags = useMemo(() => { const map = {}; cases.forEach((c, i) => { map[c.id] = detectCaseFlags(c, i, cases); }); return map; }, [cases]);
  const allFlags = useMemo(() => { const arr = []; cases.forEach((c) => { (caseFlags[c.id] || []).forEach((flag) => { arr.push({ caseNumber: c.caseNumber, flag }); }); }); return arr; }, [cases, caseFlags]);
  const dayMedians = useMemo(() => ({ preOp: medianOf(cases.map((c) => c.phases.preOp)), surgical: medianOf(cases.map((c) => c.phases.surgical)), closing: medianOf(cases.map((c) => c.phases.closing)), emergence: medianOf(cases.map((c) => c.phases.emergence)), anesthesia: medianOf(cases.map((c) => c.subphases?.anesthesia?.duration || 0)) }), [cases]);
  const selectedCaseData = cases.find((c) => c.id === selectedCase);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Summary strip */}
      <div className="bg-white rounded-xl border border-slate-200 p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <MetricPill label="First Case" value={day.firstCaseStart} sub={`Sched. ${day.scheduledStart}`} accent />
            <div className="w-px h-10 bg-slate-100" />
            <MetricPill label="Cases" value={day.totalCases} />
            <div className="w-px h-10 bg-slate-100" />
            <MetricPill label="OR Time" value={day.totalORTime} />
            <div className="w-px h-10 bg-slate-100" />
            <MetricPill label="Surgical" value={day.totalSurgicalTime} />
            {allFlags.length > 0 && (<><div className="w-px h-10 bg-slate-100" /><FlagCountPills allFlags={allFlags} /></>)}
          </div>
          <UptimeRing percent={day.uptimePercent} />
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mt-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Day Timeline</h3>
            <p className="text-xs text-slate-400 mt-0.5">Red strip at bottom of each block = sub-phase (e.g. Anesthesia within Pre-Op)</p>
          </div>
          <PhaseTreeLegend />
        </div>
        <TimelineView cases={cases} caseFlags={caseFlags} />
      </div>

      {/* Bottom */}
      <div className="flex gap-4 mt-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex-1 min-w-0" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Case Breakdown</h3>
            <span className="text-xs text-slate-400">{cases.length} cases</span>
          </div>
          <div className="space-y-0.5">
            {cases.map((c) => <CasePhaseBarNested key={c.id} c={c} maxTotal={maxTotal} isSelected={selectedCase === c.id} onSelect={setSelectedCase} flags={caseFlags[c.id] || []} />)}
          </div>
        </div>
        <div className="flex flex-col gap-4" style={{ width: 280, flexShrink: 0 }}>
          <div className="bg-white rounded-xl border border-slate-200 p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="mb-3"><h3 className="text-sm font-semibold text-slate-900">Phase Medians</h3><p className="text-xs text-slate-400 mt-0.5">Today vs historical</p></div>
            <PhaseMedianComparison dayMedians={dayMedians} historicalMedians={HISTORICAL_MEDIANS.global} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            {selectedCaseData ? <CaseDetailPanel c={selectedCaseData} flags={caseFlags[selectedCaseData.id] || []} /> : (<><div className="mb-3"><h3 className="text-sm font-semibold text-slate-900">Day Flags</h3><p className="text-xs text-slate-400 mt-0.5">Auto-detected from thresholds</p></div><SidebarFlagList allFlags={allFlags} /></>)}
          </div>
        </div>
      </div>
    </div>
  );
}
