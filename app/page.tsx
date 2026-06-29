'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PageLoading } from '@/components/page-loading';

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      const lastPage = localStorage.getItem('last_visited_page');
      if (lastPage && lastPage !== '/') {
        const isAdminOrMaster = user?.group?.is_master === 1 || user?.role_id === 1;
        // Pages that require elevated access
        const adminOnlyPages = ['/users'];
        const needsAdmin = adminOnlyPages.some(p => lastPage.startsWith(p));
        if (needsAdmin && !isAdminOrMaster) {
          localStorage.removeItem('last_visited_page');
          router.replace('/attendance');
          return;
        }
        router.replace(lastPage);
        return;
      }
      router.replace('/dashboard');
    } else if (!authLoading) {
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router, user]);

  return (
    <div className="min-h-screen p-3">
      <PageLoading />
    </div>
  );
}
