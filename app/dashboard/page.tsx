"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Users, Calendar, Clock, TrendingUp, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { config } from '@/lib/config';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useHelp } from '@/lib/help-context';
import { HelpArea } from '@/components/help-area';
import { AttendanceForecastWidget } from '@/components/attendance-forecast-widget';
import { BreakEntryWidget } from '@/components/break-entry-widget';
import { formatDateStr, getLocalToday, parseDateStr } from '@/lib/date-helpers';
import { PageLoading } from '@/components/page-loading';
import { getCachedData, setCachedData } from '@/lib/client-cache';

const PAGE_SIZE = 5;

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  employee_number?: string;
  group_id?: number;
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

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: authLoading, authFetch, user } = useAuth();
  const { setCurrentScreen } = useHelp();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [upcomingStaffingData, setUpcomingStaffingData] = useState<UpcomingStaffingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tcPage, setTcPage] = useState(0);
  const [empPage, setEmpPage] = useState(0);

  // Set the current screen for help context
  useEffect(() => {
    setCurrentScreen('dashboard');
  }, [setCurrentScreen]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated && pathname === '/dashboard') {
      loadDashboardData();
    }
  }, [isAuthenticated, pathname]);

  const loadDashboardData = async () => {
    if (!isAuthenticated) {
      console.warn('Cannot load dashboard data: not authenticated');
      return;
    }

    const cachedDashboard = getCachedData<{
      employees: Employee[];
      upcomingStaffingData: UpcomingStaffingEntry[];
      entries: AttendanceEntry[];
    }>('dashboard:data');
    if (cachedDashboard) {
      setEmployees(cachedDashboard.employees);
      setUpcomingStaffingData(cachedDashboard.upcomingStaffingData);
      setEntries(cachedDashboard.entries ?? []);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const todayStr = getLocalToday();
      const endDate = new Date(parseDateStr(todayStr));
      endDate.setDate(endDate.getDate() + 4);
      const endDateStr = formatDateStr(endDate);

      const [employeesRes, upcomingStaffingRes, entriesRes] = await Promise.all([
        authFetch('/api/employees'),
        authFetch('/api/dashboard/upcoming-staffing?days=5'),
        authFetch(`/api/attendance?startDate=${todayStr}&endDate=${endDateStr}`),
      ]);

      if (employeesRes.status === 401) {
        return;
      }

      const employeesData = await employeesRes.json();
      const upcomingData = upcomingStaffingRes.ok ? await upcomingStaffingRes.json() : [];
      const entriesData = entriesRes.ok ? await entriesRes.json() : [];

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

      if (Array.isArray(entriesData)) {
        setEntries(entriesData);
      } else {
        setEntries([]);
      }

      setCachedData('dashboard:data', {
        employees: Array.isArray(employeesData) ? employeesData : [],
        upcomingStaffingData: Array.isArray(upcomingData) ? upcomingData : [],
        entries: Array.isArray(entriesData) ? entriesData : [],
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
      acc.push({ code: entry.time_code, count: 1, totalHours: entry.hours || 0 });
    }
    return acc;
  }, [] as TimeCodeSummary[]).sort((a, b) => b.totalHours - a.totalHours);

  const tcTotalPages = Math.max(1, Math.ceil(timeCodeSummary.length / PAGE_SIZE));
  const tcSafePage = Math.min(tcPage, tcTotalPages - 1);
  const tcPagedRows = timeCodeSummary.slice(tcSafePage * PAGE_SIZE, (tcSafePage + 1) * PAGE_SIZE);

  const employeeSummaries: EmployeeSummary[] = employees.map(emp => {
    const empEntries = entries.filter(e => e.employee_id === emp.id);
    return {
      employee: emp,
      entryCount: empEntries.length,
      totalHours: empEntries.reduce((sum, e) => sum + (e.hours || 0), 0),
    };
  }).filter(s => s.entryCount > 0).sort((a, b) => b.totalHours - a.totalHours);

  const empTotalPages = Math.max(1, Math.ceil(employeeSummaries.length / PAGE_SIZE));
  const empSafePage = Math.min(empPage, empTotalPages - 1);
  const empPagedRows = employeeSummaries.slice(empSafePage * PAGE_SIZE, (empSafePage + 1) * PAGE_SIZE);

  const periodEntries = [...entries]
    .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());

  // Compute upcoming staffing for the next 5 days
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

  const dashboardEmployee = user?.employee_id
    ? employees.find(e => e.id === user.employee_id)
    : null;

  if (!config.features.enableDashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Dashboard Disabled</h1>
          <p className="text-muted-foreground">
            The dashboard feature is currently disabled.
            <code className="text-sm bg-muted px-2 py-1 rounded">lib/config.ts</code> and set{' '}
            <code className="text-sm bg-muted px-2 py-1 rounded">features.enableDashboard</code> to{' '}
            <code className="text-sm bg-muted px-2 py-1 rounded">true</code>.
          </p>
          <Link href="/attendance" className="inline-block text-blue-600 hover:underline">
            ← Go back to Attendance
          </Link>
        </div>
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen p-3">
        <PageLoading label="Loading dashboard..." />
      </div>
    );
  }

  // Don't render if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen p-3">
      <div className="max-w-full mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Dashboard</h1>
          <Link href="/attendance" className="text-sm text-blue-600 hover:underline">
            Go to Attendance →
          </Link>
        </div>

        <HelpArea helpId="stats-cards" bubblePosition="bottom">
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
                <p className="text-xs text-muted-foreground">Next 5 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Next 5 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Time Codes</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{timeCodeSummary.length}</div>
                <p className="text-xs text-muted-foreground">Next 5 days</p>
              </CardContent>
            </Card>
          </div>
        </HelpArea>

        {/* Attendance Forecast and Break Tracking Widgets */}
        <div className={`grid grid-cols-1 gap-3 ${dashboardEmployee ? 'lg:grid-cols-2' : ''}`}>
          <AttendanceForecastWidget />
          {dashboardEmployee && <BreakEntryWidget employeeId={dashboardEmployee.id} />}
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <HelpArea helpId="time-code-usage" bubblePosition="right">
                <CardTitle className="text-base cursor-help">Time Code Usage <span className="text-xs font-normal text-muted-foreground">(Next 5 Days)</span></CardTitle>
              </HelpArea>
              {timeCodeSummary.length > PAGE_SIZE && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{tcSafePage + 1}/{tcTotalPages}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTcPage(p => Math.max(0, p - 1))} disabled={tcSafePage === 0}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTcPage(p => Math.min(tcTotalPages - 1, p + 1))} disabled={tcSafePage >= tcTotalPages - 1}>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {timeCodeSummary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No time codes used in this period</p>
                ) : (
                  tcPagedRows.map(tc => (
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <HelpArea helpId="employee-summary" bubblePosition="left">
                <CardTitle className="text-base cursor-help">Employee Summary <span className="text-xs font-normal text-muted-foreground">(Next 5 Days)</span></CardTitle>
              </HelpArea>
              {employeeSummaries.length > PAGE_SIZE && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{empSafePage + 1}/{empTotalPages}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEmpPage(p => Math.max(0, p - 1))} disabled={empSafePage === 0}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEmpPage(p => Math.min(empTotalPages - 1, p + 1))} disabled={empSafePage >= empTotalPages - 1}>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {employeeSummaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No employees found</p>
                ) : (
                  empPagedRows.map(summary => (
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
            <HelpArea helpId="recent-entries" bubblePosition="bottom">
              <CardTitle className="text-base cursor-help">Entries (Next 5 Days)</CardTitle>
            </HelpArea>
          </CardHeader>
          <CardContent>
            {periodEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries in this period</p>
            ) : (
              <div className="space-y-2">
                {periodEntries.map(entry => {
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
