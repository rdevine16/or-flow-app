# Component Inventory — ORbit Codebase Audit (Report 01 of 08)

## Overall Metrics

| Metric | Web (components/) | Web (app/) | iOS | Total |
|--------|-------------------|------------|-----|-------|
| Files | 217 .tsx | 192 .tsx | 106 .swift | 515 |
| LOC | ~56,150 | ~57,127 | ~15,000+ | ~128,000+ |
| Components/Views | 350+ exports | 87 pages + helpers | 140+ View structs | 575+ |
| Barrel files | 4 | 0 | 0 | 4 |

### Severity Breakdown (Web components/)

| Severity | Count | Criteria |
|----------|-------|----------|
| :red_circle: RED | 23 files | 500+ LOC or 10+ exports |
| :yellow_circle: YELLOW | 53 files | 200-500 LOC or 5-10 exports |
| :green_circle: GREEN | 141 files | <200 LOC and <5 exports |

### Severity Breakdown (iOS)

| Severity | Count | Criteria |
|----------|-------|----------|
| :red_circle: RED | 15 files | 500+ LOC or 3+ View structs |
| :yellow_circle: YELLOW | ~21 files | 200-500 LOC or 2 View structs |
| :green_circle: GREEN | ~50+ files | <200 LOC and 1 View struct |

---

## Web Components — By Directory

### Root Level (8 files, 2,601 LOC)

| File | LOC | Exports | Props | Severity | Barrel |
|------|-----|---------|-------|----------|--------|
| `CallNextPatientModal.tsx` | 818 | 1 | 1 | :red_circle: | No |
| `GlobalSearch.tsx` | 518 | 1 | 1 | :red_circle: | No |
| `InviteUserModal.tsx` | 353 | 1 | 1 | :yellow_circle: | No |
| `EnhancedIssueCard.tsx` | 272 | 1 | 0 | :yellow_circle: | No |
| `FacilityLogoUpload.tsx` | 248 | 1 | 1 | :yellow_circle: | No |
| `ErrorBoundary.tsx` | 202 | 3 | 2 | :yellow_circle: | No |
| `FeatureGate.tsx` | 158 | 2 | 1 | :green_circle: | No |
| `OfflineBanner.tsx` | 32 | 1 | 0 | :green_circle: | No |

### analytics/ (17 files, 4,727 LOC)

| File | LOC | Exports | Props | Severity |
|------|-----|---------|-------|----------|
| `AnalyticsComponents.tsx` | 2,193 | 37 | 24 | :red_circle: CRITICAL |
| `InsightPanelCallback.tsx` | 451 | 1 | 1 | :yellow_circle: |
| `FlagsSummaryCard.tsx` | 346 | 1 | 1 | :yellow_circle: |
| `InsightPanelFCOTS.tsx` | 330 | 1 | 1 | :yellow_circle: |
| `InsightPanelScheduling.tsx` | 270 | 1 | 1 | :yellow_circle: |
| `InsightPanelNonOpTime.tsx` | 240 | 1 | 1 | :yellow_circle: |
| `InsightPanelTurnover.tsx` | 236 | 1 | 1 | :yellow_circle: |
| `InsightPanelCancellation.tsx` | 208 | 1 | 1 | :yellow_circle: |
| `InsightSlideOver.tsx` | 188 | 1 | 1 | :green_circle: |
| `InsightPanelUtilization.tsx` | 142 | 1 | 1 | :green_circle: |
| `ProcedureMixCard.tsx` | 112 | 1 | 1 | :green_circle: |
| `Tracker.tsx` | 94 | 5 | 2 | :green_circle: |
| `RoomUtilizationCard.tsx` | 88 | 1 | 1 | :green_circle: |
| `RecentCasesTable.tsx` | 86 | 2 | 1 | :green_circle: |
| `SurgeonLeaderboardTable.tsx` | 81 | 1 | 1 | :green_circle: |
| `FlagsCompactBanner.tsx` | 64 | 1 | 1 | :green_circle: |
| `AnalyticsBreadcrumb.tsx` | 28 | 1 | 1 | :green_circle: |

### analytics/financials/ (11 files, 4,945 LOC)

