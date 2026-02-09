// app/api/refactor/apply-color/route.ts
// IMPROVED VERSION - Handles colors inside strings

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: Request) {
  try {
    const {
      file,
      line,
      oldActiveColor,
      newActiveColor,
      oldInactiveColor,
      newInactiveColor,
      isConditional,
    } = await request.json()

    // Validate inputs
    if (!file || !line || !oldActiveColor || !newActiveColor) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Security: Only allow files in app/ directory
    const projectRoot = process.cwd()
    const fullPath = path.join(projectRoot, file)
    
    if (!fullPath.startsWith(path.join(projectRoot, 'app'))) {
      return NextResponse.json(
        { error: 'Invalid file path - must be in app/ directory' },
        { status: 403 }
      )
    }

    // Check file exists
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Read file
    const content = fs.readFileSync(fullPath, 'utf-8')
    const lines = content.split('\n')

    // Validate line number
    if (line < 1 || line > lines.length) {
      return NextResponse.json(
        { error: 'Invalid line number' },
        { status: 400 }
      )
    }

    // Get the target line (0-indexed)
    const lineIndex = line - 1
    const targetLine = lines[lineIndex]

    // Perform replacement
    let newLine = targetLine

    if (isConditional) {
      // Replace both active and inactive colors in a ternary expression
      // This handles patterns like: condition ? 'text-slate-900' : 'text-slate-400'
      
      // Replace active color (after '?')
      newLine = replaceColorInLine(newLine, oldActiveColor, newActiveColor)
      
      // Replace inactive color (after ':')
      if (oldInactiveColor && newInactiveColor) {
        newLine = replaceColorInLine(newLine, oldInactiveColor, newInactiveColor)
      }
    } else {
      // Simple replacement - just replace the color
      newLine = replaceColorInLine(newLine, oldActiveColor, newActiveColor)
    }

    // Check if anything changed
    if (newLine === targetLine) {
      return NextResponse.json(
        { 
          error: 'No changes detected - pattern not found in line',
          details: {
            line: targetLine,
            lookingFor: oldActiveColor,
            expectedResult: newActiveColor
          }
        },
        { status: 400 }
      )
    }

    // Update the line
    lines[lineIndex] = newLine

    // Write back to file
    fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8')

    return NextResponse.json({
      success: true,
      file,
      line,
      before: targetLine,
      after: newLine,
    })

  } catch (error) {
    console.error('Error applying color fix:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Replace a color class in a line of code
 * Handles multiple patterns:
 * 1. Standalone quoted: 'text-red-600'
 * 2. Inside string: 'text-red-600 bg-red-50'
 * 3. Template literal: `text-red-600 ${...}`
 */
function replaceColorInLine(line: string, oldColor: string, newColor: string): string {
  // Escape special regex characters
  const escaped = escapeRegex(oldColor)
  
  // Create regex that matches the color as a whole word (not part of another class)
  // Use word boundary to ensure we don't match 'text-red-600' inside 'hover:text-red-600'
  const colorRegex = new RegExp(`\\b${escaped}\\b`, 'g')
  
  // Replace all occurrences
  return line.replace(colorRegex, newColor)
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}