'use client'

import Link from 'next/link'
import OnboardingBanner, { type OnboardingStep } from '@/components/OnboardingBanner'
import GuideNudge from '@/components/GuideNudge'

const HOST_STEPS: OnboardingStep[] = [
  {
    title: 'Add your API keys',
    description: 'You need AssemblyAI and Google AI keys to process conversations.',
    ctaLabel: 'Go to Settings',
    ctaHref: '/settings',
  },
  {
    title: 'Upload your first conversation',
    description: 'Record or import an audio file from your last Ai Salon event.',
    ctaLabel: 'Upload now',
    ctaHref: '/upload',
  },
  {
    title: 'Review your generated article',
    description: 'Your conversation has been transcribed and turned into a draft article. Give it a read.',
    ctaLabel: 'View articles',
    ctaHref: '/articles',
  },
]

interface Job {
  id: string
  input_filename: string
  status: string
  created_at: string
}

interface HostDashboardProps {
  userName: string
  chapterName?: string
  completedSteps: [boolean, boolean, boolean]
  recentJobs: Job[]
}

export default function HostDashboard({
  userName,
  chapterName,
  completedSteps,
  recentJobs,
}: HostDashboardProps) {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 28px' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 22, fontWeight: 400, color: '#111', margin: '0 0 4px' }}>
          Welcome, {userName}
        </p>
        <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>
          Let&apos;s get you set up!
        </p>
        {chapterName && (
          <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0' }}>{chapterName}</p>
        )}
      </div>

      <OnboardingBanner steps={HOST_STEPS} completedSteps={completedSteps} />
      {completedSteps.every(Boolean) && <GuideNudge />}

      {/* Upload CTA */}
      <div
        style={{
          background: '#fff',
          border: '1.5px solid #56a1d2',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>
            Upload a conversation
          </div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Turn your last event recording into a published article.
          </div>
        </div>
        <Link
          href="/upload"
          style={{
            padding: '9px 20px',
            background: '#56a1d2',
            color: '#fff',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Upload a conversation
        </Link>
      </div>

      {/* Recent jobs */}
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          border: '1px solid #ede9d8',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #f0ebe0',
            fontSize: 14,
            fontWeight: 700,
            color: '#111',
          }}
        >
          Recent Processing
        </div>
        {recentJobs.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af' }}>
            <i className="fa fa-inbox" style={{ fontSize: 28, display: 'block', marginBottom: 10 }} aria-hidden="true" />
            <p style={{ fontSize: 13, margin: 0 }}>
              No conversations uploaded yet. Select an audio file above to get started — transcription takes ~5 minutes.
            </p>
          </div>
        ) : (
          <div>
            {recentJobs.slice(0, 3).map((job) => (
              <div
                key={job.id}
                style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid #f8f6ec',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{job.input_filename}</div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: '#f3f4f6',
                    color: '#6b7280',
                    textTransform: 'capitalize',
                  }}
                >
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