| File | LOC | Exports | Props | Severity | Barrel |
|------|-----|---------|-------|----------|--------|
| `SurgeonDetail.tsx` | 1,305 | 1 | 1 | :red_circle: | Yes |
| `ProcedureDetail.tsx` | 1,197 | 1 | 1 | :red_circle: | Yes |
| `OverviewTab.tsx` | 853 | 1 | 1 | :red_circle: | Yes |
| `SurgeonDailyActivity.tsx` | 381 | 1 | 1 | :yellow_circle: | No |
| `SurgeonTab.tsx` | 232 | 1 | 1 | :yellow_circle: | Yes |
| `ProcedureTab.tsx` | 205 | 1 | 1 | :yellow_circle: | Yes |
| `SurgeonByProcedure.tsx` | 189 | 1 | 1 | :green_circle: | No |
| `CaseEconomicsCard.tsx` | 172 | 1 | 1 | :green_circle: | Yes |
| `SurgeonHero.tsx` | 150 | 1 | 1 | :green_circle: | Yes |
| `WaterfallChart.tsx` | 147 | 1 | 1 | :green_circle: | No |
| `PayerMixCard.tsx` | 146 | 1 | 1 | :green_circle: | Yes |

### analytics/financials/shared/ (12 files, 420 LOC) — All barrel-exported

| File | LOC | Component |
|------|-----|-----------|
| `AnimatedNumber.tsx` | 65 | AnimatedNumber |
| `ComparisonPill.tsx` | 49 | ComparisonPill |
| `SortTH.tsx` | 43 | SortTH |
| `Sparkline.tsx` | 37 | Sparkline |
| `SparklineLight.tsx` | 36 | SparklineLight |
| `MicroBar.tsx` | 32 | MicroBar |
| `PhasePill.tsx` | 30 | PhasePill |
| `InfoTip.tsx` | 29 | InfoTip |
| `ConsistencyBadge.tsx` | 26 | ConsistencyBadge |
| `MarginBadge.tsx` | 25 | MarginBadge |
| `RankBadge.tsx` | 24 | RankBadge |
| `MarginDot.tsx` | 24 | MarginDot |

### analytics/flags/ (10 files, 1,545 LOC)

| File | LOC | Severity |
|------|-----|----------|
| `FlagDrillThrough.tsx` | 412 | :yellow_circle: |
| `SurgeonFlagTable.tsx` | 202 | :yellow_circle: |
| `DayHeatmap.tsx` | 150 | :green_circle: |
| `FlagTrendChart.tsx` | 145 | :green_circle: |
| `FlagKPICard.tsx` | 125 | :green_circle: |
| `RecentFlaggedCases.tsx` | 111 | :green_circle: |
| `HorizontalBarList.tsx` | 107 | :green_circle: |
| `SeverityStrip.tsx` | 106 | :green_circle: |
| `RoomAnalysisCards.tsx` | 94 | :green_circle: |
| `PatternInsightCards.tsx` | 93 | :green_circle: |

### block-schedule/ (6 files, 2,122 LOC)

| File | LOC | Severity |
|------|-----|----------|
| `BlockPopover.tsx` | 590 | :red_circle: |
| `WeekCalendar.tsx` | 568 | :red_circle: |
| `CustomRecurrenceModal.tsx` | 335 | :yellow_circle: |
| `BlockSidebar.tsx` | 332 | :yellow_circle: |
| `DeleteBlockModal.tsx` | 165 | :green_circle: |
| `BlockCard.tsx` | 132 | :green_circle: |

### cases/ (37 files, 11,656 LOC) — Largest directory by LOC

