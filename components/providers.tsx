'use client';

import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { HelpProvider } from '@/lib/help-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HelpProvider>{children}</HelpProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
