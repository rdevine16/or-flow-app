/**
 * HL7v2 ACK (Acknowledgment) Response Generator
 *
 * Generates ACK messages in response to received HL7v2 messages.
 * ACK codes: AA (Application Accept), AE (Application Error), AR (Application Reject)
 */

import type { ACKCode, ACKMessage } from './types';

// ── ACK Generation ──────────────────────────────────────────────────────────

interface GenerateACKOptions {
  /** ACK code: AA, AE, or AR */
  code: ACKCode;
  /** Original message's MSH-10 control ID */
  messageControlId: string;
  /** Text description of the result */
  textMessage?: string;
  /** Sending application name for MSH-3 */
  sendingApplication?: string;
  /** Sending facility name for MSH-4 */
  sendingFacility?: string;
  /** Original message's MSH-3 (becomes receiving application in ACK) */
  originalSendingApplication?: string;
  /** Original message's MSH-4 (becomes receiving facility in ACK) */
  originalSendingFacility?: string;
}

/**
 * Generate an HL7v2 ACK response message.
 *
 * ACK message structure:
 * MSH|^~\&|<sendApp>|<sendFac>|<recvApp>|<recvFac>|<timestamp>||ACK|<controlId>|P|2.3
 * MSA|<code>|<originalControlId>|<textMessage>
 */
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

  // MSH segment
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

  // MSA segment (Message Acknowledgment)
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

// ── Convenience Functions ───────────────────────────────────────────────────

/** Generate an AA (Application Accept) ACK */
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

/** Generate an AE (Application Error) ACK */
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

/** Generate an AR (Application Reject) ACK */
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

/**
 * Format a JavaScript Date as HL7v2 timestamp (YYYYMMDDHHMMSS).
 */
function formatHL7DateTime(date: Date): string {
  const y = date.getFullYear().toString();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  const sec = date.getSeconds().toString().padStart(2, '0');
  return `${y}${m}${d}${h}${min}${sec}`;
}
