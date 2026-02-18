import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

/*
 * ──────────────────────────────────────────────────────────
 *  PROPOSED: Condensed Surgeon Performance Header
 *  
 *  This is a reference mockup for the condensed header only.
 *  It replaces the current page title, doctor card, date nav,
 *  and stats rows with two compact rows (~100px total).
 *
 *  DO NOT modify any other components on the page.
 *  This component replaces only the header area above the
 *  OR Timeline.
 * ──────────────────────────────────────────────────────────
 */

const COLORS = {
  accent: "#2563eb",
  bgCard: "#ffffff",
  bgApp: "#f5f6f8",
  border: "#e2e5eb",
  borderLight: "#eef0f3",
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  red: "#ef4444",
  redBg: "#fef2f2",
};

function Avatar({ initials, size = 28 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: COLORS.accent, color: "white",
      fontSize: size * 0.36, fontWeight: 700,
      display: "grid", placeItems: "center", flexShrink: 0,
      letterSpacing: 0.3,
    }}>
      {initials}
    </div>
  );
}

function MiniRing({ pct = 56 }) {
  const r = 11;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ position: "relative", width: 30, height: 30 }}>
      <svg width={30} height={30} viewBox="0 0 30 30" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={15} cy={15} r={r} fill="none" stroke="#e5e7eb" strokeWidth={3} />
        <circle cx={15} cy={15} r={r} fill="none" stroke={COLORS.accent}
          strokeWidth={3} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "grid", placeItems: "center",
        fontSize: 8, fontWeight: 700, color: COLORS.textPrimary,
      }}>{pct}%</div>
    </div>
  );
}

function NavButton({ children }) {
  return (
    <button style={{
      width: 28, height: 28, border: `1px solid ${COLORS.border}`,
      borderRadius: 6, background: COLORS.bgCard,
      display: "grid", placeItems: "center",
      cursor: "pointer", color: COLORS.textSecondary,
    }}>{children}</button>
  );
}

function CompactStat({ label, value, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{
        fontSize: 11, fontWeight: 500, color: COLORS.textMuted,
        textTransform: "uppercase", letterSpacing: 0.3,
      }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: COLORS.textMuted }}>{sub}</span>}
    </div>
  );
}

function StatDivider() {
  return <div style={{ width: 1, height: 18, background: COLORS.border, flexShrink: 0 }} />;
}

export default function CondensedSurgeonHeader() {
  const [activeTab, setActiveTab] = useState("Day Analysis");

  return (
    <div style={{
      background: COLORS.bgCard,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {/* Row 1: Surgeon selector + View toggle + Date nav */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "10px 16px", gap: 12,
        borderBottom: `1px solid ${COLORS.borderLight}`,
      }}>
        {/* Surgeon selector */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "4px 12px 4px 4px",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 6, cursor: "pointer",
        }}>
          <Avatar initials="ES" />
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Dr. Erik Swartz</span>
          <ChevronDown size={12} color={COLORS.textMuted} style={{ marginLeft: 2 }} />
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: COLORS.border, flexShrink: 0 }} />

        {/* View toggle */}
        <div style={{
          display: "flex", border: `1px solid ${COLORS.border}`,
          borderRadius: 6, overflow: "hidden",
        }}>
          {["Overview", "Day Analysis"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "4px 12px", fontSize: 12, fontWeight: 500,
              border: "none", fontFamily: "inherit", cursor: "pointer",
              background: activeTab === tab ? COLORS.textPrimary : "transparent",
              color: activeTab === tab ? "white" : COLORS.textSecondary,
              transition: "all 0.12s",
            }}>{tab}</button>
          ))}
        </div>

        {/* Date nav — pushed right */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
          <NavButton><ChevronLeft size={14} /></NavButton>
          <div style={{
            height: 28, border: `1px solid ${COLORS.border}`, borderRadius: 6,
            padding: "0 10px", fontSize: 12, fontFamily: "inherit",
            color: COLORS.textPrimary, background: COLORS.bgCard,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Calendar size={12} color={COLORS.textMuted} />
            02/03/2026
          </div>
          <NavButton><ChevronRight size={14} /></NavButton>
          <span style={{
            fontSize: 12, fontWeight: 600, color: COLORS.accent,
            cursor: "pointer", marginLeft: 4,
          }}>Today</span>
        </div>
      </div>

      {/* Row 2: Compact inline stats */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "9px 16px", gap: 18,
      }}>
        <CompactStat label="First Case" value="7:39a" sub="(sched 7:30)" />
        <StatDivider />
        <CompactStat label="Cases" value="5" />
        <StatDivider />
        <CompactStat label="OR Time" value="7:54" />
        <StatDivider />
        <CompactStat label="Surgical" value="4:27" />
        <StatDivider />

        {/* Flags badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 11, fontWeight: 600, color: COLORS.red,
          background: COLORS.redBg, padding: "2px 9px", borderRadius: 10,
        }}>
          <div style={{ width: 5, height: 5, background: COLORS.red, borderRadius: "50%" }} />
          3 flags
        </div>

        {/* Surgical % — far right */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <MiniRing pct={56} />
          <span style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: 500 }}>Surgical</span>
        </div>
      </div>
    </div>
  );
}
