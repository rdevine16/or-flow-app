# Refactoring Priorities

Generated: 2/8/2026, 1:31:13 PM

## Component Extraction Opportunities

### Status Badge (HIGH)

- File: `app/admin/docs/page.tsx`
- Occurrences: 6
- Reason: Inline status badges should use StatusBadge component

### Status Badge (HIGH)

- File: `app/analytics/flags/page.tsx`
- Occurrences: 3
- Reason: Inline status badges should use StatusBadge component

### Status Badge (HIGH)

- File: `app/dashboard/page.tsx`
- Occurrences: 3
- Reason: Inline status badges should use StatusBadge component

### Status Badge (HIGH)

- File: `app/spd/page.tsx`
- Occurrences: 4
- Reason: Inline status badges should use StatusBadge component

### Delete Button Pattern (MEDIUM)

- File: `app/admin/cancellation-reasons/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/admin/complexities/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/admin/docs/page.tsx`
- Occurrences: 4
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/admin/settings/cost-categories/page.tsx`
- Occurrences: 4
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/admin/settings/delay-types/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/admin/settings/implant-companies/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/cases/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/settings/cancellation-reasons/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/settings/closures/page.tsx`
- Occurrences: 6
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/settings/delay-types/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/settings/facilities/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/settings/financials/cost-categories/page.tsx`
- Occurrences: 5
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/settings/financials/payers/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/settings/financials/surgeon-variance/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/settings/implant-companies/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/settings/procedures/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/settings/rooms/page.tsx`
- Occurrences: 4
- Reason: Delete buttons should have consistent styling and confirmations

### Delete Button Pattern (MEDIUM)

- File: `app/settings/surgeon-preferences/page.tsx`
- Occurrences: 3
- Reason: Delete buttons should have consistent styling and confirmations

### Inline Spinner (LOW)

- File: `app/admin/docs/page.tsx`
- Occurrences: 8
- Reason: Use Spinner component from Loading.tsx

### Inline Spinner (LOW)

- File: `app/admin/facilities/new/page.tsx`
- Occurrences: 3
- Reason: Use Spinner component from Loading.tsx

### Inline Spinner (LOW)

- File: `app/auth/rep-signup/page.tsx`
- Occurrences: 3
- Reason: Use Spinner component from Loading.tsx

### Inline Spinner (LOW)

- File: `app/dashboard/data-quality/page.tsx`
- Occurrences: 3
- Reason: Use Spinner component from Loading.tsx

### Inline Spinner (LOW)

- File: `app/invite/user/[token]/page.tsx`
- Occurrences: 3
- Reason: Use Spinner component from Loading.tsx

## Quick Wins (Do First)

These will have immediate impact with minimal effort:

1. Extract duplicated `getStatusConfig` → use design tokens
2. Replace inline delete confirmations → use ConfirmDialog
3. Replace console.log/error → use Toast notifications
4. Replace hardcoded colors → use design tokens

