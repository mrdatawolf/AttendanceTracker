"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { config } from '@/lib/config';
import { useHelp } from '@/lib/help-context';
import { useAuth } from '@/lib/auth-context';
import { ReportFilters } from '@/components/reports/report-filters';
import { ReportTable } from '@/components/reports/report-table';
import { ReportExport } from '@/components/reports/report-export';
import { LeaveBalanceSummary } from '@/components/reports/leave-balance-summary';
import { LeaveBalanceExport } from '@/components/reports/leave-balance-export';
import { AttendanceManagementReport, type AttendanceManagementData } from '@/components/reports/attendance-management-report';
import { AttendanceManagementExport } from '@/components/reports/attendance-management-export';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatDateStr } from '@/lib/date-helpers';
import { getBrandFeatures } from '@/lib/brand-features';
import { PageLoading } from '@/components/page-loading';
import { getCachedData, setCachedData } from '@/lib/client-cache';

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  role?: string;
  group_id?: number;
}

interface Group {
  id: number;
  name: string;
  is_master?: number;
}

interface JobTitle {
  id: number;
  name: string;
}

interface TimeCode {
  id: number;
  code: string;
  description: string;
}

interface ReportEntry {
  employee_name: string;
  entry_date: string;
  time_code: string;
  hours: number;
  notes: string;
}

interface ReportColumn {
  key: string;
  header: string;
}

interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  apiEndpoint: string;
  type?: string;
  isDefault?: boolean;
  requiredFeature?: string;
  columns?: ReportColumn[];
  export: {
    csv: boolean;
    pdf: boolean;
    filename: string;
  };
}

interface LeaveBalanceSummaryData {
  employees: Array<{
    id: number;
    name: string;
    balances: Array<{
      timeCode: string;
      label: string;
      used: number;
      allocated: number | null;
      hasAllocation: boolean;
    }>;
  }>;
  columns: Array<{
    timeCode: string;
    label: string;
    hasAllocation: boolean;
  }>;
  config: {
    warningThreshold: number;
    criticalThreshold: number;
  };
  year: number;
}

const DEFAULT_COLUMNS: ReportColumn[] = [
  { key: 'employee_name', header: 'Employee' },
  { key: 'entry_date', header: 'Date' },
  { key: 'time_code', header: 'Time Code' },
  { key: 'hours', header: 'Hours' },
  { key: 'notes', header: 'Notes' },
];

