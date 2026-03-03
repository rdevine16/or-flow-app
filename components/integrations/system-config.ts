/**
 * System Config — per-EHR-system metadata for the integration UI
 *
 * Centralizes display names, descriptions, setup instructions, and
 * curl example placeholders. Used by all shared integration components
 * (OverviewTab, ReviewQueueTab, etc.) to render system-specific content.
 */

import type { EhrIntegrationType } from '@/lib/integrations/shared/integration-types'

export interface EhrSystemConfig {
  /** Integration type key (e.g. 'epic_hl7v2') */
  integrationType: EhrIntegrationType
  /** Short display name (e.g. 'Epic') */
  displayName: string
  /** Page title (e.g. 'Epic HL7v2 Integration') */
  pageTitle: string
  /** Short subtitle for the page header */
  pageSubtitle: string
  /** Display name for the integration (e.g. 'Epic HL7v2') used in upsertIntegration */
  integrationDisplayName: string
  /** Sending app/facility placeholder for curl example (e.g. 'EPIC|FACILITY') */
  curlMshPlaceholder: string
  /** Description for setup instructions */
  setupDescription: string
  /** Column header label in ReviewDetailPanel (e.g. 'Epic (Incoming)') */
  incomingColumnLabel: string
  /** Source name for cases.source column (e.g. 'epic', 'cerner', 'meditech') */
  sourceName: string
}

const SYSTEM_CONFIGS: Record<string, EhrSystemConfig> = {
  epic_hl7v2: {
    integrationType: 'epic_hl7v2',
    displayName: 'Epic',
    pageTitle: 'Epic HL7v2 Integration',
    pageSubtitle: 'Receive surgical scheduling data via HL7v2 SIU messages',
    integrationDisplayName: 'Epic HL7v2',
    curlMshPlaceholder: 'EPIC|FACILITY',
    setupDescription: 'Configure your integration engine (Mirth Connect, Rhapsody) with these settings',
    incomingColumnLabel: 'Epic (Incoming)',
    sourceName: 'epic',
  },
  cerner_hl7v2: {
    integrationType: 'cerner_hl7v2',
    displayName: 'Oracle Cerner',
    pageTitle: 'Oracle Cerner HL7v2 Integration',
    pageSubtitle: 'Receive surgical scheduling data via HL7v2 SIU messages',
    integrationDisplayName: 'Cerner HL7v2',
    curlMshPlaceholder: 'CERNER|FACILITY',
    setupDescription: 'Configure your Cerner integration engine (Mirth Connect, Rhapsody, Open Engine) with these settings',
    incomingColumnLabel: 'Cerner (Incoming)',
    sourceName: 'cerner',
  },
  meditech_hl7v2: {
    integrationType: 'meditech_hl7v2',
    displayName: 'MEDITECH',
    pageTitle: 'MEDITECH HL7v2 Integration',
    pageSubtitle: 'Receive surgical scheduling data via HL7v2 SIU messages',
    integrationDisplayName: 'MEDITECH HL7v2',
    curlMshPlaceholder: 'MEDITECH|FACILITY',
    setupDescription: 'Configure your MEDITECH interface (Data Repository, Mirth Connect) with these settings',
    incomingColumnLabel: 'MEDITECH (Incoming)',
    sourceName: 'meditech',
  },
}

/**
 * Get the system config for a given EHR integration type.
 * Falls back to Epic config if type is unknown.
 */
export function getSystemConfig(integrationType: EhrIntegrationType): EhrSystemConfig {
  return SYSTEM_CONFIGS[integrationType] ?? SYSTEM_CONFIGS.epic_hl7v2
}
