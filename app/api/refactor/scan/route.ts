import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { RefactorIssue, IssueType } from '@/app/refactor/page'

// Directories to scan
const SCAN_DIRS = ['app', 'components']
const EXCLUDE_DIRS = ['node_modules', '.next', '.git', 'dist', 'build']
const FILE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js']


export async function POST() {
  try {
    const issues: RefactorIssue[] = []
    const projectRoot = process.cwd()

    // Scan all relevant files
    for (const dir of SCAN_DIRS) {
      const dirPath = path.join(projectRoot, dir)
      if (fs.existsSync(dirPath)) {
        await scanDirectory(dirPath, projectRoot, issues)
      }
    }

    return NextResponse.json({ 
      success: true, 
      issues,
      count: issues.length 
    })
  } catch (error) {
    console.error('Scan error:', error)
    return NextResponse.json(
      { success: false, error: 'Scan failed' },
      { status: 500 }
    )
  }
}

async function scanDirectory(
  dir: string, 
  projectRoot: string, 
  issues: RefactorIssue[]
) {
  const items = fs.readdirSync(dir)

  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      // Skip excluded directories
      if (!EXCLUDE_DIRS.includes(item)) {
        await scanDirectory(fullPath, projectRoot, issues)
      }
    } else if (stat.isFile()) {
      // Check if it's a file we care about
      const ext = path.extname(item)
      if (FILE_EXTENSIONS.includes(ext)) {
        await scanFile(fullPath, projectRoot, issues)
      }
    }
  }
}

