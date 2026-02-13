# ORbit iOS Architecture Reference

> Read this document when working on the SwiftUI iOS app.
> For database and analytics details, see `docs/architecture.md`.

---

## 1. App Structure

```
ORbit/
├── ORbitApp.swift              → App entry point, environment setup
├── ContentView.swift           → Root navigation (TabView)
├── Theme.swift                 → Design tokens (colors, spacing, fonts)
│
├── Core/
│   ├── Auth/
│   │   ├── AuthManager.swift   → @Observable auth state, token management
│   │   └── KeychainHelper.swift → Secure token storage (migrated from UserDefaults)
│   ├── Network/
│   │   └── SupabaseClient.swift → Supabase client factory
│   └── Error/
│       └── ORbitError.swift     → Centralized error types
│
├── Models/                      → Data models (Codable structs)
│   ├── SurgicalCase.swift
│   ├── SurgeonDay.swift
│   ├── RepCase.swift
│   ├── CaseDetailModels.swift   → NewCaseMilestone, CaseDelay, etc.
│   └── PaceStatus.swift
│
├── Repositories/                → Data access layer (Supabase queries)
│   ├── CaseRepository.swift
│   ├── RoomRepository.swift
│   └── (future: ScorecardRepository.swift)
│
├── ViewModels/                  → Business logic + state
│   ├── CasesViewModel.swift
│   ├── RoomsViewModel.swift
│   ├── CaseDetailViewModel.swift
│   └── (future: ScorecardViewModel.swift)
│
├── Features/
│   ├── SurgeonHome/
│   │   ├── SurgeonHomeView.swift
│   │   └── SurgeonHomeViewModel.swift
│   ├── Cases/
│   │   ├── CasesView.swift
│   │   ├── CaseDetailView.swift
│   │   └── CaseDetailModels.swift
│   ├── Rooms/
│   │   ├── RoomsView.swift
│   │   └── RoomComponents.swift
│   ├── Profile/
│   │   └── ProfileView.swift
│   └── DeviceRep/
│       ├── RepCasesView.swift
│       └── DeviceRepTray.swift
│
└── Components/                  → Shared UI components
    ├── MilestoneCarousel.swift
    └── (shared components)
```

## 2. Architecture Pattern: MVVM + Repository

```
View (SwiftUI) → ViewModel (@Observable/@MainActor) → Repository → SupabaseClient
```

### Views
- Pure UI rendering, no data fetching
- Use `@StateObject` for ViewModel ownership
- Use `@EnvironmentObject` for shared state (AuthManager)
- After MVVM migration, views should NOT import `PostgREST`

### ViewModels
- `@MainActor` class — all `@Published` updates are on main thread
- Takes `accessToken` and `facilityId` as init params (not from environment)
- Owns loading states, error states, business logic
- Calls Repository methods for data access

### Repositories
- Stateless — receive SupabaseClient per call or at init
- Contain ALL Supabase queries (table names, select strings, filters)
- Return typed Swift models
- Only layer that imports `PostgREST`

## 3. Key Patterns

### Auth Flow
```swift
// AuthManager provides token + facility context
@EnvironmentObject var authManager: AuthManager

// ViewModel receives these at init
@StateObject var viewModel = CasesViewModel(
    accessToken: authManager.accessToken,
    facilityId: authManager.facilityId
)
```

### Error Handling
```swift
// Use ORbitError for typed errors
enum ORbitError: LocalizedError {
    case notAuthenticated
    case networkError(underlying: Error)
    case notFound(entity: String)
    // ...
}

// ViewModels surface errors via @Published
@Published var error: ORbitError?
```

### Milestone Data Access
```swift
// CORRECT: Use facility_milestone_id
let milestones = try await client
    .from("case_milestones")
    .select("*, facility_milestones(name, display_name, source_milestone_type_id)")
    .eq("case_id", value: caseId)
    .execute()

// WRONG: milestone_type_id was dropped
// .select("*, milestone_types(name)")  // ❌ DO NOT USE
```

### Status Checking
```swift
// Case status is a string: "scheduled", "in_progress", "completed", "cancelled"
// Milestone recorded check: recorded_at != nil
if milestone.recordedAt != nil {
    // milestone has been recorded
}
```

## 4. Design System (Theme.swift)

The app uses a centralized theme with consistent tokens. Always reference `Theme` values rather than hardcoding.

```swift
Theme.Colors.primary          // Main brand color
Theme.Colors.background       // Screen background
Theme.Colors.cardBackground   // Card surfaces
Theme.Spacing.small           // 8pt
Theme.Spacing.medium          // 16pt
Theme.Spacing.large           // 24pt
Theme.Font.body               // Standard body text
Theme.Font.headline           // Section headers
```

Dark mode is supported through the theme system.

## 5. Current Gaps vs Web App

| Feature | Web | iOS |
|---------|-----|-----|
| Case management | ✅ Full CRUD | ✅ View + milestone recording |
| Room status board | ✅ | ✅ |
| Surgeon home dashboard | ✅ | ✅ |
| Device rep tray tracking | ✅ | ✅ (differentiator feature) |
| ORbit Score / Scorecards | ✅ Client-side | ❌ Planned (via surgeon_scorecards table) |
| Analytics dashboards | ✅ Multiple | ❌ Not started |
| Block scheduling | ✅ | ❌ Not started |
| Admin features | ✅ | ❌ Not planned for mobile |
| Face ID auth | N/A | ❌ Planned |
| Forgot password | ✅ | ❌ Planned |
| Offline support | N/A | ❌ Future consideration |

## 6. iOS-Specific Gotchas

1. **`@StateObject` init timing:** `@EnvironmentObject` isn't available when `@StateObject` initializes. Pass values as init params.
2. **Remove `DispatchQueue.main.async`:** `@MainActor` ViewModels handle this automatically.
3. **`import PostgREST` boundary:** Only Repositories should import it. If a View imports PostgREST, the architecture leaked.
4. **`createSupabaseClient()` backward compat:** Old wrapper still works for unmigrated files. New code uses Repository pattern.
5. **Singleton injection:** `NotificationManager.shared`, `ActiveCaseManager.shared`, `AppearanceManager.shared` — these should be injected via `@EnvironmentObject`, not accessed as singletons. Migration in progress.
