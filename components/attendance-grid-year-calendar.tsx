"use client";

import { useState } from 'react';
import { MultiEntryDialog } from './multi-entry-dialog';
import type { AttendanceEntry, DailySummary, EntryChangeResult } from '@/lib/attendance-types';
import { useAttendanceCell } from '@/hooks/use-attendance-cell';
import { getMonthCalendarGrid, formatDateStr, isToday, isWeekend } from '@/lib/date-helpers';

interface TimeCode {
  code: string;
  description: string;
}

interface AttendanceGridYearCalendarProps {
  year: number;
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// --- MonthCard sub-component ---

interface MonthCardProps {
  year: number;
  month: number; // 1-12
  companyHolidays: Set<string>;
  maxOutOfOffice: number;
  cellHook: ReturnType<typeof useAttendanceCell>;
  onCellClick: (date: Date) => void;
}

function MonthCard({ year, month, companyHolidays, maxOutOfOffice, cellHook, onCellClick }: MonthCardProps) {
  const weeks = getMonthCalendarGrid(year, month);
  const { getEntriesForDate, getCellDisplay, getCellColorClass, getFullnessInfo, hasNotes } = cellHook;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Month header */}
      <div className="bg-muted px-2 py-1 text-sm font-semibold text-center">
        {MONTH_NAMES[month - 1]}
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            {DAY_LETTERS.map((letter, i) => (
              <th
                key={i}
                className={`text-[10px] font-medium text-center p-0.5 ${
                  i >= 5 ? 'text-muted-foreground' : ''
                }`}
              >
                {letter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map(date => {
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
                    className={`p-0 text-center ${
                      !isCurrentMonth ? 'opacity-20' : ''
                    } ${isCompanyHoliday && isCurrentMonth ? 'bg-muted/30' : ''} ${
                      isWeekendDay && isCurrentMonth ? 'bg-muted/10' : ''
                    }`}
                  >
                    <div
                      className={`relative min-h-[28px] flex flex-col items-center justify-center ${
                        isClickable ? 'cursor-pointer hover:bg-accent/50' : ''
                      } ${isTodayDate ? 'ring-1 ring-inset ring-primary rounded-sm' : ''} ${
                        isClickable ? getCellColorClass(entriesForDate) : ''
                      }`}
                      onClick={() => isClickable && onCellClick(date)}
                      title={isClickable ? `${dateStr}: ${getCellDisplay(entriesForDate)}` : undefined}
                    >
                      {/* Day number */}
                      <span className={`text-[9px] leading-none ${
                        isTodayDate ? 'font-bold text-primary' : 'text-muted-foreground'
                      }`}>
                        {date.getDate()}
                      </span>

                      {/* Entry indicator */}
                      {isClickable && entriesForDate.length > 0 && (
                        <span className="text-[8px] leading-none font-semibold truncate max-w-full">
                          {entriesForDate.length === 1
                            ? entriesForDate[0].time_code
                            : `*${entriesForDate.length}`}
                        </span>
                      )}

                      {/* Notes dot */}
                      {isClickable && hasNotes(entriesForDate) && (
                        <div className="absolute top-0 right-0 w-1 h-1 bg-blue-500 rounded-full" />
                      )}

                      {/* Out-of-office count */}
                      {fullness && fullness.outCount > 0 && (
                        <span
                          className={`absolute bottom-0 left-0 text-[6px] leading-none font-bold px-px ${
                            fullness.isOverLimit ? 'text-red-600' : 'text-sky-600'
                          }`}
                          title={`${fullness.outCount}${maxOutOfOffice > 0 ? `/${maxOutOfOffice}` : ''} out of office`}
                        >
                          {fullness.outCount}
                        </span>
                      )}
                    </div>

                    {/* Capacity bar */}
                    {fullness && isCurrentMonth && (
                      <div className="h-[1px] w-full bg-gray-200">
                        <div
                          className={`h-full ${fullness.barColor}`}
                          style={{ width: `${Math.max(fullness.inOfficePercent, 2)}%` }}
                        />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Main component ---

export function AttendanceGridYearCalendar({
  year,
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
}: AttendanceGridYearCalendarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<AttendanceEntry[]>([]);

  const cellHook = useAttendanceCell({
    entries,
    dailySummary,
    totalActiveEmployees,
    maxOutOfOffice,
    capacityWarningCount,
    capacityCriticalCount,
  });

  const handleCellClick = (date: Date) => {
    const dateStr = formatDateStr(date);
    const entriesForDate = cellHook.getEntriesForDate(dateStr);
    setSelectedDate(dateStr);
    setSelectedEntries(entriesForDate);
    setDialogOpen(true);
  };

  const handleSave = (date: string, updatedEntries: AttendanceEntry[], originalDate?: string) => {
    return onEntryChange(date, updatedEntries, undefined, originalDate);
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
          <MonthCard
            key={month}
            year={year}
            month={month}
            companyHolidays={companyHolidays}
            maxOutOfOffice={maxOutOfOffice}
            cellHook={cellHook}
            onCellClick={handleCellClick}
          />
        ))}
      </div>
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
