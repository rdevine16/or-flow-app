// app/api/admin/scan-pages/route.ts
// Scans the project for all TypeScript files and extracts metadata.
// GET ?scope=all|pages|api|lib|components — list discovered files
// POST { filePath } — scan a specific file and extract metadata

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
// Types
// =============================================================================

type FileScope = 'pages' | 'api' | 'lib' | 'components'

interface DiscoveredFile {
  filePath: string
  route: string
  fileName: string
  scope: FileScope
  sizeBytes: number
  lastModified: string
}

// =============================================================================
// GET — Discover files
// =============================================================================

export async function GET(req: NextRequest) {
  if (!(await verifyGlobalAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const scope = req.nextUrl.searchParams.get('scope') || 'all'
    const projectRoot = process.cwd()
    const files: DiscoveredFile[] = []

    // Pages: app/**/page.tsx
    if (scope === 'all' || scope === 'pages') {
      const appDir = path.join(projectRoot, 'app')
      if (fs.existsSync(appDir)) {
        files.push(...findFiles(appDir, projectRoot, 'pages', (name) => {
          return name === 'page.tsx' || name === 'page.ts'
        }, ['node_modules', '.next', 'api']))
      }
    }

    // API routes: app/api/**/route.ts
    if (scope === 'all' || scope === 'api') {
      const apiDir = path.join(projectRoot, 'app', 'api')
      if (fs.existsSync(apiDir)) {
        files.push(...findFiles(apiDir, projectRoot, 'api', (name) => {
          return name === 'route.ts' || name === 'route.tsx'
        }))
      }
    }

    // Lib files: lib/**/*.ts
    if (scope === 'all' || scope === 'lib') {
      const libDir = path.join(projectRoot, 'lib')
      if (fs.existsSync(libDir)) {
        files.push(...findFiles(libDir, projectRoot, 'lib', (name) => {
          return (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.endsWith('.d.ts')
        }))
      }
    }

    // Components: components/**/*.tsx
    if (scope === 'all' || scope === 'components') {
      const compDir = path.join(projectRoot, 'components')
      if (fs.existsSync(compDir)) {
        files.push(...findFiles(compDir, projectRoot, 'components', (name) => {
          return name.endsWith('.tsx') || name.endsWith('.ts')
        }))
      }
    }

    return NextResponse.json({ files })
  } catch (error: any) {
    console.error('[scan-pages] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// =============================================================================
// POST — Scan a specific file
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

    const projectRoot = process.cwd()
    const fullPath = path.join(projectRoot, filePath)

    // Security: only allow reading from known directories
    const allowed = ['app', 'lib', 'components'].some(dir =>
      fullPath.startsWith(path.join(projectRoot, dir))
    )
    if (!allowed) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const source = fs.readFileSync(fullPath, 'utf-8')
    const scope = inferScope(filePath)
    const metadata = extractMetadata(source, filePath, scope)

    return NextResponse.json({ metadata })
  } catch (error: any) {
    console.error('[scan-pages] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// =============================================================================
// File Discovery
// =============================================================================

function findFiles(
  dir: string,
  projectRoot: string,
  scope: FileScope,
  fileFilter: (name: string) => boolean,
  skipDirs: string[] = []
): DiscoveredFile[] {
  const results: DiscoveredFile[] = []

  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.next') continue

    if (entry.isDirectory()) {
      if (skipDirs.includes(entry.name)) continue
      results.push(...findFiles(fullPath, projectRoot, scope, fileFilter, skipDirs))
    } else if (fileFilter(entry.name)) {
      const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/')
      const stat = fs.statSync(fullPath)

      results.push({
        filePath: relativePath,
        route: deriveRoute(relativePath, scope),
        fileName: entry.name,
        scope,
        sizeBytes: stat.size,
        lastModified: stat.mtime.toISOString(),
      })
    }
  }

  return results
}

// =============================================================================
// Route / Path Derivation
// =============================================================================

function inferScope(filePath: string): FileScope {
  if (filePath.startsWith('app/api/')) return 'api'
  if (filePath.startsWith('app/')) return 'pages'
  if (filePath.startsWith('lib/')) return 'lib'
  if (filePath.startsWith('components/')) return 'components'
  return 'pages'
}

function deriveRoute(filePath: string, scope: FileScope): string {
  switch (scope) {
    case 'pages': {
      let route = filePath
        .replace(/^app\//, '/')
        .replace(/\/page\.(tsx|ts)$/, '')
      route = route.replace(/\/\([^)]+\)/g, '')
      route = route.replace(/\/+/g, '/')
      return route === '' || route === '//' ? '/' : route
    }
    case 'api': {
      return filePath
        .replace(/^app/, '')
        .replace(/\/route\.(tsx|ts)$/, '')
    }
    case 'lib': {
      return filePath.replace(/\.(tsx|ts)$/, '')
    }
    case 'components': {
      return filePath.replace(/\.(tsx|ts)$/, '')
    }
  }
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
  http_methods: string[]
  ios_exists: boolean
  ios_view_name: string | null
  calculation_engine: string | null
  timezone_aware: boolean
  key_validations: string[]
  state_management: string | null
  notes: string | null
  _scan_confidence: Record<string, string>
  _source_lines: number
  _scope: FileScope
}

function extractMetadata(source: string, filePath: string, scope: FileScope): ExtractedMetadata {
  const confidence: Record<string, string> = {}
  const lines = source.split('\n')
  const route = deriveRoute(filePath, scope)

  // ---- Name ----
  let name = ''

  const defaultFuncMatch = source.match(/export\s+default\s+function\s+(\w+)/)
  if (defaultFuncMatch) {
    name = defaultFuncMatch[1]
      .replace(/Page$/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim()
    confidence['name'] = 'high'
  }

  if (!name && (scope === 'lib' || scope === 'components')) {
    const fileName = filePath.split('/').pop()?.replace(/\.(tsx|ts)$/, '') || ''
    name = fileName.replace(/([A-Z])/g, ' $1').trim()
    confidence['name'] = 'medium'
  }

  if (!name && scope === 'api') {
    // Use the directory path for API routes
    const parts = filePath.replace(/^app\/api\//, '').replace(/\/route\.(tsx|ts)$/, '').split('/')
    name = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, ' ')).join(' ') + ' API'
    confidence['name'] = 'medium'
  }

  if (!name) {
    name = route.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Unknown'
    name = name.charAt(0).toUpperCase() + name.slice(1)
    confidence['name'] = 'low'
  }

  // ---- ID ----
  const id = (name || route)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // ---- Category (uses slug ids matching page_categories table) ----
  let category = 'shared'
  if (scope === 'api') {
    category = 'api-routes'
  } else if (scope === 'lib') {
    category = 'shared'
  } else if (scope === 'components') {
    category = 'shared'
  } else if (route.startsWith('/admin/settings') || route.startsWith('/admin/facilities') || route.startsWith('/admin/audit')) {
    category = 'global-admin'
  } else if (route.startsWith('/admin')) {
    category = 'admin'
  } else if (route === '/login' || route.startsWith('/auth')) {
    category = 'auth'
  }
  if (/isGlobalAdmin/.test(source) && category === 'shared') category = 'global-admin'
  confidence['category'] = 'medium'

  // ---- Roles ----
  const roles: string[] = []
  if (/isGlobalAdmin/.test(source)) roles.push('global_admin')
  if (/isFacilityAdmin|isAdmin/.test(source)) {
    roles.push('facility_admin')
    if (!roles.includes('global_admin')) roles.push('global_admin')
  }
  if (roles.length === 0) roles.push('global_admin', 'facility_admin', 'user')
  confidence['roles'] = roles.length < 3 ? 'medium' : 'low'

  // ---- Tables ----
  const reads = new Set<string>()
  const writes = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fromMatch = line.match(/\.from\s*\(\s*['"](\w+)['"]\s*\)/)
    if (!fromMatch) continue

    const tableName = fromMatch[1]
    const context = lines.slice(i, Math.min(i + 5, lines.length)).join(' ')

    if (/\.(insert|upsert)\s*\(/.test(context)) writes.add(tableName)
    if (/\.update\s*\(/.test(context)) writes.add(tableName)
    if (/\.delete\s*\(/.test(context)) writes.add(tableName)
    if (/\.select\s*\(/.test(context)) reads.add(tableName)

    if (!reads.has(tableName) && !writes.has(tableName)) reads.add(tableName)
  }
  confidence['reads'] = reads.size > 0 ? 'high' : 'none'
  confidence['writes'] = writes.size > 0 ? 'high' : 'none'

  // ---- RPCs ----
  const rpcs = new Set<string>()
  let rpcMatch
  const rpcPattern = /\.rpc\s*\(\s*['"](\w+)['"]/g
  while ((rpcMatch = rpcPattern.exec(source)) !== null) rpcs.add(rpcMatch[1])
  confidence['rpcs'] = rpcs.size > 0 ? 'high' : 'none'

  // ---- Realtime ----
  const realtime = new Set<string>()
  const channelSections = source.match(/\.channel\s*\([\s\S]*?\.subscribe/g)
  if (channelSections) {
    const rtPattern = /table:\s*['"](\w+)['"]/g
    for (const section of channelSections) {
      let rtMatch
      while ((rtMatch = rtPattern.exec(section)) !== null) realtime.add(rtMatch[1])
    }
  }
  confidence['realtime'] = realtime.size > 0 ? 'high' : 'none'

  // ---- Components ----
  const components = new Set<string>()
  const defaultImportPattern = /import\s+(\w+)\s+from\s+['"]@\/components\/(?!layouts)([^'"]+)['"]/g
  let compMatch
  while ((compMatch = defaultImportPattern.exec(source)) !== null) {
    if (!['DashboardLayout', 'ErrorBoundary'].includes(compMatch[1])) components.add(compMatch[1])
  }
  const namedImportPattern = /import\s+\{([^}]+)\}\s+from\s+['"]@\/components\/(?!layouts)([^'"]+)['"]/g
  let namedMatch
  while ((namedMatch = namedImportPattern.exec(source)) !== null) {
    namedMatch[1].split(',').map(n => n.trim().split(' as ')[0].trim()).forEach(n => { if (n) components.add(n) })
  }
  confidence['components'] = components.size > 0 ? 'high' : 'none'

  // ---- API routes from fetch ----
  const apiRoutes = new Set<string>()
  const fetchPattern = /fetch\s*\(\s*[`'"](\/api\/[^'"`\s$]+)/g
  let fetchMatch
  while ((fetchMatch = fetchPattern.exec(source)) !== null) apiRoutes.add(fetchMatch[1])
  confidence['api_routes'] = apiRoutes.size > 0 ? 'high' : 'none'

  // ---- Calculation engine ----
  let calculationEngine: string | null = null
  if (/analyticsV2|AnalyticsV2/.test(source)) calculationEngine = 'analyticsV2'

  // ---- Timezone ----
  const timezoneAware = /timezone|facilityTimezone|timeZone/.test(source)

  // ---- State management ----
  let stateManagement: string | null = null
  const smPatterns: string[] = []
  if (/useReducer/.test(source)) smPatterns.push('useReducer')
  if (/set\w+\s*\(\s*prev\s*=>/.test(source)) smPatterns.push('functional updaters')
  if (/useContext/.test(source)) smPatterns.push('context')
  if (smPatterns.length > 0) stateManagement = `Uses ${smPatterns.join(', ')}`

  // ---- Interactions ----
  const interactions: string[] = []
  const buttonLabels = source.match(/>\s*(Save|Submit|Delete|Add|Create|Update|Cancel|Export|Import|Generate|Refresh|Reset|Clear|Filter|Search|Edit|Remove|Confirm|Download|Upload)\b/gi)
  if (buttonLabels) {
    const unique = [...new Set(buttonLabels.map(b => b.replace(/^>\s*/, '').toLowerCase()))]
    interactions.push(...unique)
  }

  // ---- Key validations ----
  const keyValidations: string[] = []
  if (source.includes('recorded_at') && (/!= NULL|!== null|IS NOT NULL/.test(source))) {
    keyValidations.push('recorded_at != NULL for milestone completion')
  }

  // ---- HTTP methods (API routes) ----
  const httpMethods: string[] = []
  if (scope === 'api') {
    if (/export\s+(?:async\s+)?function\s+GET\b/.test(source)) httpMethods.push('GET')
    if (/export\s+(?:async\s+)?function\s+POST\b/.test(source)) httpMethods.push('POST')
    if (/export\s+(?:async\s+)?function\s+PUT\b/.test(source)) httpMethods.push('PUT')
    if (/export\s+(?:async\s+)?function\s+PATCH\b/.test(source)) httpMethods.push('PATCH')
    if (/export\s+(?:async\s+)?function\s+DELETE\b/.test(source)) httpMethods.push('DELETE')
  }

  // ---- Description hints ----
  let description = ''
  if (scope === 'api') {
    const topComment = source.match(/^\/\/\s*(.+)/m)
    if (topComment && !topComment[1].includes('app/')) description = topComment[1].trim()
  }
  if (scope === 'lib') {
    const exports = new Set<string>()
    const exportPattern = /export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+(\w+)/g
    let expMatch
    while ((expMatch = exportPattern.exec(source)) !== null) exports.add(expMatch[1])
    if (exports.size > 0) {
      description = `Exports: ${Array.from(exports).slice(0, 5).join(', ')}${exports.size > 5 ? '...' : ''}`
    }
  }

  return {
    id,
    name,
    route,
    category,
    description,
    roles,
    reads: Array.from(reads).sort(),
    writes: Array.from(writes).sort(),
    rpcs: Array.from(rpcs).sort(),
    realtime: Array.from(realtime).sort(),
    materialized_views: [],
    components: Array.from(components).sort(),
    interactions,
    api_routes: Array.from(apiRoutes).sort(),
    http_methods: httpMethods,
    ios_exists: false,
    ios_view_name: null,
    calculation_engine: calculationEngine,
    timezone_aware: timezoneAware,
    key_validations: keyValidations,
    state_management: stateManagement,
    notes: `Auto-scanned from ${filePath} (${lines.length} lines)`,
    _scan_confidence: confidence,
    _source_lines: lines.length,
    _scope: scope,
  }
}