| File | LOC | Exports | Severity |
|------|-----|---------|----------|
| `CaseForm.tsx` | 1,856 | 1 | :red_circle: |
| `CompletedCaseView.tsx` | 1,068 | 1 | :red_circle: |
| `CasesTable.tsx` | 767 | 1 | :red_circle: |
| `CaseFlagsSection.tsx` | 693 | 1 | :red_circle: |
| `CaseDrawerFinancials.tsx` | 683 | 1 | :red_circle: |
| `CasesFilterBar.tsx` | 569 | 1 | :red_circle: |
| `MilestoneDetailRow.tsx` | 549 | 2 | :red_circle: |
| `CaseSummary.tsx` | 530 | 1 | :red_circle: |
| `MilestoneTimelineV2.tsx` | 495 | 1 | :yellow_circle: |
| `ImplantSection.tsx` | 469 | 1 | :yellow_circle: |
| `DeviceRepSection.tsx` | 432 | 1 | :yellow_circle: |
| `CaseDrawer.tsx` | 416 | 1 | :yellow_circle: |
| `StaffMultiSelect.tsx` | 302 | 1 | :yellow_circle: |
| `CaseHistoryTimeline.tsx` | 294 | 1 | :yellow_circle: |
| `CancelCaseModal.tsx` | 264 | 1 | :yellow_circle: |
| `MilestoneTimeline.tsx` | 245 | 1 | :yellow_circle: |
| `ImplantCompanySelect.tsx` | 242 | 1 | :yellow_circle: |
| `MilestoneCard.tsx` | 199 | 1 | :green_circle: |
| `CaseDrawerMilestones.tsx` | 199 | 1 | :green_circle: |
| `TimerChip.tsx` | 198 | 2 | :green_circle: |
| `CaseActivitySummary.tsx` | 181 | 1 | :green_circle: |
| `IncompleteCaseModal.tsx` | 170 | 1 | :green_circle: |
| `SurgeonPreferenceSelect.tsx` | 168 | 1 | :green_circle: |
| `AddDelayForm.tsx` | 161 | 1 | :green_circle: |
| `CaseComplexitySelector.tsx` | 155 | 1 | :green_circle: |
| `FlipRoomCard.tsx` | 125 | 1 | :green_circle: |
| `CaseDrawerValidation.tsx` | 120 | 1 | :green_circle: |
| `CaseDrawerFlags.tsx` | 99 | 1 | :green_circle: |
| `CasesStatusTabs.tsx` | 89 | 1 | :green_circle: |
| `CaseImplantCompanies.tsx` | 87 | 2 | :green_circle: |
| `CaseDrawerHistory.tsx` | 80 | 1 | :green_circle: |
| `MilestoneComparisonToggle.tsx` | 77 | 1 | :green_circle: |
| `TimeAllocationBar.tsx` | 75 | 1 | :green_circle: |
| `DelayNode.tsx` | 63 | 1 | :green_circle: |
| `TeamMember.tsx` | 53 | 1 | :green_circle: |
| `FlagBadge.tsx` | 36 | 1 | :green_circle: |
| `ImplantBadge.tsx` | 15 | 1 | :green_circle: |

### dashboard/ (21 files, 3,980 LOC)

| File | LOC | Severity |
|------|-----|----------|
| `ScheduleAdherenceTimeline.tsx` | 567 | :red_circle: |
| `EnhancedRoomCard.tsx` | 549 | :red_circle: |
| `CaseListView.tsx` | 345 | :yellow_circle: |
| `RoomOrderModal.tsx` | 320 | :yellow_circle: |
| `StaffAssignmentPanel.tsx` | 223 | :yellow_circle: |
| `RoomGridView.tsx` | 218 | :yellow_circle: |
| `TrendChart.tsx` | 185 | :green_circle: |
| `NeedsAttention.tsx` | 170 | :green_circle: |
| `DashboardKpiCard.tsx` | 158 | :green_circle: |
| `InsightsSection.tsx` | 134 | :green_circle: |
| `PaceProgressBar.tsx` | 118 | :green_circle: |
| `EnhancedRoomGridView.tsx` | 117 | :green_circle: |
| `LivePulseBanner.tsx` | 112 | :green_circle: |
| `RoomStatusCard.tsx` | 110 | :green_circle: |
| `InsightCard.tsx` | 106 | :green_circle: |
| `TodaysSurgeons.tsx` | 106 | :green_circle: |
| `QuickAccessCards.tsx` | 96 | :green_circle: |
| `DroppableCaseRow.tsx` | 80 | :green_circle: |
| `FacilityScoreMini.tsx` | 74 | :green_circle: |
| `FacilityScoreCard.tsx` | 73 | :green_circle: |
| `StaffDragOverlay.tsx` | 36 | :green_circle: |

### data-quality/ (10 files, 2,786 LOC)

| File | LOC | Severity |
|------|-----|----------|
| `DataQualityPage.tsx` | 1,460 | :red_circle: |
| `IssuesTable.tsx` | 349 | :yellow_circle: |
| `ReviewDrawer.tsx` | 287 | :yellow_circle: |
| `MilestoneTimeline.tsx` | 281 | :yellow_circle: |
| `FilterBar.tsx` | 108 | :green_circle: |
| `SummaryRow.tsx` | 86 | :green_circle: |
| `QualityGauge.tsx` | 71 | :green_circle: |
| `ScanProgress.tsx` | 70 | :green_circle: |
| `SeverityBadge.tsx` | 50 | :green_circle: |
| `IssueChip.tsx` | 24 | :green_circle: |

