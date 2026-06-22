"use client";

import { Button } from '@/components/ui/button';
import { HelpArea } from '@/components/help-area';
import type { AttendanceManagementData } from './attendance-management-report';

interface AttendanceManagementExportProps {
  data: AttendanceManagementData | null;
  filename?: string;
  disabled?: boolean;
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function AttendanceManagementExport({
  data,
  filename = 'attendance_management_report.csv',
  disabled = false,
}: AttendanceManagementExportProps) {
  const handleExportCsv = () => {
    if (!data) return;

    const lines: string[] = [];

    // Header section
    lines.push('Attendance Management Report');
    lines.push(`Department,${escapeCsv(data.header.department)}`);
    lines.push(`Employee,${escapeCsv(data.header.employeeName)}`);
    lines.push(`Date Range,${escapeCsv(data.header.startDate)} to ${escapeCsv(data.header.endDate)}`);
    lines.push('');

    // Summary section
    lines.push('TIME CODE SUMMARY');
    lines.push('Time Code,Description,Days,Hrs Used,Hrs Avail');
    for (const row of data.summary) {
      lines.push([
        escapeCsv(row.timeCode),
        escapeCsv(row.description),
        row.days > 0 ? String(row.days) : '',
        row.hoursUsed > 0 ? row.hoursUsed.toFixed(2) : '',
        row.hoursAvail != null ? escapeCsv(typeof row.hoursAvail === 'string' ? row.hoursAvail : row.hoursAvail.toFixed(2)) : '',
      ].join(','));
    }
    lines.push('');

    // Day-of-week breakdown
    lines.push('DAY OF WEEK BREAKDOWN');
    lines.push('Day,Count');
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let total = 0;
    for (const day of dayOrder) {
      const count = data.dayOfWeekBreakdown[day] || 0;
      total += count;
      lines.push(`${day},${count > 0 ? count : ''}`);
    }
    lines.push(`Total,${total > 0 ? total : ''}`);
    lines.push('');

    // Detail section
    lines.push('DETAIL');
    lines.push('Date,Day,Type,Time,Reason Given');
    for (const entry of data.details) {
      lines.push([
        escapeCsv(entry.date),
        escapeCsv(entry.dayOfWeek),
        escapeCsv(entry.type),
        entry.time.toFixed(2),
        escapeCsv(entry.reasonGiven),
      ].join(','));
    }

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <HelpArea helpId="export-csv" bubblePosition="top" showHighlight={false}>
      <Button
        onClick={handleExportCsv}
        disabled={disabled || !data}
        variant="outline"
      >
        Export CSV
      </Button>
    </HelpArea>
  );
}
