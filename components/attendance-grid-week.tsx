"use client";

import { useState } from 'react';
import { MultiEntryDialog } from './multi-entry-dialog';
import type { AttendanceEntry, DailySummary, EntryChangeResult } from '@/lib/attendance-types';
import { useAttendanceCell } from '@/hooks/use-attendance-cell';
import { getWeekDates, formatDateStr, isToday, isWeekend, DAY_NAMES_SHORT } from '@/lib/date-helpers';

interface TimeCode {
  code: string;
  description: string;
}

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface AttendanceGridWeekProps {
  weekStart: Date;
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

export function AttendanceGridWeek({
  weekStart,
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
}: AttendanceGridWeekProps) {
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

  const dates = getWeekDates(weekStart);

  const handleCardClick = (date: Date) => {
    const dateStr = formatDateStr(date);
    const entriesForDate = getEntriesForDate(dateStr);
    setSelectedDate(dateStr);
    setSelectedEntries(entriesForDate);
    setDialogOpen(true);
  };

  const handleSave = (date: string, updatedEntries: AttendanceEntry[], originalDate?: string) => {
    return onEntryChange(date, updatedEntries, undefined, originalDate);
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {dates.map((date, index) => {
          const dateStr = formatDateStr(date);
          const isCompanyHoliday = companyHolidays.has(dateStr);
          const isTodayDate = isToday(date);
          const isWeekendDay = isWeekend(date);
          const entriesForDate = getEntriesForDate(dateStr);
          const fullness = getFullnessInfo(dateStr);
          const totalHours = entriesForDate.reduce((sum, e) => sum + e.hours, 0);

          return (
            <div
              key={dateStr}
              className={`border rounded-lg overflow-hidden cursor-pointer transition-colors hover:border-primary/50 ${
                isTodayDate ? 'ring-2 ring-primary' : ''
              } ${isCompanyHoliday ? 'bg-muted/30' : ''} ${
                isWeekendDay ? 'bg-muted/10' : ''
              }`}
              onClick={() => !isCompanyHoliday && handleCardClick(date)}
            >
              {/* Day header */}
              <div className={`px-2 py-1.5 border-b text-xs font-medium ${
                isTodayDate ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}>
                <div className="flex justify-between items-center">
                  <span>{DAY_NAMES_SHORT[index]}</span>
                  <span>{SHORT_MONTH_NAMES[date.getMonth()]} {date.getDate()}</span>
                </div>
              </div>

              {/* Day content */}
              <div className="p-2 min-h-[80px] flex flex-col relative">
                {isCompanyHoliday ? (
                  <div className="text-xs text-muted-foreground italic">Holiday</div>
                ) : entriesForDate.length === 0 ? (
                  null
                ) : (
                  <div className="space-y-1 flex-1">
                    {entriesForDate.map((entry, entryIndex) => (
                      <div
                        key={entry.id || entryIndex}
                        className={`text-xs px-1.5 py-0.5 rounded ${getCellColorClass([entry])}`}
                        title={timeCodes.find(t => t.code === entry.time_code)?.description ?? entry.time_code}
                      >
                        <span className="font-mono font-semibold">{entry.time_code}</span>
                        <span className="text-muted-foreground"> ({entry.hours}h)</span>
                        {entry.notes && (
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {entry.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Total hours */}
                {entriesForDate.length > 0 && (
                  <div className="text-[10px] text-muted-foreground text-right mt-1 pt-1 border-t">
                    Total: {totalHours}h
                  </div>
                )}

                {/* Out-of-office badge */}
                {fullness && fullness.outCount > 0 && (
                  <span
                    className={`absolute top-1 right-1 text-[9px] leading-none font-bold rounded px-1 py-0.5 ${
                      fullness.isOverLimit
                        ? 'bg-red-200 text-red-700'
                        : 'bg-sky-200 text-sky-700'
                    }`}
                    title={`${fullness.outCount}${maxOutOfOffice > 0 ? `/${maxOutOfOffice}` : ''} out of office`}
                  >
                    {fullness.outCount} out
                  </span>
                )}
              </div>

              {/* Fullness bar */}
              {fullness && (
                <div className="h-[2px] w-full bg-gray-200">
                  <div
                    className={`h-full ${fullness.barColor} transition-all`}
                    style={{ width: `${Math.max(fullness.inOfficePercent, 2)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
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
