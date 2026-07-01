"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { enhancedNavSections as navSections } from "../_data/navigation-all";
import { NotificationCenter } from "./notification-center";
import styles from "../dashboard.module.css";

type AppShellProps = Readonly<{
  children: ReactNode;
  hiddenSlugs?: string[];
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
}>;

function matchesRoute(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(path + "/");
}

function getTitle(pathname: string): string {
  for (const section of navSections) {
    const activePage = section.pages.find((page) => matchesRoute(pathname, page.path));

    if (activePage) return activePage.title;
  }

  return "Dashboard";
}

export function AppShell({ children, hiddenSlugs = [], user }: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = user.name || user.email || "CCC User";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const visibleSections = navSections.map((section) => ({
    ...section,
    pages: section.pages.filter((page) => !hiddenSlugs.includes(page.slug)),
  })).filter((section) => section.pages.length);

  return (
    <main className={styles.app}>
      <aside className={menuOpen ? styles.sidebarOpen : styles.sidebar} aria-label="Primary navigation">
        <div className={styles.sidebarLogo}>
          <Link className={styles.sidebarToggle} href="/dashboard" aria-label="CCC Internal home" onClick={() => setMenuOpen(false)}>
            <i className="ti ti-layout-sidebar-left-collapse" aria-hidden="true" />
            <span>CCC Internal</span>
          </Link>
        </div>

        {visibleSections.map((section) => (
          <nav className={styles.navSection} key={section.label} aria-label={section.label}>
            <div className={styles.navLabel}>{section.label}</div>
            {section.pages.map((page) => {
              const isActive = matchesRoute(pathname, page.path);

              return (
                <Link
                  className={isActive ? styles.navItemActive : styles.navItem}
                  href={page.path}
                  key={page.slug}
                  onClick={() => setMenuOpen(false)}
                >
                  <i className={`ti ${page.icon}`} aria-hidden="true" />
                  <span>{page.title}</span>
                </Link>
              );
            })}
          </nav>
        ))}
      </aside>

      <section className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.mobileMenuButton} type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
              <i className="ti ti-menu-2" aria-hidden="true" />
            </button>
            <div className={styles.pageTitle}>{getTitle(pathname)}</div>
          </div>
          <div className={styles.topbarRight}>
            <NotificationCenter />
            <div className={styles.userMenu}>
              <div className={styles.userAvatar}>{initials}</div>
              <div className={styles.userText}>
                <strong>{displayName}</strong>
                <span>{user.role || "member"}</span>
              </div>
              <button
                className={styles.signOutButton}
                type="button"
                onClick={() => signOut({ callbackUrl: "/sign-in" })}
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className={styles.content} id="mainContent">{children}</div>
      </section>
      {menuOpen ? <button className={styles.sidebarBackdrop} type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} /> : null}
    </main>
  );
}