### integrations/ (9 files, 2,631 LOC)

| File | LOC | Exports | Severity |
|------|-----|---------|----------|
| `ReviewDetailPanel.tsx` | 1,152 | 4 | :red_circle: |
| `IntegrationOverviewTab.tsx` | 269 | 1 | :yellow_circle: |
| `IntegrationReviewQueueTab.tsx` | 257 | 1 | :yellow_circle: |
| `ImportReviewDrawer.tsx` | 207 | 1 | :yellow_circle: |
| `HL7MessageViewer.tsx` | 201 | 1 | :yellow_circle: |
| `IntegrationLogsTab.tsx` | 198 | 1 | :green_circle: |
| `SetupInstructionsCard.tsx` | 159 | 1 | :green_circle: |
| `IntegrationMappingsTab.tsx` | 142 | 1 | :green_circle: |
| `SwitchIntegrationDialog.tsx` | 53 | 1 | :green_circle: |

### settings/ (31 files, 7,578 LOC)

| File | LOC | Severity |
|------|-----|----------|
| `milestones/TemplateBuilder.tsx` | 1,437 | :red_circle: |
| `milestones/SurgeonOverridePanel.tsx` | 695 | :red_circle: |
| `milestones/AdminPhaseLibrary.tsx` | 532 | :red_circle: |
| `procedures/ProcedureDetailPanel.tsx` | 518 | :red_circle: |
| `milestones/PhaseLibrary.tsx` | 511 | :red_circle: |
| `milestones/AdminProcedureTypeAssignment.tsx` | 507 | :red_circle: |
| `milestones/ProcedureTemplateAssignment.tsx` | 472 | :yellow_circle: |
| `milestones/TemplateTimelinePreview.tsx` | 425 | :yellow_circle: |
| `SortableList.tsx` | 363 | :yellow_circle: |
| `milestones/FlowNode.tsx` | 341 | :yellow_circle: |
| `flags/RuleConfigureStep.tsx` | 338 | :yellow_circle: |
| `procedures/SurgeonOverrideList.tsx` | 330 | :yellow_circle: |
| `milestones/SubPhaseIndicator.tsx` | 318 | :yellow_circle: |
| `AdminSettingsLayout.tsx` | 302 | :yellow_circle: |
| `milestones/TemplateList.tsx` | 264 | :yellow_circle: |
| `milestones/MilestoneFormModal.tsx` | 254 | :yellow_circle: |
| `EditableList.tsx` | 207 | :yellow_circle: |
| Remaining 14 files | 40-191 | :green_circle: |

### ui/ (45 files, 6,693 LOC) — Shared component library

| File | LOC | Exports | Barrel | Severity |
|------|-----|---------|--------|----------|
| `Tooltip.tsx` | 498 | 5 | Yes | :yellow_circle: |
| `ConfirmDialog.tsx` | 452 | 5 | Yes | :yellow_circle: |
| `CardEnhanced.tsx` | 435 | 4 | Yes | :yellow_circle: |
| `DateRangeSelector.tsx` | 374 | 4 | Yes | :yellow_circle: |
| `Toast/ToastProvider.tsx` | 369 | 3 | Yes | :yellow_circle: |
| `StaffAvatar.tsx` | 312 | 4 | No | :yellow_circle: |
| `Modal.tsx` | 283 | 1 | Yes | :yellow_circle: |
| `DatePickerCalendar.tsx` | 279 | 1 | Yes | :yellow_circle: |
| `TimePicker.tsx` | 257 | 1 | No | :yellow_circle: |
| `Skeleton.tsx` | 246 | 12 | Yes | :yellow_circle: |
| `MilestoneButton.tsx` | 209 | 2 | No | :yellow_circle: |
| `MetricCard.tsx` | 187 | 3 | No | :green_circle: |
| `Input.tsx` | 163 | 5 | Yes | :green_circle: |
| `TableActions.tsx` | 161 | 1 | Yes | :green_circle: |
| `Alert.tsx` | 156 | 1 | Yes | :green_circle: |
| `StaffPopover.tsx` | 156 | 1 | No | :green_circle: |
| `FloatingActionButton.tsx` | 153 | 1 | No | :green_circle: |
| `Pagination.tsx` | 138 | 1 | No | :green_circle: |
| `EmptyState.tsx` | 137 | 2 | Yes | :green_circle: |
| `MarginGauge.tsx` | 135 | 2 | No | :green_circle: |
| `Breadcrumb.tsx` | 134 | 3 | No | :green_circle: |
| `SearchableDropdown.tsx` | 132 | 1 | No | :green_circle: |
| `Loading.tsx` | 124 | 3 | Yes | :green_circle: |
| `SearchInput.tsx` | 119 | 1 | Yes | :green_circle: |
| `Sparkline.tsx` | 119 | 2 | No | :green_circle: |
| `DateFilter.tsx` | 118 | 1 | No | :green_circle: |
| `Button.tsx` | 118 | 2 | Yes | :green_circle: |
| `StatusBadge.tsx` | 94 | 2 | Yes | :green_circle: |
| Remaining 17 files | 11-83 | — | Mixed | :green_circle: |

