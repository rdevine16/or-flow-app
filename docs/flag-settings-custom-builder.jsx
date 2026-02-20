import { useState, useEffect, useRef, useMemo } from "react";

// ============================================
// DESIGN TOKENS
// ============================================
const C = {
  bg: "#f8f9fb", surface: "#ffffff", surfaceAlt: "#f8fafc", surfaceHover: "#f1f5f9",
  border: "#e2e8f0", borderLight: "#f1f5f9", text: "#0f172a", textSec: "#334155",
  textMuted: "#64748b", textDim: "#94a3b8",
  blue: "#2563eb", blueLight: "#eff6ff", blueBorder: "#bfdbfe",
  violet: "#7c3aed", violetLight: "#f5f3ff", violetBorder: "#ddd6fe",
  emerald: "#059669", emeraldLight: "#ecfdf5",
  amber: "#d97706", amberLight: "#fffbeb",
  rose: "#e11d48", roseLight: "#fff1f2",
};

const SEV = {
  critical: { label: "Critical", dot: "#dc2626", bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
  warning: { label: "Warning", dot: "#d97706", bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  info: { label: "Info", dot: "#2563eb", bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
};

const CAT = {
  timing: { label: "Timing", color: "#7c3aed", bg: "#f5f3ff", icon: "⏱" },
  efficiency: { label: "Efficiency", color: "#0284c7", bg: "#f0f9ff", icon: "⚡" },
  anesthesia: { label: "Anesthesia", color: "#059669", bg: "#ecfdf5", icon: "💉" },
  recovery: { label: "Recovery", color: "#ea580c", bg: "#fff7ed", icon: "🔄" },
  financial: { label: "Financial", color: "#e11d48", bg: "#fff1f2", icon: "$" },
  quality: { label: "Quality", color: "#64748b", bg: "#f8fafc", icon: "✓" },
};

// ============================================
// METRICS CATALOG — the core of custom rules
// ============================================
// This is what makes custom rules possible. Each metric maps to:
//   - which table/view it lives in
//   - what data type it returns (duration, currency, percentage, count)
//   - default category, description, supported operators
//   - optional milestone pair (for timing metrics)

const METRICS_CATALOG = [
  // ── TIMING ──
  { id: "total_case_time", name: "Total Case Time", description: "Patient in to patient out", category: "timing", dataType: "duration", unit: "min", source: "case_milestone_stats", startMilestone: "patient_in", endMilestone: "patient_out", supportsMedian: true },
  { id: "surgical_time", name: "Surgical Time", description: "Incision to closing", category: "timing", dataType: "duration", unit: "min", source: "case_milestone_stats", startMilestone: "incision", endMilestone: "closing", supportsMedian: true },
  { id: "pre_op_time", name: "Pre-Op Time", description: "Patient in to incision", category: "timing", dataType: "duration", unit: "min", source: "case_milestone_stats", startMilestone: "patient_in", endMilestone: "incision", supportsMedian: true },
  { id: "anesthesia_time", name: "Anesthesia Induction", description: "Anesthesia start to end", category: "timing", dataType: "duration", unit: "min", source: "case_milestone_stats", startMilestone: "anes_start", endMilestone: "anes_end", supportsMedian: true },
  { id: "closing_time", name: "Closing Time", description: "Closing start to complete", category: "timing", dataType: "duration", unit: "min", source: "case_milestone_stats", startMilestone: "closing", endMilestone: "closing_complete", supportsMedian: true },
  { id: "emergence_time", name: "Emergence Time", description: "Closing complete to patient out", category: "timing", dataType: "duration", unit: "min", source: "case_milestone_stats", startMilestone: "closing_complete", endMilestone: "patient_out", supportsMedian: true },
  { id: "prep_to_incision", name: "Prep to Incision", description: "Prep/drape complete to incision start", category: "timing", dataType: "duration", unit: "min", source: "case_milestone_stats", startMilestone: "prep_drape_complete", endMilestone: "incision", supportsMedian: true },

  // ── EFFICIENCY ──
  { id: "turnover_time", name: "Room Turnover", description: "Time between consecutive cases in same room", category: "efficiency", dataType: "duration", unit: "min", source: "case_milestone_stats", startMilestone: null, endMilestone: null, supportsMedian: true },
  { id: "fcots_delay", name: "First Case Delay", description: "Minutes past scheduled start for first case", category: "efficiency", dataType: "duration", unit: "min", source: "case_milestone_stats", startMilestone: null, endMilestone: null, supportsMedian: false },
  { id: "surgeon_readiness_gap", name: "Surgeon Readiness Gap", description: "Wait time after prep complete for surgeon to begin", category: "efficiency", dataType: "duration", unit: "min", source: "case_milestone_stats", startMilestone: "prep_drape_complete", endMilestone: "incision", supportsMedian: true },
  { id: "callback_delay", name: "Callback Delay", description: "Time from surgeon leaving room to patient callback in flip room", category: "efficiency", dataType: "duration", unit: "min", source: "case_milestone_stats", startMilestone: null, endMilestone: null, supportsMedian: true },
  { id: "room_idle_gap", name: "Room Idle Gap", description: "Unexplained gap between patient out and next case start", category: "efficiency", dataType: "duration", unit: "min", source: "computed", startMilestone: null, endMilestone: null, supportsMedian: true },

  // ── FINANCIAL ──
  { id: "case_profit", name: "Case Profit", description: "Total reimbursement minus total cost", category: "financial", dataType: "currency", unit: "$", source: "case_completion_stats", startMilestone: null, endMilestone: null, supportsMedian: false },
  { id: "case_margin", name: "Case Margin", description: "Profit as percentage of reimbursement", category: "financial", dataType: "percentage", unit: "%", source: "case_completion_stats", startMilestone: null, endMilestone: null, supportsMedian: false },
  { id: "profit_per_minute", name: "Profit per Minute", description: "Net profit divided by total case time", category: "financial", dataType: "currency", unit: "$/min", source: "case_completion_stats", startMilestone: null, endMilestone: null, supportsMedian: true },
  { id: "implant_cost_ratio", name: "Implant Cost Ratio", description: "Implant cost as percentage of total reimbursement", category: "financial", dataType: "percentage", unit: "%", source: "case_completion_stats", startMilestone: null, endMilestone: null, supportsMedian: false },
  { id: "total_case_cost", name: "Total Case Cost", description: "Sum of all costs (staff, implants, supplies, overhead)", category: "financial", dataType: "currency", unit: "$", source: "case_completion_stats", startMilestone: null, endMilestone: null, supportsMedian: true },
  { id: "reimbursement_variance", name: "Reimbursement Variance", description: "Actual vs expected reimbursement for CPT/payer", category: "financial", dataType: "percentage", unit: "%", source: "case_completion_stats", startMilestone: null, endMilestone: null, supportsMedian: false },
  { id: "excess_time_cost", name: "Excess Time Cost", description: "Estimated cost of time beyond median case duration", category: "financial", dataType: "currency", unit: "$", source: "computed", startMilestone: null, endMilestone: null, supportsMedian: false },

  // ── QUALITY ──
  { id: "missing_milestones", name: "Missing Milestones", description: "Number of expected milestones not recorded", category: "quality", dataType: "count", unit: "", source: "case_milestones", startMilestone: null, endMilestone: null, supportsMedian: false },
  { id: "milestone_out_of_order", name: "Milestone Sequence Error", description: "Milestones recorded in unexpected chronological order", category: "quality", dataType: "count", unit: "", source: "case_milestones", startMilestone: null, endMilestone: null, supportsMedian: false },
];

const OPERATORS = [
  { id: "gt", label: ">", description: "Greater than" },
  { id: "gte", label: "≥", description: "Greater than or equal" },
  { id: "lt", label: "<", description: "Less than" },
  { id: "lte", label: "≤", description: "Less than or equal" },
];

// ============================================
// MOCK EXISTING RULES (built-in)
// ============================================
const BUILT_IN_RULES = [
  { id: "b1", name: "Long Total Case Time", metric: "total_case_time", category: "timing", threshold_type: "median_plus_sd", threshold_value: 1.0, operator: "gt", comparison_scope: "facility", severity: "warning", is_enabled: true, is_built_in: true, computed_median: 72, computed_sd: 18 },
  { id: "b2", name: "Long Total Case Time (Personal)", metric: "total_case_time", category: "timing", threshold_type: "median_plus_sd", threshold_value: 1.0, operator: "gt", comparison_scope: "personal", severity: "info", is_enabled: true, is_built_in: true, computed_median: null, computed_sd: null },
  { id: "b3", name: "Long Surgical Time", metric: "surgical_time", category: "timing", threshold_type: "median_plus_sd", threshold_value: 1.0, operator: "gt", comparison_scope: "facility", severity: "warning", is_enabled: true, is_built_in: true, computed_median: 48, computed_sd: 14 },
  { id: "b4", name: "Long Pre-Op Time", metric: "pre_op_time", category: "efficiency", threshold_type: "median_plus_sd", threshold_value: 1.0, operator: "gt", comparison_scope: "facility", severity: "info", is_enabled: true, is_built_in: true, computed_median: 22, computed_sd: 8 },
  { id: "b5", name: "Slow Room Turnover", metric: "turnover_time", category: "efficiency", threshold_type: "median_plus_sd", threshold_value: 1.0, operator: "gt", comparison_scope: "facility", severity: "warning", is_enabled: true, is_built_in: true, computed_median: 28, computed_sd: 11 },
  { id: "b6", name: "Late First Case Start", metric: "fcots_delay", category: "efficiency", threshold_type: "absolute", threshold_value: 15, operator: "gt", comparison_scope: "facility", severity: "warning", is_enabled: true, is_built_in: true, computed_median: null, computed_sd: null },
  { id: "b7", name: "Long Anesthesia Induction", metric: "anesthesia_time", category: "anesthesia", threshold_type: "median_plus_sd", threshold_value: 1.0, operator: "gt", comparison_scope: "facility", severity: "info", is_enabled: true, is_built_in: true, computed_median: 15, computed_sd: 6 },
  { id: "b8", name: "Long Closing Time", metric: "closing_time", category: "recovery", threshold_type: "median_plus_sd", threshold_value: 1.0, operator: "gt", comparison_scope: "facility", severity: "info", is_enabled: true, is_built_in: true, computed_median: 12, computed_sd: 5 },
];

const CUSTOM_RULES_INITIAL = [
  { id: "c1", name: "Case Operating at Loss", metric: "case_profit", category: "financial", threshold_type: "absolute", threshold_value: 0, operator: "lt", comparison_scope: "facility", severity: "critical", is_enabled: true, is_built_in: false },
  { id: "c2", name: "Low Margin Case", metric: "case_margin", category: "financial", threshold_type: "absolute", threshold_value: 15, operator: "lt", comparison_scope: "facility", severity: "warning", is_enabled: true, is_built_in: false },
  { id: "c3", name: "High Implant Cost Ratio", metric: "implant_cost_ratio", category: "financial", threshold_type: "absolute", threshold_value: 60, operator: "gt", comparison_scope: "facility", severity: "warning", is_enabled: true, is_built_in: false },
];

// ============================================
// SUB-COMPONENTS
// ============================================
const Toggle = ({ enabled, onChange, size = "normal" }) => {
  const w = size === "small" ? 30 : 36;
  const h = size === "small" ? 16 : 20;
  const knob = size === "small" ? 12 : 16;
  return (
    <button onClick={onChange} style={{
      position: "relative", width: w, height: h, borderRadius: h / 2,
      backgroundColor: enabled ? C.blue : "#cbd5e1", border: "none", cursor: "pointer",
      transition: "background-color 0.2s ease", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: (h - knob) / 2, left: enabled ? w - knob - (h - knob) / 2 : (h - knob) / 2,
        width: knob, height: knob, borderRadius: "50%", backgroundColor: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 0.2s ease",
      }} />
    </button>
  );
};

const CategoryBadge = ({ category, size = "normal" }) => {
  const c = CAT[category] || { label: category, color: C.textMuted, bg: C.surfaceAlt, icon: "?" };
  return (
    <span style={{
      fontSize: size === "small" ? 9 : 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      color: c.color, backgroundColor: c.bg, padding: size === "small" ? "1px 5px" : "2px 7px", borderRadius: 4,
    }}>{c.label}</span>
  );
};

const SeverityPills = ({ value, onChange, disabled }) => (
  <div style={{ display: "flex", gap: 3 }}>
    {Object.entries(SEV).map(([key, cfg]) => {
      const sel = value === key;
      return (
        <button key={key} onClick={() => !disabled && onChange(key)} disabled={disabled} style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "3px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600,
          border: `1.5px solid ${sel ? cfg.border : "transparent"}`,
          backgroundColor: sel ? cfg.bg : "transparent",
          color: sel ? cfg.text : C.textDim,
          cursor: disabled ? "default" : "pointer", transition: "all 0.15s ease",
          opacity: disabled ? 0.4 : 1,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: sel ? cfg.dot : C.textDim, opacity: sel ? 1 : 0.4 }} />
          {cfg.label}
        </button>
      );
    })}
  </div>
);

const ScopeBadge = ({ scope }) => {
  const p = scope === "personal";
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 5,
      backgroundColor: p ? C.violetLight : C.surfaceAlt,
      color: p ? C.violet : C.textMuted,
      border: `1px solid ${p ? C.violetBorder : C.borderLight}`,
    }}>{p ? "Personal" : "Facility"}</span>
  );
};

