'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, KeyRound } from 'lucide-react';

interface FloatingInputProps {
  id: string;
  label: string;
  value: string;
  type?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

function FloatingInput({ id, label, value, type = 'text', onChange, disabled, autoFocus }: FloatingInputProps) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={type}
        value={value}
        placeholder=" "
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="login-floating-input peer h-12 bg-background px-3 py-0 text-base placeholder-transparent shadow-sm shadow-black/10"
      />
      <label
        htmlFor={id}
        className={cn(
          'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded bg-card px-1 text-sm text-muted-foreground transition-all duration-150',
          'peer-focus:top-0 peer-focus:text-xs peer-focus:text-blue-300',
          value && 'top-0 text-xs'
        )}
      >
        {label}
      </label>
    </div>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, authFetch, clearPasswordChangeFlag } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to change password.');
        return;
      }

      clearPasswordChangeFlag();
      router.replace('/');
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-500 px-4">
      <Card className="w-full max-w-md shadow-md shadow-slate-700/10">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-400" />
            <CardTitle className="text-xl">Change Your Password</CardTitle>
          </div>
          <CardDescription>
            {user?.must_change_password === 1
              ? 'Your account requires a password change before you can continue.'
              : 'Choose a new password for your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FloatingInput
              id="current-password"
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              disabled={isSubmitting}
              autoFocus
            />
            <FloatingInput
              id="new-password"
              label="New Password"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              disabled={isSubmitting}
            />
            <FloatingInput
              id="confirm-password"
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              disabled={isSubmitting}
            />

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="h-10 w-full bg-blue-600 text-white shadow-sm shadow-black/20 hover:bg-blue-700 hover:shadow-md"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Set New Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
