'use client'

import Link from 'next/link'
import { useState } from 'react'

const DISMISSED_KEY = 'guide-nudge-dismissed'

export default function GuideNudge() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISSED_KEY) === 'true'
  })

  if (dismissed) return null

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #ede9d8',
        borderRadius: 8,
        padding: '14px 18px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>📚</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Hosting Guide</div>
          <div style={{ fontSize: 12, color: '#696969', marginTop: 1 }}>
            Checklists, event templates, facilitation tips, and more.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <Link
          href="/guide"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#56a1d2',
            textDecoration: 'none',
          }}
        >
          Open guide →
        </Link>
        <button
          onClick={() => {
            localStorage.setItem(DISMISSED_KEY, 'true')
            setDismissed(true)
          }}
          title="Dismiss"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#9ca3af',
            fontSize: 16,
            lineHeight: 1,
            padding: '2px 4px',
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