async function scanFile(
  filePath: string,
  projectRoot: string,
  issues: RefactorIssue[]
) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const relativePath = path.relative(projectRoot, filePath)

  // ✅ Skip scanning the scanner itself!
  if (relativePath.includes('api/refactor/scan/route.ts')) {
    return
  }

  // Pattern 1: console.log → Toast
  findConsoleLogs(relativePath, lines, issues)

  // Pattern 2: Inline delete confirmations
  findInlineDeleteConfirms(relativePath, lines, issues)

  findIncorrectApiRoutes(relativePath, lines, issues)

  // Pattern 4: Inline spinners
  findInlineSpinners(relativePath, lines, issues)

  // Pattern 5: Inline status badges
  findInlineStatusBadges(relativePath, lines, issues)

  // Pattern 6: Modal state management
  findModalState(relativePath, lines, issues)

  // Pattern 7: Loading state management
  findLoadingState(relativePath, lines, issues)

  // Pattern 8: Pagination logic
  findPaginationLogic(relativePath, lines, issues)

  // Pattern 9: Form validation
  findFormValidation(relativePath, lines, issues)

  // Pattern 10: Error states
  findErrorStates(relativePath, lines, issues)

  // Pattern 11: Empty states
  findEmptyStates(relativePath, lines, issues)

  // Pattern 12: Search/filter inputs
  findSearchInputs(relativePath, lines, issues)

  // Pattern 13: Action button groups
  findActionButtonGroups(relativePath, lines, issues)

  // Pattern 14: Title attribute tooltips
  findTitleTooltips(relativePath, lines, issues)

  // Pattern 15: Table with sorting
  findSortableTables(relativePath, lines, issues)
}
function detectCatchBlock(lines: string[], currentIndex: number): boolean {
  // Look backwards up to 20 lines for "} catch"
  for (let i = Math.max(0, currentIndex - 20); i < currentIndex; i++) {
    if (lines[i].includes('} catch') || lines[i].includes('catch (')) {
      // Make sure we haven't exited the catch block
      let braceCount = 0
      for (let j = i; j <= currentIndex; j++) {
        braceCount += (lines[j].match(/{/g) || []).length
        braceCount -= (lines[j].match(/}/g) || []).length
      }
      // If braceCount > 0, we're still inside the catch block
      return braceCount > 0
    }
  }
  return false
}
function parseConsoleArgs(args: string, isInCatchBlock: boolean): { message: string, hasErrorVar: boolean } {
  // Check if args contain an error variable
  const hasErrorVar = /\b(error|err|e)\b/.test(args)
  
  if (!hasErrorVar) {
    // No error variable - simple string interpolation
    // Handle patterns like: 'Error:', someVar
    const parts = args.split(',').map(s => s.trim())
    if (parts.length === 1) {
      // Single argument
      return { message: parts[0], hasErrorVar: false }
    } else {
      // Multiple arguments - combine into template literal
      const combined = parts.map(p => {
        // If it's a string literal, extract the content
        const stringMatch = p.match(/^['"`](.+)['"`]$/)
        if (stringMatch) return stringMatch[1]
        return `\${${p}}`
      }).join(' ')
      return { message: `\`${combined}\``, hasErrorVar: false }
    }
  }
  
  // Has error variable - need TypeScript-safe handling
  if (isInCatchBlock) {
    // In catch block - use type guard
    const stringPart = args.split(',')[0].replace(/['"]/g, '')
    
    // Check which error variable name is used
    const errorVarMatch = args.match(/\b(error|err|e)\b/)
    const errorVar = errorVarMatch ? errorVarMatch[1] : 'error'
    
    return {
      message: `${errorVar} instanceof Error ? ${errorVar}.message : '${stringPart}'`,
      hasErrorVar: true
    }
  } else {
    // Not in catch block - still use type guard for safety
    const stringPart = args.split(',')[0].replace(/['"]/g, '')
    const errorVarMatch = args.match(/\b(error|err|e)\b/)
    const errorVar = errorVarMatch ? errorVarMatch[1] : 'error'
    
    return {
      message: `${errorVar} instanceof Error ? ${errorVar}.message : '${stringPart}'`,
      hasErrorVar: true
    }
  }
}
function findInlineDeleteConfirms(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const deletePattern = /deleteConfirm|confirmDelete|showDeleteConfirm/

  lines.forEach((line, index) => {
    if (deletePattern.test(line)) {
      const lineNum = index + 1
      const context = getContext(lines, index, 10)

      // Look for the pattern with conditional rendering
      if (context.includes('?') && context.includes(':')) {
        issues.push({
          id: `${file}-${lineNum}-delete`,
          file,
          line: lineNum,
          type: 'delete-confirm',
          risk: 'manual',
          description: 'Replace inline delete confirmation with ConfirmDialog component',
          beforeCode: context.slice(0, 300) + '...',
          afterCode: `const { confirmDialog, showConfirm } = useConfirmDialog()

<button onClick={() => showConfirm({
  variant: 'danger',
  title: 'Delete item?',
  message: 'This cannot be undone',
  onConfirm: async () => {
    await handleDelete(id)
    showToast({ type: 'success', title: 'Deleted' })
  }
})}>
  Delete
</button>

{/* Add at bottom of component */}
{confirmDialog}`,
          context,
          imports: [
            "import { useConfirmDialog } from '@/components/ui/ConfirmDialog'",
            "import { useToast } from '@/components/ui/Toast/ToastProvider'",
          ],
          warnings: [
            'Manual refactoring required - review surrounding code',
            'Remove old deleteConfirm state and conditional rendering',
          ],
        })
      }
    }
  })
}
function findConsoleLogs(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  // ========================================
  // NEW: Skip API routes (server-side code)
  // ========================================
  if (isApiRoute(file)) {
    // API routes should keep console.error for server-side logging
    // Don't suggest toast conversions for server-side code
    return
  }
  
  lines.forEach((line, index) => {
    // Match console.log, console.error, console.warn
    if (line.includes('console.log') || line.includes('console.error') || line.includes('console.warn')) {
      const lineNum = index + 1
      
      // Determine toast type based on console method
      let toastType = 'info'
      if (line.includes('console.error')) toastType = 'error'
      else if (line.includes('console.warn')) toastType = 'warning'
      
      // Extract the console call
      const consoleMatch = line.match(/console\.(log|error|warn)\((.*)\)/)
      if (!consoleMatch) return
      
      const args = consoleMatch[2]
      
      // Check if this is in a catch block by looking at surrounding context
      const isInCatchBlock = detectCatchBlock(lines, index)
      
      // Parse the arguments
      let title = 'Notification'
      let messageCode = ''
      
      // Enhanced message parsing with TypeScript safety
      const { message, hasErrorVar } = parseConsoleArgs(args, isInCatchBlock)
      messageCode = message
      
      // If first arg is a string, use it as title
      const titleMatch = args.match(/^['"`]([^'"`]+)['"`]/)
      if (titleMatch) {
        title = titleMatch[1]
      }
      
      // Generate TypeScript-safe afterCode
      const afterCode = `showToast({
  type: '${toastType}',
  title: '${title}',
  message: ${messageCode}
})`

      const context = getContext(lines, index, 5)

      issues.push({
        id: `${file}-${lineNum}-console-log`,
        file,
        line: lineNum,
        type: 'console-log',
        risk: 'safe',
        description: `Replace console.${consoleMatch[1]} with toast notification`,
        beforeCode: line.trim(),
        afterCode,
        context,
        imports: ["import { useToast } from '@/components/ui/Toast/ToastProvider'"],
        warnings: [
          'Add useToast hook: const { showToast } = useToast()',
          hasErrorVar 
            ? '✅ Generated TypeScript-safe error handling'
            : 'Remember to wrap in try-catch if showing errors'
        ],
      })
    }
  })
}

function isApiRoute(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  
  return (
    // App router: ANY route.ts/route.js in app directory
    (normalized.startsWith('app/') && normalized.endsWith('/route.ts')) ||
    (normalized.startsWith('app/') && normalized.endsWith('/route.js')) ||
    // Pages router: files in pages/api
    (normalized.startsWith('pages/api/'))
  )
}



function findInlineSpinners(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const spinnerPattern = /animate-spin|loading|spinner/i

  lines.forEach((line, index) => {
    if (spinnerPattern.test(line) && line.includes('className')) {
      const lineNum = index + 1
      const trimmed = line.trim()

      // Check if it's actually creating a spinner div
      if (trimmed.includes('div') && trimmed.includes('animate-spin')) {
        issues.push({
          id: `${file}-${lineNum}-spinner`,
          file,
          line: lineNum,
          type: 'inline-spinner',
          risk: 'safe',
          description: 'Replace inline spinner with Spinner component',
          beforeCode: trimmed,
          afterCode: '<Spinner size="md" />',
          context: getContext(lines, index, 3),
          imports: [
            "import { Spinner } from '@/components/ui/Loading'"
          ],
        })
      }
    }
  })
}

function findInlineStatusBadges(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const badgePattern = /<span[^>]*className[^>]*(bg-blue-50|bg-emerald-50|bg-amber-50|bg-red-50)[^>]*>/

  lines.forEach((line, index) => {
    if (badgePattern.test(line)) {
      const lineNum = index + 1
      const context = getContext(lines, index, 5)

      // Check if this looks like a status badge
      if (context.match(/status|scheduled|completed|in_progress/i)) {
        issues.push({
          id: `${file}-${lineNum}-badge`,
          file,
          line: lineNum,
          type: 'status-badge',
          risk: 'safe',
          description: 'Replace inline status badge with StatusBadge component',
          beforeCode: line.trim().slice(0, 150) + '...',
          afterCode: '<StatusBadge status={status} />',
          context,
          imports: [
            "import { StatusBadge } from '@/components/ui/StatusBadge'"
          ],
        })
      }
    }
  })
}

function findModalState(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const modalStatePattern = /useState<(boolean|string|null|undefined)>\((false|null|undefined|''|"")\)|const\s+\[(show\w*Modal|is\w*Open|\w*DialogOpen)/

  lines.forEach((line, index) => {
    if (modalStatePattern.test(line)) {
      const lineNum = index + 1
      const trimmed = line.trim()

      // Extract state variable name
      const match = line.match(/const\s+\[(\w+),\s*set\w+\]/)
      if (!match) return

      const stateName = match[1]

      // Check if it's modal-related
      if (stateName.toLowerCase().includes('modal') || 
          stateName.toLowerCase().includes('dialog') ||
          stateName.toLowerCase().includes('open') ||
          stateName.toLowerCase().includes('show')) {

        issues.push({
          id: `${file}-${lineNum}-modal-state`,
          file,
          line: lineNum,
          type: 'modal-state' as IssueType,
          risk: 'review',
          description: 'Modal state management - consider using a shared modal pattern or hook',
          beforeCode: trimmed,
          afterCode: `// Option 1: Use existing modal components
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
const { confirmDialog, showConfirm } = useConfirmDialog()

// Option 2: Create a custom modal hook
import { useModal } from '@/hooks/useModal'
const { isOpen, open, close } = useModal()`,
          context: getContext(lines, index, 5),
          warnings: [
            'Consider if this modal could use ConfirmDialog or a shared modal component',
            'Could create a custom useModal hook for reusable modal state'
          ],
        })
      }
    }
  })
}

function findLoadingState(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const loadingPattern = /useState<boolean>\((true|false)\)|const\s+\[(loading|isLoading|fetching|isFetching)/

  lines.forEach((line, index) => {
    if (loadingPattern.test(line)) {
      const lineNum = index + 1
      const trimmed = line.trim()
      const context = getContext(lines, index, 10)

      // Check if there's conditional rendering based on loading
      if (context.includes('loading') && context.includes('?')) {
        issues.push({
          id: `${file}-${lineNum}-loading-state`,
          file,
          line: lineNum,
          type: 'loading-state' as IssueType,
          risk: 'safe',
          description: 'Use existing Loading/Skeleton components instead of custom loading state UI',
          beforeCode: trimmed,
          afterCode: `// Instead of custom loading UI, use:
import { Spinner, PageLoader, Skeleton } from '@/components/ui/Loading'

{loading ? (
  <Skeleton.Card /> // or <Spinner /> or <PageLoader />
) : (
  <YourContent />
)}`,
          context,
          imports: [
            "import { Spinner, Skeleton, PageLoader } from '@/components/ui/Loading'"
          ],
          warnings: [
            'You already have comprehensive Loading/Skeleton components - use them!'
          ],
        })
      }
    }
  })
}

function findPaginationLogic(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const paginationPattern = /useState<number>\(([01])\)|const\s+\[(currentPage|page|pageNumber)/

  lines.forEach((line, index) => {
    if (paginationPattern.test(line)) {
      const lineNum = index + 1
      const context = getContext(lines, index, 15)
      const fullFileContent = lines.join('\n')

      // Look for pagination logic (next, prev, total pages, etc.)
      if (context.match(/totalPages|nextPage|prevPage|itemsPerPage|pageSize/i)) {
        
        // ========================================
        // ENHANCED: Detect server-side vs client-side
        // ========================================
        let paginationType: 'server-side' | 'client-side' | 'unknown' = 'unknown'
        let confidence: 'high' | 'medium' | 'low' = 'low'
        const evidence: string[] = []
        
        // Server-side indicators
        if (fullFileContent.includes('.range(')) {
          paginationType = 'server-side'
          confidence = 'high'
          evidence.push('Detected .range() - Supabase/API pagination')
        } else if (fullFileContent.match(/[?&](page|offset|limit)=/)) {
          paginationType = 'server-side'
          confidence = 'high'
          evidence.push('Detected API query parameters')
        } else if (fullFileContent.includes('totalCount') && !fullFileContent.includes('.length')) {
          paginationType = 'server-side'
          confidence = 'medium'
          evidence.push('Uses totalCount from API')
        }
        
        // Client-side indicators
        if (fullFileContent.includes('.slice(') && fullFileContent.includes('startIndex')) {
          paginationType = 'client-side'
          confidence = 'high'
          evidence.push('Detected array .slice() with startIndex')
        } else if (fullFileContent.includes('.length') && fullFileContent.includes('itemsPerPage')) {
          if (paginationType === 'unknown') {
            paginationType = 'client-side'
            confidence = 'medium'
            evidence.push('Uses array.length for pagination')
          }
        }
        
        // ========================================
        // ENHANCED: Find all related code locations
        // ========================================
        const relatedLocations: Array<{ line: number; code: string; type: string }> = []
        
        lines.forEach((l, i) => {
          // Find button handlers
          if (l.includes('onClick') && (l.includes('setCurrentPage') || l.includes('setPage'))) {
            relatedLocations.push({
              line: i + 1,
              code: l.trim(),
              type: 'button-handler'
            })
          }
          
          // Find API/range calls
          if (l.includes('.range(') && (l.includes('currentPage') || l.includes('page'))) {
            relatedLocations.push({
              line: i + 1,
              code: l.trim(),
              type: 'api-call'
            })
          }
          
          // Find array slicing
          if (l.includes('.slice(') && (l.includes('startIndex') || l.includes('currentPage'))) {
            relatedLocations.push({
              line: i + 1,
              code: l.trim(),
              type: 'array-slice'
            })
          }
          
          // Find useEffect dependencies
          if (l.includes('useEffect') || (i > 0 && lines[i-1].includes('useEffect'))) {
            if (l.includes('currentPage') || l.includes('page')) {
              relatedLocations.push({
                line: i + 1,
                code: l.trim(),
                type: 'useEffect-dependency'
              })
            }
          }
        })
        
        // ========================================
        // ENHANCED: Generate type-specific fix
        // ========================================
        let afterCode = ''
        let description = 'Extract pagination logic to usePagination hook'
        
        if (paginationType === 'server-side') {
          description = `Server-side pagination detected: Extract to usePagination hook`
          afterCode = `// Server-side pagination (fetches from API)
import { usePagination } from '@/hooks/usePagination'

const pagination = usePagination({
  totalItems: totalCount,  // From API response
  itemsPerPage: 50,
})

// In your fetch function:
const from = (pagination.currentPage - 1) * pagination.itemsPerPage
const to = from + pagination.itemsPerPage - 1
query = query.range(from, to)

// Buttons:
<button onClick={pagination.prevPage} disabled={!pagination.canGoPrev}>
  Previous
</button>
<button onClick={pagination.nextPage} disabled={!pagination.canGoNext}>
  Next
</button>`
        } else if (paginationType === 'client-side') {
          description = `Client-side pagination detected: Extract to usePagination hook`
          afterCode = `// Client-side pagination (slices local array)
import { usePagination } from '@/hooks/usePagination'

const pagination = usePagination({
  totalItems: items.length,  // Local array
  itemsPerPage: 50,
})

// Slice the array:
const currentItems = items.slice(pagination.startIndex, pagination.endIndex)

// Buttons:
<button onClick={pagination.prevPage} disabled={!pagination.canGoPrev}>
  Previous
</button>
<button onClick={pagination.nextPage} disabled={!pagination.canGoNext}>
  Next
</button>`
        } else {
          // Unknown type - provide both options
          afterCode = `// Option 1: Server-side (if fetching from API)
const pagination = usePagination({
  totalItems: totalCount,
  itemsPerPage: 50,
})

// Option 2: Client-side (if slicing local array)
const pagination = usePagination({
  totalItems: items.length,
  itemsPerPage: 50,
})
const currentItems = items.slice(pagination.startIndex, pagination.endIndex)`
        }
        
        // ========================================
        // ENHANCED: Build warnings with evidence
        // ========================================
        const warnings: string[] = [
          'Pagination logic is duplicated across 4 files',
        ]
        
        if (paginationType !== 'unknown') {
          warnings.push(`Detected as ${paginationType} pagination (${confidence} confidence)`)
        }
        
        if (evidence.length > 0) {
          warnings.push(`Evidence: ${evidence.join(', ')}`)
        }
        
        if (relatedLocations.length > 0) {
          warnings.push(`Found ${relatedLocations.length} related code locations that need updating`)
        }
        
        // ========================================
        // Push the enhanced issue
        // ========================================
        issues.push({
          id: `${file}-${lineNum}-pagination`,
          file,
          line: lineNum,
          type: 'pagination' as IssueType,
          risk: 'review',
          description,
          beforeCode: context.slice(0, 300) + '...',
          afterCode,
          context,
          warnings,
          metadata: {
            paginationType,
            confidence,
            relatedLocations,
            evidence,
            autoFixable: confidence === 'high',
          }
        })
      }
    }
  })
}
function findIncorrectApiRoutes(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  // Only scan API routes
  if (!isApiRoute(file)) {
    return
  }
  
  // Check if this API route is using useToast (bad!)
  let hasUseToastImport = false
  let importLine = -1
  let hasShowToastCall = false
  const showToastLines: number[] = []
  
  lines.forEach((line, index) => {
    // Check for useToast import
    if (line.includes("import { useToast }") || line.includes("from '@/components/ui/Toast/ToastProvider'")) {
      hasUseToastImport = true
      importLine = index + 1
    }
    
    // Check for useToast() call
    if (line.includes('useToast()')) {
      hasUseToastImport = true
      importLine = index + 1
    }
    
    // Check for showToast calls
    if (line.includes('showToast(')) {
      hasShowToastCall = true
      showToastLines.push(index + 1)
    }
  })
  
  // If API route is using toasts, flag it!
  if (hasUseToastImport || hasShowToastCall) {
    const lineNum = importLine > 0 ? importLine : showToastLines[0] || 1
    
    issues.push({
      id: `${file}-${lineNum}-api-route-toast`,
      file,
      line: lineNum,
      type: 'console-log', // Keep same type for filtering
      risk: 'manual',
      description: `⚠️ API route incorrectly uses React hooks (will crash!)`,
      beforeCode: hasUseToastImport 
        ? "import { useToast } from '@/components/ui/Toast/ToastProvider'"
        : "showToast({ ... })",
      afterCode: "// API routes should use console.error() instead of toasts\nconsole.error('Error:', error)",
      context: getContext(lines, importLine > 0 ? importLine - 1 : 0, 10),
      warnings: [
        '🚨 CRITICAL: API routes run on the SERVER and cannot use React hooks!',
        `Found useToast import or showToast() calls in this API route`,
        `This will cause runtime error: "Hooks can only be called inside of a component"`,
        `Remove all useToast imports and showToast() calls`,
        `Use console.error() for server-side logging instead`,
        showToastLines.length > 0 
          ? `Found ${showToastLines.length} showToast() calls at lines: ${showToastLines.join(', ')}`
          : 'Found useToast import'
      ],
    })
  }
}

function findFormValidation(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const validationPattern = /if\s*\(\s*!.*\.(name|email|value|length|trim)\s*\)\s*\{/

  lines.forEach((line, index) => {
    if (validationPattern.test(line)) {
      const lineNum = index + 1
      const context = getContext(lines, index, 8)

      // Check if it's form validation (has return, setError, or error message)
      if (context.match(/return|setError|required|invalid|must|should/i)) {
        issues.push({
          id: `${file}-${lineNum}-validation`,
          file,
          line: lineNum,
          type: 'form-validation' as IssueType,
          risk: 'review',
          description: 'Extract form validation to shared validation utilities or schema',
          beforeCode: context.slice(0, 200) + '...',
          afterCode: `// Option 1: Use a validation library
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
})

// Option 2: Create shared validators
import { validators } from '@/lib/validators'

const errors = validators.validateForm(formData, {
  name: 'required',
  email: 'required|email',
})`,
          context,
          warnings: [
            'Form validation is duplicated across 41 files!',
            'Consider using a validation library (zod, yup) or shared validators'
          ],
        })
      }
    }
  })
}

function findErrorStates(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const errorStatePattern = /useState<(string|null|Error)>\(null\)|const\s+\[error,\s*setError\]/

  lines.forEach((line, index) => {
    if (errorStatePattern.test(line)) {
      const lineNum = index + 1
      const context = getContext(lines, index, 10)

      // Check if error is rendered inline
      if (context.match(/error\s*&&.*text-red|error\s*\?.*danger|error.*className/i)) {
        issues.push({
          id: `${file}-${lineNum}-error-state`,
          file,
          line: lineNum,
          type: 'error-display' as IssueType,
          risk: 'safe',
          description: 'Use Alert component for error display instead of inline error UI',
          beforeCode: context.slice(0, 200) + '...',
          afterCode: `import { Alert } from '@/components/ui/Alert'

{error && (
  <Alert variant="error" title="Error" dismissible>
    {error}
  </Alert>
)}

// OR use toast for temporary errors:
showToast({ 
  type: 'error', 
  title: 'Error', 
  message: error 
})`,
          context,
          imports: [
            "import { Alert } from '@/components/ui/Alert'",
            "// OR",
            "import { useToast } from '@/components/ui/Toast/ToastProvider'"
          ],
          warnings: [
            'You already have Alert component - use it for inline errors',
            'Or use Toast for temporary error messages'
          ],
        })
      }
    }
  })
}

function findEmptyStates(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const emptyPattern = /\.length\s*===\s*0.*&&|\.length\s*===\s*0.*\?|!.*\.length.*&&/

  lines.forEach((line, index) => {
    if (emptyPattern.test(line)) {
      const lineNum = index + 1
      const context = getContext(lines, index, 8)

      // Check if it renders an empty state message
      if (context.match(/No\s+(items|data|results|cases|users)|empty|nothing\s+found/i)) {
        issues.push({
          id: `${file}-${lineNum}-empty-state`,
          file,
          line: lineNum,
          type: 'empty-state' as IssueType,
          risk: 'safe',
          description: 'Use EmptyState component instead of inline empty state UI',
          beforeCode: context.slice(0, 200) + '...',
          afterCode: `import { EmptyState } from '@/components/ui/EmptyState'

{items.length === 0 && (
  <EmptyState
    icon={<InboxIcon />}
    title="No items found"
    description="Get started by creating your first item"
    action={{
      label: "Create Item",
      onClick: handleCreate
    }}
  />
)}`,
          context,
          imports: [
            "import { EmptyState } from '@/components/ui/EmptyState'"
          ],
          warnings: [
            'You already have EmptyState component with icons and actions'
          ],
        })
      }
    }
  })
}

function findSearchInputs(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const searchPattern = /<input[^>]*(placeholder\s*=\s*["']Search|type\s*=\s*["']search)/i

  lines.forEach((line, index) => {
    if (searchPattern.test(line)) {
      const lineNum = index + 1
      const context = getContext(lines, index, 5)

      issues.push({
        id: `${file}-${lineNum}-search-input`,
        file,
        line: lineNum,
        type: 'search-input' as IssueType,
        risk: 'review',
        description: 'Consider creating a reusable SearchInput component',
        beforeCode: line.trim(),
        afterCode: `import { SearchInput } from '@/components/ui/SearchInput'

<SearchInput
  value={searchTerm}
  onChange={setSearchTerm}
  placeholder="Search..."
  onClear={() => setSearchTerm('')}
/>`,
        context,
        warnings: [
          'Search inputs are likely duplicated across multiple pages',
          'A shared SearchInput component ensures consistent UX'
        ],
      })
    }
  })
}

function findActionButtonGroups(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const actionPattern = /<button[^>]*Edit.*<button[^>]*Delete|<button[^>]*View.*<button[^>]*Edit/i

  lines.forEach((line, index) => {
    if (actionPattern.test(line)) {
      const lineNum = index + 1
      const context = getContext(lines, index, 5)

      issues.push({
        id: `${file}-${lineNum}-action-buttons`,
        file,
        line: lineNum,
        type: 'action-buttons' as IssueType,
        risk: 'review',
        description: 'Extract repeated action button groups to TableActions component',
        beforeCode: context.slice(0, 200) + '...',
        afterCode: `import { TableActions } from '@/components/ui/TableActions'

<TableActions
  onEdit={() => handleEdit(item.id)}
  onDelete={() => handleDelete(item.id)}
  onView={() => handleView(item.id)}
  editTooltip="Edit item"
  deleteTooltip="Delete item"
/>`,
        context,
        warnings: [
          'Action buttons are repeated across many table rows',
          'A TableActions component ensures consistent spacing and tooltips'
        ],
      })
    }
  })
}

function findTitleTooltips(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const titlePattern = /title\s*=\s*["'][^"']+["']/

  lines.forEach((line, index) => {
    if (titlePattern.test(line) && (line.includes('button') || line.includes('icon'))) {
      const lineNum = index + 1
      const match = line.match(/title\s*=\s*["']([^"']+)["']/)
      if (!match) return

      const tooltipText = match[1]

      issues.push({
        id: `${file}-${lineNum}-title-tooltip`,
        file,
        line: lineNum,
        type: 'title-tooltip' as IssueType,
        risk: 'safe',
        description: 'Replace ugly browser tooltip with professional Tooltip component',
        beforeCode: line.trim(),
        afterCode: `import { TooltipIconButton } from '@/components/ui/Tooltip'

<TooltipIconButton
  tooltip="${tooltipText}"
  icon={<YourIcon />}
  onClick={handleClick}
  aria-label="${tooltipText}"
/>`,
        context: getContext(lines, index, 3),
        imports: [
          "import { Tooltip, TooltipIconButton } from '@/components/ui/Tooltip'"
        ],
        warnings: [
          'Browser tooltips (title attribute) look unprofessional',
          'Tooltip component provides better UX with positioning and styling'
        ],
      })
    }
  })
}

function findSortableTables(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const sortPattern = /<th[^>]*onClick.*sort|handleSort|toggleSort|sortBy/i

  lines.forEach((line, index) => {
    if (sortPattern.test(line)) {
      const lineNum = index + 1
      const context = getContext(lines, index, 10)

      // Check if there's sorting logic
      if (context.match(/sortBy|sortDirection|ascending|descending/i)) {
        issues.push({
          id: `${file}-${lineNum}-sortable-table`,
          file,
          line: lineNum,
          type: 'sortable-table' as IssueType,
          risk: 'manual',
          description: 'Extract table with sorting to reusable DataTable component',
          beforeCode: context.slice(0, 300) + '...',
          afterCode: `import { DataTable } from '@/components/ui/DataTable'

<DataTable
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'date', label: 'Date', sortable: true },
  ]}
  data={items}
  defaultSort={{ key: 'name', direction: 'asc' }}
  onRowClick={(item) => handleRowClick(item)}
/>`,
          context,
          warnings: [
            'Table logic (sorting, pagination, filtering) is complex to duplicate',
            'DataTable component would centralize this logic',
            'Requires manual refactoring but saves significant maintenance time'
          ],
        })
      }
    }
  })
}

// ============================================
// HELPERS
// ============================================

function getContext(lines: string[], index: number, range: number): string {
  const start = Math.max(0, index - range)
  const end = Math.min(lines.length, index + range + 1)
  
  return lines
    .slice(start, end)
    .map((line, i) => {
      const lineNum = start + i + 1
      const marker = start + i === index ? '→ ' : '  '
      return `${marker}${lineNum.toString().padStart(4)} | ${line}`
    })
    .join('\n')
}