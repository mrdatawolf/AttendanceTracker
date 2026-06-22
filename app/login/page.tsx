'use client';

import { useState, useEffect, Suspense, type FormEvent, type InputHTMLAttributes } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { getTheme } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/spinner';

interface FloatingLoginInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  value: string;
}

function FloatingLoginInput({ id, label, value, className, ...props }: FloatingLoginInputProps) {
  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        placeholder=" "
        className={cn(
          "login-floating-input peer h-12 bg-background px-3 py-0 text-base placeholder-transparent shadow-sm shadow-black/10",
          className
        )}
        {...props}
      />
      <label
        htmlFor={id}
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded bg-card px-1 text-sm text-muted-foreground transition-all duration-150",
          "peer-focus:top-0 peer-focus:text-xs peer-focus:text-blue-300",
          value && "top-0 text-xs"
        )}
      >
        {label}
      </label>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { theme: themeId } = useTheme();
  const themeConfig = getTheme(themeId);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if session expired (redirected from authFetch)
  const sessionExpired = searchParams.get('expired') === '1';

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logoSrc = themeConfig.branding.logo || '/default.png';
  const logoAlt = themeConfig.branding.logoAlt || 'Logo';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-500 px-4">
      <Card className="w-full max-w-4xl shadow-md shadow-slate-700/10">
        <div className="grid gap-8 p-6 md:grid-cols-[0.95fr_1.05fr] md:p-8">
          <CardHeader className="items-center justify-center p-0 md:items-start">
            <div className="flex h-28 w-44 items-center justify-center rounded-lg border border-gray-300 bg-gray-200 p-4 shadow-sm md:h-40 md:w-64 md:p-6">
              <div className="relative h-full w-full">
                <Image
                  src={logoSrc}
                  alt={logoAlt}
                  fill
                  priority
                  sizes="(min-width: 768px) 224px, 144px"
                  className="object-contain"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex items-center p-0">
            <form onSubmit={handleSubmit} className="w-full space-y-5">
              <div>
                <FloatingLoginInput
                  id="username"
                  label="Username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  disabled={isLoading}
                />
              </div>
              <div>
                <FloatingLoginInput
                  id="password"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>

              {sessionExpired && !error && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>Your session has expired. Please sign in again.</span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="h-10 w-full bg-blue-600 text-white shadow-sm shadow-black/20 hover:bg-blue-700 hover:shadow-md"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-500">
        <Spinner />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
