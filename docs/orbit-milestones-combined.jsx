import { useState, useCallback, useMemo } from "react";

// ─── Data ────────────────────────────────────────────────────────────
const PHASES = [
  { id: "pre-op", label: "Pre-Op", color: "#3B82F6" },
  { id: "surgical", label: "Surgical", color: "#22C55E" },
  { id: "closing", label: "Closing", color: "#F59E0B" },
  { id: "post-op", label: "Post-Op", color: "#8B5CF6" },
];

const PAIR_COLORS = {
  anesthesia: { bg: "#EFF6FF", border: "#93C5FD", dot: "#3B82F6", label: "Anesthesia" },
  "prep-drape": { bg: "#F0FDF4", border: "#86EFAC", dot: "#22C55E", label: "Prep/Drape" },
  closing: { bg: "#FFFBEB", border: "#FCD34D", dot: "#F59E0B", label: "Closing" },
  "table-setup": { bg: "#FDF2F8", border: "#F9A8D4", dot: "#EC4899", label: "Table Setup" },
};

const INITIAL_MILESTONES = [
  { id: "patient-in", name: "Patient In Room", phase: "pre-op", boundary: true, boundaryBetween: ["start", "pre-op"], solid: true },
  { id: "anesthesia-start", name: "Anesthesia Start", phase: "pre-op", paired: "anesthesia-end", pairLabel: "START", pairGroup: "anesthesia" },
  { id: "anesthesia-end", name: "Anesthesia End", phase: "pre-op", paired: "anesthesia-start", pairLabel: "END", pairGroup: "anesthesia" },
  { id: "bed-prep", name: "Bed Prep", phase: "pre-op" },
  { id: "table-setup-start", name: "Table Setup Start", phase: "pre-op", paired: "table-setup-end", pairLabel: "START", pairGroup: "table-setup" },
  { id: "table-setup-end", name: "Table Setup Complete", phase: "pre-op", paired: "table-setup-start", pairLabel: "END", pairGroup: "table-setup" },
  { id: "prep-drape-start", name: "Prep/Drape Start", phase: "pre-op", paired: "prep-drape-end", pairLabel: "START", pairGroup: "prep-drape" },
  { id: "prep-drape-end", name: "Prep/Drape Complete", phase: "pre-op", paired: "prep-drape-start", pairLabel: "END", pairGroup: "prep-drape" },
  { id: "timeout", name: "Timeout", phase: "pre-op" },
  { id: "incision", name: "Incision", phase: "surgical", boundary: true, boundaryBetween: ["pre-op", "surgical"], solid: true },
  { id: "closing-start", name: "Closing", phase: "closing", boundary: true, boundaryBetween: ["surgical", "closing"], paired: "closing-end", pairLabel: "START", pairGroup: "closing" },
  { id: "closing-end", name: "Closing Complete", phase: "closing", paired: "closing-start", pairLabel: "END", pairGroup: "closing" },
  { id: "patient-out", name: "Patient Out", phase: "post-op", boundary: true, boundaryBetween: ["closing", "post-op"] },
  { id: "room-cleaned", name: "Room Cleaned", phase: "post-op" },
];

const PROCEDURE_NAMES = [
  "ACDF", "Carpal Tunnel Release", "Distal Radius ORIF", "Kyphoplasty",
  "Lumbar Laminectomy", "Rotator Cuff Repair", "ACL Reconstruction",
  "Total Knee Arthroplasty", "Total Hip Arthroplasty", "Meniscectomy",
  "Shoulder Arthroscopy", "Spinal Fusion", "Discectomy", "Trigger Finger Release",
  "Cubital Tunnel Release", "De Quervain's Release", "Ganglion Cyst Excision",
  "Dupuytren's Fasciectomy", "Wrist Arthroscopy", "Elbow Arthroscopy",
  "Ankle Arthroscopy", "Achilles Tendon Repair", "Bunionectomy", "Hammertoe Correction",
  "Plantar Fascia Release", "Hip Arthroscopy", "Labral Repair",
  "Bankart Repair", "SLAP Repair", "Clavicle ORIF",
  "Tibial Nailing", "Femoral Nailing", "Patellar ORIF", "Olecranon ORIF",
  "Ankle ORIF", "Pilon Fracture ORIF", "Calcaneus ORIF",
  "Vertebroplasty", "Cervical Disc Replacement", "Lumbar Microdiscectomy",
];
const PROCEDURES = PROCEDURE_NAMES.map((n, i) => ({ id: `proc-${i}`, name: n }));

const SURGEONS = [
  { id: "s1", name: "Dr. Sarah Chen", specialty: "Orthopedic Spine", avatar: "SC" },
  { id: "s2", name: "Dr. James Morton", specialty: "Hand & Upper Extremity", avatar: "JM" },
  { id: "s3", name: "Dr. Lisa Patel", specialty: "Sports Medicine", avatar: "LP" },
  { id: "s4", name: "Dr. Robert Kim", specialty: "Foot & Ankle", avatar: "RK" },
  { id: "s5", name: "Dr. Maria Santos", specialty: "Joint Replacement", avatar: "MS" },
  { id: "s6", name: "Dr. David Okafor", specialty: "Orthopedic Trauma", avatar: "DO" },
  { id: "s7", name: "Dr. Emily Walsh", specialty: "Orthopedic Spine", avatar: "EW" },
  { id: "s8", name: "Dr. Michael Huang", specialty: "Sports Medicine", avatar: "MH" },
];

const buildDefaultConfig = (ms) => {
  const c = {};
  ms.filter((m) => !m.boundary).forEach((m) => { c[m.id] = true; });
  return c;
};

const initProcOverrides = (ms) => {
  const def = buildDefaultConfig(ms);
  const opt = ms.filter((m) => !m.boundary);
  const ov = {};
  [1, 4, 7, 11, 14, 22, 30].forEach((i) => {
    const custom = { ...def };
    const shuffled = [...opt].sort(() => Math.random() - 0.5);
    custom[shuffled[0].id] = false;
    if (i % 3 === 0 && shuffled[1]) custom[shuffled[1].id] = false;
    ov[`proc-${i}`] = custom;
  });
  return ov;
};

const initSurgeonOverrides = (ms) => {
  const def = buildDefaultConfig(ms);
  return {
    s1: { "proc-0": { ...def, "anesthesia-start": false, "anesthesia-end": false } },
    s2: { "proc-1": { ...def, "prep-drape-start": false, "prep-drape-end": false } },
    s3: { "proc-5": { ...def, "room-cleaned": false } },
  };
};