### Smaller directories

| Directory | Files | LOC | Notable |
|-----------|-------|-----|---------|
| filters/ | 1 | 825 | CaseFilterBar.tsx :red_circle: |
| pip/ | 2 | 700 | PiPMilestonePanel.tsx :red_circle: |
| global/ | 4 | 647 | Notification system |
| profile/ | 1 | 371 | ProfileImageUpload :yellow_circle: |
| layouts/ | 6 | 1,382 | DashboardLayout, Header, Sidebar |
| permissions/ | 2 | 274 | PermissionMatrix :yellow_circle: |
| modals/ | 1 | 217 | DeleteFacilityModal :yellow_circle: |
| icons/ | 1 | 101 | OrbitLogo :green_circle: |

---

## Web Pages (app/) — Route Architecture

### Architecture Pattern
Every route follows the same RSC/Client pattern:
- `page.tsx` (~10 LOC) — Server component wrapper
- `PageClient.tsx` (varies) — `'use client'` component with all logic

**Totals:** 88 page.tsx + 87 PageClient.tsx + 3 layouts + 14 other = 192 files

### Largest PageClient Files

| Route | LOC | Helper Components |
|-------|-----|-------------------|
| `/analytics/block-utilization/` | 2,125 | 9 helpers (UtilizationTooltip, BlockDayTimeline, etc.) |
| `/cases/[id]/` | 1,693 | 0 (extracted to components/cases/) |
| `/admin/facilities/[id]/` | 1,656 | 4 helpers (StatCard, UsageBar, skeletons) |
| `/analytics/surgeons/` | 1,512 | 5 helpers (CompactStat, MiniUptimeRing, tooltips) |
| `/analytics/` | 1,313 | 7 helpers (ReportCard, QuickStatCard, tooltips) |
| `/admin/settings/hl7v2-test-harness/` | 1,308 | 6 helpers (tab panels) |
| `/admin/settings/milestones/` | 1,002 | 4 helpers (tabs, skeleton) |
| `/admin/settings/analytics/` | 954 | 2 helpers (SettingsNumberField, SectionHeader) |
| `/checkin/` | 950 | 3 helpers (CheckInRow, CheckInDetailModal) |
| `/spd/` | 939 | 1 helper (SlideoutPanel) |
| `/analytics/kpi/` | 923 | 4 helpers (StatusDot, TargetGauge, etc.) |
| `/settings/users/` | 910 | 0 |
| `/settings/analytics/` | 896 | 2 helpers (SettingsNumberField, SectionHeader) |
| `/settings/closures/` | 902 | 4 helpers (HolidayRow, ClosureRow, dialogs) |
| `/settings/milestones/` | 846 | 4 helpers (tabs, skeleton) |
| `/settings/financials/procedure-pricing/` | 842 | 0 |
| `/settings/financials/cost-categories/` | 822 | 0 |
| `/settings/flags/` | 800 | 0 |
| `/settings/integrations/epic/` | 795 | 0 |
| `/settings/integrations/cerner/` | 795 | 0 |

### Co-located Component Directories (Wizard Pattern)

