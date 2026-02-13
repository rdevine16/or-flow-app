// app/api/refactor/scan/css-patterns.ts
// CSS Pattern Scanner - Detects hardcoded Tailwind that should use global.css classes

export interface CSSPatternIssue {
  file: string
  line: number
  pattern: string
  suggestion: string
  severity: 'high' | 'medium' | 'low'
  category: 'button' | 'input' | 'card' | 'table' | 'badge' | 'alert' | 'typography'
}

/**
 * Scan for common CSS patterns that should use centralized classes
 */
export function findCSSPatterns(content: string, filePath: string): CSSPatternIssue[] {
  const issues: CSSPatternIssue[] = []
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    const lineNumber = index + 1

    // BUTTONS - Primary pattern
    if (line.match(/className="[^"]*px-4 py-2 bg-blue-600[^"]*text-white[^"]*rounded/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded primary button styles',
        suggestion: 'Use className="btn-primary" from global.css',
        severity: 'high',
        category: 'button',
      })
    }

    // BUTTONS - Secondary pattern
    if (line.match(/className="[^"]*px-4 py-2 bg-slate-100[^"]*text-slate-700[^"]*rounded/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded secondary button styles',
        suggestion: 'Use className="btn-secondary" from global.css',
        severity: 'high',
        category: 'button',
      })
    }

    // BUTTONS - Danger/Delete pattern
    if (line.match(/className="[^"]*px-4 py-2 bg-red-600[^"]*text-white[^"]*rounded/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded danger button styles',
        suggestion: 'Use className="btn-danger" from global.css',
        severity: 'high',
        category: 'button',
      })
    }

    // BUTTONS - Success pattern
    if (line.match(/className="[^"]*px-4 py-2 bg-(emerald|green)-600[^"]*text-white[^"]*rounded/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded success button styles',
        suggestion: 'Use className="btn-success" from global.css',
        severity: 'high',
        category: 'button',
      })
    }

    // INPUTS - Base input pattern
    if (line.match(/className="[^"]*w-full px-3 py-2 border border-slate-300[^"]*rounded/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded input styles',
        suggestion: 'Use className="input-base" from global.css',
        severity: 'medium',
        category: 'input',
      })
    }

    // CARDS - Base card pattern
    if (line.match(/className="[^"]*bg-white border border-slate-200 rounded-xl shadow/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded card container styles',
        suggestion: 'Use className="card-base" from global.css',
        severity: 'medium',
        category: 'card',
      })
    }

    // CARDS - Header pattern
    if (line.match(/className="[^"]*px-6 py-4 border-b border-slate-200/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded card header styles',
        suggestion: 'Use className="card-header" from global.css',
        severity: 'low',
        category: 'card',
      })
    }

    // BADGES - Primary badge
    if (line.match(/className="[^"]*bg-blue-50 text-blue-700[^"]*rounded-full[^"]*text-xs/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded primary badge styles',
        suggestion: 'Use className="badge-primary" from global.css',
        severity: 'medium',
        category: 'badge',
      })
    }

    // BADGES - Success badge
    if (line.match(/className="[^"]*bg-(emerald|green)-50 text-(emerald|green)-700[^"]*rounded-full/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded success badge styles',
        suggestion: 'Use className="badge-success" from global.css',
        severity: 'medium',
        category: 'badge',
      })
    }

    // ALERTS - Info alert
    if (line.match(/className="[^"]*bg-blue-50 border border-blue-200[^"]*p-4[^"]*rounded/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded info alert styles',
        suggestion: 'Use className="alert-info" from global.css',
        severity: 'medium',
        category: 'alert',
      })
    }

    // ALERTS - Error alert
    if (line.match(/className="[^"]*bg-red-50 border border-red-200[^"]*p-4[^"]*rounded/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded error alert styles',
        suggestion: 'Use className="alert-error" from global.css',
        severity: 'medium',
        category: 'alert',
      })
    }

    // TABLES - Table container
    if (line.match(/className="[^"]*bg-white border border-slate-200 rounded-xl overflow-hidden/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded table container styles',
        suggestion: 'Use className="table-container" from global.css',
        severity: 'low',
        category: 'table',
      })
    }

    // TYPOGRAPHY - Headings with repeated patterns
    if (line.match(/className="[^"]*text-3xl font-bold text-slate-900/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded heading-1 styles',
        suggestion: 'Use className="heading-1" from global.css',
        severity: 'low',
        category: 'typography',
      })
    }

    if (line.match(/className="[^"]*text-2xl font-semibold text-slate-900/)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: 'Hardcoded heading-2 styles',
        suggestion: 'Use className="heading-2" from global.css',
        severity: 'low',
        category: 'typography',
      })
    }
  })

  return issues
}

