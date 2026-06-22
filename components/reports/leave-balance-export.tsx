"use client";

import { Button } from '@/components/ui/button';
import { HelpArea } from '@/components/help-area';
import { prepareLeaveBalanceCsvData } from './leave-balance-summary';

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

interface LeaveBalanceExportProps {
  data: LeaveBalanceSummaryData | null;
  filename?: string;
  disabled?: boolean;
}

export function LeaveBalanceExport({
  data,
  filename = 'leave_balance_summary.csv',
  disabled = false,
}: LeaveBalanceExportProps) {
  const handleExportCsv = () => {
    if (!data || data.employees.length === 0) return;

    const { headers, rows } = prepareLeaveBalanceCsvData(data);

    // Build CSV content
    const csvLines: string[] = [];

    // Add header row
    csvLines.push(headers.map(h => `"${h}"`).join(','));

    // Add data rows
    for (const row of rows) {
      csvLines.push(row.map(cell => {
        if (typeof cell === 'string') {
          // Escape quotes and wrap in quotes
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return String(cell);
      }).join(','));
    }

    const csv = csvLines.join('\n');

    // Download the file
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
        disabled={disabled || !data || data.employees.length === 0}
        variant="outline"
      >
        Export CSV
      </Button>
    </HelpArea>
  );
}
