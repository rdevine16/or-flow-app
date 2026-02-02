// hooks/index.ts
// Clean exports for all custom hooks

// Lookup data hooks
export {
  useProcedureTypes,
  useRooms,
  useDelayTypes,
  useImplantCompanies,
  useSurgeons,
  usePayers,
  useCancellationReasons,
  useCaseStatuses,
  useUserRoles,
  useBodyRegions,
  useProcedureCategories,
} from './useLookups'

export type {
  ProcedureType,
  Room,
  DelayType,
  ImplantCompany,
  Surgeon,
  Payer,
  CancellationReason,
  CaseStatus,
  UserRole,
  BodyRegion,
  ProcedureCategory,
} from './useLookups'

// Async operation hooks
export {
  useAsync,
  useMutation,
  useToggle,
  useDebounce,
  usePrevious,
} from './useAsync'

// Form handling (note: file is .tsx because it contains JSX)
export {
  useForm,
  validators,
  FormField,
} from './useForm'

// Existing hooks (re-export for convenience)
export { useBlockSchedules } from './useBlockSchedules'
export { useElapsedTime } from './useElapsedTime'
export { useFacilityClosures } from './useFacilityClosures'
export { useRoomOrdering } from './useRoomOrdering'
export { useStaffAssignment } from './useStaffAssignment'
export { useSurgeonColors } from './useSurgeonColors'