// ─── Icons ───────────────────────────────────────────────────────────
const LockIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const GripIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
    <circle cx="9" cy="6" r="1.5" fill="currentColor" /><circle cx="15" cy="6" r="1.5" fill="currentColor" />
    <circle cx="9" cy="12" r="1.5" fill="currentColor" /><circle cx="15" cy="12" r="1.5" fill="currentColor" />
    <circle cx="9" cy="18" r="1.5" fill="currentColor" /><circle cx="15" cy="18" r="1.5" fill="currentColor" />
  </svg>
);
const ChevronDown = ({ open }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9" /></svg>
);
const AlertIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);
const UserIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);
const LayersIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
);
const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);
const ArrowRightIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
);
const UndoIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
);
const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const XIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);

// ─── Helpers ─────────────────────────────────────────────────────────
const getPhaseColor = (id) => PHASES.find((p) => p.id === id)?.color || "#94A3B8";

const getPairIssues = (milestones) => {
  const issues = {};
  const groups = {};
  milestones.forEach((ms, idx) => {
    if (ms.pairGroup) {
      if (!groups[ms.pairGroup]) groups[ms.pairGroup] = {};
      if (ms.pairLabel === "START") groups[ms.pairGroup].startIdx = idx;
      if (ms.pairLabel === "END") groups[ms.pairGroup].endIdx = idx;
    }
  });
  Object.entries(groups).forEach(([gid, { startIdx, endIdx }]) => {
    if (startIdx !== undefined && endIdx !== undefined) {
      const s = milestones[startIdx], e = milestones[endIdx];
      if (s.phase !== e.phase) issues[gid] = `${PAIR_COLORS[gid]?.label} split across phases`;
      else if (startIdx > endIdx) issues[gid] = `${PAIR_COLORS[gid]?.label} End before Start`;
    }
  });
  return issues;
};

const getEffectiveProc = (procId, po, def) => po[procId] || { ...def };
const isProcCustomized = (procId, po, def) => po[procId] ? Object.keys(def).some((k) => po[procId][k] !== def[k]) : false;
const procDiffCount = (procId, po, def) => po[procId] ? Object.keys(def).filter((k) => po[procId][k] !== def[k]).length : 0;
const getSurgeonEffective = (sId, pId, po, so, def) => so[sId]?.[pId] || getEffectiveProc(pId, po, def);
const isSurgeonCustomized = (sId, pId, po, so, def) => {
  if (!so[sId]?.[pId]) return false;
  const parent = getEffectiveProc(pId, po, def);
  return Object.keys(def).some((k) => so[sId][pId][k] !== parent[k]);
};
const surgeonsOverridingProc = (pId, so, po, def) => SURGEONS.filter((s) => isSurgeonCustomized(s.id, pId, po, so, def));
const surgeonOverrideCount = (sId, po, so, def) => so[sId] ? Object.keys(so[sId]).filter((pId) => isSurgeonCustomized(sId, pId, po, so, def)).length : 0;
const getSurgeonOverrideProcIds = (sId, so) => so[sId] ? Object.keys(so[sId]) : [];

// ─── Boundary Marker ─────────────────────────────────────────────────
const BoundaryMarker = ({ ms }) => {
  const fromPhase = ms.boundaryBetween[0], toPhase = ms.boundaryBetween[1];
  const topColor = fromPhase === "start" ? getPhaseColor(toPhase) : getPhaseColor(fromPhase);
  const bottomColor = getPhaseColor(toPhase);
  const isSolid = ms.solid;
  const dotBg = isSolid ? bottomColor : `linear-gradient(135deg, ${topColor} 50%, ${bottomColor} 50%)`;
  const lineBg = isSolid ? bottomColor : `linear-gradient(to bottom, ${topColor}, ${bottomColor})`;
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", zIndex: 2, marginLeft: 11 }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2.5, background: lineBg }} />
      <div style={{
        display: "flex", alignItems: "center", gap: 5, marginLeft: 8, padding: "4px 10px 4px 7px",
        background: "#FFF", border: "1.5px solid #E2E8F0", borderRadius: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", position: "relative", zIndex: 3,
      }}>
        <div style={{ width: 13, height: 13, borderRadius: "50%", flexShrink: 0, background: dotBg }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "#1E293B", whiteSpace: "nowrap" }}>{ms.name}</span>
        <span style={{ color: "#94A3B8", display: "flex", alignItems: "center" }}><LockIcon size={9} /></span>
      </div>
    </div>
  );
};

// ─── Phase Block ─────────────────────────────────────────────────────
const ROW_HEIGHT = 34;
const LANE_WIDTH = 14;

