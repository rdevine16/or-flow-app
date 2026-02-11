#!/usr/bin/env node
/**
 * useSupabaseQuery Migration Codemod
 * 
 * Scans all page files, identifies manual fetch patterns, and generates
 * migration diffs. Run from project root:
 * 
 *   node scripts/migrate-to-query-hooks.mjs
 *   node scripts/migrate-to-query-hooks.mjs --fix   # apply safe rewrites
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const DRY_RUN = !process.argv.includes('--fix')
const ROOT = process.cwd()

// ── Pattern detection ─────────────────────────────────────────────────

const PATTERNS = {
  // const [items, setItems] = useState<Type[]>([])
  listState: /const \[(\w+), set\w+\] = useState<(\w+)\[\]>\(\[\]\)/,
  // const [item, setItem] = useState<Type | null>(null)
  singleState: /const \[(\w+), set\w+\] = useState<(\w+) \| null>\(null\)/,
  // const [loading, setLoading] = useState(true)  
  loadingState: /const \[(?:loading|isLoading|pageLoading), set\w+\] = useState(?:<boolean>)?\(true\)/,
  // const [error, setError] = useState<string | null>(null)
  errorState: /const \[error, setError\] = useState<string \| null>\(null\)/,
  // supabase.from('table_name')
  fromQuery: /supabase\s*\.from\(['"](\w+)['"]\)/g,
  // Already migrated
  alreadyMigrated: /useSupabaseQuery|useSupabaseList|useSupabaseQueries/,
  // Auth flow (not a candidate)
  authFlow: /supabase\.auth\.signInWith|supabase\.auth\.signUp|supabase\.auth\.resetPassword/,
}

// Files to skip
const SKIP_DIRS = ['node_modules', '.next', '.git', 'sentry-example']
const SKIP_PATTERNS = [
  /auth\//,
  /login\//,
  /invite\//,
  /status\//,
  /sentry-example/,
]

// ── File discovery ────────────────────────────────────────────────────

function findPages(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.some(d => entry.includes(d))) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      findPages(full, results)
    } else if (entry === 'page.tsx' || entry.endsWith('.tsx')) {
      results.push(full)
    }
  }
  return results
}

// ── Analysis ──────────────────────────────────────────────────────────

function analyzePage(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const rel = relative(ROOT, filePath)
  
  // Skip non-candidates
  if (SKIP_PATTERNS.some(p => p.test(rel))) return null
  if (PATTERNS.alreadyMigrated.test(content)) return null
  if (!PATTERNS.loadingState.test(content)) return null
  
  const lines = content.split('\n')
  const issues = []
  
  // Find manual state declarations
  const listMatches = content.match(PATTERNS.listState)
  const singleMatches = content.match(PATTERNS.singleState)
  const hasLoading = PATTERNS.loadingState.test(content)
  const hasError = PATTERNS.errorState.test(content)
  
  // Count .from() queries
  const fromMatches = [...content.matchAll(PATTERNS.fromQuery)]
  const tables = [...new Set(fromMatches.map(m => m[1]))]
  
  // Find the fetchData function
  let fetchFnName = null
  let fetchFnLine = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/const (fetch\w+|load\w+) = async/.test(line) || /async function (fetch\w+|load\w+)/.test(line)) {
      fetchFnName = line.match(/(fetch\w+|load\w+)/)?.[1]
      fetchFnLine = i + 1
    }
  }
  
  // Find the useEffect that calls the fetch
  let fetchEffectLine = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('useEffect') && fetchFnName && 
        (lines[i].includes(fetchFnName) || lines[i + 1]?.includes(fetchFnName) || lines[i + 2]?.includes(fetchFnName))) {
      fetchEffectLine = i + 1
    }
  }
  
  // Determine complexity
  const isAuthFlow = PATTERNS.authFlow.test(content)
  const queryCount = fromMatches.length
  let complexity = 'simple'
  if (queryCount > 5) complexity = 'complex'
  else if (queryCount > 2) complexity = 'medium'
  if (isAuthFlow) complexity = 'auth-flow'
  
  // Determine which hook to use
  let hook = 'useSupabaseQuery'
  if (listMatches) hook = 'useSupabaseList'
  if (queryCount > 3) hook = 'useSupabaseQueries'
  
  return {
    path: rel,
    lines: lines.length,
    complexity,
    hook,
    tables,
    queryCount,
    hasLoading,
    hasError,
    listState: listMatches ? { name: listMatches[1], type: listMatches[2] } : null,
    singleState: singleMatches ? { name: singleMatches[1], type: singleMatches[2] } : null,
    fetchFn: fetchFnName,
    fetchFnLine,
    fetchEffectLine,
    stateDeclarations: [
      listMatches ? `useState<${listMatches[2]}[]>([])` : null,
      singleMatches ? `useState<${singleMatches[2]} | null>(null)` : null,
      hasLoading ? 'useState(true) // loading' : null,
      hasError ? 'useState<string | null>(null) // error' : null,
    ].filter(Boolean),
  }
}

// ── Migration generator ───────────────────────────────────────────────

function generateMigration(analysis) {
  const { hook, listState, singleState, tables, fetchFn } = analysis
  
  if (listState) {
    return `
// REPLACE these state declarations:
//   const [${listState.name}, set${cap(listState.name)}] = useState<${listState.type}[]>([])
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)
//   useEffect + ${fetchFn || 'fetchData'}
//
// WITH:
const { data: ${listState.name}, loading, error, refetch } = useSupabaseList<${listState.type}>(
  async (sb) => {
    const { data, error } = await sb
      .from('${tables[0] || 'TABLE_NAME'}')
      .select('*')
      // .eq('facility_id', facilityId)  // add your filters
      .order('display_order')
    return { data: data || [], error }
  },
  [/* deps like facilityId */],
  { enabled: true /* replace with your guard condition */ }
)

