// sfms/app/login/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthContext';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  // Use 'isLoading' from the updated AuthContext
  const { user, isLoading, session } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Use 'isLoading' for the condition
    if (!isLoading && user) {
      console.log(
        'LoginPage: User detected and auth is loaded, redirecting to dashboard.'
      );
      router.replace('/dashboard');
    } else if (!isLoading && !user) {
      console.log(
        'LoginPage: No user and auth is loaded, staying on login page.'
      );
    } else {
      console.log('LoginPage: Auth is still loading (isLoading is true).');
    }
  }, [user, isLoading, router, session]); // Added session to dependencies for completeness

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading('Logging in...');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message, { id: toastId });
      } else {
        toast.success('Login successful! Redirecting...', { id: toastId });
        // onAuthStateChange in AuthContext will update user state,
        // then useEffect here will redirect once isLoading is false and user is set.
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.', {
        id: toastId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Use 'isLoading' for this condition
  if (isLoading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="animate-pulse text-gray-700">Loading session...</div>
      </main>
    );
  }

  // If user is loaded and present, useEffect should have redirected.
  // This form shows if isLoading is false AND user is null.
  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 p-4">
        <div className="w-full max-w-md p-8 sm:p-10 space-y-6 bg-white rounded-xl shadow-2xl">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">
              Welcome Back
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Log in to School Fee Manager.
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="emailInput"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="emailInput"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm transition duration-150"
              />
            </div>
            <div>
              <label
                htmlFor="passwordInput"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="passwordInput"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm transition duration-150"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 px-4 mt-2 rounded-lg text-white font-semibold transition duration-150 ease-in-out text-base ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
            >
              {isSubmitting ? 'Logging In...' : 'Login'}
            </button>
          </form>
          <p className="text-sm text-center text-gray-600 mt-6">
            Need to register a new school?{' '}
            <Link
              href="/signup"
              className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline"
            >
              Sign Up Here
            </Link>
          </p>
        </div>
      </main>
    );
  }

  // Fallback if user is somehow set but redirection hasn't happened (should be covered by useEffect)
  // Or if isLoading is false but user is present (useEffect should redirect)
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="text-gray-700">Redirecting...</div>
    </main>
  );
}
