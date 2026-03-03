import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getIntegrationConfig, getIntegrationConfigOrNull } from '../shared';

vi.mock('@/lib/errorHandling', () => ({
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
}));

// ── Mock Supabase ────────────────────────────────────────────────────────────

function createMockSupabase(integration: { id: string; config: Record<string, unknown> } | null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: integration,
              error: integration ? null : { message: 'Not found' },
            }),
          }),
        }),
      }),
    }),
  } as unknown as Parameters<typeof getIntegrationConfig>[0];
}

describe('getIntegrationConfig', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
  });

  it('returns endpoint URL and API key for configured facility', async () => {
    const supabase = createMockSupabase({
      id: 'int-1',
      config: { api_key: 'my-secret-key' },
    });

    const result = await getIntegrationConfig(supabase, 'fac-1');

    expect(result.endpointUrl).toBe('https://test.supabase.co/functions/v1/hl7v2-listener');
    expect(result.apiKey).toBe('my-secret-key');
  });

  it('throws when no integration found', async () => {
    const supabase = createMockSupabase(null);

    await expect(getIntegrationConfig(supabase, 'fac-none')).rejects.toThrow(
      'No HL7v2 integration configured'
    );
  });

  it('throws when API key is missing', async () => {
    const supabase = createMockSupabase({
      id: 'int-1',
      config: {},
    });

    await expect(getIntegrationConfig(supabase, 'fac-1')).rejects.toThrow(
      'Integration has no API key'
    );
  });
});

describe('getIntegrationConfigOrNull', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
  });

  it('returns config for configured facility', async () => {
    const supabase = createMockSupabase({
      id: 'int-1',
      config: { api_key: 'my-secret-key' },
    });

    const result = await getIntegrationConfigOrNull(supabase, 'fac-1');

    expect(result).not.toBeNull();
    expect(result!.endpointUrl).toBe('https://test.supabase.co/functions/v1/hl7v2-listener');
    expect(result!.apiKey).toBe('my-secret-key');
  });

  it('returns null when no integration found', async () => {
    const supabase = createMockSupabase(null);

    const result = await getIntegrationConfigOrNull(supabase, 'fac-none');

    expect(result).toBeNull();
  });

  it('returns null when API key is missing', async () => {
    const supabase = createMockSupabase({
      id: 'int-1',
      config: {},
    });

    const result = await getIntegrationConfigOrNull(supabase, 'fac-1');

    expect(result).toBeNull();
  });

  it('returns null when SUPABASE_URL not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabase = createMockSupabase({
      id: 'int-1',
      config: { api_key: 'my-secret-key' },
    });

    const result = await getIntegrationConfigOrNull(supabase, 'fac-1');

    expect(result).toBeNull();
  });
});
