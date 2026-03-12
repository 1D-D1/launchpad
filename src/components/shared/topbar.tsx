'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    return { label, href };
  });
}

export default function Topbar() {
  const pathname = usePathname();
  const breadcrumbs = buildBreadcrumbs(pathname || '/dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-6 backdrop-blur-sm">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.href} className="flex items-center gap-2">
            {index > 0 && <span className="text-zinc-600">/</span>}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium text-white">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-zinc-400 hover:text-white">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
            U
          </div>
          <span className="hidden sm:inline">User</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-xl">
            <Link
              href="/settings"
              className="block px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
              onClick={() => setMenuOpen(false)}
            >
              Profile
            </Link>
            <Link
              href="/settings"
              className="block px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
              onClick={() => setMenuOpen(false)}
            >
              Settings
            </Link>
            <hr className="my-1 border-zinc-800" />
            <button
              className="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-800"
              onClick={() => {
                setMenuOpen(false);
                // signOut will be wired when next-auth is fully configured
                window.location.href = '/login';
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
