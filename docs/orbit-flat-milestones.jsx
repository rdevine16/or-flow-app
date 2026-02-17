import { useState, useCallback, useMemo } from "react";

// ─── Phase definitions ───────────────────────────────────────────────
const PHASE_DEFS = {
  "pre-op": { label: "Pre-Op", color: "#3B82F6", depth: 0, order: 0 },
  anesthesia: { label: "Anesthesia", color: "#6366F1", depth: 1, parent: "pre-op", order: 0 },
  "table-setup": { label: "Table Setup", color: "#EC4899", depth: 1, parent: "pre-op", order: 1 },
  "prep-drape": { label: "Prep/Drape", color: "#14B8A6", depth: 1, parent: "pre-op", order: 2 },
  surgical: { label: "Surgical", color: "#22C55E", depth: 0, order: 1 },
  closing: { label: "Closing", color: "#F59E0B", depth: 0, order: 2 },
  "post-op": { label: "Post-Op", color: "#8B5CF6", depth: 0, order: 3 },
};

const INITIAL_MILESTONES = [
  { id: "patient-in", name: "Patient In Room", phases: ["pre-op:start"], boundary: true },
  { id: "anesthesia-start", name: "Anesthesia Start", phases: ["anesthesia:start"], pairGroup: "anesthesia-pair", pairLabel: "START", paired: "anesthesia-end" },
  { id: "anesthesia-end", name: "Anesthesia End", phases: ["anesthesia:end"], pairGroup: "anesthesia-pair", pairLabel: "END", paired: "anesthesia-start" },
  { id: "bed-prep", name: "Bed Prep", phases: [] },
  { id: "table-setup-start", name: "Table Setup Start", phases: ["table-setup:start"], pairGroup: "table-setup-pair", pairLabel: "START", paired: "table-setup-end" },
  { id: "table-setup-end", name: "Table Setup Complete", phases: ["table-setup:end"], pairGroup: "table-setup-pair", pairLabel: "END", paired: "table-setup-start" },
  { id: "prep-drape-start", name: "Prep/Drape Start", phases: ["prep-drape:start"], pairGroup: "prep-drape-pair", pairLabel: "START", paired: "prep-drape-end" },
  { id: "prep-drape-end", name: "Prep/Drape Complete", phases: ["prep-drape:end"], pairGroup: "prep-drape-pair", pairLabel: "END", paired: "prep-drape-start" },
  { id: "timeout", name: "Timeout", phases: [] },
  { id: "incision", name: "Incision", phases: ["pre-op:end", "surgical:start"], boundary: true },
  { id: "closing-start", name: "Closing Start", phases: ["surgical:end", "closing:start"], boundary: true, pairGroup: "closing-pair", pairLabel: "START", paired: "closing-end" },
  { id: "closing-end", name: "Closing Complete", phases: ["closing:end"], pairGroup: "closing-pair", pairLabel: "END", paired: "closing-start" },
  { id: "patient-out", name: "Patient Out", phases: ["post-op:start"], boundary: true },
  { id: "room-cleaned", name: "Room Cleaned", phases: ["post-op:end"] },
];

// ─── Icons ───────────────────────────────────────────────────────────
const LockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const GripIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
    <circle cx="9" cy="5" r="1.5" fill="currentColor" /><circle cx="15" cy="5" r="1.5" fill="currentColor" />
    <circle cx="9" cy="12" r="1.5" fill="currentColor" /><circle cx="15" cy="12" r="1.5" fill="currentColor" />
    <circle cx="9" cy="19" r="1.5" fill="currentColor" /><circle cx="15" cy="19" r="1.5" fill="currentColor" />
  </svg>
);
const AlertIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const XIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

// ─── Compute phase ranges ────────────────────────────────────────────
const computePhaseRanges = (milestones) => {
  const ranges = {};
  milestones.forEach((ms, idx) => {
    (ms.phases || []).forEach((p) => {
      const [phaseId, action] = p.split(":");
      if (!ranges[phaseId]) ranges[phaseId] = { start: idx, end: idx };
      if (action === "start") ranges[phaseId].start = idx;
      if (action === "end") ranges[phaseId].end = idx;
    });
  });
  Object.keys(ranges).forEach((pid) => {
    if (ranges[pid].start > ranges[pid].end) ranges[pid].inverted = true;
  });
  return ranges;
};

