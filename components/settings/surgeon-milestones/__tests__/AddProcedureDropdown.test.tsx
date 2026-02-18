// components/settings/surgeon-milestones/__tests__/AddProcedureDropdown.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AddProcedureDropdown } from '../AddProcedureDropdown'

const allProcedures = [
  { id: 'p1', name: 'Total Knee' },
  { id: 'p2', name: 'Total Hip' },
  { id: 'p3', name: 'Rotator Cuff' },
  { id: 'p4', name: 'ACL Reconstruction' },
]

describe('AddProcedureDropdown', () => {
  it('renders the add button', () => {
    render(
      <AddProcedureDropdown
        onAdd={vi.fn()}
        existingProcIds={[]}
        allProcedures={allProcedures}
      />
    )
    expect(screen.getByText('Add Procedure Override')).toBeDefined()
  })

  it('opens dropdown on button click', () => {
    render(
      <AddProcedureDropdown
        onAdd={vi.fn()}
        existingProcIds={[]}
        allProcedures={allProcedures}
      />
    )
    fireEvent.click(screen.getByText('Add Procedure Override'))
    expect(screen.getByPlaceholderText('Search procedures...')).toBeDefined()
  })

  it('shows all available procedures when no existing overrides', () => {
    render(
      <AddProcedureDropdown
        onAdd={vi.fn()}
        existingProcIds={[]}
        allProcedures={allProcedures}
      />
    )
    fireEvent.click(screen.getByText('Add Procedure Override'))
    expect(screen.getByText('Total Knee')).toBeDefined()
    expect(screen.getByText('Total Hip')).toBeDefined()
    expect(screen.getByText('Rotator Cuff')).toBeDefined()
    expect(screen.getByText('ACL Reconstruction')).toBeDefined()
  })

  it('filters out already-added procedures', () => {
    render(
      <AddProcedureDropdown
        onAdd={vi.fn()}
        existingProcIds={['p1', 'p3']}
        allProcedures={allProcedures}
      />
    )
    fireEvent.click(screen.getByText('Add Procedure Override'))
    expect(screen.queryByText('Total Knee')).toBeNull()
    expect(screen.getByText('Total Hip')).toBeDefined()
    expect(screen.queryByText('Rotator Cuff')).toBeNull()
    expect(screen.getByText('ACL Reconstruction')).toBeDefined()
  })

  it('filters by search text', () => {
    render(
      <AddProcedureDropdown
        onAdd={vi.fn()}
        existingProcIds={[]}
        allProcedures={allProcedures}
      />
    )
    fireEvent.click(screen.getByText('Add Procedure Override'))
    fireEvent.change(screen.getByPlaceholderText('Search procedures...'), {
      target: { value: 'hip' },
    })
    expect(screen.queryByText('Total Knee')).toBeNull()
    expect(screen.getByText('Total Hip')).toBeDefined()
    expect(screen.queryByText('Rotator Cuff')).toBeNull()
  })

  it('shows "No match" when search has no results', () => {
    render(
      <AddProcedureDropdown
        onAdd={vi.fn()}
        existingProcIds={[]}
        allProcedures={allProcedures}
      />
    )
    fireEvent.click(screen.getByText('Add Procedure Override'))
    fireEvent.change(screen.getByPlaceholderText('Search procedures...'), {
      target: { value: 'zzzzz' },
    })
    expect(screen.getByText('No match')).toBeDefined()
  })

  it('shows "All procedures added" when all are existing', () => {
    render(
      <AddProcedureDropdown
        onAdd={vi.fn()}
        existingProcIds={['p1', 'p2', 'p3', 'p4']}
        allProcedures={allProcedures}
      />
    )
    fireEvent.click(screen.getByText('Add Procedure Override'))
    expect(screen.getByText('All procedures added')).toBeDefined()
  })

  it('calls onAdd with procedure id when item is clicked', () => {
    const onAdd = vi.fn()
    render(
      <AddProcedureDropdown
        onAdd={onAdd}
        existingProcIds={[]}
        allProcedures={allProcedures}
      />
    )
    fireEvent.click(screen.getByText('Add Procedure Override'))
    fireEvent.click(screen.getByText('Total Hip'))
    expect(onAdd).toHaveBeenCalledWith('p2')
  })

  it('closes dropdown after selecting a procedure', () => {
    render(
      <AddProcedureDropdown
        onAdd={vi.fn()}
        existingProcIds={[]}
        allProcedures={allProcedures}
      />
    )
    fireEvent.click(screen.getByText('Add Procedure Override'))
    expect(screen.getByPlaceholderText('Search procedures...')).toBeDefined()
    fireEvent.click(screen.getByText('Total Knee'))
    expect(screen.queryByPlaceholderText('Search procedures...')).toBeNull()
  })

  it('clears search after selecting a procedure', () => {
    render(
      <AddProcedureDropdown
        onAdd={vi.fn()}
        existingProcIds={[]}
        allProcedures={allProcedures}
      />
    )
    fireEvent.click(screen.getByText('Add Procedure Override'))
    fireEvent.change(screen.getByPlaceholderText('Search procedures...'), {
      target: { value: 'knee' },
    })
    fireEvent.click(screen.getByText('Total Knee'))
    // Re-open and verify search is cleared
    fireEvent.click(screen.getByText('Add Procedure Override'))
    expect(
      (screen.getByPlaceholderText('Search procedures...') as HTMLInputElement)
        .value
    ).toBe('')
  })

  it('closes dropdown on outside click', () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <AddProcedureDropdown
          onAdd={vi.fn()}
          existingProcIds={[]}
          allProcedures={allProcedures}
        />
      </div>
    )
    fireEvent.click(screen.getByText('Add Procedure Override'))
    expect(screen.getByPlaceholderText('Search procedures...')).toBeDefined()
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByPlaceholderText('Search procedures...')).toBeNull()
  })

  it('toggles dropdown open and closed', () => {
    render(
      <AddProcedureDropdown
        onAdd={vi.fn()}
        existingProcIds={[]}
        allProcedures={allProcedures}
      />
    )
    // Open
    fireEvent.click(screen.getByText('Add Procedure Override'))
    expect(screen.getByPlaceholderText('Search procedures...')).toBeDefined()
    // Close
    fireEvent.click(screen.getByText('Add Procedure Override'))
    expect(screen.queryByPlaceholderText('Search procedures...')).toBeNull()
  })
})
