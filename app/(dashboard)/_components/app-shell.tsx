"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";
import { navSections } from "../_data/navigation";
import styles from "../dashboard.module.css";

type AppShellProps = Readonly<{
  children: ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
}>;

function getTitle(pathname: string): string {
  for (const section of navSections) {
    const activePage = section.pages.find((page) => page.path === pathname);

    if (activePage) {
      return activePage.title;
    }
  }

  return "Dashboard";
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const title = getTitle(pathname);
  const displayName = user.name || user.email || "CCC User";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className={styles.app}>
      <aside className={styles.sidebar} aria-label="Primary navigation">
        <div className={styles.sidebarLogo}>
          <Link className={styles.sidebarToggle} href="/dashboard" aria-label="CCC Internal home">
            <i className="ti ti-layout-sidebar-left-collapse" aria-hidden="true" />
            <span>CCC Internal</span>
          </Link>
        </div>

        {navSections.map((section) => (
          <nav className={styles.navSection} key={section.label} aria-label={section.label}>
            <div className={styles.navLabel}>{section.label}</div>
            {section.pages.map((page) => {
              const isActive = pathname === page.path;

              return (
                <Link
                  className={isActive ? styles.navItemActive : styles.navItem}
                  href={page.path}
                  key={page.slug}
                >
                  <i className={`ti ${page.icon}`} aria-hidden="true" />
                  <span>{page.title}</span>
                  {page.slug === "tickets" ? <b className={styles.navBadgeRed}>12</b> : null}
                  {page.slug === "program" ? <b className={styles.navBadge}>24</b> : null}
                </Link>
              );
            })}
          </nav>
        ))}
      </aside>

      <section className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.mobileMenuButton} type="button" aria-label="Open menu">
              <i className="ti ti-menu-2" aria-hidden="true" />
            </button>
            <div className={styles.pageTitle}>{title}</div>
          </div>
          <div className={styles.topbarRight}>
            <button className={styles.notifButton} type="button" aria-label="Notifications">
              <i className="ti ti-bell" aria-hidden="true" />
              <span className={styles.notifDot} />
            </button>
            <span>May 2026</span>
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

        <div className={styles.content}>{children}</div>
      </section>
    </main>
  );
}
