// sfms/app/signup/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/AuthContext';

export default function SignupPage() {
  const router = useRouter();
  const { user, schoolId, isLoading: authIsLoading } = useAuth();

  const [schoolName, setSchoolName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authIsLoading && user && schoolId) {
      router.replace('/dashboard'); // Already logged in and set up
    }
  }, [user, schoolId, authIsLoading, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    
    setIsSubmitting(true);
    const toastId = toast.loading('Creating your school and admin account...');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('create-school-and-admin', {
        body: { schoolName, adminEmail: email, adminPassword: password },
      });

      if (functionError) throw new Error(functionError.message || 'Failed to invoke signup function.');
      if (data && data.error) throw new Error(data.error); // Error from within the function logic
      
      toast.success('School & admin account created! Please log in.', { id: toastId, duration: 4000 });
      router.push('/login');

    } catch (err: any) {
      console.error('Signup page error:', err);
      toast.error(err.message || 'An unexpected error occurred.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (authIsLoading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-700 animate-pulse">Loading...</p>
      </main>
    );
  }
  // If user is logged in AND has a school, they'd be redirected by useEffect.
  // If user is logged in but NO schoolId, they can't sign up a new school this way (usually).
  // This page is primarily for brand new users/schools.

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-500 p-4">
      <div className="w-full max-w-lg p-8 sm:p-10 space-y-6 bg-white rounded-xl shadow-2xl">
        <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">Register Your School</h2>
            <p className="mt-2 text-sm text-gray-600">Create an admin account and get started.</p>
        </div>
        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
            <input id="schoolName" type="text" placeholder="e.g., Bright Futures Academy" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm transition duration-150" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Your Admin Email</label>
            <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm transition duration-150" />
          </div>
          <div>
            <label htmlFor="passwordInput" className="block text-sm font-medium text-gray-700 mb-1">Choose a Password</label>
            <input id="passwordInput" type="password" placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm transition duration-150" />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input id="confirmPassword" type="password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm transition duration-150" />
          </div>

          <button type="submit" disabled={isSubmitting || authIsLoading} className={`w-full py-3 px-4 mt-2 rounded-lg text-white font-semibold transition duration-150 ease-in-out text-base ${ (isSubmitting || authIsLoading) ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500' }`} >
            {isSubmitting ? 'Processing...' : 'Create School & Admin'}
          </button>
        </form>
        <p className="text-sm text-center text-gray-600 mt-6">
          Already registered your school?{' '}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </main>
  );
}