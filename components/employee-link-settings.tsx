"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/spinner';
import { useAuth } from '@/lib/auth-context';
import { Link as LinkIcon, UserPlus, Unlink, Check, AlertCircle } from 'lucide-react';

interface LinkableEmployee {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  employee_number?: string;
}

export function EmployeeLinkSettings() {
  const { user, authFetch } = useAuth();

  const [employees, setEmployees] = useState<LinkableEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Current linked employee info
  const [linkedEmployee, setLinkedEmployee] = useState<LinkableEmployee | null>(null);

  // Form state
  const [mode, setMode] = useState<'idle' | 'change' | 'create'>('idle');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authFetch('/api/user-employee-link');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);

        // Find current linked employee if any
        if (user?.employee_id && data.employees) {
          // The linked employee might not be in the "available" list since it's already linked
          // We need to check separately
          const allResponse = await authFetch('/api/employees');
          if (allResponse.ok) {
            const allEmployees = await allResponse.json();
            const linked = Array.isArray(allEmployees)
              ? allEmployees.find((e: any) => e.id === user.employee_id)
              : null;
            setLinkedEmployee(linked || null);
          }
        } else {
          setLinkedEmployee(null);
        }
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to load data');
      }
    } catch (err) {
      console.error('Failed to load employee link data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [authFetch, user?.employee_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLink = async () => {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      let body: any;
      if (mode === 'change') {
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
        // Update localStorage
        if (data.user) {
          localStorage.setItem('auth_user', JSON.stringify(data.user));
        }
        setSuccess('Employee linked successfully. Refreshing...');
        // Reload to refresh auth context
        setTimeout(() => window.location.reload(), 1000);
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

  const startChange = () => {
    setMode('change');
    setSelectedEmployeeId('');
    setError('');
    setSuccess('');
  };

  const startCreate = () => {
    setMode('create');
    setFirstName(user?.full_name?.split(/\s+/)[0] || '');
    setLastName(user?.full_name?.split(/\s+/).slice(1).join(' ') || '');
    setEmail(user?.email || '');
    setError('');
    setSuccess('');
  };

  const cancel = () => {
    setMode('idle');
    setError('');
    setSuccess('');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee Profile Link</CardTitle>
          <CardDescription>Link your user account to an employee profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Profile Link</CardTitle>
        <CardDescription>
          Link your user account to an employee profile for attendance tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current link status */}
        <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
          {linkedEmployee ? (
            <>
              <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  Linked to: {linkedEmployee.first_name} {linkedEmployee.last_name}
                  {linkedEmployee.employee_number ? ` (${linkedEmployee.employee_number})` : ''}
                </p>
                {linkedEmployee.email && (
                  <p className="text-xs text-muted-foreground">{linkedEmployee.email}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <Unlink className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Not linked to any employee profile
              </p>
            </>
          )}
        </div>

        {/* Action buttons when idle */}
        {mode === 'idle' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startChange}>
              <LinkIcon className="h-4 w-4 mr-1" />
              {linkedEmployee ? 'Change Link' : 'Link to Employee'}
            </Button>
            <Button variant="outline" size="sm" onClick={startCreate}>
              <UserPlus className="h-4 w-4 mr-1" />
              Create New Employee
            </Button>
          </div>
        )}

        {/* Select existing employee */}
        {mode === 'change' && (
          <div className="space-y-3 p-3 border rounded-md">
            <Label>Select Employee</Label>
            {employees.length > 0 ? (
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee..." />
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
            ) : (
              <p className="text-sm text-muted-foreground">
                No unlinked employees available in your group. Try creating a new one instead.
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleLink} disabled={saving || !selectedEmployeeId}>
                {saving ? 'Linking...' : 'Link'}
              </Button>
              <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Create new employee */}
        {mode === 'create' && (
          <div className="space-y-3 p-3 border rounded-md">
            <div className="space-y-2">
              <Label htmlFor="link-firstName">First Name</Label>
              <Input
                id="link-firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-lastName">Last Name</Label>
              <Input
                id="link-lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-email">Email (optional)</Label>
              <Input
                id="link-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleLink} disabled={saving || !firstName.trim() || !lastName.trim()}>
                {saving ? 'Creating...' : 'Create & Link'}
              </Button>
              <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md">
            <Check className="h-4 w-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