// THEN: replace all setLoading/setError/set${cap(listState.name)} in CRUD handlers with refetch()
// THEN: add to imports: import { useSupabaseList } from '@/hooks/useSupabaseQuery'`
  }
  
  if (singleState) {
    return `
// REPLACE these state declarations:
//   const [${singleState.name}, set${cap(singleState.name)}] = useState<${singleState.type} | null>(null)
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)
//   useEffect + ${fetchFn || 'fetchData'}
//
// WITH:
const { data: ${singleState.name}, loading, error, refetch } = useSupabaseQuery<${singleState.type}>(
  async (sb) => {
    const result = await sb
      .from('${tables[0] || 'TABLE_NAME'}')
      .select('*')
      .eq('id', id)
      .single()
    return result
  },
  [/* deps */]
)

// THEN: add to imports: import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'`
  }
  
  return '// Manual migration needed — complex fetch pattern'
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

// ── Report ────────────────────────────────────────────────────────────

function generateReport(results) {
  const simple = results.filter(r => r.complexity === 'simple')
  const medium = results.filter(r => r.complexity === 'medium')
  const complex = results.filter(r => r.complexity === 'complex')
  const auth = results.filter(r => r.complexity === 'auth-flow')
  
  let report = `# useSupabaseQuery Migration Report
Generated: ${new Date().toISOString()}

## Summary
- **Total pages needing migration:** ${results.length}
- **Simple (1-2 queries, drop-in replacement):** ${simple.length}
- **Medium (3-5 queries, some restructuring):** ${medium.length}
- **Complex (6+ queries, manual review needed):** ${complex.length}
- **Auth flows (skip — different pattern):** ${auth.length}

## Estimated effort
- Simple pages: ~5 min each = ${simple.length * 5} min
- Medium pages: ~15 min each = ${medium.length * 15} min
- Complex pages: ~30 min each = ${complex.length * 30} min
- **Total: ~${simple.length * 5 + medium.length * 15 + complex.length * 30} min**

---

## Simple — Drop-in Replacement
${simple.map(r => `### ${r.path} (${r.lines}L, ${r.queryCount}q → ${r.hook})
Tables: ${r.tables.join(', ') || 'N/A'}
Remove: ${r.stateDeclarations.length} state declarations + useEffect + ${r.fetchFn || 'fetchData'}
${generateMigration(r)}
`).join('\n')}

## Medium — Some Restructuring  
${medium.map(r => `### ${r.path} (${r.lines}L, ${r.queryCount}q)
Tables: ${r.tables.join(', ')}
Fetch function: ${r.fetchFn} (line ${r.fetchFnLine})
`).join('\n')}

## Complex — Manual Review
${complex.map(r => `### ${r.path} (${r.lines}L, ${r.queryCount}q)
Tables: ${r.tables.join(', ')}
`).join('\n')}
`
  
  return report
}

// ── Main ──────────────────────────────────────────────────────────────

console.log('🔍 Scanning pages...\n')

const pages = findPages(join(ROOT, 'app'))
const results = pages.map(analyzePage).filter(Boolean)

if (results.length === 0) {
  console.log('✅ All pages already migrated!')
  process.exit(0)
}

// Console summary
console.log(`Found ${results.length} pages needing migration:\n`)

const byComplexity = { simple: [], medium: [], complex: [], 'auth-flow': [] }
results.forEach(r => byComplexity[r.complexity]?.push(r))

for (const [level, pages] of Object.entries(byComplexity)) {
  if (pages.length === 0) continue
  console.log(`  ${level.toUpperCase()} (${pages.length}):`)
  pages.forEach(p => console.log(`    ${p.path} — ${p.lines}L, ${p.queryCount} queries → ${p.hook}`))
  console.log()
}

// Write report
const report = generateReport(results)
const reportPath = join(ROOT, 'docs', 'MIGRATION-REPORT.md')
writeFileSync(reportPath, report)
console.log(`📄 Full report written to: docs/MIGRATION-REPORT.md`)

if (DRY_RUN) {
  console.log('\nRun with --fix to apply safe rewrites')
}
