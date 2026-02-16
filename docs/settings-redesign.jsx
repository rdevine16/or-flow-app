import { useState, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */

// Raw milestone data — includes both start and end milestones
const RAW_MILESTONES = [
  { id: 1, name: "Patient In Room", phase: "pre-op", scope: "global", pairLabel: null, pairPosition: null, pairWithId: null, casesUsed: 115, validRange: "1-90 min", active: true },
  { id: 2, name: "Anesthesia Start", phase: "pre-op", scope: "global", pairLabel: "Anesthesia", pairPosition: "start", pairWithId: 3, casesUsed: 100, validRange: "1-90 min", active: true },
  { id: 3, name: "Anesthesia End", phase: "pre-op", scope: "global", pairLabel: "Anesthesia", pairPosition: "end", pairWithId: 2, casesUsed: 100, validRange: "1-90 min", active: true },
  { id: 4, name: "Prep/Drape Start", phase: "pre-op", scope: "global", pairLabel: "Prep & Drape", pairPosition: "start", pairWithId: 5, casesUsed: 115, validRange: "1-90 min", active: true },
  { id: 5, name: "Prep/Drape Complete", phase: "pre-op", scope: "global", pairLabel: "Prep & Drape", pairPosition: "end", pairWithId: 4, casesUsed: 91, validRange: "1-90 min", active: true },
  { id: 6, name: "Timeout", phase: "pre-op", scope: "global", pairLabel: null, pairPosition: null, pairWithId: null, casesUsed: 108, validRange: "1-90 min", active: true },
  { id: 7, name: "Incision", phase: "surgical", scope: "global", pairLabel: null, pairPosition: null, pairWithId: null, casesUsed: 114, validRange: "1-90 min", active: true },
  { id: 8, name: "Implant Placement", phase: "surgical", scope: "custom", pairLabel: null, pairPosition: null, pairWithId: null, casesUsed: 42, validRange: "1-120 min", active: true },
  { id: 9, name: "Closing", phase: "closing", scope: "global", pairLabel: "Closing", pairPosition: "start", pairWithId: 10, casesUsed: 114, validRange: "1-90 min", active: true },
  { id: 10, name: "Closing Complete", phase: "closing", scope: "global", pairLabel: "Closing", pairPosition: "end", pairWithId: 9, casesUsed: 112, validRange: "1-90 min", active: true },
  { id: 11, name: "Dressing", phase: "closing", scope: "global", pairLabel: null, pairPosition: null, pairWithId: null, casesUsed: 98, validRange: "1-60 min", active: true },
  { id: 12, name: "Patient Out", phase: "closing", scope: "global", pairLabel: null, pairPosition: null, pairWithId: null, casesUsed: 115, validRange: "1-90 min", active: true },
  { id: 13, name: "Room Ready", phase: "closing", scope: "global", pairLabel: null, pairPosition: null, pairWithId: null, casesUsed: 87, validRange: "1-120 min", active: true },
];

// Collapse paired milestones into single display rows
// - "start" milestones become the collapsed row, using pair_label as display name
// - "end" milestones are hidden (consumed by their pair)
// - standalone milestones pass through unchanged
function collapseMilestones(raw) {
  const byId = new Map(raw.map(m => [m.id, m]));
  return raw
    .filter(m => m.pairPosition !== "end") // hide end milestones
    .map(m => {
      if (m.pairPosition === "start") {
        const partner = byId.get(m.pairWithId);
        return {
          ...m,
          displayName: m.pairLabel || m.name, // use pair_label as display name
          isPaired: true,
          startName: m.name,
          endName: partner?.name || "—",
          casesUsed: Math.max(m.casesUsed, partner?.casesUsed || 0),
        };
      }
      return { ...m, displayName: m.name, isPaired: false, startName: null, endName: null };
    });
}

const MILESTONES = collapseMilestones(RAW_MILESTONES);

const SETTINGS_CATEGORIES = [
  { id: "general", label: "General", icon: "⚙️" },
  { id: "clinical", label: "Clinical", icon: "🏥" },
  { id: "organization", label: "Organization", icon: "👥" },
  { id: "cases", label: "Case Management", icon: "📋" },
];

const SETTINGS_ITEMS = {
  general: [
    { id: "overview", label: "Overview", desc: "Facility details and account info", icon: "🏢" },
    { id: "notifications", label: "Notifications", desc: "Configure alert preferences", icon: "🔔", badge: "Soon" },
    { id: "subscription", label: "Subscription", desc: "Plan, usage, and billing", icon: "💳", badge: "Soon" },
  ],
  clinical: [
    { id: "arrival", label: "Arrival Settings", desc: "Configure patient arrival times", icon: "⏰" },
    { id: "checklist", label: "Checklist Builder", desc: "Customize pre-op checklist", icon: "✅" },
  ],
  organization: [
    { id: "users", label: "Users & Roles", desc: "Staff accounts and permissions", icon: "👤" },
    { id: "permissions", label: "Roles & Permissions", desc: "Configure access control", icon: "🔒" },
  ],
  cases: [
    { id: "procedures", label: "Procedure Types", desc: "Surgical procedures for case creation", icon: "🔧" },
    { id: "milestones", label: "Milestones", desc: "Surgical milestones tracked during cases", icon: "🎯", active: true },
    { id: "proc-milestones", label: "Procedure Milestones", desc: "Which milestones appear per procedure", icon: "📊" },
    { id: "surgeon-prefs", label: "Surgeon Preferences", desc: "Per-surgeon configuration", icon: "🩺", badge: "New" },
  ],
};

const PHASES = [
  { id: "pre-op", label: "Pre-Op", color: "#6366f1" },
  { id: "surgical", label: "Surgical", color: "#06b6d4" },
  { id: "closing", label: "Closing", color: "#f59e0b" },
];

/* ═══════════════════════════════════════════
   SMALL COMPONENTS
   ═══════════════════════════════════════════ */

function TypeIndicator({ isPaired, startName, endName }) {
  if (!isPaired) {
    return <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500 }}>Single</span>;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      <span style={{ fontSize: 11.5, color: "#6366f1", fontWeight: 600 }}>Paired</span>
    </div>
  );
}

