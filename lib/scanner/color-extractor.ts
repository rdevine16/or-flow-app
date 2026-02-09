// lib/scanner/color-extractor.ts
// Extracts available text colors from Tailwind config

import fs from 'fs'
import path from 'path'

export interface ColorInfo {
  className: string    // e.g., "text-slate-900"
  displayName: string  // e.g., "slate-900"
  family: string       // e.g., "slate"
  shade: string        // e.g., "900"
  isCustom: boolean    // true if from tailwind.config
}

/**
 * Get all available text colors for the project
 */
export function getAvailableTextColors(projectRoot: string = process.cwd()): ColorInfo[] {
  const colors: ColorInfo[] = []
  
  // 1. Add Tailwind default colors
  colors.push(...getTailwindDefaults())
  
  // 2. Try to read custom colors from tailwind.config
  try {
    const customColors = readTailwindConfig(projectRoot)
    colors.push(...customColors)
  } catch (error) {
    console.log('[Color Extractor] Could not read tailwind.config, using defaults only')
  }
  
  return colors
}

/**
 * Get Tailwind's default color palette
 */
function getTailwindDefaults(): ColorInfo[] {
  const colors: ColorInfo[] = []
  
  const families = [
    'slate', 'gray', 'zinc', 'neutral', 'stone',
    'red', 'orange', 'amber', 'yellow', 'lime', 'green', 
    'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 
    'violet', 'purple', 'fuchsia', 'pink', 'rose'
  ]
  
  const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
  
  families.forEach(family => {
    shades.forEach(shade => {
      colors.push({
        className: `text-${family}-${shade}`,
        displayName: `${family}-${shade}`,
        family,
        shade,
        isCustom: false
      })
    })
  })
  
  return colors
}

/**
 * Read custom colors from tailwind.config.ts
 */
function readTailwindConfig(projectRoot: string): ColorInfo[] {
  const colors: ColorInfo[] = []
  const configPaths = [
    path.join(projectRoot, 'tailwind.config.ts'),
    path.join(projectRoot, 'tailwind.config.js'),
  ]
  
  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8')
        
        // Look for custom colors in theme.extend.colors
        // This is a simple regex-based extraction
        // For production, you'd want to actually evaluate the config
        
        // Match patterns like: primary: '#0ea5e9'
        const colorMatches = content.matchAll(/(\w+):\s*['"`](#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})['"`]/g)
        
        for (const match of colorMatches) {
          const colorName = match[1]
          colors.push({
            className: `text-${colorName}`,
            displayName: colorName,
            family: colorName,
            shade: '',
            isCustom: true
          })
        }
        
        // Match patterns like: brand: { 50: '#...', 900: '#...' }
        const shadeMatches = content.matchAll(/(\w+):\s*\{[^}]*(\d+):\s*['"`](#[0-9a-fA-F]{6})/g)
        
        for (const match of shadeMatches) {
          const family = match[1]
          const shade = match[2]
          colors.push({
            className: `text-${family}-${shade}`,
            displayName: `${family}-${shade}`,
            family,
            shade,
            isCustom: true
          })
        }
        
      } catch (error) {
        console.error('[Color Extractor] Error reading config:', error)
      }
    }
  }
  
  return colors
}

/**
 * Get suggested colors based on current color
 * Returns colors from same family first, then others
 */
export function getSuggestedColors(
  currentColor: string, 
  allColors: ColorInfo[],
  state: 'active' | 'inactive' = 'active'
): ColorInfo[] {
  // Extract family from current color
  // e.g., "text-slate-900" -> "slate"
  const match = currentColor.match(/text-([a-z]+)-?(\d+)?/)
  if (!match) return allColors.slice(0, 12)
  
  const currentFamily = match[1]
  
  const suggestions: ColorInfo[] = []
  
  // 1. Same family, appropriate shades
  const sameFamily = allColors.filter(c => c.family === currentFamily)
  if (state === 'active') {
    // Darker shades for active (700-950)
    suggestions.push(...sameFamily.filter(c => 
      parseInt(c.shade) >= 700 || c.shade === ''
    ))
  } else {
    // Lighter shades for inactive (50-400)
    suggestions.push(...sameFamily.filter(c => 
      parseInt(c.shade) <= 400 || c.shade === ''
    ))
  }
  
  // 2. Common neutral alternatives
  const neutrals = ['slate', 'gray', 'zinc']
  if (!neutrals.includes(currentFamily)) {
    const neutralColors = allColors.filter(c => 
      neutrals.includes(c.family) &&
      (state === 'active' 
        ? parseInt(c.shade) >= 700 
        : parseInt(c.shade) <= 400
      )
    )
    suggestions.push(...neutralColors.slice(0, 4))
  }
  
  // 3. Other colors
  const others = allColors.filter(c => 
    c.family !== currentFamily && 
    !neutrals.includes(c.family) &&
    (state === 'active' 
      ? parseInt(c.shade) >= 700 
      : parseInt(c.shade) <= 400
    )
  )
  suggestions.push(...others)
  
  // Remove duplicates and limit
  const unique = Array.from(new Map(suggestions.map(c => [c.className, c])).values())
  return unique.slice(0, 16)
}
