import { useState, useCallback } from "react";

// ── Data ────────────────────────────────────────────────────
// Phases: just name + color. That's it.
const PHASE_LIBRARY = [
  { id: "p1", name: "Pre-Op", color: "#3b82f6" },
  { id: "p2", name: "Surgical", color: "#f59e0b" },
  { id: "p3", name: "Closing", color: "#10b981" },
  { id: "p4", name: "Post-Op", color: "#8b5cf6" },
  { id: "p5", name: "Anesthesia", color: "#06b6d4" },
  { id: "p6", name: "Positioning", color: "#ec4899" },
  { id: "p7", name: "Tourniquet", color: "#f97316" },
];

const MILESTONE_LIBRARY = [
  { id: "m1", name: "Patient In", pairId: null, pairPos: null },
  { id: "m2", name: "Pre-Op Verification", pairId: null, pairPos: null },
  { id: "m3", name: "Anesthesia Start", pairId: "m4", pairPos: "start" },
  { id: "m4", name: "Anesthesia End", pairId: "m3", pairPos: "end" },
  { id: "m5", name: "Incision", pairId: null, pairPos: null },
  { id: "m6", name: "Array Start", pairId: "m7", pairPos: "start" },
  { id: "m7", name: "Array End", pairId: "m6", pairPos: "end" },
  { id: "m8", name: "Implants Placed", pairId: null, pairPos: null },
  { id: "m9", name: "Closing Start", pairId: null, pairPos: null },
  { id: "m10", name: "Final Count", pairId: null, pairPos: null },
  { id: "m11", name: "Patient Out", pairId: null, pairPos: null },
  { id: "m12", name: "Room Cleaned", pairId: null, pairPos: null },
  { id: "m13", name: "Tourniquet Up", pairId: "m14", pairPos: "start" },
  { id: "m14", name: "Tourniquet Down", pairId: "m13", pairPos: "end" },
  { id: "m15", name: "Positioning Complete", pairId: null, pairPos: null },
];

// Template: phases with ordered milestones
// A milestone can appear in TWO adjacent phases — as the last of one and first of the next
// This signals "shared boundary" — it ends one phase and starts the next
const INITIAL_PHASES = [
  {
    phaseId: "p1", parentPhaseId: null, order: 0,
    milestones: [
      { id: "m1", enabled: true },
      { id: "m2", enabled: true },
      { id: "m3", enabled: true },
      { id: "m4", enabled: true },
      { id: "m5", enabled: true }, // Incision: last of Pre-Op
    ],
  },
  {
    phaseId: "p5", parentPhaseId: "p1", order: 0, // Anesthesia nested under Pre-Op
    milestones: [
      { id: "m3", enabled: true }, // Anesthesia Start
      { id: "m4", enabled: true }, // Anesthesia End
    ],
  },
  {
    phaseId: "p2", parentPhaseId: null, order: 1,
    milestones: [
      { id: "m5", enabled: true }, // Incision: first of Surgical (SHARED with Pre-Op)
      { id: "m6", enabled: true },
      { id: "m7", enabled: true },
      { id: "m8", enabled: true },
      { id: "m9", enabled: true }, // Closing Start: last of Surgical
    ],
  },
  {
    phaseId: "p3", parentPhaseId: null, order: 2,
    milestones: [
      { id: "m9", enabled: true },  // Closing Start: first of Closing (SHARED with Surgical)
      { id: "m10", enabled: true },
      { id: "m11", enabled: true }, // Patient Out: last of Closing
    ],
  },
  {
    phaseId: "p4", parentPhaseId: null, order: 3,
    milestones: [
      { id: "m11", enabled: true }, // Patient Out: first of Post-Op (SHARED with Closing)
      { id: "m12", enabled: true },
    ],
  },
];

const TEMPLATES_LIST = [
  { id: "t1", name: "Facility Default", isDefault: true },
  { id: "t2", name: "Mako THA Full", isDefault: false },
  { id: "t3", name: "Simple Scope", isDefault: false },
];

// ── Helpers ──────────────────────────────────────────────────

const getPhase = (id) => PHASE_LIBRARY.find(p => p.id === id);
const getMilestone = (id) => MILESTONE_LIBRARY.find(m => m.id === id);

// ── Icons ──────────────────────────────────────────────────

