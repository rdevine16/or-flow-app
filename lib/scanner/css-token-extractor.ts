// lib/scanner/css-token-extractor.ts
// Extracts color tokens from CSS files for the intelligent scanner

import fs from 'fs'
import path from 'path'

export interface ColorToken {
  className: string
  type: 'text' | 'bg' | 'border'
  color: string
  category: string // 'semantic' | 'tailwind' | 'custom'
  hex?: string // Optional hex value if we can extract it
}

export interface DesignTokens {
  textColors: ColorToken[]
  backgroundColors: ColorToken[]
  borderColors: ColorToken[]
}

/**
 * Extract color tokens from globals.css and Tailwind config
 */
export function extractColorTokens(projectRoot: string): DesignTokens {
  const tokens: DesignTokens = {
    textColors: [],
    backgroundColors: [],
    borderColors: []
  }

  // Read globals.css
  const globalsPath = path.join(projectRoot, 'app', 'globals.css')
  if (fs.existsSync(globalsPath)) {
    const cssContent = fs.readFileSync(globalsPath, 'utf-8')
    extractFromCSS(cssContent, tokens)
  }

  // Read tailwind.config if exists
  const tailwindPath = path.join(projectRoot, 'tailwind.config.ts')
  if (fs.existsSync(tailwindPath)) {
    // Could extract custom colors from tailwind config
    // For now, we'll focus on CSS
  }

  // Add common Tailwind colors if not already present
  addCommonTailwindColors(tokens)

  return tokens
}

/**
 * Extract color classes from CSS content
 */
function extractFromCSS(cssContent: string, tokens: DesignTokens) {
  // Extract custom CSS variables
  const variableMatches = cssContent.matchAll(/--([^:]+):\s*([^;]+);/g)
  for (const match of variableMatches) {
    const varName = match[1].trim()
    const varValue = match[2].trim()
    
    // Check if it's a color variable
    if (varName.includes('color') || varName.includes('bg') || varName.includes('text')) {
      // Map to Tailwind class or custom class
      if (varName.includes('text')) {
        tokens.textColors.push({
          className: `text-${varName}`,
          type: 'text',
          color: varValue,
          category: 'custom',
          hex: extractHexFromValue(varValue)
        })
      }
    }
  }

  // Extract utility classes (look for @apply or custom classes)
  const classMatches = cssContent.matchAll(/\.([^\s{]+)\s*{[^}]*}/g)
  for (const match of classMatches) {
    const className = match[1]
    const classBody = match[0]
    
    // Check if it applies colors
    if (classBody.includes('color:') || classBody.includes('background')) {
      // Extract the color value
      const colorMatch = classBody.match(/(?:color|background):\s*([^;]+);/)
      if (colorMatch) {
        const colorValue = colorMatch[1].trim()
        
        if (className.startsWith('text-')) {
          tokens.textColors.push({
            className,
            type: 'text',
            color: colorValue,
            category: 'custom',
            hex: extractHexFromValue(colorValue)
          })
        } else if (className.startsWith('bg-')) {
          tokens.backgroundColors.push({
            className,
            type: 'bg',
            color: colorValue,
            category: 'custom',
            hex: extractHexFromValue(colorValue)
          })
        }
      }
    }
  }
}

/**
 * Add common Tailwind colors that are likely available
 */
function addCommonTailwindColors(tokens: DesignTokens) {
  const commonColors = [
    { name: 'slate', shades: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'gray', shades: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'emerald', shades: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'green', shades: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'blue', shades: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'red', shades: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'amber', shades: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'yellow', shades: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] },
  ]

  commonColors.forEach(({ name, shades }) => {
    shades.forEach(shade => {
      // Text colors
      tokens.textColors.push({
        className: `text-${name}-${shade}`,
        type: 'text',
        color: `${name}-${shade}`,
        category: 'tailwind'
      })

      // Background colors
      tokens.backgroundColors.push({
        className: `bg-${name}-${shade}`,
        type: 'bg',
        color: `${name}-${shade}`,
        category: 'tailwind'
      })

      // Border colors
      tokens.borderColors.push({
        className: `border-${name}-${shade}`,
        type: 'border',
        color: `${name}-${shade}`,
        category: 'tailwind'
      })
    })
  })
}

/**
 * Extract hex value from CSS color value
 */
function extractHexFromValue(value: string): string | undefined {
  // Match hex colors
  const hexMatch = value.match(/#([0-9a-fA-F]{3,6})/)
  if (hexMatch) return hexMatch[0]
  
  // Match rgb/rgba
  const rgbMatch = value.match(/rgba?\(([^)]+)\)/)
  if (rgbMatch) {
    // Could convert to hex, but for now just return undefined
    return undefined
  }
  
  return undefined
}

/**
 * Get suggested color replacements for a hardcoded color
 */
export function getSuggestedReplacements(
  hardcodedColor: string,
  tokens: DesignTokens,
  type: 'text' | 'bg' | 'border' = 'text'
): ColorToken[] {
  const tokenList = type === 'text' ? tokens.textColors : 
                    type === 'bg' ? tokens.backgroundColors : 
                    tokens.borderColors

  // Filter to most relevant tokens
  const suggestions: ColorToken[] = []

  // Exact match first
  const exactMatch = tokenList.find(t => t.className === hardcodedColor)
  if (exactMatch) suggestions.push(exactMatch)

  // Similar colors
  const colorName = hardcodedColor.match(/(?:text|bg|border)-([a-z]+)-?(\d+)?/)
  if (colorName) {
    const [, name] = colorName

    // Same color family
    const sameFamily = tokenList.filter(t => t.className.includes(name))
    suggestions.push(...sameFamily.slice(0, 5))
  }

  // Semantic tokens (if available)
  const semanticTokens = tokenList.filter(t => t.category === 'custom')
  suggestions.push(...semanticTokens.slice(0, 3))

  // Remove duplicates
  return Array.from(new Map(suggestions.map(t => [t.className, t])).values())
}