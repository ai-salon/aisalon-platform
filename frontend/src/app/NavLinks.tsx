'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type ChapterNav = { code: string; name: string };

function isActive(pathname: string, href: string): boolean {
  if (href.startsWith('/#') || href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function NavLinks({ chapters }: { chapters: ChapterNav[] }) {
  const pathname = usePathname();

  const linkStyle = (active: boolean) => ({
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    color: active ? '#56a1d2' : '#111',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  });

  const aboutActive = isActive(pathname, '/#about');
  const insightsActive = isActive(pathname, '/insights');
  const chaptersActive = isActive(pathname, '/#chapters');
  const getInvolvedActive = ['/start', '/volunteer', '/host'].some((h) =>
    isActive(pathname, h)
  );

  return (
    <ul
      className="desktop-nav-links"
      style={{
        display: 'flex',
        gap: 4,
        listStyle: 'none',
        margin: 0,
        padding: 0,
        marginRight: 'auto',
      }}
    >
      <li className="dropdown">
        <Link
          href="/#about"
          className={`nav-link${aboutActive ? ' nav-link-active' : ''}`}
          style={linkStyle(aboutActive)}
        >
          About <i className="fa fa-angle-down" style={{ fontSize: 12 }} aria-hidden="true" />
        </Link>
        <ul className="dropdown-menu" style={{ listStyle: 'none', margin: 0, padding: '10px 0' }}>
          <li><Link href="/#values">Values</Link></li>
          <li><Link href="/#team">Team</Link></li>
        </ul>
      </li>

      <li>
        <Link
          href="/insights"
          className={`nav-link${insightsActive ? ' nav-link-active' : ''}`}
          style={linkStyle(insightsActive)}
        >
          Insights
        </Link>
      </li>

      <li className="dropdown">
        <Link
          href="/#chapters"
          className={`nav-link${chaptersActive ? ' nav-link-active' : ''}`}
          style={linkStyle(chaptersActive)}
        >
          Chapters <i className="fa fa-angle-down" style={{ fontSize: 12 }} aria-hidden="true" />
        </Link>
        <ul className="dropdown-menu" style={{ listStyle: 'none', margin: 0, padding: '10px 0' }}>
          {chapters.map((ch) => (
            <li key={ch.code}>
              <Link href={`/chapters/${ch.code}`}>{ch.name}</Link>
            </li>
          ))}
        </ul>
      </li>

      <li className="dropdown">
        <Link
          href="/start"
          className={`nav-link${getInvolvedActive ? ' nav-link-active' : ''}`}
          style={linkStyle(getInvolvedActive)}
        >
          Get Involved <i className="fa fa-angle-down" style={{ fontSize: 12 }} aria-hidden="true" />
        </Link>
        <ul className="dropdown-menu" style={{ listStyle: 'none', margin: 0, padding: '10px 0' }}>
          <li>
            <a href="https://lu.ma/Ai-salon" target="_blank" rel="noopener noreferrer">
              Attend an Event
            </a>
          </li>
          <li><Link href="/start">Run a Salon</Link></li>
          <li><Link href="/volunteer">Volunteer</Link></li>
          <li><Link href="/host">Host or Join a Chapter</Link></li>
        </ul>
      </li>
    </ul>
  );
}
