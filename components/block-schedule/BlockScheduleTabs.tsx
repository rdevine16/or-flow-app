// components/block-schedule/BlockScheduleTabs.tsx
// Inline tab navigation for Block Schedule page — switches between
// "Surgeon Blocks" (existing WeekCalendar) and "Room Schedule" (new grid).

'use client'

export type BlockScheduleTab = 'surgeon-blocks' | 'room-schedule'

interface TabConfig {
  key: BlockScheduleTab
  label: string
}

const TABS: TabConfig[] = [
  { key: 'surgeon-blocks', label: 'Surgeon Blocks' },
  { key: 'room-schedule', label: 'Room Schedule' },
]

interface BlockScheduleTabsProps {
  activeTab: BlockScheduleTab
  onTabChange: (tab: BlockScheduleTab) => void
}

export function BlockScheduleTabs({ activeTab, onTabChange }: BlockScheduleTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              relative px-4 py-3 text-sm font-medium whitespace-nowrap
              transition-colors duration-200
              ${isActive
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
              }
            `}
            aria-selected={isActive}
            role="tab"
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
