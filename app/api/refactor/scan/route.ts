import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { RefactorIssue, RiskLevel, IssueType } from '@/app/refactor/page'

// Directories to scan
const SCAN_DIRS = ['app', 'components']
const EXCLUDE_DIRS = ['node_modules', '.next', '.git', 'dist', 'build']
const FILE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js']

interface PatternMatch {
  line: number
  match: string
  context: string
}

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

  // Pattern 1: console.log → Toast
  findConsoleLogs(relativePath, lines, issues)

  // Pattern 2: Inline delete confirmations
  findInlineDeleteConfirms(relativePath, lines, issues)

  // Pattern 3: Hardcoded colors
  findHardcodedColors(relativePath, lines, issues)

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

// ============================================
// PATTERN DETECTORS
// ============================================

function findConsoleLogs(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const consolePattern = /console\.(log|error|warn|info)\(/

  lines.forEach((line, index) => {
    if (consolePattern.test(line)) {
      const lineNum = index + 1
      const trimmed = line.trim()

      // Skip if it's a comment
      if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
        return
      }

      // Extract the message
      const match = line.match(/console\.(log|error|warn|info)\((.*)\)/)
      if (!match) return

      const type = match[1]
      const message = match[2].trim()

      // Determine risk level
      let risk: RiskLevel = 'safe'
      let warnings: string[] = []

      // Check context for risk factors
      const context = getContext(lines, index, 3)

      if (context.toLowerCase().includes('for') || 
          context.toLowerCase().includes('foreach') ||
          context.toLowerCase().includes('map')) {
        risk = 'review'
        warnings.push('Inside a loop - may cause multiple toasts')
      }

      if (context.includes('try') && context.includes('catch')) {
        risk = 'review'
        warnings.push('Inside try/catch - verify error handling')
      }

      // Generate suggested fix
      let toastType = 'info'
      let afterCode = ''

      if (type === 'error') {
        toastType = 'error'
        afterCode = `showToast({ 
  type: 'error', 
  title: 'Error',
  message: ${message}
})`
      } else if (type === 'warn') {
        toastType = 'warning'
        afterCode = `showToast({ 
  type: 'warning', 
  title: 'Warning',
  message: ${message}
})`
      } else {
        // Infer from message content
        if (message.toLowerCase().includes('success') || 
            message.toLowerCase().includes('saved') ||
            message.toLowerCase().includes('deleted') ||
            message.toLowerCase().includes('created')) {
          toastType = 'success'
        }
        afterCode = `showToast({ 
  type: '${toastType}', 
  title: ${message}
})`
      }

      issues.push({
        id: `${file}-${lineNum}-console`,
        file,
        line: lineNum,
        type: 'console-log',
        risk,
        description: `Replace console.${type} with user-visible toast notification`,
        beforeCode: trimmed,
        afterCode,
        context: getContext(lines, index, 5),
        imports: [
          "import { useToast } from '@/components/ui/Toast/ToastProvider'",
          "const { showToast } = useToast()"
        ],
        warnings: warnings.length > 0 ? warnings : undefined,
      })
    }
  })
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

function findHardcodedColors(
  file: string,
  lines: string[],
  issues: RefactorIssue[]
) {
  const colorPattern = /['"`](bg|text|border)-(blue|emerald|amber|red|slate|green|yellow|orange|purple|pink|indigo)-(\d+)['"`]/g

  lines.forEach((line, index) => {
    const matches = [...line.matchAll(colorPattern)]
    
    if (matches.length > 0) {
      const lineNum = index + 1
      const trimmed = line.trim()

      // Check if this looks like a status-related color
      const context = getContext(lines, index, 5)
      const isStatus = context.match(/status|completed|scheduled|in_progress|delayed|cancelled|active|inactive/i)

      if (isStatus) {
        issues.push({
          id: `${file}-${lineNum}-color`,
          file,
          line: lineNum,
          type: 'hardcoded-color',
          risk: 'safe',
          description: 'Replace hardcoded status colors with design tokens',
          beforeCode: trimmed,
          afterCode: `import { getStatusColors } from '@/lib/design-tokens'

const colors = getStatusColors(status)
// Use: colors.bg, colors.text, colors.border, etc.`,
          context,
          imports: [
            "import { getStatusColors } from '@/lib/design-tokens'"
          ],
        })
      }
    }
  })
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

      // Look for pagination logic (next, prev, total pages, etc.)
      if (context.match(/totalPages|nextPage|prevPage|itemsPerPage|pageSize/i)) {
        issues.push({
          id: `${file}-${lineNum}-pagination`,
          file,
          line: lineNum,
          type: 'pagination' as IssueType,
          risk: 'review',
          description: 'Extract pagination logic to reusable DataTable or usePagination hook',
          beforeCode: context.slice(0, 300) + '...',
          afterCode: `// Create a reusable pagination hook or component
import { usePagination } from '@/hooks/usePagination'

const { 
  currentPage, 
  totalPages, 
  nextPage, 
  prevPage, 
  goToPage 
} = usePagination({ 
  totalItems, 
  itemsPerPage: 10 
})`,
          context,
          warnings: [
            'Pagination logic is duplicated across 4 files',
            'Consider creating a shared DataTable component with built-in pagination'
          ],
        })
      }
    }
  })
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