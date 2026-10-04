import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent, within } from '@testing-library/react'
import { renderWithSession } from '@/test/helpers'
import WelcomeDashboard from './WelcomeDashboard'

const chapter = { id: 'c1', code: 'sf', name: 'San Francisco' }

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderHost(extra: Record<string, unknown> = {}) {
  stubFetch()
  return renderWithSession(
    <WelcomeDashboard
      userName="Sam Host"
      userEmail="sam@x.co"
      userRole="host"
      userChapter={chapter}
      allChapters={[chapter]}
      chapterLeads={[{ id: 'l1', name: 'Priya Raman', scheduling_url: 'https://cal.com/priya' }]}
      {...extra}
    />,
    { role: 'host', chapterId: 'c1' }
  )
}

describe('WelcomeDashboard — host onboarding', () => {
  it('centres Getting Started on hosting your first event', () => {
    renderHost()
    expect(screen.getByRole('heading', { name: /your first salon/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /create your event/i }))
    expect(screen.getByRole('textbox', { name: /theme/i })).toBeInTheDocument()
  })

  it('Hosting Guide checklist routes support through the chapter lead', () => {
    renderHost()
    fireEvent.click(screen.getByRole('button', { name: /^🏡 hosting guide$/i }))

    const checklist = within(screen.getByText(/one-time onboarding for new hosts/i).parentElement!)
    expect(checklist.queryByText(/hosting interest form/i)).not.toBeInTheDocument()
    expect(checklist.queryByText(/whatsapp/i)).not.toBeInTheDocument()
    expect(checklist.queryByText(/ian/i)).not.toBeInTheDocument()

    const oneOnOne = screen.getByRole('checkbox', { name: /schedule a 1:1 with your chapter lead/i })
    expect(oneOnOne.closest('label')).toHaveTextContent('Priya Raman')
    expect(screen.getByRole('checkbox', { name: /ask your chapter lead for support on your first event/i })).toBeInTheDocument()
  })

  it('"Host your first event" jumps to Create Event', () => {
    renderHost()
    fireEvent.click(screen.getByRole('button', { name: /^🏡 hosting guide$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^create event →$/i }))
    expect(screen.getByRole('textbox', { name: /theme/i })).toBeInTheDocument()
  })

  it('shows saved checks as ticked', () => {
    renderHost({ onboardingChecks: { 'host-website': true } })
    fireEvent.click(screen.getByRole('button', { name: /^🏡 hosting guide$/i }))
    expect(screen.getByRole('checkbox', { name: /read the ai salon website/i })).toBeChecked()
  })
})

describe('WelcomeDashboard — no real chapter lead', () => {
  it('points the 1:1 and first-event support at Ian', () => {
    renderHost({ chapterLeads: [] })
    fireEvent.click(screen.getByRole('button', { name: /^🏡 hosting guide$/i }))
    const oneOnOne = screen.getByRole('checkbox', { name: /schedule a 1:1 with ian eisenberg/i })
    expect(oneOnOne.closest('div')!.querySelector('a')).toHaveAttribute(
      'href',
      'https://cal.com/ianeisenberg/ai-salon-coordination'
    )
    expect(screen.getByRole('checkbox', { name: /ask ian for support on your first event/i })).toBeInTheDocument()
  })
})

describe('WelcomeDashboard — chapter lead tabs', () => {
  it('calls the editable chapter page the Chapter Hub', () => {
    stubFetch()
    renderWithSession(
      <WelcomeDashboard
        userName="Lee Lead"
        userEmail="lee@x.co"
        userRole="chapter_lead"
        userChapter={chapter}
        allChapters={[chapter]}
      />,
      { role: 'chapter_lead', chapterId: 'c1' }
    )
    expect(screen.getByRole('button', { name: /chapter hub/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^📖 chapter guide$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /chapter lead guide/i })).toBeInTheDocument()
  })
})
