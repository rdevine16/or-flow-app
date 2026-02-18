#!/usr/bin/env node

/**
 * ORbit Codebase Analyzer
 * Scans your entire app to find:
 * 1. Duplicated code patterns
 * 2. Inline components that should be extracted
 * 3. Missing shared components
 * 4. Component usage across pages
 * 
 * USAGE:
 *   node scripts/analyze-codebase.js
 * 
 * OUTPUT:
 *   - reports/duplication-report.md
 *   - reports/component-usage.json
 *   - reports/refactor-priorities.md
 */

import fs from 'fs'
import path from 'path'

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  rootDir: process.cwd(),
  appDir: './app',
  componentsDir: './components',
  outputDir: './reports',
  excludeDirs: ['node_modules', '.next', '.git', 'dist', 'build'],
};

// ============================================
// PATTERNS TO DETECT
// ============================================

const PATTERNS = {
  // Status color definitions (duplicated across files)
  statusConfig: /const\s+\w*statusConfig\w*\s*=\s*\{[\s\S]*?scheduled[\s\S]*?\}/g,
  getStatusConfig: /function\s+getStatusConfig/g,
  
  // Inline delete confirmations
  inlineDeleteConfirm: /deleteConfirm\s*===\s*\w+/g,
  
  // Modal/Dialog usage
  modalState: /const\s+\[show\w*Modal,\s*setShow\w*Modal\]\s*=\s*useState/g,
  
  // Table implementations
  tableWithPagination: /<table[\s\S]*?pagination[\s\S]*?<\/table>/gi,
  paginationLogic: /const\s+\[currentPage.*setCurrentPage\]/g,
  
  // Loading states
  loadingState: /const\s+\[loading,\s*setLoading\]\s*=\s*useState/g,
  
  // Toast/alert patterns (console.log instead of toast)
  consoleLog: /console\.(log|error|warn)\(/g,
  
  // Hardcoded colors (should use design tokens)
  hardcodedColors: /['"`]bg-(blue|emerald|amber|red|slate)-\d+['"`]/g,
  
  // Form validation (inline vs shared)
  inlineValidation: /if\s*\(\s*!.*\)\s*\{\s*return/g,
  
  // API calls (should be in hooks/services)
  inlineApiCalls: /const\s+\{.*\}\s*=\s*await\s+supabase/g,
};

// ============================================
// FILE SCANNER
// ============================================

class CodebaseAnalyzer {
  constructor() {
    this.results = {
      files: [],
      duplications: [],
      componentOpportunities: [],
      componentUsage: {},
      stats: {
        totalFiles: 0,
        totalLines: 0,
        pagesScanned: 0,
        componentsFound: 0,
      }
    };
  }

  async analyze() {
    console.log('🔍 Scanning ORbit codebase...\n');
    
    // Scan app directory (pages)
    await this.scanDirectory(CONFIG.appDir, 'page');
    
    // Scan components directory
    await this.scanDirectory(CONFIG.componentsDir, 'component');
    
    // Analyze patterns
    this.findDuplications();
    this.findComponentOpportunities();
    this.analyzeComponentUsage();
    
    // Generate reports
    this.generateReports();
    
    console.log('\n✅ Analysis complete! Check ./reports/ directory\n');
  }

  async scanDirectory(dir, type) {
    const fullPath = path.join(CONFIG.rootDir, dir);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Directory not found: ${dir}`);
      return;
    }

    const files = this.getFilesRecursive(fullPath);
    
    for (const file of files) {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(CONFIG.rootDir, file);
        
        this.results.files.push({
          path: relativePath,
          type,
          content,
          lines: content.split('\n').length,
        });

        this.results.stats.totalFiles++;
        this.results.stats.totalLines += content.split('\n').length;
        
        if (type === 'page') this.results.stats.pagesScanned++;
        if (type === 'component') this.results.stats.componentsFound++;
      }
    }
  }

  getFilesRecursive(dir) {
    const files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!CONFIG.excludeDirs.includes(item)) {
          files.push(...this.getFilesRecursive(fullPath));
        }
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  findDuplications() {
    console.log('🔎 Finding duplicated code...');
    
    const duplications = {};

    // Check for duplicated patterns
    for (const file of this.results.files) {
      for (const [patternName, pattern] of Object.entries(PATTERNS)) {
        const matches = file.content.match(pattern);
        
        if (matches && matches.length > 0) {
          if (!duplications[patternName]) {
            duplications[patternName] = [];
          }
          duplications[patternName].push({
            file: file.path,
            occurrences: matches.length,
            examples: matches.slice(0, 3), // First 3 examples
          });
        }
      }
    }

    // Find patterns that appear in multiple files
    for (const [patternName, files] of Object.entries(duplications)) {
      if (files.length > 1) {
        this.results.duplications.push({
          pattern: patternName,
          files: files.map(f => f.file),
          count: files.length,
          severity: this.getDuplicationSeverity(files.length, patternName),
        });
      }
    }
  }

  getDuplicationSeverity(count, pattern) {
    if (pattern === 'statusConfig' || pattern === 'getStatusConfig') {
      return count > 2 ? 'HIGH' : 'MEDIUM';
    }
    if (count > 5) return 'HIGH';
    if (count > 3) return 'MEDIUM';
    return 'LOW';
  }

  findComponentOpportunities() {
    console.log('🎯 Finding component extraction opportunities...');
    
    // Look for repeated JSX patterns in pages
    const jsxPatterns = [
      // Status badges
      {
        name: 'Status Badge',
        pattern: /<span[^>]*className[^>]*bg-(blue|emerald|amber|red)-50/g,
        reason: 'Inline status badges should use StatusBadge component',
        priority: 'HIGH',
      },
      // Delete buttons
      {
        name: 'Delete Button Pattern',
        pattern: /<button[^>]*onClick.*delete/gi,
        reason: 'Delete buttons should have consistent styling and confirmations',
        priority: 'MEDIUM',
      },
      // Table rows with actions
      {
        name: 'Table Row Actions',
        pattern: /<tr[^>]*>[\s\S]*?<button[^>]*Edit[\s\S]*?<button[^>]*Delete/gi,
        reason: 'Table action patterns should be extracted to TableActions component',
        priority: 'MEDIUM',
      },
      // Loading spinners
      {
        name: 'Inline Spinner',
        pattern: /<div[^>]*animate-spin/g,
        reason: 'Use Spinner component from Loading.tsx',
        priority: 'LOW',
      },
    ];

    for (const file of this.results.files.filter(f => f.type === 'page')) {
      for (const pattern of jsxPatterns) {
        const matches = file.content.match(pattern.pattern);
        
        if (matches && matches.length > 2) {
          this.results.componentOpportunities.push({
            file: file.path,
            component: pattern.name,
            occurrences: matches.length,
            reason: pattern.reason,
            priority: pattern.priority,
          });
        }
      }
    }
  }

  analyzeComponentUsage() {
    console.log('📊 Analyzing component usage...');
    
    // Find all component imports
    const componentImportPattern = /import\s+(?:\{[^}]+\}|\w+)\s+from\s+['"]@\/components\/([^'"]+)['"]/g;

    for (const file of this.results.files) {
      const matches = [...file.content.matchAll(componentImportPattern)];
      
      for (const match of matches) {
        const componentPath = match[1];
        
        if (!this.results.componentUsage[componentPath]) {
          this.results.componentUsage[componentPath] = {
            usedIn: [],
            usageCount: 0,
          };
        }
        
        this.results.componentUsage[componentPath].usedIn.push(file.path);
        this.results.componentUsage[componentPath].usageCount++;
      }
    }
  }

  generateReports() {
    console.log('📝 Generating reports...');
    
    // Create reports directory
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    // Report 1: Duplication Report
    this.generateDuplicationReport();
    
    // Report 2: Component Usage
    this.generateComponentUsageReport();
    
    // Report 3: Refactor Priorities
    this.generateRefactorPriorities();
    
    // Report 4: Stats Overview
    this.generateStatsReport();
  }

  generateDuplicationReport() {
    let report = '# Code Duplication Report\n\n';
    report += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    report += '## Summary\n\n';
    report += `- Total duplications found: ${this.results.duplications.length}\n`;
    report += `- High severity: ${this.results.duplications.filter(d => d.severity === 'HIGH').length}\n`;
    report += `- Medium severity: ${this.results.duplications.filter(d => d.severity === 'MEDIUM').length}\n\n`;

    report += '## Duplications by Priority\n\n';
    
    const sorted = [...this.results.duplications].sort((a, b) => {
      const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    for (const dup of sorted) {
      report += `### ${dup.pattern} (${dup.severity})\n\n`;
      report += `Found in ${dup.count} files:\n\n`;
      for (const file of dup.files) {
        report += `- \`${file}\`\n`;
      }
      report += '\n**Action:** Extract to shared utility/component\n\n';
    }

    fs.writeFileSync(path.join(CONFIG.outputDir, 'duplication-report.md'), report);
  }

  generateComponentUsageReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      components: this.results.componentUsage,
      summary: {
        totalComponents: Object.keys(this.results.componentUsage).length,
        mostUsed: Object.entries(this.results.componentUsage)
          .sort((a, b) => b[1].usageCount - a[1].usageCount)
          .slice(0, 10)
          .map(([path, data]) => ({ path, count: data.usageCount })),
        unused: Object.entries(this.results.componentUsage)
          .filter(([, data]) => data.usageCount === 0)
          .map(([path]) => path),
      }
    };

    fs.writeFileSync(
      path.join(CONFIG.outputDir, 'component-usage.json'),
      JSON.stringify(report, null, 2)
    );
  }

  generateRefactorPriorities() {
    let report = '# Refactoring Priorities\n\n';
    report += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    report += '## Component Extraction Opportunities\n\n';
    
    const sorted = [...this.results.componentOpportunities].sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    for (const opp of sorted) {
      report += `### ${opp.component} (${opp.priority})\n\n`;
      report += `- File: \`${opp.file}\`\n`;
      report += `- Occurrences: ${opp.occurrences}\n`;
      report += `- Reason: ${opp.reason}\n\n`;
    }

    report += '## Quick Wins (Do First)\n\n';
    report += 'These will have immediate impact with minimal effort:\n\n';
    report += '1. Extract duplicated `getStatusConfig` → use design tokens\n';
    report += '2. Replace inline delete confirmations → use ConfirmDialog\n';
    report += '3. Replace console.log/error → use Toast notifications\n';
    report += '4. Replace hardcoded colors → use design tokens\n\n';

    fs.writeFileSync(path.join(CONFIG.outputDir, 'refactor-priorities.md'), report);
  }

  generateStatsReport() {
    let report = '# Codebase Statistics\n\n';
    report += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    report += '## Overview\n\n';
    report += `- Total Files: ${this.results.stats.totalFiles}\n`;
    report += `- Total Lines: ${this.results.stats.totalLines.toLocaleString()}\n`;
    report += `- Pages: ${this.results.stats.pagesScanned}\n`;
    report += `- Components: ${this.results.stats.componentsFound}\n`;
    report += `- Component Reuse: ${Object.keys(this.results.componentUsage).length}\n\n`;

    report += '## Largest Files\n\n';
    const largest = [...this.results.files]
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 10);
    
    for (const file of largest) {
      report += `- \`${file.path}\` - ${file.lines} lines\n`;
    }

    fs.writeFileSync(path.join(CONFIG.outputDir, 'stats.md'), report);
  }
}

// ============================================
// RUN ANALYZER
// ============================================

const analyzer = new CodebaseAnalyzer();
analyzer.analyze().catch(console.error);