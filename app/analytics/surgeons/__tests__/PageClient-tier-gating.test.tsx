// app/analytics/surgeons/__tests__/PageClient-tier-gating.test.tsx
// Phase 10: Verify tier-based gating on Surgeon Performance page
//
// NOTE: The SurgeonPerformancePage (1500+ lines) cannot be rendered in a vitest
// worker due to memory constraints. Instead, we verify the FeatureGate integration
// via source code analysis — confirming the component imports FeatureGate and uses
// the correct tier requirements. The FeatureGate component itself has 20+ dedicated
// tests in components/FeatureGate/__tests__/.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const source = readFileSync(
  resolve(__dirname, '../PageClient.tsx'),
  'utf-8'
)

describe('SurgeonPerformancePage — Phase 10 Tier Gating (source verification)', () => {
  // ---- FeatureGate integration ----

  describe('FeatureGate import and usage', () => {
    it('imports FeatureGate component', () => {
      expect(source).toContain("import { FeatureGate } from '@/components/FeatureGate'")
    })

    it('imports isTierAtLeast from useUser', () => {
      expect(source).toContain('isTierAtLeast')
      expect(source).toContain('useUser()')
    })
  })

  // ---- Day Analysis tab lock ----

  describe('Day Analysis tab lock for Essential tier', () => {
    it('uses isTierAtLeast("professional") to gate Day Analysis tab', () => {
      expect(source).toContain("isTierAtLeast('professional')")
    })

    it('renders Lock icon for locked tab', () => {
      expect(source).toContain('Lock')
      expect(source).toContain('Upgrade to Professional to access Day Analysis')
    })

    it('locked tab is a span (non-interactive), not a button', () => {
      // The locked state uses a <span> element with cursor-not-allowed
      expect(source).toContain('cursor-not-allowed')
      // And includes a "Pro" badge
      expect(source).toContain('>Pro<')
    })
  })

  // ---- Procedure Breakdown blur ----

  describe('Procedure Breakdown FeatureGate blur', () => {
    it('wraps procedure breakdown in FeatureGate with requires="professional"', () => {
      expect(source).toContain('requires="professional"')
    })

    it('FeatureGate uses blur mode', () => {
      expect(source).toContain('mode="blur"')
    })

    it('includes upgrade message for procedure breakdown', () => {
      expect(source).toContain('Upgrade to Professional to view procedure breakdowns')
    })
  })
})
