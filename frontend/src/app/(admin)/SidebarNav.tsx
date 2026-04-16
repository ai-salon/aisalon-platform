'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from './SignOutButton'

interface NavItem {
  href: string
  label: string
  icon: string
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

function buildNavItems(userRole: string, chapterId: string | undefined): NavItem[] {
  const isSuperadmin = userRole === 'superadmin'
  const isChapterLead = userRole === 'chapter_lead'
  const isHost = userRole === 'host'

  return [
    { href: '/dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { href: '/upload', label: 'Upload Conversations', icon: 'fa-upload' },
    { href: '/articles', label: 'Articles', icon: 'fa-file-text-o' },
    ...(!isHost ? [{ href: '/community', label: 'Community', icon: 'fa-bar-chart' }] : []),
    ...(!isHost ? [{ href: '/social', label: 'Social Media', icon: 'fa-share-alt' }] : []),
    ...(isSuperadmin ? [{ href: '/chapters', label: 'Chapters', icon: 'fa-map-marker' }] : []),
    ...(isChapterLead ? [{ href: '/chapters', label: 'My Chapter', icon: 'fa-map-marker' }] : []),
    ...(!isHost ? [{ href: '/team', label: 'Team', icon: 'fa-users' }] : []),
    ...(isSuperadmin ? [{ href: '/users', label: 'Users', icon: 'fa-user-circle-o' }] : []),
    ...(!isHost ? [{ href: '/volunteer-roles', label: 'Volunteer Roles', icon: 'fa-hand-paper-o' }] : []),
    ...(!isHost ? [{ href: '/volunteer-applications', label: 'Applications', icon: 'fa-envelope-open-o' }] : []),
    ...(!isHost ? [{ href: '/topics', label: 'Topics', icon: 'fa-lightbulb-o' }] : []),
    ...(!isHost ? [{ href: '/community-uploads', label: 'Community Uploads', icon: 'fa-cloud-upload' }] : []),
    ...(!isHost ? [{ href: '/hosting-interest', label: 'Host Interest', icon: 'fa-star' }] : []),
    { href: '/settings', label: 'Settings', icon: 'fa-cog' },
  ]
}

export default function SidebarNav({ chapterName }: { chapterName?: string }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  if (status === 'loading' || !session) return null

  const userRole: string = (session.user as { role?: string } | undefined)?.role ?? ''
  const chapterId: string | undefined = (session.user as { chapterId?: string } | undefined)?.chapterId

  const navItems = buildNavItems(userRole, chapterId)
  const roleLabel = ROLE_LABELS[userRole] ?? userRole.toUpperCase()
  const roleColor = ROLE_COLORS[userRole] ?? { bg: '#f3f4f6', color: '#4b5563' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Role / chapter badge */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ background: roleColor.bg, borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: roleColor.color, letterSpacing: '0.08em' }}>
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
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 16px', flex: 1 }}>
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
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
                style={{ width: 16, textAlign: 'center', color: isActive ? '#fff' : '#56a1d2' }}
                aria-hidden="true"
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div style={{ padding: '0 16px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 12 }}>
        <SignOutButton />
      </div>
    </div>
  )
}
