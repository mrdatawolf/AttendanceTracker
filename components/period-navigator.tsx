"use client";

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ViewType } from '@/lib/attendance-types';
import { getWeekDates, formatDateStr } from '@/lib/date-helpers';

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

interface PeriodNavigatorProps {
  view: ViewType;
  year: number;
  currentDate: Date;
  onToday: () => void;
  onYearChange: (year: number) => void;
  onMonthChange?: (month: number) => void;
  onWeekChange?: (weekStart: Date) => void;
  showYearPicker?: boolean;
}

export function PeriodNavigator({
  view,
  year,
  currentDate,
  onToday,
  onYearChange,
  onMonthChange,
  onWeekChange,
  showYearPicker = true,
}: PeriodNavigatorProps) {
  const years = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - 2 + i
  );

  const currentWeekMonday = view === 'week' ? formatDateStr(getWeekDates(currentDate)[0]) : '';
  const weeksInMonth = view === 'week'
    ? getWeeksInMonth(currentDate.getFullYear(), currentDate.getMonth())
    : [];

  return (
    <div className="inline-flex items-center gap-1.5">
      {/* Month dropdown — month and week views */}
      {(view === 'month' || view === 'week') && (
        <Select
          value={currentDate.getMonth().toString()}
          onValueChange={(value) => onMonthChange?.(parseInt(value))}
        >
          <SelectTrigger className="h-9 w-[118px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, idx) => (
              <SelectItem key={idx} value={idx.toString()}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Week dropdown — week view only */}
      {view === 'week' && (
        <Select
          value={currentWeekMonday}
          onValueChange={(value) => {
            const [y, m, d] = value.split('-').map(Number);
            onWeekChange?.(new Date(y, m - 1, d));
          }}
        >
          <SelectTrigger className="h-9 w-[118px] text-sm">
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
      )}

      {/* Year picker (kept for backward compat when showYearPicker is true) */}
      {showYearPicker && view !== 'year' && (
        <Select
          value={year.toString()}
          onValueChange={(value) => onYearChange(parseInt(value))}
        >
          <SelectTrigger className="h-9 w-[80px] text-sm">
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
      )}

      <Button
        variant="outline"
        size="sm"
        className="h-9 text-sm px-3"
        onClick={onToday}
      >
        Today
      </Button>
    </div>
  );
}
