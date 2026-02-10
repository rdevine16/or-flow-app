// components/ui/index.ts
// Central export file for all UI components

// Loading components
export { Spinner, PageLoader, LoadingOverlay } from './Loading'

// Skeleton loading (consolidated — single source in Skeleton.tsx)
export {
  Skeleton,
  SkeletonText,
  SkeletonMetricCard,
  SkeletonMetricGrid,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonCaseCard,
  SkeletonCaseList,
  SkeletonChart,
  SkeletonProfile,
  SkeletonPage,
  ErrorState,
} from './Skeleton'

// Status components
export { StatusBadge, StatusBadgeDot } from './StatusBadge'

// Error handling
export { ErrorBanner } from '@/components/ui/ErrorBanner'

// Empty states
export { EmptyState, EmptyStateIcons } from './EmptyState'
export { NoFacilitySelected } from '@/components/ui/NoFacilitySelected'

// Alerts
export { Alert } from './Alert'

// Search
export { SearchInput } from './SearchInput'

// Table actions
export { TableActions } from './TableActions'

// Tooltips
export { Tooltip } from './Tooltip'

// Cards
export { default as Card, StatsCard, ListCard, ProfileCard } from './CardEnhanced'

// Confirm Dialog
export { ConfirmDialog, DeleteConfirm } from './ConfirmDialog'

// Modal
export { Modal } from './Modal'