| Route | Co-located Files | Total LOC |
|-------|-----------------|-----------|
| `/admin/demo/` | 7 files (DemoWizardShell + 6 steps) | 3,005 |
| `/admin/facilities/new/` | 5 files (5 steps) | 1,111 |

### Files with Most Helper Components

| Route | Helper Count | Helpers |
|-------|-------------|---------|
| `/analytics/block-utilization/` | 9 | UtilizationTooltip, HoursTooltip, UtilizationBar, BlockDayTimeline, WhatFitsPanel, SurgeonUtilizationRow, RoomUtilizationRow, CapacityInsightBanner, SkeletonBlockUtilization |
| `/analytics/` | 7 | ReportCard, QuickStatCard, CombinedTurnoverCard, SectionHeader, CaseVolumeTooltip, ComparisonTooltip, FlipRoomModal |
| `/analytics/orbit-score/` | 6 | TrendIndicator, PillarBar, SurgeonCard, RecommendationCard, FacilitySummary, PillarLegend |
| `/admin/settings/hl7v2-test-harness/` | 6 | ScenarioTab, DatabaseScenarioPanel, AlgorithmicScenarioPanel, PreviewPanel, ResultsPanel, EntityPoolsTab |
| `/analytics/surgeons/` | 5 | CompactStat, StatDivider, MiniUptimeRing, CaseVolumeTooltip, ComparisonTooltip |

---

## iOS Views — Complete Inventory

### Shared Components (10 files, ~1,461 LOC)

| File | LOC | View Structs | Severity |
|------|-----|-------------|----------|
| `CustomRefreshControl.swift` | 295 | 7 (OrbitRefreshView, CustomRefreshable, OrbitLoadingIndicator, OrbitLoadingView, OrbitInlineLoader, SuccessCheckmark + modifier) | :yellow_circle: |
| `RoomFilterBar.swift` | 282 | 5 (RoomFilterBar, DateNavigationRow, RoomChipsRow, AllRoomsChip, RoomChipView) | :yellow_circle: |
| `PressAnimations.swift` | 269 | 6 views + 4 modifiers + 1 ButtonStyle | :yellow_circle: |
| `ActiveCaseBar.swift` | 219 | 3 (ActiveCaseBar, PulsingDot, LiveTimer) | :yellow_circle: |
| `SkeletonView.swift` | 146 | 4 (SkeletonRoomCard, SkeletonCaseCard, SkeletonRoomsList, SkeletonCasesList) | :green_circle: |
| `LoadingView.swift` | 119 | 3 (LoadingView, EmptyStateView, ErrorView) | :green_circle: |
| `ToastView.swift` | 115 | 2 views + 1 modifier | :green_circle: |
| `StatusBadge.swift` | 103 | 2 (StatusBadge, ActiveDot) | :green_circle: |
| `HeaderBar.swift` | 69 | 1 | :green_circle: |
| `FloatingActionButton.swift` | 44 | 1 | :green_circle: |

### Features/Cases/ (8 files)

| File | LOC | View Structs | Severity |
|------|-----|-------------|----------|
| `CaseManagementSections.swift` | 1,543 | **19** (Staff, Delays, Implants sections with all sub-views) | :red_circle: CRITICAL |
| `CaseDetailView.swift` | 639 | 7 + 16 @ViewBuilder properties | :red_circle: |
| `MilestoneCarouselView.swift` | 598 | 4 + 1 modifier + 1 ButtonStyle | :red_circle: |
| `EnterpriseTimeCards.swift` | 511 | 6 | :red_circle: |
| `CaseView.swift` | 412 | 9 (CasesView, Header, Filters, Cards, Loading, Error) | :yellow_circle: |
| `MilestoneComponents.swift` | 379 | 4 | :yellow_circle: |
| `CaseRow.swift` | 80 | 1 | :green_circle: |
| `CaseDetailModels.swift` | 122 | 0 (data models) | :green_circle: |

### Features/DeviceRep/ (6 files)

| File | LOC | View Structs | Severity |
|------|-----|-------------|----------|
| `TrayConfirmationView.swift` | 1,023 | 2 | :red_circle: |
| `RepCaseDetailView.swift` | 912 | 4 | :red_circle: |
| `RepCasesView.swift` | 598 | 6 | :red_circle: |
| `RepProfileView.swift` | 449 | 3 | :yellow_circle: |
| `RepCaseCard.swift` | 297 | 3 | :yellow_circle: |
| `RepMainTabView.swift` | 83 | 2 | :green_circle: |

