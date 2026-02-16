// components/cases/__tests__/TeamMember.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeamMember from '../TeamMember'

describe('TeamMember', () => {
  describe('Initials Extraction', () => {
    it('extracts first and last initials from full name', () => {
      render(<TeamMember name="John Smith" role="RN" />)
      expect(screen.getByText('JS')).toBeInTheDocument()
    })

    it('extracts first initial from single name', () => {
      render(<TeamMember name="Madonna" role="RN" />)
      expect(screen.getByText('M')).toBeInTheDocument()
    })

    it('removes "Dr." prefix from name before extracting initials', () => {
      render(<TeamMember name="Dr. Sarah Johnson" role="Surgeon" />)
      expect(screen.getByText('SJ')).toBeInTheDocument()
    })

    it('removes "Dr." prefix (case insensitive)', () => {
      render(<TeamMember name="dr. Emily Chen" role="Surgeon" />)
      expect(screen.getByText('EC')).toBeInTheDocument()
    })

    it('handles three-part names by using first and last', () => {
      render(<TeamMember name="Mary Jane Watson" role="RN" />)
      expect(screen.getByText('MW')).toBeInTheDocument()
    })

    it('handles four-part names by using first and last', () => {
      render(<TeamMember name="Jean Paul Marie Dubois" role="Surgeon" />)
      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('uppercases initials', () => {
      render(<TeamMember name="john doe" role="RN" />)
      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('handles empty name with fallback', () => {
      render(<TeamMember name="" role="RN" />)
      expect(screen.getByText('?')).toBeInTheDocument()
    })

    it('handles whitespace-only name with fallback', () => {
      render(<TeamMember name="   " role="RN" />)
      expect(screen.getByText('?')).toBeInTheDocument()
    })

    it('handles extra spaces between names', () => {
      render(<TeamMember name="Alice   Bob" role="RN" />)
      expect(screen.getByText('AB')).toBeInTheDocument()
    })
  })

  describe('Display', () => {
    it('renders name', () => {
      render(<TeamMember name="Alice Johnson" role="RN" />)
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    })

    it('renders role', () => {
      render(<TeamMember name="Bob Smith" role="Surgeon" />)
      expect(screen.getByText('Surgeon')).toBeInTheDocument()
    })

    it('applies colored background to avatar based on role', () => {
      const { container } = render(<TeamMember name="Charlie Brown" role="Surgeon" />)
      const avatar = screen.getByText('CB')
      // getRoleColors('Surgeon') returns bg-blue-50 text-blue-700 (from design-tokens)
      expect(avatar).toHaveClass('bg-blue-50')
      expect(avatar).toHaveClass('text-blue-700')
    })

    it('uses roleName if provided for color lookup', () => {
      const { container } = render(<TeamMember name="Dana White" role="RN" roleName="Registered Nurse" />)
      const avatar = screen.getByText('DW')
      // roleName overrides role for getRoleColors lookup
      expect(avatar.className).toContain('bg-')
      expect(avatar.className).toContain('text-')
    })

    it('renders remove button when onRemove is provided', () => {
      const handleRemove = vi.fn()
      render(<TeamMember name="Eve Davis" role="RN" onRemove={handleRemove} />)
      const removeButton = screen.getByRole('button')
      expect(removeButton).toBeInTheDocument()
    })

    it('does not render remove button when onRemove is not provided', () => {
      render(<TeamMember name="Frank Wilson" role="RN" />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('calls onRemove when remove button is clicked', async () => {
      const user = userEvent.setup()
      const handleRemove = vi.fn()
      render(<TeamMember name="Grace Lee" role="RN" onRemove={handleRemove} />)

      const removeButton = screen.getByRole('button')
      await user.click(removeButton)

      expect(handleRemove).toHaveBeenCalledOnce()
    })
  })

  describe('Avatar Sizing and Styling', () => {
    it('applies correct size classes to avatar', () => {
      render(<TeamMember name="Hank Green" role="RN" />)
      const avatar = screen.getByText('HG')
      expect(avatar).toHaveClass('w-7')
      expect(avatar).toHaveClass('h-7')
      expect(avatar).toHaveClass('rounded-full')
    })

    it('applies font styling to initials', () => {
      render(<TeamMember name="Iris Chen" role="RN" />)
      const avatar = screen.getByText('IC')
      expect(avatar).toHaveClass('text-[11px]')
      expect(avatar).toHaveClass('font-bold')
    })
  })

  describe('Edge Cases', () => {
    it('handles name with leading and trailing whitespace', () => {
      render(<TeamMember name="  Jack Black  " role="RN" />)
      expect(screen.getByText('JB')).toBeInTheDocument()
    })

    it('handles role displayed alongside colored initials', () => {
      render(<TeamMember name="Kate Miller" role="Anesthesiologist" />)
      const role = screen.getByText('Anesthesiologist')
      expect(role).toHaveClass('text-xs')
      expect(role).toHaveClass('font-semibold')
    })

    it('truncates long name with CSS', () => {
      const { container } = render(
        <TeamMember name="Leonardo Wilhelm DiCaprio Anderson" role="RN" />
      )
      const nameElement = screen.getByText('Leonardo Wilhelm DiCaprio Anderson')
      expect(nameElement).toHaveClass('truncate')
    })
  })
})
