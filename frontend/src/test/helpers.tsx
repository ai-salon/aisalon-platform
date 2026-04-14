import { render, type RenderOptions } from '@testing-library/react'
import { type ReactElement } from 'react'
import { vi } from 'vitest'
import { useSession } from 'next-auth/react'

export interface SessionOptions {
  role?: 'superadmin' | 'chapter_lead' | 'host'
  chapterId?: string
  chapterName?: string
  name?: string
  email?: string
}

export function renderWithSession(
  ui: ReactElement,
  sessionOptions: SessionOptions = {},
  renderOptions?: Omit<RenderOptions, 'wrapper'>
) {
  const {
    role = 'chapter_lead',
    chapterId,
    chapterName,
    name = 'Test User',
    email = 'test@example.com',
  } = sessionOptions

  vi.mocked(useSession).mockReturnValue({
    data: {
      user: { name, email, role, chapterId, chapterName } as any,
      accessToken: 'test-token',
      expires: '2099-01-01',
    },
    status: 'authenticated',
    update: vi.fn(),
  } as any)

  return render(ui, renderOptions)
}
