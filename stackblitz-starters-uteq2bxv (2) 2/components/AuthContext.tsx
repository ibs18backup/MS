// sfms/components/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { Database } from '@/lib/database.types';

type SchoolAdminInfo = {
  schoolId: string | null;
  isAdmin: boolean;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean; // For initial auth check
  isSchoolInfoLoading: boolean; // Separate loading for school info
  logout: () => Promise<void>;
  schoolId: string | null;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [schoolAdminInfo, setSchoolAdminInfo] = useState<SchoolAdminInfo>({ schoolId: null, isAdmin: false });
  const [isLoading, setIsLoading] = useState(true); // For the main auth user/session
  const [isSchoolInfoLoading, setIsSchoolInfoLoading] = useState(false); // Separate loading for school info

  console.log('AuthContext_V6: Render. isLoading:', isLoading, 'isSchoolInfoLoading:', isSchoolInfoLoading);

  useEffect(() => {
    let isMounted = true;
    console.log('AuthContext_V6_useEffect: Hook starts.');
    setIsLoading(true); // Set loading true for initial auth check

    if (!supabase || !supabase.auth) {
        console.error('AuthContext_V6_useEffect: Supabase client or supabase.auth is not available!');
        if (isMounted) setIsLoading(false); 
        return;
    }

    const fetchSchoolAdminInfo = async (userId: string) => {
      if (!isMounted) return;
      console.log(`AuthContext_V6_fetchSchoolAdminInfo: START - User: ${userId}`);
      setIsSchoolInfoLoading(true); // Set loading for school info
      try {
        const { data, error, status } = await supabase
          .from('school_administrators')
          .select('school_id, role')
          .eq('user_id', userId)
          .single();

        if (!isMounted) return; // Check again after await

        if (error && status !== 406) {
          console.warn('AuthContext_V6_fetchSchoolAdminInfo: Error fetching:', error.message);
          setSchoolAdminInfo({ schoolId: null, isAdmin: false });
        } else if (data) {
          console.log('AuthContext_V6_fetchSchoolAdminInfo: Data fetched:', data);
          setSchoolAdminInfo({ schoolId: data.school_id, isAdmin: data.role === 'admin' });
        } else {
          console.log('AuthContext_V6_fetchSchoolAdminInfo: No data found.');
          setSchoolAdminInfo({ schoolId: null, isAdmin: false });
        }
      } catch (e: any) {
        if (!isMounted) return;
        console.error("AuthContext_V6_fetchSchoolAdminInfo: EXCEPTION:", e.message);
        setSchoolAdminInfo({ schoolId: null, isAdmin: false });
      } finally {
        if (isMounted) setIsSchoolInfoLoading(false); // Always set school info loading to false
        console.log('AuthContext_V6_fetchSchoolAdminInfo: FINISHED.');
      }
    };
    
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        console.log(`AuthContext_V6_onAuthStateChange: Event: ${_event}, User: ${currentSession?.user?.id}`);
        if (!isMounted) return;
        
        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // Fetch school info, but don't let its success/failure block initial isLoading
          fetchSchoolAdminInfo(currentUser.id); 
        } else {
          setSchoolAdminInfo({ schoolId: null, isAdmin: false });
        }
        
        // This isLoading is for the main auth state (user/session)
        console.log('AuthContext_V6_onAuthStateChange: Setting main isLoading to false.');
        setIsLoading(false); 
      }
    );

    // Initial getSession call is primarily handled by onAuthStateChange's INITIAL_SESSION event
    // We just ensure the listener is active.

    return () => {
      console.log("AuthContext_V6_useEffect: Cleanup.");
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    setIsLoading(true); 
    setIsSchoolInfoLoading(false); // Reset school info loading
    setSchoolAdminInfo({ schoolId: null, isAdmin: false }); // Clear school info
    const { error } = await supabase.auth.signOut();
    // onAuthStateChange will set isLoading to false.
    if (error) {
      toast.error("Logout failed: " + error.message);
      setIsLoading(false); // Also set here if signout errors out quickly
    } else {
      toast.success("Logged out successfully.");
    }
  };
  
  return (
    <AuthContext.Provider value={{ user, session, isLoading, isSchoolInfoLoading, logout, ...schoolAdminInfo }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};