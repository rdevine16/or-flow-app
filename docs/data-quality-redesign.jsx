import { useState, useEffect, useRef } from "react";

// ============================================
// DESIGN TOKENS
// ============================================
const COLORS = {
  // Core palette
  bg: "#FAFAF9",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F5F4",
  border: "#E7E5E4",
  borderLight: "#F0EEEC",
  
  // Text
  text: "#1C1917",
  textSecondary: "#78716C",
  textTertiary: "#A8A29E",
  
  // Accents — bold & distinctive
  brand: "#2563EB",       // Primary blue
  brandLight: "#DBEAFE",
  brandDark: "#1D4ED8",
  
  // Severity
  critical: "#DC2626",
  criticalBg: "#FEF2F2",
  criticalBorder: "#FECACA",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FDE68A",
  info: "#2563EB",
  infoBg: "#EFF6FF",
  infoBorder: "#BFDBFE",
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  
  // Accents for badges
  purple: "#7C3AED",
  purpleBg: "#F5F3FF",
  orange: "#EA580C",
  orangeBg: "#FFF7ED",
  teal: "#0D9488",
  tealBg: "#F0FDFA",
};

const FONTS = {
  display: "'DM Sans', -apple-system, sans-serif",
  body: "'DM Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

// ============================================
// ICONS (inline SVG)
// ============================================
const Icon = ({ name, size = 16, color = "currentColor", strokeWidth = 1.75 }) => {
  const icons = {
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    alertTriangle: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    check: <><path d="M20 6 9 17l-5-5"/></>,
    checkCircle: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></>,
    x: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
    refresh: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></>,
    arrowRight: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
    chevronRight: <><path d="m9 18 6-6-6-6"/></>,
    chevronDown: <><path d="m6 9 6 6 6-6"/></>,
    externalLink: <><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1-2-2h6"/></>,
    filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
    database: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></>,
    zap: <><path d="M13 2 3 14h9l-1 10 10-12h-9l1-10z"/></>,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    trash: <><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></>,
    milestone: <><circle cx="12" cy="12" r="1"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/></>,
    panelRight: <><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/></>,
    xCircle: <><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></>,
    activity: <><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></>,
    ban: <><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></>,
    sparkles: <><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// ============================================
// QUALITY GAUGE — circular arc indicator
// ============================================
function QualityGauge({ score, size = 120 }) {
  const radius = (size - 12) / 2;
  const circumference = Math.PI * radius; // half circle
  const progress = (score / 100) * circumference;
  
  const getColor = (s) => {
    if (s >= 90) return COLORS.success;
    if (s >= 70) return COLORS.warning;
    return COLORS.critical;
  };
  
  const getBgColor = (s) => {
    if (s >= 90) return COLORS.successBg;
    if (s >= 70) return COLORS.warningBg;
    return COLORS.criticalBg;
  };
  
  const color = getColor(score);
  
  return (
    <div style={{ position: "relative", width: size, height: size / 2 + 20 }}>
      <svg width={size} height={size / 2 + 6} viewBox={`0 0 ${size} ${size / 2 + 6}`}>
        {/* Track */}
        <path
          d={`M 6 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 6} ${size / 2}`}
          fill="none"
          stroke={COLORS.borderLight}
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d={`M 6 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 6} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference - progress}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div style={{
        position: "absolute",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        textAlign: "center",
      }}>
        <span style={{
          fontFamily: FONTS.mono,
          fontSize: size * 0.3,
          fontWeight: 700,
          color: color,
          lineHeight: 1,
        }}>
          {score}
        </span>
        <span style={{ fontFamily: FONTS.mono, fontSize: size * 0.14, color: COLORS.textSecondary, fontWeight: 500 }}>%</span>
      </div>
    </div>
  );
}

// ============================================
// SEVERITY BADGE
// ============================================
function SeverityBadge({ type, count, label }) {
  const config = {
    error: { bg: COLORS.criticalBg, border: COLORS.criticalBorder, color: COLORS.critical, dot: COLORS.critical },
    warning: { bg: COLORS.warningBg, border: COLORS.warningBorder, color: COLORS.warning, dot: COLORS.warning },
    info: { bg: COLORS.infoBg, border: COLORS.infoBorder, color: COLORS.info, dot: COLORS.info },
  };
  const c = config[type] || config.info;
  
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 6,
      background: c.bg,
      border: `1px solid ${c.border}`,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot }} />
      <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: c.color }}>{count}</span>
      <span style={{ fontSize: 11, color: c.color, opacity: 0.8 }}>{label}</span>
    </div>
  );
}

// ============================================
// ISSUE TYPE CHIP
// ============================================
function IssueChip({ label, count, severity = "warning" }) {
  const config = {
    error: { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
    warning: { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
    info: { bg: "#DBEAFE", color: "#1E40AF", border: "#BFDBFE" },
  };
  const c = config[severity] || config.warning;
  
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: FONTS.body,
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
      letterSpacing: "0.01em",
    }}>
      {label}{count > 1 ? ` (${count})` : ""}
    </span>
  );
}

// ============================================
// PROGRESS BAR (detection scan)
// ============================================
function ScanProgress({ step, total = 7 }) {
  const pct = (step / total) * 100;
  return (
    <div style={{
      height: 4,
      borderRadius: 2,
      background: COLORS.borderLight,
      overflow: "hidden",
    }}>
      <div style={{
        height: "100%",
        width: `${pct}%`,
        borderRadius: 2,
        background: `linear-gradient(90deg, ${COLORS.brand}, #7C3AED)`,
        transition: "width 0.4s ease-out",
      }} />
    </div>
  );
}

// ============================================
// MILESTONE TIMELINE NODE
// ============================================
function TimelineNode({ milestone, isLast, hasIssue, isMissing, isEditing, onEdit, onTimeChange }) {
  const statusColor = isMissing ? COLORS.textTertiary : hasIssue ? COLORS.warning : COLORS.success;
  const bgColor = hasIssue ? COLORS.warningBg : "transparent";
  
  return (
    <div style={{
      display: "flex",
      gap: 12,
      padding: "0",
      position: "relative",
    }}>
      {/* Timeline track */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 20,
        flexShrink: 0,
        paddingTop: 2,
      }}>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          border: `2.5px solid ${statusColor}`,
          background: isMissing ? "transparent" : statusColor,
          position: "relative",
          zIndex: 1,
        }}>
          {!isMissing && !hasIssue && (
            <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", top: 0, left: 0 }}>
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          )}
        </div>
        {!isLast && (
          <div style={{
            width: 2,
            flex: 1,
            minHeight: 24,
            background: COLORS.borderLight,
          }} />
        )}
      </div>
      
      {/* Content */}
      <div style={{
        flex: 1,
        padding: "0 12px 16px 0",
        borderRadius: 8,
        background: bgColor,
        marginBottom: isLast ? 0 : 0,
        padding: hasIssue ? "8px 12px 8px 12px" : "0 12px 16px 0",
        borderRadius: hasIssue ? 8 : 0,
        marginLeft: hasIssue ? -4 : 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: hasIssue ? COLORS.warning : COLORS.text,
              fontFamily: FONTS.body,
            }}>
              {milestone.display_name}
            </span>
            {hasIssue && (
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: COLORS.warning,
                background: COLORS.warningBorder,
                padding: "1px 6px",
                borderRadius: 3,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}>Issue</span>
            )}
            {milestone.hasChanged && (
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: COLORS.brand,
                background: COLORS.brandLight,
                padding: "1px 6px",
                borderRadius: 3,
              }}>Modified</span>
            )}
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isEditing ? (
              <input
                type="time"
                step="1"
                defaultValue={milestone.recorded_at ? "07:34:12" : ""}
                onChange={onTimeChange}
                style={{
                  padding: "4px 8px",
                  border: `1.5px solid ${COLORS.brand}`,
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: FONTS.mono,
                  outline: "none",
                  background: COLORS.brandLight,
                  color: COLORS.text,
                }}
              />
            ) : (
              <span style={{
                fontSize: 13,
                fontFamily: FONTS.mono,
                fontWeight: 500,
                color: isMissing ? COLORS.textTertiary : COLORS.text,
                fontStyle: isMissing ? "italic" : "normal",
              }}>
                {isMissing ? "Not recorded" : milestone.time || "7:34:12 AM"}
              </span>
            )}
            {milestone.canEdit && (
              <button
                onClick={onEdit}
                style={{
                  padding: "3px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: FONTS.body,
                  border: `1px solid ${isEditing ? COLORS.brand : COLORS.border}`,
                  borderRadius: 5,
                  background: isEditing ? COLORS.brandLight : COLORS.surface,
                  color: isEditing ? COLORS.brand : COLORS.textSecondary,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {isEditing ? "Done" : isMissing ? "Add" : "Edit"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ============================================
// MAIN APP
// ============================================
export default function DataQualityRedesign() {
  const [selectedCase, setSelectedCase] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [scanRunning, setScanRunning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [filterType, setFilterType] = useState("all");
  const [showResolved, setShowResolved] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [hoveredRow, setHoveredRow] = useState(null);
  const [animateIn, setAnimateIn] = useState(false);
  
  useEffect(() => {
    setTimeout(() => setAnimateIn(true), 50);
  }, []);
  
  // Mock data
  const summary = {
    qualityScore: 42,
    totalUnresolved: 56,
    expiringThisWeek: 3,
    bySeverity: { error: 2, warning: 54, info: 0 },
    casesAffected: 9,
    lastScan: "3:16 PM · Feb 13, 2026",
    isCurrent: false,
  };
  
  const caseGroups = [
    {
      id: "case-1",
      caseNumber: "RW-00938",
      surgeon: "Dr. Farmer",
      procedure: "Mako THA",
      side: "Right",
      date: "Feb 10, 2026",
      scheduledStart: "7:30 AM",
      room: "OR-1",
      issueCount: 4,
      severity: "warning",
      issueTypes: [{ name: "Duration Too Short", count: 4, severity: "warning" }],
      milestones: "Anesthesia Start, Patient Out, Incision +1 more",
      expiresIn: 30,
    },
    {
      id: "case-2",
      caseNumber: "RW-01055",
      surgeon: "Dr. Jensen",
      procedure: "Mako TKA",
      side: "Right",
      date: "Feb 11, 2026",
      scheduledStart: "8:00 AM",
      room: "OR-2",
      issueCount: 5,
      severity: "warning",
      issueTypes: [{ name: "Duration Too Short", count: 5, severity: "warning" }],
      milestones: "Closing Complete, Incision, Prep/Drape Complete +2 more",
      expiresIn: 29,
    },
    {
      id: "case-3",
      caseNumber: "RW-00363",
      surgeon: "Dr. Berra",
      procedure: "Mako TKA",
      side: "Left",
      date: "Feb 9, 2026",
      scheduledStart: "10:15 AM",
      room: "OR-1",
      issueCount: 6,
      severity: "warning",
      issueTypes: [{ name: "Duration Too Short", count: 6, severity: "warning" }],
      milestones: "Incision, Patient Out, Anesthesia Start +3 more",
      expiresIn: 24,
    },
    {
      id: "case-4",
      caseNumber: "RW-01516",
      surgeon: "Dr. Swartz",
      procedure: "TKA",
      side: "Right",
      date: "Feb 9, 2026",
      scheduledStart: "11:30 AM",
      room: "OR-1",
      issueCount: 5,
      severity: "error",
      issueTypes: [
        { name: "Duration Too Short", count: 4, severity: "warning" },
        { name: "Incomplete Case", count: 1, severity: "error" },
      ],
      milestones: "Anesthesia End, Prep/Drape Complete, Prep/Drape Start +1 more",
      expiresIn: 24,
    },
    {
      id: "case-5",
      caseNumber: "RW-00353",
      surgeon: "Dr. Berra",
      procedure: "Mako TKA",
      side: "Right",
      date: "Feb 8, 2026",
      scheduledStart: "7:30 AM",
      room: "OR-2",
      issueCount: 6,
      severity: "error",
      issueTypes: [
        { name: "Incomplete Case", count: 1, severity: "error" },
        { name: "Duration Too Short", count: 5, severity: "warning" },
      ],
      milestones: "Incision, Prep/Drape Complete, Anesthesia Start +2 more",
      expiresIn: 17,
    },
    {
      id: "case-6",
      caseNumber: "RW-00891",
      surgeon: "Dr. Farmer",
      procedure: "Mako THA",
      side: "Left",
      date: "Feb 7, 2026",
      scheduledStart: "1:00 PM",
      room: "OR-1",
      issueCount: 3,
      severity: "warning",
      issueTypes: [
        { name: "Duration Too Short", count: 2, severity: "warning" },
        { name: "Impossible Sequence", count: 1, severity: "warning" },
      ],
      milestones: "Closing Complete, Patient Out, Anesthesia End",
      expiresIn: 14,
    },
  ];

  const mockMilestones = [
    { id: "m1", display_name: "Patient In", recorded_at: "2026-02-10T07:28:00Z", time: "7:28:00 AM", canEdit: false, hasChanged: false, hasIssue: false },
    { id: "m2", display_name: "Anesthesia Start", recorded_at: "2026-02-10T07:34:00Z", time: "7:34:12 AM", canEdit: true, hasChanged: false, hasIssue: true },
    { id: "m3", display_name: "Prep/Drape Start", recorded_at: "2026-02-10T07:38:00Z", time: "7:38:45 AM", canEdit: false, hasChanged: false, hasIssue: false },
    { id: "m4", display_name: "Prep/Drape Complete", recorded_at: "2026-02-10T07:52:00Z", time: "7:52:30 AM", canEdit: false, hasChanged: false, hasIssue: false },
    { id: "m5", display_name: "Incision", recorded_at: "2026-02-10T07:55:00Z", time: "7:55:18 AM", canEdit: true, hasChanged: false, hasIssue: true },
    { id: "m6", display_name: "Closing", recorded_at: null, time: null, canEdit: true, hasChanged: false, hasIssue: false },
    { id: "m7", display_name: "Closing Complete", recorded_at: null, time: null, canEdit: true, hasChanged: false, hasIssue: false },
    { id: "m8", display_name: "Anesthesia End", recorded_at: null, time: null, canEdit: true, hasChanged: false, hasIssue: false },
    { id: "m9", display_name: "Patient Out", recorded_at: "2026-02-10T08:42:00Z", time: "8:42:05 AM", canEdit: true, hasChanged: false, hasIssue: true },
  ];

  const impactMetrics = {
    canCalculate: ["Case Count", "Total Case Time", "FCOTS", "Pre-Incision Time"],
    cannotCalculate: ["Surgical Time", "Anesthesia Duration", "Closing Duration", "Emergence Time"],
  };

  // Handlers
  const openReview = (caseGroup) => {
    setSelectedCase(caseGroup);
    setShowPanel(true);
  };
  
  const closePanel = () => {
    setShowPanel(false);
    setTimeout(() => setSelectedCase(null), 300);
  };
  
  const runScan = () => {
    setScanRunning(true);
    setScanStep(0);
    const interval = setInterval(() => {
      setScanStep(prev => {
        if (prev >= 7) {
          clearInterval(interval);
          setTimeout(() => setScanRunning(false), 500);
          return 7;
        }
        return prev + 1;
      });
    }, 600);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div style={{
      fontFamily: FONTS.body,
      background: COLORS.bg,
      minHeight: "100vh",
      color: COLORS.text,
      display: "flex",
    }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ====== MAIN CONTENT ====== */}
      <div style={{
        flex: 1,
        transition: "margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        marginRight: showPanel ? 520 : 0,
        padding: "0 32px 48px",
        maxWidth: showPanel ? "calc(100% - 520px)" : "100%",
        overflow: "auto",
      }}>
        
        {/* HEADER */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "24px 0 20px",
          borderBottom: `1px solid ${COLORS.border}`,
          marginBottom: 24,
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? "translateY(0)" : "translateY(8px)",
          transition: "all 0.4s ease-out",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${COLORS.brand}, #7C3AED)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Icon name="shield" size={16} color="white" />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
                Data Quality
              </h1>
            </div>
            <p style={{ fontSize: 13, color: COLORS.textSecondary, margin: 0, paddingLeft: 42 }}>
              Monitor and resolve data integrity issues across surgical cases
            </p>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Scan status */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: summary.isCurrent ? COLORS.success : COLORS.warning,
                boxShadow: summary.isCurrent ? `0 0 6px ${COLORS.success}40` : `0 0 6px ${COLORS.warning}40`,
              }} />
              <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                {summary.lastScan}
              </span>
            </div>
            
            <button
              onClick={runScan}
              disabled={scanRunning}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: scanRunning ? COLORS.surfaceAlt : `linear-gradient(135deg, ${COLORS.brand}, ${COLORS.brandDark})`,
                color: scanRunning ? COLORS.textSecondary : "white",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: FONTS.body,
                cursor: scanRunning ? "default" : "pointer",
                boxShadow: scanRunning ? "none" : `0 2px 8px ${COLORS.brand}30`,
                transition: "all 0.2s",
              }}
            >
              {scanRunning ? (
                <>
                  <div style={{
                    width: 14, height: 14,
                    border: `2px solid ${COLORS.textTertiary}`,
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  Scanning...
                </>
              ) : (
                <>
                  <Icon name="refresh" size={14} color="white" />
                  Run Detection
                </>
              )}
            </button>
          </div>
        </div>

        {/* SCAN PROGRESS OVERLAY */}
        {scanRunning && (
          <div style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
            animation: "slideDown 0.3s ease-out",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Running detection scan...</span>
              <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: FONTS.mono }}>{scanStep}/7</span>
            </div>
            <ScanProgress step={scanStep} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {["Expire old", "Load cases", "Impossible values", "Negative durations", "Sequences", "Missing milestones", "Finalize"].map((label, i) => (
                <span key={i} style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontWeight: 500,
                  background: scanStep > i + 1 ? COLORS.successBg : scanStep === i + 1 ? COLORS.brandLight : COLORS.surfaceAlt,
                  color: scanStep > i + 1 ? COLORS.success : scanStep === i + 1 ? COLORS.brand : COLORS.textTertiary,
                  border: `1px solid ${scanStep > i + 1 ? COLORS.successBorder : scanStep === i + 1 ? "#BFDBFE" : COLORS.borderLight}`,
                  transition: "all 0.3s",
                }}>
                  {scanStep > i + 1 && "✓ "}{label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ====== SUMMARY ROW ====== */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 20,
          marginBottom: 24,
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.5s ease-out 0.1s",
        }}>
          {/* Quality Gauge Card */}
          <div style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: "20px 28px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 180,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textSecondary, marginBottom: 8 }}>
              Quality Score
            </span>
            <QualityGauge score={summary.qualityScore} size={130} />
          </div>

          {/* Stats Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}>
            {/* Open Issues */}
            <div style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textSecondary }}>
                  Open Issues
                </span>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: COLORS.warningBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon name="alertTriangle" size={14} color={COLORS.warning} />
                </div>
              </div>
              <div>
                <span style={{ fontFamily: FONTS.mono, fontSize: 32, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
                  {summary.totalUnresolved}
                </span>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                  across <strong style={{ color: COLORS.text }}>{summary.casesAffected}</strong> cases
                </div>
              </div>
            </div>

            {/* Expiring Soon */}
            <div style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textSecondary }}>
                  Expiring Soon
                </span>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: COLORS.criticalBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon name="clock" size={14} color={COLORS.critical} />
                </div>
              </div>
              <div>
                <span style={{ fontFamily: FONTS.mono, fontSize: 32, fontWeight: 700, color: summary.expiringThisWeek > 0 ? COLORS.warning : COLORS.text, lineHeight: 1 }}>
                  {summary.expiringThisWeek}
                </span>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                  within 7 days
                </div>
              </div>
            </div>

            {/* By Severity */}
            <div style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textSecondary, marginBottom: 8 }}>
                By Severity
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <SeverityBadge type="error" count={summary.bySeverity.error} label="Critical" />
                <SeverityBadge type="warning" count={summary.bySeverity.warning} label="Warning" />
                <SeverityBadge type="info" count={summary.bySeverity.info} label="Info" />
              </div>
            </div>
          </div>
        </div>

        {/* ====== FILTERS BAR ====== */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          marginBottom: 12,
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.5s ease-out 0.2s",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <Icon name="filter" size={13} color={COLORS.textTertiary} />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: "6px 28px 6px 10px",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                fontSize: 12,
                fontFamily: FONTS.body,
                fontWeight: 500,
                color: COLORS.text,
                background: COLORS.surface,
                cursor: "pointer",
                outline: "none",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2378716C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
              }}
            >
              <option value="all">All Issue Types</option>
              <option value="too_fast">Duration Too Short</option>
              <option value="missing">Missing Milestone</option>
              <option value="impossible">Impossible Sequence</option>
              <option value="incomplete">Incomplete Case</option>
              <option value="stale">Stale Case</option>
            </select>
            
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: COLORS.brand }}
              />
              <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.textSecondary }}>Show resolved</span>
            </label>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {selectedIds.size > 0 && (
              <>
                <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>
                  {selectedIds.size} selected
                </span>
                <button style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.criticalBorder}`,
                  background: COLORS.criticalBg,
                  color: COLORS.critical,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: FONTS.body,
                  cursor: "pointer",
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="ban" size={12} color={COLORS.critical} />
                    Exclude Selected
                  </span>
                </button>
              </>
            )}
            <span style={{ fontSize: 12, color: COLORS.textTertiary }}>
              {caseGroups.length} cases · {summary.totalUnresolved} issues
            </span>
          </div>
        </div>

        {/* ====== ISSUES TABLE ====== */}
        <div style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          overflow: "hidden",
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.5s ease-out 0.3s",
        }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "36px 1fr 200px 100px 80px 72px",
            alignItems: "center",
            padding: "10px 16px",
            borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceAlt,
          }}>
            <input
              type="checkbox"
              checked={selectedIds.size === caseGroups.length && caseGroups.length > 0}
              onChange={() => {
                if (selectedIds.size === caseGroups.length) setSelectedIds(new Set());
                else setSelectedIds(new Set(caseGroups.map(c => c.id)));
              }}
              style={{ width: 14, height: 14, accentColor: COLORS.brand }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textTertiary }}>Case</span>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textTertiary }}>Issues</span>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textTertiary }}>Severity</span>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textTertiary }}>Expires</span>
            <span></span>
          </div>
          
          {/* Rows */}
          {caseGroups.map((caseGroup, i) => {
            const isSelected = selectedIds.has(caseGroup.id);
            const isHovered = hoveredRow === caseGroup.id;
            const isActive = selectedCase?.id === caseGroup.id && showPanel;
            const hasError = caseGroup.severity === "error";
            
            return (
              <div
                key={caseGroup.id}
                onMouseEnter={() => setHoveredRow(caseGroup.id)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr 200px 100px 80px 72px",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: i < caseGroups.length - 1 ? `1px solid ${COLORS.borderLight}` : "none",
                  background: isActive ? COLORS.brandLight : isHovered ? COLORS.surfaceAlt : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  borderLeft: isActive ? `3px solid ${COLORS.brand}` : hasError ? `3px solid ${COLORS.critical}` : "3px solid transparent",
                }}
                onClick={() => openReview(caseGroup)}
              >
                {/* Checkbox */}
                <div onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(caseGroup.id)}
                    style={{ width: 14, height: 14, accentColor: COLORS.brand }}
                  />
                </div>
                
                {/* Case info */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: COLORS.brand }}>
                      {caseGroup.caseNumber}
                    </span>
                    <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                      {caseGroup.surgeon}
                    </span>
                    <span style={{ fontSize: 11, color: COLORS.textTertiary }}>·</span>
                    <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                      {caseGroup.procedure}
                    </span>
                    <span style={{ fontSize: 11, color: COLORS.textTertiary }}>·</span>
                    <span style={{ fontSize: 12, color: COLORS.textTertiary }}>
                      {caseGroup.side}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: COLORS.textTertiary }}>
                    {caseGroup.milestones}
                  </span>
                </div>
                
                {/* Issue types */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {caseGroup.issueTypes.map((t, j) => (
                    <IssueChip key={j} label={t.name} count={t.count} severity={t.severity} />
                  ))}
                </div>
                
                {/* Severity indicator */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: hasError ? COLORS.critical : COLORS.warning,
                  }} />
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: hasError ? COLORS.critical : COLORS.warning,
                  }}>
                    {caseGroup.issueCount} issues
                  </span>
                </div>
                
                {/* Expires */}
                <span style={{
                  fontSize: 12,
                  fontFamily: FONTS.mono,
                  fontWeight: 500,
                  color: caseGroup.expiresIn <= 7 ? COLORS.critical : caseGroup.expiresIn <= 14 ? COLORS.warning : COLORS.textSecondary,
                }}>
                  {caseGroup.expiresIn}d
                </span>
                
                {/* Action */}
                <button
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    background: isHovered || isActive ? COLORS.brand : COLORS.surface,
                    color: isHovered || isActive ? "white" : COLORS.textSecondary,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: FONTS.body,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Review
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ====== REVIEW SIDE PANEL ====== */}
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 520,
        height: "100vh",
        background: COLORS.surface,
        borderLeft: `1px solid ${COLORS.border}`,
        boxShadow: showPanel ? "-8px 0 32px rgba(0,0,0,0.08)" : "none",
        transform: showPanel ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {selectedCase && (
          <>
            {/* Panel Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: `1px solid ${COLORS.border}`,
              background: COLORS.surface,
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: `linear-gradient(135deg, ${COLORS.brand}, #7C3AED)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon name="eye" size={14} color="white" />
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Review Case</span>
                </div>
                <button
                  onClick={closePanel}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => e.target.style.background = COLORS.surfaceAlt}
                  onMouseLeave={(e) => e.target.style.background = COLORS.surface}
                >
                  <Icon name="x" size={14} color={COLORS.textSecondary} />
                </button>
              </div>
              
              {/* Case header info */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 15, fontWeight: 700, color: COLORS.brand }}>
                  {selectedCase.caseNumber}
                </span>
                <span style={{ color: COLORS.textTertiary }}>·</span>
                <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
                  {selectedCase.surgeon} · {selectedCase.procedure} · {selectedCase.side}
                </span>
              </div>
            </div>
            
            {/* Panel Body - Scrollable */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}>
              
              {/* Issues Banner */}
              <div style={{
                background: selectedCase.severity === "error" ? COLORS.criticalBg : COLORS.warningBg,
                border: `1px solid ${selectedCase.severity === "error" ? COLORS.criticalBorder : COLORS.warningBorder}`,
                borderRadius: 10,
                padding: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Icon name="alertTriangle" size={16} color={selectedCase.severity === "error" ? COLORS.critical : COLORS.warning} />
                  <span style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: selectedCase.severity === "error" ? COLORS.critical : "#92400E",
                  }}>
                    {selectedCase.issueCount} Issues Detected
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedCase.issueTypes.map((t, j) => (
                    <IssueChip key={j} label={t.name} count={t.count} severity={t.severity} />
                  ))}
                </div>
                <p style={{ fontSize: 11, color: selectedCase.severity === "error" ? "#991B1B" : "#92400E", marginTop: 8, margin: "8px 0 0", opacity: 0.8 }}>
                  Resolving will address all issues for this case. Detected 3 days ago.
                </p>
              </div>

              {/* Case Details */}
              <div style={{
                background: COLORS.surfaceAlt,
                borderRadius: 10,
                padding: 16,
                border: `1px solid ${COLORS.borderLight}`,
              }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textSecondary, margin: "0 0 12px" }}>
                  Case Details
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Procedure", value: selectedCase.procedure },
                    { label: "Side", value: selectedCase.side },
                    { label: "Date", value: selectedCase.date },
                    { label: "Scheduled", value: selectedCase.scheduledStart },
                    { label: "Surgeon", value: selectedCase.surgeon },
                    { label: "Room", value: selectedCase.room },
                  ].map((item, i) => (
                    <div key={i}>
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textTertiary }}>
                        {item.label}
                      </span>
                      <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, margin: "2px 0 0" }}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Impact Analysis */}
              <div style={{
                background: COLORS.surface,
                borderRadius: 10,
                padding: 16,
                border: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <Icon name="activity" size={14} color={COLORS.purple} />
                  <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textSecondary, margin: 0 }}>
                    Impact Analysis
                  </h4>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* Cannot Calculate */}
                  <div style={{
                    background: COLORS.criticalBg,
                    borderRadius: 8,
                    padding: 12,
                    border: `1px solid ${COLORS.criticalBorder}`,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.critical }}>
                      Cannot Calculate
                    </span>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {impactMetrics.cannotCalculate.map((m, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon name="x" size={12} color={COLORS.critical} />
                          <span style={{ fontSize: 12, color: "#991B1B", fontWeight: 500 }}>{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Can Calculate */}
                  <div style={{
                    background: COLORS.successBg,
                    borderRadius: 8,
                    padding: 12,
                    border: `1px solid ${COLORS.successBorder}`,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.success }}>
                      Can Calculate
                    </span>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {impactMetrics.canCalculate.map((m, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon name="check" size={12} color={COLORS.success} />
                          <span style={{ fontSize: 12, color: "#065F46", fontWeight: 500 }}>{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Milestone Timeline */}
              <div style={{
                background: COLORS.surface,
                borderRadius: 10,
                padding: 16,
                border: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="milestone" size={14} color={COLORS.brand} />
                    <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textSecondary, margin: 0 }}>
                      Milestone Timeline
                    </h4>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.success }} />
                      <span style={{ fontSize: 10, color: COLORS.textTertiary }}>Recorded</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${COLORS.textTertiary}` }} />
                      <span style={{ fontSize: 10, color: COLORS.textTertiary }}>Missing</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.warning }} />
                      <span style={{ fontSize: 10, color: COLORS.textTertiary }}>Issue</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ paddingLeft: 4 }}>
                  {mockMilestones.map((milestone, index) => (
                    <TimelineNode
                      key={milestone.id}
                      milestone={milestone}
                      isLast={index === mockMilestones.length - 1}
                      hasIssue={milestone.hasIssue}
                      isMissing={!milestone.recorded_at}
                      isEditing={false}
                      onEdit={() => {}}
                      onTimeChange={() => {}}
                    />
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, display: "block", marginBottom: 6 }}>
                  Resolution Notes <span style={{ fontWeight: 400, color: COLORS.textTertiary }}>(optional)</span>
                </label>
                <textarea
                  placeholder="Add context about this resolution..."
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: FONTS.body,
                    color: COLORS.text,
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            
            {/* Panel Footer - Fixed */}
            <div style={{
              padding: "14px 20px",
              borderTop: `1px solid ${COLORS.border}`,
              background: COLORS.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <button
                style={{
                  padding: "7px 14px",
                  borderRadius: 7,
                  border: `1px solid ${COLORS.brand}20`,
                  background: COLORS.brandLight,
                  color: COLORS.brand,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: FONTS.body,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Icon name="externalLink" size={12} color={COLORS.brand} />
                Open Case
              </button>
              
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{
                    padding: "7px 16px",
                    borderRadius: 7,
                    border: `1px solid ${COLORS.criticalBorder}`,
                    background: COLORS.criticalBg,
                    color: COLORS.critical,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: FONTS.body,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    transition: "all 0.15s",
                  }}
                >
                  <Icon name="ban" size={12} color={COLORS.critical} />
                  Exclude
                </button>
                <button
                  style={{
                    padding: "7px 20px",
                    borderRadius: 7,
                    border: "none",
                    background: `linear-gradient(135deg, ${COLORS.success}, #047857)`,
                    color: "white",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: FONTS.body,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    boxShadow: `0 2px 8px ${COLORS.success}30`,
                    transition: "all 0.15s",
                  }}
                >
                  <Icon name="checkCircle" size={13} color="white" />
                  Validate & Resolve
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ====== ANIMATIONS ====== */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input[type="checkbox"] {
          cursor: pointer;
        }
        select:focus {
          border-color: ${COLORS.brand};
          box-shadow: 0 0 0 2px ${COLORS.brand}20;
        }
        textarea:focus {
          border-color: ${COLORS.brand};
          box-shadow: 0 0 0 2px ${COLORS.brand}20;
        }
        button:active {
          transform: scale(0.98);
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: ${COLORS.border};
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${COLORS.textTertiary};
        }
      `}</style>
    </div>
  );
}
