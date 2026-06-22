'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Clock, TrendingUp, CalendarDays } from 'lucide-react';
import { formatDateStr } from '@/lib/date-helpers';
import { PageLoading } from '@/components/page-loading';
import { getCachedData, setCachedData } from '@/lib/client-cache';

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  employee_number?: string;
}

interface AttendanceEntry {
  id: number;
  employee_id: number;
  entry_date: string;
  time_code: string;
  hours: number;
}

interface TimeCodeSummary {
  code: string;
  count: number;
  totalHours: number;
}

interface EmployeeSummary {
  employee: Employee;
  entryCount: number;
  totalHours: number;
}

interface UpcomingStaffingEntry {
  id: number;
  employee_id: number;
  entry_date: string;
  time_code: string;
  hours: number;
  first_name: string;
  last_name: string;
}

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, authFetch } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [upcomingStaffingData, setUpcomingStaffingData] = useState<UpcomingStaffingEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
      loadDashboardData();
    } else if (!authLoading) {
      router.replace('/login');
      setLoading(false);
    }
  }, [isAuthenticated, authLoading, router]);

  const loadDashboardData = async () => {
    const cachedDashboard = getCachedData<{
      employees: Employee[];
      upcomingStaffingData: UpcomingStaffingEntry[];
    }>('dashboard:data');
    if (cachedDashboard) {
      setEmployees(cachedDashboard.employees);
      setUpcomingStaffingData(cachedDashboard.upcomingStaffingData);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      // Fetch employees and upcoming staffing (available to all authenticated users)
      const [employeesRes, upcomingStaffingRes] = await Promise.all([
        authFetch('/api/employees'),
        authFetch('/api/dashboard/upcoming-staffing?days=5'),
      ]);

      if (employeesRes.status === 401) {
        return;
      }

      const employeesData = await employeesRes.json();
      const upcomingData = upcomingStaffingRes.ok ? await upcomingStaffingRes.json() : [];

      if (Array.isArray(employeesData)) {
        setEmployees(employeesData);
      } else {
        console.error('Invalid employees data:', employeesData);
        setEmployees([]);
      }

      if (Array.isArray(upcomingData)) {
        setUpcomingStaffingData(upcomingData);
      } else {
        console.error('Invalid upcoming staffing data:', upcomingData);
        setUpcomingStaffingData([]);
      }

      setCachedData('dashboard:data', {
        employees: Array.isArray(employeesData) ? employeesData : [],
        upcomingStaffingData: Array.isArray(upcomingData) ? upcomingData : [],
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);

  const timeCodeSummary: TimeCodeSummary[] = entries.reduce((acc, entry) => {
    const existing = acc.find(item => item.code === entry.time_code);
    if (existing) {
      existing.count++;
      existing.totalHours += entry.hours || 0;
    } else {
      acc.push({
        code: entry.time_code,
        count: 1,
        totalHours: entry.hours || 0,
      });
    }
    return acc;
  }, [] as TimeCodeSummary[]);

  timeCodeSummary.sort((a, b) => b.totalHours - a.totalHours);

  const employeeSummaries: EmployeeSummary[] = employees.map(emp => {
    const empEntries = entries.filter(e => e.employee_id === emp.id);
    return {
      employee: emp,
      entryCount: empEntries.length,
      totalHours: empEntries.reduce((sum, e) => sum + (e.hours || 0), 0),
    };
  }).sort((a, b) => b.totalHours - a.totalHours);

  const recentEntries = [...entries]
    .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
    .slice(0, 10);

  // Compute upcoming staffing for the next 5 days
  // Uses dedicated endpoint that returns all employees' staffing data
  const upcomingStaffing = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const next5Days: { date: Date; dateStr: string; dayName: string; entries: { firstName: string; lastName: string; entries: { timeCode: string; hours: number }[]; totalHours: number }[] }[] = [];

    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = formatDateStr(date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      // Group entries by employee
      const entriesByEmployee = upcomingStaffingData
        .filter(entry => entry.entry_date === dateStr)
        .reduce((acc, entry) => {
          const key = `${entry.first_name}-${entry.last_name}`;
          if (!acc[key]) {
            acc[key] = {
              firstName: entry.first_name,
              lastName: entry.last_name,
              entries: [],
              totalHours: 0,
            };
          }
          acc[key].entries.push({ timeCode: entry.time_code, hours: entry.hours });
          acc[key].totalHours += entry.hours;
          return acc;
        }, {} as Record<string, { firstName: string; lastName: string; entries: { timeCode: string; hours: number }[]; totalHours: number }>);

      const dayEntries = Object.values(entriesByEmployee);

      next5Days.push({ date, dateStr, dayName, entries: dayEntries });
    }

    return next5Days;
  })();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen p-3">
        <PageLoading />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen p-3">
        <PageLoading />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3">
      <div className="max-w-full mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, <span className="font-semibold">{user?.full_name}</span>
            </p>
          </div>
          <Link href="/attendance">
            <Button variant="outline" size="sm">
              Go to Attendance →
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
              <p className="text-xs text-muted-foreground">Active employees</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entries.length}</div>
              <p className="text-xs text-muted-foreground">Attendance entries</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">Hours logged</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Time Codes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{timeCodeSummary.length}</div>
              <p className="text-xs text-muted-foreground">Different codes used</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Upcoming Staffing (Next 5 Days)</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {upcomingStaffing.map(day => (
                <div key={day.dateStr} className="border rounded-lg p-3">
                  <div className="font-medium text-sm mb-2">{day.dayName}</div>
                  {day.entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No entries</p>
                  ) : (
                    <div className="space-y-1">
                      {day.entries.map((entry, idx) => (
                        <div key={`${entry.firstName}-${entry.lastName}-${idx}`} className="text-xs">
                          <span className="font-medium">{entry.firstName} {entry.lastName.charAt(0)}.</span>
                          <span className="ml-1 text-muted-foreground">
                            {entry.entries.length === 1
                              ? `(${entry.entries[0].timeCode}${entry.entries[0].hours})`
                              : `(*${entry.totalHours})`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Time Code Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {timeCodeSummary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No time codes used yet</p>
                ) : (
                  timeCodeSummary.map(tc => (
                    <div key={tc.code} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{tc.code}</span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{tc.count} entries</span>
                        <span className="font-semibold text-foreground">{tc.totalHours}h</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employee Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {employeeSummaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No employees found</p>
                ) : (
                  employeeSummaries.map(summary => (
                    <div key={summary.employee.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {summary.employee.first_name} {summary.employee.last_name}
                      </span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{summary.entryCount} entries</span>
                        <span className="font-semibold text-foreground">{summary.totalHours}h</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries found</p>
            ) : (
              <div className="space-y-2">
                {recentEntries.map(entry => {
                  const employee = employees.find(e => e.id === entry.employee_id);
                  return (
                    <div key={entry.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                      <div>
                        <div className="font-medium">
                          {employee ? `${employee.first_name} ${employee.last_name}` : `Employee #${entry.employee_id}`}
                        </div>
                        <div className="text-xs text-muted-foreground">{entry.entry_date}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{entry.time_code}</span>
                        <span className="text-muted-foreground">{entry.hours}h</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