### Features/RoomMode/ (18 files, largest feature)

| File | LOC | View Structs | Severity |
|------|-----|-------------|----------|
| `RoomModeViewModel.swift` | 1,560 | 0 (ViewModel) | :red_circle: |
| `RoomModeView.swift` | 595 | 4 | :red_circle: |
| `DelayModal.swift` | 287 | 2 | :yellow_circle: |
| `StaffModal.swift` | 272 | 2 | :yellow_circle: |
| `MilestoneTimelineView.swift` | 223 | 2 | :yellow_circle: |
| `UpNextView.swift` | 222 | 1 | :yellow_circle: |
| `ImplantsModal.swift` | 194 | 1 | :green_circle: |
| `VoiceLogView.swift` | 184 | 2 | :green_circle: |
| `RoomScheduleModal.swift` | 136 | 1 | :green_circle: |
| `VoiceConfirmationToast.swift` | 127 | 1 | :green_circle: |
| `CaseCompletionModal.swift` | 114 | 1 | :green_circle: |
| `RoomModeTimerView.swift` | 89 | 2 | :green_circle: |
| `ProgressBarView.swift` | 73 | 1 | :green_circle: |
| `NotesModal.swift` | 65 | 1 | :green_circle: |
| `SurgeonAvatarView.swift` | 57 | 1 | :green_circle: |
| `FeedbackLevelToggle.swift` | 40 | 1 | :green_circle: |
| + 9 Voice service files | ~2,162 | 0 (services) | — |

### Features/Rooms/ (2 View files)

| File | LOC | View Structs | Severity |
|------|-----|-------------|----------|
| `RoomComponents.swift` | 676 | **11** (StatsBar, EnhancedRoomCard, MultiCaseRoomCard, etc.) | :red_circle: |
| `RoomsView.swift` | 193 | 3 | :green_circle: |

### Features/SurgeonHome/ (8 files)

| File | LOC | View Structs | Severity |
|------|-----|-------------|----------|
| `SurgeonHomeView.swift` | 424 | 7 | :yellow_circle: |
| `ORbitScoreCard.swift` | 313 | 7 | :yellow_circle: |
| `SurgeonCaseDetailSheet.swift` | 262 | 8 | :yellow_circle: |
| `ProgressCard.swift` | 154 | 1 | :green_circle: |
| `InsightSection.swift` | 138 | 2 | :green_circle: |
| `CasesSection.swift` | 131 | 2 | :green_circle: |
| `ScheduledCard.swift` | 128 | 2 | :green_circle: |

### Features/Notifications/ (3 files)

| File | LOC | View Structs | Severity |
|------|-----|-------------|----------|
| `CallNextPatientView.swift` | 799 | 6 | :red_circle: |
| `EnhancedNotificationCenter.swift` | 401 | 4 | :yellow_circle: |
| `NotificationCenterView.swift` | 159 | 2 | :green_circle: |

### Other Feature Directories

| File | LOC | Views | Severity |
|------|-----|-------|----------|
| `Profile/ProfileView.swift` | 376 | 3 | :yellow_circle: |
| `Profile/VoicePickerView.swift` | 143 | 1 | :green_circle: |
| `Login/LoginView.swift` | 274 | 1 | :yellow_circle: |
| `Login/ForgotPasswordView.swift` | 266 | 1 | :yellow_circle: |
| `Login/BiometricLockView.swift` | 69 | 1 | :green_circle: |
| `MainTabView.swift` | 387 | 3 | :yellow_circle: |
| `App/SplashScreen.swift` | 124 | 2 | :green_circle: |
| `ORbitApp.swift` | 180 | 1 | :green_circle: |

### iOS ViewModifiers (9 total)

| Modifier | File | Shared? |
|----------|------|---------|
| `OrbitRefreshableModifier` | CustomRefreshControl.swift | Yes |
| `PressableCard` | PressAnimations.swift | Yes |
| `BounceIn` | PressAnimations.swift | Yes |
| `SlideUp` | PressAnimations.swift | Yes |
| `ShimmerEffect` | PressAnimations.swift | Yes |
| `ToastModifier` | ToastView.swift | Yes |
| `SpinningAnimation` | MilestoneCarouselView.swift | No (inline) |
| `ApplyAppearance` | AppearanceSettings.swift | Yes |
| `HapticOnTapModifier` | HapticManager.swift | Yes |

