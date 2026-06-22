'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, UserPlus, Link as LinkIcon } from 'lucide-react';
import { Spinner } from '@/components/spinner';

interface LinkableEmployee {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  employee_number?: string;
}

export default function LinkEmployeePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, authFetch, isMaster } = useAuth();

  const [employees, setEmployees] = useState<LinkableEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Link existing employee
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Create new employee
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // Redirect master admins away - they don't need to link
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

  // If user already has an employee_id, redirect home
  useEffect(() => {
    if (!authLoading && user?.employee_id) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  // Load available employees
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadEmployees = async () => {
      try {
        const response = await authFetch('/api/user-employee-link');
        if (response.ok) {
          const data = await response.json();
          setEmployees(data.employees || []);

          // Pre-fill create form with user's name
          if (user) {
            const nameParts = user.full_name.trim().split(/\s+/);
            setFirstName(nameParts[0] || '');
            setLastName(nameParts.slice(1).join(' ') || '');
            setEmail(user.email || '');
          }

          // If no employees available, default to create mode
          if (!data.employees || data.employees.length === 0) {
            setMode('create');
          }
        } else {
          const errData = await response.json();
          setError(errData.error || 'Failed to load employees');
        }
      } catch (err) {
        console.error('Failed to load employees:', err);
        setError('Failed to load employees');
      } finally {
        setLoading(false);
      }
    };

    loadEmployees();
  }, [isAuthenticated, authFetch, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let body: any;
      if (mode === 'select') {
        if (!selectedEmployeeId) {
          setError('Please select an employee');
          setSaving(false);
          return;
        }
        body = { employeeId: parseInt(selectedEmployeeId, 10) };
      } else {
        if (!firstName.trim() || !lastName.trim()) {
          setError('First name and last name are required');
          setSaving(false);
          return;
        }
        body = {
          createNew: true,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
        };
      }

      const response = await authFetch('/api/user-employee-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        // Update localStorage with the new user data (includes employee_id)
        if (data.user) {
          localStorage.setItem('auth_user', JSON.stringify(data.user));
        }
        // Force a full page reload to refresh auth context with new employee_id
        window.location.href = '/';
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to link employee');
      }
    } catch (err) {
      console.error('Failed to link employee:', err);
      setError('Failed to link employee');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
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
          <CardTitle className="text-xl font-bold text-center">Link Your Employee Profile</CardTitle>
          <CardDescription className="text-center">
            To continue, please link your account to an employee profile.
            You can select an existing employee or create a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mode toggle */}
            {employees.length > 0 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mode === 'select' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setMode('select')}
                >
                  <LinkIcon className="h-4 w-4 mr-1" />
                  Select Existing
                </Button>
                <Button
                  type="button"
                  variant={mode === 'create' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setMode('create')}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Create New
                </Button>
              </div>
            )}

            {mode === 'select' && employees.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="employee">Employee</Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your employee profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.first_name} {emp.last_name}
                        {emp.employee_number ? ` (${emp.employee_number})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Linking...' : mode === 'select' ? 'Link to Employee' : 'Create & Link Employee'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