// For each row, determine the top-level phase color
const getTopPhaseForRow = (idx, phaseRanges) => {
  const topPhases = Object.entries(PHASE_DEFS).filter(([, v]) => v.depth === 0);
  // Check each top-level phase
  let current = null;
  let transition = null; // { from, to } if this row is a boundary between two

  for (const [pid, pdef] of topPhases) {
    const range = phaseRanges[pid];
    if (!range || range.inverted) continue;
    if (idx >= range.start && idx <= range.end) {
      if (!current) current = pid;
      else {
        // This row is in two top-level phases (transition point)
        // The one with the earlier start is "from", the other is "to"
        const curRange = phaseRanges[current];
        if (range.start > curRange.start) {
          transition = { from: current, to: pid };
        } else {
          transition = { from: pid, to: current };
        }
      }
    }
  }

  if (transition) return transition;
  if (current) return { from: current, to: current };
  return null;
};

// Pair bracket computation
const computePairBrackets = (milestones) => {
  const groups = {};
  milestones.forEach((ms, idx) => {
    if (ms.pairGroup) {
      if (!groups[ms.pairGroup]) groups[ms.pairGroup] = {};
      if (ms.pairLabel === "START") groups[ms.pairGroup].start = idx;
      if (ms.pairLabel === "END") groups[ms.pairGroup].end = idx;
      groups[ms.pairGroup].phaseId = ms.phases?.[0]?.split(":")[0];
    }
  });
  const brackets = [];
  Object.entries(groups).forEach(([gid, { start, end, phaseId }]) => {
    if (start !== undefined && end !== undefined) {
      brackets.push({
        group: gid, start: Math.min(start, end), end: Math.max(start, end),
        inverted: start > end, phaseId,
        color: PHASE_DEFS[phaseId] || { color: "#94A3B8" },
      });
    }
  });
  brackets.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  brackets.forEach((b) => {
    let lane = 0;
    while (brackets.some((l) => l !== b && l.lane !== undefined && l.lane === lane && !(l.end < b.start || l.start > b.end))) lane++;
    b.lane = lane;
  });
  return brackets;
};

const ROW_HEIGHT = 40;
const PRIMARY_RAIL_W = 4;
const SUB_RAIL_W = 4;
const SUB_RAIL_GAP = 6;

