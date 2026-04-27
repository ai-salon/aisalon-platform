'use client'

import Link from 'next/link'
import OnboardingBanner, { type OnboardingStep } from '@/components/OnboardingBanner'
import GuideNudge from '@/components/GuideNudge'

const CHAPTER_LEAD_STEPS: OnboardingStep[] = [
  {
    title: 'Add your API keys',
    description: 'You need AssemblyAI and Google AI keys to process conversations.',
    ctaLabel: 'Go to Settings',
    ctaHref: '/settings',
  },
  {
    title: 'Upload your first conversation',
    description: 'Record or import audio from your last event.',
    ctaLabel: 'Upload now',
    ctaHref: '/upload',
  },
  {
    title: 'Complete your chapter profile',
    description: 'Add a tagline and description so members can find you.',
    ctaLabel: 'Edit profile',
    ctaHref: '/chapters',
  },
  {
    title: 'Add your team',
    description: 'Add co-founders and team members to your chapter page.',
    ctaLabel: 'Manage team',
    ctaHref: '/people',
  },
]

interface Article {
  id: string
  title: string
  status: string
  created_at: string
}

interface ChapterLeadDashboardProps {
  userName: string
  chapterName?: string
  completedSteps: [boolean, boolean, boolean, boolean]
  stats: { articlesPublished: number; articlesDraft: number; teamCount: number }
  recentArticles: Article[]
}

export default function ChapterLeadDashboard({
  userName,
  chapterName,
  completedSteps,
  stats,
  recentArticles,
}: ChapterLeadDashboardProps) {
  const statCards = [
    { label: 'Published', value: stats.articlesPublished, color: '#16a34a' },
    { label: 'Drafts', value: stats.articlesDraft, color: '#6b7280' },
    { label: 'Team Members', value: stats.teamCount, color: '#56a1d2' },
  ]

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 28px' }}>
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

      <OnboardingBanner steps={CHAPTER_LEAD_STEPS} completedSteps={completedSteps} />
      {completedSteps.every(Boolean) && <GuideNudge />}

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {statCards.map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: '20px 24px',
              border: '1px solid #ede9d8',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Recent articles */}
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          border: '1px solid #ede9d8',
          overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #f0ebe0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Recent Articles</span>
          <Link
            href="/articles"
            style={{ fontSize: 12, color: '#56a1d2', fontWeight: 600, textDecoration: 'none' }}
          >
            View all →
          </Link>
        </div>
        {recentArticles.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af' }}>
            <p style={{ fontSize: 13, margin: 0 }}>
              No articles yet.{' '}
              <Link href="/upload" style={{ color: '#56a1d2', fontWeight: 600 }}>
                Upload a conversation →
              </Link>{' '}
              to generate your first one.
            </p>
          </div>
        ) : (
          <div>
            {recentArticles.slice(0, 3).map((article) => (
              <Link
                key={article.id}
                href={`/articles/${article.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    padding: '12px 20px',
                    borderBottom: '1px solid #f8f6ec',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{article.title}</div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: article.status === 'published' ? '#dcfce7' : '#f3f4f6',
                      color: article.status === 'published' ? '#16a34a' : '#6b7280',
                      textTransform: 'capitalize',
                    }}
                  >
                    {article.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upload CTA */}
      <Link
        href="/upload"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px 24px',
          background: '#56a1d2',
          color: '#fff',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          textDecoration: 'none',
          gap: 8,
        }}
      >
        <i className="fa fa-upload" aria-hidden="true" /> Upload a conversation
      </Link>
    </div>
  )
}
