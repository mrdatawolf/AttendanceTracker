'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getBrandFeatures, isLogoutOnClose } from './brand-features';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  group_id: number;
  is_superuser?: number; // Deprecated, use role instead
  role_id?: number;
  employee_id?: number;
  employee_abbreviation?: string;
  must_change_password?: number;
  role?: {
    id: number;
    name: string;
    description?: string;
    can_create: number;
    can_read: number;
    can_update: number;
    can_delete: number;
    can_manage_users: number;
    can_access_all_groups: number;
  };
  group: {
    id: number;
    name: string;
    description: string;
    is_master: number;
    can_view_all: number;
    can_edit_all: number;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;

  // GROUP-BASED DATA VISIBILITY: Which employees/data the user can see
  isMaster: boolean;              // User is in the master group (sees all data)
  canViewAll: boolean;            // Group has permission to view all groups
  canEditAll: boolean;            // Group has permission to edit all groups (legacy - consider removing)

  // ROLE-BASED ACTION PERMISSIONS: What operations the user can perform
  isAdministrator: boolean;       // Has Administrator role
  isManager: boolean;             // Has Manager role
  canCreate: boolean;             // Can create new records
  canRead: boolean;               // Can read/view records
  canUpdate: boolean;             // Can update existing records
  canDelete: boolean;             // Can delete records
  canManageUsers: boolean;        // Can create/edit user accounts
  canAccessAllGroups: boolean;    // Role grants access to all groups (overrides group restrictions)

  // EMPLOYEE LINKING
  needsEmployeeLink: boolean;     // User needs to link to an employee before proceeding
  needsAbbreviation: boolean;     // User needs to set their office abbreviation

  // PASSWORD CHANGE
  needsPasswordChange: boolean;   // User must change their password before proceeding
  clearPasswordChangeFlag: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load auth state from localStorage on mount
  useEffect(() => {
    console.log('[Auth] Initializing auth context...');

    // Failsafe: ensure loading state doesn't persist forever
    const timeout = setTimeout(() => {
      console.warn('[Auth] Timeout reached - forcing loading to false');
      setIsLoading(false);
    }, 3000);

    try {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');

      console.log('[Auth] Stored auth data:', {
        hasToken: !!storedToken,
        hasUser: !!storedUser
      });

      if (storedToken && storedUser) {
        console.log('[Auth] Found stored credentials, verifying token...');
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        // Verify token is still valid
        verifyToken(storedToken).finally(() => {
          console.log('[Auth] Token verification complete');
          clearTimeout(timeout);
        });
      } else {
        console.log('[Auth] No stored credentials, setting loading to false');
        setIsLoading(false);
        clearTimeout(timeout);
      }
    } catch (error) {
      // Invalid stored data, clear it
      console.error('[Auth] Failed to parse stored auth data:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setIsLoading(false);
      clearTimeout(timeout);
    }

    return () => clearTimeout(timeout);
  }, []);

  // logoutOnClose: when the brand requires it, clear auth from localStorage
  // whenever the page/app is closed so the next open forces a fresh login.
  useEffect(() => {
    let removeListener: (() => void) | null = null;

    getBrandFeatures().then(features => {
      if (isLogoutOnClose(features)) {
        const handlePageHide = (e: PageTransitionEvent) => {
          if (!e.persisted) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
          }
        };
        window.addEventListener('pagehide', handlePageHide);
        removeListener = () => window.removeEventListener('pagehide', handlePageHide);
      }
    }).catch(() => {});

    return () => { removeListener?.(); };
  }, []);

  const verifyToken = async (authToken: string) => {
    console.log('[Auth] Starting token verification...');
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('[Auth] Fetch timeout - aborting request');
        controller.abort();
      }, 3000);

      console.log('[Auth] Fetching /api/auth/verify...');
      const response = await fetch('/api/auth/verify', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('[Auth] Verify response status:', response.status);

      if (!response.ok) {
        throw new Error('Token verification failed');
      }

      const data = await response.json();
      console.log('[Auth] Token verified successfully');
      setUser(data.user);
      setToken(authToken);
    } catch (error) {
      // Token is invalid or request timed out, clear auth state
      console.error('[Auth] Token verification error:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setToken(null);
      setUser(null);
    } finally {
      console.log('[Auth] Setting isLoading to false');
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('last_visited_page');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  /**
   * Authenticated fetch wrapper that automatically handles session expiry.
   * If the API returns 401 (Unauthorized), the user is logged out and redirected to login.
   */
  const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle session expiry - redirect to login
    if (response.status === 401) {
      console.warn('[Auth] Session expired - redirecting to login');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setToken(null);
      setUser(null);
      router.push('/login?expired=1');
      // Return the response so caller can handle it if needed
    }

    return response;
  };

  // Redirect unlinked non-master users to the employee linking page
  const needsEmployeeLink = !!user && !user.employee_id && user.group?.is_master !== 1;
  // Redirect linked users without abbreviation to set it (master admins exempt)
  const needsAbbreviation = !!user && !!user.employee_id && !user.employee_abbreviation && user.group?.is_master !== 1;
  // User must change their password before proceeding (applies to all users)
  const needsPasswordChange = !!user && user.must_change_password === 1;

  const clearPasswordChangeFlag = () => {
    if (!user) return;
    const updated = { ...user, must_change_password: 0 };
    setUser(updated);
    localStorage.setItem('auth_user', JSON.stringify(updated));
  };

  useEffect(() => {
    if (!isLoading && needsPasswordChange && pathname !== '/change-password' && pathname !== '/login') {
      router.push('/change-password');
    } else if (!isLoading && needsEmployeeLink && pathname !== '/link-employee' && pathname !== '/login' && pathname !== '/change-password') {
      router.push('/link-employee');
    } else if (!isLoading && needsAbbreviation && pathname !== '/set-abbreviation' && pathname !== '/link-employee' && pathname !== '/login' && pathname !== '/change-password') {
      router.push('/set-abbreviation');
    }
  }, [isLoading, needsPasswordChange, needsEmployeeLink, needsAbbreviation, pathname, router]);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    logout,
    authFetch,
    isAuthenticated: !!user && !!token,
    // Group-based data visibility (which employees/groups you can see)
    isMaster: user?.group?.is_master === 1,
    canViewAll: user?.group?.can_view_all === 1 || user?.group?.is_master === 1,
    canEditAll: user?.group?.can_edit_all === 1 || user?.group?.is_master === 1,
    // Role-based action permissions (what operations you can perform)
    isAdministrator: user?.role_id === 1,
    isManager: user?.role_id === 2,
    canCreate: user?.role?.can_create === 1,
    canRead: user?.role?.can_read === 1,
    canUpdate: user?.role?.can_update === 1,
    canDelete: user?.role?.can_delete === 1,
    canManageUsers: user?.role?.can_manage_users === 1,
    canAccessAllGroups: user?.role?.can_access_all_groups === 1,
    // Employee linking
    needsEmployeeLink,
    needsAbbreviation,
    // Password change
    needsPasswordChange,
    clearPasswordChangeFlag,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
