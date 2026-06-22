"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Spinner } from '@/components/spinner';

interface SummaryRow {
  timeCode: string;
  description: string;
  days: number;
  hoursUsed: number;
  hoursAvail: number | string | null;
  usageLimit: number | null;
}

export interface AttendanceManagementData {
  header: {
    employeeName: string;
    department: string;
    startDate: string;
    endDate: string;
  };
  summary: SummaryRow[];
  dayOfWeekBreakdown: Record<string, number>;
  details: Array<{
    date: string;
    dayOfWeek: string;
    type: string;
    time: number;
    reasonGiven: string;
  }>;
}

interface AttendanceManagementReportProps {
  data: AttendanceManagementData | null;
  loading: boolean;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${parseInt(month)}/${parseInt(day)}/${year}`;
}

export function AttendanceManagementReport({ data, loading }: AttendanceManagementReportProps) {
  if (loading) {
    return (
      <div className="border rounded-lg p-2 flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="border rounded-lg p-2 text-center text-muted-foreground">
        Select an employee and click Generate Report.
      </div>
    );
  }

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const totalEntries = dayOrder.reduce((sum, day) => sum + (data.dayOfWeekBreakdown[day] || 0), 0);

  return (
    <div className="space-y-2">
      {/* Report Title */}
      <h2 className="text-xl font-bold text-center">Attendance Management Report</h2>

      {/* Header Section */}
      <div className="border rounded-lg p-2">
        <table className="w-auto">
          <tbody>
            <tr>
              <td className="font-semibold pr-4 py-1">Department:</td>
              <td className="py-1">{data.header.department}</td>
            </tr>
            <tr>
              <td className="font-semibold pr-4 py-1">Employee Name:</td>
              <td className="py-1">{data.header.employeeName}</td>
            </tr>
            <tr>
              <td className="font-semibold pr-4 py-1">Date Range From:</td>
              <td className="py-1">
                {formatDate(data.header.startDate)}
                <span className="mx-2 font-semibold">To:</span>
                {formatDate(data.header.endDate)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary Row: Time Code Summary + Day-of-Week Breakdown */}
      <div className="flex flex-col lg:flex-row gap-2">
        {/* Left Panel: Time Code Summary */}
        <div className="flex-1 border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]"></TableHead>
                <TableHead className="text-center">Days</TableHead>
                <TableHead className="text-center">Hrs Used</TableHead>
                <TableHead className="text-center">Hrs Avail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.summary.map(row => (
                <TableRow key={row.timeCode}>
                  <TableCell className="font-medium">{row.description}</TableCell>
                  <TableCell className="text-center">
                    {row.days > 0 ? row.days : ''}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.hoursUsed > 0 ? row.hoursUsed.toFixed(2) : ''}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.hoursAvail != null
                      ? typeof row.hoursAvail === 'string'
                        ? (<>
                            <div>{row.hoursAvail}</div>
                            {row.usageLimit != null && (
                              <div className="text-xs text-muted-foreground">
                                {row.hoursUsed}h / {row.usageLimit}h
                              </div>
                            )}
                          </>)
                        : row.hoursAvail.toFixed(2)
                      : ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Right Panel: Day-of-Week Breakdown */}
        <div className="w-full lg:w-64 border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead className="text-center">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayOrder.map(day => {
                const count = data.dayOfWeekBreakdown[day] || 0;
                return (
                  <TableRow key={day}>
                    <TableCell>{day}</TableCell>
                    <TableCell className="text-center">
                      {count > 0 ? count : ''}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-semibold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-center">{totalEntries > 0 ? totalEntries : ''}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Table */}
      {data.details.length > 0 && (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Time</TableHead>
                <TableHead>Reason Given</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.details.map((entry, i) => (
                <TableRow key={i}>
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell>{entry.dayOfWeek}</TableCell>
                  <TableCell>{entry.type}</TableCell>
                  <TableCell className="text-center">{entry.time.toFixed(2)}</TableCell>
                  <TableCell>{entry.reasonGiven}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
