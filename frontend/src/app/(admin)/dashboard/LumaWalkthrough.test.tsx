import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LumaWalkthrough from './LumaWalkthrough'

const PROPS = {
  eventTitle: 'Ai Salon: Work [SF]',
  regQuestions: ['Q1?', 'Q2?', 'LinkedIn URL'],
  chapterName: 'San Francisco',
  lumaTag: 'sf',
}

describe('LumaWalkthrough', () => {
  it('annotates the Luma create page with numbered pointers', () => {
    render(<LumaWalkthrough {...PROPS} />)
    expect(screen.getByRole('img', { name: /luma create event page/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pointer 7: turn on require approval/i })).toBeInTheDocument()
  })

  it('clicking a pointer highlights its checklist step', () => {
    render(<LumaWalkthrough {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /pointer 8: limit capacity/i }))
    expect(screen.getByTestId('luma-step-capacity')).toHaveAttribute('data-active', 'true')
  })

  it('opens the screenshot for a step that happens in a dialog or another tab', () => {
    render(<LumaWalkthrough {...PROPS} />)
    expect(screen.queryByRole('img', { name: /max capacity dialog/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show me how to limit capacity/i }))
    expect(screen.getByRole('img', { name: /max capacity dialog/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show me how to add the 3 registration questions/i }))
    expect(screen.getByRole('img', { name: /custom questions/i })).toBeInTheDocument()
  })

  it('tracks progress as steps are ticked', () => {
    render(<LumaWalkthrough {...PROPS} />)
    const total = screen.getAllByRole('checkbox').length
    expect(screen.getByText(`0 of ${total} done`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /set visibility to private/i }))
    expect(screen.getByText(`1 of ${total} done`)).toBeInTheDocument()
  })

  it('includes the chapter tag step only when the chapter has one', () => {
    const { rerender } = render(<LumaWalkthrough {...PROPS} />)
    expect(screen.getByText(/tag it .sf./i)).toBeInTheDocument()
    rerender(<LumaWalkthrough {...PROPS} lumaTag="" />)
    expect(screen.queryByText(/tag it/i)).not.toBeInTheDocument()
  })
})
