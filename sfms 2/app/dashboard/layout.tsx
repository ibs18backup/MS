// sfms/app/dashboard/layout.tsx
'use client';

import React, { useEffect } from 'react';
import { Header } from '@/components/Header'; // We'll adjust Header next
import { useAuth } from '@/components/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading: authIsLoading } = useAuth(); // Not using schoolId here yet
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authIsLoading && !user) {
      console.log('DashboardLayout: No user, redirecting to login.');
      router.replace(`/login?redirect=${pathname}`);
    }
  }, [user, authIsLoading, router, pathname]);

  if (authIsLoading || !user) { // If loading or no user (after loading), show loader/redirect text
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-700 animate-pulse">
          {authIsLoading ? 'Loading dashboard session...' : 'Redirecting...'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      <main className="flex-grow">
        {children}
      </main>
    </div>
  );
}