export default function ReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: authLoading, authFetch } = useAuth();
  const { setCurrentScreen } = useHelp();

  // Report definitions
  const [reportDefinitions, setReportDefinitions] = useState<ReportDefinition[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('');

  // Attendance Summary state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timeCodes, setTimeCodes] = useState<TimeCode[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [hideRoleFilter, setHideRoleFilter] = useState(false);
  const [attendanceData, setAttendanceData] = useState<ReportEntry[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedTimeCode, setSelectedTimeCode] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(new Date().getFullYear(), 0, 1));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date(new Date().getFullYear(), 11, 31));

  // Leave Balance Summary state
  const [leaveBalanceData, setLeaveBalanceData] = useState<LeaveBalanceSummaryData | null>(null);

  // Attendance Management Report state
  const [attendanceManagementData, setAttendanceManagementData] = useState<AttendanceManagementData | null>(null);

  // Loading states
  const [initialLoading, setInitialLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    setCurrentScreen('reports');
  }, [setCurrentScreen]);

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

  // Auto-generate report when selection changes or on initial load
  useEffect(() => {
    if (!selectedReportId || !isAuthenticated || initialLoading) return;

    if (selectedReportId === 'leave-balance-summary') {
      loadLeaveBalanceSummary();
    } else if (selectedReportId === 'attendance-management') {
      const now = new Date();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(prevMonthStart);
      setEndDate(prevMonthEnd);
      setSelectedEmployeeId('');
      setAttendanceManagementData(null);
    } else {
      // Table-based reports default to "all employees"
      setSelectedEmployeeId('all');
      setAttendanceData([]);
      handleGenerateAttendanceReport();
    }
  }, [selectedReportId, isAuthenticated, initialLoading]);

  const loadInitialData = async () => {
    const cachedReports = getCachedData<{
      employees: Employee[];
      timeCodes: TimeCode[];
      groups: Group[];
      jobTitles: JobTitle[];
      reportDefinitions: ReportDefinition[];
      selectedReportId: string;
    }>('reports:initial');
    if (cachedReports) {
      setEmployees(cachedReports.employees);
      setTimeCodes(cachedReports.timeCodes);
      setGroups(cachedReports.groups ?? []);
      setJobTitles(cachedReports.jobTitles ?? []);
      setReportDefinitions(cachedReports.reportDefinitions);
      setSelectedReportId(cachedReports.selectedReportId);
      setInitialLoading(false);
    }

    try {
      const brandFeatures = await getBrandFeatures();
      setHideRoleFilter(brandFeatures.features.attendanceManagement?.hideRoleFilter ?? false);

      const [employeesRes, timeCodesRes, groupsRes, jobTitlesRes, reportDefsRes] = await Promise.all([
        authFetch('/api/employees'),
        authFetch('/api/time-codes'),
        authFetch('/api/groups'),
        authFetch('/api/job-titles?active=true'),
        authFetch('/api/report-definitions'),
      ]);

      if (employeesRes.status === 401 || timeCodesRes.status === 401) {
        return;
      }

      const employeesData = await employeesRes.json();
      const timeCodesData = await timeCodesRes.json();
      const groupsData = groupsRes.ok ? await groupsRes.json() : [];

      if (Array.isArray(employeesData)) {
        setEmployees(employeesData);
      }

      if (Array.isArray(timeCodesData)) {
        setTimeCodes(timeCodesData);
      }

      if (Array.isArray(groupsData)) {
        setGroups(groupsData.filter((g: Group) => !g.is_master));
      }

      const jobTitlesData = jobTitlesRes.ok ? await jobTitlesRes.json() : [];
      if (Array.isArray(jobTitlesData)) {
        setJobTitles(jobTitlesData);
      }

      let nextReportDefinitions: ReportDefinition[] = [];
      let nextSelectedReportId = '';

      // Load all report definitions
      if (reportDefsRes.ok) {
        const reportDefsData = await reportDefsRes.json();
        // API returns array directly
        if (Array.isArray(reportDefsData)) {
          nextReportDefinitions = reportDefsData;
          setReportDefinitions(reportDefsData);
          // Select the default report or first one
          const defaultReport = reportDefsData.find((r: ReportDefinition) => r.isDefault);
          nextSelectedReportId = defaultReport?.id || reportDefsData[0]?.id || '';
          setSelectedReportId(nextSelectedReportId);
        }
      }

      setCachedData('reports:initial', {
        employees: Array.isArray(employeesData) ? employeesData : [],
        timeCodes: Array.isArray(timeCodesData) ? timeCodesData : [],
        groups: Array.isArray(groupsData) ? groupsData.filter((g: Group) => !g.is_master) : [],
        jobTitles: Array.isArray(jobTitlesData) ? jobTitlesData : [],
        reportDefinitions: nextReportDefinitions,
        selectedReportId: nextSelectedReportId,
      });
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadLeaveBalanceSummary = async () => {
    setReportLoading(true);
    try {
      const res = await authFetch('/api/reports/leave-balance-summary');

      if (res.status === 401) {
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setLeaveBalanceData(data);
      } else {
        console.error('Failed to load leave balance summary');
        setLeaveBalanceData(null);
      }
    } catch (error) {
      console.error('Failed to load leave balance summary:', error);
      setLeaveBalanceData(null);
    } finally {
      setReportLoading(false);
    }
  };

  const loadAttendanceManagement = async () => {
    if (!selectedEmployeeId || selectedEmployeeId === 'all') {
      setAttendanceManagementData(null);
      return;
    }
    setReportLoading(true);
    try {
      const params = new URLSearchParams({
        employeeId: selectedEmployeeId,
        startDate: formatDateForApi(startDate),
        endDate: formatDateForApi(endDate),
      });
      const res = await authFetch(`/api/reports/attendance-management?${params.toString()}`);

      if (res.status === 401) {
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setAttendanceManagementData(data);
      } else {
        console.error('Failed to load attendance management report');
        setAttendanceManagementData(null);
      }
    } catch (error) {
      console.error('Failed to load attendance management report:', error);
      setAttendanceManagementData(null);
    } finally {
      setReportLoading(false);
    }
  };

  const formatDateForApi = (date: Date | undefined): string => {
    if (!date) return '';
    return formatDateStr(date);
  };

  const handleGenerateAttendanceReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({
        employeeId: selectedEmployeeId,
        startDate: formatDateForApi(startDate),
        endDate: formatDateForApi(endDate),
      });

      // Only include timeCode for reports that use it
      if (selectedReportId !== 'break-compliance') {
        params.set('timeCode', selectedTimeCode);
      }

      // Use the apiEndpoint from the selected report definition
      const endpoint = selectedReport?.apiEndpoint || '/api/reports';
      const res = await authFetch(`${endpoint}?${params.toString()}`);

      if (res.status === 401) {
        return;
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        setAttendanceData(data);
      } else {
        setAttendanceData([]);
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      setAttendanceData([]);
    } finally {
      setReportLoading(false);
    }
  };

  const selectedReport = reportDefinitions.find(r => r.id === selectedReportId);
  const isLeaveBalanceSummary = selectedReportId === 'leave-balance-summary';
  const isAttendanceManagement = selectedReportId === 'attendance-management';
  const isBreakCompliance = selectedReportId === 'break-compliance';

  const uniqueRoles = hideRoleFilter ? [] : jobTitles.map(jt => jt.name);

  // Use report definition values or fall back to defaults
  const columns = selectedReport?.columns || DEFAULT_COLUMNS;
  const exportFilename = selectedReport?.export?.filename
    ? `${selectedReport.export.filename}.csv`
    : 'report.csv';

  if (!config.features.enableReports) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Reports Disabled</h1>
          <p className="text-muted-foreground">
            The reports feature is currently disabled. Edit{' '}
            <code className="text-sm bg-muted px-2 py-1 rounded">lib/config.ts</code> and set{' '}
            <code className="text-sm bg-muted px-2 py-1 rounded">features.enableReports</code> to{' '}
            <code className="text-sm bg-muted px-2 py-1 rounded">true</code>.
          </p>
          <Link href="/attendance" className="inline-block text-blue-600 hover:underline">
            &larr; Go back to Attendance
          </Link>
        </div>
      </div>
    );
  }

  if (authLoading || initialLoading) {
    return (
      <div className="min-h-screen p-3">
        <PageLoading label="Loading reports..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3">
      <div className="max-w-full mx-auto space-y-4">
        {/* Header with Report Selector */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Reports</h1>

          {reportDefinitions.length > 1 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="report-select" className="text-sm font-medium">Report:</Label>
              <Select value={selectedReportId} onValueChange={setSelectedReportId}>
                <SelectTrigger id="report-select" className="w-64">
                  <SelectValue placeholder="Select report..." />
                </SelectTrigger>
                <SelectContent>
                  {reportDefinitions.map(report => (
                    <SelectItem key={report.id} value={report.id}>
                      {report.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Report Description */}
        {selectedReport?.description && (
          <p className="text-sm text-muted-foreground">{selectedReport.description}</p>
        )}

        {/* Conditional Report Content */}
        {isLeaveBalanceSummary ? (
          /* Leave Balance Summary Report */
          <div className="space-y-4">
            <div className="flex items-center justify-between p-2 border rounded-lg bg-muted">
              <h2 className="text-lg font-semibold">
                {leaveBalanceData?.year || new Date().getFullYear()} Leave Balances
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={loadLeaveBalanceSummary}
                  disabled={reportLoading}
                >
                  {reportLoading ? 'Loading...' : 'Refresh'}
                </Button>
                <LeaveBalanceExport
                  data={leaveBalanceData}
                  filename={exportFilename}
                />
              </div>
            </div>

            <div className="w-4/5 mx-auto space-y-2 [&_td]:py-1 [&_th]:py-1 [&_th]:h-auto">
              <LeaveBalanceSummary
                data={leaveBalanceData}
                loading={reportLoading}
              />
            </div>
          </div>
        ) : isAttendanceManagement ? (
          /* Attendance Management Report (per-employee) */
          <>
            <ReportFilters
              employees={employees}
              timeCodes={timeCodes}
              groups={groups}
              selectedGroupId={selectedGroupId}
              onGroupChange={setSelectedGroupId}
              roles={uniqueRoles}
              selectedRole={selectedRole}
              onRoleChange={setSelectedRole}
              selectedEmployeeId={selectedEmployeeId}
              onEmployeeChange={setSelectedEmployeeId}
              selectedTimeCode={selectedTimeCode}
              onTimeCodeChange={setSelectedTimeCode}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
              onGenerate={loadAttendanceManagement}
              loading={reportLoading}
              hideTimeCode={true}
              requireEmployee={true}
              actionButtons={
                <AttendanceManagementExport
                  data={attendanceManagementData}
                  filename={exportFilename}
                />
              }
            />

            <div className="w-3/5 mx-auto space-y-2 [&_td]:py-1 [&_th]:py-1 [&_th]:h-auto">
              <AttendanceManagementReport
                data={attendanceManagementData}
                loading={reportLoading}
              />
            </div>
          </>
        ) : (
          /* Attendance Summary Report (and other table-based reports) */
          <>
            <ReportFilters
              employees={employees}
              timeCodes={timeCodes}
              groups={groups}
              selectedGroupId={selectedGroupId}
              onGroupChange={setSelectedGroupId}
              roles={uniqueRoles}
              selectedRole={selectedRole}
              onRoleChange={setSelectedRole}
              selectedEmployeeId={selectedEmployeeId}
              onEmployeeChange={setSelectedEmployeeId}
              selectedTimeCode={selectedTimeCode}
              onTimeCodeChange={setSelectedTimeCode}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
              onGenerate={handleGenerateAttendanceReport}
              loading={reportLoading}
              hideTimeCode={isBreakCompliance}
              actionButtons={
                <ReportExport
                  data={attendanceData}
                  filename={exportFilename}
                />
              }
            />

            <div className="w-4/5 mx-auto space-y-2 [&_td]:py-1 [&_th]:py-1 [&_th]:h-auto">
              <ReportTable
                columns={columns}
                data={attendanceData}
                loading={reportLoading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
