"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MultiEntryDialog } from './multi-entry-dialog';
import type { AttendanceEntry, DailySummary, EntryChangeResult } from '@/lib/attendance-types';
import { useAttendanceCell } from '@/hooks/use-attendance-cell';
import { getMonthCalendarGrid, formatDateStr, isToday, isWeekend, DAY_NAMES_SHORT } from '@/lib/date-helpers';

interface TimeCode {
  code: string;
  description: string;
}

interface AttendanceGridMonthProps {
  year: number;
  month: number; // 1-12
  employeeId: number;
  entries: AttendanceEntry[];
  timeCodes: TimeCode[];
  onEntryChange: (date: string, entries: AttendanceEntry[], employeeId?: number, originalDate?: string) => Promise<EntryChangeResult>;
  companyHolidays?: Set<string>;
  dailySummary?: DailySummary | null;
  totalActiveEmployees?: number;
  maxOutOfOffice?: number;
  capacityWarningCount?: number;
  capacityCriticalCount?: number;
  employeeNameMap?: Record<number, string>;
  readOnly?: boolean;
}

export function AttendanceGridMonth({
  year,
  month,
  employeeId,
  entries,
  timeCodes,
  onEntryChange,
  companyHolidays = new Set(),
  dailySummary,
  totalActiveEmployees,
  maxOutOfOffice = 0,
  capacityWarningCount = 3,
  capacityCriticalCount = 5,
  employeeNameMap,
  readOnly,
}: AttendanceGridMonthProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<AttendanceEntry[]>([]);

  const {
    getEntriesForDate,
    getCellDisplay,
    getCellColorClass,
    getFullnessInfo,
    hasNotes,
  } = useAttendanceCell({
    entries,
    dailySummary,
    totalActiveEmployees,
    maxOutOfOffice,
    capacityWarningCount,
    capacityCriticalCount,
  });

  const weeks = getMonthCalendarGrid(year, month);

  const handleCellClick = (date: Date) => {
    const dateStr = formatDateStr(date);
    const entriesForDate = getEntriesForDate(dateStr);
    setSelectedDate(dateStr);
    setSelectedEntries(entriesForDate);
    setDialogOpen(true);
  };

  const handleSave = (date: string, updatedEntries: AttendanceEntry[], originalDate?: string) => {
    return onEntryChange(date, updatedEntries, undefined, originalDate);
  };

  const getCellTooltip = (entries: AttendanceEntry[]): string => {
    if (entries.length === 0) return '';
    return entries
      .map(e => {
        const tc = timeCodes.find(t => t.code === e.time_code);
        return `${tc ? tc.description : e.time_code}: ${e.hours}h`;
      })
      .join('\n');
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-muted">
            {DAY_NAMES_SHORT.map((day, i) => (
              <th
                key={day}
                className={`border p-1.5 text-xs font-semibold text-center ${
                  i >= 5 ? 'text-muted-foreground' : ''
                }`}
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((date) => {
                const dateStr = formatDateStr(date);
                const isCurrentMonth = date.getMonth() === month - 1;
                const isCompanyHoliday = companyHolidays.has(dateStr);
                const isTodayDate = isToday(date);
                const isWeekendDay = isWeekend(date);
                const isClickable = isCurrentMonth && !isCompanyHoliday;
                const entriesForDate = getEntriesForDate(dateStr);
                const fullness = isCurrentMonth ? getFullnessInfo(dateStr) : null;

                return (
                  <td
                    key={dateStr}
                    className={`border p-0.5 align-top h-18 ${
                      !isCurrentMonth ? 'bg-muted/20' : ''
                    } ${isCompanyHoliday ? 'bg-muted/30' : ''} ${
                      isWeekendDay && isCurrentMonth ? 'bg-muted/10' : ''
                    } ${isTodayDate ? 'ring-2 ring-inset ring-primary' : ''}`}
                  >
                    <div className="min-h-[56px] flex flex-col">
                      {/* Day number */}
                      <div className={`text-xs px-1 ${
                        !isCurrentMonth ? 'text-muted-foreground/40' : ''
                      } ${isTodayDate ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                        {date.getDate()}
                      </div>

                      {/* Entry content */}
                      {isClickable && (
                        <div className="flex-1 relative">
                          <Button
                            variant="ghost"
                            className={`h-auto min-h-[32px] text-xs w-full px-1 py-0.5 justify-start relative ${getCellColorClass(entriesForDate)}`}
                            onClick={() => handleCellClick(date)}
                            title={getCellTooltip(entriesForDate)}
                          >
                            <span className="truncate">
                              {entriesForDate.length > 0 ? getCellDisplay(entriesForDate) : ''}
                            </span>
                            {hasNotes(entriesForDate) && (
                              <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            )}
                          </Button>
                          {/* Out-of-office count badge */}
                          {fullness && fullness.outCount > 0 && (
                            <span
                              className={`absolute top-0 left-0 text-[8px] leading-none font-bold rounded-br px-0.5 py-px z-10 ${
                                fullness.isOverLimit
                                  ? 'bg-red-200 text-red-700'
                                  : 'bg-sky-200 text-sky-700'
                              }`}
                              title={`${fullness.outCount}${maxOutOfOffice > 0 ? `/${maxOutOfOffice}` : ''} out of office`}
                            >
                              {fullness.outCount}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Fullness bar at bottom */}
                      {fullness && isCurrentMonth && (
                        <div className="h-[2px] w-full bg-gray-200 rounded-full overflow-hidden mt-auto">
                          <div
                            className={`h-full ${fullness.barColor} transition-all`}
                            style={{ width: `${Math.max(fullness.inOfficePercent, 2)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <MultiEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        date={selectedDate}
        entries={selectedEntries}
        timeCodes={timeCodes}
        onSave={handleSave}
        employeeNameMap={employeeNameMap}
        readOnly={readOnly}
      />
    </div>
  );
}
