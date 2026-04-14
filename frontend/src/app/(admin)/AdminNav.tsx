'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: string
}

interface AdminNavProps {
  navItems: NavItem[]
  userRole: string
  chapterName?: string
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'ADMIN',
  chapter_lead: 'CHAPTER LEAD',
  host: 'HOST',
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  superadmin: { bg: '#fdf8ee', color: '#a07a20' },
  chapter_lead: { bg: '#eef6fd', color: '#2d7ab0' },
  host: { bg: '#f0fdf4', color: '#166534' },
}

export default function AdminNav({ navItems, userRole, chapterName }: AdminNavProps) {
  const pathname = usePathname()
  const roleLabel = ROLE_LABELS[userRole] ?? userRole.toUpperCase()
  const roleColor = ROLE_COLORS[userRole] ?? { bg: '#f3f4f6', color: '#4b5563' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Role / chapter badge */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ background: roleColor.bg, borderRadius: 6, padding: '8px 10px' }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: roleColor.color,
              letterSpacing: '0.08em',
            }}
          >
            {roleLabel}
          </div>
          {chapterName && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{chapterName}</div>
          )}
          {!chapterName && userRole === 'superadmin' && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>All Chapters</div>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '0 16px',
          flex: 1,
        }}
      >
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#fff' : '#444',
                background: isActive ? '#56a1d2' : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
            >
              <i
                className={`fa ${icon}`}
                style={{
                  width: 16,
                  textAlign: 'center',
                  color: isActive ? '#fff' : '#56a1d2',
                }}
                aria-hidden="true"
              />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