// ─── Add Milestone Modal ─────────────────────────────────────────────
const AddMilestoneModal = ({ onAdd, onClose, milestones }) => {
  const [name, setName] = useState("");
  const [isPhaseStart, setIsPhaseStart] = useState(false);
  const [phaseName, setPhaseName] = useState("");
  const [parentPhase, setParentPhase] = useState("pre-op");
  const [pairWith, setPairWith] = useState("");
  const [pairRole, setPairRole] = useState("START");

  const unpaired = milestones.filter((m) => !m.paired && !m.boundary);
  const topPhases = Object.entries(PHASE_DEFS).filter(([, v]) => v.depth === 0);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();
    const ms = { id, name: name.trim(), phases: [] };

    if (isPhaseStart && phaseName.trim()) {
      const phaseId = phaseName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (!PHASE_DEFS[phaseId]) {
        const colors = ["#6366F1", "#14B8A6", "#EC4899", "#F97316", "#06B6D4", "#A855F7", "#EF4444"];
        PHASE_DEFS[phaseId] = {
          label: phaseName.trim(), color: colors[Object.keys(PHASE_DEFS).length % colors.length],
          depth: 1, parent: parentPhase, order: Object.keys(PHASE_DEFS).length,
        };
      }
      ms.phases = [`${phaseId}:start`];
    }

    if (pairWith) {
      const pgId = id + "-pg";
      ms.pairGroup = pgId;
      ms.pairLabel = pairRole;
      ms.paired = pairWith;
      onAdd(ms, pairWith, pairRole);
    } else {
      onAdd(ms);
    }
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 200 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "#FFF", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", width: 420, zIndex: 201, padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Add Milestone</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94A3B8", display: "flex" }}><XIcon /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#64748B", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Milestone Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Skin Prep"
            style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 13, fontFamily: "inherit", color: "#1E293B", outline: "none", boxSizing: "border-box" }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#334155" }}>
            <input type="checkbox" checked={isPhaseStart} onChange={(e) => setIsPhaseStart(e.target.checked)} style={{ accentColor: "#3B82F6" }} />
            This milestone starts a new sub-phase
          </label>
          {isPhaseStart && (
            <div style={{ marginTop: 8, marginLeft: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={phaseName} onChange={(e) => setPhaseName(e.target.value)} placeholder="Sub-phase name (e.g. Positioning)"
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12, fontFamily: "inherit", color: "#1E293B", outline: "none", boxSizing: "border-box" }} />
              <div>
                <span style={{ fontSize: 10, color: "#64748B", marginBottom: 3, display: "block" }}>Inside parent phase:</span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {topPhases.map(([pid, pdef]) => (
                    <button key={pid} onClick={() => setParentPhase(pid)}
                      style={{ padding: "4px 10px", borderRadius: 5, border: `1.5px solid ${parentPhase === pid ? pdef.color : "#E2E8F0"}`, background: parentPhase === pid ? `${pdef.color}10` : "#FFF", fontSize: 11, fontWeight: parentPhase === pid ? 600 : 400, color: parentPhase === pid ? pdef.color : "#64748B", cursor: "pointer", fontFamily: "inherit" }}>
                      {pdef.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#64748B", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pair With (optional)</label>
          <select value={pairWith} onChange={(e) => setPairWith(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 12, fontFamily: "inherit", color: "#1E293B", background: "#FFF" }}>
            <option value="">None — standalone</option>
            {unpaired.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
          {pairWith && (
            <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#64748B" }}>This is the:</span>
              {["START", "END"].map((r) => (
                <button key={r} onClick={() => setPairRole(r)}
                  style={{ padding: "4px 14px", border: `1.5px solid ${pairRole === r ? "#3B82F6" : "#E2E8F0"}`, borderRadius: 5, background: pairRole === r ? "#EFF6FF" : "#FFF", fontSize: 11, fontWeight: 600, color: pairRole === r ? "#3B82F6" : "#64748B", cursor: "pointer", fontFamily: "inherit" }}>{r}</button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", border: "1px solid #E2E8F0", borderRadius: 7, background: "#FFF", fontSize: 12, fontWeight: 500, color: "#64748B", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!name.trim()}
            style={{ padding: "8px 18px", border: "none", borderRadius: 7, background: name.trim() ? "#3B82F6" : "#CBD5E1", fontSize: 12, fontWeight: 600, color: "#FFF", cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>Add</button>
        </div>
      </div>
    </>
  );
};

// ─── Main App ────────────────────────────────────────────────────────
export default function App() {
  const [milestones, setMilestones] = useState(INITIAL_MILESTONES);
  const [dragId, setDragId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [dropPos, setDropPos] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const phaseRanges = useMemo(() => computePhaseRanges(milestones), [milestones]);
  const pairBrackets = useMemo(() => computePairBrackets(milestones), [milestones]);
  const maxBracketLane = pairBrackets.length > 0 ? Math.max(...pairBrackets.map((b) => b.lane)) + 1 : 0;
  const BRACKET_AREA = maxBracketLane * 16 + (maxBracketLane > 0 ? 6 : 0);

  // Active sub-phases (depth 1) that have ranges
  const activeSubPhases = useMemo(() => {
    return Object.entries(PHASE_DEFS)
      .filter(([pid, pdef]) => pdef.depth === 1 && phaseRanges[pid] && !phaseRanges[pid].inverted)
      .map(([pid]) => pid);
  }, [phaseRanges]);

  const subRailTotalWidth = activeSubPhases.length > 0 ? activeSubPhases.length * (SUB_RAIL_W + 4) + SUB_RAIL_GAP : 0;
  const totalLeftWidth = 6 + PRIMARY_RAIL_W + subRailTotalWidth;

  // For each row: which top-level phase(s) is it in?
  const rowPhaseInfo = useMemo(() => {
    return milestones.map((_, idx) => getTopPhaseForRow(idx, phaseRanges));
  }, [milestones, phaseRanges]);

  // DnD
  const handleDragStart = useCallback((e, id) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); }, []);
  const handleDragOver = useCallback((e, id) => {
    e.preventDefault(); if (id === dragId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDropTargetId(id); setDropPos(e.clientY < rect.top + rect.height / 2 ? "before" : "after");
  }, [dragId]);
  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault(); if (!dragId || dragId === targetId) return;
    setMilestones((prev) => {
      const fromIdx = prev.findIndex((m) => m.id === dragId);
      const toIdx = prev.findIndex((m) => m.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const n = [...prev]; const [moved] = n.splice(fromIdx, 1);
      let ins = n.findIndex((m) => m.id === targetId);
      if (dropPos === "after") ins++;
      n.splice(ins, 0, moved);
      return n;
    });
    setDragId(null); setDropTargetId(null); setDropPos(null);
  }, [dragId, dropPos]);
  const handleDragEnd = useCallback(() => { setDragId(null); setDropTargetId(null); setDropPos(null); }, []);

  const addMilestone = useCallback((ms, pairedWithId, pairRole) => {
    setMilestones((prev) => {
      const result = [...prev];
      if (pairedWithId) {
        const pgId = ms.pairGroup;
        const partnerIdx = result.findIndex((m) => m.id === pairedWithId);
        if (partnerIdx !== -1) {
          result[partnerIdx] = { ...result[partnerIdx], paired: ms.id, pairLabel: pairRole === "START" ? "END" : "START", pairGroup: pgId };
          const startPhase = ms.phases?.find((p) => p.endsWith(":start"));
          if (startPhase) {
            const phaseId = startPhase.split(":")[0];
            result[partnerIdx] = { ...result[partnerIdx], phases: [...(result[partnerIdx].phases || []), `${phaseId}:end`] };
          }
        }
      }
      result.push(ms);
      return result;
    });
  }, []);

  const removeMilestone = useCallback((id) => {
    setMilestones((prev) => {
      const target = prev.find((m) => m.id === id);
      let result = prev.filter((m) => m.id !== id);
      if (target?.paired) {
        result = result.map((m) => m.id === target.paired ? { ...m, paired: undefined, pairLabel: undefined, pairGroup: undefined } : m);
      }
      return result;
    });
  }, []);

  const pairIssues = useMemo(() => {
    const issues = {};
    pairBrackets.forEach((b) => { if (b.inverted) issues[b.group] = "End before Start"; });
    return issues;
  }, [pairBrackets]);
  const issueCount = Object.keys(pairIssues).length;

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", background: "#F1F5F9", minHeight: "100vh", color: "#1E293B" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "#FFF", borderBottom: "1px solid #E2E8F0", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#FFF" }}>OR</div>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0F172A" }}>Milestones</h1>
          </div>
          <p style={{ margin: "3px 0 0 36px", fontSize: 11, color: "#64748B" }}>
            Drag to reorder. The colored rail shows the current phase. Sub-phase rails nest alongside.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {issueCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#DC2626" }}>
              <AlertIcon /> {issueCount} pair issue{issueCount > 1 ? "s" : ""}
            </div>
          )}
          <button onClick={() => setShowAddModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", border: "none", borderRadius: 7, background: "#3B82F6", fontSize: 12, fontWeight: 600, color: "#FFF", cursor: "pointer", fontFamily: "inherit" }}>
            <PlusIcon /> Add Milestone
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
        {/* Phase legend */}
        <div style={{ display: "flex", gap: 14, marginBottom: 16, padding: "10px 14px", background: "#FFF", borderRadius: 8, border: "1px solid #E2E8F0", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Phases</span>
          {Object.entries(PHASE_DEFS).filter(([pid]) => phaseRanges[pid]).map(([pid, pdef]) => (
            <div key={pid} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
              <div style={{
                width: 3, height: pdef.depth === 0 ? 14 : 10, borderRadius: 2, background: pdef.color,
              }} />
              <span style={{ color: "#475569", fontWeight: pdef.depth === 0 ? 600 : 400 }}>
                {pdef.depth === 1 && <span style={{ color: "#CBD5E1", marginRight: 2, fontSize: 10 }}>↳</span>}
                {pdef.label}
              </span>
            </div>
          ))}
        </div>

        {/* Milestone list */}
        <div style={{ background: "#FFF", borderRadius: 10, border: "1px solid #E2E8F0", overflow: "hidden", position: "relative" }}>

          {/* Primary rail - rendered as absolute SVG for smooth gradients */}
          <svg style={{ position: "absolute", left: 6, top: 0, width: PRIMARY_RAIL_W, height: milestones.length * ROW_HEIGHT, zIndex: 4, overflow: "visible" }}>
            {milestones.map((_, idx) => {
              const info = rowPhaseInfo[idx];
              if (!info) return null;
              const fromColor = PHASE_DEFS[info.from]?.color || "#CBD5E1";
              const toColor = PHASE_DEFS[info.to]?.color || "#CBD5E1";
              const isTransition = info.from !== info.to;
              const y = idx * ROW_HEIGHT;
              const gradId = `grad-${idx}`;

              if (isTransition) {
                return (
                  <g key={idx}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={fromColor} />
                        <stop offset="100%" stopColor={toColor} />
                      </linearGradient>
                    </defs>
                    <rect x="0" y={y} width={PRIMARY_RAIL_W} height={ROW_HEIGHT} rx="0" fill={`url(#${gradId})`} />
                  </g>
                );
              }
              // First row gets rounded top, last row rounded bottom
              const isFirst = idx === 0 || !rowPhaseInfo[idx - 1] || rowPhaseInfo[idx - 1].to !== info.from;
              const isLast = idx === milestones.length - 1 || !rowPhaseInfo[idx + 1] || rowPhaseInfo[idx + 1].from !== info.to;
              return (
                <rect key={idx} x="0" y={y} width={PRIMARY_RAIL_W} height={ROW_HEIGHT}
                  rx={isFirst || isLast ? 2 : 0} fill={fromColor} />
              );
            })}
          </svg>

          {/* Sub-phase rails */}
          {activeSubPhases.map((spId, spIdx) => {
            const range = phaseRanges[spId];
            if (!range) return null;
            const def = PHASE_DEFS[spId];
            const x = 6 + PRIMARY_RAIL_W + SUB_RAIL_GAP + spIdx * (SUB_RAIL_W + 4);
            const yStart = range.start * ROW_HEIGHT + 4;
            const yEnd = (range.end + 1) * ROW_HEIGHT - 4;
            const h = yEnd - yStart;
            if (h <= 0) return null;
            return (
              <div key={spId} style={{
                position: "absolute", left: x, top: yStart, width: SUB_RAIL_W, height: h,
                background: def.color, borderRadius: 3, opacity: 0.7, zIndex: 4,
              }} />
            );
          })}

          {/* Pair bracket SVG layer */}
          {pairBrackets.length > 0 && (
            <svg style={{ position: "absolute", top: 0, right: 8, width: BRACKET_AREA, height: milestones.length * ROW_HEIGHT, zIndex: 5, overflow: "visible" }}>
              {pairBrackets.map((b) => {
                const x = BRACKET_AREA - (b.lane * 16) - 10;
                const yS = b.start * ROW_HEIGHT + ROW_HEIGHT / 2;
                const yE = b.end * ROW_HEIGHT + ROW_HEIGHT / 2;
                const c = b.inverted ? "#EF4444" : (b.color?.color || "#94A3B8");
                return (
                  <g key={b.group}>
                    <line x1={x} y1={yS} x2={x} y2={yE} stroke={c} strokeWidth="2" strokeLinecap="round" />
                    <line x1={x - 6} y1={yS} x2={x} y2={yS} stroke={c} strokeWidth="2" strokeLinecap="round" />
                    <line x1={x - 6} y1={yE} x2={x} y2={yE} stroke={c} strokeWidth="2" strokeLinecap="round" />
                    <circle cx={x - 8} cy={yS} r="3" fill={c} />
                    <circle cx={x - 8} cy={yE} r="3" fill={c} />
                  </g>
                );
              })}
            </svg>
          )}

          {/* Rows */}
          {milestones.map((ms, idx) => {
            const isDragging = dragId === ms.id;
            const isTarget = dropTargetId === ms.id;
            const isHovered = hoveredId === ms.id;
            const hasIssue = ms.pairGroup && pairIssues[ms.pairGroup];
            const pairBracket = ms.pairGroup ? pairBrackets.find((b) => b.group === ms.pairGroup) : null;
            const pairColor = pairBracket?.color;

            const phaseActions = (ms.phases || []).map((p) => {
              const [pid, action] = p.split(":");
              return { pid, action, def: PHASE_DEFS[pid] };
            });

            // Is this row a transition on the primary rail?
            const info = rowPhaseInfo[idx];
            const isTransition = info && info.from !== info.to;

            return (
              <div key={ms.id}
                draggable onDragStart={(e) => handleDragStart(e, ms.id)}
                onDragOver={(e) => handleDragOver(e, ms.id)} onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, ms.id)}
                onMouseEnter={() => setHoveredId(ms.id)} onMouseLeave={() => setHoveredId(null)}
                style={{ position: "relative", height: ROW_HEIGHT, opacity: isDragging ? 0.25 : 1, transition: "opacity 0.15s" }}
              >
                {isTarget && dropPos === "before" && (
                  <div style={{ position: "absolute", top: -1, left: totalLeftWidth + 8, right: 12, height: 2, background: "#3B82F6", borderRadius: 1, zIndex: 20 }}>
                    <div style={{ position: "absolute", left: -3, top: -3, width: 8, height: 8, borderRadius: "50%", background: "#3B82F6" }} />
                  </div>
                )}
                {isTarget && dropPos === "after" && (
                  <div style={{ position: "absolute", bottom: -1, left: totalLeftWidth + 8, right: 12, height: 2, background: "#3B82F6", borderRadius: 1, zIndex: 20 }}>
                    <div style={{ position: "absolute", left: -3, top: -3, width: 8, height: 8, borderRadius: "50%", background: "#3B82F6" }} />
                  </div>
                )}

                <div style={{
                  display: "flex", alignItems: "center", gap: 7, height: "100%",
                  paddingLeft: totalLeftWidth + 8, paddingRight: BRACKET_AREA + 16,
                  cursor: "grab", borderBottom: "1px solid #F1F5F9",
                  background: hasIssue ? "#FEF2F208" : "transparent",
                  position: "relative", zIndex: 3,
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#F8FAFC"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = hasIssue ? "#FEF2F208" : "transparent"; }}
                >
                  <div style={{ cursor: "grab", display: "flex", alignItems: "center", flexShrink: 0 }}><GripIcon /></div>

                  <span style={{ fontSize: 10, color: "#CBD5E1", width: 20, textAlign: "center", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{idx + 1}</span>

                  {/* Name */}
                  <span style={{ fontSize: 12, color: "#1E293B", flex: 1, fontWeight: ms.boundary ? 600 : 400 }}>{ms.name}</span>

                  {/* Phase start/end tags */}
                  {phaseActions.map((pa, i) => (
                    <span key={i} style={{
                      fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: 3,
                      background: `${pa.def?.color || "#94A3B8"}15`,
                      color: pa.def?.color || "#94A3B8",
                      border: `1px solid ${pa.def?.color || "#94A3B8"}30`,
                      textTransform: "uppercase", whiteSpace: "nowrap",
                    }}>
                      {pa.def?.label} {pa.action}
                    </span>
                  ))}

                  {/* Pair badge */}
                  {ms.pairLabel && pairColor && (
                    <span style={{
                      fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: 3,
                      background: hasIssue ? "#FEE2E2" : `${pairColor.color}12`,
                      color: hasIssue ? "#DC2626" : pairColor.color,
                      border: `1px solid ${hasIssue ? "#FECACA" : pairColor.color + "30"}`,
                    }}>{ms.pairLabel}</span>
                  )}

                  {ms.boundary && <span style={{ color: "#CBD5E1", display: "flex", alignItems: "center" }}><LockIcon /></span>}
                  {hasIssue && <span style={{ color: "#EF4444", display: "flex", alignItems: "center" }}><AlertIcon /></span>}

                  {!ms.boundary && (
                    <button onClick={(e) => { e.stopPropagation(); removeMilestone(ms.id); }}
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: "#CBD5E1", display: "flex", alignItems: "center", padding: 2, opacity: isHovered ? 1 : 0, transition: "opacity 0.15s" }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "#EF4444"} onMouseLeave={(e) => e.currentTarget.style.color = "#CBD5E1"}>
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 12, padding: "10px 14px", background: "#FFF", borderRadius: 8, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#94A3B8" }}>
          <span>{milestones.length} milestones · {milestones.filter((m) => m.boundary).length} boundary · {Object.keys(phaseRanges).filter((p) => !phaseRanges[p].inverted).length} phases</span>
          <span>{pairBrackets.length} paired connections</span>
        </div>
      </div>

      {showAddModal && <AddMilestoneModal onAdd={addMilestone} onClose={() => setShowAddModal(false)} milestones={milestones} />}
    </div>
  );
}
