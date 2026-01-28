import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../api'
import styles from './Navigation.module.css'

interface NavItem {
  label: string
  href?: string
  onClick?: () => void
  children?: { label: string; href: string; description?: string }[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Heroes',
    children: [
      { label: 'Hero Stats', href: '/heroes', description: 'Win rates & pick rates' },
      { label: 'Historic', href: '/heroes/historic', description: 'Rankings across patches' },
      { label: 'Facets', href: '/facets', description: 'Hero facet statistics' },
    ],
  },
  {
    label: 'Abilities',
    children: [
      { label: 'All Abilities', href: '/abilities', description: 'Stats & valuations' },
      { label: 'Ability Pairs', href: '/ability-pairs', description: 'Synergy combinations' },
      { label: 'High Skill', href: '/ability-high-skill', description: 'High MMR analysis' },
      { label: 'By Hero', href: '/ability-by-hero', description: 'Grouped by origin' },
      { label: 'Stat Shifts', href: '/ability-shifts', description: 'Impact on K/D/GPM' },
      { label: 'Hero Types', href: '/ability-hero-attributes', description: 'By attribute or attack type' },
      { label: 'Aghanim\'s', href: '/ability-aghs', description: 'Scepter & Shard' },
    ],
  },
  {
    label: 'Players',
    href: '/leaderboard',
    children: [
      { label: 'Leaderboard', href: '/leaderboard', description: 'Top players by region' },
      { label: 'Distribution', href: '/player-distribution', description: 'Rating distribution' },
    ],
  },
  {
    label: 'Game',
    href: '#',
    onClick: () => alert('todo'),
  },
  {
    label: 'About',
    href: '/about',
  },
]

export function Navigation() {
  const location = useLocation()
  const { user, isLoading, logout } = useAuth()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setOpenDropdown(null)
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  const isDropdownActive = (item: NavItem) => {
    if (item.href && isActive(item.href)) return true
    return item.children?.some(child => isActive(child.href)) ?? false
  }

  return (
    <nav ref={navRef} className={styles.nav}>
      <Link to="/" className={styles.logo}>
        <img src="/windrun_logo.png" alt="Windrun" className={styles.logoImg} />
      </Link>

      <button
        className={styles.mobileToggle}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        <span className={`${styles.hamburger} ${mobileOpen ? styles.hamburgerOpen : ''}`} />
      </button>

      <div className={`${styles.links} ${mobileOpen ? styles.linksOpen : ''}`}>
        {NAV_ITEMS.map(item => (
          <div
            key={item.label}
            className={styles.navItem}
            onMouseEnter={() => item.children && setOpenDropdown(item.label)}
            onMouseLeave={() => setOpenDropdown(null)}
          >
            {item.children ? (
              <>
                <button
                  className={`${styles.navLink} ${isDropdownActive(item) ? styles.navLinkActive : ''}`}
                  onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                  aria-expanded={openDropdown === item.label}
                >
                  {item.label}
                  <svg className={styles.chevron} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className={`${styles.dropdown} ${openDropdown === item.label ? styles.dropdownOpen : ''}`}>
                  {item.children.map(child => (
                    <Link
                      key={child.href}
                      to={child.href}
                      className={`${styles.dropdownItem} ${isActive(child.href) ? styles.dropdownItemActive : ''}`}
                    >
                      <span className={styles.dropdownLabel}>{child.label}</span>
                      {child.description && (
                        <span className={styles.dropdownDesc}>{child.description}</span>
                      )}
                    </Link>
                  ))}
                </div>
              </>
            ) : item.onClick ? (
              <button
                className={styles.navLink}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ) : (
              <Link
                to={item.href!}
                className={`${styles.navLink} ${isActive(item.href!) ? styles.navLinkActive : ''}`}
              >
                {item.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className={styles.auth}>
        {isLoading ? (
          <span className={styles.authLoading}>...</span>
        ) : user ? (
          <div className={styles.userMenu}>
            <Link to={`/players/${user.id}`} className={styles.userName}>
              {user.name}
            </Link>
            <button onClick={logout} className={styles.authButton}>
              Logout
            </button>
          </div>
        ) : (
          <button onClick={() => alert('todo')} className={styles.steamButton}>
            <svg className={styles.steamIcon} viewBox="0 0 32 32" fill="currentColor">
              <path d="M15.974 0C7.596 0 .765 6.464.042 14.681l8.583 3.543a4.52 4.52 0 0 1 2.55-.786c.085 0 .17.003.253.008l3.82-5.531v-.078c0-3.322 2.703-6.025 6.025-6.025s6.025 2.703 6.025 6.025-2.703 6.025-6.025 6.025h-.14l-5.446 3.886c0 .07.004.14.004.211 0 2.493-2.027 4.52-4.52 4.52a4.525 4.525 0 0 1-4.476-3.903L.633 19.971C2.35 27.076 8.548 32.2 15.974 32.2c8.837 0 16-7.163 16-16s-7.163-16-16-16zm-5.01 24.692l-1.946-.803a3.393 3.393 0 0 0 3.134 2.087 3.393 3.393 0 0 0 3.389-3.39 3.393 3.393 0 0 0-3.39-3.388c-.573 0-1.112.145-1.585.399l2.01.83a2.5 2.5 0 0 1-1.612 4.265zm10.31-12.855a4.016 4.016 0 0 0-4.012-4.012 4.016 4.016 0 0 0-4.012 4.012 4.016 4.016 0 0 0 4.012 4.012 4.016 4.016 0 0 0 4.012-4.012zm-7.019 0a3.01 3.01 0 0 1 3.007-3.007 3.01 3.01 0 0 1 3.008 3.007 3.01 3.01 0 0 1-3.008 3.008 3.01 3.01 0 0 1-3.007-3.008z"/>
            </svg>
            <span className={styles.steamText}>Log in with Steam</span>
          </button>
        )}
      </div>
    </nav>
  )
}
