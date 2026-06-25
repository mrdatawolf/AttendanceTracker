'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Calendar, Eye, EyeOff, Clock, RotateCcw, Search } from 'lucide-react';
import { EmployeeAllocationsDialog } from '@/components/employee-allocations-dialog';
import { getBrandFeatures, type BrandFeatures } from '@/lib/brand-features';
import { useHelp } from '@/lib/help-context';
import { HelpArea } from '@/components/help-area';
import { parseDateStr } from '@/lib/date-helpers';
import { PageLoading } from '@/components/page-loading';
import { clearCachedDataByPrefix, getCachedData, setCachedData } from '@/lib/client-cache';

interface Employee {
  id: number;
  employee_number?: string;
  first_name: string;
  last_name: string;
  email?: string;
  role: string;
  group_id?: number;
  date_of_hire?: string;
  rehire_date?: string;
  employment_type?: string;
  seniority_rank?: number;
  abbreviation?: string;
  show_in_office_presence?: number;
  is_salaried_psl?: number;
  created_by?: number;
  is_active: number;
}

interface Group {
  id: number;
  name: string;
  description: string;
}

interface JobTitle {
  id: number;
  name: string;
  description?: string;
  is_active: number;
}

export default function UsersPage() {
  const { user, isAuthenticated, isLoading: authLoading, authFetch } = useAuth();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [allocationsDialogOpen, setAllocationsDialogOpen] = useState(false);
  const [selectedEmployeeForAllocations, setSelectedEmployeeForAllocations] = useState<Employee | null>(null);
  const [brandFeatures, setBrandFeatures] = useState<BrandFeatures | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Check if leave management is enabled for this brand
  const leaveManagementEnabled = brandFeatures?.features?.leaveManagement?.enabled ?? false;
  const officePresenceEnabled = brandFeatures?.features?.officePresenceTracking?.enabled ?? false;
  const isAdmin = user?.group?.is_master === 1 || user?.role_id === 1;

  // Set the current screen for help context
  const { setCurrentScreen } = useHelp();
  useEffect(() => {
    setCurrentScreen('employees');
  }, [setCurrentScreen]);

  const [formData, setFormData] = useState({
    employee_number: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'Employee',
    group_id: '',
    date_of_hire: '',
    rehire_date: '',
    employment_type: 'full_time',
    seniority_rank: '',
    abbreviation: '',
    show_in_office_presence: '1',
    is_salaried_psl: '0',
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Load brand features on mount
  useEffect(() => {
    getBrandFeatures().then(setBrandFeatures);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadAllData();
    }
  }, [isAuthenticated, showInactive]);

  const loadAllData = async () => {
    const empCacheKey = `employees:list:${showInactive}`;
    const groupsCacheKey = 'employees:groups';
    const jobTitlesCacheKey = 'employees:job-titles';

    const cachedEmployees = getCachedData<Employee[]>(empCacheKey);
    const cachedGroups = getCachedData<Group[]>(groupsCacheKey);
    const cachedJobTitles = getCachedData<JobTitle[]>(jobTitlesCacheKey);

    if (cachedEmployees && cachedGroups && cachedJobTitles) {
      setEmployees(cachedEmployees);
      setGroups(cachedGroups);
      setJobTitles(cachedJobTitles);
      setIsLoading(false);
    }

    try {
      const empUrl = showInactive ? '/api/employees?includeInactive=true' : '/api/employees';
      const [empRes, groupsRes, jobTitlesRes] = await Promise.all([
        authFetch(empUrl),
        authFetch('/api/groups'),
        authFetch('/api/job-titles?active=true'),
      ]);

      if (empRes.status === 401) return;

      const [empData, groupsData, jobTitlesData] = await Promise.all([
        empRes.ok ? empRes.json() : [],
        groupsRes.ok ? groupsRes.json() : [],
        jobTitlesRes.ok ? jobTitlesRes.json() : [],
      ]);

      setEmployees(Array.isArray(empData) ? empData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setJobTitles(Array.isArray(jobTitlesData) ? jobTitlesData : []);

      setCachedData(empCacheKey, Array.isArray(empData) ? empData : []);
      setCachedData(groupsCacheKey, Array.isArray(groupsData) ? groupsData : []);
      setCachedData(jobTitlesCacheKey, Array.isArray(jobTitlesData) ? jobTitlesData : []);
    } catch (error) {
      console.error('Failed to load employees data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAllocationsDialog = (employee: Employee) => {
    setSelectedEmployeeForAllocations(employee);
    setAllocationsDialogOpen(true);
  };

  const handleOpenDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        employee_number: employee.employee_number || '',
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email || '',
        role: employee.role,
        group_id: employee.group_id?.toString() || '',
        date_of_hire: employee.date_of_hire || '',
        rehire_date: employee.rehire_date || '',
        employment_type: employee.employment_type || 'full_time',
        seniority_rank: employee.seniority_rank?.toString() || '',
        abbreviation: employee.abbreviation || '',
        show_in_office_presence: (employee.show_in_office_presence ?? 1).toString(),
        is_salaried_psl: (employee.is_salaried_psl ?? 0).toString(),
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        employee_number: '',
        first_name: '',
        last_name: '',
        email: '',
        role: 'Employee',
        group_id: '',
        date_of_hire: '',
        rehire_date: '',
        employment_type: 'full_time',
        seniority_rank: '',
        abbreviation: '',
        show_in_office_presence: '1',
        is_salaried_psl: '0',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEmployee(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      group_id: formData.group_id ? parseInt(formData.group_id) : null,
      date_of_hire: formData.date_of_hire || null,
      rehire_date: formData.rehire_date || null,
      employment_type: formData.employment_type || 'full_time',
      seniority_rank: formData.seniority_rank ? parseInt(formData.seniority_rank) : null,
      abbreviation: formData.abbreviation || null,
      show_in_office_presence: parseInt(formData.show_in_office_presence),
      is_salaried_psl: parseInt(formData.is_salaried_psl),
    };

    try {
      if (editingEmployee) {
        // Update employee
        const response = await authFetch('/api/employees', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: editingEmployee.id,
            ...payload,
          }),
        });

        if (response.status === 401) return;

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || 'Failed to update employee');
        }
      } else {
        // Create employee
        const response = await authFetch('/api/employees', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 401) return;

        if (response.status === 409) {
          const errData = await response.json().catch(() => null);
          if (errData?.error === 'inactive_duplicate' && errData.existingEmployee) {
            const existing = errData.existingEmployee;
            const reactivate = confirm(
              `An inactive employee with this email already exists: ${existing.first_name} ${existing.last_name}.\n\nWould you like to reactivate them instead?`
            );
            if (reactivate) {
              const reactivateResponse = await authFetch('/api/employees', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: existing.id, is_active: 1 }),
              });
              if (reactivateResponse.ok) {
                clearCachedDataByPrefix('employees:list:');
                handleCloseDialog();
                loadAllData();
              } else {
                throw new Error('Failed to reactivate employee');
              }
            }
            return;
          }
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || 'Failed to create employee');
        }
      }

      handleCloseDialog();
      clearCachedDataByPrefix('employees:list:');
      loadAllData();
    } catch (error: any) {
      console.error('Failed to save employee:', error);
      alert(error.message || 'Failed to save employee');
    }
  };

  const handleDelete = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to deactivate ${employee.first_name} ${employee.last_name}?`)) {
      return;
    }

    try {
      const response = await authFetch(`/api/employees?id=${employee.id}`, {
        method: 'DELETE',
      });

      if (response.status === 401) return;

      if (!response.ok) {
        throw new Error('Failed to delete employee');
      }

      clearCachedDataByPrefix('employees:list:');
      loadAllData();
    } catch (error) {
      console.error('Failed to delete employee:', error);
      alert('Failed to delete employee');
    }
  };

  const handleReactivate = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to reactivate ${employee.first_name} ${employee.last_name}?`)) {
      return;
    }

    try {
      const response = await authFetch('/api/employees', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: employee.id,
          is_active: 1,
        }),
      });

      if (response.status === 401) return;

      if (!response.ok) {
        throw new Error('Failed to reactivate employee');
      }

      clearCachedDataByPrefix('employees:list:');
      loadAllData();
    } catch (error) {
      console.error('Failed to reactivate employee:', error);
      alert('Failed to reactivate employee');
    }
  };

  const handlePermanentDelete = async (employee: Employee) => {
    if (!confirm(
      `PERMANENTLY delete ${employee.first_name} ${employee.last_name}?\n\nThis will remove all their attendance records and cannot be undone.`
    )) {
      return;
    }

    try {
      const response = await authFetch(`/api/employees?id=${employee.id}&permanent=true`, {
        method: 'DELETE',
      });

      if (response.status === 401) return;

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to permanently delete employee');
      }

      clearCachedDataByPrefix('employees:list:');
      loadAllData();
    } catch (error: any) {
      console.error('Failed to permanently delete employee:', error);
      alert(error.message || 'Failed to permanently delete employee');
    }
  };

  // Check if current user can edit a given employee
  const canEditEmployee = (employee: Employee): boolean => {
    if (!user || !user.group) return false;
    if (user.group.is_master) return true;
    if (isAdmin) return true;
    if (user.group.can_edit_all) return true;
    if (employee.group_id && employee.group_id === user.group_id) return true;
    return false;
  };

  // Check if current user can delete a given employee
  const canDeleteEmployee = (employee: Employee): boolean => {
    if (!user || !user.group) return false;
    if (user.group.is_master) return true;
    if (isAdmin) return true;
    if (employee.created_by && employee.created_by === user.id) return true;
    if (user.group.can_edit_all) return true;
    if (employee.group_id && employee.group_id === user.group_id) return true;
    return false;
  };

  // Check if current user can create new employees
  const canCreateEmployee = (): boolean => {
    if (!user || !user.group) return false;
    if (user.group.is_master) return true;
    if (isAdmin) return true;
    if (user.group.can_edit_all) return true;
    return false;
  };

  const filteredEmployees = searchQuery.trim()
    ? employees.filter(emp => {
        const q = searchQuery.toLowerCase();
        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
        const groupName = emp.group_id ? groups.find(g => g.id === emp.group_id)?.name?.toLowerCase() ?? '' : '';
        return (
          fullName.includes(q) ||
          (emp.employee_number?.toLowerCase() ?? '').includes(q) ||
          (emp.email?.toLowerCase() ?? '').includes(q) ||
          emp.role.toLowerCase().includes(q) ||
          groupName.includes(q)
        );
      })
    : employees;

  if (authLoading || isLoading || brandFeatures === null) {
    return (
      <div className="container mx-auto p-8">
        <PageLoading label="Loading employees..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <HelpArea helpId="employees-overview" bubblePosition="right">
          <div>
            <h1 className="text-3xl font-bold">Employee Management</h1>
            <p className="text-muted-foreground">Manage employee records and information</p>
          </div>
        </HelpArea>
        <div className="flex gap-2">
          {user?.group?.is_master === 1 && (
            <Button
              variant="outline"
              onClick={() => setShowInactive(!showInactive)}
              className="gap-2"
            >
              {showInactive ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Hide Inactive
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Show Inactive
                </>
              )}
            </Button>
          )}
          {canCreateEmployee() && (
            <HelpArea helpId="add-employee" bubblePosition="left">
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Employee
              </Button>
            </HelpArea>
          )}
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by name, number, email, job title, or group..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee #</TableHead>
              <TableHead>Name</TableHead>
              {officePresenceEnabled && <TableHead>Abbrev</TableHead>}
              <TableHead>Email</TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Group</TableHead>
              {leaveManagementEnabled && <TableHead>Employment</TableHead>}
              <TableHead>Date of Hire</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7 + (leaveManagementEnabled ? 1 : 0) + (officePresenceEnabled ? 1 : 0)} className="text-center text-muted-foreground">
                  {searchQuery.trim() ? 'No employees match your search' : 'No employees found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => (
                <TableRow
                  key={employee.id}
                  className={employee.is_active === 0 ? 'opacity-50 bg-muted/30' : ''}
                >
                  <TableCell className="font-mono">
                    {employee.employee_number || '-'}
                    {employee.is_active === 0 && (
                      <span className="ml-2 text-xs text-muted-foreground italic">(Inactive)</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {employee.first_name} {employee.last_name}
                  </TableCell>
                  {officePresenceEnabled && (
                    <TableCell className="font-mono text-xs">
                      {employee.abbreviation || '-'}
                    </TableCell>
                  )}
                  <TableCell>{employee.email || '-'}</TableCell>
                  <TableCell className="capitalize">{employee.role}</TableCell>
                  <TableCell>
                    {employee.group_id
                      ? groups.find((g) => g.id === employee.group_id)?.name || '-'
                      : '-'}
                  </TableCell>
                  {leaveManagementEnabled && (
                    <TableCell className="capitalize">
                      {employee.employment_type?.replace('_', '-') || 'Full-time'}
                    </TableCell>
                  )}
                  <TableCell>
                    {employee.date_of_hire
                      ? parseDateStr(employee.date_of_hire).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canEditEmployee(employee) && employee.is_active === 1 && (
                        <HelpArea helpId="edit-employee" bubblePosition="left" showHighlight={false}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(employee)}
                            title="Edit Employee"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </HelpArea>
                      )}
                      {canEditEmployee(employee) && employee.is_active === 1 && (
                        <HelpArea helpId="allocations" bubblePosition="left" showHighlight={false}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenAllocationsDialog(employee)}
                            title="Manage Time Allocations"
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        </HelpArea>
                      )}
                      {canDeleteEmployee(employee) && employee.is_active === 1 && (
                        <HelpArea helpId="delete-employee" bubblePosition="left" showHighlight={false}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(employee)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </HelpArea>
                      )}
                      {employee.is_active === 0 && canDeleteEmployee(employee) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReactivate(employee)}
                          className="text-green-600 hover:text-green-700"
                          title="Reactivate Employee"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      {employee.is_active === 0 && user?.group?.is_master === 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePermanentDelete(employee)}
                          className="text-red-600 hover:text-red-700"
                          title="Permanently Delete Employee"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {employee.is_active === 0 && !canDeleteEmployee(employee) && (
                        <span className="text-xs text-muted-foreground italic">Inactive</span>
                      )}
                      {employee.is_active === 1 && !canEditEmployee(employee) && !canDeleteEmployee(employee) && (
                        <span className="text-xs text-muted-foreground italic">No access</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Edit Employee' : 'Add Employee'}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee
                ? 'Update employee information below.'
                : 'Enter employee information below.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee_number">Employee Number</Label>
                <Input
                  id="employee_number"
                  value={formData.employee_number}
                  onChange={(e) =>
                    setFormData({ ...formData, employee_number: e.target.value })
                  }
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="group_id">Group</Label>
                <Select
                  value={formData.group_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, group_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Optional"
              />
            </div>

            {officePresenceEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="abbreviation">Abbreviation</Label>
                  <Input
                    id="abbreviation"
                    value={formData.abbreviation}
                    onChange={(e) =>
                      setFormData({ ...formData, abbreviation: e.target.value.toUpperCase().slice(0, 3) })
                    }
                    maxLength={3}
                    placeholder="e.g. JDS"
                  />
                  <p className="text-xs text-muted-foreground">Unique 1-3 character ID for office presence bar</p>
                </div>

                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="show_in_office_presence">Show in Office Presence</Label>
                    <Select
                      value={formData.show_in_office_presence}
                      onValueChange={(value) =>
                        setFormData({ ...formData, show_in_office_presence: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Shown</SelectItem>
                        <SelectItem value="0">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Hide C-suite or remote employees from office bar</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Job Title</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select job title" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobTitles.map((jt) => (
                      <SelectItem key={jt.id} value={jt.name}>
                        {jt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_of_hire">Date of Hire</Label>
                <Input
                  id="date_of_hire"
                  type="date"
                  value={formData.date_of_hire}
                  onChange={(e) =>
                    setFormData({ ...formData, date_of_hire: e.target.value })
                  }
                />
              </div>
            </div>

            {leaveManagementEnabled && (
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employment_type">Employment Type</Label>
                  <Select
                    value={formData.employment_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, employment_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full-time</SelectItem>
                      <SelectItem value="part_time">Part-time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rehire_date">Rehire Date</Label>
                  <Input
                    id="rehire_date"
                    type="date"
                    value={formData.rehire_date}
                    onChange={(e) =>
                      setFormData({ ...formData, rehire_date: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seniority_rank">Seniority Rank (1-5)</Label>
                  <Input
                    id="seniority_rank"
                    type="number"
                    min="1"
                    max="5"
                    value={formData.seniority_rank}
                    onChange={(e) =>
                      setFormData({ ...formData, seniority_rank: e.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="is_salaried_psl">Salaried (calculate PSL balance)</Label>
                  <Select
                    value={formData.is_salaried_psl}
                    onValueChange={(value) =>
                      setFormData({ ...formData, is_salaried_psl: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No (Check ADP)</SelectItem>
                      <SelectItem value="1">Yes (calculated balance)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingEmployee ? 'Update' : 'Create'} Employee
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {selectedEmployeeForAllocations && (
        <EmployeeAllocationsDialog
          open={allocationsDialogOpen}
          onOpenChange={setAllocationsDialogOpen}
          employeeId={selectedEmployeeForAllocations.id}
          employeeName={`${selectedEmployeeForAllocations.first_name} ${selectedEmployeeForAllocations.last_name}`}
        />
      )}
    </div>
  );
}
