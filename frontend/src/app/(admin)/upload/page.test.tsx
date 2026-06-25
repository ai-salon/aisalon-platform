import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import UploadPage from './page'

// Grab the drag-and-drop zone (the div carrying the drop handlers). The visible
// prompt text lives in a <p> whose nearest ancestor div is the dropzone itself.
function getDropzone() {
  return screen.getByText(/click to select audio file/i).closest('div') as HTMLElement
}

describe('UploadPage — drag and drop', () => {
  beforeEach(() => {
    // Unauthenticated session still renders the form; with no token, no network
    // calls fire, so the dropzone can be tested in isolation.
    vi.mocked(useSession).mockReturnValue({ data: null, status: 'unauthenticated' } as never)
  })

  it('shows a drag-and-drop hint in the dropzone', () => {
    render(<UploadPage />)
    expect(screen.getByText(/drag and drop or click to select audio file/i)).toBeInTheDocument()
  })

  it('highlights the dropzone while a file is dragged over it', () => {
    render(<UploadPage />)
    fireEvent.dragOver(getDropzone())
    expect(screen.getByText(/drop audio file to upload/i)).toBeInTheDocument()
  })

  it('clears the drag highlight on drag leave', () => {
    render(<UploadPage />)
    const zone = getDropzone()
    fireEvent.dragOver(zone)
    expect(screen.getByText(/drop audio file to upload/i)).toBeInTheDocument()
    fireEvent.dragLeave(zone)
    expect(screen.queryByText(/drop audio file to upload/i)).not.toBeInTheDocument()
  })

  it('accepts a dropped audio file and shows its name', () => {
    render(<UploadPage />)
    const file = new File(['fake-audio'], 'Recording (3).m4a', { type: 'audio/x-m4a' })
    fireEvent.drop(getDropzone(), { dataTransfer: { files: [file], types: ['Files'] } })
    expect(screen.getByText('Recording (3).m4a')).toBeInTheDocument()
  })

  it('accepts an audio file by extension even when the browser reports no MIME type', () => {
    render(<UploadPage />)
    const file = new File(['fake-audio'], 'meetup.wav', { type: '' })
    fireEvent.drop(getDropzone(), { dataTransfer: { files: [file], types: ['Files'] } })
    expect(screen.getByText('meetup.wav')).toBeInTheDocument()
  })

  it('rejects a non-audio drop with an error and does not select the file', () => {
    render(<UploadPage />)
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    fireEvent.drop(getDropzone(), { dataTransfer: { files: [file], types: ['Files'] } })
    expect(screen.getByText(/please choose an audio file/i)).toBeInTheDocument()
    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument()
  })
})
