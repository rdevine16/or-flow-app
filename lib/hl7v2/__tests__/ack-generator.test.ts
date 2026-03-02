import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateACK,
  generateAcceptACK,
  generateErrorACK,
  generateRejectACK,
} from '../ack-generator';
import { parseMessage, getComponent, getFieldValue } from '../parser';

// ── Mock Date for deterministic timestamps ──────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-01T14:30:22'));
});

afterEach(() => {
  vi.useRealTimers();
});

// ── generateACK Tests ───────────────────────────────────────────────────────

describe('generateACK', () => {
  it('generates valid HL7v2 ACK with AA code', () => {
    const ack = generateACK({
      code: 'AA',
      messageControlId: 'MSG00001',
      textMessage: 'Message processed successfully',
    });

    expect(ack.code).toBe('AA');
    expect(ack.messageControlId).toBe('ACKMSG00001');
    expect(ack.textMessage).toBe('Message processed successfully');

    // Verify the raw message is parseable HL7v2
    const parsed = parseMessage(ack.raw);
    expect(parsed.segments).toHaveLength(2);
    expect(parsed.segments[0].name).toBe('MSH');
    expect(parsed.segments[1].name).toBe('MSA');
  });

  it('generates ACK with correct MSH fields', () => {
    const ack = generateACK({
      code: 'AA',
      messageControlId: 'MSG00001',
      sendingApplication: 'ORBIT',
      sendingFacility: 'ORBIT',
      originalSendingApplication: 'EPIC',
      originalSendingFacility: 'SURGERY_CENTER',
    });

    const parsed = parseMessage(ack.raw);
    const msh = parsed.segments[0];

    // MSH-3: sending application (ORBIT responding)
    expect(getComponent(msh, 3, 1)).toBe('ORBIT');
    // MSH-4: sending facility
    expect(getComponent(msh, 4, 1)).toBe('ORBIT');
    // MSH-5: receiving application (original sender)
    expect(getComponent(msh, 5, 1)).toBe('EPIC');
    // MSH-6: receiving facility
    expect(getComponent(msh, 6, 1)).toBe('SURGERY_CENTER');
    // MSH-7: timestamp
    expect(getComponent(msh, 7, 1)).toBe('20260301143022');
    // MSH-9: message type = ACK
    expect(getFieldValue(msh, 9)).toBe('ACK');
    // MSH-10: ACK control ID
    expect(getComponent(msh, 10, 1)).toBe('ACKMSG00001');
    // MSH-11: processing ID
    expect(getComponent(msh, 11, 1)).toBe('P');
    // MSH-12: version
    expect(getComponent(msh, 12, 1)).toBe('2.3');
  });

  it('generates ACK with correct MSA segment', () => {
    const ack = generateACK({
      code: 'AE',
      messageControlId: 'MSG00001',
      textMessage: 'Parse error in PID segment',
    });

    const parsed = parseMessage(ack.raw);
    const msa = parsed.segments[1];

    // MSA-1: ACK code
    expect(getComponent(msa, 1, 1)).toBe('AE');
    // MSA-2: original message control ID
    expect(getComponent(msa, 2, 1)).toBe('MSG00001');
    // MSA-3: text message
    expect(getComponent(msa, 3, 1)).toBe('Parse error in PID segment');
  });

  it('uses \r as segment delimiter', () => {
    const ack = generateACK({
      code: 'AA',
      messageControlId: 'MSG01',
    });
    const segments = ack.raw.split('\r');
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatch(/^MSH/);
    expect(segments[1]).toMatch(/^MSA/);
  });

  it('preserves original message control ID in MSA-2', () => {
    const ack = generateACK({
      code: 'AA',
      messageControlId: 'EPIC-12345-67890',
    });

    const parsed = parseMessage(ack.raw);
    const msa = parsed.segments[1];
    expect(getComponent(msa, 2, 1)).toBe('EPIC-12345-67890');
  });
});

// ── Convenience Functions ───────────────────────────────────────────────────

describe('generateAcceptACK', () => {
  it('generates AA ACK with default message', () => {
    const ack = generateAcceptACK('MSG001');
    expect(ack.code).toBe('AA');
    expect(ack.textMessage).toBe('Message processed successfully');
  });

  it('generates AA ACK with custom message', () => {
    const ack = generateAcceptACK('MSG001', 'Case SC10001 created');
    expect(ack.textMessage).toBe('Case SC10001 created');
  });

  it('passes through original sending info', () => {
    const ack = generateAcceptACK('MSG001', 'OK', 'EPIC', 'SURGERY_CENTER');
    const parsed = parseMessage(ack.raw);
    expect(getComponent(parsed.segments[0], 5, 1)).toBe('EPIC');
    expect(getComponent(parsed.segments[0], 6, 1)).toBe('SURGERY_CENTER');
  });
});

describe('generateErrorACK', () => {
  it('generates AE ACK with error message', () => {
    const ack = generateErrorACK('MSG002', 'Failed to parse SCH segment');
    expect(ack.code).toBe('AE');
    expect(ack.textMessage).toBe('Failed to parse SCH segment');
  });
});

describe('generateRejectACK', () => {
  it('generates AR ACK with reject reason', () => {
    const ack = generateRejectACK('MSG003', 'Invalid API key');
    expect(ack.code).toBe('AR');
    expect(ack.textMessage).toBe('Invalid API key');
  });
});

// ── Default Text Messages ───────────────────────────────────────────────────

describe('default text messages', () => {
  it('AA default message', () => {
    const ack = generateACK({ code: 'AA', messageControlId: 'X' });
    expect(ack.textMessage).toBe('Message accepted');
  });

  it('AE default message', () => {
    const ack = generateACK({ code: 'AE', messageControlId: 'X' });
    expect(ack.textMessage).toBe('Application error processing message');
  });

  it('AR default message', () => {
    const ack = generateACK({ code: 'AR', messageControlId: 'X' });
    expect(ack.textMessage).toBe('Message rejected');
  });
});
