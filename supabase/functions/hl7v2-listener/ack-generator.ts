/**
 * HL7v2 ACK (Acknowledgment) Response Generator
 *
 * Duplicated from lib/hl7v2/ack-generator.ts for Deno Edge Function runtime.
 * Generates ACK messages: AA (Accept), AE (Error), AR (Reject)
 */

import type { ACKCode, ACKMessage } from './types.ts';

// ── ACK Generation ──────────────────────────────────────────────────────────

interface GenerateACKOptions {
  code: ACKCode;
  messageControlId: string;
  textMessage?: string;
  sendingApplication?: string;
  sendingFacility?: string;
  originalSendingApplication?: string;
  originalSendingFacility?: string;
}

export function generateACK(options: GenerateACKOptions): ACKMessage {
  const {
    code,
    messageControlId,
    textMessage = getDefaultTextMessage(code),
    sendingApplication = 'ORBIT',
    sendingFacility = 'ORBIT',
    originalSendingApplication = '',
    originalSendingFacility = '',
  } = options;

  const timestamp = formatHL7DateTime(new Date());
  const ackControlId = `ACK${messageControlId}`;

  const msh = [
    'MSH',
    '^~\\&',
    sendingApplication,
    sendingFacility,
    originalSendingApplication,
    originalSendingFacility,
    timestamp,
    '',
    'ACK',
    ackControlId,
    'P',
    '2.3',
  ].join('|');

  const msa = [
    'MSA',
    code,
    messageControlId,
    textMessage,
  ].join('|');

  const raw = `${msh}\r${msa}`;

  return {
    raw,
    code,
    messageControlId: ackControlId,
    textMessage,
  };
}

export function generateAcceptACK(
  messageControlId: string,
  textMessage?: string,
  originalSendingApplication?: string,
  originalSendingFacility?: string,
): ACKMessage {
  return generateACK({
    code: 'AA',
    messageControlId,
    textMessage: textMessage || 'Message processed successfully',
    originalSendingApplication,
    originalSendingFacility,
  });
}

export function generateErrorACK(
  messageControlId: string,
  errorMessage: string,
  originalSendingApplication?: string,
  originalSendingFacility?: string,
): ACKMessage {
  return generateACK({
    code: 'AE',
    messageControlId,
    textMessage: errorMessage,
    originalSendingApplication,
    originalSendingFacility,
  });
}

export function generateRejectACK(
  messageControlId: string,
  rejectReason: string,
  originalSendingApplication?: string,
  originalSendingFacility?: string,
): ACKMessage {
  return generateACK({
    code: 'AR',
    messageControlId,
    textMessage: rejectReason,
    originalSendingApplication,
    originalSendingFacility,
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getDefaultTextMessage(code: ACKCode): string {
  switch (code) {
    case 'AA': return 'Message accepted';
    case 'AE': return 'Application error processing message';
    case 'AR': return 'Message rejected';
  }
}

function formatHL7DateTime(date: Date): string {
  const y = date.getFullYear().toString();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  const sec = date.getSeconds().toString().padStart(2, '0');
  return `${y}${m}${d}${h}${min}${sec}`;
}
