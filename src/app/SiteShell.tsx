"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/harry/", label: "Profile lookup" },
  { href: "/wari/", label: "Connections" },
];

function SearchForm({ mobile = false }: { mobile?: boolean }) {
  return (
    <form action="/harry/" method="get" className="site-search">
      <label
        className="sr-only"
        htmlFor={mobile ? "mobile-search" : "site-search"}
      >
        Search a Steam profile
      </label>
      <input
        id={mobile ? "mobile-search" : "site-search"}
        name="username"
        type="search"
        placeholder="Search a Steam profile"
      />
      <button type="submit" aria-label="Search">
        Search
      </button>
    </form>
  );
}

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <header className="site-header">
        <div className="topbar">
          <Link className="brand" href="/harry/" aria-label="Vaporator home">
            <span className="brand-mark" aria-hidden="true">
              V
            </span>
            <span>VAPORATOR</span>
          </Link>

          <details className="mobile-menu">
            <summary aria-label="Open navigation menu">
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </summary>
            <nav aria-label="Mobile navigation">
              {navigation.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
              <SearchForm mobile />
            </nav>
          </details>
        </div>
        <div className="subnav">
          <nav aria-label="Section navigation">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  pathname === item.href.slice(0, -1) ||
                  pathname.startsWith(item.href)
                    ? "active"
                    : ""
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <SearchForm />
        </div>
      </header>
      <div className="site-content">{children}</div>
    </>
  );
}
