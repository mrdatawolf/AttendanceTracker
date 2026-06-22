"use client";

import { useState, useMemo, useEffect } from 'react';
import { MultiEntryDialog } from './multi-entry-dialog';
import type { AttendanceEntry, EntryChangeResult } from '@/lib/attendance-types';
import { CELL_BG_COLOR_MAP } from '@/hooks/use-attendance-cell';
import { getWeekDates, formatDateStr, isToday, isWeekend, DAY_NAMES_SHORT } from '@/lib/date-helpers';
import { useAuth } from '@/lib/auth-context';

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  employee_number?: string;
  group_id?: number;
}

interface TimeCode {
  code: string;
  description: string;
}

interface TimeCodeColorInfo {
  code: string;
  defaultColor: string;
}

interface ColorConfig {
  config_type: string;
  config_key: string;
  color_name: string;
}

interface AttendanceGridStaffProps {
  employees: Employee[];
  allEntries: AttendanceEntry[];
  timeCodes: TimeCode[];
  year: number;
  month: number; // 1-12 — used for both month and week view to determine days
  weekStart?: Date;
  viewType: 'month' | 'week';
  companyHolidays: Set<string>;
  onEntryChange: (date: string, entries: AttendanceEntry[], employeeId: number, originalDate?: string) => Promise<EntryChangeResult>;
}

