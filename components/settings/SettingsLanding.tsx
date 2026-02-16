'use client'

import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/UserContext'
import { Card } from '@/components/ui/CardEnhanced'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { ChevronRight } from 'lucide-react'
import { getVisibleCategories, type BadgeType } from '@/lib/settings-nav-config'

// =====================================================
// BADGE RENDERER
// =====================================================

function ItemBadge({ type }: { type: BadgeType }) {
  const styles: Record<BadgeType, string> = {
    new: 'bg-green-100 text-green-600',
    admin: 'bg-amber-100 text-amber-700',
    soon: 'bg-slate-100 text-slate-500',
  }
  const labels: Record<BadgeType, string> = {
    new: 'New',
    admin: 'Admin',
    soon: 'Soon',
  }

  return (
    <span className={`px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide rounded ${styles[type]}`}>
      {labels[type]}
    </span>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function SettingsLanding() {
  const router = useRouter()
  const { userData, can } = useUser()

  const visibleCategories = getVisibleCategories(can)

  const breadcrumbItems = [
    { label: userData.facilityName || 'Facility', href: '/' },
  ]

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="px-6 py-3">
        <Breadcrumb items={breadcrumbItems} currentPage="Settings" />
      </div>

      {/* Header */}
      <div className="px-6 pb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your facility configuration and preferences</p>
      </div>

      {/* Category Cards Grid */}
      <div className="px-6 pb-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {visibleCategories.map(category => (
          <Card key={category.id} variant="default" padding="none">
            <Card.Header>
              <Card.Title>{category.label}</Card.Title>
              <Card.Description>{category.items.length} {category.items.length === 1 ? 'item' : 'items'}</Card.Description>
            </Card.Header>
            <Card.Content padding="none">
              <div className="divide-y divide-slate-100">
                {category.items.map(item => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => router.push(item.href)}
                      className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-slate-50 transition-colors group"
                    >
                      <Icon className="w-5 h-5 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 truncate">
                          {item.label}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {item.description}
                        </p>
                      </div>
                      {item.badge && <ItemBadge type={item.badge} />}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                    </button>
                  )
                })}
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>
    </div>
  )
}
