import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import LumaWalkthrough from './LumaWalkthrough'

const PROPS = {
  eventTitle: 'Ai Salon: Work [SF]',
  eventDescription: 'Join us for an intimate Ai Salon conversation on "Work".',
  regQuestions: ['Q1?', 'Q2?', 'LinkedIn URL'],
}

const CREATE_PAGE_STEPS = [
  /add the event title/i,
  /set the date & time/i,
  /add the location/i,
  /fill out the description/i,
  /turn on require approval/i,
  /limit capacity/i,
  /confirm it says/i,
  /change visibility to private/i,
  /click create event/i,
]

function step(id: string) {
  return within(screen.getByTestId(`luma-step-${id}`))
}

describe('LumaWalkthrough', () => {
  it('annotates the Luma create page with numbered pointers', () => {
    render(<LumaWalkthrough {...PROPS} />)
    expect(screen.getByRole('img', { name: /luma create event page/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pointer 5: turn on require approval/i })).toBeInTheDocument()
  })

  it('clicking a pointer highlights its checklist step', () => {
    render(<LumaWalkthrough {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /pointer 6: limit capacity/i }))
    expect(screen.getByTestId('luma-step-capacity')).toHaveAttribute('data-active', 'true')
  })

  it('puts the copy-ready template inside the step that uses it', () => {
    render(<LumaWalkthrough {...PROPS} />)
    expect(step('name').getByText('Ai Salon: Work [SF]')).toBeInTheDocument()
    expect(step('description').getByText(/start by pasting the template/i)).toBeInTheDocument()
    expect(step('description').getByText(/intimate ai salon conversation/i)).toBeInTheDocument()
    expect(step('description').getByRole('button', { name: /copy/i })).toBeInTheDocument()
    expect(step('questions').getAllByRole('button', { name: /copy/i })).toHaveLength(3)
    expect(step('cohost').getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })

  it('shows after-create screenshots inline; the capacity dialog is opt-in', () => {
    render(<LumaWalkthrough {...PROPS} />)
    expect(screen.getByRole('img', { name: /custom questions/i })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /max capacity dialog/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show me how to limit capacity/i }))
    expect(screen.getByRole('img', { name: /max capacity dialog/i })).toBeInTheDocument()
  })

  it('collapses the create-page instructions once every item is checked, and can reopen them', () => {
    render(<LumaWalkthrough {...PROPS} />)
    const header = screen.getByRole('button', { name: /on the create event page/i })
    expect(header).toHaveAttribute('aria-expanded', 'true')

    for (const name of CREATE_PAGE_STEPS) {
      fireEvent.click(screen.getByRole('checkbox', { name }))
    }

    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('img', { name: /luma create event page/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /after you click create event/i })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(header)
    expect(screen.getByRole('img', { name: /luma create event page/i })).toBeInTheDocument()
  })

  it('lets you collapse a section by hand', () => {
    render(<LumaWalkthrough {...PROPS} />)
    const after = screen.getByRole('button', { name: /after you click create event/i })
    fireEvent.click(after)
    expect(after).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('luma-step-cohost')).not.toBeInTheDocument()
  })

  it('tracks progress as steps are ticked', () => {
    render(<LumaWalkthrough {...PROPS} />)
    const total = screen.getAllByRole('checkbox').length
    expect(screen.getByText(`0 of ${total} done`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /change visibility to private/i }))
    expect(screen.getByText(`1 of ${total} done`)).toBeInTheDocument()
  })

  it('tells hosts to add contact@aisalon.xyz as a Manager', () => {
    render(<LumaWalkthrough {...PROPS} />)
    expect(step('cohost').getByText('Manager')).toBeInTheDocument()
  })

  it('puts the Ai Salon submission and the optional private step last, just before Create Event', () => {
    render(<LumaWalkthrough {...PROPS} />)
    const ids = screen
      .getAllByTestId(/^luma-step-/)
      .map((el) => el.getAttribute('data-testid'))
      .slice(0, 9)
    expect(ids.slice(-3)).toEqual(['luma-step-calendar', 'luma-step-visibility', 'luma-step-create'])
    expect(step('calendar').getByText(/submitting to the ai salon/i)).toBeInTheDocument()
  })

  it('explains that private events cannot be submitted, so the request must be removed', () => {
    render(<LumaWalkthrough {...PROPS} />)
    expect(step('visibility').getByText(/optional/i)).toBeInTheDocument()
    expect(step('visibility').getByText(/doesn.t allow private events to be submitted/i)).toBeInTheDocument()
    expect(step('visibility').getByText(/remove the request/i)).toBeInTheDocument()
  })

  it('after creation, tells private-event hosts how to go public and add it to the Ai Salon calendar', () => {
    render(<LumaWalkthrough {...PROPS} />)
    expect(step('public').getByText(/add existing luma event/i)).toBeInTheDocument()
    expect(step('public').getByRole('link', { name: /luma\.com\/ai-salon/i })).toHaveAttribute(
      'href',
      'https://luma.com/ai-salon'
    )
    expect(screen.getByRole('img', { name: /add event menu/i })).toBeInTheDocument()
  })

  it('has no tagging step (hosts cannot tag on the Ai Salon calendar)', () => {
    render(<LumaWalkthrough {...PROPS} />)
    expect(screen.queryByText(/tag it/i)).not.toBeInTheDocument()
  })
})