function PhaseGroupHeader({ phase }) {
  const p = PHASES.find(ph => ph.id === phase);
  return (
    <tr>
      <td colSpan={6} style={{ padding: "20px 0 8px 0", border: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 16, borderRadius: 2, background: p.color }} />
          <span style={{ fontSize: 11.5, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.08em", color: p.color }}>{p.label}</span>
          <div style={{ flex: 1, height: 1, background: `${p.color}15`, marginLeft: 4 }} />
        </div>
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════
   MILESTONES TABLE
   ═══════════════════════════════════════════ */

function MilestonesContent() {
  const [milestones, setMilestones] = useState(MILESTONES);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [expandedPairs, setExpandedPairs] = useState(new Set());

  const toggleExpanded = useCallback((id) => {
    setExpandedPairs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Group milestones by phase, maintaining order
  const phases = ["pre-op", "surgical", "closing"];
  const grouped = phases.map(phase => ({
    phase,
    items: milestones.filter(m => m.phase === phase),
  }));

  const totalActive = milestones.filter(m => m.active).length;
  const pairedCount = milestones.filter(m => m.isPaired).length;
  const customCount = milestones.filter(m => m.scope === "custom").length;

  return (
    <div style={{ animation: "fadeIn 0.25s ease" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 750, letterSpacing: "-0.03em", color: "#0f172a", marginBottom: 4 }}>Milestones</h1>
          <p style={{ fontSize: 13.5, color: "#64748b", lineHeight: 1.5 }}>Configure the surgical milestones tracked during cases.</p>
        </div>
        <button style={{
          display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
          background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white",
          border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
          transition: "all 0.15s",
        }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(99,102,241,0.35)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(99,102,241,0.3)"; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Custom Milestone
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Active Milestones", value: totalActive, color: "#10b981" },
          { label: "Paired", value: pairedCount, color: "#6366f1" },
          { label: "Custom", value: customCount, color: "#8b5cf6" },
          { label: "Phases", value: 3, color: "#06b6d4" },
        ].map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: `${s.color}06`, border: `1px solid ${s.color}12`, borderRadius: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 750, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Info bar - simplified */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(99,102,241,0.03)", border: "1px solid rgba(99,102,241,0.08)", borderRadius: 10, marginBottom: 20, fontSize: 12.5, color: "#64748b" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>Global milestones are provided by ORbit. Custom milestones <span style={{ color: "#8b5cf6", fontWeight: 600 }}>(marked with ◆)</span> are created by your facility.</span>
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(148,163,184,0.1)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
              {[
                { label: "#", width: 48, align: "center" },
                { label: "Milestone", width: "auto", align: "left" },
                { label: "Type", width: 120, align: "left" },
                { label: "Cases", width: 80, align: "right" },
                { label: "Valid Range", width: 100, align: "right" },
                { label: "", width: 80, align: "right" },
              ].map((col, i) => (
                <th key={i} style={{
                  padding: "11px 16px", fontSize: 11, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  color: "#94a3b8", textAlign: col.align,
                  width: col.width, whiteSpace: "nowrap",
                  background: "rgba(248,250,252,0.5)",
                }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ phase, items }) => (
              <>
                <PhaseGroupHeader key={`phase-${phase}`} phase={phase} />
                {items.map((m, idx) => {
                  const isExpanded = expandedPairs.has(m.id);
                  return (
                    <>
                      <tr key={m.id}
                        onMouseEnter={() => setHoveredRow(m.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        onClick={() => m.isPaired && toggleExpanded(m.id)}
                        style={{
                          borderBottom: "1px solid rgba(148,163,184,0.06)",
                          background: hoveredRow === m.id ? "rgba(99,102,241,0.02)" : "transparent",
                          transition: "background 0.1s",
                          cursor: m.isPaired ? "pointer" : "default",
                        }}>
                        {/* Order */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#b0b8c4", fontFamily: "'JetBrains Mono', monospace" }}>{m.id}</span>
                        </td>

                        {/* Name — uses pair_label for paired milestones */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {m.isPaired && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"
                                style={{ transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
                                <polyline points="9 18 15 12 9 6"/>
                              </svg>
                            )}
                            {m.scope === "custom" && (
                              <span style={{ color: "#8b5cf6", fontSize: 8, lineHeight: 1 }}>◆</span>
                            )}
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a" }}>{m.displayName}</span>
                          </div>
                        </td>

                        {/* Type */}
                        <td style={{ padding: "12px 16px" }}>
                          <TypeIndicator isPaired={m.isPaired} startName={m.startName} endName={m.endName} />
                        </td>

                        {/* Cases */}
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>{m.casesUsed}</span>
                        </td>

                        {/* Valid Range */}
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <span style={{ fontSize: 12.5, color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>{m.validRange}</span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, opacity: hoveredRow === m.id ? 1 : 0, transition: "opacity 0.15s" }}>
                            <button style={{ background: "none", border: "none", cursor: "pointer", padding: 5, borderRadius: 6, color: "#94a3b8", display: "flex" }} title="Edit"
                              onClick={e => { e.stopPropagation(); }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(148,163,184,0.1)"; e.currentTarget.style.color = "#475569"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#94a3b8"; }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                            </button>
                            {m.scope === "custom" && (
                              <button style={{ background: "none", border: "none", cursor: "pointer", padding: 5, borderRadius: 6, color: "#94a3b8", display: "flex" }} title="Delete"
                                onClick={e => { e.stopPropagation(); }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "#ef4444"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#94a3b8"; }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded sub-rows for paired milestones */}
                      {m.isPaired && isExpanded && (
                        <>
                          <tr key={`${m.id}-start`} style={{ background: "rgba(99,102,241,0.015)" }}>
                            <td style={{ padding: "6px 16px" }} />
                            <td style={{ padding: "6px 16px", paddingLeft: 52 }}>
                              <span style={{ fontSize: 12, color: "#64748b" }}>{m.startName}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 8, padding: "1px 6px", borderRadius: 3, background: "rgba(99,102,241,0.08)", color: "#6366f1" }}>START</span>
                            </td>
                            <td colSpan={4} />
                          </tr>
                          <tr key={`${m.id}-end`} style={{ background: "rgba(99,102,241,0.015)" }}>
                            <td style={{ padding: "6px 16px" }} />
                            <td style={{ padding: "6px 16px", paddingLeft: 52 }}>
                              <span style={{ fontSize: 12, color: "#64748b" }}>{m.endName}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 8, padding: "1px 6px", borderRadius: 3, background: "rgba(16,185,129,0.08)", color: "#10b981" }}>END</span>
                            </td>
                            <td colSpan={4} />
                          </tr>
                        </>
                      )}
                    </>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SETTINGS LANDING (when no sub-page selected)
   ═══════════════════════════════════════════ */

function SettingsLanding({ onNavigate }) {
  return (
    <div style={{ animation: "fadeIn 0.25s ease" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 21, fontWeight: 750, letterSpacing: "-0.03em", color: "#0f172a", marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13.5, color: "#64748b" }}>Manage your facility configuration, staff, and case workflows.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {Object.entries(SETTINGS_ITEMS).map(([catId, items]) => {
          const cat = SETTINGS_CATEGORIES.find(c => c.id === catId);
          return (
            <div key={catId} style={{ background: "white", borderRadius: 14, border: "1px solid rgba(148,163,184,0.1)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(148,163,184,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>{cat.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>{cat.label}</span>
              </div>
              <div>
                {items.map((item, i) => (
                  <div key={item.id}
                    onClick={() => onNavigate(item.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 18px", cursor: "pointer",
                      borderBottom: i < items.length - 1 ? "1px solid rgba(148,163,184,0.04)" : "none",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 15 }}>{item.icon}</span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a" }}>{item.label}</span>
                          {item.badge && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                              background: item.badge === "New" ? "rgba(16,185,129,0.1)" : "rgba(148,163,184,0.1)",
                              color: item.badge === "New" ? "#10b981" : "#94a3b8",
                              textTransform: "uppercase", letterSpacing: "0.04em",
                            }}>{item.badge}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>{item.desc}</span>
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */

const APP_NAV = [
  { id: "home", label: "Home", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> },
  { id: "cases", label: "Cases", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg> },
  { id: "rooms", label: "Rooms", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></svg> },
  { id: "schedule", label: "Schedule", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> },
  { id: "analytics", label: "Analytics", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
];

export default function SettingsPageRedesign() {
  const [activeNav, setActiveNav] = useState("settings");
  const [activeCategory, setActiveCategory] = useState("cases");
  const [activePage, setActivePage] = useState("milestones"); // null = landing, "milestones" = sub-page

  const handleNavigate = (pageId) => {
    // Find which category this page belongs to
    for (const [catId, items] of Object.entries(SETTINGS_ITEMS)) {
      if (items.find(i => i.id === pageId)) {
        setActiveCategory(catId);
        setActivePage(pageId);
        return;
      }
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:3px}
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#0f172a", background: "#f8f9fb" }}>

        {/* ── Primary App Sidebar ── */}
        <nav style={{
          width: 64, background: "#0f172a", display: "flex", flexDirection: "column",
          alignItems: "center", padding: "16px 0", gap: 4, flexShrink: 0,
        }}>
          {/* Logo */}
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 14, fontWeight: 800, marginBottom: 20,
            letterSpacing: "-0.05em",
          }}>O</div>

          {APP_NAV.map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)} style={{
              width: 42, height: 42, borderRadius: 10, border: "none",
              background: activeNav === item.id ? "rgba(99,102,241,0.15)" : "transparent",
              color: activeNav === item.id ? "#818cf8" : "#475569",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }} title={item.label}
              onMouseEnter={e => { if (activeNav !== item.id) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={e => { if (activeNav !== item.id) e.currentTarget.style.background = "transparent"; }}>
              {item.icon}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Settings button */}
          <button onClick={() => { setActiveNav("settings"); setActivePage(null); }} style={{
            width: 42, height: 42, borderRadius: 10, border: "none",
            background: activeNav === "settings" ? "rgba(99,102,241,0.15)" : "transparent",
            color: activeNav === "settings" ? "#818cf8" : "#475569",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }} title="Settings"
            onMouseEnter={e => { if (activeNav !== "settings") e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { if (activeNav !== "settings") e.currentTarget.style.background = "transparent"; }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </button>
        </nav>

        {/* ── Main Content Area ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Top bar */}
          <header style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 28px", height: 52, background: "white",
            borderBottom: "1px solid rgba(148,163,184,0.1)", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#94a3b8" }}>
              <span>Riverwalk Surgery Center</span>
              <span style={{ fontSize: 11 }}>›</span>
              <span onClick={() => setActivePage(null)} style={{ cursor: "pointer" }}>Settings</span>
              {activePage && (
                <>
                  <span style={{ fontSize: 11 }}>›</span>
                  <span style={{ color: "#0f172a", fontWeight: 600 }}>
                    {Object.values(SETTINGS_ITEMS).flat().find(i => i.id === activePage)?.label}
                  </span>
                </>
              )}
            </div>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #818cf8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 11, fontWeight: 700,
            }}>RD</div>
          </header>

          {/* Category Tab Bar (only when on a sub-page) */}
          {activePage && (
            <div style={{
              display: "flex", alignItems: "center", gap: 2,
              padding: "0 28px", height: 46,
              background: "white",
              borderBottom: "1px solid rgba(148,163,184,0.08)",
              flexShrink: 0,
            }}>
              {SETTINGS_CATEGORIES.map(cat => {
                const isActive = activeCategory === cat.id;
                return (
                  <button key={cat.id} onClick={() => {
                    setActiveCategory(cat.id);
                    // Navigate to first item in this category
                    setActivePage(SETTINGS_ITEMS[cat.id][0].id);
                  }} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#0f172a" : "#94a3b8",
                    background: "transparent", border: "none", cursor: "pointer",
                    borderBottom: isActive ? "2px solid #6366f1" : "2px solid transparent",
                    marginBottom: -1, fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "#64748b"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "#94a3b8"; }}>
                    <span style={{ fontSize: 13 }}>{cat.icon}</span>
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Sub-page navigation (within active category) + Content */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Sub-nav sidebar (only when on a sub-page) */}
            {activePage && (
              <div style={{
                width: 220, background: "white", borderRight: "1px solid rgba(148,163,184,0.06)",
                padding: "16px 10px", flexShrink: 0, overflow: "auto",
              }}>
                {SETTINGS_ITEMS[activeCategory]?.map(item => {
                  const isActive = activePage === item.id;
                  return (
                    <button key={item.id} onClick={() => setActivePage(item.id)} style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "9px 12px", borderRadius: 8, border: "none",
                      background: isActive ? "rgba(99,102,241,0.06)" : "transparent",
                      color: isActive ? "#4f46e5" : "#64748b",
                      fontSize: 13, fontWeight: isActive ? 650 : 500,
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      textAlign: "left", transition: "all 0.1s",
                      marginBottom: 2,
                    }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(148,163,184,0.05)"; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? "rgba(99,102,241,0.06)" : "transparent"; }}>
                      <span style={{ fontSize: 14 }}>{item.icon}</span>
                      {item.label}
                      {item.badge && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, marginLeft: "auto",
                          background: item.badge === "New" ? "rgba(16,185,129,0.1)" : "rgba(148,163,184,0.1)",
                          color: item.badge === "New" ? "#10b981" : "#94a3b8",
                          textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>{item.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Content Area */}
            <div style={{ flex: 1, overflow: "auto", padding: "28px 36px" }}>
              {!activePage && <SettingsLanding onNavigate={handleNavigate} />}
              {activePage === "milestones" && <MilestonesContent />}
              {activePage && activePage !== "milestones" && (
                <div style={{ animation: "fadeIn 0.25s ease" }}>
                  <h1 style={{ fontSize: 21, fontWeight: 750, letterSpacing: "-0.03em", color: "#0f172a", marginBottom: 4 }}>
                    {Object.values(SETTINGS_ITEMS).flat().find(i => i.id === activePage)?.label}
                  </h1>
                  <p style={{ fontSize: 13.5, color: "#64748b" }}>
                    {Object.values(SETTINGS_ITEMS).flat().find(i => i.id === activePage)?.desc}
                  </p>
                  <div style={{ marginTop: 32, padding: 40, textAlign: "center", color: "#cbd5e1", fontSize: 13, border: "2px dashed rgba(148,163,184,0.15)", borderRadius: 14 }}>
                    Settings content for this page
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
