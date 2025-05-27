// sfms/app/dashboard/layout.tsx
'use client';

import React, { useEffect } from 'react';
import { Header } from '@/components/Header';
import { useAuth } from '@/components/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Destructure all relevant values from useAuth, including the new isSchoolInfoLoading
  const { user, isLoading, schoolId, isAdmin, isSchoolInfoLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log(
      'DashboardLayout useEffect: isLoading:',
      isLoading,
      'user:',
      !!user,
      'schoolId:',
      schoolId,
      'isSchoolInfoLoading:',
      isSchoolInfoLoading
    );

    // This effect handles redirecting unauthenticated users
    if (!isLoading && !user) {
      console.log(
        'DashboardLayout: Auth loaded, no user. Redirecting to login.'
      );
      router.replace(`/login?redirect=${pathname || '/dashboard'}`);
    }

    // You could add logic here if a user is authenticated but schoolId is missing AFTER it has loaded (or failed to load)
    // For example, redirect to a "school setup" page or show a global error.
    // For now, individual pages will handle missing schoolId if they need it.
  }, [user, isLoading, schoolId, isSchoolInfoLoading, router, pathname]);

  // Primary loading state: waiting for user authentication to resolve
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-700 animate-pulse">
          Loading dashboard session...
        </p>
      </div>
    );
  }

  // After primary auth, if there's still no user, it means they should be redirected.
  // The useEffect above handles the redirection. Showing a "Redirecting" message can be helpful.
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-700">Redirecting to login...</p>
      </div>
    );
  }

  // At this point, user is authenticated (isLoading is false, user is present).
  // The schoolId might still be loading if isSchoolInfoLoading is true, or it might be null.
  // Individual pages or components downstream can decide how to handle the state of schoolId and isSchoolInfoLoading.
  // For example, the Header might show a generic state if schoolId isn't ready yet.

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />{' '}
      {/* Header might also want to use schoolId or isAdmin from useAuth() */}
      <main className="flex-grow">
        {/* {isSchoolInfoLoading && (
          <div className="p-4 text-center text-sm text-gray-500">Loading school information...</div>
        )} */}
        {/* We let child pages handle their specific dependencies on schoolId */}
        {children}
      </main>
    </div>
  );
}
