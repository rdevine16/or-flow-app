// lib/exportRoomSchedulePdf.ts
// Generates a professional B&W-friendly PDF of the room schedule grid
// Uses jspdf + jspdf-autotable — no custom cell drawing, all native autotable rendering

import { jsPDF } from 'jspdf'
import autoTable, { type CellDef, type CellHookData } from 'jspdf-autotable'
import { roomDateKey, type RoomDateAssignmentMap } from '@/types/room-scheduling'
import { getRoleStyle } from '@/lib/roleStyles'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface RoomSchedulePdfData {
  facilityName: string
  weekLabel: string
  weekDates: Date[]
  rooms: { id: string; name: string }[]
  assignmentMap: RoomDateAssignmentMap
  isRoomClosedOnDay: (roomId: string, dayOfWeek: number) => boolean
}

interface RoleEntry {
  abbrev: string
  roleName: string
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateRange(dates: Date[]): string {
  if (dates.length === 0) return ''
  const first = dates[0]
  const last = dates[dates.length - 1]
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${first.toLocaleDateString('en-US', opts)} – ${last.toLocaleDateString('en-US', opts)}, ${last.getFullYear()}`
}

/** Build cell text content and collect unique roles for the key */
function buildCellContent(
  roomId: string,
  date: Date,
  assignmentMap: RoomDateAssignmentMap,
  isRoomClosedOnDay: (roomId: string, dayOfWeek: number) => boolean,
  roleMap: Map<string, RoleEntry>,
): { text: string; isClosed: boolean; surgeonCount: number } {
  if (isRoomClosedOnDay(roomId, date.getDay())) {
    return { text: 'CLOSED', isClosed: true, surgeonCount: 0 }
  }

  const key = roomDateKey(roomId, formatDateStr(date))
  const cellData = assignmentMap[key]

  if (!cellData || (cellData.surgeons.length === 0 && cellData.staff.length === 0)) {
    return { text: '—', isClosed: false, surgeonCount: 0 }
  }

  const surgeonLines: string[] = []
  const staffLines: string[] = []

  // Surgeons
  for (const a of cellData.surgeons) {
    surgeonLines.push(a.surgeon ? `Dr. ${a.surgeon.last_name}` : 'Unknown')
  }

  // Staff — "F. LastName (CODE)"
  for (const s of cellData.staff) {
    const displayName = s.user
      ? `${s.user.first_name?.[0] ?? ''}. ${s.user.last_name ?? 'Unknown'}`
      : 'Unknown'
    const roleName = s.role?.name ?? ''
    const style = getRoleStyle(roleName)

    staffLines.push(`${displayName} (${style.abbrev})`)

    if (!roleMap.has(style.abbrev)) {
      roleMap.set(style.abbrev, {
        abbrev: style.abbrev,
        roleName: roleName || 'Staff',
      })
    }
  }

  // Combine with blank separator line between surgeons and staff
  const lines: string[] = [...surgeonLines]
  if (surgeonLines.length > 0 && staffLines.length > 0) {
    lines.push('') // spacer
  }
  lines.push(...staffLines)

  return { text: lines.join('\n'), isClosed: false, surgeonCount: surgeonLines.length }
}

export function exportRoomSchedulePdf(data: RoomSchedulePdfData): void {
  const { facilityName, weekLabel, weekDates, rooms, assignmentMap, isRoomClosedOnDay } = data

  const roleMap = new Map<string, RoleEntry>()

  // Landscape A4
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // ── Header ──
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30)
  doc.text(facilityName || 'Room Schedule', 40, 38)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80)
  doc.text(`Week of ${weekLabel}  •  ${formatDateRange(weekDates)}`, 40, 54)

  doc.setFontSize(8)
  doc.setTextColor(140)
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
    pageWidth - 40,
    54,
    { align: 'right' },
  )

  doc.setTextColor(0)

  // ── Column widths — equal day columns ──
  const margins = 80
  const roomColWidth = 90
  const availableWidth = pageWidth - margins - roomColWidth
  const dayColWidth = availableWidth / weekDates.length

  // ── Column headers (B&W friendly — dark gray, not blue) ──
  const head = [
    [
      { content: 'Room', styles: { halign: 'center' as const, fontStyle: 'bold' as const, cellWidth: roomColWidth } },
      ...weekDates.map((date) => ({
        content: `${DAY_LABELS[date.getDay()]}\n${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        styles: { halign: 'center' as const, cellWidth: dayColWidth },
      })),
    ],
  ]

  // ── Body rows + track surgeon line counts per cell ──
  const cellSurgeonCounts = new Map<string, number>()

  const body = rooms.map((room, rowIdx) => {
    const roomCell: CellDef = {
      content: room.name,
      styles: {
        fontStyle: 'bold',
        fillColor: [245, 245, 245],
        halign: 'center',
        valign: 'middle',
        cellWidth: roomColWidth,
        fontSize: 9,
      },
    }

    const dayCells = weekDates.map((date, colIdx) => {
      const { text, isClosed, surgeonCount } = buildCellContent(room.id, date, assignmentMap, isRoomClosedOnDay, roleMap)
      cellSurgeonCounts.set(`${rowIdx}:${colIdx}`, surgeonCount)

      if (isClosed) {
        return {
          content: text,
          styles: {
            fontStyle: 'italic' as const,
            textColor: [150, 150, 150] as [number, number, number],
            fillColor: [240, 240, 240] as [number, number, number],
            halign: 'center' as const,
            valign: 'middle' as const,
            cellWidth: dayColWidth,
          },
        } satisfies CellDef
      }

      if (text === '—') {
        return {
          content: text,
          styles: {
            halign: 'center' as const,
            valign: 'middle' as const,
            textColor: [180, 180, 180] as [number, number, number],
            cellWidth: dayColWidth,
          },
        } satisfies CellDef
      }

      return {
        content: text,
        styles: {
          halign: 'left' as const,
          valign: 'top' as const,
          cellWidth: dayColWidth,
        },
      } satisfies CellDef
    })

    return [roomCell, ...dayCells]
  })

  // ── Render schedule table ──
  autoTable(doc, {
    startY: 66,
    head,
    body,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: { top: 6, right: 5, bottom: 6, left: 5 },
      lineColor: [200, 200, 200],
      lineWidth: 0.5,
      overflow: 'linebreak',
      valign: 'top',
      textColor: [40, 40, 40],
    },
    headStyles: {
      fillColor: [60, 60, 60],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 32,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    columnStyles: {
      0: { cellWidth: roomColWidth },
    },
    willDrawCell: (hookData: CellHookData) => {
      // For cells with surgeons: save text, then blank it so autotable doesn't draw it
      // We'll draw it manually in didDrawCell with mixed bold/normal
      if (hookData.section !== 'body') return
      if (hookData.column.index === 0) return
      const rowIdx = hookData.row.index
      const colIdx = hookData.column.index - 1
      const surgeonCount = cellSurgeonCounts.get(`${rowIdx}:${colIdx}`) ?? 0
      if (surgeonCount === 0) return

      // Stash original lines, then prevent autotable from rendering text
      const cell = hookData.cell as unknown as { _savedText?: string[] }
      cell._savedText = [...hookData.cell.text]
      hookData.cell.text = []
    },
    didDrawCell: (hookData: CellHookData) => {
      // Draw surgeon lines bold + staff lines normal for cells we intercepted
      if (hookData.section !== 'body') return
      if (hookData.column.index === 0) return

      const rowIdx = hookData.row.index
      const colIdx = hookData.column.index - 1
      const surgeonCount = cellSurgeonCounts.get(`${rowIdx}:${colIdx}`) ?? 0
      if (surgeonCount === 0) return

      const cell = hookData.cell as unknown as { _savedText?: string[] }
      const lines = cell._savedText
      if (!lines || lines.length === 0) return

      const padTop = hookData.cell.padding('top')
      const padLeft = hookData.cell.padding('left')
      const fontSize = hookData.cell.styles.fontSize
      const lineHeight = fontSize * 1.15

      const startX = hookData.cell.x + padLeft
      const startY = hookData.cell.y + padTop + fontSize * 0.85

      for (let i = 0; i < lines.length; i++) {
        if (lines[i] === '') continue // skip spacer line

        const isSurgeon = i < surgeonCount
        doc.setFont('helvetica', isSurgeon ? 'bold' : 'normal')
        doc.setFontSize(fontSize)
        doc.setTextColor(40, 40, 40)
        doc.text(lines[i], startX, startY + (i * lineHeight))
      }

      doc.setFont('helvetica', 'normal')
    },
    didDrawPage: (hookData) => {
      const pageHeight = doc.internal.pageSize.getHeight()
      const pageNum = hookData.pageNumber

      doc.setFontSize(7)
      doc.setTextColor(160)
      doc.text('ORbit Room Schedule', 40, pageHeight - 20)
      doc.text(`Page ${pageNum}`, pageWidth - 40, pageHeight - 20, { align: 'right' })
    },
  })

  // ── Role Key ──
  if (roleMap.size > 0) {
    const lastTable = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
    let roleKeyY = (lastTable?.finalY ?? 400) + 18

    const pageHeight = doc.internal.pageSize.getHeight()
    if (roleKeyY + 20 > pageHeight - 40) {
      doc.addPage()
      roleKeyY = 40
    }

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80)
    doc.text('Key:', 40, roleKeyY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(60)

    const roleEntries = Array.from(roleMap.values())
    const roleText = roleEntries.map(r => `${r.abbrev} = ${r.roleName}`).join('     ')
    doc.text(roleText, 64, roleKeyY)
  }

  // ── Download ──
  const dateStr = formatDateStr(weekDates[0] ?? new Date())
  doc.save(`room-schedule-${dateStr}.pdf`)
}
