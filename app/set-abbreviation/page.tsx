'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/spinner';

export default function SetAbbreviationPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, authFetch, isMaster } = useAuth();

  const [abbreviation, setAbbreviation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Redirect master admins away - they don't need to set abbreviation
  useEffect(() => {
    if (!authLoading && isAuthenticated && isMaster) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, isMaster, router]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // If user has no employee_id, they need to link first
  useEffect(() => {
    if (!authLoading && user && !user.employee_id) {
      router.push('/link-employee');
    }
  }, [authLoading, user, router]);

  // If user already has an abbreviation, redirect home
  useEffect(() => {
    if (!authLoading && user?.employee_abbreviation) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = abbreviation.trim().toUpperCase();
    if (!trimmed || trimmed.length > 3) {
      setError('Abbreviation must be 1-3 characters');
      return;
    }

    setSaving(true);

    try {
      const response = await authFetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user!.employee_id,
          abbreviation: trimmed,
        }),
      });

      if (response.ok) {
        // Update localStorage with the new abbreviation
        const storedUser = localStorage.getItem('auth_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          parsed.employee_abbreviation = trimmed;
          localStorage.setItem('auth_user', JSON.stringify(parsed));
        }
        // Force a full page reload to refresh auth context
        window.location.href = '/';
      } else {
        const errData = await response.json().catch(() => null);
        setError(errData?.error || 'Failed to save abbreviation');
      }
    } catch (err) {
      console.error('Failed to save abbreviation:', err);
      setError('Failed to save abbreviation');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl font-bold text-center">Set Your Office Abbreviation</CardTitle>
          <CardDescription className="text-center">
            Choose a unique 1-3 character abbreviation to identify you in the office presence bar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="abbreviation">Abbreviation</Label>
              <Input
                id="abbreviation"
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
                placeholder="e.g. JDS"
                className="text-center text-2xl font-bold tracking-widest"
                disabled={saving}
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                This will be displayed on your office presence button
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={saving || !abbreviation.trim()}>
              {saving ? 'Saving...' : 'Save Abbreviation'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
