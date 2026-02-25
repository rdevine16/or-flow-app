/**
 * AUDIT: Data Pipeline Verification Script
 *
 * Simulates the full case lifecycle and verifies data integrity at each step:
 *   Create case → Record milestones → Complete → Validate → Stats → Analytics → Cleanup
 *
 * USAGE:
 *   npx tsx scripts/audit-data-flow-test.ts
 *
 * PREREQUISITES:
 *   - .env.local must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - npm install @supabase/supabase-js dotenv (already in project deps)
 *
 * ⚠️  This is a READ + WRITE test. It creates a real case, then cleans it up.
 *     Review carefully before running. Uses service role to bypass RLS.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepResult {
  step: string;
  passed: boolean;
  detail: string;
  issues: string[];
}

interface Prerequisites {
  facilityId: string;
  facilityName: string;
  surgeonId: string;
  surgeonName: string;
  procedureTypeId: string;
  procedureName: string;
  templateId: string;
  templateName: string;
  expectedMilestoneCount: number;
  scheduledStatusId: string;
  completedStatusId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const results: StepResult[] = [];
const allIssues: string[] = [];
let testCaseId: string | null = null;

function log(msg: string) {
  console.log(`  ${msg}`);
}

function logHeader(step: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${step}`);
  console.log('='.repeat(70));
}

function recordResult(step: string, passed: boolean, detail: string, issues: string[] = []) {
  results.push({ step, passed, detail, issues });
  allIssues.push(...issues);
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n  >> ${status}: ${detail}`);
  for (const issue of issues) {
    console.log(`     ⚠️  ${issue}`);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Step 1: Verify Prerequisites
// ---------------------------------------------------------------------------

async function step1_prerequisites(): Promise<Prerequisites | null> {
  logHeader('STEP 1: Verify Prerequisites');

  // 1a) Find a facility
  const { data: facilities, error: facErr } = await supabase
    .from('facilities')
    .select('id, name')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (facErr || !facilities) {
    recordResult('Step 1', false, 'No active facility found', [facErr?.message ?? 'No facilities']);
    return null;
  }

  const facilityId = facilities.id;
  log(`Facility: ${facilities.name} (${facilityId})`);

  // 1b) Find a surgeon in this facility
  const { data: surgeon, error: surgErr } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('facility_id', facilityId)
    .eq('is_active', true)
    .eq('role', 'surgeon')
    .limit(1)
    .single();

  if (surgErr || !surgeon) {
    recordResult('Step 1', false, 'No active surgeon found in facility', [surgErr?.message ?? 'No surgeons']);
    return null;
  }

  const surgeonId = surgeon.id;
  const surgeonName = `${surgeon.first_name} ${surgeon.last_name}`;
  log(`Surgeon: ${surgeonName} (${surgeonId})`);

  // 1c) Find a procedure type with a milestone template
  //     Cascade: surgeon_template_overrides → procedure_types.milestone_template_id → facility default
  let templateId: string | null = null;
  let procedureTypeId: string | null = null;
  let procedureName = '';
  let templateName = '';

  // Try surgeon override first
  const { data: override } = await supabase
    .from('surgeon_template_overrides')
    .select('milestone_template_id, procedure_type_id, milestone_templates(name), procedure_types(name)')
    .eq('surgeon_id', surgeonId)
    .eq('facility_id', facilityId)
    .limit(1)
    .single();

  if (override?.milestone_template_id) {
    templateId = override.milestone_template_id;
    procedureTypeId = override.procedure_type_id;
    procedureName = (override.procedure_types as unknown as { name: string })?.name ?? 'Unknown';
    templateName = (override.milestone_templates as unknown as { name: string })?.name ?? 'Unknown';
    log('Template source: surgeon_template_overrides');
  }

  // Fallback: procedure type with template
  if (!templateId) {
    const { data: proc } = await supabase
      .from('procedure_types')
      .select('id, name, milestone_template_id, milestone_templates(name)')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .not('milestone_template_id', 'is', null)
      .limit(1)
      .single();

    if (proc?.milestone_template_id) {
      templateId = proc.milestone_template_id;
      procedureTypeId = proc.id;
      procedureName = proc.name;
      templateName = (proc.milestone_templates as unknown as { name: string })?.name ?? 'Unknown';
      log('Template source: procedure_types.milestone_template_id');
    }
  }

  // Fallback: facility default template
  if (!templateId) {
    const { data: defaultTpl } = await supabase
      .from('milestone_templates')
      .select('id, name')
      .eq('facility_id', facilityId)
      .eq('is_default', true)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (defaultTpl) {
      templateId = defaultTpl.id;
      templateName = defaultTpl.name;
      log('Template source: facility default');
    }

    // Pick any active procedure type
    if (!procedureTypeId) {
      const { data: anyProc } = await supabase
        .from('procedure_types')
        .select('id, name')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (anyProc) {
        procedureTypeId = anyProc.id;
        procedureName = anyProc.name;
      }
    }
  }

  if (!templateId || !procedureTypeId) {
    recordResult('Step 1', false, 'No milestone template found via cascade', [
      `templateId: ${templateId}, procedureTypeId: ${procedureTypeId}`,
    ]);
    return null;
  }

  log(`Procedure: ${procedureName} (${procedureTypeId})`);
  log(`Template: ${templateName} (${templateId})`);

  // 1d) Count expected milestones from template
  const { count: milestoneCount } = await supabase
    .from('milestone_template_items')
    .select('facility_milestone_id', { count: 'exact' })
    .eq('template_id', templateId);

  // Distinct count (shared boundaries collapse)
  const { data: distinctMilestones } = await supabase
    .from('milestone_template_items')
    .select('facility_milestone_id')
    .eq('template_id', templateId);

  const uniqueIds = new Set(distinctMilestones?.map((m) => m.facility_milestone_id));
  const expectedCount = uniqueIds.size;
  log(`Template items: ${milestoneCount} rows → ${expectedCount} distinct milestones`);

  // 1e) Look up status IDs
  const { data: statuses } = await supabase
    .from('case_statuses')
    .select('id, name')
    .in('name', ['scheduled', 'completed']);

  const scheduledId = statuses?.find((s) => s.name === 'scheduled')?.id;
  const completedId = statuses?.find((s) => s.name === 'completed')?.id;

  if (!scheduledId || !completedId) {
    recordResult('Step 1', false, 'Missing case_statuses rows', [
      `scheduled: ${scheduledId}, completed: ${completedId}`,
    ]);
    return null;
  }

  log(`Status IDs — scheduled: ${scheduledId}, completed: ${completedId}`);

  recordResult('Step 1', true, 'All prerequisites found');

  return {
    facilityId,
    facilityName: facilities.name,
    surgeonId,
    surgeonName,
    procedureTypeId,
    procedureName,
    templateId,
    templateName,
    expectedMilestoneCount: expectedCount,
    scheduledStatusId: scheduledId,
    completedStatusId: completedId,
  };
}

// ---------------------------------------------------------------------------
// Step 2: Create a Test Case
// ---------------------------------------------------------------------------

async function step2_createCase(prereqs: Prerequisites): Promise<boolean> {
  logHeader('STEP 2: Create Test Case + Verify Milestones');

  const caseNumber = `AUDIT-${Date.now()}`;
  const today = new Date().toISOString().split('T')[0];

  log(`Creating case: ${caseNumber}, date: ${today}`);

  const { data: caseId, error: rpcErr } = await supabase.rpc('create_case_with_milestones', {
    p_case_number: caseNumber,
    p_scheduled_date: today,
    p_start_time: '08:00:00',
    p_or_room_id: null,
    p_procedure_type_id: prereqs.procedureTypeId,
    p_status_id: prereqs.scheduledStatusId,
    p_surgeon_id: prereqs.surgeonId,
    p_facility_id: prereqs.facilityId,
    p_created_by: null,
    p_operative_side: null,
    p_payer_id: null,
    p_notes: 'AUDIT DATA FLOW TEST — safe to delete',
    p_rep_required_override: null,
    p_is_draft: false,
    p_staff_assignments: null,
  });

  if (rpcErr || !caseId) {
    recordResult('Step 2', false, 'create_case_with_milestones RPC failed', [
      rpcErr?.message ?? 'No case ID returned',
    ]);
    return false;
  }

  testCaseId = caseId;
  log(`Case created: ${testCaseId}`);

  // Verify case has milestone_template_id stamped
  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, case_number, milestone_template_id, data_validated, is_excluded_from_metrics')
    .eq('id', testCaseId)
    .single();

  log(`  milestone_template_id: ${caseRow?.milestone_template_id ?? 'NULL'}`);
  log(`  data_validated: ${caseRow?.data_validated}`);

  // Verify milestones
  const { data: milestones, error: milErr } = await supabase
    .from('case_milestones')
    .select('id, facility_milestone_id, recorded_at, facility_milestones(name, display_name)')
    .eq('case_id', testCaseId)
    .order('created_at', { ascending: true });

  if (milErr) {
    recordResult('Step 2', false, 'Failed to query case_milestones', [milErr.message]);
    return false;
  }

  const milestoneRows = milestones ?? [];
  log(`  Milestones created: ${milestoneRows.length} (expected ${prereqs.expectedMilestoneCount})`);

  const issues: string[] = [];

  if (milestoneRows.length !== prereqs.expectedMilestoneCount) {
    issues.push(
      `Expected ${prereqs.expectedMilestoneCount} milestones, got ${milestoneRows.length}`
    );
  }

  // Verify all recorded_at are NULL
  const recordedCount = milestoneRows.filter((m) => m.recorded_at !== null).length;
  if (recordedCount > 0) {
    issues.push(`${recordedCount} milestones already have recorded_at set (should all be NULL)`);
  }

  // Verify all have valid facility_milestone_id
  const nullFmIds = milestoneRows.filter((m) => !m.facility_milestone_id).length;
  if (nullFmIds > 0) {
    issues.push(`${nullFmIds} milestones have NULL facility_milestone_id`);
  }

  // Verify template stamp
  if (caseRow?.milestone_template_id !== prereqs.templateId) {
    issues.push(
      `milestone_template_id mismatch: expected ${prereqs.templateId}, got ${caseRow?.milestone_template_id}`
    );
  }

  // Log each milestone
  for (const m of milestoneRows) {
    const fm = m.facility_milestones as unknown as { name: string; display_name: string };
    log(`    - ${fm?.display_name ?? fm?.name ?? 'unknown'} (${m.facility_milestone_id}): recorded_at=${m.recorded_at ?? 'NULL'}`);
  }

  recordResult(
    'Step 2',
    issues.length === 0,
    `${milestoneRows.length}/${prereqs.expectedMilestoneCount} milestones created, template stamped`,
    issues
  );

  return issues.length === 0;
}

// ---------------------------------------------------------------------------
// Step 3: Record Milestones (simulate timestamps)
// ---------------------------------------------------------------------------

async function step3_recordMilestones(): Promise<boolean> {
  logHeader('STEP 3: Record Milestones');

  if (!testCaseId) {
    recordResult('Step 3', false, 'No test case ID', ['Skipped — Step 2 failed']);
    return false;
  }

  // Get milestones ordered by template display_order via the facility_milestone join
  const { data: milestones } = await supabase
    .from('case_milestones')
    .select('id, facility_milestone_id, facility_milestones(name, display_name)')
    .eq('case_id', testCaseId)
    .order('created_at', { ascending: true });

  if (!milestones?.length) {
    recordResult('Step 3', false, 'No milestones found', []);
    return false;
  }

  // Sort by template display_order to get proper sequence
  // We'll fetch the template item order for accurate sequencing
  const { data: caseRow } = await supabase
    .from('cases')
    .select('milestone_template_id')
    .eq('id', testCaseId)
    .single();

  const templateId = caseRow?.milestone_template_id;
  let orderedMilestones = milestones;

  if (templateId) {
    const { data: templateItems } = await supabase
      .from('milestone_template_items')
      .select('facility_milestone_id, display_order')
      .eq('template_id', templateId)
      .order('display_order', { ascending: true });

    if (templateItems) {
      // Build order map (use MIN display_order for shared boundaries)
      const orderMap = new Map<string, number>();
      for (const ti of templateItems) {
        const existing = orderMap.get(ti.facility_milestone_id);
        if (existing === undefined || ti.display_order < existing) {
          orderMap.set(ti.facility_milestone_id, ti.display_order);
        }
      }

      orderedMilestones = [...milestones].sort((a, b) => {
        const orderA = orderMap.get(a.facility_milestone_id) ?? 999;
        const orderB = orderMap.get(b.facility_milestone_id) ?? 999;
        return orderA - orderB;
      });
    }
  }

  // Record each milestone with 5-minute spacing starting from "now"
  const baseTime = new Date();
  const issues: string[] = [];
  let successCount = 0;

  for (let i = 0; i < orderedMilestones.length; i++) {
    const m = orderedMilestones[i];
    const fm = m.facility_milestones as unknown as { name: string; display_name: string };
    const recordedAt = new Date(baseTime.getTime() + i * 5 * 60 * 1000).toISOString();

    const { error: updateErr } = await supabase
      .from('case_milestones')
      .update({ recorded_at: recordedAt })
      .eq('id', m.id);

    if (updateErr) {
      issues.push(`Failed to record ${fm?.name}: ${updateErr.message}`);
      log(`  ❌ ${fm?.display_name ?? fm?.name}: FAILED — ${updateErr.message}`);
    } else {
      successCount++;
      log(`  ✓ ${fm?.display_name ?? fm?.name}: ${recordedAt}`);
    }
  }

  // Verify all milestones are recorded
  const { data: verified } = await supabase
    .from('case_milestones')
    .select('id, recorded_at')
    .eq('case_id', testCaseId)
    .is('recorded_at', null);

  const unrecorded = verified?.length ?? 0;
  if (unrecorded > 0) {
    issues.push(`${unrecorded} milestones still have NULL recorded_at after recording`);
  }

  recordResult(
    'Step 3',
    issues.length === 0,
    `${successCount}/${orderedMilestones.length} milestones recorded`,
    issues
  );

  return issues.length === 0;
}

// ---------------------------------------------------------------------------
// Step 4: Complete + Validate the Case → Verify Stats Pipeline
// ---------------------------------------------------------------------------

async function step4_validateAndCheckStats(prereqs: Prerequisites): Promise<boolean> {
  logHeader('STEP 4: Complete + Validate Case → Verify Stats Pipeline');

  if (!testCaseId) {
    recordResult('Step 4', false, 'No test case ID', ['Skipped — earlier step failed']);
    return false;
  }

  // 4a) Update status to 'completed'
  log('Setting status to "completed"...');
  const { error: statusErr } = await supabase
    .from('cases')
    .update({ status_id: prereqs.completedStatusId })
    .eq('id', testCaseId);

  if (statusErr) {
    recordResult('Step 4', false, 'Failed to set status to completed', [statusErr.message]);
    return false;
  }

  // Wait for triggers (refresh_all_stats, flag detection, recalculate_surgeon_averages)
  log('Waiting 3s for completion triggers...');
  await sleep(3000);

  // 4b) Set data_validated = true (triggers record_case_stats)
  log('Setting data_validated = true...');
  const { error: valErr } = await supabase
    .from('cases')
    .update({ data_validated: true })
    .eq('id', testCaseId);

  if (valErr) {
    recordResult('Step 4', false, 'Failed to set data_validated', [valErr.message]);
    return false;
  }

  // Wait for trigger_record_stats_on_validation
  log('Waiting 3s for stats pipeline...');
  await sleep(3000);

  // 4c) Verify case_completion_stats
  const { data: stats, error: statsErr } = await supabase
    .from('case_completion_stats')
    .select('*')
    .eq('case_id', testCaseId)
    .single();

  if (statsErr || !stats) {
    recordResult('Step 4', false, 'No case_completion_stats row found', [
      statsErr?.message ?? 'Row does not exist after data_validated = true',
      'The record_case_stats() trigger may have failed — check Supabase logs',
    ]);
    return false;
  }

  log('case_completion_stats row found!');

  // Enumerate all columns and report which are populated vs NULL
  const EXPECTED_COLUMNS = [
    'id', 'case_id', 'case_number', 'facility_id', 'surgeon_id', 'procedure_type_id',
    'payer_id', 'or_room_id', 'case_date', 'scheduled_start_time', 'actual_start_time',
    'total_duration_minutes', 'surgical_duration_minutes', 'anesthesia_duration_minutes',
    'call_to_patient_in_minutes', 'schedule_variance_minutes', 'room_turnover_minutes',
    'surgical_turnover_minutes', 'is_first_case_of_day_room', 'is_first_case_of_day_surgeon',
    'surgeon_room_count', 'surgeon_case_sequence', 'room_case_sequence',
    'reimbursement', 'soft_goods_cost', 'hard_goods_cost', 'or_cost', 'profit',
    'or_hourly_rate', 'created_at', 'updated_at', 'data_validated',
    'total_debits', 'total_credits', 'net_cost', 'or_time_cost',
    'is_excluded', 'excluded_at', 'excluded_by', 'exclusion_reason', 'cost_source',
  ];

  const populated: string[] = [];
  const nullColumns: string[] = [];
  const issues: string[] = [];

  for (const col of EXPECTED_COLUMNS) {
    const val = (stats as Record<string, unknown>)[col];
    if (val === null || val === undefined) {
      nullColumns.push(col);
      log(`  ${col}: NULL`);
    } else {
      populated.push(col);
      log(`  ${col}: ${val}`);
    }
  }

  // Some NULL columns are expected (payer_id, or_room_id may be null for the test case,
  // exclusion columns should be null). Flag unexpected NULLs.
  const expectedNulls = new Set([
    'payer_id', 'or_room_id', 'actual_start_time',
    'excluded_at', 'excluded_by', 'exclusion_reason',
    'reimbursement', 'cost_source',
  ]);

  const unexpectedNulls = nullColumns.filter((c) => !expectedNulls.has(c));
  if (unexpectedNulls.length > 0) {
    issues.push(`Unexpected NULL columns: ${unexpectedNulls.join(', ')}`);
  }

  // Verify key computed fields
  if (stats.total_duration_minutes === null) {
    issues.push('total_duration_minutes is NULL — milestone timestamps may not have been computed');
  }
  if (stats.case_date === null) {
    issues.push('case_date is NULL');
  }
  if (stats.facility_id !== prereqs.facilityId) {
    issues.push(`facility_id mismatch: ${stats.facility_id} vs ${prereqs.facilityId}`);
  }

  recordResult(
    'Step 4',
    issues.length === 0,
    `Stats row exists: ${populated.length}/${EXPECTED_COLUMNS.length} columns populated, ${nullColumns.length} NULL [${nullColumns.join(', ')}]`,
    issues
  );

  return true; // Continue even with issues
}

// ---------------------------------------------------------------------------
// Step 5: Verify Materialized Views
// ---------------------------------------------------------------------------

async function step5_materializedViews(prereqs: Prerequisites): Promise<boolean> {
  logHeader('STEP 5: Verify Materialized Views');

  if (!testCaseId) {
    recordResult('Step 5', false, 'No test case ID', ['Skipped']);
    return false;
  }

  const issues: string[] = [];

  // Note: The trg_refresh_stats_on_completion trigger already ran refresh_all_stats()
  // when we set status to 'completed' in Step 4. But our stats row was created AFTER
  // that (on data_validated). So we need to check if the views are stale.
  //
  // We can't call REFRESH MATERIALIZED VIEW via supabase-js without a custom RPC.
  // Instead, we check if the case's surgeon+procedure combo appears in the view.
  // It may NOT appear yet because the view was refreshed before stats were created.

  // 5a) surgeon_procedure_stats
  log('Checking surgeon_procedure_stats...');
  const { data: procStats, error: procErr } = await supabase
    .from('surgeon_procedure_stats')
    .select('*')
    .eq('facility_id', prereqs.facilityId)
    .eq('surgeon_id', prereqs.surgeonId)
    .eq('procedure_type_id', prereqs.procedureTypeId)
    .single();

  if (procErr && procErr.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    issues.push(`surgeon_procedure_stats query error: ${procErr.message}`);
  }

  if (procStats) {
    log(`  Found: sample_size=${procStats.sample_size}, median_duration=${procStats.median_duration}`);
    log(`  last_case_date=${procStats.last_case_date}`);
  } else {
    log('  No row found (view may need refresh after stats were created)');
    issues.push(
      'surgeon_procedure_stats has no row for this surgeon+procedure. ' +
      'Expected: view was refreshed on status→completed, but stats were created AFTER that (on data_validated). ' +
      'This is a known timing gap — the view refresh and stats creation are triggered by different events.'
    );
  }

  // 5b) surgeon_overall_stats
  log('Checking surgeon_overall_stats...');
  const { data: overallStats, error: overallErr } = await supabase
    .from('surgeon_overall_stats')
    .select('*')
    .eq('facility_id', prereqs.facilityId)
    .eq('surgeon_id', prereqs.surgeonId)
    .single();

  if (overallErr && overallErr.code !== 'PGRST116') {
    issues.push(`surgeon_overall_stats query error: ${overallErr.message}`);
  }

  if (overallStats) {
    log(`  Found: total_cases=${overallStats.total_cases}, median_duration=${overallStats.median_duration}`);
  } else {
    log('  No row found (same timing gap as above)');
  }

  // 5c) Try to call refresh_all_stats() via RPC (if accessible)
  log('Attempting refresh_all_stats() RPC...');
  const { error: refreshErr } = await supabase.rpc('refresh_all_stats');

  if (refreshErr) {
    log(`  refresh_all_stats() failed: ${refreshErr.message}`);
    log('  (This is expected if the function is not exposed via PostgREST)');
  } else {
    log('  refresh_all_stats() succeeded! Re-checking views...');
    await sleep(2000);

    // Re-check after refresh
    const { data: procStats2 } = await supabase
      .from('surgeon_procedure_stats')
      .select('sample_size, median_duration, last_case_date')
      .eq('facility_id', prereqs.facilityId)
      .eq('surgeon_id', prereqs.surgeonId)
      .eq('procedure_type_id', prereqs.procedureTypeId)
      .single();

    if (procStats2) {
      log(`  After refresh — surgeon_procedure_stats: sample_size=${procStats2.sample_size}`);
      // Clear the timing gap issue since refresh worked
      const idx = issues.findIndex((i) => i.includes('timing gap'));
      if (idx >= 0) issues.splice(idx, 1);
    }

    const { data: overallStats2 } = await supabase
      .from('surgeon_overall_stats')
      .select('total_cases, median_duration')
      .eq('facility_id', prereqs.facilityId)
      .eq('surgeon_id', prereqs.surgeonId)
      .single();

    if (overallStats2) {
      log(`  After refresh — surgeon_overall_stats: total_cases=${overallStats2.total_cases}`);
    }
  }

  recordResult(
    'Step 5',
    issues.filter((i) => !i.includes('timing gap')).length === 0,
    `Materialized views checked${refreshErr ? ' (no RPC refresh available)' : ' (refreshed)'}`,
    issues
  );

  return true;
}

// ---------------------------------------------------------------------------
// Step 6: Verify Analytics Queries
// ---------------------------------------------------------------------------

async function step6_analyticsQueries(prereqs: Prerequisites): Promise<boolean> {
  logHeader('STEP 6: Verify Analytics Queries (RPCs)');

  if (!testCaseId) {
    recordResult('Step 6', false, 'No test case ID', ['Skipped']);
    return false;
  }

  const issues: string[] = [];

  // 6a) get_milestone_interval_medians
  log('Calling get_milestone_interval_medians...');
  const { data: intervalData, error: intervalErr } = await supabase.rpc(
    'get_milestone_interval_medians',
    {
      p_surgeon_id: prereqs.surgeonId,
      p_procedure_type_id: prereqs.procedureTypeId,
      p_facility_id: prereqs.facilityId,
    }
  );

  if (intervalErr) {
    issues.push(`get_milestone_interval_medians failed: ${intervalErr.message}`);
    log(`  ❌ ${intervalErr.message}`);
  } else if (!intervalData?.length) {
    log('  No interval data returned (test case may be the only completed case for this combo)');
    log('  This is expected if there are no other validated+completed cases for this surgeon+procedure');
  } else {
    log(`  Returned ${intervalData.length} milestone intervals:`);
    for (const row of intervalData) {
      log(
        `    ${row.milestone_name}: surgeon_median=${row.surgeon_median_minutes}min (n=${row.surgeon_case_count}), ` +
        `facility_median=${row.facility_median_minutes}min (n=${row.facility_case_count})`
      );
    }
  }

  // 6b) get_phase_medians
  log('Calling get_phase_medians...');
  const { data: phaseData, error: phaseErr } = await supabase.rpc('get_phase_medians', {
    p_facility_id: prereqs.facilityId,
    p_procedure_type_id: prereqs.procedureTypeId,
    p_surgeon_id: prereqs.surgeonId,
    p_milestone_template_id: prereqs.templateId,
  });

  if (phaseErr) {
    issues.push(`get_phase_medians failed: ${phaseErr.message}`);
    log(`  ❌ ${phaseErr.message}`);
  } else if (!phaseData?.length) {
    log('  No phase data returned');
  } else {
    log(`  Returned ${phaseData.length} phases:`);
    for (const row of phaseData) {
      log(
        `    ${row.phase_display_name ?? row.phase_name}: surgeon_median=${row.surgeon_median_minutes}min (n=${row.surgeon_n}), ` +
        `facility_median=${row.facility_median_minutes}min (n=${row.facility_n})`
      );
    }
  }

  // 6c) Direct case query (similar to analytics page)
  log('Running direct case query (mimics analytics page)...');
  const today = new Date().toISOString().split('T')[0];
  const { data: caseRows, error: caseErr } = await supabase
    .from('cases')
    .select(`
      id, case_number, scheduled_date, data_validated, is_excluded_from_metrics,
      users!cases_surgeon_id_fkey(first_name, last_name),
      procedure_types(name),
      case_milestones(id, recorded_at, facility_milestones(name, display_name))
    `)
    .eq('facility_id', prereqs.facilityId)
    .eq('id', testCaseId)
    .single();

  if (caseErr) {
    issues.push(`Direct case query failed: ${caseErr.message}`);
    log(`  ❌ ${caseErr.message}`);
  } else {
    log(`  Case ${caseRows.case_number}: validated=${caseRows.data_validated}, excluded=${caseRows.is_excluded_from_metrics}`);
    const milestones = caseRows.case_milestones as unknown as Array<{
      id: string;
      recorded_at: string | null;
      facility_milestones: { name: string; display_name: string };
    }>;
    const recorded = milestones?.filter((m) => m.recorded_at !== null).length ?? 0;
    log(`  Milestones: ${recorded}/${milestones?.length ?? 0} recorded`);
  }

  // 6d) get_flag_analytics (if available)
  log('Calling get_flag_analytics...');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: flagData, error: flagErr } = await supabase.rpc('get_flag_analytics', {
    p_facility_id: prereqs.facilityId,
    p_start_date: thirtyDaysAgo,
    p_end_date: today,
  });

  if (flagErr) {
    log(`  get_flag_analytics error: ${flagErr.message}`);
    // Not a hard failure — function may not be accessible
  } else if (flagData) {
    const summary = flagData.summary;
    if (summary) {
      log(`  Flag analytics: ${summary.total_cases} total cases, ${summary.flagged_cases} flagged, rate=${summary.flag_rate}`);
    }
  }

  recordResult(
    'Step 6',
    issues.length === 0,
    'Analytics queries executed',
    issues
  );

  return true;
}

// ---------------------------------------------------------------------------
// Step 7: Cleanup
// ---------------------------------------------------------------------------

async function step7_cleanup(prereqs: Prerequisites): Promise<boolean> {
  logHeader('STEP 7: Cleanup');

  if (!testCaseId) {
    recordResult('Step 7', false, 'No test case ID', ['Nothing to clean up']);
    return false;
  }

  const issues: string[] = [];

  // NOTE: The cases table does NOT have is_active/deleted_at columns.
  // It uses cancellation (cancelled_at) rather than soft-delete.
  // For cleanup, we:
  //   1. Set data_validated = false → triggers removal from case_completion_stats
  //   2. Hard-delete the test case and its milestones

  // 7a) Invalidate → removes stats
  log('Setting data_validated = false (removes case_completion_stats)...');
  const { error: invalErr } = await supabase
    .from('cases')
    .update({ data_validated: false })
    .eq('id', testCaseId);

  if (invalErr) {
    issues.push(`Failed to invalidate: ${invalErr.message}`);
  }

  await sleep(2000);

  // Verify stats are gone
  const { data: statsCheck } = await supabase
    .from('case_completion_stats')
    .select('id')
    .eq('case_id', testCaseId);

  if (statsCheck && statsCheck.length > 0) {
    issues.push('case_completion_stats row still exists after invalidation');
    log('  ⚠️ Stats row persisted — trigger may not have fired');
  } else {
    log('  ✓ case_completion_stats row removed');
  }

  // Check case_milestone_stats too
  const { data: milStatsCheck } = await supabase
    .from('case_milestone_stats')
    .select('id')
    .eq('case_id', testCaseId);

  if (milStatsCheck && milStatsCheck.length > 0) {
    issues.push(`case_milestone_stats still has ${milStatsCheck.length} rows after invalidation`);
    log(`  ⚠️ ${milStatsCheck.length} case_milestone_stats rows persisted`);
  } else {
    log('  ✓ case_milestone_stats rows removed');
  }

  // 7b) Hard-delete case milestones
  log('Hard-deleting case_milestones...');
  const { error: milDelErr } = await supabase
    .from('case_milestones')
    .delete()
    .eq('case_id', testCaseId);

  if (milDelErr) {
    issues.push(`Failed to delete milestones: ${milDelErr.message}`);
    log(`  ❌ ${milDelErr.message}`);
  } else {
    log('  ✓ case_milestones deleted');
  }

  // 7c) Hard-delete the case
  log('Hard-deleting test case...');
  const { error: caseDelErr } = await supabase
    .from('cases')
    .delete()
    .eq('id', testCaseId);

  if (caseDelErr) {
    issues.push(`Failed to delete case: ${caseDelErr.message}`);
    log(`  ❌ ${caseDelErr.message}`);
  } else {
    log('  ✓ Test case deleted');
  }

  // 7d) Verify case is gone
  const { data: caseGone } = await supabase
    .from('cases')
    .select('id')
    .eq('id', testCaseId);

  if (caseGone && caseGone.length > 0) {
    issues.push('Test case still exists after deletion');
  } else {
    log('  ✓ Confirmed: case no longer exists');
  }

  // 7e) Note about materialized views
  log('Note: Materialized views may still reference old data until next refresh.');
  log('The trg_refresh_stats_on_completion trigger only fires on status→completed transitions.');
  log('A manual refresh_all_stats() call would be needed to update views after deletion.');

  recordResult('Step 7', issues.length === 0, 'Cleanup complete', issues);

  return issues.length === 0;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function printSummary() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              AUDIT DATA FLOW TEST RESULTS                           ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');

  for (const r of results) {
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    const line = `║  ${r.step}: ${status} — ${r.detail}`;
    console.log(line.padEnd(72) + '║');
  }

  console.log('╠══════════════════════════════════════════════════════════════════════╣');

  if (allIssues.length === 0) {
    console.log('║  No issues found.                                                    ║');
  } else {
    console.log('║  ISSUES FOUND:                                                       ║');
    for (const issue of allIssues) {
      // Word-wrap long issues
      const chunks = issue.match(/.{1,64}/g) ?? [issue];
      for (let i = 0; i < chunks.length; i++) {
        const prefix = i === 0 ? '  - ' : '    ';
        const line = `║${prefix}${chunks[i]}`;
        console.log(line.padEnd(72) + '║');
      }
    }
  }

  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  ORbit Data Pipeline Verification Script                            ║');
  console.log('║  ⚠️  This creates and deletes a real case. Review before running.   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);

  try {
    // Step 1
    const prereqs = await step1_prerequisites();
    if (!prereqs) {
      printSummary();
      process.exit(1);
    }

    // Step 2
    const step2ok = await step2_createCase(prereqs);

    // Step 3
    const step3ok = await step3_recordMilestones();

    // Step 4
    await step4_validateAndCheckStats(prereqs);

    // Step 5
    await step5_materializedViews(prereqs);

    // Step 6
    await step6_analyticsQueries(prereqs);

    // Step 7 — always attempt cleanup even if earlier steps failed
    await step7_cleanup(prereqs);
  } catch (err) {
    console.error('\n  FATAL ERROR:', err);

    // Emergency cleanup
    if (testCaseId) {
      console.log('\n  Attempting emergency cleanup...');
      try {
        await supabase.from('cases').update({ data_validated: false }).eq('id', testCaseId);
        await sleep(1000);
        await supabase.from('case_milestones').delete().eq('case_id', testCaseId);
        await supabase.from('cases').delete().eq('id', testCaseId);
        console.log('  Emergency cleanup succeeded.');
      } catch (cleanupErr) {
        console.error('  Emergency cleanup FAILED:', cleanupErr);
        console.error(`  Manual cleanup needed: DELETE FROM cases WHERE id = '${testCaseId}'`);
      }
    }
  }

  printSummary();
  process.exit(allIssues.length > 0 ? 1 : 0);
}

main();
