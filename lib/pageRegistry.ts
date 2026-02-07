// =============================================================================
// ORbit Page Registry — Single source of truth for app documentation
// =============================================================================
// Add one entry per page. The admin docs page reads this file and enriches
// each entry with live database metadata (triggers, FKs, indexes, columns)
// via Supabase system catalog introspection.
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type UserRole = 'global_admin' | 'facility_admin' | 'surgeon' | 'anesthesiologist' | 'nurse' | 'tech' | 'staff';

export type PageCategory =
  | 'Surgeon-Facing'
  | 'Admin'
  | 'Global Admin'
  | 'Shared'
  | 'Auth'
  | 'API Routes';

export interface IOSParity {
  exists: boolean;
  viewName?: string;            // SwiftUI view name, e.g. 'SurgeonDashboardView'
  notes?: string;               // Known differences or sync considerations
}

export interface PageEntry {
  // --- Core Identity ---
  id: string;                   // Unique slug: 'surgeon-dashboard'
  name: string;                 // Display name: 'Surgeon Dashboard'
  route: string;                // Web path: '/dashboard/surgeon'
  category: PageCategory;
  description: string;          // One-liner on what the page does
  roles: UserRole[];            // Which roles can access this page

  // --- Data Dependencies ---
  reads: string[];              // Tables/views it queries
  writes: string[];             // Tables it inserts into or updates
  rpcs: string[];               // Supabase RPC functions it calls
  realtime?: string[];          // Tables it subscribes to for live updates
  materializedViews?: string[]; // Materialized views it depends on

  // --- Business Logic ---
  calculationEngine?: string;   // Reference to shared logic, e.g. 'analyticsV2'
  keyValidations?: string[];    // Critical checks, e.g. 'recorded_at != NULL'
  timezoneAware?: boolean;      // Whether it handles facility-specific timezones

  // --- Platform Parity ---
  ios: IOSParity;
  parityNotes?: string;         // Known sync or behavioral differences

  // --- UI Details ---
  components?: string[];        // Key shared components used
  interactions?: string[];      // Notable user actions
  stateManagement?: string;     // Notes on tricky state patterns

  // --- API Dependencies ---
  apiRoutes?: string[];         // Next.js API routes this page calls

  // --- Metadata ---
  owner?: string;               // Responsible developer
  lastReviewed?: string;        // ISO date of last review
  notes?: string;               // Freeform notes
}


// -----------------------------------------------------------------------------
// Registry
// -----------------------------------------------------------------------------
// Add entries below. The admin docs page auto-generates a TOC from categories.
// Database metadata (columns, triggers, FKs, indexes) is fetched live at runtime.
// -----------------------------------------------------------------------------