const Icon = ({ d, size = 14, color = "currentColor", ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d={d} />
  </svg>
);
const icons = {
  plus: "M12 5v14M5 12h14",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  grip: "M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18M6 6l12 12",
  chevRight: "M9 18l6-6-6-6",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  copy: "M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v2",
  info: "M12 16v-4M12 8h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z",
};

// ── Flow Stepper ─────────────────────────────────────────────

function FlowStepper({ current }) {
  const steps = ["Milestones", "Phases", "Templates", "Procedures", "Surgeons"];
  const keys = ["milestones", "phases", "templates", "procedures", "surgeons"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 16, padding: "8px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
      {steps.map((s, i) => (
        <div key={keys[i]} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 4, background: keys[i] === current ? "#2563eb" : "transparent", cursor: "pointer" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: keys[i] === current ? "#fff" : "#cbd5e1" }} />
            <span style={{ fontSize: 11, fontWeight: keys[i] === current ? 650 : 500, color: keys[i] === current ? "#fff" : "#64748b" }}>{s}</span>
          </div>
          {i < steps.length - 1 && <div style={{ width: 16, height: 1, background: "#e2e8f0", margin: "0 2px" }} />}
        </div>
      ))}
    </div>
  );
}

// ── Shared Boundary Connector ────────────────────────────────
// Renders ONCE between two phases when they share a milestone
// Shows "ENDS [Phase A]" + "STARTS [Phase B]" on a single element

