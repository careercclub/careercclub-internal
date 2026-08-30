"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { enhancedNavSections as navSections } from "../_data/navigation-all";
import { CommandPalette } from "./command-palette";
import { NotificationCenter } from "./notification-center";
import styles from "../dashboard.module.css";

type AppShellProps = Readonly<{
  children: ReactNode;
  hiddenSlugs?: string[];
  navBadges?: Record<string, number>;
  monthLabel?: string;
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
}>;

const BOTTOM_NAV = [
  { slug: "dashboard", label: "Home", path: "/dashboard", icon: "ti-home" },
  { slug: "program", label: "Program", path: "/program", icon: "ti-checklist" },
  { slug: "content-planning", label: "Konten", path: "/content-planning", icon: "ti-bookmark" },
  { slug: "b2b-partnership", label: "B2B", path: "/b2b-partnership", icon: "ti-users-group" },
  { slug: "org-partnership", label: "Org", path: "/org-partnership", icon: "ti-school" },
  { slug: "design-assets", label: "Design", path: "/design-assets", icon: "ti-palette" },
];

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

function subscribeToSidebarPreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("sidebar-preference", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("sidebar-preference", onChange);
  };
}

function getSidebarPreference() {
  return localStorage.getItem("sidebarCollapsed") === "1";
}

export function AppShell({ children, hiddenSlugs = [], navBadges = {}, monthLabel, user }: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeToSidebarPreference, getSidebarPreference, () => false);
  const toggleCollapse = () => {
    localStorage.setItem("sidebarCollapsed", collapsed ? "0" : "1");
    window.dispatchEvent(new Event("sidebar-preference"));
  };
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
      <aside className={`${menuOpen ? styles.sidebarOpen : styles.sidebar}${collapsed ? " " + styles.sidebarCollapsed : ""}`} aria-label="Primary navigation">
        <div className={styles.sidebarUser}>
          <div className={styles.userAvatar}>{initials}</div>
          <div className={styles.userText}>
            <strong>{displayName}</strong>
            <span>{user.role || "member"}</span>
          </div>
          <button className={styles.signOutButton} type="button" onClick={() => signOut({ callbackUrl: "/sign-in" })}>Sign out</button>
        </div>

        <div className={styles.sidebarLogo}>
          <button className={styles.sidebarToggle} type="button" onClick={toggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand" : "Collapse"}>
            <i className={`ti ${collapsed ? "ti-layout-sidebar-left-expand" : "ti-layout-sidebar-left-collapse"}`} aria-hidden="true" />
            <span>Collapse</span>
          </button>
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
                  title={page.title}
                  onClick={() => setMenuOpen(false)}
                >
                  <i className={`ti ${page.icon}`} aria-hidden="true" />
                  <span>{page.title}</span>
                  {navBadges[page.slug] ? <span className={page.slug === "tickets" ? styles.navBadgeRed : styles.navBadge}>{navBadges[page.slug] > 99 ? "99+" : navBadges[page.slug]}</span> : null}
                </Link>
              );
            })}
          </nav>
        ))}
      </aside>

      <section className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.pageTitle}>{getTitle(pathname)}</div>
            <CommandPalette hiddenSlugs={hiddenSlugs} />
          </div>
          <div className={styles.topbarRight}>
            {monthLabel ? <span className={styles.topbarMonth}>{monthLabel}</span> : null}
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

      <nav className={styles.bottomNav} aria-label="Mobile navigation">
        {BOTTOM_NAV.map((item) => {
          const isActive = matchesRoute(pathname, item.path);
          return (
            <Link className={isActive ? styles.bottomNavItemActive : styles.bottomNavItem} href={item.path} key={item.slug} onClick={() => setMenuOpen(false)}>
              <i className={`ti ${item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button className={styles.bottomNavItem} type="button" onClick={() => setMenuOpen(true)} aria-label="More menu">
          <i className="ti ti-dots" aria-hidden="true" />
          <span>Lainnya</span>
        </button>
      </nav>

      {menuOpen ? <button className={styles.sidebarBackdrop} type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} /> : null}
    </main>
  );
}