const SHORT_MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function AttendanceGridStaff({
  employees,
  allEntries,
  timeCodes,
  year,
  month,
  weekStart,
  viewType,
  companyHolidays,
  onEntryChange,
}: AttendanceGridStaffProps) {
  const { authFetch } = useAuth();
  const [timeCodeColors, setTimeCodeColors] = useState<Map<string, string>>(new Map());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState('');
  const [dialogEntries, setDialogEntries] = useState<AttendanceEntry[]>([]);
  const [dialogEmployeeId, setDialogEmployeeId] = useState<number>(0);

  useEffect(() => {
    authFetch('/api/color-config').then(async res => {
      if (!res.ok) return;
      const data = await res.json();
      const map = new Map<string, string>();
      if (data.timeCodes) {
        (data.timeCodes as TimeCodeColorInfo[]).forEach(tc => {
          if (tc.defaultColor) map.set(tc.code, tc.defaultColor);
        });
      }
      if (data.colorConfigs) {
        (data.colorConfigs as ColorConfig[]).forEach(cfg => {
          if (cfg.config_type === 'time_code') map.set(cfg.config_key, cfg.color_name);
        });
      }
      setTimeCodeColors(map);
    }).catch(() => {});
  }, [authFetch]);

  // Build days array for the current view
  const days: Date[] = useMemo(() => {
    if (viewType === 'week' && weekStart) {
      return getWeekDates(weekStart);
    }
    // Month view: all days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month - 1, i + 1));
  }, [viewType, year, month, weekStart]);

  // Group all entries by employee_id then by date
  const entriesByEmployeeDate = useMemo(() => {
    const map = new Map<number, Map<string, AttendanceEntry[]>>();
    for (const entry of allEntries) {
      if (entry.employee_id == null) continue;
      if (!map.has(entry.employee_id)) map.set(entry.employee_id, new Map());
      const dateMap = map.get(entry.employee_id)!;
      const existing = dateMap.get(entry.entry_date) || [];
      existing.push(entry);
      dateMap.set(entry.entry_date, existing);
    }
    return map;
  }, [allEntries]);

  const getEntriesForCell = (employeeId: number, dateStr: string): AttendanceEntry[] =>
    entriesByEmployeeDate.get(employeeId)?.get(dateStr) ?? [];

  const getCellColorClass = (entries: AttendanceEntry[]): string => {
    if (entries.length === 0) return '';
    if (entries.length === 1) {
      const color = timeCodeColors.get(entries[0].time_code);
      return color ? (CELL_BG_COLOR_MAP[color] || '') : '';
    }
    return CELL_BG_COLOR_MAP.gray || '';
  };

  const getCellLabel = (entries: AttendanceEntry[]): string => {
    if (entries.length === 0) return '';
    if (entries.length === 1) return entries[0].time_code;
    const total = entries.reduce((s, e) => s + e.hours, 0);
    return `*${total}`;
  };

  const handleCellClick = (employeeId: number, date: Date) => {
    const dateStr = formatDateStr(date);
    if (companyHolidays.has(dateStr)) return;
    setDialogDate(dateStr);
    setDialogEntries(getEntriesForCell(employeeId, dateStr));
    setDialogEmployeeId(employeeId);
    setDialogOpen(true);
  };

  if (employees.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">No employees to display.</p>;
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="border-collapse text-xs" style={{ minWidth: 'max-content' }}>
        <thead>
          <tr className="bg-muted">
            {/* Sticky employee column header */}
            <th className="border px-2 py-1.5 text-left font-semibold sticky left-0 bg-muted z-10 min-w-[140px]">
              Employee
            </th>
            {days.map((day, i) => {
              const dateStr = formatDateStr(day);
              const isHoliday = companyHolidays.has(dateStr);
              const isTodayDate = isToday(day);
              const isWeekendDay = isWeekend(day);
              return (
                <th
                  key={dateStr}
                  className={`border px-1 py-1 text-center font-medium min-w-[38px] ${
                    isTodayDate ? 'bg-primary text-primary-foreground' : ''
                  } ${isHoliday ? 'text-muted-foreground' : ''} ${
                    isWeekendDay && !isTodayDate ? 'text-muted-foreground' : ''
                  }`}
                >
                  {viewType === 'week' ? (
                    <div className="leading-tight">
                      <div>{DAY_NAMES_SHORT[i]}</div>
                      <div className="font-normal">{SHORT_MONTH[day.getMonth()]} {day.getDate()}</div>
                    </div>
                  ) : (
                    <div className="leading-tight">
                      <div className="text-[10px] font-normal">{DAY_NAMES_SHORT[day.getDay()]}</div>
                      <div>{day.getDate()}</div>
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id} className="hover:bg-muted/30">
              {/* Sticky name cell */}
              <td className="border px-2 py-1 sticky left-0 bg-background z-10 font-medium whitespace-nowrap">
                {emp.last_name}, {emp.first_name}
                {emp.employee_number && (
                  <span className="text-muted-foreground font-normal ml-1">({emp.employee_number})</span>
                )}
              </td>
              {days.map(day => {
                const dateStr = formatDateStr(day);
                const isHoliday = companyHolidays.has(dateStr);
                const isTodayDate = isToday(day);
                const isWeekendDay = isWeekend(day);
                const cellEntries = getEntriesForCell(emp.id, dateStr);
                const colorClass = getCellColorClass(cellEntries);
                const label = getCellLabel(cellEntries);
                const hasNote = cellEntries.some(e => e.notes?.trim());

                return (
                  <td
                    key={dateStr}
                    className={`border p-0 text-center ${
                      isHoliday ? 'bg-muted/30' : isWeekendDay ? 'bg-muted/10' : ''
                    } ${isTodayDate ? 'ring-1 ring-inset ring-primary' : ''}`}
                  >
                    <button
                      className={`w-full h-full min-h-[28px] px-0.5 py-0.5 relative flex items-center justify-center transition-colors ${
                        isHoliday ? 'cursor-default' : 'cursor-pointer hover:brightness-95'
                      } ${colorClass}`}
                      onClick={() => !isHoliday && handleCellClick(emp.id, day)}
                      title={isHoliday ? 'Holiday' : cellEntries.map(e => `${e.time_code} ${e.hours}h${e.notes ? ` — ${e.notes}` : ''}`).join(', ') || undefined}
                      disabled={isHoliday}
                    >
                      <span className="font-mono font-semibold text-[10px] leading-none">
                        {isHoliday ? '—' : label}
                      </span>
                      {hasNote && !isHoliday && (
                        <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      )}
                    </button>
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
        date={dialogDate}
        entries={dialogEntries}
        timeCodes={timeCodes}
        onSave={(date, updatedEntries, originalDate) =>
          onEntryChange(date, updatedEntries, dialogEmployeeId, originalDate)
        }
      />
    </div>
  );
}