export const pageRegistry: PageEntry[] = [

  // ===========================================================================
  // SURGEON-FACING
  // ===========================================================================

  {
    id: 'surgeon-dashboard',
    name: 'Surgeon Dashboard',
    route: '/dashboard/surgeon',
    category: 'Surgeon-Facing',
    description: 'Real-time overview of active cases, room status, and daily schedule for surgeons.',
    roles: ['surgeon'],
    reads: ['cases', 'case_milestones', 'rooms', 'users'],
    writes: [],
    rpcs: [],
    realtime: ['cases', 'case_milestones'],
    materializedViews: [],
    ios: {
      exists: true,
      viewName: 'SurgeonDashboardView',
    },
    components: ['CaseTimeline', 'RoomStatusCard'],
    interactions: ['view active case', 'view room status', 'navigate to case detail'],
  },

  {
    id: 'case-detail',
    name: 'Case Detail',
    route: '/cases/[id]',
    category: 'Surgeon-Facing',
    description: 'Detailed view of a single surgical case with milestone tracking and timing data.',
    roles: ['surgeon', 'facility_admin', 'global_admin', 'nurse', 'tech', 'anesthesiologist'],
    reads: ['cases', 'case_milestones', 'facility_milestones', 'surgeon_milestone_averages', 'users', 'rooms'],
    writes: ['case_milestones'],
    rpcs: [],
    realtime: ['case_milestones'],
    keyValidations: ['recorded_at != NULL for milestone completion'],
    timezoneAware: true,
    ios: {
      exists: true,
      viewName: 'CaseDetailView',
      notes: 'Uses NavigationSplitView on iPad. Milestone recording uses same NULL timestamp pattern.',
    },
    parityNotes: 'iOS previously miscounted milestones by treating NULL recorded_at as completed. Fixed.',
    components: ['MilestoneTracker', 'CaseTimeline'],
    interactions: ['record milestone timestamp', 'view milestone history', 'view pace tracking'],
    stateManagement: 'Functional updaters for rapid milestone toggles to prevent stale closures.',
  },

  // ===========================================================================
  // ADMIN
  // ===========================================================================

  {
    id: 'admin-overview',
    name: 'Admin Overview',
    route: '/admin/overview',
    category: 'Admin',
    description: 'Facility-level analytics dashboard with OR utilization, turnover metrics, and surgeon performance.',
    roles: ['facility_admin', 'global_admin'],
    reads: ['cases', 'case_milestones', 'case_milestone_stats', 'rooms', 'users'],
    writes: [],
    rpcs: [],
    materializedViews: ['case_milestone_stats'],
    calculationEngine: 'analyticsV2',
    timezoneAware: true,
    ios: { exists: false },
    components: ['AnalyticsChart', 'TurnoverMetrics', 'SurgeonIdleTime'],
    interactions: ['filter by date range', 'filter by surgeon', 'view turnover breakdown', 'view surgeon idle time'],
    notes: 'Uses median values over averages for resilience against outliers (lunch breaks, delays).',
  },

  {
    id: 'admin-rooms',
    name: 'Rooms Management',
    route: '/admin/rooms',
    category: 'Admin',
    description: 'Configure and manage operating rooms for the facility.',
    roles: ['facility_admin', 'global_admin'],
    reads: ['rooms', 'facilities'],
    writes: ['rooms'],
    rpcs: [],
    ios: { exists: false },
    interactions: ['add room', 'edit room', 'deactivate room'],
  },

  // ===========================================================================
  // GLOBAL ADMIN
  // ===========================================================================

  {
    id: 'global-admin-dashboard',
    name: 'Global Admin Dashboard',
    route: '/admin/global',
    category: 'Global Admin',
    description: 'Cross-facility management, user provisioning, and system-wide configuration.',
    roles: ['global_admin'],
    reads: ['facilities', 'users', 'user_roles', 'rooms'],
    writes: ['facilities', 'users'],
    rpcs: [],
    ios: { exists: false },
    interactions: ['create facility', 'create user', 'manage roles'],
  },

  {
    id: 'admin-demo',
    name: 'Demo Data Generator',
    route: '/admin/demo',
    category: 'Global Admin',
    description: 'Generate realistic surgical demo data with configurable surgeon profiles and scheduling patterns.',
    roles: ['global_admin'],
    reads: ['facilities', 'users', 'rooms', 'facility_milestones', 'procedure_types'],
    writes: ['cases', 'case_milestones', 'case_staff', 'case_implants'],
    rpcs: [],
    ios: { exists: false },
    apiRoutes: ['/api/demo-data'],
    notes: 'Generates flip-room scheduling, surgeon speed profiles, and realistic outlier patterns.',
  },

  // ===========================================================================
  // AUTH
  // ===========================================================================

  {
    id: 'login',
    name: 'Login',
    route: '/login',
    category: 'Auth',
    description: 'User authentication with facility-specific routing.',
    roles: ['global_admin', 'facility_admin', 'surgeon', 'anesthesiologist', 'nurse', 'tech', 'staff'],
    reads: ['users', 'user_roles', 'facilities'],
    writes: [],
    rpcs: [],
    ios: {
      exists: true,
      viewName: 'LoginView',
    },
    interactions: ['email/password login', 'password reset'],
  },

  // ===========================================================================
  // Add more pages below as you build them.
  // Each entry appears in the admin docs TOC automatically.
  // ===========================================================================
];


// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Get all unique categories in display order */
export function getCategories(): PageCategory[] {
  const order: PageCategory[] = ['Surgeon-Facing', 'Admin', 'Global Admin', 'Shared', 'Auth', 'API Routes'];
  const used = new Set(pageRegistry.map(p => p.category));
  return order.filter(c => used.has(c));
}

/** Get pages grouped by category */
export function getPagesByCategory(): Record<PageCategory, PageEntry[]> {
  const grouped = {} as Record<PageCategory, PageEntry[]>;
  for (const page of pageRegistry) {
    if (!grouped[page.category]) grouped[page.category] = [];
    grouped[page.category].push(page);
  }
  return grouped;
}

/** Get all unique table names across the entire registry */
export function getAllTables(): string[] {
  const tables = new Set<string>();
  for (const page of pageRegistry) {
    page.reads.forEach(t => tables.add(t));
    page.writes.forEach(t => tables.add(t));
  }
  return Array.from(tables).sort();
}

/** Find which pages depend on a given table */
export function getPagesByTable(tableName: string): PageEntry[] {
  return pageRegistry.filter(
    p => p.reads.includes(tableName) || p.writes.includes(tableName)
  );
}

/** Find which pages use a given RPC */
export function getPagesByRpc(rpcName: string): PageEntry[] {
  return pageRegistry.filter(p => p.rpcs.includes(rpcName));
}