function SharedBoundary({ milestone, endsPhase, startsPhase }) {
  const topColor = endsPhase.color;
  const bottomColor = startsPhase.color;

  return (
    <div style={{
      position: "relative",
      margin: "0 0",
      padding: "7px 12px",
      background: `linear-gradient(to right, ${topColor}06, transparent 30%, transparent 70%, ${bottomColor}06)`,
      borderTop: `1px solid ${topColor}25`,
      borderBottom: `1px solid ${bottomColor}25`,
    }}>
      {/* Center gradient line */}
      <div style={{
        position: "absolute", left: 26, top: 0, bottom: 0, width: 2,
        background: `linear-gradient(to bottom, ${topColor}50, ${bottomColor}50)`,
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {/* Diamond with gradient */}
        <div style={{
          width: 28, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, position: "relative", zIndex: 2,
        }}>
          <div style={{
            width: 12, height: 12,
            background: `linear-gradient(135deg, ${topColor}, ${bottomColor})`,
            transform: "rotate(45deg)", borderRadius: 2,
            boxShadow: "0 0 0 2.5px #fff, 0 0 0 3.5px #e2e8f0",
          }} />
        </div>

        {/* Name + dual badges */}
        <div style={{ marginLeft: 8, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 3 }}>
            {milestone.name}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: 9, fontWeight: 700, letterSpacing: "0.03em",
              padding: "2px 6px", borderRadius: 3,
              background: topColor + "12",
              color: topColor,
              border: `1px solid ${topColor}25`,
            }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={topColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
              ENDS {endsPhase.name.toUpperCase()}
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: 9, fontWeight: 700, letterSpacing: "0.03em",
              padding: "2px 6px", borderRadius: 3,
              background: bottomColor + "12",
              color: bottomColor,
              border: `1px solid ${bottomColor}25`,
            }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={bottomColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              STARTS {startsPhase.name.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Pair badge */}
        {milestone.pairPos && (
          <span style={{
            fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: 3,
            background: milestone.pairPos === "start" ? "#dcfce7" : "#fef3c7",
            color: milestone.pairPos === "start" ? "#16a34a" : "#d97706",
            textTransform: "uppercase",
          }}>{milestone.pairPos}</span>
        )}
      </div>
    </div>
  );
}

// ── Phase-edge Milestone ──────────────────────────────────────
// A milestone at the start or end of a phase that is NOT shared
// Gets a subtle position badge: "STARTS Pre-Op" or "ENDS Pre-Op"

function EdgeMilestone({ milestone, enabled, onToggle, phaseColor, phaseName, edge, onRemove }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 0,
        padding: "4px 8px 4px 4px",
        opacity: enabled ? 1 : 0.35,
        background: hover ? phaseColor + "06" : "transparent",
        transition: "background 0.1s", cursor: "grab",
        position: "relative",
      }}
    >
      {/* Phase rail */}
      <div style={{
        position: "absolute", left: 26, top: edge === "start" ? "50%" : 0,
        bottom: edge === "end" ? "50%" : 0, width: 2,
        background: phaseColor + "30",
      }} />

      {/* Drag handle */}
      <div style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: hover ? "#94a3b8" : "transparent", transition: "color 0.1s", position: "relative", zIndex: 1 }}>
        <Icon d={icons.grip} size={10} />
      </div>

      {/* Marker - slightly larger for edge milestones */}
      <div style={{
        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
        border: enabled ? "none" : `1.5px solid ${phaseColor}40`,
        background: enabled ? phaseColor : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 0.12s",
        position: "relative", zIndex: 2,
        boxShadow: `0 0 0 2px #fff`,
      }} onClick={() => onToggle(milestone.id)}>
        {enabled && <Icon d={icons.check} size={10} color="#fff" />}
      </div>

      {/* Name */}
      <span style={{ fontSize: 12.5, color: "#0f172a", fontWeight: 600, marginLeft: 7, flex: 1 }}>
        {milestone.name}
      </span>

      {/* Edge badge */}
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 2,
        fontSize: 8.5, fontWeight: 700, letterSpacing: "0.03em",
        padding: "1.5px 5px", borderRadius: 3,
        background: phaseColor + "10",
        color: phaseColor,
        border: `1px solid ${phaseColor}20`,
      }}>
        {edge === "start" ? (
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={phaseColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        ) : (
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={phaseColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
        )}
        {edge === "start" ? "STARTS" : "ENDS"} {phaseName.toUpperCase()}
      </span>

      {/* Pair badge */}
      {milestone.pairPos && (
        <span style={{
          fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 2, marginLeft: 3,
          background: milestone.pairPos === "start" ? "#dcfce7" : "#fef3c7",
          color: milestone.pairPos === "start" ? "#16a34a" : "#d97706",
          textTransform: "uppercase",
        }}>{milestone.pairPos}</span>
      )}

      {hover && (
        <button onClick={() => onRemove(milestone.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", marginLeft: 2 }}>
          <Icon d={icons.x} size={10} color="#dc2626" />
        </button>
      )}
    </div>
  );
}

// ── Interior Milestone ────────────────────────────────────────
// Milestones that aren't at the edges — simple row, no position badge

function InteriorMilestone({ milestone, enabled, onToggle, phaseColor, onRemove }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 0,
        padding: "3px 8px 3px 4px",
        opacity: enabled ? 1 : 0.35,
        background: hover ? "#f9fafb" : "transparent",
        transition: "background 0.1s", cursor: "grab",
        position: "relative",
      }}
    >
      {/* Phase rail */}
      <div style={{
        position: "absolute", left: 26, top: 0, bottom: 0, width: 2,
        background: phaseColor + "25",
      }} />

      <div style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: hover ? "#94a3b8" : "transparent", transition: "color 0.1s", position: "relative", zIndex: 1 }}>
        <Icon d={icons.grip} size={10} />
      </div>

      <button onClick={() => onToggle(milestone.id)} style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
        border: enabled ? "none" : "1.5px solid #cbd5e1",
        background: enabled ? phaseColor : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 0.12s",
        position: "relative", zIndex: 1,
      }}>
        {enabled && <Icon d={icons.check} size={9} color="#fff" />}
      </button>

      <span style={{ fontSize: 12, color: "#334155", fontWeight: 500, marginLeft: 7, flex: 1 }}>
        {milestone.name}
      </span>

      {milestone.pairPos && (
        <span style={{
          fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 2,
          background: milestone.pairPos === "start" ? "#dcfce7" : "#fef3c7",
          color: milestone.pairPos === "start" ? "#16a34a" : "#d97706",
          textTransform: "uppercase",
        }}>{milestone.pairPos}</span>
      )}

      {hover && (
        <button onClick={() => onRemove(milestone.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", marginLeft: 2 }}>
          <Icon d={icons.x} size={10} color="#dc2626" />
        </button>
      )}
    </div>
  );
}

// ── Build Render List ────────────────────────────────────────
// This is the core logic. Takes template phases and produces a flat
// render list that handles shared boundary milestones correctly.
//
// Rules:
// - Position determines role: first ms = starts phase, last ms = ends phase
// - If lastMs(phaseA) === firstMs(phaseB) → render ONCE as SharedBoundary
// - If not shared → render as EdgeMilestone with "STARTS" or "ENDS" badge
// - Everything in between → InteriorMilestone (no badge)

