// app/api/admin/scan-pages/route.ts
// Scans the app/ directory for all page.tsx files and returns their routes.
// GET: list all pages
// POST { filePath }: scan a specific page file and extract metadata

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// =============================================================================
// Auth check — global admin only
// =============================================================================

async function verifyGlobalAdmin(req: NextRequest): Promise<boolean> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return false

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data: userRecord } = await supabase
      .from('users')
      .select('access_level')
      .eq('id', user.id)
      .single()

    return userRecord?.access_level === 'global_admin'
  } catch {
    return false
  }
}

// =============================================================================
// GET — List all page.tsx files in app/
// =============================================================================

export async function GET(req: NextRequest) {
  if (!(await verifyGlobalAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const appDir = path.join(process.cwd(), 'app')
    const pages = findPageFiles(appDir, appDir)

    return NextResponse.json({ pages })
  } catch (error: any) {
    console.error('[scan-pages] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// =============================================================================
// POST — Scan a specific page file and extract metadata
// =============================================================================

export async function POST(req: NextRequest) {
  if (!(await verifyGlobalAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const { filePath } = await req.json()
    if (!filePath) {
      return NextResponse.json({ error: 'filePath is required' }, { status: 400 })
    }

    // Security: only allow reading from app/ directory
    const fullPath = path.join(process.cwd(), filePath)
    const appDir = path.join(process.cwd(), 'app')
    if (!fullPath.startsWith(appDir)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const source = fs.readFileSync(fullPath, 'utf-8')
    const route = filePathToRoute(filePath)
    const metadata = extractMetadata(source, route, filePath)

    return NextResponse.json({ metadata })
  } catch (error: any) {
    console.error('[scan-pages] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// =============================================================================
// File Discovery
// =============================================================================

interface DiscoveredPage {
  filePath: string        // e.g. 'app/admin/docs/page.tsx'
  route: string           // e.g. '/admin/docs'
  fileName: string        // e.g. 'page.tsx'
  sizeBytes: number
  lastModified: string
}

function findPageFiles(dir: string, appDir: string): DiscoveredPage[] {
  const results: DiscoveredPage[] = []

  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    // Skip node_modules, .next, hidden dirs
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.next') continue

    if (entry.isDirectory()) {
      // Skip api routes directory
      if (entry.name === 'api') continue
      results.push(...findPageFiles(fullPath, appDir))
    } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
      const relativePath = 'app/' + path.relative(appDir, fullPath).replace(/\\/g, '/')
      const stat = fs.statSync(fullPath)

      results.push({
        filePath: relativePath,
        route: filePathToRoute(relativePath),
        fileName: entry.name,
        sizeBytes: stat.size,
        lastModified: stat.mtime.toISOString(),
      })
    }
  }

  return results
}

// =============================================================================
// Route Extraction
// =============================================================================

function filePathToRoute(filePath: string): string {
  // app/admin/docs/page.tsx → /admin/docs
  // app/(dashboard)/settings/page.tsx → /settings
  // app/cases/[id]/page.tsx → /cases/[id]

  let route = filePath
    .replace(/^app\//, '/')        // Remove 'app/' prefix
    .replace(/\/page\.(tsx|ts)$/, '') // Remove /page.tsx

  // Remove route groups: (groupName)
  route = route.replace(/\/\([^)]+\)/g, '')

  // Clean up double slashes
  route = route.replace(/\/+/g, '/')

  // Root page
  if (route === '' || route === '/') return '/'

  return route
}

// =============================================================================
// Metadata Extraction
// =============================================================================

interface ExtractedMetadata {
  id: string
  name: string
  route: string
  category: string
  description: string
  roles: string[]
  reads: string[]
  writes: string[]
  rpcs: string[]
  realtime: string[]
  materialized_views: string[]
  components: string[]
  interactions: string[]
  api_routes: string[]
  ios_exists: boolean
  ios_view_name: string | null
  calculation_engine: string | null
  timezone_aware: boolean
  key_validations: string[]
  state_management: string | null
  notes: string | null
  // Extra scan info
  _scan_confidence: Record<string, string>
  _source_lines: number
}

function extractMetadata(source: string, route: string, filePath: string): ExtractedMetadata {
  const confidence: Record<string, string> = {}

  // ---- Name from export default function ----
  const nameMatch = source.match(/export\s+default\s+function\s+(\w+)/)
  const rawName = nameMatch?.[1] || ''
  const name = rawName
    .replace(/Page$/, '')                    // Remove 'Page' suffix
    .replace(/([A-Z])/g, ' $1')             // CamelCase to spaces
    .trim()
  confidence['name'] = nameMatch ? 'high' : 'low'

  // ---- ID slug ----
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || route.replace(/\//g, '-').replace(/^-|-$/g, '')

  // ---- Category from route ----
  let category = 'Shared'
  if (route.startsWith('/admin/settings') || route.startsWith('/admin/facilities') || route.startsWith('/admin/audit')) {
    category = 'Global Admin'
  } else if (route.startsWith('/admin')) {
    category = 'Admin'
  } else if (route === '/login' || route.startsWith('/auth')) {
    category = 'Auth'
  }

  // Check for global admin pattern
  const hasGlobalAdminCheck = /isGlobalAdmin/.test(source)
  const hasFacilityAdminCheck = /isFacilityAdmin|isAdmin/.test(source)
  if (hasGlobalAdminCheck && category === 'Shared') category = 'Global Admin'

  confidence['category'] = 'medium'

  // ---- Roles from access checks ----
  const roles: string[] = []
  if (hasGlobalAdminCheck) roles.push('global_admin')
  if (hasFacilityAdminCheck) roles.push('facility_admin')
  if (source.includes("'user'") || source.includes("accessLevel")) roles.push('user')
  if (roles.length === 0) roles.push('global_admin', 'facility_admin', 'user') // Default
  confidence['roles'] = hasGlobalAdminCheck || hasFacilityAdminCheck ? 'medium' : 'low'

  // ---- Tables: .from('table_name') ----
  const reads = new Set<string>()
  const writes = new Set<string>()
  const fromPattern = /\.from\s*\(\s*['"](\w+)['"]\s*\)/g
  let fromMatch

  // We need to determine read vs write by looking at what follows .from()
  // Strategy: find each .from() call and look at the chain that follows
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineFromMatch = line.match(/\.from\s*\(\s*['"](\w+)['"]\s*\)/)
    if (!lineFromMatch) continue

    const tableName = lineFromMatch[1]
    // Look at this line and the next few lines for the operation
    const context = lines.slice(i, Math.min(i + 5, lines.length)).join(' ')

    if (/\.insert\s*\(/.test(context) || /\.upsert\s*\(/.test(context)) {
      writes.add(tableName)
    }
    if (/\.update\s*\(/.test(context)) {
      writes.add(tableName)
    }
    if (/\.delete\s*\(/.test(context)) {
      writes.add(tableName)
    }
    if (/\.select\s*\(/.test(context)) {
      reads.add(tableName)
    }

    // If no clear operation detected, assume read
    if (!reads.has(tableName) && !writes.has(tableName)) {
      reads.add(tableName)
    }
  }

  confidence['reads'] = reads.size > 0 ? 'high' : 'low'
  confidence['writes'] = writes.size > 0 ? 'high' : 'low'

  // ---- RPCs: .rpc('function_name') ----
  const rpcs = new Set<string>()
  const rpcPattern = /\.rpc\s*\(\s*['"](\w+)['"]/g
  let rpcMatch
  while ((rpcMatch = rpcPattern.exec(source)) !== null) {
    rpcs.add(rpcMatch[1])
  }
  confidence['rpcs'] = rpcs.size > 0 ? 'high' : 'none'

  // ---- Realtime subscriptions ----
  const realtime = new Set<string>()
  // Pattern: .on('postgres_changes', { ... table: 'table_name' ... })
  const realtimePattern = /table:\s*['"](\w+)['"]/g
  const channelSection = source.match(/\.channel\s*\([\s\S]*?\.subscribe/g)
  if (channelSection) {
    for (const section of channelSection) {
      let rtMatch
      while ((rtMatch = realtimePattern.exec(section)) !== null) {
        realtime.add(rtMatch[1])
      }
    }
  }
  confidence['realtime'] = realtime.size > 0 ? 'high' : 'none'

  // ---- Components from imports ----
  const components = new Set<string>()
  const componentPattern = /import\s+(\w+)\s+from\s+['"]@\/components\/(?!layouts)/g
  let compMatch
  while ((compMatch = componentPattern.exec(source)) !== null) {
    // Skip layout components and common wrappers
    const comp = compMatch[1]
    if (!['DashboardLayout', 'ErrorBoundary'].includes(comp)) {
      components.add(comp)
    }
  }

  // Also catch destructured imports: import { X, Y } from '@/components/...'
  const destructuredPattern = /import\s+\{([^}]+)\}\s+from\s+['"]@\/components\/(?!layouts)/g
  let destrMatch
  while ((destrMatch = destructuredPattern.exec(source)) !== null) {
    const imports = destrMatch[1].split(',').map(s => s.trim().split(' as ')[0].trim())
    for (const imp of imports) {
      if (imp && !['DashboardLayout', 'ErrorBoundary'].includes(imp)) {
        components.add(imp)
      }
    }
  }
  confidence['components'] = components.size > 0 ? 'high' : 'none'

  // ---- API routes from fetch calls ----
  const apiRoutes = new Set<string>()
  const fetchPattern = /fetch\s*\(\s*['"](\/(api\/[^'"]+))['"]/g
  let fetchMatch
  while ((fetchMatch = fetchPattern.exec(source)) !== null) {
    apiRoutes.add(fetchMatch[1])
  }
  confidence['api_routes'] = apiRoutes.size > 0 ? 'high' : 'none'

  // ---- Calculation engine ----
  let calculationEngine: string | null = null
  if (source.includes('analyticsV2') || source.includes('AnalyticsV2')) {
    calculationEngine = 'analyticsV2'
  }

  // ---- Timezone aware ----
  const timezoneAware = /timezone|facilityTimezone|timeZone/.test(source)

  // ---- State management patterns ----
  let stateManagement: string | null = null
  const hasUseState = /useState/.test(source)
  const hasUseReducer = /useReducer/.test(source)
  const hasFunctionalUpdater = /set\w+\s*\(\s*prev\s*=>/.test(source)
  const patterns: string[] = []
  if (hasUseReducer) patterns.push('useReducer')
  if (hasFunctionalUpdater) patterns.push('functional updaters')
  if (patterns.length > 0) stateManagement = `Uses ${patterns.join(', ')}`

  // ---- Interactions from onClick/onChange handlers ----
  const interactions: string[] = []
  // Look for button labels and form submissions
  const buttonLabels = source.match(/>\s*(Save|Submit|Delete|Add|Create|Update|Cancel|Export|Import|Generate|Refresh|Reset|Clear|Filter|Search)\b/g)
  if (buttonLabels) {
    const unique = [...new Set(buttonLabels.map(b => b.replace(/^>\s*/, '').toLowerCase()))]
    interactions.push(...unique)
  }

  // ---- Key validations ----
  const keyValidations: string[] = []
  if (source.includes('recorded_at') && (source.includes('!= NULL') || source.includes('!== null') || source.includes('IS NOT NULL'))) {
    keyValidations.push('recorded_at != NULL for milestone completion')
  }

  // ---- Source lines ----
  const sourceLines = lines.length

  return {
    id,
    name: name || route.split('/').pop() || 'Unknown',
    route,
    category,
    description: '',
    roles: [...new Set(roles)],
    reads: Array.from(reads).sort(),
    writes: Array.from(writes).sort(),
    rpcs: Array.from(rpcs).sort(),
    realtime: Array.from(realtime).sort(),
    materialized_views: [],
    components: Array.from(components).sort(),
    interactions,
    api_routes: Array.from(apiRoutes).sort(),
    ios_exists: false,
    ios_view_name: null,
    calculation_engine: calculationEngine,
    timezone_aware: timezoneAware,
    key_validations: keyValidations,
    state_management: stateManagement,
    notes: `Auto-scanned from ${filePath} (${sourceLines} lines)`,
    _scan_confidence: confidence,
    _source_lines: sourceLines,
  }
}