const PhaseBlock = ({ phase, milestones, config, parentConfig, pairIssues, overriddenIds, inheritLabel, onToggle, onReorder, draggable: canDrag, showTable, onDelete }) => {
  const [expanded, setExpanded] = useState(true);
  const internal = milestones.filter((ms) => ms.phase === phase.id && !ms.boundary);
  const boundaryBefore = milestones.filter((ms) => ms.boundary && ms.boundaryBetween?.[1] === phase.id);
  const enabledCount = config ? internal.filter((ms) => config[ms.id] !== false).length : internal.length;

  const [dragId, setDragId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [dropPos, setDropPos] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const pairGroupsInPhase = useMemo(() =>
    [...new Set(internal.filter((m) => m.pairGroup).map((m) => m.pairGroup))],
    [internal]
  );
  const bracketData = useMemo(() => {
    const ranges = [];
    pairGroupsInPhase.forEach((g) => {
      const indices = [];
      internal.forEach((ms, i) => { if (ms.pairGroup === g) indices.push(i); });
      if (indices.length >= 2) ranges.push({ group: g, start: Math.min(...indices), end: Math.max(...indices), color: PAIR_COLORS[g], hasIssue: !!pairIssues[g] });
    });
    ranges.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    const lanes = [];
    ranges.forEach((r) => {
      let lane = 0;
      while (lanes.some((l) => l.lane === lane && !(l.end < r.start || l.start > r.end))) lane++;
      r.lane = lane; lanes.push(r);
    });
    return ranges;
  }, [internal, pairGroupsInPhase, pairIssues]);

  const maxLane = bracketData.length > 0 ? Math.max(...bracketData.map((b) => b.lane)) + 1 : 0;
  const bracketAreaWidth = maxLane * LANE_WIDTH + (maxLane > 0 ? 4 : 0);
  const phaseIssueCount = pairGroupsInPhase.filter((g) => pairIssues[g]).length;

  const handleDragStart = useCallback((e, id) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); }, []);
  const handleDragOver = useCallback((e, targetId) => {
    e.preventDefault(); if (targetId === dragId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDropTargetId(targetId); setDropPos(e.clientY < rect.top + rect.height / 2 ? "before" : "after");
  }, [dragId]);
  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault(); if (!dragId || dragId === targetId) return;
    const fromIdx = internal.findIndex((m) => m.id === dragId);
    const toIdx = internal.findIndex((m) => m.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const n = [...internal]; const [moved] = n.splice(fromIdx, 1);
    let ins = n.findIndex((m) => m.id === targetId); if (dropPos === "after") ins++;
    n.splice(ins, 0, moved);
    onReorder(phase.id, n);
    setDragId(null); setDropTargetId(null); setDropPos(null);
  }, [dragId, dropPos, internal, onReorder, phase.id]);
  const handleDragEnd = useCallback(() => { setDragId(null); setDropTargetId(null); setDropPos(null); }, []);

  let counter = 0;

  return (
    <div>
      {boundaryBefore.map((ms) => <BoundaryMarker key={ms.id} ms={ms} />)}
      <div style={{
        position: "relative", marginLeft: 11, borderLeft: `2.5px solid ${phase.color}`,
        background: "#FFF", borderRadius: "0 5px 5px 0",
      }}>
        <div onClick={() => internal.length > 0 && setExpanded(!expanded)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 10px", cursor: internal.length > 0 ? "pointer" : "default",
            userSelect: "none", background: `${phase.color}06`,
            borderRadius: !expanded ? "0 5px 5px 0" : "0 5px 0 0",
            borderBottom: expanded && internal.length > 0 ? "1px solid #F1F5F9" : "none",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: phase.color }}>{phase.label}</span>
            <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500 }}>
              {showTable ? `${internal.length} milestone${internal.length !== 1 ? "s" : ""}` : `${enabledCount}/${internal.length}`}
            </span>
            {phaseIssueCount > 0 && <span style={{ color: "#EF4444", display: "flex", alignItems: "center", gap: 2, fontSize: 10, fontWeight: 500 }}><AlertIcon /> {phaseIssueCount}</span>}
          </div>
          {internal.length > 0 && <ChevronDown open={expanded} />}
        </div>

        {expanded && internal.length > 0 && (
          <div style={{ position: "relative" }}>
            {bracketData.length > 0 && (
              <div style={{ position: "absolute", top: 0, left: 0, width: bracketAreaWidth, height: internal.length * ROW_HEIGHT, pointerEvents: "none", zIndex: 1 }}>
                {bracketData.map((b) => {
                  const x = bracketAreaWidth - (b.lane * LANE_WIDTH) - 10;
                  const yS = b.start * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const yE = b.end * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const c = b.hasIssue ? "#EF4444" : b.color.dot;
                  return (
                    <svg key={b.group} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible" }}>
                      <line x1={x} y1={yS} x2={x} y2={yE} stroke={c} strokeWidth="2" strokeLinecap="round" />
                      <line x1={x} y1={yS} x2={x + 6} y2={yS} stroke={c} strokeWidth="2" strokeLinecap="round" />
                      <line x1={x} y1={yE} x2={x + 6} y2={yE} stroke={c} strokeWidth="2" strokeLinecap="round" />
                      <circle cx={x + 8} cy={yS} r="3" fill={c} />
                      <circle cx={x + 8} cy={yE} r="3" fill={c} />
                      {internal.map((ms, i) => {
                        if (i > b.start && i < b.end && !ms.pairGroup) return <circle key={ms.id} cx={x + 8} cy={i * ROW_HEIGHT + ROW_HEIGHT / 2} r="1.5" fill={c} opacity="0.35" />;
                        return null;
                      })}
                    </svg>
                  );
                })}
              </div>
            )}

            {internal.map((ms, i) => {
              counter++;
              const isOn = config ? config[ms.id] !== false : true;
              const isOverridden = overriddenIds?.has(ms.id);
              const parentVal = parentConfig?.[ms.id];
              const hasIssue = ms.pairGroup && pairIssues[ms.pairGroup];
              const pairColor = ms.pairGroup ? PAIR_COLORS[ms.pairGroup] : null;
              const isDragging = dragId === ms.id;
              const isTarget = dropTargetId === ms.id;
              const isHovered = hoveredId === ms.id;

              let rowBg = "transparent";
              if (isOverridden) rowBg = "#FFFBEB";
              else if (hasIssue) rowBg = "#FEF2F2";
              else if (pairColor && bracketData.some((b) => b.group === ms.pairGroup && i >= b.start && i <= b.end)) rowBg = `${pairColor.bg}50`;

              return (
                <div key={ms.id}
                  draggable={canDrag} onDragStart={canDrag ? (e) => handleDragStart(e, ms.id) : undefined}
                  onDragOver={canDrag ? (e) => handleDragOver(e, ms.id) : undefined}
                  onDragEnd={canDrag ? handleDragEnd : undefined} onDrop={canDrag ? (e) => handleDrop(e, ms.id) : undefined}
                  onMouseEnter={() => setHoveredId(ms.id)} onMouseLeave={() => setHoveredId(null)}
                  style={{ position: "relative", height: ROW_HEIGHT, opacity: isDragging ? 0.3 : 1, transition: "opacity 0.15s" }}
                >
                  {isTarget && dropPos === "before" && (
                    <div style={{ position: "absolute", top: -1, left: bracketAreaWidth + 8, right: 8, height: 2, background: "#3B82F6", borderRadius: 1, zIndex: 20 }}>
                      <div style={{ position: "absolute", left: -3, top: -3, width: 8, height: 8, borderRadius: "50%", background: "#3B82F6" }} />
                    </div>
                  )}
                  {isTarget && dropPos === "after" && (
                    <div style={{ position: "absolute", bottom: -1, left: bracketAreaWidth + 8, right: 8, height: 2, background: "#3B82F6", borderRadius: 1, zIndex: 20 }}>
                      <div style={{ position: "absolute", left: -3, top: -3, width: 8, height: 8, borderRadius: "50%", background: "#3B82F6" }} />
                    </div>
                  )}

                  <div onClick={onToggle ? () => onToggle(ms.id) : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, height: "100%",
                      paddingLeft: bracketAreaWidth + 6, paddingRight: 10,
                      cursor: canDrag ? "grab" : onToggle ? "pointer" : "default",
                      background: rowBg, borderBottom: "1px solid #F5F5F5",
                      position: "relative", zIndex: 3, transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (rowBg === "transparent") e.currentTarget.style.background = "#F8FAFC"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = rowBg; }}
                  >
                    {canDrag && <div style={{ cursor: "grab", display: "flex", alignItems: "center", flexShrink: 0 }}><GripIcon /></div>}
                    {showTable && <span style={{ fontSize: 10, color: "#94A3B8", width: 18, textAlign: "center", flexShrink: 0 }}>{counter}</span>}
                    {config && onToggle && (
                      <div style={{ width: 15, height: 15, borderRadius: 3, flexShrink: 0, border: isOn ? "none" : "1.5px solid #CBD5E1", background: isOn ? "#3B82F6" : "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}>{isOn && <CheckIcon />}</div>
                    )}
                    <span style={{ fontSize: 11, color: "#1E293B", flex: 1, fontWeight: isOverridden ? 500 : 400, textDecoration: config && !isOn ? "line-through" : "none", opacity: config && !isOn ? 0.4 : 1 }}>
                      {ms.name}
                    </span>
                    {isOverridden && <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 2, background: "#FEF3C7", color: "#B45309" }}>{inheritLabel || "OVERRIDE"}</span>}
                    {isOverridden && parentVal !== undefined && <span style={{ fontSize: 9, color: "#94A3B8" }}>was {parentVal ? "on" : "off"}</span>}
                    {ms.pairLabel && pairColor && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 2, background: hasIssue ? "#FEE2E2" : pairColor.bg, color: hasIssue ? "#DC2626" : pairColor.dot, border: `1px solid ${hasIssue ? "#FECACA" : pairColor.border}` }}>{ms.pairLabel}</span>
                        <span style={{ fontSize: 9, color: hasIssue ? "#DC2626" : "#94A3B8" }}>{ms.pairLabel === "START" ? "→" : "←"} {milestones.find((m) => m.id === ms.paired)?.name}</span>
                      </span>
                    )}
                    {hasIssue && ms.pairLabel && <span style={{ color: "#EF4444", display: "flex", alignItems: "center" }}><AlertIcon /></span>}
                    {/* Delete button on table view */}
                    {showTable && onDelete && !ms.boundary && (
                      <button onClick={(e) => { e.stopPropagation(); onDelete(ms.id); }}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#CBD5E1", display: "flex", alignItems: "center", padding: 2, borderRadius: 3, opacity: isHovered ? 1 : 0, transition: "opacity 0.15s" }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "#EF4444"} onMouseLeave={(e) => e.currentTarget.style.color = "#CBD5E1"}>
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {expanded && internal.length === 0 && (
          <div style={{ padding: "8px 10px", fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>No optional milestones</div>
        )}
      </div>
    </div>
  );
};

// ─── Inheritance Breadcrumb ──────────────────────────────────────────
const InheritanceBreadcrumb = ({ levels }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 0, fontSize: 10, color: "#94A3B8", padding: "7px 10px", background: "#F8FAFC", borderRadius: 5, border: "1px solid #F1F5F9", marginBottom: 10 }}>
    <span style={{ fontWeight: 600, color: "#64748B", fontSize: 9, marginRight: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Inheritance:</span>
    {levels.map((l, i) => (
      <span key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <span style={{ padding: "2px 6px", borderRadius: 3, background: l.active ? "#EFF6FF" : "transparent", border: l.active ? "1px solid #BFDBFE" : "1px solid transparent", fontWeight: l.active ? 600 : 400, color: l.active ? "#1D4ED8" : "#94A3B8" }}>{l.label}</span>
        {i < levels.length - 1 && <span style={{ margin: "0 2px", color: "#CBD5E1" }}><ArrowRightIcon /></span>}
      </span>
    ))}
  </div>
);

// ─── Add Procedure Dropdown ──────────────────────────────────────────
const AddProcedureDropdown = ({ onAdd, existingProcIds }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const available = useMemo(() => {
    const ex = new Set(existingProcIds);
    let list = PROCEDURES.filter((p) => !ex.has(p.id));
    if (search) { const q = search.toLowerCase(); list = list.filter((p) => p.name.toLowerCase().includes(q)); }
    return list;
  }, [existingProcIds, search]);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", border: "1.5px dashed #CBD5E1", borderRadius: 6, background: "#FAFBFC", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#64748B", fontFamily: "inherit", width: "100%", justifyContent: "center" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3B82F6"; e.currentTarget.style.color = "#3B82F6"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.color = "#64748B"; }}
      ><PlusIcon /> Add Procedure Override</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, maxHeight: 260, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 8px 4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", background: "#F8FAFC", borderRadius: 5, border: "1px solid #E2E8F0" }}>
                <SearchIcon />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search procedures..." autoFocus style={{ border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1E293B", width: "100%", fontFamily: "inherit" }} />
              </div>
            </div>
            <div style={{ overflowY: "auto", padding: "4px" }}>
              {available.length === 0 && <div style={{ padding: 12, textAlign: "center", fontSize: 11, color: "#94A3B8" }}>{search ? "No match" : "All added"}</div>}
              {available.map((p) => (
                <div key={p.id} onClick={() => { onAdd(p.id); setOpen(false); setSearch(""); }} style={{ padding: "7px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, color: "#1E293B" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#F1F5F9"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>{p.name}</div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Add Milestone Modal ─────────────────────────────────────────────
const AddMilestoneModal = ({ onAdd, onClose, milestones }) => {
  const [name, setName] = useState("");
  const [phase, setPhase] = useState("pre-op");
  const [pairWith, setPairWith] = useState("");
  const [pairRole, setPairRole] = useState("START");

  const unpaired = milestones.filter((m) => !m.boundary && m.phase === phase && !m.paired);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();
    const ms = { id, name: name.trim(), phase };
    if (pairWith) {
      const pairGroupId = id + "-pg";
      ms.paired = pairWith;
      ms.pairLabel = pairRole;
      ms.pairGroup = pairGroupId;
    }
    onAdd(ms, pairWith, pairRole);
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 200 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "#FFF", borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", width: 400, zIndex: 201, padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Add Milestone</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94A3B8", display: "flex" }}><XIcon /></button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Milestone Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Skin Prep"
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12, fontFamily: "inherit", color: "#1E293B", outline: "none", boxSizing: "border-box" }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Phase</label>
          <div style={{ display: "flex", gap: 4 }}>
            {PHASES.map((p) => (
              <button key={p.id} onClick={() => { setPhase(p.id); setPairWith(""); }}
                style={{ padding: "5px 10px", border: `1.5px solid ${phase === p.id ? p.color : "#E2E8F0"}`, borderRadius: 5, background: phase === p.id ? `${p.color}10` : "#FFF", fontSize: 11, fontWeight: phase === p.id ? 600 : 400, color: phase === p.id ? p.color : "#64748B", cursor: "pointer", fontFamily: "inherit" }}
              >{p.label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pair With (optional)</label>
          <select value={pairWith} onChange={(e) => setPairWith(e.target.value)}
            style={{ width: "100%", padding: "7px 8px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 11, fontFamily: "inherit", color: "#1E293B", background: "#FFF" }}>
            <option value="">None — standalone milestone</option>
            {unpaired.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
          {pairWith && (
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 10, color: "#64748B", display: "flex", alignItems: "center" }}>This milestone is the:</span>
              {["START", "END"].map((r) => (
                <button key={r} onClick={() => setPairRole(r)}
                  style={{ padding: "4px 12px", border: `1.5px solid ${pairRole === r ? "#3B82F6" : "#E2E8F0"}`, borderRadius: 4, background: pairRole === r ? "#EFF6FF" : "#FFF", fontSize: 10, fontWeight: 600, color: pairRole === r ? "#3B82F6" : "#64748B", cursor: "pointer", fontFamily: "inherit" }}>{r}</button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "7px 16px", border: "1px solid #E2E8F0", borderRadius: 6, background: "#FFF", fontSize: 11, fontWeight: 500, color: "#64748B", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!name.trim()}
            style={{ padding: "7px 16px", border: "none", borderRadius: 6, background: name.trim() ? "#3B82F6" : "#CBD5E1", fontSize: 11, fontWeight: 600, color: "#FFF", cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>Add Milestone</button>
        </div>
      </div>
    </>
  );
};

// ─── Main App ────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("milestones");
  const [milestones, setMilestones] = useState(INITIAL_MILESTONES);
  const [procOverrides, setProcOverrides] = useState(() => initProcOverrides(INITIAL_MILESTONES));
  const [surgeonOverrides, setSurgeonOverrides] = useState(() => initSurgeonOverrides(INITIAL_MILESTONES));
  const [showAddModal, setShowAddModal] = useState(false);

  const [selectedProc, setSelectedProc] = useState(PROCEDURES[0].id);
  const [procSearch, setProcSearch] = useState("");
  const [procFilter, setProcFilter] = useState("all");
  const [selectedSurgeon, setSelectedSurgeon] = useState(SURGEONS[0].id);
  const [selectedSurgeonProc, setSelectedSurgeonProc] = useState("proc-0");
  const [surgeonSearch, setSurgeonSearch] = useState("");

  const defaultConfig = useMemo(() => buildDefaultConfig(milestones), [milestones]);
  const pairIssues = useMemo(() => getPairIssues(milestones), [milestones]);

  const onReorder = useCallback((phaseId, newInternal) => {
    setMilestones((prev) => {
      const result = []; let ins = false;
      prev.forEach((ms) => {
        if (ms.phase === phaseId && !ms.boundary) { if (!ins) { result.push(...newInternal); ins = true; } }
        else result.push(ms);
      });
      return result;
    });
  }, []);

  const addMilestone = useCallback((ms, pairedWithId, pairRole) => {
    setMilestones((prev) => {
      const result = [...prev];
      // If pairing, update the paired milestone too
      if (pairedWithId) {
        const pairGroupId = ms.pairGroup;
        const partnerIdx = result.findIndex((m) => m.id === pairedWithId);
        if (partnerIdx !== -1) {
          result[partnerIdx] = { ...result[partnerIdx], paired: ms.id, pairLabel: pairRole === "START" ? "END" : "START", pairGroup: pairGroupId };
          // Assign a color to new pair group
          if (!PAIR_COLORS[pairGroupId]) {
            const colors = ["#6366F1", "#14B8A6", "#F97316", "#06B6D4", "#A855F7"];
            const colorIdx = Object.keys(PAIR_COLORS).length % colors.length;
            PAIR_COLORS[pairGroupId] = { bg: `${colors[colorIdx]}10`, border: `${colors[colorIdx]}60`, dot: colors[colorIdx], label: ms.name.split(" ")[0] };
          }
        }
      }
      // Insert at end of the phase's internal milestones
      const phaseMs = result.filter((m) => m.phase === ms.phase && !m.boundary);
      if (phaseMs.length > 0) {
        const lastIdx = result.lastIndexOf(phaseMs[phaseMs.length - 1]);
        result.splice(lastIdx + 1, 0, ms);
      } else {
        // Find the boundary that starts this phase
        const boundaryIdx = result.findIndex((m) => m.boundary && m.boundaryBetween?.[1] === ms.phase);
        result.splice(boundaryIdx !== -1 ? boundaryIdx + 1 : result.length, 0, ms);
      }
      return result;
    });
  }, []);

  const removeMilestone = useCallback((id) => {
    setMilestones((prev) => {
      const target = prev.find((m) => m.id === id);
      let result = prev.filter((m) => m.id !== id);
      // Unpair the partner if paired
      if (target?.paired) {
        result = result.map((m) => m.id === target.paired ? { ...m, paired: undefined, pairLabel: undefined, pairGroup: undefined } : m);
      }
      return result;
    });
  }, []);

  // ── Procedure logic ──
  const procFiltered = useMemo(() => {
    let list = PROCEDURES;
    if (procSearch) { const q = procSearch.toLowerCase(); list = list.filter((p) => p.name.toLowerCase().includes(q)); }
    if (procFilter === "customized") list = list.filter((p) => isProcCustomized(p.id, procOverrides, defaultConfig));
    if (procFilter === "default") list = list.filter((p) => !isProcCustomized(p.id, procOverrides, defaultConfig));
    if (procFilter === "surgeon-overrides") list = list.filter((p) => surgeonsOverridingProc(p.id, surgeonOverrides, procOverrides, defaultConfig).length > 0);
    return list;
  }, [procSearch, procFilter, procOverrides, surgeonOverrides, defaultConfig]);
  const procCustomCount = PROCEDURES.filter((p) => isProcCustomized(p.id, procOverrides, defaultConfig)).length;
  const procSurgOvCount = PROCEDURES.filter((p) => surgeonsOverridingProc(p.id, surgeonOverrides, procOverrides, defaultConfig).length > 0).length;

  const handleProcToggle = useCallback((msId) => {
    setProcOverrides((prev) => {
      const cur = prev[selectedProc] || { ...defaultConfig };
      const upd = { ...cur, [msId]: !cur[msId] };
      if (!Object.keys(defaultConfig).some((k) => upd[k] !== defaultConfig[k])) { const n = { ...prev }; delete n[selectedProc]; return n; }
      return { ...prev, [selectedProc]: upd };
    });
  }, [selectedProc, defaultConfig]);
  const resetProc = useCallback(() => { setProcOverrides((prev) => { const n = { ...prev }; delete n[selectedProc]; return n; }); }, [selectedProc]);

  const procConfig = getEffectiveProc(selectedProc, procOverrides, defaultConfig);
  const procIsCustom = isProcCustomized(selectedProc, procOverrides, defaultConfig);
  const procOverriddenIds = useMemo(() => {
    const s = new Set();
    if (procOverrides[selectedProc]) Object.keys(defaultConfig).forEach((k) => { if (procOverrides[selectedProc][k] !== defaultConfig[k]) s.add(k); });
    return s;
  }, [selectedProc, procOverrides, defaultConfig]);
  const surgOvForProc = surgeonsOverridingProc(selectedProc, surgeonOverrides, procOverrides, defaultConfig);
  const enabledProc = milestones.filter((ms) => ms.boundary || procConfig[ms.id] !== false).length;

  // ── Surgeon logic ──
  const surgeonFiltered = useMemo(() => {
    let list = SURGEONS;
    if (surgeonSearch) { const q = surgeonSearch.toLowerCase(); list = list.filter((s) => s.name.toLowerCase().includes(q) || s.specialty.toLowerCase().includes(q)); }
    return list;
  }, [surgeonSearch]);
  const surgeonProcIds = getSurgeonOverrideProcIds(selectedSurgeon, surgeonOverrides);
  const surgeonProcs = surgeonProcIds.map((pid) => PROCEDURES.find((p) => p.id === pid)).filter(Boolean);

  const handleSurgeonToggle = useCallback((msId) => {
    setSurgeonOverrides((prev) => {
      const parent = getEffectiveProc(selectedSurgeonProc, procOverrides, defaultConfig);
      const cur = prev[selectedSurgeon]?.[selectedSurgeonProc] || { ...parent };
      const upd = { ...cur, [msId]: !cur[msId] };
      const still = Object.keys(defaultConfig).some((k) => upd[k] !== parent[k]);
      const next = { ...prev, [selectedSurgeon]: { ...(prev[selectedSurgeon] || {}) } };
      if (!still) { delete next[selectedSurgeon][selectedSurgeonProc]; if (!Object.keys(next[selectedSurgeon]).length) delete next[selectedSurgeon]; }
      else next[selectedSurgeon][selectedSurgeonProc] = upd;
      return next;
    });
  }, [selectedSurgeon, selectedSurgeonProc, procOverrides, defaultConfig]);
  const resetSurgeon = () => {
    setSurgeonOverrides((prev) => {
      const next = { ...prev, [selectedSurgeon]: { ...(prev[selectedSurgeon] || {}) } };
      delete next[selectedSurgeon][selectedSurgeonProc]; if (!Object.keys(next[selectedSurgeon]).length) delete next[selectedSurgeon]; return next;
    });
    if (surgeonProcIds.length <= 1) setSelectedSurgeonProc("");
  };
  const addSurgeonProc = (procId) => {
    const parent = getEffectiveProc(procId, procOverrides, defaultConfig);
    setSurgeonOverrides((prev) => ({ ...prev, [selectedSurgeon]: { ...(prev[selectedSurgeon] || {}), [procId]: { ...parent } } }));
    setSelectedSurgeonProc(procId);
  };
  const removeSurgeonProc = (procId) => {
    setSurgeonOverrides((prev) => {
      const next = { ...prev, [selectedSurgeon]: { ...(prev[selectedSurgeon] || {}) } };
      delete next[selectedSurgeon][procId]; if (!Object.keys(next[selectedSurgeon]).length) delete next[selectedSurgeon]; return next;
    });
    if (selectedSurgeonProc === procId) { const rem = surgeonProcIds.filter((id) => id !== procId); setSelectedSurgeonProc(rem[0] || ""); }
  };

  const surgeonConfig = selectedSurgeonProc ? getSurgeonEffective(selectedSurgeon, selectedSurgeonProc, procOverrides, surgeonOverrides, defaultConfig) : null;
  const surgeonIsCustom = selectedSurgeonProc ? isSurgeonCustomized(selectedSurgeon, selectedSurgeonProc, procOverrides, surgeonOverrides, defaultConfig) : false;
  const surgeonOverriddenIds = useMemo(() => {
    const s = new Set();
    if (surgeonOverrides[selectedSurgeon]?.[selectedSurgeonProc]) {
      const parent = getEffectiveProc(selectedSurgeonProc, procOverrides, defaultConfig);
      Object.keys(defaultConfig).forEach((k) => { if (surgeonOverrides[selectedSurgeon][selectedSurgeonProc][k] !== parent[k]) s.add(k); });
    }
    return s;
  }, [selectedSurgeon, selectedSurgeonProc, procOverrides, surgeonOverrides, defaultConfig]);
  const parentForSurgeon = selectedSurgeonProc ? getEffectiveProc(selectedSurgeonProc, procOverrides, defaultConfig) : defaultConfig;
  const enabledSurgeon = surgeonConfig ? milestones.filter((ms) => ms.boundary || surgeonConfig[ms.id] !== false).length : 0;

  const totalBoundary = milestones.filter((m) => m.boundary).length;
  const totalOptional = milestones.filter((m) => !m.boundary).length;

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F1F5F9", minHeight: "100vh", color: "#1E293B", display: "flex" }}>
      {/* Sidebar */}
      <div style={{ width: 56, minWidth: 56, background: "#1E293B", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, gap: 4 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#FFF", marginBottom: 12 }}>OR</div>
        {[
          { id: "milestones", icon: <ClockIcon />, label: "Milestones" },
          { id: "procedures", icon: <LayersIcon />, label: "Procedure Milestones" },
          { id: "surgeons", icon: <UserIcon />, label: "Surgeon Milestones" },
        ].map((item) => (
          <button key={item.id} onClick={() => setPage(item.id)} title={item.label}
            style={{ width: 40, height: 40, borderRadius: 8, border: "none", background: page === item.id ? "#334155" : "transparent", color: page === item.id ? "#FFF" : "#64748B", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
            {item.icon}
            {item.id === "surgeons" && Object.keys(surgeonOverrides).length > 0 && (
              <div style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", border: "1.5px solid #1E293B" }} />
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ background: "#FFF", borderBottom: "1px solid #E2E8F0", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
              {{ milestones: "Milestones", procedures: "Procedure Milestones", surgeons: "Surgeon Milestones" }[page]}
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 10, color: "#64748B" }}>
              {{ milestones: "Facility-level milestone definitions. Drag to reorder, add or remove milestones.", procedures: "Configure milestone overrides per procedure type.", surgeons: "Configure per-surgeon milestone overrides." }[page]}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {Object.keys(pairIssues).length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 10, fontWeight: 600, color: "#DC2626" }}>
                <AlertIcon /> {Object.keys(pairIssues).length} pair issue{Object.keys(pairIssues).length > 1 ? "s" : ""}
              </div>
            )}
            {page === "milestones" && (
              <button onClick={() => setShowAddModal(true)}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", border: "none", borderRadius: 6, background: "#3B82F6", fontSize: 11, fontWeight: 600, color: "#FFF", cursor: "pointer", fontFamily: "inherit" }}>
                <PlusIcon /> Add Milestone
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* ─── MILESTONES PAGE ─── */}
          {page === "milestones" && (
            <div style={{ flex: 1, overflowY: "auto", background: "#F8FAFC" }}>
              <div style={{ maxWidth: 620, margin: "0 auto", padding: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {PHASES.map((ph) => (
                    <PhaseBlock key={ph.id} phase={ph} milestones={milestones}
                      config={null} parentConfig={null} pairIssues={pairIssues}
                      overriddenIds={null} inheritLabel={null}
                      onToggle={null} onReorder={onReorder} draggable={true}
                      showTable={true} onDelete={removeMilestone} />
                  ))}
                  {milestones.filter((ms) => ms.boundary && ms.boundaryBetween?.[0] === "post-op").map((ms) => <BoundaryMarker key={ms.id} ms={ms} />)}
                </div>
                <div style={{ marginTop: 12, padding: "8px 14px", background: "#FFF", borderRadius: 6, border: "1px solid #F1F5F9", fontSize: 10, color: "#94A3B8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{milestones.length} total · {totalBoundary} boundary · {totalOptional} optional</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── PROCEDURE PAGE ─── */}
          {page === "procedures" && (
            <>
              <div style={{ width: 280, minWidth: 280, borderRight: "1px solid #E2E8F0", background: "#FFF", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "10px 10px 6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", background: "#F8FAFC", borderRadius: 5, border: "1px solid #E2E8F0" }}>
                    <SearchIcon /><input value={procSearch} onChange={(e) => setProcSearch(e.target.value)} placeholder="Search procedures..." style={{ border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1E293B", width: "100%", fontFamily: "inherit" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 1, padding: "0 10px 6px", flexWrap: "wrap" }}>
                  {[
                    { id: "all", label: "All", count: PROCEDURES.length },
                    { id: "customized", label: "Customized", count: procCustomCount },
                    { id: "default", label: "Default", count: PROCEDURES.length - procCustomCount },
                    { id: "surgeon-overrides", label: "Surg. Overrides", count: procSurgOvCount },
                  ].map((f) => (
                    <button key={f.id} onClick={() => setProcFilter(f.id)}
                      style={{ padding: "3px 7px", border: "none", borderRadius: 3, fontSize: 10, fontWeight: procFilter === f.id ? 600 : 400, color: procFilter === f.id ? (f.id === "surgeon-overrides" ? "#7C3AED" : "#1E293B") : "#64748B", background: procFilter === f.id ? (f.id === "surgeon-overrides" ? "#EDE9FE" : "#F1F5F9") : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                      {f.label} <span style={{ color: "#94A3B8" }}>({f.count})</span></button>
                  ))}
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 6px" }}>
                  {procFiltered.map((p) => {
                    const custom = isProcCustomized(p.id, procOverrides, defaultConfig);
                    const diff = procDiffCount(p.id, procOverrides, defaultConfig);
                    const surgOv = surgeonsOverridingProc(p.id, surgeonOverrides, procOverrides, defaultConfig);
                    const isSel = p.id === selectedProc;
                    return (
                      <div key={p.id} onClick={() => setSelectedProc(p.id)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 5, cursor: "pointer", background: isSel ? "#EFF6FF" : "transparent", border: isSel ? "1px solid #BFDBFE" : "1px solid transparent", marginBottom: 1 }}
                        onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "#F8FAFC"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isSel ? "#EFF6FF" : "transparent"; }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: isSel ? 600 : 500, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 9, color: "#94A3B8" }}>{custom ? `${diff} override${diff !== 1 ? "s" : ""}` : "Default"}</span>
                            {surgOv.length > 0 && <span style={{ fontSize: 9, color: "#7C3AED", fontWeight: 500, display: "flex", alignItems: "center", gap: 2 }}><UserIcon /> {surgOv.length}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          {custom && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#F59E0B" }} />}
                          {surgOv.length > 0 && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#8B5CF6" }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", background: "#F8FAFC" }}>
                <div style={{ background: "#FFF", borderBottom: "1px solid #E2E8F0", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{PROCEDURES.find((p) => p.id === selectedProc)?.name}</h2>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: procIsCustom ? "#FEF3C7" : "#F1F5F9", color: procIsCustom ? "#B45309" : "#64748B" }}>{procIsCustom ? "CUSTOMIZED" : "DEFAULT"}</span>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "#64748B" }}>{enabledProc}/{milestones.length} milestones active</p>
                  </div>
                  {procIsCustom && <button onClick={resetProc} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", border: "1px solid #E2E8F0", borderRadius: 5, background: "#FFF", cursor: "pointer", fontSize: 10, fontWeight: 500, color: "#64748B", fontFamily: "inherit" }}><UndoIcon /> Reset</button>}
                </div>
                <div style={{ padding: "14px 20px", maxWidth: 520 }}>
                  <InheritanceBreadcrumb levels={[{ label: "Facility Default", active: !procIsCustom }, { label: PROCEDURES.find((p) => p.id === selectedProc)?.name, active: procIsCustom }]} />
                  {surgOvForProc.length > 0 && (
                    <div style={{ padding: "8px 12px", marginBottom: 10, background: "#EDE9FE", border: "1px solid #DDD6FE", borderRadius: 5, fontSize: 10, color: "#5B21B6", display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <UserIcon /><div><strong>{surgOvForProc.length} surgeon{surgOvForProc.length !== 1 ? "s" : ""}</strong> override this:
                        <div style={{ marginTop: 3, display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {surgOvForProc.map((s) => (<span key={s.id} onClick={() => { setPage("surgeons"); setSelectedSurgeon(s.id); setSelectedSurgeonProc(selectedProc); }} style={{ padding: "2px 6px", borderRadius: 3, background: "#DDD6FE", cursor: "pointer", fontWeight: 500, fontSize: 10 }}>{s.name} →</span>))}
                        </div></div>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {PHASES.map((ph) => <PhaseBlock key={ph.id} phase={ph} milestones={milestones} config={procConfig} parentConfig={defaultConfig} pairIssues={pairIssues} overriddenIds={procOverriddenIds} inheritLabel="OVERRIDE" onToggle={handleProcToggle} onReorder={onReorder} draggable={true} showTable={false} />)}
                    {milestones.filter((ms) => ms.boundary && ms.boundaryBetween?.[0] === "post-op").map((ms) => <BoundaryMarker key={ms.id} ms={ms} />)}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─── SURGEON PAGE ─── */}
          {page === "surgeons" && (
            <>
              <div style={{ width: 280, minWidth: 280, borderRight: "1px solid #E2E8F0", background: "#FFF", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "10px 10px 6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", background: "#F8FAFC", borderRadius: 5, border: "1px solid #E2E8F0" }}>
                    <SearchIcon /><input value={surgeonSearch} onChange={(e) => setSurgeonSearch(e.target.value)} placeholder="Search surgeons..." style={{ border: "none", outline: "none", background: "transparent", fontSize: 11, color: "#1E293B", width: "100%", fontFamily: "inherit" }} />
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 6px" }}>
                  {surgeonFiltered.map((s) => {
                    const oc = surgeonOverrideCount(s.id, procOverrides, surgeonOverrides, defaultConfig);
                    const isSel = s.id === selectedSurgeon;
                    return (
                      <div key={s.id} onClick={() => { setSelectedSurgeon(s.id); const pids = getSurgeonOverrideProcIds(s.id, surgeonOverrides); setSelectedSurgeonProc(pids[0] || ""); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 5, cursor: "pointer", background: isSel ? "#EFF6FF" : "transparent", border: isSel ? "1px solid #BFDBFE" : "1px solid transparent", marginBottom: 1 }}
                        onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "#F8FAFC"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isSel ? "#EFF6FF" : "transparent"; }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: oc > 0 ? "#EDE9FE" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: oc > 0 ? "#7C3AED" : "#94A3B8", flexShrink: 0 }}>{s.avatar}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: isSel ? 600 : 500, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                          <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 1 }}>{s.specialty}{oc > 0 ? <span style={{ color: "#7C3AED", fontWeight: 500 }}> · {oc} procedure{oc !== 1 ? "s" : ""}</span> : " · No overrides"}</div>
                        </div>
                        {oc > 0 && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#8B5CF6", flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", background: "#F8FAFC" }}>
                <div style={{ background: "#FFF", borderBottom: "1px solid #E2E8F0", padding: "12px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 6, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#7C3AED" }}>{SURGEONS.find((s) => s.id === selectedSurgeon)?.avatar}</div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{SURGEONS.find((s) => s.id === selectedSurgeon)?.name}</h2>
                      <p style={{ margin: 0, fontSize: 10, color: "#64748B" }}>{SURGEONS.find((s) => s.id === selectedSurgeon)?.specialty}</p>
                    </div>
                  </div>
                </div>
                <div style={{ padding: "14px 20px", maxWidth: 520 }}>
                  {surgeonProcs.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#64748B", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Procedure Overrides ({surgeonProcs.length})</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                        {surgeonProcs.map((p) => {
                          const isAct = p.id === selectedSurgeonProc;
                          const hasDiff = isSurgeonCustomized(selectedSurgeon, p.id, procOverrides, surgeonOverrides, defaultConfig);
                          return (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", borderRadius: 6, overflow: "hidden", border: isAct ? "1.5px solid #3B82F6" : "1.5px solid #E2E8F0", background: isAct ? "#EFF6FF" : "#FFF" }}>
                              <button onClick={() => setSelectedSurgeonProc(p.id)} style={{ padding: "5px 8px", border: "none", background: "transparent", fontSize: 11, fontWeight: isAct ? 600 : 400, color: isAct ? "#1D4ED8" : "#475569", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                                {p.name}{hasDiff && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#8B5CF6" }} />}{!hasDiff && <span style={{ fontSize: 8, color: "#94A3B8" }}>no diff</span>}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); removeSurgeonProc(p.id); }} style={{ padding: "5px 6px", border: "none", borderLeft: "1px solid #E2E8F0", background: "transparent", cursor: "pointer", color: "#94A3B8", display: "flex", alignItems: "center" }}
                                onMouseEnter={(e) => e.currentTarget.style.color = "#EF4444"} onMouseLeave={(e) => e.currentTarget.style.color = "#94A3B8"}><XIcon /></button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div style={{ marginBottom: 14 }}><AddProcedureDropdown onAdd={addSurgeonProc} existingProcIds={surgeonProcIds} /></div>
                  {selectedSurgeonProc && surgeonConfig ? (
                    <>
                      <InheritanceBreadcrumb levels={[
                        { label: "Facility Default", active: !isProcCustomized(selectedSurgeonProc, procOverrides, defaultConfig) && !surgeonIsCustom },
                        { label: PROCEDURES.find((p) => p.id === selectedSurgeonProc)?.name || "", active: isProcCustomized(selectedSurgeonProc, procOverrides, defaultConfig) && !surgeonIsCustom },
                        { label: SURGEONS.find((s) => s.id === selectedSurgeon)?.name.split(" ").pop() || "", active: surgeonIsCustom },
                      ]} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: "#64748B" }}>{enabledSurgeon}/{milestones.length} active{surgeonIsCustom && ` · ${surgeonOverriddenIds.size} override${surgeonOverriddenIds.size !== 1 ? "s" : ""}`}</div>
                        {surgeonIsCustom && <button onClick={resetSurgeon} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", border: "1px solid #E2E8F0", borderRadius: 4, background: "#FFF", cursor: "pointer", fontSize: 10, fontWeight: 500, color: "#64748B", fontFamily: "inherit" }}><UndoIcon /> Reset</button>}
                      </div>
                      {!surgeonIsCustom && (
                        <div style={{ padding: "8px 12px", marginBottom: 10, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 5, fontSize: 10, color: "#166534", display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                          Matching {isProcCustomized(selectedSurgeonProc, procOverrides, defaultConfig) ? "procedure" : "facility default"} config. Toggle any milestone to create a surgeon override.
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                        {PHASES.map((ph) => <PhaseBlock key={ph.id} phase={ph} milestones={milestones} config={surgeonConfig} parentConfig={parentForSurgeon} pairIssues={pairIssues} overriddenIds={surgeonOverriddenIds} inheritLabel="SURGEON" onToggle={handleSurgeonToggle} onReorder={onReorder} draggable={false} showTable={false} />)}
                        {milestones.filter((ms) => ms.boundary && ms.boundaryBetween?.[0] === "post-op").map((ms) => <BoundaryMarker key={ms.id} ms={ms} />)}
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "#94A3B8" }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#64748B", marginBottom: 4 }}>No procedure overrides yet</div>
                      <div style={{ fontSize: 11 }}>Use &ldquo;Add Procedure Override&rdquo; to configure surgeon-specific milestones.</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showAddModal && <AddMilestoneModal onAdd={addMilestone} onClose={() => setShowAddModal(false)} milestones={milestones} />}
    </div>
  );
}