function buildRenderList(templatePhases) {
  const topLevel = templatePhases
    .filter(tp => !tp.parentPhaseId)
    .sort((a, b) => a.order - b.order);

  const items = [];

  for (let i = 0; i < topLevel.length; i++) {
    const tp = topLevel[i];
    const phase = getPhase(tp.phaseId);
    if (!phase) continue;

    const ms = tp.milestones;
    const prevTp = i > 0 ? topLevel[i - 1] : null;
    const nextTp = i < topLevel.length - 1 ? topLevel[i + 1] : null;

    const firstMsId = ms.length > 0 ? ms[0].id : null;
    const lastMsId = ms.length > 0 ? ms[ms.length - 1].id : null;
    const prevLastMsId = prevTp && prevTp.milestones.length > 0
      ? prevTp.milestones[prevTp.milestones.length - 1].id : null;
    const nextFirstMsId = nextTp && nextTp.milestones.length > 0
      ? nextTp.milestones[0].id : null;

    const sharedWithPrev = firstMsId && firstMsId === prevLastMsId;
    const sharedWithNext = lastMsId && lastMsId === nextFirstMsId;

    // Shared boundary BEFORE this phase (already rendered by prev phase's "sharedWithNext")
    // Skip — it was rendered after the previous phase

    // Phase header
    items.push({ type: "phase-header", phase: tp, phaseLib: phase });

    // Sub-phases for this phase
    const subPhases = templatePhases
      .filter(sp => sp.parentPhaseId === tp.phaseId)
      .sort((a, b) => a.order - b.order);

    // Render milestones
    for (let j = 0; j < ms.length; j++) {
      const m = ms[j];
      const milestone = getMilestone(m.id);
      if (!milestone) continue;

      const isFirst = j === 0;
      const isLast = j === ms.length - 1;
      const isOnly = ms.length === 1;

      // Skip if this is the first milestone and it was already rendered as a shared boundary
      if (isFirst && sharedWithPrev) continue;
      // Skip if this is the last milestone — we'll render it after the phase block
      if (isLast && sharedWithNext) continue;

      if (isFirst && !sharedWithPrev) {
        items.push({
          type: "edge-milestone", milestone, enabled: m.enabled,
          phaseId: tp.phaseId, phaseLib: phase, edge: isOnly && !sharedWithNext ? "only" : "start",
        });
      } else if (isLast && !sharedWithNext) {
        items.push({
          type: "edge-milestone", milestone, enabled: m.enabled,
          phaseId: tp.phaseId, phaseLib: phase, edge: "end",
        });
      } else {
        items.push({
          type: "interior-milestone", milestone, enabled: m.enabled,
          phaseId: tp.phaseId, phaseLib: phase,
        });
      }

      // Check if we should render sub-phase indicators near relevant milestones
      // Render sub-phase block after its parent milestone range
      for (const sp of subPhases) {
        const spMs = sp.milestones;
        if (spMs.length > 0 && spMs[spMs.length - 1].id === m.id) {
          const spPhase = getPhase(sp.phaseId);
          if (spPhase) {
            items.push({ type: "sub-phase", phase: sp, phaseLib: spPhase, parentPhase: phase });
          }
        }
      }
    }

    // Drop zone for milestones
    items.push({ type: "drop-zone", phaseId: tp.phaseId, phaseLib: phase });

    // Shared boundary AFTER this phase
    if (sharedWithNext && lastMsId) {
      const ms_obj = getMilestone(lastMsId);
      const nextPhase = getPhase(nextTp.phaseId);
      if (ms_obj && nextPhase) {
        items.push({
          type: "shared-boundary", milestone: ms_obj,
          endsPhase: phase, startsPhase: nextPhase,
        });
      }
    }
  }

  return items;
}

// ── Sub-phase Indicator ──────────────────────────────────────

