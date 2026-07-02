"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/spinner';
import { HelpArea } from '@/components/help-area';
import { Eye, EyeOff } from 'lucide-react';

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  group_id?: number;
}

interface Group {
  id: number;
  name: string;
}

interface TimeCode {
  id: number;
  code: string;
  description: string;
}

interface ReportFiltersProps {
  employees: Employee[];
  inactiveEmployees?: Employee[];
  timeCodes: TimeCode[];
  groups?: Group[];
  selectedGroupId?: string;
  onGroupChange?: (value: string) => void;
  isMasterUser?: boolean;
  selectedInactive?: boolean;
  onInactiveChange?: (value: boolean) => void;
  selectedEmployeeId: string;
  onEmployeeChange: (value: string) => void;
  selectedTimeCode: string;
  onTimeCodeChange: (value: string) => void;
  startDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  endDate: Date | undefined;
  onEndDateChange: (date: Date | undefined) => void;
  onGenerate: () => void;
  loading: boolean;
  actionButtons?: React.ReactNode;
  hideTimeCode?: boolean;
  requireEmployee?: boolean;
}

export function ReportFilters({
  employees,
  inactiveEmployees = [],
  timeCodes,
  groups = [],
  selectedGroupId = 'all',
  onGroupChange,
  isMasterUser,
  selectedInactive = false,
  onInactiveChange,
  selectedEmployeeId,
  onEmployeeChange,
  selectedTimeCode,
  onTimeCodeChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onGenerate,
  loading,
  actionButtons,
  hideTimeCode,
  requireEmployee,
}: ReportFiltersProps) {
  const dateRangeInvalid = !!(startDate && endDate && startDate > endDate);

  const today = new Date();
  const ytdStart = new Date(today.getFullYear(), 0, 1);
  const thisYearJune1 = new Date(today.getFullYear(), 5, 1);
  const vacStart = today >= thisYearJune1
    ? thisYearJune1
    : new Date(today.getFullYear() - 1, 5, 1);
  const vacEnd = new Date(vacStart.getFullYear() + 1, 4, 31); // May 31 of following year

  const isSameDay = (a: Date | undefined, b: Date) =>
    !!a && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const prevVacStart = new Date(vacStart.getFullYear() - 1, 5, 1);
  const prevVacEnd = new Date(vacStart.getFullYear(), 4, 31);

  const isYtdActive = isSameDay(startDate, ytdStart) && isSameDay(endDate, today);
  const isVacActive = isSameDay(startDate, vacStart) && isSameDay(endDate, vacEnd);
  const isVacPrevActive = isSameDay(startDate, prevVacStart) && isSameDay(endDate, prevVacEnd);

  // Visible groups exclude "Employees" from the filter dropdown (still selectable via "All Groups")
  const visibleGroups = groups.filter(g => g.name !== 'Employees');

  const filteredEmployees = (selectedInactive ? inactiveEmployees : employees)
    .filter(e => selectedGroupId === 'all' || e.group_id?.toString() === selectedGroupId);

  return (
    <HelpArea helpId="report-filters" bubblePosition="bottom">
      <div className="flex flex-wrap items-end gap-4 p-3 border rounded-lg bg-muted print:hidden">
        {(visibleGroups.length > 1 || isMasterUser) && onGroupChange && (
          <div className="flex flex-col flex-1 min-w-[160px] gap-1.5">
            <label className="text-sm font-medium">Group</label>
            <Select
              value={selectedGroupId}
              onValueChange={(value) => {
                onInactiveChange?.(false);
                onGroupChange(value);
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {visibleGroups.map(g => (
                  <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isMasterUser && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium opacity-0 select-none">Inactive</label>
            <Button
              type="button"
              variant="outline"
              onClick={() => onInactiveChange?.(!selectedInactive)}
              className="h-9 gap-2"
            >
              {selectedInactive ? (
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
          </div>
        )}

        <div className="flex flex-col flex-1 min-w-[200px] gap-1.5">
          <label className="text-sm font-medium">Employee</label>
          <Select value={selectedEmployeeId} onValueChange={onEmployeeChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={requireEmployee ? 'Pick an Employee' : undefined} />
            </SelectTrigger>
            <SelectContent>
              {!requireEmployee && <SelectItem value="all">All Employees</SelectItem>}
              {filteredEmployees.map(emp => (
                <SelectItem key={emp.id} value={emp.id.toString()}>
                  {emp.last_name}, {emp.first_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!hideTimeCode && (
          <div className="flex flex-col flex-1 min-w-[200px] gap-1.5">
            <label className="text-sm font-medium">Time Code</label>
            <Select value={selectedTimeCode} onValueChange={onTimeCodeChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time Codes</SelectItem>
                {timeCodes.map(tc => (
                  <SelectItem key={tc.code} value={tc.code}>
                    {tc.code} - {tc.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col min-w-[190px] gap-1.5">
          <label className="text-sm font-medium">Start Date</label>
          <DatePicker date={startDate} setDate={onStartDateChange} invalid={dateRangeInvalid} className="w-[190px]" />
        </div>

        <div className="flex flex-col min-w-[190px] gap-1.5">
          <label className="text-sm font-medium">End Date</label>
          <DatePicker date={endDate} setDate={onEndDateChange} invalid={dateRangeInvalid} className="w-[190px]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm invisible select-none">Presets</label>
          <div className="flex gap-1">
            <Button
              variant={isYtdActive ? 'default' : 'outline'}
              size="sm"
              className="h-9 text-sm px-3"
              onClick={() => {
                const today = new Date();
                onStartDateChange(new Date(today.getFullYear(), 0, 1));
                onEndDateChange(today);
              }}
              title="January 1st of current year to today"
            >
              YTD
            </Button>
            <Button
              variant={isVacActive ? 'default' : 'outline'}
              size="sm"
              className="h-9 text-sm px-3"
              onClick={() => {
                onStartDateChange(vacStart);
                onEndDateChange(vacEnd);
              }}
              title="Current vacation year: June 1 – May 31"
            >
              VYC
            </Button>
            <Button
              variant={isVacPrevActive ? 'default' : 'outline'}
              size="sm"
              className="h-9 text-sm px-3"
              onClick={() => {
                onStartDateChange(prevVacStart);
                onEndDateChange(prevVacEnd);
              }}
              title="Previous vacation year: June 1 – May 31"
            >
              VYP
            </Button>
          </div>
        </div>

        <HelpArea helpId="generate-report" bubblePosition="top" showHighlight={false}>
          <Button onClick={onGenerate} disabled={loading || dateRangeInvalid || (requireEmployee && (!selectedEmployeeId || selectedEmployeeId === 'all'))}>
            {loading ? <Spinner /> : 'Generate Report'}
          </Button>
        </HelpArea>

        {actionButtons}
      </div>
    </HelpArea>
  );
}
