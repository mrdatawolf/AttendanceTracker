"use client";

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AttendanceGridYear } from '@/components/attendance-grid';
import { AttendanceGridMonth } from '@/components/attendance-grid-month';
import { AttendanceGridWeek } from '@/components/attendance-grid-week';
import { AttendanceGridYearCalendar } from '@/components/attendance-grid-year-calendar';
import { ViewToggle } from '@/components/view-toggle';
import type { AttendanceEntry, DailySummary, ViewType, EntryChangeResult } from '@/lib/attendance-types';
import { formatDateStr, parseDateStr, getWeekBounds, getWeekDates, navigatePeriod, getPeriodLabel } from '@/lib/date-helpers';
import { useMediaQuery } from '@/hooks/use-media-query';
import { BalanceCards } from '@/components/balance-cards';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/spinner';
import { Label } from '@/components/ui/label';
import { UserPlus, CalendarRange } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { getTheme } from '@/lib/themes';
import { useAuth } from '@/lib/auth-context';
import { useHelp } from '@/lib/help-context';
import { HelpArea } from '@/components/help-area';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getBrandFeatures, getCompanyHolidayDates, isGlobalReadAccessEnabled, getAttendanceYearLayout, getBulkEntryConfig } from '@/lib/brand-features';
import { BulkEntryDialog } from '@/components/bulk-entry-dialog';
import { PageLoading } from '@/components/page-loading';
import { clearCachedDataByPrefix, getCachedData, setCachedData } from '@/lib/client-cache';

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  employee_number?: string;
  email?: string;
  group_id?: number;
  is_active?: number;
}

interface Group {
  id: number;
  name: string;
  is_master?: number;
}

interface TimeCode {
  id: number;
  code: string;
  description: string;
  hours_limit?: number;
}

interface TimeAllocation {
  time_code: string;
  description: string;
  default_allocation: number | null;
  allocated_hours: number | null;
  is_override: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function getWeekLabelNoYear(date: Date): string {
  const dates = getWeekDates(date);
  const mon = dates[0];
  const sun = dates[6];
  const monM = SHORT_MONTH_NAMES[mon.getMonth()];
  const sunM = SHORT_MONTH_NAMES[sun.getMonth()];
  if (mon.getFullYear() !== sun.getFullYear()) {
    return `${monM} ${mon.getDate()}, ${mon.getFullYear()} – ${sunM} ${sun.getDate()}, ${sun.getFullYear()}`;
  }
  if (mon.getMonth() !== sun.getMonth()) {
    return `${monM} ${mon.getDate()} – ${sunM} ${sun.getDate()}`;
  }
  return `${monM} ${mon.getDate()} – ${sun.getDate()}`;
}

function getWeeksInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const day = firstDay.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(firstDay.getDate() + diffToMonday);
  const weeks: Date[] = [];
  const cursor = new Date(firstMonday);
  while (cursor <= lastDay) {
    weeks.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function getInitialView(searchParams: URLSearchParams): ViewType {
  const urlView = searchParams.get('view') as ViewType;
  if (urlView && ['year', 'month', 'week'].includes(urlView)) return urlView;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('attendance_view') as ViewType;
    if (stored && ['year', 'month', 'week'].includes(stored)) return stored;
  }
  return 'year';
}

function getInitialDate(searchParams: URLSearchParams): Date {
  const monthParam = searchParams.get('month');
  const weekParam = searchParams.get('week');
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    return parseDateStr(monthParam + '-01');
  }
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    return parseDateStr(weekParam);
  }
  return new Date();
}

function AttendanceContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading, authFetch } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timeCodes, setTimeCodes] = useState<TimeCode[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [allocations, setAllocations] = useState<TimeAllocation[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>();
  const [year, setYear] = useState(() => {
    const initialDate = getInitialDate(searchParams);
    return initialDate.getFullYear();
  });
  const [loading, setLoading] = useState(true);
  const [entriesReady, setEntriesReady] = useState(false);
  const [companyHolidays, setCompanyHolidays] = useState<Set<string>>(new Set());
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [totalActiveEmployees, setTotalActiveEmployees] = useState<number>(0);
  const [maxOutOfOffice, setMaxOutOfOffice] = useState<number>(0);
  const [capacityWarningCount, setCapacityWarningCount] = useState<number>(3);
  const [capacityCriticalCount, setCapacityCriticalCount] = useState<number>(5);
  const [globalReadEnabled, setGlobalReadEnabled] = useState(false);
  const [yearLayout, setYearLayout] = useState<'table' | 'calendar'>('table');
  const [bulkEntryOpen, setBulkEntryOpen] = useState(false);
  const [bulkEntryEnabled, setBulkEntryEnabled] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedInactive, setSelectedInactive] = useState(false);
  const [inactiveEmployees, setInactiveEmployees] = useState<Employee[]>([]);
  const [allEmployeesEntries, setAllEmployeesEntries] = useState<AttendanceEntry[]>([]);
  const { toast } = useToast();
  const { theme: themeId } = useTheme();
  const themeConfig = getTheme(themeId);
  const { setCurrentScreen } = useHelp();

  // View state
  const [view, setView] = useState<ViewType>(() => getInitialView(searchParams));
  const [currentDate, setCurrentDate] = useState<Date>(() => getInitialDate(searchParams));

  // Responsive auto-switch: year → week on small screens
  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    if (isSmallScreen && view === 'year') {
      setView('week');
    }
  }, [isSmallScreen]);

  // Sync view + period to localStorage and URL
  useEffect(() => {
    localStorage.setItem('attendance_view', view);

    const params = new URLSearchParams();
    params.set('view', view);
    if (view === 'month') {
      const m = String(currentDate.getMonth() + 1).padStart(2, '0');
      params.set('month', `${currentDate.getFullYear()}-${m}`);
    } else if (view === 'week') {
      const { start } = getWeekBounds(currentDate);
      params.set('week', start);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [view, currentDate, pathname, router]);

  // Set the current screen for help context
  useEffect(() => {
    setCurrentScreen('attendance');
  }, [setCurrentScreen]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedEmployeeId && !viewAll && isAuthenticated) {
      setEntriesReady(false);
      loadAttendanceData();
    }
  }, [selectedEmployeeId, year, isAuthenticated, viewAll]);

  useEffect(() => {
    if (viewAll && isAuthenticated) {
      setEntriesReady(false);
      loadAllEmployeesData();
    }
  }, [viewAll, year, isAuthenticated]);

  // Lazily fetch inactive employees when the "Inactive" filter is selected
  useEffect(() => {
    if (!selectedInactive || !isAuthenticated || user?.group?.is_master !== 1) return;

    (async () => {
      try {
        const res = await authFetch('/api/employees?includeInactive=true');
        if (res.status === 401) return;
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setInactiveEmployees(data.filter((e: Employee) => e.is_active === 0));
          }
        }
      } catch (error) {
        console.error('Failed to load inactive employees:', error);
      }
    })();
  }, [selectedInactive, isAuthenticated]);

  // Reload company holidays when year changes
  useEffect(() => {
    const loadHolidays = async () => {
      const brandFeatures = await getBrandFeatures();
      const holidays = getCompanyHolidayDates(brandFeatures, year);
      setCompanyHolidays(holidays);
    };
    loadHolidays();
  }, [year]);

  // Reload data when navigating to attendance page
  useEffect(() => {
    if (pathname === '/attendance' && isAuthenticated) {
      if (viewAll) {
        loadAllEmployeesData();
      } else if (selectedEmployeeId) {
        loadAttendanceData();
      }
    }
  }, [pathname]);

  // Re-fetch daily summary when office presence is toggled (via navbar buttons)
  useEffect(() => {
    const handlePresenceChange = () => {
      if (selectedEmployeeId && isAuthenticated && globalReadEnabled) {
        clearCachedDataByPrefix(`attendance:data:${selectedEmployeeId}:`);
        loadAttendanceData();
      }
    };
    window.addEventListener('office-presence-changed', handlePresenceChange);
    return () => window.removeEventListener('office-presence-changed', handlePresenceChange);
  }, [selectedEmployeeId, isAuthenticated, globalReadEnabled]);

  const loadInitialData = async () => {
    if (!isAuthenticated) {
      console.warn('Cannot load initial data: not authenticated');
      return;
    }

    try {
      // Load brand features for company holidays and global read access
      const brandFeatures = await getBrandFeatures();
      const holidays = getCompanyHolidayDates(brandFeatures, year);
      setCompanyHolidays(holidays);
      setGlobalReadEnabled(isGlobalReadAccessEnabled(brandFeatures));
      setYearLayout(getAttendanceYearLayout(brandFeatures));
      setBulkEntryEnabled(getBulkEntryConfig(brandFeatures).enabled);

      const cachedInitial = getCachedData<{
        employees: Employee[];
        timeCodes: TimeCode[];
        groups: Group[];
      }>('attendance:initial');
      if (cachedInitial) {
        setEmployees(cachedInitial.employees);
        setTimeCodes(cachedInitial.timeCodes);
        if (cachedInitial.groups) setGroups(cachedInitial.groups);
        if (cachedInitial.employees.length > 0 && !selectedEmployeeId) {
          if (cachedInitial.employees.length > 1) {
            setViewAll(true);
          } else {
            const linkedEmployee = user?.employee_id
              ? cachedInitial.employees.find((e: Employee) => e.id === user.employee_id)
              : null;
            setSelectedEmployeeId(linkedEmployee ? linkedEmployee.id : cachedInitial.employees[0].id);
          }
        } else if (cachedInitial.employees.length === 0) {
          setEntriesReady(true);
        }
        setLoading(false);
      }

      const [employeesRes, timeCodesRes, groupsRes] = await Promise.all([
        authFetch('/api/employees'),
        authFetch('/api/time-codes'),
        authFetch('/api/groups'),
      ]);

      // If redirected to login due to expired session, stop processing
      if (employeesRes.status === 401 || timeCodesRes.status === 401) {
        return;
      }

      const employeesData = await employeesRes.json();
      const timeCodesData = await timeCodesRes.json();
      const groupsData = groupsRes.ok ? await groupsRes.json() : [];

      // Validate that we received arrays
      if (Array.isArray(groupsData)) {
        // Exclude master groups from the filter (they're admin-only)
        setGroups(groupsData.filter((g: Group) => !g.is_master));
      }

      if (Array.isArray(employeesData)) {
        setEmployees(employeesData);
        if (employeesData.length > 0 && !selectedEmployeeId) {
          // Default to "All" when there are multiple employees
          if (employeesData.length > 1) {
            setViewAll(true);
          } else {
            // Prefer the user's linked employee, fall back to first in list
            const linkedEmployee = user?.employee_id
              ? employeesData.find((e: Employee) => e.id === user.employee_id)
              : null;
            setSelectedEmployeeId(linkedEmployee ? linkedEmployee.id : employeesData[0].id);
          }
        } else if (employeesData.length === 0) {
          // No employees — nothing to load, unblock the gate
          setEntriesReady(true);
        }
      } else {
        console.error('Invalid employees data:', employeesData);
        setEmployees([]);
        setEntriesReady(true);
      }

      if (Array.isArray(timeCodesData)) {
        setTimeCodes(timeCodesData);
      } else {
        console.error('Invalid time codes data:', timeCodesData);
        setTimeCodes([]);
      }

      setCachedData('attendance:initial', {
        employees: Array.isArray(employeesData) ? employeesData : [],
        timeCodes: Array.isArray(timeCodesData) ? timeCodesData : [],
        groups: Array.isArray(groupsData) ? groupsData.filter((g: Group) => !g.is_master) : [],
      });
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setEmployees([]);
      setTimeCodes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceData = async () => {
    if (!selectedEmployeeId || !isAuthenticated) return;

    const cacheKey = `attendance:data:${selectedEmployeeId}:${year}:${globalReadEnabled}`;
    const cachedAttendance = getCachedData<{
      entries: AttendanceEntry[];
      allocations: TimeAllocation[];
      dailySummary: DailySummary | null;
      totalActiveEmployees: number;
      maxOutOfOffice: number;
      capacityWarningCount: number;
      capacityCriticalCount: number;
    }>(cacheKey);
    if (cachedAttendance) {
      setEntries(cachedAttendance.entries);
      setAllocations(cachedAttendance.allocations);
      setDailySummary(cachedAttendance.dailySummary);
      setTotalActiveEmployees(cachedAttendance.totalActiveEmployees);
      setMaxOutOfOffice(cachedAttendance.maxOutOfOffice);
      setCapacityWarningCount(cachedAttendance.capacityWarningCount);
      setCapacityCriticalCount(cachedAttendance.capacityCriticalCount);
      setEntriesReady(true);
    }

    try {
      // Build parallel fetch list
      const fetches: Promise<Response>[] = [
        authFetch(`/api/attendance?employeeId=${selectedEmployeeId}&year=${year}`),
        authFetch(`/api/employee-allocations?employeeId=${selectedEmployeeId}&year=${new Date().getFullYear()}`),
      ];

      // Also fetch daily summary if global read access is enabled
      if (globalReadEnabled) {
        fetches.push(authFetch(`/api/attendance/daily-summary?year=${year}`));
      }

      const results = await Promise.all(fetches);
      const [attendanceRes, allocationsRes] = results;
      const summaryRes = globalReadEnabled ? results[2] : null;

      // If redirected to login due to expired session, stop processing
      if (attendanceRes.status === 401 || allocationsRes.status === 401) {
        return;
      }

      const attendanceData = attendanceRes.ok ? await attendanceRes.json() : [];
      const allocationsData = allocationsRes.ok ? await allocationsRes.json() : {};

      setEntries(Array.isArray(attendanceData) ? attendanceData : []);
      setAllocations(allocationsData && Array.isArray(allocationsData.allocations) ? allocationsData.allocations : []);

      // Process daily summary if available
      let nextDailySummary: DailySummary | null = null;
      let nextTotalActiveEmployees = 0;
      let nextMaxOutOfOffice = 0;
      let nextCapacityWarningCount = 3;
      let nextCapacityCriticalCount = 5;

      if (summaryRes && summaryRes.ok) {
        const summaryData = await summaryRes.json();
        nextDailySummary = summaryData.dailySummary || null;
        nextTotalActiveEmployees = summaryData.totalActiveEmployees || 0;
        nextMaxOutOfOffice = summaryData.maxOutOfOffice || 0;
        nextCapacityWarningCount = summaryData.capacityWarningCount ?? 3;
        nextCapacityCriticalCount = summaryData.capacityCriticalCount ?? 5;
        setDailySummary(nextDailySummary);
        setTotalActiveEmployees(nextTotalActiveEmployees);
        setMaxOutOfOffice(nextMaxOutOfOffice);
        setCapacityWarningCount(nextCapacityWarningCount);
        setCapacityCriticalCount(nextCapacityCriticalCount);
      }

      setCachedData(cacheKey, {
        entries: Array.isArray(attendanceData) ? attendanceData : [],
        allocations: Array.isArray(allocationsData?.allocations) ? allocationsData.allocations : [],
        dailySummary: nextDailySummary,
        totalActiveEmployees: nextTotalActiveEmployees,
        maxOutOfOffice: nextMaxOutOfOffice,
        capacityWarningCount: nextCapacityWarningCount,
        capacityCriticalCount: nextCapacityCriticalCount,
      });
      setEntriesReady(true);
    } catch (error) {
      console.error('Failed to load attendance:', error);
      setEntries([]);
      setAllocations([]);
      setEntriesReady(true);
    }
  };

  const loadAllEmployeesData = async () => {
    if (!isAuthenticated) return;

    const cacheKey = `attendance:all:${year}`;
    const cached = getCachedData<AttendanceEntry[]>(cacheKey);
    if (cached) {
      setAllEmployeesEntries(cached);
      setEntriesReady(true);
    }

    try {
      const res = await authFetch(`/api/attendance?year=${year}`);
      if (res.status === 401) return;
      if (res.ok) {
        const data = await res.json();
        const entries = Array.isArray(data) ? data : [];
        setAllEmployeesEntries(entries);
        setCachedData(cacheKey, entries);
      } else {
        setAllEmployeesEntries([]);
      }
      // Also refresh daily summary when viewing all
      if (globalReadEnabled) {
        const summaryRes = await authFetch(`/api/attendance/daily-summary?year=${year}`);
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setDailySummary(summaryData.dailySummary || null);
          setTotalActiveEmployees(summaryData.totalActiveEmployees || 0);
          setMaxOutOfOffice(summaryData.maxOutOfOffice || 0);
          setCapacityWarningCount(summaryData.capacityWarningCount ?? 3);
          setCapacityCriticalCount(summaryData.capacityCriticalCount ?? 5);
        }
      }
      setEntriesReady(true);
    } catch (error) {
      console.error('Failed to load all employees data:', error);
      setAllEmployeesEntries([]);
      setEntriesReady(true);
    }
  };

  const handleEntryChange = async (
    date: string,
    updatedEntries: AttendanceEntry[],
    employeeId?: number,
    originalDate?: string
  ): Promise<EntryChangeResult> => {
    const targetEmployeeId = employeeId ?? selectedEmployeeId;
    if (!targetEmployeeId || !isAuthenticated) {
      if (viewAll && isAuthenticated) {
        toast({
          title: 'Select an employee to edit',
          description: 'Choose a specific employee from the dropdown to make changes.',
        });
      }
      return { success: false };
    }

    try {
      // entry_date is the source day to clear; target_entry_date is where the
      // entries end up. They're the same unless the date field was changed.
      const response = await authFetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_day',
          employee_id: targetEmployeeId,
          entry_date: originalDate ?? date,
          target_entry_date: date,
          entries: updatedEntries,
        }),
      });

      // If redirected to login due to expired session, stop processing
      if (response.status === 401) {
        return { success: false };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (errorData.error === 'date_occupied') {
          // Let the dialog show this inline instead of a generic toast.
          return { success: false, error: errorData.message };
        }
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      // Reload attendance data to show updated entries
      clearCachedDataByPrefix(`attendance:data:${selectedEmployeeId}:`);
      clearCachedDataByPrefix('attendance:all:');
      if (viewAll) {
        await loadAllEmployeesData();
      } else {
        await loadAttendanceData();
      }

      toast({
        title: 'Attendance Saved',
        description: updatedEntries.length === 0
          ? 'Entries deleted successfully.'
          : `${updatedEntries.length} ${updatedEntries.length === 1 ? 'entry' : 'entries'} saved successfully.`,
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to save attendance:', error);
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'There was an error saving your attendance. Please try again.',
        variant: 'destructive',
      });
      return { success: false, error: error instanceof Error ? error.message : 'Save failed' };
    }
  };

  // Navigation handlers
  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    const newDate = navigatePeriod(view, currentDate, direction);
    setCurrentDate(newDate);
    const newYear = newDate.getFullYear();
    if (newYear !== year) {
      setYear(newYear);
    }
  }, [view, currentDate, year]);

  const handleToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    if (today.getFullYear() !== year) {
      setYear(today.getFullYear());
    }
  }, [year]);

  const handleYearChange = useCallback((newYear: number) => {
    setYear(newYear);
    const today = new Date();
    if (newYear === today.getFullYear()) {
      setCurrentDate(today);
    } else {
      setCurrentDate(new Date(newYear, 0, 1));
    }
  }, []);

  const handleMonthChange = useCallback((month: number) => {
    setCurrentDate(new Date(year, month, 1));
  }, [year]);

  const handleWeekChange = useCallback((weekStart: Date) => {
    setCurrentDate(weekStart);
  }, []);

  const handleViewChange = useCallback((newView: ViewType) => {
    setView(newView);
  }, []);

  const years = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - 2 + i
  );

  const currentWeekMonday = view === 'week' ? formatDateStr(getWeekDates(currentDate)[0]) : '';
  const weeksInMonth = view === 'week'
    ? getWeeksInMonth(currentDate.getFullYear(), currentDate.getMonth())
    : [];

  // Visible groups exclude "Employees" from the filter dropdown (still selectable via "All Groups")
  const visibleGroups = groups.filter(g => g.name !== 'Employees');
  const isMasterUser = user?.group?.is_master === 1;

  // Filter employees by selected group for the "All" view
  const filteredEmployees = (selectedInactive ? inactiveEmployees : employees)
    .filter(e => !selectedGroupId || e.group_id === selectedGroupId);

  // When viewAll, use all employees' entries (filtered by group/inactive if needed)
  const activeEntries = viewAll
    ? ((selectedGroupId || selectedInactive)
        ? allEmployeesEntries.filter(e => filteredEmployees.some(emp => emp.id === e.employee_id))
        : allEmployeesEntries)
    : entries;

  const employeeNameMap: Record<number, string> | undefined = viewAll
    ? Object.fromEntries(filteredEmployees.map(e => [e.id, `${e.first_name} ${e.last_name}`]))
    : undefined;

  // Shared grid props
  const gridProps = {
    employeeId: selectedEmployeeId ?? 0,
    entries: activeEntries,
    timeCodes,
    onEntryChange: handleEntryChange,
    companyHolidays,
    dailySummary,
    totalActiveEmployees,
    maxOutOfOffice,
    capacityWarningCount,
    capacityCriticalCount,
    employeeNameMap,
    readOnly: viewAll,
  };

  if (authLoading || loading || !entriesReady) {
    return (
      <div className="min-h-screen p-3">
        <PageLoading label="Loading attendance..." />
      </div>
    );
  }

  // Don't render if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen p-3">
      <div className="max-w-full mx-auto space-y-2">
        <div className="flex flex-wrap gap-2">
          {/* Selects + View controls */}
          <div className="flex flex-wrap items-stretch gap-3 p-4 border rounded-lg bg-card">
            {/* Left group: employee selectors */}
            {employees.length > 0 && (
              <div className="flex flex-wrap items-end gap-4">
                {(visibleGroups.length > 1 || isMasterUser) && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="group-filter" className="text-sm font-medium">Group</Label>
                    <Select
                      value={selectedInactive ? 'inactive' : (selectedGroupId?.toString() ?? 'all')}
                      onValueChange={(value) => {
                        if (value === 'inactive') {
                          setSelectedInactive(true);
                          setSelectedGroupId(null);
                        } else {
                          setSelectedInactive(false);
                          setSelectedGroupId(value === 'all' ? null : parseInt(value));
                        }
                      }}
                    >
                      <SelectTrigger id="group-filter" className="h-9 w-44 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Groups</SelectItem>
                        {visibleGroups.map(g => (
                          <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                        ))}
                        {isMasterUser && (
                          <SelectItem value="inactive">Inactive</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <HelpArea helpId="employee-selector" bubblePosition="bottom">
                    <Label htmlFor="employee" className="text-sm font-medium cursor-help">Employee</Label>
                  </HelpArea>
                  <Select
                    value={viewAll ? 'all' : (selectedEmployeeId?.toString() || '')}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        setViewAll(true);
                        setSelectedEmployeeId(undefined);
                      } else {
                        setViewAll(false);
                        setSelectedEmployeeId(parseInt(value));
                      }
                    }}
                  >
                    <SelectTrigger id="employee" className="h-9 w-48 text-sm">
                      <SelectValue placeholder="Select employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {filteredEmployees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id.toString()}>
                          {emp.last_name}, {emp.first_name}
                          {emp.employee_number && <span className="text-muted-foreground"> ({emp.employee_number})</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="w-px self-stretch bg-border mx-1" />

            {/* Right group: view + period navigation */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">View</Label>
                <ViewToggle view={view} onViewChange={handleViewChange} />
              </div>

              {/* Year selector — always visible, same position across all views */}
              <div className="flex flex-col gap-1.5">
                <HelpArea helpId="year-selector" bubblePosition="bottom">
                  <Label htmlFor="year" className="text-sm font-medium cursor-help">Year</Label>
                </HelpArea>
                <Select
                  value={year.toString()}
                  onValueChange={(value) => handleYearChange(parseInt(value))}
                >
                  <SelectTrigger id="year" className="h-9 w-[80px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Month column — month and week views */}
              {view !== 'year' && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium">Month</Label>
                  <Select
                    value={currentDate.getMonth().toString()}
                    onValueChange={(value) => handleMonthChange(parseInt(value))}
                  >
                    <SelectTrigger className="h-9 w-[124px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((name, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Week column — week view only */}
              {view === 'week' && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium">Week</Label>
                  <Select
                    value={currentWeekMonday}
                    onValueChange={(value) => {
                      const [y, m, d] = value.split('-').map(Number);
                      handleWeekChange(new Date(y, m - 1, d));
                    }}
                  >
                    <SelectTrigger className="h-9 w-[148px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weeksInMonth.map((monday) => {
                        const val = formatDateStr(monday);
                        return (
                          <SelectItem key={val} value={val}>
                            {getWeekLabelNoYear(monday)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Today button */}
              {view !== 'year' && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm invisible">&nbsp;</Label>
                  <Button variant="outline" size="sm" className="h-9 text-sm px-3" onClick={handleToday}>
                    Today
                  </Button>
                </div>
              )}

              {bulkEntryEnabled && selectedEmployeeId && !viewAll && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm invisible">&nbsp;</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={() => setBulkEntryOpen(true)}
                  >
                    <CalendarRange className="h-3.5 w-3.5" />
                    Bulk
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Balance Cards — only in single-employee view */}
          {selectedEmployeeId && !viewAll && (
            <div className="flex-1 min-w-0">
              <BalanceCards entries={entries} allocations={allocations} employeeId={selectedEmployeeId} />
            </div>
          )}
        </div>

        {(viewAll || selectedEmployeeId) && (
          <>
            <HelpArea helpId="attendance-grid" bubblePosition="top">
              <div className="space-y-3">
                {view === 'year' && yearLayout === 'calendar' && (
                  <AttendanceGridYearCalendar
                    year={year}
                    {...gridProps}
                  />
                )}

                {view === 'year' && yearLayout !== 'calendar' && (
                  <AttendanceGridYear
                    year={year}
                    {...gridProps}
                  />
                )}

                {view === 'month' && (
                  <AttendanceGridMonth
                    year={currentDate.getFullYear()}
                    month={currentDate.getMonth() + 1}
                    {...gridProps}
                  />
                )}

                {view === 'week' && (
                  <AttendanceGridWeek
                    weekStart={parseDateStr(getWeekBounds(currentDate).start)}
                    {...gridProps}
                  />
                )}
              </div>
            </HelpArea>

            <div className="mt-3 p-2 border rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2 text-sm">Time Code Legend</h3>
              <div className="columns-2 md:columns-3 lg:columns-4 gap-x-6 text-xs">
                {timeCodes.map(tc => (
                  <div key={tc.code} className="flex items-start gap-1 break-inside-avoid mb-1">
                    <span className="mt-px text-muted-foreground select-none">•</span>
                    <span>
                      {tc.description}{' '}
                      <span className="font-mono text-muted-foreground">({tc.code})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Bulk Entry Dialog */}
        {bulkEntryEnabled && selectedEmployeeId && !viewAll && (
          <BulkEntryDialog
            open={bulkEntryOpen}
            onOpenChange={setBulkEntryOpen}
            employeeId={selectedEmployeeId}
            timeCodes={timeCodes}
            authFetch={authFetch}
            onSave={async () => {
              clearCachedDataByPrefix(`attendance:data:${selectedEmployeeId}:`);
              clearCachedDataByPrefix('attendance:all:');
              await loadAttendanceData();
              toast({
                title: 'Bulk Entry Saved',
                description: 'Date range entries have been saved successfully.',
              });
            }}
          />
        )}

        {!selectedEmployeeId && employees.length === 0 && (
          <div className="text-center p-8 border rounded-lg flex flex-col items-center">
            <UserPlus className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-1.5">No Employees Yet</h2>
            <p className="text-muted-foreground mb-3">
              Go to the Employees tab to add employees and get started with attendance tracking.
            </p>
            <Link href="/employees">
              <Button>
                Go to Employees
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    }>
      <AttendanceContent />
    </Suspense>
  );
}
