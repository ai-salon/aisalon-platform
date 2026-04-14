'use client'

import Link from 'next/link'

interface Chapter {
  id: string
  name: string
  code: string
  articleCount: number
  teamCount: number
  is_active: boolean
}

interface SuperadminDashboardProps {
  userName: string
  platformStats: { totalChapters: number; totalUsers: number; recentJobs: number }
  chapters: Chapter[]
}

export default function SuperadminDashboard({
  userName,
  platformStats,
  chapters,
}: SuperadminDashboardProps) {
  const statCards = [
    { label: 'Total Chapters', value: platformStats.totalChapters, icon: 'fa-map-marker', color: '#56a1d2' },
    { label: 'Total Users', value: platformStats.totalUsers, icon: 'fa-users', color: '#d2b356' },
    { label: 'Jobs (last 7 days)', value: platformStats.recentJobs, icon: 'fa-cog', color: '#6b7280' },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 28px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111', marginBottom: 24 }}>
        Welcome, {userName}
      </h1>

      {/* Platform health */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {statCards.map(({ label, value, icon, color }) => (
          <div
            key={label}
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: '20px 24px',
              border: '1px solid #ede9d8',
            }}
          >
            <i
              className={`fa ${icon}`}
              style={{ fontSize: 20, color, marginBottom: 8, display: 'block' }}
              aria-hidden="true"
            />
            <div style={{ fontSize: 32, fontWeight: 800, color: '#111' }}>{value}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Chapters list */}
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
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Chapters</span>
          <Link
            href="/chapters"
            style={{ fontSize: 12, color: '#56a1d2', fontWeight: 600, textDecoration: 'none' }}
          >
            Manage →
          </Link>
        </div>
        {chapters.map((ch) => (
          <Link key={ch.id} href={`/chapters/edit/${ch.code}`} style={{ textDecoration: 'none' }}>
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #f8f6ec',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{ch.name}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: '#d2b356',
                    fontWeight: 700,
                    marginLeft: 8,
                    textTransform: 'uppercase',
                  }}
                >
                  {ch.code}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280' }}>
                <span>{ch.articleCount} articles</span>
                <span>{ch.teamCount} members</span>
                <span style={{ color: ch.is_active ? '#16a34a' : '#9ca3af', fontWeight: 600 }}>
                  {ch.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
