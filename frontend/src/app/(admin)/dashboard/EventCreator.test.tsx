import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import EventCreator from './EventCreator'

function next() {
  fireEvent.click(screen.getByRole('button', { name: /^next/i }))
}

describe('EventCreator stepper', () => {
  it('shows one step at a time, starting with event details', () => {
    render(<EventCreator chapterName="Bangalore" chapterCode="bangalore" />)
    expect(screen.getByRole('textbox', { name: /theme/i })).toBeInTheDocument()
    expect(screen.queryByText(/event description/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/require approval/i)).not.toBeInTheDocument()
  })

  it('needs a theme before moving on', () => {
    render(<EventCreator chapterName="Bangalore" chapterCode="bangalore" />)
    expect(screen.getByRole('button', { name: /^next/i })).toBeDisabled()
  })

  it('walks details → templates → Luma → promote and back', () => {
    render(<EventCreator chapterName="Bangalore" chapterCode="bangalore" />)
    fireEvent.change(screen.getByRole('textbox', { name: /theme/i }), { target: { value: 'AI & Love' } })
    next()

    expect(screen.getByText('Ai Salon: AI & Love [BANGALORE]')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /theme/i })).not.toBeInTheDocument()
    next()

    expect(screen.getByRole('link', { name: /open luma/i })).toHaveAttribute(
      'href',
      expect.stringContaining('luma.com/create')
    )
    expect(screen.getByText(/turn on require approval/i)).toBeInTheDocument()
    next()

    expect(screen.getByText(/where to promote/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByText(/turn on require approval/i)).toBeInTheDocument()
  })

  it('lets you jump back to an earlier step from the progress bar', () => {
    render(<EventCreator chapterName="Bangalore" chapterCode="bangalore" />)
    fireEvent.change(screen.getByRole('textbox', { name: /theme/i }), { target: { value: 'Work' } })
    next()
    next()
    const progress = screen.getByRole('navigation', { name: /event setup steps/i })
    fireEvent.click(within(progress).getByRole('button', { name: /details/i }))
    expect(screen.getByRole('textbox', { name: /theme/i })).toHaveValue('Work')
  })
})
