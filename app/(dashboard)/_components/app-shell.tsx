"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { Suspense, useState, useSyncExternalStore, type ReactNode } from "react";
import { enhancedNavSections as navSections } from "../_data/navigation-all";
import { isChildActive, moduleChildren, type NavLink } from "@/lib/records/links";
import { AppDialogHost } from "@/app/_components/app-dialog";
import { CommandPalette } from "./command-palette";
import { RecordFocus } from "./record-focus";
import { NotificationCenter } from "./notification-center";
import { ThemeSwitch } from "@/app/_components/theme-switch";
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

// Phone bottom bar: daily-work modules first. Hidden modules are skipped and the next
// one in this list takes the slot; everything else stays one tap away under "More".
const BOTTOM_NAV = [
  { slug: "dashboard", label: "Home", path: "/dashboard", icon: "ti-home" },
  { slug: "tickets", label: "Tickets", path: "/tickets", icon: "ti-ticket" },
  { slug: "program", label: "Program", path: "/program", icon: "ti-checklist" },
  { slug: "content-planning", label: "Content", path: "/content-planning", icon: "ti-bookmark" },
  { slug: "crm", label: "CRM", path: "/crm", icon: "ti-address-book" },
  { slug: "b2b-partnership", label: "B2B", path: "/b2b-partnership", icon: "ti-users-group" },
  { slug: "design-assets", label: "Design", path: "/design-assets", icon: "ti-palette" },
];
const BOTTOM_SLOTS = 5;

/** Sub-pages of a module. Needs the query string (?tab=), so it renders inside Suspense. */
function NavChildren({ links, pathname, onNavigate }: { links: NavLink[]; pathname: string; onNavigate: () => void }) {
  const search = useSearchParams().toString();
  return <NavChildList links={links} onNavigate={onNavigate} activeHref={links.find((link) => isChildActive(link.href, pathname, search))?.href} />;
}

function NavChildList({ links, onNavigate, activeHref }: { links: NavLink[]; onNavigate: () => void; activeHref?: string }) {
  return (
    <div className={styles.navChildren}>
      {links.map((link) => (
        <Link aria-current={link.href === activeHref ? "page" : undefined} className={link.href === activeHref ? styles.navChildActive : styles.navChild} href={link.href} key={link.href} onClick={onNavigate}>
          {link.label}
        </Link>
      ))}
    </div>
  );
}

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
  const subPages = moduleChildren(String(user.role || "").toLowerCase() === "admin");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const bottomNav = BOTTOM_NAV.filter((item) => !hiddenSlugs.includes(item.slug)).slice(0, BOTTOM_SLOTS);
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

        <div className={styles.brand}>
          <div className={styles.brandMark} aria-hidden="true">CC</div>
          <div className={styles.brandText}><b>CareerCclub</b><small>Internal</small></div>
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
              const subLinks = subPages[page.path];
              // A module's pages open while you are in it; elsewhere the arrow opens them.
              const open = Boolean(subLinks?.length) && (expanded[page.path] ?? isActive);

              return (
                <div className={styles.navGroup} key={page.slug}>
                  <div className={styles.navRow}>
                    <Link
                      className={isActive ? styles.navItemActive : styles.navItem}
                      href={page.path}
                      title={page.title}
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className={`ti ${page.icon}`} aria-hidden="true" />
                      <span>{page.title}</span>
                      {navBadges[page.slug] ? <span className={styles.navBadgeRed} title={`${navBadges[page.slug]} late`}>{navBadges[page.slug] > 99 ? "99+" : navBadges[page.slug]}</span> : null}
                    </Link>
                    {subLinks?.length ? (
                      <button aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} ${page.title} pages`} className={styles.navExpand} onClick={() => setExpanded((current) => ({ ...current, [page.path]: !open }))} type="button">
                        <i className={`ti ti-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {open && subLinks ? (
                    <Suspense fallback={<NavChildList links={subLinks} onNavigate={() => setMenuOpen(false)} />}>
                      <NavChildren links={subLinks} onNavigate={() => setMenuOpen(false)} pathname={pathname} />
                    </Suspense>
                  ) : null}
                </div>
              );
            })}
          </nav>
        ))}
      </aside>

      <section className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.pageTitle}>{getTitle(pathname)}</div>
            <CommandPalette hiddenSlugs={hiddenSlugs} isAdmin={String(user.role || "").toLowerCase() === "admin"} />
            <Suspense fallback={null}><RecordFocus /></Suspense>
          </div>
          <div className={styles.topbarRight}>
            {monthLabel ? <span className={styles.topbarMonth}>{monthLabel}</span> : null}
            <ThemeSwitch />
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
        {bottomNav.map((item) => {
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
          <span>More</span>
        </button>
      </nav>

      <AppDialogHost />
      {menuOpen ? <button className={styles.sidebarBackdrop} type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} /> : null}
    </main>
  );
}
