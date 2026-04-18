'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import SignOutButton from './SignOutButton'

interface NavItem {
  href: string
  label: string
  icon: string
}

interface NavGroup {
  label: string
  icon: string
  children: NavItem[]
}

type NavEntry = NavItem | ({ group: true } & NavGroup)

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

function buildNav(userRole: string): NavEntry[] {
  const isSuperadmin = userRole === 'superadmin'
  const isChapterLead = userRole === 'chapter_lead'
  const isHost = userRole === 'host'

  const teamChildren: NavItem[] = [
    { href: '/team', label: 'Team Members', icon: 'fa-users' },
    ...(!isHost ? [{ href: '/hosting-interest', label: 'Host Interest', icon: 'fa-star' }] : []),
    ...(!isHost ? [{ href: '/volunteer-roles', label: 'Volunteer Roles', icon: 'fa-hand-paper-o' }] : []),
    ...(!isHost ? [{ href: '/volunteer-applications', label: 'Volunteer Applications', icon: 'fa-envelope-open-o' }] : []),
  ]

  return [
    { href: '/dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { href: '/upload', label: 'Upload Conversations', icon: 'fa-upload' },
    { href: '/articles', label: 'Articles', icon: 'fa-file-text-o' },
    ...(!isHost ? [{ href: '/community', label: 'Community', icon: 'fa-bar-chart' }] : []),
    ...(!isHost ? [{ href: '/social', label: 'Social Media', icon: 'fa-share-alt' }] : []),
    ...(isSuperadmin ? [{ href: '/chapters', label: 'Chapters', icon: 'fa-map-marker' }] : []),
    ...(isChapterLead ? [{ href: '/chapters', label: 'My Chapter', icon: 'fa-map-marker' }] : []),
    ...(!isHost ? [{ group: true as const, label: 'Team', icon: 'fa-users', children: teamChildren }] : []),
    ...(isSuperadmin ? [{ href: '/users', label: 'Users', icon: 'fa-user-circle-o' }] : []),
    ...(!isHost ? [{ href: '/topics', label: 'Topics', icon: 'fa-lightbulb-o' }] : []),
    ...(!isHost ? [{ href: '/community-uploads', label: 'Community Uploads', icon: 'fa-cloud-upload' }] : []),
    { href: '/settings', label: 'Settings', icon: 'fa-cog' },
  ]
}

const TEAM_HREFS = ['/team', '/volunteer-roles', '/volunteer-applications', '/hosting-interest']

function NavGroupItem({ label, icon, items, pathname }: Omit<NavGroup, 'children'> & { items: NavItem[]; pathname: string }) {
  const isAnyChildActive = items.some(
    (c) => pathname === c.href || pathname.startsWith(c.href)
  )
  const [open, setOpen] = useState(isAnyChildActive)

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: isAnyChildActive ? 600 : 500,
          color: isAnyChildActive ? '#56a1d2' : '#444',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <i
          className={`fa ${icon}`}
          style={{ width: 16, textAlign: 'center', color: '#56a1d2' }}
          aria-hidden="true"
        />
        <span style={{ flex: 1 }}>{label}</span>
        <i
          className={`fa fa-chevron-${open ? 'down' : 'right'}`}
          style={{ fontSize: 10, color: '#9ca3af' }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div style={{ paddingLeft: 14 }}>
          {items.map(({ href, label: childLabel, icon: childIcon }) => {
            const isActive = pathname === href || pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#fff' : '#555',
                  background: isActive ? '#56a1d2' : 'transparent',
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
              >
                <i
                  className={`fa ${childIcon}`}
                  style={{ width: 14, textAlign: 'center', color: isActive ? '#fff' : '#56a1d2', fontSize: 12 }}
                  aria-hidden="true"
                />
                {childLabel}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SidebarNav({ chapterName }: { chapterName?: string }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  if (status === 'loading' || !session) return null

  const userRole: string = (session.user as { role?: string } | undefined)?.role ?? ''
  const roleLabel = ROLE_LABELS[userRole] ?? userRole.toUpperCase()
  const roleColor = ROLE_COLORS[userRole] ?? { bg: '#f3f4f6', color: '#4b5563' }
  const nav = buildNav(userRole)

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

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 16px' }}>
        {nav.map((entry) => {
          if ('group' in entry) {
            return (
              <NavGroupItem
                key={entry.label}
                label={entry.label}
                icon={entry.icon}
                items={entry.children}
                pathname={pathname}
              />
            )
          }
          const isActive =
            pathname === entry.href || (entry.href !== '/dashboard' && pathname.startsWith(entry.href))
          return (
            <Link
              key={entry.href}
              href={entry.href}
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
                className={`fa ${entry.icon}`}
                style={{ width: 16, textAlign: 'center', color: isActive ? '#fff' : '#56a1d2' }}
                aria-hidden="true"
              />
              {entry.label}
            </Link>
          )
        })}

        {/* Sign out */}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <SignOutButton />
        </div>
      </nav>
    </div>
  )
}