function SubPhaseIndicator({ phaseLib, milestones, parentColor }) {
  return (
    <div style={{
      marginLeft: 30, marginRight: 8, marginTop: 1, marginBottom: 1,
      borderRadius: 5,
      border: `1.5px solid ${phaseLib.color}30`,
      background: phaseLib.color + "05",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "3px 8px",
        background: phaseLib.color + "0a",
        borderBottom: `1px solid ${phaseLib.color}15`,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: 1.5, background: phaseLib.color }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: phaseLib.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{phaseLib.name}</span>
        <span style={{ fontSize: 8, fontWeight: 600, color: "#94a3b8", background: "#f1f5f9", padding: "1px 4px", borderRadius: 2, marginLeft: 2 }}>SUB-PHASE</span>
        <span style={{ fontSize: 9.5, color: phaseLib.color + "70", marginLeft: "auto" }}>{milestones.length} ms</span>
      </div>
      {milestones.map((m, i) => {
        const ms = getMilestone(m.id);
        if (!ms) return null;
        const isFirst = i === 0;
        const isLast = i === milestones.length - 1;
        return (
          <div key={m.id} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "2.5px 8px 2.5px 10px",
            borderBottom: i < milestones.length - 1 ? `1px solid ${phaseLib.color}10` : "none",
          }}>
            <div style={{
              width: 12, height: 12, borderRadius: 2,
              background: m.enabled ? phaseLib.color : "#fff",
              border: m.enabled ? "none" : `1.5px solid ${phaseLib.color}35`,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: m.enabled ? 1 : 0.4,
            }}>
              {m.enabled && <Icon d={icons.check} size={8} color="#fff" />}
            </div>
            <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, flex: 1, opacity: m.enabled ? 1 : 0.4 }}>{ms.name}</span>
            {(isFirst || isLast) && milestones.length > 1 && (
              <span style={{
                fontSize: 7.5, fontWeight: 700, padding: "1px 4px", borderRadius: 2,
                background: phaseLib.color + "10", color: phaseLib.color,
                letterSpacing: "0.03em",
              }}>{isFirst ? "START" : "END"}</span>
            )}
            {ms.pairPos && (
              <span style={{
                fontSize: 7.5, fontWeight: 700, padding: "1px 3px", borderRadius: 2,
                background: ms.pairPos === "start" ? "#dcfce7" : "#fef3c7",
                color: ms.pairPos === "start" ? "#16a34a" : "#d97706",
                textTransform: "uppercase",
              }}>{ms.pairPos}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function TemplatesPage() {
  const [templatePhases, setTemplatePhases] = useState(INITIAL_PHASES);
  const [selectedTemplateId, setSelectedTemplateId] = useState("t1");
  const [libTab, setLibTab] = useState("milestones");
  const [searchLib, setSearchLib] = useState("");
  const [searchTemplates, setSearchTemplates] = useState("");

  // Derive assigned IDs for library filtering
  const assignedMilestoneIds = new Set(
    templatePhases.flatMap(tp => tp.milestones.map(m => m.id))
  );
  const assignedPhaseIds = new Set(templatePhases.map(tp => tp.phaseId));

  const availableMilestones = MILESTONE_LIBRARY.filter(m =>
    !assignedMilestoneIds.has(m.id) &&
    (!searchLib || m.name.toLowerCase().includes(searchLib.toLowerCase()))
  );
  const availablePhases = PHASE_LIBRARY.filter(p =>
    !assignedPhaseIds.has(p.id) &&
    (!searchLib || p.name.toLowerCase().includes(searchLib.toLowerCase()))
  );

  // Build render list
  const renderList = buildRenderList(templatePhases);

  // Handlers
  const toggleMilestone = useCallback((phaseId, msId) => {
    setTemplatePhases(prev => prev.map(tp =>
      tp.phaseId === phaseId
        ? { ...tp, milestones: tp.milestones.map(m => m.id === msId ? { ...m, enabled: !m.enabled } : m) }
        : tp
    ));
  }, []);

  const removeMilestone = useCallback((phaseId, msId) => {
    setTemplatePhases(prev => prev.map(tp =>
      tp.phaseId === phaseId
        ? { ...tp, milestones: tp.milestones.filter(m => m.id !== msId) }
        : tp
    ));
  }, []);

  const addMilestoneToPhase = useCallback((phaseId, msId) => {
    setTemplatePhases(prev => prev.map(tp =>
      tp.phaseId === phaseId
        ? { ...tp, milestones: [...tp.milestones, { id: msId, enabled: true }] }
        : tp
    ));
  }, []);

  const addPhaseToTemplate = useCallback((phaseId) => {
    if (assignedPhaseIds.has(phaseId)) return;
    const maxOrder = Math.max(...templatePhases.filter(tp => !tp.parentPhaseId).map(tp => tp.order), -1);
    setTemplatePhases(prev => [...prev, { phaseId, parentPhaseId: null, order: maxOrder + 1, milestones: [] }]);
  }, [assignedPhaseIds, templatePhases]);

  const removePhase = useCallback((phaseId) => {
    setTemplatePhases(prev => prev.filter(tp => tp.phaseId !== phaseId && tp.parentPhaseId !== phaseId));
  }, []);

  const totalEnabled = templatePhases.reduce((s, tp) => s + tp.milestones.filter(m => m.enabled).length, 0);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, -apple-system, sans-serif", background: "#f8fafc", minHeight: "100vh", padding: "20px 24px", color: "#1e293b" }}>
      <FlowStepper current="templates" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>Milestone Templates</h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "#64748b" }}>
            Arrange phases and milestones. Position determines boundaries — first and last milestones define phase edges.
          </p>
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, border: "none", borderRadius: 7, cursor: "pointer", background: "#2563eb", color: "#fff", boxShadow: "0 1px 3px rgba(37,99,235,0.25)" }}>
          <Icon d={icons.plus} size={13} color="#fff" />New Template
        </button>
      </div>

      <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff", height: "calc(100vh - 180px)", minHeight: 560, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>

        {/* ═══ Column 1: Template List ═══ */}
        <div style={{ width: 200, minWidth: 200, borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 8px 6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 7px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 5 }}>
              <Icon d={icons.search} size={11} color="#94a3b8" />
              <input value={searchTemplates} onChange={e => setSearchTemplates(e.target.value)} placeholder="Search..." style={{ border: "none", outline: "none", background: "none", fontSize: 11.5, color: "#1e293b", width: "100%" }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 4px 4px" }}>
            {TEMPLATES_LIST.filter(t => !searchTemplates || t.name.toLowerCase().includes(searchTemplates.toLowerCase())).map(t => {
              const isSel = t.id === selectedTemplateId;
              return (
                <div key={t.id} onClick={() => setSelectedTemplateId(t.id)} style={{
                  padding: "7px 8px", borderRadius: 5, marginBottom: 1, cursor: "pointer",
                  border: isSel ? "1.5px solid #2563eb" : "1.5px solid transparent",
                  background: isSel ? "#eff6ff" : "transparent",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 3, height: 18, borderRadius: 2, background: t.isDefault ? "#2563eb" : "#e2e8f0" }} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: isSel ? 650 : 550, color: "#0f172a" }}>{t.name}</span>
                        {t.isDefault && <span style={{ fontSize: 8, fontWeight: 700, color: "#2563eb", background: "#dbeafe", padding: "1px 3px", borderRadius: 2 }}>DEFAULT</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ Column 2: Builder ═══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fafbfc" }}>
          {/* Builder header */}
          <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 650, color: "#0f172a" }}>Facility Default</h2>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#2563eb", background: "#dbeafe", padding: "2px 5px", borderRadius: 3 }}>DEFAULT</span>
              </div>
              <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "#3b82f6", background: "#3b82f615", padding: "2px 5px", borderRadius: 3, fontWeight: 500 }}>8 procedures</span>
                <span style={{ fontSize: 10, color: "#64748b", background: "#f1f5f9", padding: "2px 5px", borderRadius: 3 }}>{totalEnabled} enabled milestones</span>
              </div>
            </div>
            <button style={{ padding: "4px 8px", fontSize: 11, fontWeight: 550, border: "1px solid #e2e8f0", borderRadius: 4, background: "#fff", color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
              <Icon d={icons.copy} size={11} />Duplicate
            </button>
          </div>

          {/* Legend */}
          <div style={{ margin: "8px 12px 0", padding: "5px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 5, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 10, height: 10, background: "linear-gradient(135deg, #f59e0b, #10b981)", transform: "rotate(45deg)", borderRadius: 2 }} />
              <span style={{ fontSize: 10, color: "#64748b" }}>Shared boundary — ends one phase, starts next</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon d={icons.check} size={8} color="#fff" />
              </div>
              <span style={{ fontSize: 10, color: "#64748b" }}>Milestones — first/last in a phase show their role</span>
            </div>
          </div>

          {/* Scrollable builder content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px 16px" }}>
            <div style={{
              background: "#fff", border: "1px solid #e2e8f0",
              borderRadius: 8, overflow: "hidden",
            }}>
              {renderList.map((item, idx) => {
                if (item.type === "phase-header") {
                  const p = item.phaseLib;
                  const tp = item.phase;
                  const enabledCount = tp.milestones.filter(m => m.enabled).length;
                  return (
                    <div key={`ph-${tp.phaseId}`} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 10px",
                      background: p.color + "0a",
                      borderLeft: `3px solid ${p.color}`,
                      borderTop: idx > 0 ? `1px solid ${p.color}15` : "none",
                    }}>
                      <div style={{ cursor: "grab", color: "#d1d5db", display: "flex", alignItems: "center" }}>
                        <Icon d={icons.grip} size={10} />
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: p.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {p.name}
                      </span>
                      <span style={{ fontSize: 10, color: p.color + "70", marginLeft: "auto" }}>
                        {enabledCount}/{tp.milestones.length}
                      </span>
                      <button onClick={() => removePhase(tp.phaseId)} style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", color: "#94a3b8" }}>
                        <Icon d={icons.x} size={10} />
                      </button>
                    </div>
                  );
                }

                if (item.type === "shared-boundary") {
                  return (
                    <SharedBoundary
                      key={`sb-${item.milestone.id}-${item.endsPhase.id}`}
                      milestone={item.milestone}
                      endsPhase={item.endsPhase}
                      startsPhase={item.startsPhase}
                    />
                  );
                }

                if (item.type === "edge-milestone") {
                  return (
                    <EdgeMilestone
                      key={`em-${item.milestone.id}-${item.phaseId}`}
                      milestone={item.milestone}
                      enabled={item.enabled}
                      onToggle={(id) => toggleMilestone(item.phaseId, id)}
                      onRemove={(id) => removeMilestone(item.phaseId, id)}
                      phaseColor={item.phaseLib.color}
                      phaseName={item.phaseLib.name}
                      edge={item.edge === "only" ? "start" : item.edge}
                    />
                  );
                }

                if (item.type === "interior-milestone") {
                  return (
                    <InteriorMilestone
                      key={`im-${item.milestone.id}-${item.phaseId}`}
                      milestone={item.milestone}
                      enabled={item.enabled}
                      onToggle={(id) => toggleMilestone(item.phaseId, id)}
                      onRemove={(id) => removeMilestone(item.phaseId, id)}
                      phaseColor={item.phaseLib.color}
                    />
                  );
                }

                if (item.type === "sub-phase") {
                  return (
                    <SubPhaseIndicator
                      key={`sp-${item.phase.phaseId}`}
                      phaseLib={item.phaseLib}
                      milestones={item.phase.milestones}
                      parentColor={item.parentPhase.color}
                    />
                  );
                }

                if (item.type === "drop-zone") {
                  return (
                    <div
                      key={`dz-${item.phaseId}`}
                      onDragOver={(e) => {
                        if (e.dataTransfer.types.includes("milestone-id")) {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = item.phaseLib.color;
                          e.currentTarget.style.color = item.phaseLib.color;
                          e.currentTarget.style.background = item.phaseLib.color + "06";
                        }
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e8ecf0";
                        e.currentTarget.style.color = "#c8cdd4";
                        e.currentTarget.style.background = "transparent";
                      }}
                      onDrop={(e) => {
                        const msId = e.dataTransfer.getData("milestone-id");
                        if (msId) addMilestoneToPhase(item.phaseId, msId);
                        e.currentTarget.style.borderColor = "#e8ecf0";
                        e.currentTarget.style.color = "#c8cdd4";
                        e.currentTarget.style.background = "transparent";
                      }}
                      style={{
                        padding: "3px 8px", margin: "1px 8px 2px 36px",
                        border: "1.5px dashed #e8ecf0", borderRadius: 3,
                        fontSize: 10, color: "#c8cdd4", textAlign: "center",
                        fontWeight: 500, transition: "all 0.12s",
                      }}
                    >
                      Drop milestone into {item.phaseLib.name}
                    </div>
                  );
                }

                return null;
              })}
            </div>

            {/* Bottom drop zone for new phases */}
            <div
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("lib-phase-id")) {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#3b82f6";
                  e.currentTarget.style.color = "#3b82f6";
                }
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = "#d1d5db";
                e.currentTarget.style.color = "#b0b8c4";
              }}
              onDrop={(e) => {
                const phaseId = e.dataTransfer.getData("lib-phase-id");
                if (phaseId) addPhaseToTemplate(phaseId);
                e.currentTarget.style.borderColor = "#d1d5db";
                e.currentTarget.style.color = "#b0b8c4";
              }}
              style={{
                padding: "8px", marginTop: 6, border: "1.5px dashed #d1d5db",
                borderRadius: 6, textAlign: "center", fontSize: 11,
                color: "#b0b8c4", fontWeight: 500, transition: "all 0.12s",
              }}
            >
              Drop a phase here to add it
            </div>
          </div>
        </div>

        {/* ═══ Column 3: Library ═══ */}
        <div style={{ width: 220, minWidth: 220, borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", background: "#fff" }}>
          <div style={{ padding: "10px 8px 4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 7px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 5, marginBottom: 6 }}>
              <Icon d={icons.search} size={11} color="#94a3b8" />
              <input value={searchLib} onChange={e => setSearchLib(e.target.value)} placeholder="Search library..." style={{ border: "none", outline: "none", background: "none", fontSize: 11.5, color: "#1e293b", width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 1, background: "#f1f5f9", borderRadius: 4, padding: 2 }}>
              {["milestones", "phases"].map(tab => (
                <button key={tab} onClick={() => setLibTab(tab)} style={{
                  flex: 1, padding: "3px 0", border: "none", borderRadius: 3,
                  fontSize: 10.5, fontWeight: libTab === tab ? 650 : 500,
                  background: libTab === tab ? "#fff" : "transparent",
                  color: libTab === tab ? "#1e293b" : "#64748b",
                  cursor: "pointer", textTransform: "capitalize",
                  boxShadow: libTab === tab ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                }}>{tab}</button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "4px 6px" }}>
            {libTab === "milestones" && (
              <>
                {availableMilestones.length === 0 && (
                  <div style={{ padding: "16px 8px", textAlign: "center" }}>
                    <Icon d={icons.check} size={20} color="#10b981" style={{ display: "block", margin: "0 auto 6px" }} />
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 550 }}>All milestones assigned</div>
                  </div>
                )}
                {availableMilestones.map(m => (
                  <div key={m.id} draggable
                    onDragStart={(e) => { e.dataTransfer.setData("milestone-id", m.id); e.dataTransfer.effectAllowed = "copy"; }}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 7px", marginBottom: 1, borderRadius: 4,
                      cursor: "grab", border: "1px solid #e8ecf0", background: "#fff",
                      fontSize: 11.5, color: "#334155", fontWeight: 500,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
                  >
                    <Icon d={icons.grip} size={10} color="#c0c8d4" />
                    <span style={{ flex: 1 }}>{m.name}</span>
                    {m.pairPos && (
                      <span style={{
                        fontSize: 7.5, fontWeight: 700, padding: "1px 3px", borderRadius: 2,
                        background: m.pairPos === "start" ? "#dcfce7" : "#fef3c7",
                        color: m.pairPos === "start" ? "#16a34a" : "#d97706",
                        textTransform: "uppercase",
                      }}>{m.pairPos}</span>
                    )}
                  </div>
                ))}
              </>
            )}

            {libTab === "phases" && (
              <>
                {availablePhases.length === 0 && (
                  <div style={{ padding: "16px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 550 }}>All phases in template</div>
                  </div>
                )}
                {availablePhases.map(p => (
                  <div key={p.id} draggable
                    onDragStart={(e) => { e.dataTransfer.setData("lib-phase-id", p.id); e.dataTransfer.effectAllowed = "copy"; }}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 7px", marginBottom: 1, borderRadius: 4,
                      cursor: "grab", border: `1px solid ${p.color}30`,
                      background: p.color + "06", fontSize: 11.5,
                      fontWeight: 600, color: p.color,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = `0 1px 3px ${p.color}20`}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
                  >
                    <Icon d={icons.grip} size={10} color={p.color + "60"} />
                    <div style={{ width: 7, height: 7, borderRadius: 1.5, background: p.color }} />
                    <span>{p.name}</span>
                  </div>
                ))}

                {/* Nesting instructions */}
                <div style={{ marginTop: 12, padding: "0 4px" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>How boundaries work</div>
                  <div style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.5, marginBottom: 8 }}>
                    The <strong>first</strong> milestone in a phase starts it. The <strong>last</strong> milestone ends it. Place the same milestone at the end of one phase and start of the next to create a shared boundary.
                  </div>
                  <div style={{
                    padding: "6px 8px", background: "#f8fafc",
                    border: "1px solid #e2e8f0", borderRadius: 5,
                  }}>
                    <div style={{ fontSize: 10, color: "#475569", fontWeight: 600, marginBottom: 4 }}>Example: "Incision"</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 5, height: 5, borderRadius: 1, background: "#3b82f6" }} />
                        <span style={{ fontSize: 10, color: "#64748b" }}>Pre-Op → ... → <strong>Incision</strong></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: 8 }}>
                        <div style={{ width: 8, height: 8, background: "linear-gradient(135deg, #3b82f6, #f59e0b)", transform: "rotate(45deg)", borderRadius: 1 }} />
                        <span style={{ fontSize: 9, color: "#475569", fontWeight: 600 }}>Ends Pre-Op · Starts Surgical</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 5, height: 5, borderRadius: 1, background: "#f59e0b" }} />
                        <span style={{ fontSize: 10, color: "#64748b" }}><strong>Incision</strong> → Array Start → ...</span>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    marginTop: 8, padding: "6px 8px", background: "#f8fafc",
                    border: "1px solid #e2e8f0", borderRadius: 5,
                  }}>
                    <div style={{ fontSize: 10, color: "#475569", fontWeight: 600, marginBottom: 3 }}>Sub-phases</div>
                    <div style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.5 }}>
                      Drag a phase onto an existing phase in the builder to nest it.
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
