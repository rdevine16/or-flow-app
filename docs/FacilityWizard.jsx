import { useState, useCallback, useEffect } from "react";

// ============================================================================
// ICONS (inline SVG components)
// ============================================================================
const Icons = {
  Check: ({ size = 16, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="20 6 9 17 4 12" /></svg>
  ),
  ChevronRight: ({ size = 16, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="9 18 15 12 9 6" /></svg>
  ),
  ChevronLeft: ({ size = 16, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="15 18 9 12 15 6" /></svg>
  ),
  Building: ({ size = 18, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" /></svg>
  ),
  User: ({ size = 18, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
  Stethoscope: ({ size = 18, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" /><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" /><circle cx="20" cy="10" r="2" /></svg>
  ),
  Settings: ({ size = 18, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
  ),
  ClipboardCheck: ({ size = 18, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></svg>
  ),
  Mail: ({ size = 16, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
  ),
  AlertCircle: ({ size = 16, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
  ),
  Pencil: ({ size = 14, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
  ),
  Loader: ({ size = 18, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...props}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
  ),
  X: ({ size = 16, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
  ),
};

// ============================================================================
// STEP CONFIG
// ============================================================================
const STEPS = [
  { id: 1, label: "Facility Details", description: "Name, location, and contact info", icon: Icons.Building },
  { id: 2, label: "Administrator", description: "Initial admin user setup", icon: Icons.User },
  { id: 3, label: "Clinical Templates", description: "Milestones, procedures, delays", icon: Icons.Stethoscope },
  { id: 4, label: "Operational Config", description: "Costs, payers, analytics", icon: Icons.Settings },
  { id: 5, label: "Review & Create", description: "Confirm and provision", icon: Icons.ClipboardCheck },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY"
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
];

const FACILITY_TYPES = [
  { value: "asc", label: "Ambulatory Surgery Center" },
  { value: "hospital_outpatient", label: "Hospital Outpatient" },
  { value: "specialty_surgical", label: "Specialty Surgical Center" },
];

// ============================================================================
// TEMPLATE DATA (simulated counts)
// ============================================================================
const CLINICAL_TEMPLATES = [
  { key: "milestones", label: "Milestone Types", description: "Standard surgical workflow milestones", count: 18, icon: "🏁" },
  { key: "procedures", label: "Procedure Types", description: "Common surgical procedure templates", count: 24, icon: "🔬" },
  { key: "procedureMilestoneConfig", label: "Procedure–Milestone Mapping", description: "Expected milestones per procedure", count: 86, icon: "🔗" },
  { key: "delayTypes", label: "Delay Categories", description: "Standardized delay reason codes", count: 12, icon: "⏱️" },
  { key: "cancellationReasons", label: "Cancellation Reasons", description: "Case cancellation tracking codes", count: 8, icon: "✕" },
  { key: "complexities", label: "Complexity Tiers", description: "Surgical complexity classifications", count: 4, icon: "📊" },
];

const OPERATIONAL_TEMPLATES = [
  { key: "costCategories", label: "Cost Categories", description: "Financial cost tracking categories", count: 6, icon: "💰" },
  { key: "payers", label: "Payer Templates", description: "Insurance payer configurations", count: 14, icon: "🏥" },
  { key: "implantCompanies", label: "Implant Companies", description: "Medical device vendor directory", count: 22, icon: "🦴" },
  { key: "checklistFields", label: "Pre-Op Checklist Fields", description: "Pre-operative checklist templates", count: 16, icon: "☑️" },
  { key: "flagRules", label: "Flag Rules", description: "Automated alert rule templates", count: 5, icon: "🚩" },
  { key: "analyticsSettings", label: "Analytics Settings", description: "Default analytics configurations", count: 1, icon: "📈" },
  { key: "phaseDefinitions", label: "Phase Definitions", description: "Surgical phase time boundaries", count: 6, icon: "⏳" },
  { key: "notificationSettings", label: "Notification Settings", description: "Default notification preferences", count: 1, icon: "🔔" },
];

// ============================================================================
// MAIN WIZARD COMPONENT
// ============================================================================
export default function FacilityWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [animatingStep, setAnimatingStep] = useState(false);

  // Form state
  const [facility, setFacility] = useState({
    name: "", type: "asc", address: "", city: "", state: "", zip: "",
    phone: "", timezone: "America/New_York", orCount: "2", npi: "",
  });
  const [admin, setAdmin] = useState({
    firstName: "", lastName: "", email: "", role: "facility_admin", sendWelcome: true,
  });
  const [clinicalToggles, setClinicalToggles] = useState(
    Object.fromEntries(CLINICAL_TEMPLATES.map(t => [t.key, true]))
  );
  const [operationalToggles, setOperationalToggles] = useState(
    Object.fromEntries(OPERATIONAL_TEMPLATES.map(t => [t.key, true]))
  );

  // Validation
  const isStep1Valid = facility.name && facility.city && facility.state && facility.zip && facility.phone;
  const isStep2Valid = admin.firstName && admin.lastName && admin.email?.includes("@");

  const canAdvance = (step) => {
    if (step === 1) return isStep1Valid;
    if (step === 2) return isStep2Valid;
    return true;
  };

  const goToStep = useCallback((step) => {
    if (step === currentStep) return;
    setAnimatingStep(true);
    setTimeout(() => {
      setCurrentStep(step);
      setAnimatingStep(false);
    }, 150);
  }, [currentStep]);

  const goNext = () => {
    if (currentStep < 5 && canAdvance(currentStep)) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      goToStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  };

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 2200);
  };

  if (submitted) {
    return <SuccessScreen facilityName={facility.name} onReset={() => { setSubmitted(false); setCurrentStep(1); setCompletedSteps(new Set()); setFacility({ name: "", type: "asc", address: "", city: "", state: "", zip: "", phone: "", timezone: "America/New_York", orCount: "2", npi: "" }); setAdmin({ firstName: "", lastName: "", email: "", role: "facility_admin", sendWelcome: true }); setClinicalToggles(Object.fromEntries(CLINICAL_TEMPLATES.map(t => [t.key, true]))); setOperationalToggles(Object.fromEntries(OPERATIONAL_TEMPLATES.map(t => [t.key, true]))); }} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fb", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Top bar */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e8eaed", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #1a6bff, #0052d9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>O</span>
          </div>
          <span style={{ fontSize: 14, color: "#8b8fa3", fontWeight: 500 }}>
            Admin <span style={{ margin: "0 6px", color: "#d0d3db" }}>/</span> Facilities <span style={{ margin: "0 6px", color: "#d0d3db" }}>/</span> <span style={{ color: "#1a1d26" }}>New</span>
          </span>
        </div>
        <button style={{ background: "none", border: "1px solid #e0e3eb", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "#5f6478", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Icons.X size={14} /> Cancel
        </button>
      </header>

      <div style={{ display: "flex", maxWidth: 1120, margin: "0 auto", padding: "32px 24px", gap: 32 }}>
        {/* ================================================================ */}
        {/* SIDEBAR NAVIGATION                                               */}
        {/* ================================================================ */}
        <aside style={{ width: 264, flexShrink: 0 }}>
          <div style={{ position: "sticky", top: 32 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8b8fa3", marginBottom: 16, paddingLeft: 12 }}>
              Setup Steps
            </p>
            <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {STEPS.map((step) => {
                const isActive = step.id === currentStep;
                const isCompleted = completedSteps.has(step.id);
                const isAccessible = step.id <= Math.max(currentStep, ...completedSteps, 0) + 1;
                const StepIcon = step.icon;

                return (
                  <button
                    key={step.id}
                    onClick={() => isAccessible && goToStep(step.id)}
                    disabled={!isAccessible}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                      borderRadius: 10, border: "none", cursor: isAccessible ? "pointer" : "default",
                      background: isActive ? "#f0f4ff" : "transparent",
                      transition: "all 0.15s ease",
                      opacity: isAccessible ? 1 : 0.4,
                      textAlign: "left",
                    }}
                    onMouseEnter={e => { if (!isActive && isAccessible) e.currentTarget.style.background = "#f3f4f8"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                      background: isCompleted ? "#10b981" : isActive ? "#1a6bff" : "#e8eaed",
                      color: isCompleted || isActive ? "#fff" : "#8b8fa3",
                      transition: "all 0.2s ease", flexShrink: 0,
                    }}>
                      {isCompleted ? <Icons.Check size={15} /> : <StepIcon size={16} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 13.5, fontWeight: isActive ? 600 : 500,
                        color: isActive ? "#1a6bff" : "#1a1d26",
                        lineHeight: 1.3,
                      }}>{step.label}</div>
                      <div style={{ fontSize: 11.5, color: "#8b8fa3", lineHeight: 1.3, marginTop: 1 }}>
                        {step.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Provision summary */}
            <div style={{ marginTop: 28, padding: "16px 14px", background: "#fff", borderRadius: 12, border: "1px solid #e8eaed" }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8b8fa3", marginBottom: 10 }}>
                Provision Summary
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <SummaryRow label="Clinical templates" value={`${Object.values(clinicalToggles).filter(Boolean).length}/${CLINICAL_TEMPLATES.length}`} />
                <SummaryRow label="Operational configs" value={`${Object.values(operationalToggles).filter(Boolean).length}/${OPERATIONAL_TEMPLATES.length}`} />
                <SummaryRow label="Welcome email" value={admin.sendWelcome ? "Enabled" : "Disabled"} />
              </div>
            </div>
          </div>
        </aside>

        {/* ================================================================ */}
        {/* MAIN CONTENT                                                      */}
        {/* ================================================================ */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            opacity: animatingStep ? 0 : 1,
            transform: animatingStep ? "translateY(8px)" : "translateY(0)",
            transition: "all 0.2s ease",
          }}>
            {currentStep === 1 && <Step1Facility data={facility} onChange={setFacility} />}
            {currentStep === 2 && <Step2Admin data={admin} onChange={setAdmin} />}
            {currentStep === 3 && <Step3Clinical toggles={clinicalToggles} setToggles={setClinicalToggles} />}
            {currentStep === 4 && <Step4Operational toggles={operationalToggles} setToggles={setOperationalToggles} />}
            {currentStep === 5 && (
              <Step5Review
                facility={facility} admin={admin}
                clinicalToggles={clinicalToggles} operationalToggles={operationalToggles}
                onEdit={goToStep}
              />
            )}
          </div>

          {/* Footer nav */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 28, padding: "20px 0", borderTop: "1px solid #e8eaed",
          }}>
            <button
              onClick={currentStep > 1 ? goBack : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "none", border: "1px solid #e0e3eb", borderRadius: 8,
                padding: "8px 18px", fontSize: 13.5, fontWeight: 500,
                color: "#5f6478", cursor: "pointer",
                opacity: currentStep === 1 ? 0.4 : 1,
                pointerEvents: currentStep === 1 ? "none" : "auto",
              }}
            >
              <Icons.ChevronLeft size={15} /> Back
            </button>

            {currentStep < 5 ? (
              <button
                onClick={goNext}
                disabled={!canAdvance(currentStep)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: canAdvance(currentStep) ? "linear-gradient(135deg, #1a6bff, #0052d9)" : "#e0e3eb",
                  color: canAdvance(currentStep) ? "#fff" : "#a0a5b8",
                  border: "none", borderRadius: 8, padding: "9px 22px",
                  fontSize: 13.5, fontWeight: 600, cursor: canAdvance(currentStep) ? "pointer" : "default",
                  boxShadow: canAdvance(currentStep) ? "0 2px 8px rgba(26,107,255,0.25)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                Continue <Icons.ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: submitting ? "#94b8ff" : "linear-gradient(135deg, #10b981, #059669)",
                  color: "#fff", border: "none", borderRadius: 8, padding: "9px 26px",
                  fontSize: 13.5, fontWeight: 600, cursor: submitting ? "wait" : "pointer",
                  boxShadow: "0 2px 8px rgba(16,185,129,0.25)",
                  transition: "all 0.2s ease",
                }}
              >
                {submitting ? (
                  <>
                    <span className="spin-icon"><Icons.Loader size={16} /></span> Provisioning…
                  </>
                ) : (
                  <><Icons.Check size={16} /> Create Facility</>
                )}
              </button>
            )}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin-icon { display: inline-flex; animation: spin 1s linear infinite; }
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #1a6bff !important;
          box-shadow: 0 0 0 3px rgba(26,107,255,0.1) !important;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .fadein { animation: fadeInUp 0.4s ease forwards; }
        .scalein { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}

// ============================================================================
// SHARED UI COMPONENTS
// ============================================================================
function SummaryRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
      <span style={{ color: "#5f6478" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#1a1d26", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{value}</span>
    </div>
  );
}

function SectionCard({ children, title, subtitle, badge }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8eaed", overflow: "hidden" }}>
      {title && (
        <div style={{ padding: "22px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "#1a1d26", lineHeight: 1.3 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 13, color: "#8b8fa3", marginTop: 3 }}>{subtitle}</p>}
          </div>
          {badge}
        </div>
      )}
      <div style={{ padding: title ? "20px 28px 28px" : "28px" }}>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, required, hint, error, children, style: customStyle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, ...customStyle }}>
      <label style={{ fontSize: 12.5, fontWeight: 500, color: "#3d4152" }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {children}
      {hint && !error && <span style={{ fontSize: 11.5, color: "#8b8fa3" }}>{hint}</span>}
      {error && <span style={{ fontSize: 11.5, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}><Icons.AlertCircle size={12} />{error}</span>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", style: s, ...props }) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", padding: "9px 13px", fontSize: 13.5, borderRadius: 8,
        border: "1px solid #dde0e8", background: "#fafbfc", color: "#1a1d26",
        transition: "all 0.15s ease", fontFamily: "inherit", ...s,
      }}
      {...props}
    />
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", padding: "9px 13px", fontSize: 13.5, borderRadius: 8,
        border: "1px solid #dde0e8", background: "#fafbfc", color: value ? "#1a1d26" : "#8b8fa3",
        transition: "all 0.15s ease", fontFamily: "inherit", appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b8fa3' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5, color: "#3d4152" }}>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 11, border: "none", padding: 2,
          background: checked ? "#1a6bff" : "#d0d3db", cursor: "pointer",
          transition: "background 0.2s ease", position: "relative", flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: 9, background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transform: checked ? "translateX(18px)" : "translateX(0)",
          transition: "transform 0.2s ease",
        }} />
      </button>
      {label}
    </label>
  );
}

// ============================================================================
// STEP 1: FACILITY DETAILS
// ============================================================================
function Step1Facility({ data, onChange }) {
  const update = (field, value) => onChange({ ...data, [field]: value });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionCard title="Facility Information" subtitle="Core identity and classification">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <FormField label="Facility Name" required style={{ gridColumn: "1 / -1" }}>
            <Input value={data.name} onChange={v => update("name", v)} placeholder="e.g. Riverwalk Surgery Center" />
          </FormField>
          <FormField label="Facility Type" required>
            <Select value={data.type} onChange={v => update("type", v)} options={FACILITY_TYPES} />
          </FormField>
          <FormField label="NPI Number" hint="10-digit National Provider Identifier">
            <Input value={data.npi} onChange={v => update("npi", v)} placeholder="1234567890" maxLength={10} style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Location & Contact" subtitle="Physical address and operating details">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <FormField label="Street Address" style={{ gridColumn: "1 / -1" }}>
            <Input value={data.address} onChange={v => update("address", v)} placeholder="123 Medical Dr, Suite 200" />
          </FormField>
          <FormField label="City" required>
            <Input value={data.city} onChange={v => update("city", v)} placeholder="City" />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="State" required>
              <Select value={data.state} onChange={v => update("state", v)} options={US_STATES} placeholder="State" />
            </FormField>
            <FormField label="ZIP" required>
              <Input value={data.zip} onChange={v => update("zip", v)} placeholder="33901" maxLength={10} />
            </FormField>
          </div>
          <FormField label="Phone" required>
            <Input value={data.phone} onChange={v => update("phone", v)} placeholder="(239) 555-0100" />
          </FormField>
          <FormField label="Timezone">
            <Select value={data.timezone} onChange={v => update("timezone", v)} options={TIMEZONES} />
          </FormField>
          <FormField label="Number of ORs" hint="Operating rooms at this facility">
            <Input type="number" value={data.orCount} onChange={v => update("orCount", v)} placeholder="2" min="1" max="50" />
          </FormField>
        </div>
      </SectionCard>
    </div>
  );
}

// ============================================================================
// STEP 2: ADMINISTRATOR
// ============================================================================
function Step2Admin({ data, onChange }) {
  const update = (field, value) => onChange({ ...data, [field]: value });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionCard title="Initial Administrator" subtitle="This user will have full facility admin access">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <FormField label="First Name" required>
            <Input value={data.firstName} onChange={v => update("firstName", v)} placeholder="Jane" />
          </FormField>
          <FormField label="Last Name" required>
            <Input value={data.lastName} onChange={v => update("lastName", v)} placeholder="Smith" />
          </FormField>
          <FormField label="Email Address" required style={{ gridColumn: "1 / -1" }}>
            <Input type="email" value={data.email} onChange={v => update("email", v)} placeholder="jane.smith@facility.com" />
          </FormField>
          <FormField label="Role" style={{ gridColumn: "1 / -1" }}>
            <Select value={data.role} onChange={v => update("role", v)} options={[
              { value: "facility_admin", label: "Facility Admin — Full access" },
              { value: "charge_nurse", label: "Charge Nurse — Clinical operations" },
              { value: "viewer", label: "Viewer — Read-only analytics" },
            ]} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a6bff" }}>
              <Icons.Mail size={18} />
            </div>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 500, color: "#1a1d26" }}>Send Welcome Email</p>
              <p style={{ fontSize: 12, color: "#8b8fa3" }}>Invite the admin to set up their account immediately</p>
            </div>
          </div>
          <Toggle checked={data.sendWelcome} onChange={v => update("sendWelcome", v)} />
        </div>
      </SectionCard>
    </div>
  );
}

// ============================================================================
// STEP 3: CLINICAL TEMPLATES
// ============================================================================
function Step3Clinical({ toggles, setToggles }) {
  const allOn = Object.values(toggles).every(Boolean);
  const toggleAll = () => {
    const newVal = !allOn;
    setToggles(Object.fromEntries(Object.keys(toggles).map(k => [k, newVal])));
  };

  return (
    <SectionCard
      title="Clinical Templates"
      subtitle="Select which clinical configurations to provision"
      badge={
        <button onClick={toggleAll} style={{
          fontSize: 12, fontWeight: 500, color: "#1a6bff", background: "#f0f4ff",
          border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer",
        }}>
          {allOn ? "Deselect All" : "Select All"}
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {CLINICAL_TEMPLATES.map((t, i) => (
          <TemplateRow
            key={t.key} template={t}
            checked={toggles[t.key]}
            onChange={() => setToggles({ ...toggles, [t.key]: !toggles[t.key] })}
            index={i}
          />
        ))}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// STEP 4: OPERATIONAL TEMPLATES
// ============================================================================
function Step4Operational({ toggles, setToggles }) {
  const allOn = Object.values(toggles).every(Boolean);
  const toggleAll = () => {
    const newVal = !allOn;
    setToggles(Object.fromEntries(Object.keys(toggles).map(k => [k, newVal])));
  };

  return (
    <SectionCard
      title="Operational Configuration"
      subtitle="Financial, analytics, and notification defaults"
      badge={
        <button onClick={toggleAll} style={{
          fontSize: 12, fontWeight: 500, color: "#1a6bff", background: "#f0f4ff",
          border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer",
        }}>
          {allOn ? "Deselect All" : "Select All"}
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {OPERATIONAL_TEMPLATES.map((t, i) => (
          <TemplateRow
            key={t.key} template={t}
            checked={toggles[t.key]}
            onChange={() => setToggles({ ...toggles, [t.key]: !toggles[t.key] })}
            index={i}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function TemplateRow({ template, checked, onChange, index }) {
  return (
    <button
      onClick={onChange}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderRadius: 10, border: "none",
        background: checked ? "#f7f9ff" : "transparent",
        cursor: "pointer", transition: "all 0.15s ease",
        textAlign: "left", width: "100%",
      }}
      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "#f8f9fb"; }}
      onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 5, border: checked ? "none" : "2px solid #d0d3db",
          background: checked ? "#1a6bff" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s ease", flexShrink: 0,
        }}>
          {checked && <Icons.Check size={13} style={{ color: "#fff" }} />}
        </div>
        <span style={{ fontSize: 17, marginRight: 4 }}>{template.icon}</span>
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 500, color: "#1a1d26" }}>{template.label}</p>
          <p style={{ fontSize: 12, color: "#8b8fa3" }}>{template.description}</p>
        </div>
      </div>
      <span style={{
        fontSize: 12, fontWeight: 600, color: checked ? "#1a6bff" : "#8b8fa3",
        background: checked ? "#e8eeff" : "#f3f4f8", borderRadius: 6,
        padding: "3px 10px", fontFamily: "'JetBrains Mono', monospace",
        transition: "all 0.15s ease",
      }}>
        {template.count}
      </span>
    </button>
  );
}

// ============================================================================
// STEP 5: REVIEW
// ============================================================================
function Step5Review({ facility, admin, clinicalToggles, operationalToggles, onEdit }) {
  const enabledClinical = CLINICAL_TEMPLATES.filter(t => clinicalToggles[t.key]);
  const enabledOperational = OPERATIONAL_TEMPLATES.filter(t => operationalToggles[t.key]);
  const totalItems = enabledClinical.reduce((s, t) => s + t.count, 0) + enabledOperational.reduce((s, t) => s + t.count, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Provision overview */}
      <div style={{
        background: "linear-gradient(135deg, #f0f4ff, #e8f4f8)", borderRadius: 14,
        border: "1px solid #d4dff7", padding: "22px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1d26" }}>Ready to provision</p>
          <p style={{ fontSize: 13, color: "#5f6478", marginTop: 2 }}>
            {enabledClinical.length + enabledOperational.length} template groups · {totalItems} total items
          </p>
        </div>
        <div style={{
          background: "#fff", borderRadius: 10, padding: "8px 16px",
          border: "1px solid #d4dff7", display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#10b981" }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1a1d26" }}>All validations passed</span>
        </div>
      </div>

      {/* Facility summary */}
      <ReviewSection title="Facility Details" stepNum={1} onEdit={() => onEdit(1)}>
        <ReviewGrid items={[
          { label: "Name", value: facility.name },
          { label: "Type", value: FACILITY_TYPES.find(t => t.value === facility.type)?.label },
          { label: "Location", value: `${facility.city}, ${facility.state} ${facility.zip}` },
          { label: "Phone", value: facility.phone },
          { label: "Timezone", value: TIMEZONES.find(t => t.value === facility.timezone)?.label },
          { label: "ORs", value: facility.orCount },
        ]} />
      </ReviewSection>

      <ReviewSection title="Administrator" stepNum={2} onEdit={() => onEdit(2)}>
        <ReviewGrid items={[
          { label: "Name", value: `${admin.firstName} ${admin.lastName}` },
          { label: "Email", value: admin.email },
          { label: "Role", value: admin.role.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()) },
          { label: "Welcome email", value: admin.sendWelcome ? "Enabled" : "Disabled" },
        ]} />
      </ReviewSection>

      <ReviewSection title="Clinical Templates" stepNum={3} onEdit={() => onEdit(3)}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {enabledClinical.map(t => (
            <span key={t.key} style={{
              fontSize: 12, padding: "4px 10px", borderRadius: 6,
              background: "#f0f4ff", color: "#1a6bff", fontWeight: 500,
            }}>
              {t.icon} {t.label} ({t.count})
            </span>
          ))}
          {enabledClinical.length === 0 && <span style={{ fontSize: 13, color: "#8b8fa3", fontStyle: "italic" }}>None selected</span>}
        </div>
      </ReviewSection>

      <ReviewSection title="Operational Config" stepNum={4} onEdit={() => onEdit(4)}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {enabledOperational.map(t => (
            <span key={t.key} style={{
              fontSize: 12, padding: "4px 10px", borderRadius: 6,
              background: "#f0faf5", color: "#059669", fontWeight: 500,
            }}>
              {t.icon} {t.label} ({t.count})
            </span>
          ))}
          {enabledOperational.length === 0 && <span style={{ fontSize: 13, color: "#8b8fa3", fontStyle: "italic" }}>None selected</span>}
        </div>
      </ReviewSection>
    </div>
  );
}

function ReviewSection({ title, stepNum, onEdit, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8eaed", padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#8b8fa3", background: "#f3f4f8",
            borderRadius: 5, padding: "2px 7px", fontFamily: "'JetBrains Mono', monospace",
          }}>
            {stepNum}
          </span>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1a1d26" }}>{title}</h3>
        </div>
        <button
          onClick={onEdit}
          style={{
            display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500,
            color: "#1a6bff", background: "none", border: "none", cursor: "pointer",
            padding: "4px 8px", borderRadius: 6,
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#f0f4ff"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        >
          <Icons.Pencil size={12} /> Edit
        </button>
      </div>
      {children}
    </div>
  );
}

function ReviewGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 20px" }}>
      {items.filter(i => i.value).map(item => (
        <div key={item.label}>
          <p style={{ fontSize: 11.5, color: "#8b8fa3", marginBottom: 2 }}>{item.label}</p>
          <p style={{ fontSize: 13.5, fontWeight: 500, color: "#1a1d26" }}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SUCCESS SCREEN
// ============================================================================
function SuccessScreen({ facilityName, onReset }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#f8f9fb", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div className="scalein" style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: "0 auto 24px",
          background: "linear-gradient(135deg, #10b981, #059669)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 32px rgba(16,185,129,0.3)",
        }}>
          <Icons.Check size={36} style={{ color: "#fff" }} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1d26", marginBottom: 8 }}>
          Facility Created
        </h1>
        <p style={{ fontSize: 15, color: "#5f6478", lineHeight: 1.6, marginBottom: 32 }}>
          <strong>{facilityName}</strong> has been provisioned with all selected templates.
          The admin invite has been sent.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={onReset}
            style={{
              padding: "10px 22px", fontSize: 14, fontWeight: 600, borderRadius: 10,
              border: "1px solid #e0e3eb", background: "#fff", color: "#3d4152", cursor: "pointer",
            }}
          >
            Create Another
          </button>
          <button style={{
            padding: "10px 22px", fontSize: 14, fontWeight: 600, borderRadius: 10,
            border: "none", background: "linear-gradient(135deg, #1a6bff, #0052d9)", color: "#fff",
            cursor: "pointer", boxShadow: "0 2px 8px rgba(26,107,255,0.25)",
          }}>
            View Facility →
          </button>
        </div>
      </div>
    </div>
  );
}