const ThresholdInline = ({ rule, onChange, disabled }) => {
  const metric = METRICS_CATALOG.find(m => m.id === rule.metric);
  const isAbsolute = rule.threshold_type === "absolute";
  const hasComputed = rule.computed_median != null && rule.computed_sd != null;
  const computedVal = hasComputed ? Math.round(rule.computed_median + rule.threshold_value * rule.computed_sd) : null;
  const unit = metric?.unit || "min";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <select value={rule.threshold_type} disabled={disabled}
          onChange={e => onChange(e.target.value, e.target.value === "absolute" ? (computedVal || 90) : 1.0)}
          style={{ fontSize: 11, padding: "3px 6px", borderRadius: 5, border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.textSec, cursor: disabled ? "default" : "pointer", outline: "none", opacity: disabled ? 0.4 : 1 }}>
          {metric?.supportsMedian !== false && <option value="median_plus_sd">Median + SD</option>}
          <option value="absolute">Absolute</option>
        </select>

        <select value={rule.operator} disabled={disabled}
          onChange={e => onChange(rule.threshold_type, rule.threshold_value, e.target.value)}
          style={{ fontSize: 12, padding: "3px 4px", borderRadius: 5, border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.textSec, cursor: disabled ? "default" : "pointer", outline: "none", width: 38, textAlign: "center", fontWeight: 600, opacity: disabled ? 0.4 : 1 }}>
          {OPERATORS.map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
        </select>

        {isAbsolute ? (
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <input type="number" value={rule.threshold_value} disabled={disabled}
              step={metric?.dataType === "currency" ? 100 : metric?.dataType === "percentage" ? 5 : 5}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange("absolute", v); }}
              style={{ width: 56, fontSize: 12, fontWeight: 600, textAlign: "center", padding: "3px 4px", borderRadius: 5, border: `1px solid ${C.border}`, fontFamily: "'SF Mono', monospace", color: C.text, outline: "none", opacity: disabled ? 0.4 : 1 }} />
            <span style={{ fontSize: 11, color: C.textDim }}>{unit}</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 11, color: C.textDim }}>+</span>
            <input type="number" value={rule.threshold_value} step="0.5" min="0.5" max="5" disabled={disabled}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0.5) onChange("median_plus_sd", v); }}
              style={{ width: 44, fontSize: 12, fontWeight: 600, textAlign: "center", padding: "3px 4px", borderRadius: 5, border: `1px solid ${C.border}`, fontFamily: "'SF Mono', monospace", color: C.text, outline: "none", opacity: disabled ? 0.4 : 1 }} />
            <span style={{ fontSize: 11, color: C.textDim }}>SD</span>
          </div>
        )}
      </div>

      {/* Computed value */}
      {!isAbsolute && (
        <span style={{ fontSize: 10, color: C.textDim, lineHeight: 1.2 }}>
          {hasComputed ? (
            <>≈ <span style={{ fontWeight: 600, color: C.textMuted, fontFamily: "'SF Mono', monospace" }}>{computedVal} {unit}</span> <span style={{ opacity: 0.7 }}>({rule.computed_median}{unit === "$" ? "" : "m"} + {Math.round(rule.threshold_value * rule.computed_sd)})</span></>
          ) : (
            <span style={{ fontStyle: "italic" }}>Per surgeon × procedure</span>
          )}
        </span>
      )}
    </div>
  );
};

