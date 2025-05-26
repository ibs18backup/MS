// sfms/components/Header.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import Link from 'next/link';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: authIsLoading, logout } = useAuth();

  if (authIsLoading || pathname === '/login' || pathname === '/signup') {
    return null;
  }
  if (!user) {
    // If not loading and no user, don't show header on protected areas
    return null;
  }

  const showBackButton =
    user && pathname.startsWith('/dashboard') && pathname !== '/dashboard';

  return (
    <header className="flex justify-between items-center p-4 border-b bg-white shadow-sm print:hidden sticky top-0 z-50">
      <div className="flex items-center space-x-4">
        {showBackButton && (
          <button
            onClick={() => router.back()}
            className="text-indigo-600 hover:underline text-sm"
          >
            ← Back
          </button>
        )}
        <Link
          href="/dashboard"
          className="text-lg font-semibold text-indigo-700 hover:text-indigo-900"
        >
          School Fee Manager
        </Link>
      </div>
      <button
        onClick={async () => {
          await logout();
          router.push('/login');
        }}
        className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-1.5 px-3 rounded-md shadow-sm hover:shadow-md transition-all duration-150"
      >
        Logout
      </button>
    </header>
  );
}
