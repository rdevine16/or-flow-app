// app/api/refactor/scan/pagination-patterns.ts

/**
 * ENHANCED PAGINATION SCANNER
 * Detects server-side vs client-side pagination and provides specific fixes
 */

interface PaginationDetection {
  type: 'server-side' | 'client-side' | 'unknown'
  confidence: 'high' | 'medium' | 'low'
  evidence: string[]
  issues: PaginationIssue[]
}

interface PaginationIssue {
  type: string
  line: number
  code: string
  context: CodeContext
  fix: string
  explanation: string
}

interface CodeContext {
  beforeCode: string
  targetCode: string
  afterCode: string
  startLine: number
  endLine: number
}

/**
 * Detect pagination type by analyzing the code
 */
export function detectPaginationType(content: string): PaginationDetection {
  const lines = content.split('\n')
  
  const evidence: string[] = []
  let type: 'server-side' | 'client-side' | 'unknown' = 'unknown'
  let confidence: 'high' | 'medium' | 'low' = 'low'
  
  // Server-side indicators
  const serverSidePatterns = {
    supabaseRange: /\.range\(/,
    apiPagination: /[?&](page|offset|limit)=/,
    fetchWithPagination: /fetch.*[?&](page|skip|take)/,
    totalCountFromAPI: /totalCount.*count|count.*totalCount/,
    queryRange: /query.*range/,
  }
  
  // Client-side indicators
  const clientSidePatterns = {
    arraySlice: /\.slice\(/,
    startEndIndex: /(startIndex|endIndex)/,
    arrayLength: /\.length.*itemsPerPage|itemsPerPage.*\.length/,
    localPagination: /currentPage.*useState/,
  }
  
  let serverSideScore = 0
  let clientSideScore = 0
  
  // Scan for patterns
  lines.forEach((line, index) => {
    // Check server-side patterns
    if (serverSidePatterns.supabaseRange.test(line)) {
      serverSideScore += 3
      evidence.push(`Line ${index + 1}: Supabase .range() detected (server-side)`)
    }
    if (serverSidePatterns.apiPagination.test(line)) {
      serverSideScore += 2
      evidence.push(`Line ${index + 1}: API pagination params detected`)
    }
    if (serverSidePatterns.totalCountFromAPI.test(line)) {
      serverSideScore += 2
      evidence.push(`Line ${index + 1}: Total count from API detected`)
    }
    
    // Check client-side patterns
    if (clientSidePatterns.arraySlice.test(line)) {
      clientSideScore += 3
      evidence.push(`Line ${index + 1}: Array .slice() detected (client-side)`)
    }
    if (clientSidePatterns.startEndIndex.test(line)) {
      clientSideScore += 2
      evidence.push(`Line ${index + 1}: startIndex/endIndex detected`)
    }
    if (clientSidePatterns.arrayLength.test(line)) {
      clientSideScore += 2
      evidence.push(`Line ${index + 1}: Array.length pagination detected`)
    }
  })
  
  // Determine type and confidence
  if (serverSideScore > clientSideScore && serverSideScore >= 3) {
    type = 'server-side'
    confidence = serverSideScore >= 5 ? 'high' : 'medium'
  } else if (clientSideScore > serverSideScore && clientSideScore >= 3) {
    type = 'client-side'
    confidence = clientSideScore >= 5 ? 'high' : 'medium'
  }
  
  // Find specific issues
  const issues = findPaginationIssues(lines, type)
  
  return {
    type,
    confidence,
    evidence,
    issues,
  }
}

/**
 * Find specific pagination issues based on type
 */
function findPaginationIssues(lines: string[], type: 'server-side' | 'client-side' | 'unknown'): PaginationIssue[] {
  const issues: PaginationIssue[] = []
  
  lines.forEach((line, index) => {
    // Find old pagination state
    if (line.includes('useState') && (line.includes('currentPage') || line.includes('page'))) {
      const context = getCodeContext(lines, index, 3)
      
      if (type === 'server-side') {
        issues.push({
          type: 'pagination-state-server-side',
          line: index + 1,
          code: line.trim(),
          context,
          fix: `const pagination = usePagination({\n  totalItems: totalCount,\n  itemsPerPage: 50,\n})`,
          explanation: 'Server-side pagination: use totalCount from API, not array.length',
        })
      } else if (type === 'client-side') {
        issues.push({
          type: 'pagination-state-client-side',
          line: index + 1,
          code: line.trim(),
          context,
          fix: `const pagination = usePagination({\n  totalItems: items.length,\n  itemsPerPage: 50,\n})\nconst currentItems = items.slice(pagination.startIndex, pagination.endIndex)`,
          explanation: 'Client-side pagination: use array.length and slice with startIndex/endIndex',
        })
      }
    }
    
    // Find setCurrentPage in onClick handlers
    if (line.includes('onClick') && line.includes('setCurrentPage')) {
      const context = getCodeContext(lines, index, 2)
      
      if (line.includes('setCurrentPage(1)')) {
        issues.push({
          type: 'pagination-reset',
          line: index + 1,
          code: line.trim(),
          context,
          fix: 'pagination.reset()',
          explanation: 'Use pagination.reset() instead of setCurrentPage(1)',
        })
      } else if (line.includes('prev') || line.includes('- 1')) {
        issues.push({
          type: 'pagination-previous',
          line: index + 1,
          code: line.trim(),
          context,
          fix: 'onClick={pagination.prevPage}',
          explanation: 'Use pagination.prevPage instead of manual decrement',
        })
      } else if (line.includes('next') || line.includes('+ 1')) {
        issues.push({
          type: 'pagination-next',
          line: index + 1,
          code: line.trim(),
          context,
          fix: 'onClick={pagination.nextPage}',
          explanation: 'Use pagination.nextPage instead of manual increment',
        })
      }
    }
    
    // Find array.slice for pagination
    if (type === 'client-side' && line.includes('.slice(') && (line.includes('startIndex') || line.includes('currentPage'))) {
      const context = getCodeContext(lines, index, 2)
      
      issues.push({
        type: 'manual-slicing',
        line: index + 1,
        code: line.trim(),
        context,
        fix: 'const currentItems = items.slice(pagination.startIndex, pagination.endIndex)',
        explanation: 'Use pagination.startIndex and pagination.endIndex for slicing',
      })
    }
    
    // Find .range() for server-side
    if (type === 'server-side' && line.includes('.range(')) {
      const context = getCodeContext(lines, index, 2)
      
      issues.push({
        type: 'api-range-call',
        line: index + 1,
        code: line.trim(),
        context,
        fix: 'const from = (pagination.currentPage - 1) * pagination.itemsPerPage\nconst to = from + pagination.itemsPerPage - 1\nquery.range(from, to)',
        explanation: 'Use pagination.currentPage and pagination.itemsPerPage for API range',
      })
    }
  })
  
  return issues
}

/**
 * Get code context around a specific line
 */
function getCodeContext(lines: string[], lineIndex: number, range: number = 5): CodeContext {
  const start = Math.max(0, lineIndex - range)
  const end = Math.min(lines.length - 1, lineIndex + range)
  
  return {
    beforeCode: lines.slice(start, lineIndex).join('\n'),
    targetCode: lines[lineIndex],
    afterCode: lines.slice(lineIndex + 1, end + 1).join('\n'),
    startLine: start + 1,
    endLine: end + 1,
  }
}

/**
 * Generate a comprehensive fix guide for a file
 */
export function generatePaginationFixGuide(detection: PaginationDetection, filePath: string): string {
  const { type, issues, evidence } = detection
  
  let guide = `# Pagination Fix Guide: ${filePath}\n\n`
  
  // Type detection
  guide += `## Detected: ${type.toUpperCase()} Pagination\n\n`
  guide += `**Evidence:**\n`
  evidence.forEach(e => guide += `- ${e}\n`)
  guide += '\n'
  
  // Type-specific guide
  if (type === 'server-side') {
    guide += `## Server-Side Pagination Fix\n\n`
    guide += `Your file fetches paginated data from an API (Supabase, REST, etc.).\n\n`
    guide += `**How it works:**\n`
    guide += `1. Hook manages current page state\n`
    guide += `2. useEffect triggers API call when page changes\n`
    guide += `3. API returns ONLY current page of data\n`
    guide += `4. Display the data returned from API\n\n`
    
    guide += `**Hook Setup:**\n`
    guide += `\`\`\`typescript\n`
    guide += `const pagination = usePagination({\n`
    guide += `  totalItems: totalCount,  // From API response\n`
    guide += `  itemsPerPage: 50,\n`
    guide += `})\n`
    guide += `\`\`\`\n\n`
    
    guide += `**API Call:**\n`
    guide += `\`\`\`typescript\n`
    guide += `const from = (pagination.currentPage - 1) * pagination.itemsPerPage\n`
    guide += `const to = from + pagination.itemsPerPage - 1\n`
    guide += `query = query.range(from, to)\n`
    guide += `\`\`\`\n\n`
    
  } else if (type === 'client-side') {
    guide += `## Client-Side Pagination Fix\n\n`
    guide += `Your file has ALL data and paginates it locally.\n\n`
    guide += `**How it works:**\n`
    guide += `1. Hook manages current page state\n`
    guide += `2. Calculate startIndex and endIndex\n`
    guide += `3. Slice array to get current page\n`
    guide += `4. Display the sliced data\n\n`
    
    guide += `**Hook Setup:**\n`
    guide += `\`\`\`typescript\n`
    guide += `const pagination = usePagination({\n`
    guide += `  totalItems: items.length,  // Local array length\n`
    guide += `  itemsPerPage: 50,\n`
    guide += `})\n`
    guide += `const currentItems = items.slice(pagination.startIndex, pagination.endIndex)\n`
    guide += `\`\`\`\n\n`
  }
  
  // Issues found
  guide += `## Issues Found (${issues.length})\n\n`
  issues.forEach((issue, i) => {
    guide += `### Issue ${i + 1}: ${issue.type} (Line ${issue.line})\n\n`
    guide += `**Current Code:**\n`
    guide += `\`\`\`typescript\n`
    guide += `${issue.context.beforeCode}\n`
    guide += `${issue.context.targetCode}  // ← Line ${issue.line}\n`
    guide += `${issue.context.afterCode}\n`
    guide += `\`\`\`\n\n`
    
    guide += `**Fix:**\n`
    guide += `\`\`\`typescript\n`
    guide += `${issue.fix}\n`
    guide += `\`\`\`\n\n`
    
    guide += `**Why:** ${issue.explanation}\n\n`
    guide += `---\n\n`
  })
  
  return guide
}

/**
 * Main function to analyze a file for pagination issues
 */
export function analyzePaginationPatterns(content: string, filePath: string) {
  const detection = detectPaginationType(content)
  const guide = generatePaginationFixGuide(detection, filePath)
  
  return {
    detection,
    guide,
    summary: {
      type: detection.type,
      confidence: detection.confidence,
      issueCount: detection.issues.length,
      canAutoFix: detection.confidence === 'high',
    }
  }
}