### iOS ButtonStyles (2 total)

| Style | File | Shared? |
|-------|------|---------|
| `PressableButtonStyle` | PressAnimations.swift | Yes |
| `CardButtonStyle` | MilestoneCarouselView.swift | No (inline) |

---

## Barrel File Coverage

### Existing Barrel Files (4)

| Barrel | Components Exported | Coverage |
|--------|-------------------|----------|
| `components/ui/index.ts` | ~20 components | 44% of ui/ files |
| `components/analytics/financials/index.ts` | 8 components | 73% of financials/ files |
| `components/analytics/financials/shared/index.ts` | 12 components | 100% of shared/ files |
| `components/ui/Toast/index.ts` | 3 exports | 100% of Toast/ |

### Directories Missing Barrel Files

| Directory | Files | Recommendation |
|-----------|-------|---------------|
| `components/analytics/` | 17 | :yellow_circle: Add barrel — shared analytics primitives |
| `components/analytics/flags/` | 10 | :green_circle: Low priority — feature-scoped |
| `components/cases/` | 37 | :yellow_circle: Add barrel — many shared case components |
| `components/dashboard/` | 21 | :green_circle: Low priority — feature-scoped |
| `components/settings/` | 31 | :green_circle: Low priority — feature-scoped |
| `components/layouts/` | 6 | :yellow_circle: Add barrel — all apps import these |
| `components/global/` | 4 | :green_circle: Low priority — small directory |
| `components/integrations/` | 9 | :green_circle: Low priority — feature-scoped |

---

## Top 10 Largest Files (Cross-Platform)

| Rank | File | LOC | Platform | Key Issue |
|------|------|-----|----------|-----------|
| 1 | `AnalyticsComponents.tsx` | 2,193 | Web | 37 exports — mega-file |
| 2 | `CaseForm.tsx` | 1,856 | Web | Monolithic form |
| 3 | `RoomModeViewModel.swift` | 1,560 | iOS | Largest ViewModel |
| 4 | `CaseManagementSections.swift` | 1,543 | iOS | 19 View structs |
| 5 | `DataQualityPage.tsx` | 1,460 | Web | Page as component |
| 6 | `TemplateBuilder.tsx` | 1,437 | Web | Complex builder |
| 7 | `SurgeonDetail.tsx` | 1,305 | Web | Large detail view |
| 8 | `ProcedureDetail.tsx` | 1,197 | Web | Large detail view |
| 9 | `ReviewDetailPanel.tsx` | 1,152 | Web | 4 exports |
| 10 | `CompletedCaseView.tsx` | 1,068 | Web | Monolithic view |

---

## Cross-Platform Component Parity

| Component Type | Web (ui/) | iOS (Components/) | Gap |
|---------------|-----------|-------------------|-----|
| Loading/Spinner | Spinner, PageLoader, LoadingOverlay | LoadingView | Parity |
| Skeleton | 10 variants | 4 variants | Web ahead |
| Empty State | EmptyState | EmptyStateView | Parity |
| Error Display | ErrorBanner, ErrorState | ErrorView | Parity |
| Status Badge | StatusBadge, StatusBadgeDot | StatusBadge, ActiveDot | Parity |
| Button | Button, IconButton | FloatingActionButton only | iOS gap |
| Card | Card, CardEnhanced (compound) | None shared | iOS gap |
| Modal/Dialog | Modal, ConfirmDialog | None shared | iOS gap |
| Form Fields | Input, Textarea, Select, Label, FormField | None shared | iOS gap |
| Toast | ToastProvider | ToastView + modifier | Parity |
| Avatar | StaffAvatar, SurgeonAvatar | SurgeonAvatarView | Parity |
| Breadcrumb | Breadcrumb | HeaderBar (partial) | iOS gap |
| Search | SearchInput, SearchableDropdown | None | iOS gap |
| Pagination | Pagination | None | iOS gap |
| Tooltip | Tooltip | None | iOS gap |

**iOS has 10 shared components vs Web's 45 — significant gap in shared primitives.**

---

*Generated by Phase 1 of ORbit Component Audit*
*Next: Phase 2 — Inline Definitions*