/**
 * Get summary statistics for CSS patterns
 */
export function getCSSPatternStats(issues: CSSPatternIssue[]) {
  const byCategory = {
    button: issues.filter(i => i.category === 'button').length,
    input: issues.filter(i => i.category === 'input').length,
    card: issues.filter(i => i.category === 'card').length,
    table: issues.filter(i => i.category === 'table').length,
    badge: issues.filter(i => i.category === 'badge').length,
    alert: issues.filter(i => i.category === 'alert').length,
    typography: issues.filter(i => i.category === 'typography').length,
  }

  const bySeverity = {
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    low: issues.filter(i => i.severity === 'low').length,
  }

  return {
    total: issues.length,
    byCategory,
    bySeverity,
  }
}

/**
 * Generate migration plan based on detected patterns
 */
export function generateMigrationPlan(issues: CSSPatternIssue[]) {
  const stats = getCSSPatternStats(issues)
  
  const plan = {
    phase1: {
      name: 'High Priority (Buttons)',
      count: stats.byCategory.button,
      estimatedTime: Math.ceil(stats.byCategory.button * 1) + ' minutes',
      files: [...new Set(issues.filter(i => i.category === 'button').map(i => i.file))],
    },
    phase2: {
      name: 'Medium Priority (Inputs & Badges)',
      count: stats.byCategory.input + stats.byCategory.badge,
      estimatedTime: Math.ceil((stats.byCategory.input + stats.byCategory.badge) * 1.5) + ' minutes',
      files: [...new Set(issues.filter(i => i.category === 'input' || i.category === 'badge').map(i => i.file))],
    },
    phase3: {
      name: 'Low Priority (Cards & Tables)',
      count: stats.byCategory.card + stats.byCategory.table,
      estimatedTime: Math.ceil((stats.byCategory.card + stats.byCategory.table) * 2) + ' minutes',
      files: [...new Set(issues.filter(i => i.category === 'card' || i.category === 'table').map(i => i.file))],
    },
  }

  return plan
}

/**
 * Get before/after examples for a CSS pattern
 */
export function getBeforeAfter(category: CSSPatternIssue['category']) {
  const examples: Record<string, { before: string; after: string; notes: string }> = {
    button: {
      before: '<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>',
      after: '<button className="btn-primary">Save</button>',
      notes: 'All button styling now centralized in global.css. Change btn-primary class to update all primary buttons at once!',
    },
    input: {
      before: '<input className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />',
      after: '<input className="input-base" />',
      notes: 'All input styling centralized. Add input-error or input-success for variants.',
    },
    card: {
      before: '<div className="bg-white border border-slate-200 rounded-xl shadow-sm"><div className="px-6 py-4 border-b border-slate-200">...</div></div>',
      after: '<div className="card-base"><div className="card-header">...</div></div>',
      notes: 'Card components now use semantic class names that are easier to read and maintain.',
    },
    badge: {
      before: '<span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-medium">Active</span>',
      after: '<span className="badge-primary">Active</span>',
      notes: 'Badge colors and sizes centralized. Easy to maintain consistent badge styling.',
    },
    alert: {
      before: '<div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">Error!</div>',
      after: '<div className="alert-error">Error!</div>',
      notes: 'Alert variants (info, success, warning, error) all centralized in global.css.',
    },
    table: {
      before: '<div className="bg-white border border-slate-200 rounded-xl overflow-hidden"><table className="w-full">...</table></div>',
      after: '<div className="table-container"><table className="table-base">...</table></div>',
      notes: 'Table styling centralized with semantic class names for headers, rows, and cells.',
    },
    typography: {
      before: '<h1 className="text-3xl font-bold text-slate-900">Title</h1>',
      after: '<h1 className="heading-1">Title</h1>',
      notes: 'Typography hierarchy centralized. Change heading-1 class to update all h1 styles.',
    },
  }

  return examples[category]
}