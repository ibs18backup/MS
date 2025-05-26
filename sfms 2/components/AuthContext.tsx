// sfms/components/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean; // True ONLY during initial auth check
  logout: () => Promise<void>;
  // schoolId and isAdmin will be added back later
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  console.log('AuthContext: Provider Render. isLoading:', isLoading, 'User:', user?.id);

  useEffect(() => {
    console.log('AuthContext: useEffect for onAuthStateChange listener setup.');
    setIsLoading(true); // Start loading

    // Immediately try to get the session once on mount
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log('AuthContext: Initial getSession() result. User:', currentSession?.user?.id);
      // This is just an initial check, onAuthStateChange will be the authority
      // We don't set isLoading false here yet, let onAuthStateChange do it once it fires with INITIAL_SESSION
    }).catch(error => {
      console.error('AuthContext: Initial getSession() error:', error.message);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        console.log(`AuthContext: onAuthStateChange event: ${_event}, User: ${currentSession?.user?.id}`);
        
        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);
        
        // This is the most important: set loading to false after the first event (INITIAL_SESSION, SIGNED_IN, or SIGNED_OUT)
        console.log('AuthContext: Auth state determined. Setting isLoading to false.');
        setIsLoading(false); 
      }
    );

    return () => {
      console.log("AuthContext: Unsubscribing auth listener.");
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    console.log("AuthContext: logout() initiated.");
    setIsLoading(true); // Indicate loading during logout
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Logout failed: " + error.message);
      console.error("AuthContext: Logout error:", error.message);
      setIsLoading(false); // Stop loading if logout fails
    } else {
      toast.success("Logged out successfully.");
      // onAuthStateChange will set user to null and isLoading to false
    }
  };
  
  return (
    <AuthContext.Provider value={{ user, session, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  // Provide default/empty values for schoolId and isAdmin for now
  return { ...context, schoolId: null, isAdmin: false }; 
};