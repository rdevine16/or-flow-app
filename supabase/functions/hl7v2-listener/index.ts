/**
 * HL7v2 Listener — Supabase Edge Function
 *
 * Receives HTTP POST with HL7v2 SIU messages from Epic integration engines
 * (Mirth Connect, Rhapsody). Full processing pipeline:
 *   auth → parse → match entities → create/update case → log → return ACK
 *
 * Deploy: supabase functions deploy hl7v2-listener --no-verify-jwt
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from './auth.ts';
import { parseSIUMessage } from './siu-parser.ts';
import { generateAcceptACK, generateErrorACK, generateRejectACK } from './ack-generator.ts';
import { checkRateLimit, cleanupStaleWindows } from './rate-limiter.ts';
import { handleSIUMessage } from './import-service.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-integration-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const HL7V2_CONTENT_TYPE = 'application/hl7-v2';
const MAX_MESSAGE_SIZE = 1_048_576; // 1MB

const ACCEPTED_CONTENT_TYPES = [
  'application/hl7-v2',
  'text/plain',
  'x-application/hl7-v2+er7',
];

// Periodic stale window cleanup (every ~5 minutes of activity)
let requestCount = 0;
const CLEANUP_INTERVAL = 300;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  // Periodic cleanup
  requestCount++;
  if (requestCount % CLEANUP_INTERVAL === 0) {
    cleanupStaleWindows();
  }

  // Create service role client (bypasses RLS, facility scoping in app code)
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[hl7v2-listener] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return errorResponse('Server configuration error', 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Authenticate
  const authResult = await authenticateRequest(req, supabase);
  if (!authResult.authenticated || !authResult.integration) {
    console.warn('[hl7v2-listener] Auth failed:', authResult.errorMessage);
    const ack = generateRejectACK('UNKNOWN', authResult.errorMessage || 'Authentication failed');
    return hl7Response(ack.raw, 401);
  }

  const integration = authResult.integration;
  const facilityId = integration.facility_id;

  // 2. Rate limit check
  const rateLimit = checkRateLimit(facilityId, integration.config.rate_limit_per_minute);
  if (!rateLimit.allowed) {
    console.warn('[hl7v2-listener] Rate limit exceeded for facility:', facilityId);
    const ack = generateRejectACK('UNKNOWN', 'Rate limit exceeded');
    return hl7Response(ack.raw, 429, {
      'Retry-After': String(Math.ceil((rateLimit.retryAfterMs || 60000) / 1000)),
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': '0',
    });
  }

  // 3. Validate content type
  const contentType = req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '';
  if (contentType && !ACCEPTED_CONTENT_TYPES.includes(contentType)) {
    console.warn('[hl7v2-listener] Unsupported content type:', contentType);
    const ack = generateRejectACK('UNKNOWN', `Unsupported content type: ${contentType}`);
    return hl7Response(ack.raw, 415);
  }

  // 4. Read and validate body
  let rawMessage: string;
  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_MESSAGE_SIZE) {
      const ack = generateRejectACK('UNKNOWN', 'Message exceeds maximum size of 1MB');
      return hl7Response(ack.raw, 413);
    }

    rawMessage = await req.text();
    if (!rawMessage.trim()) {
      const ack = generateErrorACK('UNKNOWN', 'Empty message body');
      return hl7Response(ack.raw, 400);
    }

    if (rawMessage.length > MAX_MESSAGE_SIZE) {
      const ack = generateRejectACK('UNKNOWN', 'Message exceeds maximum size of 1MB');
      return hl7Response(ack.raw, 413);
    }
  } catch {
    const ack = generateErrorACK('UNKNOWN', 'Failed to read request body');
    return hl7Response(ack.raw, 400);
  }

  // 5. Parse HL7v2 message
  const parseResult = parseSIUMessage(rawMessage);
  if (!parseResult.success || !parseResult.message) {
    const errorMsg = parseResult.errors.map(e => `${e.segment}-${e.field}: ${e.message}`).join('; ');
    console.error('[hl7v2-listener] Parse error:', errorMsg);

    // Log the failed parse attempt
    await supabase.from('ehr_integration_log').insert({
      facility_id: facilityId,
      integration_id: integration.id,
      message_type: 'UNKNOWN',
      raw_message: rawMessage,
      processing_status: 'error',
      error_message: `Parse error: ${errorMsg}`,
    });

    // Update integration timestamp even on error
    await supabase
      .from('ehr_integrations')
      .update({ last_message_at: new Date().toISOString(), last_error: `Parse error: ${errorMsg}` })
      .eq('id', integration.id);

    const messageControlId = extractMessageControlId(rawMessage);
    const ack = generateErrorACK(messageControlId, `Parse error: ${errorMsg}`);
    return hl7Response(ack.raw, 400);
  }

  const siu = parseResult.message;

  // 6. Process the message (full import pipeline)
  const result = await handleSIUMessage(supabase, siu, integration, rawMessage);

  // 7. Return ACK
  const controlId = siu.msh.messageControlId;
  const sendApp = siu.msh.sendingApplication;
  const sendFac = siu.msh.sendingFacility;

  if (result.success) {
    let ackText: string;
    switch (result.action) {
      case 'created': ackText = `Case created: ${result.caseId}`; break;
      case 'updated': ackText = `Case updated: ${result.caseId}`; break;
      case 'cancelled': ackText = `Case cancelled: ${result.caseId}`; break;
      case 'pending_review': ackText = 'Message accepted, pending entity review'; break;
      case 'duplicate': ackText = 'Duplicate message, already processed'; break;
      case 'ignored': ackText = 'Message ignored'; break;
      default: ackText = 'Message processed'; break;
    }
    const ack = generateAcceptACK(controlId, ackText, sendApp, sendFac);
    return hl7Response(ack.raw, 200, {
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
    });
  } else {
    const ack = generateErrorACK(controlId, result.errorMessage || 'Processing error', sendApp, sendFac);
    return hl7Response(ack.raw, 422, {
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
    });
  }
});

// ── Response Helpers ────────────────────────────────────────────────────────

function hl7Response(body: string, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(body, {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': HL7V2_CONTENT_TYPE,
      'Connection': 'keep-alive',
      ...extraHeaders,
    },
  });
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Try to extract MSH-10 (message control ID) from raw text even if full parse fails.
 * Used for ACK responses on parse errors.
 */
function extractMessageControlId(rawMessage: string): string {
  try {
    const lines = rawMessage.split(/\r\n|\r|\n/);
    const mshLine = lines.find(l => l.startsWith('MSH'));
    if (!mshLine) return 'UNKNOWN';

    const fields = mshLine.split('|');
    // MSH-10 is field index 9 (0-based, MSH counts | as field 1)
    return fields[9] || 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}