// ============================================
// METRIC SEARCH / RULE BUILDER
// ============================================
const MetricSearchBuilder = ({ onAdd, onCancel }) => {
  const [search, setSearch] = useState("");
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [step, setStep] = useState(1); // 1 = search, 2 = configure
  const [newRule, setNewRule] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return METRICS_CATALOG;
    const q = search.toLowerCase();
    return METRICS_CATALOG.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.dataType.toLowerCase().includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(m => {
      if (!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    });
    return Object.entries(groups);
  }, [filtered]);

  const selectMetric = (metric) => {
    setSelectedMetric(metric);
    setNewRule({
      name: "",
      metric: metric.id,
      category: metric.category,
      threshold_type: metric.supportsMedian ? "median_plus_sd" : "absolute",
      threshold_value: metric.supportsMedian ? 1.0 : (metric.dataType === "currency" ? 0 : metric.dataType === "percentage" ? 15 : 30),
      operator: metric.dataType === "currency" && metric.id === "case_profit" ? "lt" : "gt",
      comparison_scope: "facility",
      severity: "warning",
      is_enabled: true,
      is_built_in: false,
    });
    setStep(2);
  };

  if (step === 2 && selectedMetric && newRule) {
    return (
      <div style={{
        backgroundColor: C.surface, border: `2px solid ${C.blue}`, borderRadius: 12,
        overflow: "hidden", boxShadow: `0 4px 20px ${C.blue}15`,
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 20px", backgroundColor: C.blueLight,
          borderBottom: `1px solid ${C.blueBorder}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => { setStep(1); setSelectedMetric(null); }} style={{
              fontSize: 12, color: C.blue, background: "none", border: "none", cursor: "pointer", fontWeight: 600,
            }}>← Back</button>
            <span style={{ width: 1, height: 16, backgroundColor: C.blueBorder }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>New Rule</span>
            <CategoryBadge category={selectedMetric.category} size="small" />
          </div>
          <button onClick={onCancel} style={{
            fontSize: 18, color: C.textDim, background: "none", border: "none", cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>

        {/* Configure form */}
        <div style={{ padding: "20px 20px 16px" }}>
          {/* Metric info */}
          <div style={{
            padding: "10px 14px", backgroundColor: C.surfaceAlt, borderRadius: 8,
            border: `1px solid ${C.borderLight}`, marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{selectedMetric.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{selectedMetric.description}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 10, color: C.textDim, backgroundColor: C.borderLight, padding: "1px 5px", borderRadius: 3, fontFamily: "'SF Mono', monospace" }}>{selectedMetric.source}</span>
              <span style={{ fontSize: 10, color: C.textDim, backgroundColor: C.borderLight, padding: "1px 5px", borderRadius: 3 }}>{selectedMetric.dataType}</span>
              {selectedMetric.startMilestone && (
                <span style={{ fontSize: 10, color: C.textDim, backgroundColor: C.borderLight, padding: "1px 5px", borderRadius: 3, fontFamily: "'SF Mono', monospace" }}>
                  {selectedMetric.startMilestone} → {selectedMetric.endMilestone}
                </span>
              )}
            </div>
          </div>

          {/* Rule name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Rule Name</label>
            <input
              value={newRule.name}
              onChange={e => setNewRule({ ...newRule, name: e.target.value })}
              placeholder={`e.g., High ${selectedMetric.name}`}
              style={{
                width: "100%", fontSize: 13, padding: "8px 12px", borderRadius: 8,
                border: `1px solid ${C.border}`, outline: "none", color: C.text,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Threshold row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Threshold</label>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <select value={newRule.threshold_type}
                  onChange={e => setNewRule({ ...newRule, threshold_type: e.target.value, threshold_value: e.target.value === "absolute" ? 90 : 1.0 })}
                  style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.border}`, color: C.textSec, outline: "none" }}>
                  {selectedMetric.supportsMedian !== false && <option value="median_plus_sd">Median + SD</option>}
                  <option value="absolute">Absolute</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
                <select value={newRule.operator}
                  onChange={e => setNewRule({ ...newRule, operator: e.target.value })}
                  style={{ fontSize: 13, padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.border}`, color: C.textSec, outline: "none", fontWeight: 600, width: 44, textAlign: "center" }}>
                  {OPERATORS.map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
                </select>
                <input type="number" value={newRule.threshold_value}
                  step={newRule.threshold_type === "median_plus_sd" ? 0.5 : 5}
                  onChange={e => setNewRule({ ...newRule, threshold_value: parseFloat(e.target.value) || 0 })}
                  style={{ width: 60, fontSize: 13, fontWeight: 600, textAlign: "center", padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: "'SF Mono', monospace", color: C.text, outline: "none" }} />
                <span style={{ fontSize: 12, color: C.textDim }}>
                  {newRule.threshold_type === "median_plus_sd" ? "SD" : selectedMetric.unit}
                </span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Severity</label>
              <SeverityPills value={newRule.severity} onChange={sev => setNewRule({ ...newRule, severity: sev })} />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Scope</label>
              <div style={{ display: "flex", gap: 4 }}>
                {["facility", "personal"].map(s => (
                  <button key={s} onClick={() => setNewRule({ ...newRule, comparison_scope: s })}
                    style={{
                      padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${newRule.comparison_scope === s ? (s === "personal" ? C.violetBorder : C.blueBorder) : C.border}`,
                      backgroundColor: newRule.comparison_scope === s ? (s === "personal" ? C.violetLight : C.blueLight) : "transparent",
                      color: newRule.comparison_scope === s ? (s === "personal" ? C.violet : C.blue) : C.textMuted,
                      cursor: "pointer", transition: "all 0.15s ease",
                    }}>
                    {s === "personal" ? "Personal" : "Facility"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview sentence */}
          <div style={{
            padding: "10px 14px", backgroundColor: "#fefce8", border: "1px solid #fef08a",
            borderRadius: 8, marginBottom: 16,
          }}>
            <span style={{ fontSize: 12, color: "#854d0e", lineHeight: 1.5 }}>
              <strong>Preview:</strong> Flag cases where{" "}
              <strong>{selectedMetric.name.toLowerCase()}</strong>{" "}
              is {OPERATORS.find(o => o.id === newRule.operator)?.description.toLowerCase()}{" "}
              {newRule.threshold_type === "median_plus_sd"
                ? `the ${newRule.comparison_scope} median + ${newRule.threshold_value} standard deviations`
                : `${newRule.threshold_value} ${selectedMetric.unit}`
              }{" "}
              — severity: <strong>{newRule.severity}</strong>
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={onCancel} style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              backgroundColor: "transparent", color: C.textMuted, border: `1px solid ${C.border}`, cursor: "pointer",
            }}>Cancel</button>
            <button onClick={() => onAdd({ ...newRule, id: `c${Date.now()}`, name: newRule.name || `Custom: ${selectedMetric.name}` })}
              disabled={!newRule.name}
              style={{
                padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                backgroundColor: newRule.name ? C.blue : C.border, color: newRule.name ? "#fff" : C.textDim,
                border: "none", cursor: newRule.name ? "pointer" : "default",
                boxShadow: newRule.name ? `0 1px 4px ${C.blue}40` : "none",
              }}>
              Add Rule
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Search metrics
  return (
    <div style={{
      backgroundColor: C.surface, border: `2px solid ${C.blue}`, borderRadius: 12,
      overflow: "hidden", boxShadow: `0 4px 20px ${C.blue}15`,
    }}>
      <div style={{
        padding: "14px 20px", backgroundColor: C.blueLight,
        borderBottom: `1px solid ${C.blueBorder}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Select a Metric</span>
        <button onClick={onCancel} style={{ fontSize: 18, color: C.textDim, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>

      {/* Search */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderLight}` }}>
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search metrics… (e.g., profit, turnover, anesthesia)"
          style={{
            width: "100%", fontSize: 13, padding: "8px 12px", borderRadius: 8,
            border: `1px solid ${C.border}`, outline: "none", color: C.text,
            boxSizing: "border-box",
          }}
        />
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>
          {filtered.length} metric{filtered.length !== 1 ? "s" : ""} available across timing, efficiency, financial, and quality categories
        </div>
      </div>

      {/* Results */}
      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {grouped.map(([cat, metrics]) => (
          <div key={cat}>
            <div style={{
              padding: "8px 16px", backgroundColor: C.surfaceAlt,
              borderBottom: `1px solid ${C.borderLight}`,
              display: "flex", alignItems: "center", gap: 6,
              position: "sticky", top: 0, zIndex: 1,
            }}>
              <span style={{ fontSize: 14 }}>{CAT[cat]?.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: CAT[cat]?.color || C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {CAT[cat]?.label || cat}
              </span>
              <span style={{ fontSize: 10, color: C.textDim }}>({metrics.length})</span>
            </div>
            {metrics.map(m => (
              <button key={m.id} onClick={() => selectMetric(m)} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                width: "100%", padding: "10px 16px", border: "none", background: "none",
                borderBottom: `1px solid ${C.borderLight}`, cursor: "pointer",
                textAlign: "left", transition: "background-color 0.1s ease",
              }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = C.surfaceHover}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{m.description}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 16 }}>
                  <span style={{
                    fontSize: 10, padding: "2px 6px", borderRadius: 3,
                    backgroundColor: C.borderLight, color: C.textDim,
                    fontFamily: "'SF Mono', monospace",
                  }}>{m.dataType}</span>
                  <span style={{ fontSize: 14, color: C.textDim }}>→</span>
                </div>
              </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: "32px 16px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
            No metrics match "{search}"
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function FlagSettingsWithBuilder() {
  const [builtIn] = useState(BUILT_IN_RULES);
  const [custom, setCustom] = useState(CUSTOM_RULES_INITIAL);
  const [showBuilder, setShowBuilder] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filterCat, setFilterCat] = useState("all");

  useEffect(() => { setTimeout(() => setLoaded(true), 80); }, []);

  const allRules = [...builtIn, ...custom];
  const enabledCount = allRules.filter(r => r.is_enabled).length;

  const addCustomRule = (rule) => {
    setCustom(prev => [...prev, rule]);
    setShowBuilder(false);
  };

  const removeCustom = (id) => {
    setCustom(prev => prev.filter(r => r.id !== id));
  };

  const categories = ["timing", "efficiency", "anesthesia", "recovery", "financial", "quality"];

  // Group built-in and custom separately
  const filteredBuiltIn = filterCat === "all" ? builtIn : builtIn.filter(r => r.category === filterCat);
  const filteredCustom = filterCat === "all" ? custom : custom.filter(r => r.category === filterCat);

  const RuleRow = ({ rule, isCustom, isLast }) => {
    const disabled = !rule.is_enabled;
    const metric = METRICS_CATALOG.find(m => m.id === rule.metric);
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: isCustom ? "44px 1fr 230px 170px 74px 36px" : "44px 1fr 230px 170px 74px",
        alignItems: "center", padding: "12px 16px", gap: 10,
        borderBottom: isLast ? "none" : `1px solid ${C.borderLight}`,
        opacity: disabled ? 0.45 : 1, transition: "opacity 0.15s ease",
      }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Toggle enabled={rule.is_enabled} onChange={() => {}} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: disabled ? C.textDim : C.text }}>{rule.name}</span>
            {isCustom && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, backgroundColor: C.blueLight, color: C.blue, border: `1px solid ${C.blueBorder}` }}>CUSTOM</span>}
          </div>
          <span style={{ fontSize: 11, color: C.textDim }}>{metric?.description || ""}</span>
        </div>
        <ThresholdInline rule={rule} onChange={() => {}} disabled={disabled} />
        <SeverityPills value={rule.severity} onChange={() => {}} disabled={disabled} />
        <div style={{ display: "flex", justifyContent: "center" }}><ScopeBadge scope={rule.comparison_scope} /></div>
        {isCustom && (
          <button onClick={() => removeCustom(rule.id)} title="Remove rule" style={{
            fontSize: 16, color: C.textDim, background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4,
            width: 28, height: 28, transition: "all 0.1s ease",
          }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.roseLight; e.currentTarget.style.color = C.rose; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = C.textDim; }}
          >×</button>
        )}
      </div>
    );
  };

  const TableHeader = ({ hasDelete }) => (
    <div style={{
      display: "grid",
      gridTemplateColumns: hasDelete ? "44px 1fr 230px 170px 74px 36px" : "44px 1fr 230px 170px 74px",
      padding: "7px 16px", backgroundColor: C.surfaceAlt,
      borderBottom: `1px solid ${C.border}`, gap: 10,
    }}>
      {["", "Rule", "Threshold", "Severity", "Scope", ...(hasDelete ? [""] : [])].map((h, i) => (
        <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: h === "Scope" ? "center" : "left" }}>{h}</span>
      ))}
    </div>
  );

  return (
    <div style={{
      backgroundColor: C.bg, minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
      opacity: loaded ? 1 : 0, transition: "opacity 0.3s ease",
    }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "32px 32px 64px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: C.textDim }}>Settings</span>
            <span style={{ fontSize: 12, color: C.textDim }}>›</span>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Ops</span>
            <span style={{ fontSize: 12, color: C.textDim }}>›</span>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Case Flags</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>Auto-Detection Rules</h1>
              <p style={{ fontSize: 14, color: C.textMuted, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 }}>
                Configure which flags are automatically created when cases are completed. Built-in rules provide standard OR metrics.
                Add custom rules from any metric in your database.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, backgroundColor: C.surface, border: `1px solid ${C.border}`, fontSize: 13, color: C.textMuted }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: C.blue }} />
                <span style={{ fontWeight: 600, color: C.text }}>{enabledCount}</span>/<span>{allRules.length}</span> active
              </div>
              <button onClick={() => setShowBuilder(true)} style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                backgroundColor: C.blue, color: "#fff", border: "none", cursor: "pointer",
                boxShadow: `0 1px 4px ${C.blue}40`, display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Rule
              </button>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 2, backgroundColor: C.borderLight, borderRadius: 7, padding: 2, width: "fit-content", marginBottom: 20 }}>
          {[{ key: "all", label: "All" }, ...categories.filter(c => allRules.some(r => r.category === c)).map(c => ({ key: c, label: CAT[c]?.label || c }))].map(opt => (
            <button key={opt.key} onClick={() => setFilterCat(opt.key)} style={{
              padding: "4px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
              backgroundColor: filterCat === opt.key ? C.surface : "transparent",
              color: filterCat === opt.key ? C.text : C.textMuted,
              boxShadow: filterCat === opt.key ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              transition: "all 0.12s ease",
            }}>{opt.label}</button>
          ))}
        </div>

        {/* Rule Builder */}
        {showBuilder && (
          <div style={{ marginBottom: 24 }}>
            <MetricSearchBuilder onAdd={addCustomRule} onCancel={() => setShowBuilder(false)} />
          </div>
        )}

        {/* Built-in Rules */}
        {filteredBuiltIn.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.06em" }}>Built-in Rules</span>
              <span style={{ fontSize: 11, color: C.textDim }}>{filteredBuiltIn.filter(r => r.is_enabled).length} of {filteredBuiltIn.length} active</span>
            </div>
            <div style={{ backgroundColor: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <TableHeader hasDelete={false} />
              {filteredBuiltIn.map((r, i) => <RuleRow key={r.id} rule={r} isCustom={false} isLast={i === filteredBuiltIn.length - 1} />)}
            </div>
          </div>
        )}

        {/* Custom Rules */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.06em" }}>Custom Rules</span>
              <span style={{ fontSize: 11, color: C.textDim }}>{filteredCustom.length} rule{filteredCustom.length !== 1 ? "s" : ""}</span>
            </div>
            {!showBuilder && (
              <button onClick={() => setShowBuilder(true)} style={{
                fontSize: 12, fontWeight: 600, color: C.blue, background: "none", border: "none", cursor: "pointer",
              }}>+ Add custom rule</button>
            )}
          </div>
          {filteredCustom.length > 0 ? (
            <div style={{ backgroundColor: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <TableHeader hasDelete={true} />
              {filteredCustom.map((r, i) => <RuleRow key={r.id} rule={r} isCustom={true} isLast={i === filteredCustom.length - 1} />)}
            </div>
          ) : (
            <div style={{
              padding: "32px 20px", textAlign: "center", borderRadius: 12,
              border: `2px dashed ${C.border}`, backgroundColor: C.surfaceAlt,
            }}>
              <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 8px" }}>
                No custom rules yet. Add rules from any metric in your database.
              </p>
              <button onClick={() => setShowBuilder(true)} style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                backgroundColor: C.blueLight, color: C.blue, border: `1px solid ${C.blueBorder}`,
                cursor: "pointer",
              }}>Browse Metrics →</button>
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{
          padding: "16px 20px", borderRadius: 10, backgroundColor: C.surface,
          border: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 24,
        }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>Threshold Types</span>
            <div style={{ marginTop: 8, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 4px" }}><strong style={{ color: C.textSec }}>Median + SD</strong> — Adapts automatically to your facility's data. The computed value updates as more cases are completed.</p>
              <p style={{ margin: 0 }}><strong style={{ color: C.textSec }}>Absolute</strong> — Fixed threshold in the metric's native unit. Use for hard operational targets.</p>
            </div>
          </div>
          <div style={{ backgroundColor: C.border }} />
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>Custom Rules</span>
            <div style={{ marginTop: 8, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 4px" }}><strong style={{ color: C.textSec }}>Any metric</strong> — Browse {METRICS_CATALOG.length} available metrics across timing, efficiency, financial, and quality categories.</p>
              <p style={{ margin: 0 }}><strong style={{ color: C.textSec }}>Full control</strong> — Set operator, threshold type, severity, and scope. Custom rules can be removed anytime.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
