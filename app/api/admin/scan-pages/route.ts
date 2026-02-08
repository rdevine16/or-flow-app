// app/api/admin/scan-pages/route.ts
// Scans the ENTIRE project for all TypeScript files and extracts metadata.
// GET ?scope=all|pages|api|layouts|lib|components|infra — list discovered files
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

type FileScope = 'pages' | 'api' | 'layouts' | 'lib' | 'components' | 'infra'

interface DiscoveredFile {
  filePath: string
  route: string
  fileName: string
  scope: FileScope
  sizeBytes: number
  lastModified: string
}

// =============================================================================
// Directories to always skip
// =============================================================================

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', '.vercel', '.turbo',
  'coverage', 'dist', 'build', '__tests__', '__mocks__',
])

/** Directories already covered by their own scope */
const SCOPED_DIRS = new Set(['app', 'lib', 'components'])

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

    // ── 1. Pages: app/**/page.tsx (skip api/) ──
    if (scope === 'all' || scope === 'pages') {
      const appDir = path.join(projectRoot, 'app')
      if (fs.existsSync(appDir)) {
        files.push(...findFiles(appDir, projectRoot, 'pages', (name) => {
          return name === 'page.tsx' || name === 'page.ts'
        }, ['api']))
      }
    }

    // ── 2. API routes: app/api/**/route.ts ──
    if (scope === 'all' || scope === 'api') {
      const apiDir = path.join(projectRoot, 'app', 'api')
      if (fs.existsSync(apiDir)) {
        files.push(...findFiles(apiDir, projectRoot, 'api', (name) => {
          return name === 'route.ts' || name === 'route.tsx'
        }))
      }
    }

    // ── 3. Layouts & special Next.js files ──
    if (scope === 'all' || scope === 'layouts') {
      const appDir = path.join(projectRoot, 'app')
      const specialFiles = new Set([
        'layout.tsx', 'layout.ts',
        'loading.tsx', 'loading.ts',
        'error.tsx', 'error.ts',
        'not-found.tsx', 'not-found.ts',
        'template.tsx', 'template.ts',
        'global-error.tsx', 'global-error.ts',
      ])
      if (fs.existsSync(appDir)) {
        files.push(...findFiles(appDir, projectRoot, 'layouts', (name) => {
          return specialFiles.has(name)
        }, ['api']))
      }
    }

    // ── 4. Lib files: lib/**/*.ts(x) ──
    if (scope === 'all' || scope === 'lib') {
      const libDir = path.join(projectRoot, 'lib')
      if (fs.existsSync(libDir)) {
        files.push(...findFiles(libDir, projectRoot, 'lib', (name) => {
          return (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.endsWith('.d.ts')
        }))
      }
    }

    // ── 5. Components: components/**/*.tsx ──
    if (scope === 'all' || scope === 'components') {
      const compDir = path.join(projectRoot, 'components')
      if (fs.existsSync(compDir)) {
        files.push(...findFiles(compDir, projectRoot, 'components', (name) => {
          return name.endsWith('.tsx') || name.endsWith('.ts')
        }))
      }
    }

    // ── 6. Infra: everything else ──
    if (scope === 'all' || scope === 'infra') {
      // 6a. Root-level files (middleware.ts, next.config.ts, tailwind.config.ts, etc.)
      const rootEntries = fs.readdirSync(projectRoot, { withFileTypes: true })
      for (const entry of rootEntries) {
        if (entry.isFile() && isInfraFile(entry.name)) {
          const relativePath = entry.name
          const stat = fs.statSync(path.join(projectRoot, relativePath))
          files.push({
            filePath: relativePath,
            route: relativePath.replace(/\.(tsx?|js|mjs|cjs)$/, ''),
            fileName: entry.name,
            scope: 'infra',
            sizeBytes: stat.size,
            lastModified: stat.mtime.toISOString(),
          })
        }
      }

      // 6b. Auto-discover any top-level directories not already covered
      for (const entry of rootEntries) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('.')) continue
        if (SKIP_DIRS.has(entry.name)) continue
        if (SCOPED_DIRS.has(entry.name)) continue
        // This catches: hooks/, utils/, helpers/, services/, types/, contexts/,
        // providers/, supabase/, config/, styles/, store/, etc.
        const dirPath = path.join(projectRoot, entry.name)
        files.push(...findFiles(dirPath, projectRoot, 'infra', (name) => {
          return (name.endsWith('.ts') || name.endsWith('.tsx') ||
                  name.endsWith('.js') || name.endsWith('.mjs') ||
                  name.endsWith('.css') || name.endsWith('.sql'))
                  && !name.endsWith('.d.ts')
        }))
      }
    }

    return NextResponse.json({ files, stats: buildStats(files) })
  } catch (error: any) {
    console.error('[scan-pages] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** Root-level config/infra files to discover */
function isInfraFile(name: string): boolean {
  if (name === 'middleware.ts' || name === 'middleware.tsx') return true
  if (name.startsWith('next.config')) return true
  if (name.startsWith('tailwind.config')) return true
  if (name.startsWith('postcss.config')) return true
  if (name.startsWith('tsconfig')) return true
  if (name === 'instrumentation.ts') return true
  // Skip non-code config
  return false
}

/** Quick summary stats returned with file list */
function buildStats(files: DiscoveredFile[]) {
  const byScope: Record<string, number> = {}
  for (const f of files) byScope[f.scope] = (byScope[f.scope] || 0) + 1
  return { total: files.length, byScope }
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

    // Security: allow reading from known directories AND root-level infra files
    const isRootInfra = !filePath.includes('/') && isInfraFile(filePath)
    const allowed = isRootInfra || [
      'app', 'lib', 'components',
      // Auto-discovered dirs — allow anything that isn't in SKIP_DIRS
    ].some(dir => fullPath.startsWith(path.join(projectRoot, dir)))

    // Secondary check: block anything in skip dirs
    const pathParts = filePath.split('/')
    const isSkipped = pathParts.some((p: string) => SKIP_DIRS.has(p))

    if (!allowed && !isAutoDiscoveredDir(filePath, projectRoot)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }
    if (isSkipped) {
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

/** Check if a file is in an auto-discovered directory */
function isAutoDiscoveredDir(filePath: string, projectRoot: string): boolean {
  const topDir = filePath.split('/')[0]
  if (!topDir || SKIP_DIRS.has(topDir) || SCOPED_DIRS.has(topDir) || topDir.startsWith('.')) return false
  const fullDir = path.join(projectRoot, topDir)
  try {
    return fs.statSync(fullDir).isDirectory()
  } catch {
    return false
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

    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue

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

  // Next.js special files in app/
  if (filePath.startsWith('app/')) {
    const fileName = filePath.split('/').pop() || ''
    const specialFiles = ['layout.', 'loading.', 'error.', 'not-found.', 'template.', 'global-error.']
    if (specialFiles.some(sf => fileName.startsWith(sf))) return 'layouts'
    if (fileName.startsWith('page.')) return 'pages'
    // Other files in app/ (e.g. globals.css) → layouts scope
    return 'layouts'
  }

  if (filePath.startsWith('lib/')) return 'lib'
  if (filePath.startsWith('components/')) return 'components'

  // Everything else is infra
  return 'infra'
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
    case 'layouts': {
      // Keep full path so layout.tsx in different dirs are distinguishable
      let route = filePath
        .replace(/^app\//, '/')
        .replace(/\.(tsx|ts)$/, '')
      route = route.replace(/\/\([^)]+\)/g, '')
      route = route.replace(/\/+/g, '/')
      return route || '/'
    }
    case 'lib': {
      return filePath.replace(/\.(tsx|ts)$/, '')
    }
    case 'components': {
      return filePath.replace(/\.(tsx|ts)$/, '')
    }
    case 'infra': {
      return filePath.replace(/\.(tsx?|js|mjs|cjs|css|sql)$/, '')
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

  // Default export function name
  const defaultFuncMatch = source.match(/export\s+default\s+function\s+(\w+)/)
  if (defaultFuncMatch) {
    name = defaultFuncMatch[1]
      .replace(/Page$/, '')
      .replace(/Layout$/, '')
      .replace(/Loading$/, '')
      .replace(/Error$/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim()
    confidence['name'] = 'high'
  }

  // Lib, components, infra — use filename
  if (!name && (scope === 'lib' || scope === 'components' || scope === 'infra')) {
    const fileName = filePath.split('/').pop()?.replace(/\.(tsx?|js|mjs|cjs|css|sql)$/, '') || ''
    name = fileName.replace(/([A-Z])/g, ' $1').replace(/[-_.]/g, ' ').trim()
    // Capitalize first letter
    name = name.charAt(0).toUpperCase() + name.slice(1)
    confidence['name'] = 'medium'
  }

  // API routes — use directory path
  if (!name && scope === 'api') {
    const parts = filePath.replace(/^app\/api\//, '').replace(/\/route\.(tsx|ts)$/, '').split('/')
    name = parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, ' ')).join(' ') + ' API'
    confidence['name'] = 'medium'
  }

  // Layouts — use type + route location
  if (!name && scope === 'layouts') {
    const fileName = filePath.split('/').pop()?.replace(/\.(tsx|ts)$/, '') || ''
    const routeSegment = filePath
      .replace(/^app\//, '')
      .replace(/\/[^/]+$/, '')
      .replace(/\([^)]+\)\/?/g, '')
      .replace(/\//g, ' › ')
      .trim()
    const typeLabel = fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/-/g, ' ')
    name = routeSegment ? `${typeLabel} (${routeSegment})` : `Root ${typeLabel}`
    confidence['name'] = 'medium'
  }

  // Fallback
  if (!name) {
    name = route.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ') || 'Unknown'
    name = name.charAt(0).toUpperCase() + name.slice(1)
    confidence['name'] = 'low'
  }

  // ---- ID ----
  const id = (filePath || route)
    .toLowerCase()
    .replace(/\.(tsx?|js|mjs|cjs|css|sql)$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // ---- Category (uses category display names) ----
  let category = 'Shared'
  if (scope === 'api') {
    category = 'API Routes'
  } else if (scope === 'infra') {
    // Sub-categorize infra
    if (filePath.startsWith('middleware')) category = 'Auth'
    else if (filePath.startsWith('hooks/') || filePath.startsWith('contexts/') || filePath.startsWith('providers/')) category = 'Shared'
    else if (filePath.startsWith('types/')) category = 'Shared'
    else if (filePath.startsWith('utils/') || filePath.startsWith('helpers/') || filePath.startsWith('services/')) category = 'Shared'
    else if (filePath.startsWith('supabase/')) category = 'Global Admin'
    else if (filePath.startsWith('styles/')) category = 'Shared'
    else if (filePath.startsWith('store/')) category = 'Shared'
    else category = 'Shared'
  } else if (scope === 'layouts') {
    // Layouts inherit the route's category
    if (filePath.includes('/admin/settings') || filePath.includes('/admin/facilities') || filePath.includes('/admin/audit')) {
      category = 'Global Admin'
    } else if (filePath.includes('/admin')) {
      category = 'Admin'
    } else if (filePath.includes('/login') || filePath.includes('/auth')) {
      category = 'Auth'
    } else {
      category = 'Shared'
    }
  } else if (scope === 'lib') {
    category = 'Shared'
  } else if (scope === 'components') {
    category = 'Shared'
  } else if (scope === 'pages') {
    if (route.startsWith('/admin/settings') || route.startsWith('/admin/facilities') || route.startsWith('/admin/audit')) {
      category = 'Global Admin'
    } else if (route.startsWith('/admin')) {
      category = 'Admin'
    } else if (route === '/login' || route.startsWith('/auth')) {
      category = 'Auth'
    } else {
      category = 'Surgeon-Facing'
    }
  }

  // Global admin override
  if (/isGlobalAdmin/.test(source) && category === 'Shared') category = 'Global Admin'
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
  const defaultImportPattern = /import\s+(\w+)\s+from\s+['"]@\/components\/([^'"]+)['"]/g
  let compMatch
  while ((compMatch = defaultImportPattern.exec(source)) !== null) {
    components.add(compMatch[1])
  }
  const namedImportPattern = /import\s+\{([^}]+)\}\s+from\s+['"]@\/components\/([^'"]+)['"]/g
  let namedMatch
  while ((namedMatch = namedImportPattern.exec(source)) !== null) {
    namedMatch[1].split(',').map((n: string) => n.trim().split(' as ')[0].trim()).forEach((n: string) => { if (n) components.add(n) })
  }
  confidence['components'] = components.size > 0 ? 'high' : 'none'

  // ---- Lib imports (for infra/layouts tracking) ----
  const libImports = new Set<string>()
  const libImportPattern = /from\s+['"]@\/lib\/([^'"]+)['"]/g
  let libMatch
  while ((libMatch = libImportPattern.exec(source)) !== null) libImports.add(libMatch[1])

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
  if (/createContext/.test(source)) smPatterns.push('context provider')
  if (smPatterns.length > 0) stateManagement = `Uses ${smPatterns.join(', ')}`

  // ---- Interactions ----
  const interactions: string[] = []
  const buttonLabels = source.match(/>\s*(Save|Submit|Delete|Add|Create|Update|Cancel|Export|Import|Generate|Refresh|Reset|Clear|Filter|Search|Edit|Remove|Confirm|Download|Upload)\b/gi)
  if (buttonLabels) {
    const unique = [...new Set(buttonLabels.map((b: string) => b.replace(/^>\s*/, '').toLowerCase()))]
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

  // Top-of-file comment
  const topComment = source.match(/^\/\/\s*(.+)/m)
  if (topComment && !topComment[1].includes('app/') && topComment[1].length > 5 && topComment[1].length < 120) {
    description = topComment[1].trim()
  }

  // Lib/infra: list exports
  if (!description && (scope === 'lib' || scope === 'infra')) {
    const exports = new Set<string>()
    const exportPattern = /export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+(\w+)/g
    let expMatch
    while ((expMatch = exportPattern.exec(source)) !== null) exports.add(expMatch[1])
    if (exports.size > 0) {
      description = `Exports: ${Array.from(exports).slice(0, 6).join(', ')}${exports.size > 6 ? ` (+${exports.size - 6} more)` : ''}`
    }
  }

  // Layouts: describe type
  if (!description && scope === 'layouts') {
    const fileName = filePath.split('/').pop()?.replace(/\.(tsx|ts)$/, '') || ''
    const typeDescriptions: Record<string, string> = {
      'layout': 'Wraps child routes with shared UI (navigation, providers)',
      'loading': 'Suspense fallback — shown while route content loads',
      'error': 'Error boundary — catches runtime errors in this segment',
      'not-found': 'Shown when notFound() is called or route doesn\'t match',
      'template': 'Re-creates on navigation (unlike layout which persists)',
      'global-error': 'Root-level error boundary — catches errors in root layout',
    }
    description = typeDescriptions[fileName] || `Next.js ${fileName} file`
  }

  // Components: count lines + hooks used
  if (!description && scope === 'components') {
    const hookMatches = source.match(/use[A-Z]\w+/g)
    const hooks = hookMatches ? [...new Set(hookMatches)].slice(0, 4) : []
    const parts: string[] = [`${lines.length} lines`]
    if (hooks.length > 0) parts.push(`Hooks: ${hooks.join(', ')}`)
    description = parts.join(' · ')
  }

  // Root-level infra files
  if (!description && scope === 'infra' && !filePath.includes('/')) {
    const infraDescriptions: Record<string, string> = {
      'middleware': 'Runs before every request — handles auth redirects, headers',
      'next.config': 'Next.js project configuration',
      'tailwind.config': 'Tailwind CSS theme, plugins, and content paths',
      'postcss.config': 'PostCSS plugin configuration',
      'tsconfig': 'TypeScript compiler options and path aliases',
      'instrumentation': 'Server-side instrumentation (OpenTelemetry, logging)',
    }
    const baseName = filePath.replace(/\.(tsx?|js|mjs|cjs)$/, '')
    description = infraDescriptions[baseName] || ''
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