"use client";

import { Button } from '@/components/ui/button';
import { HelpArea } from '@/components/help-area';
import { prepareVacationTransparencyCsvData, type VacationTransparencyData } from './vacation-transparency-report';

interface VacationTransparencyExportProps {
  data: VacationTransparencyData | null;
  filename?: string;
  disabled?: boolean;
}

export function VacationTransparencyExport({
  data,
  filename = 'vacation_transparency.csv',
  disabled = false,
}: VacationTransparencyExportProps) {
  const handleExportCsv = () => {
    if (!data || data.employees.length === 0) return;

    const { headers, rows } = prepareVacationTransparencyCsvData(data);

    const csvLines: string[] = [];
    csvLines.push(headers.map(h => `"${h}"`).join(','));

    for (const row of rows) {
      csvLines.push(row.map(cell => {
        if (typeof cell === 'string') {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return String(cell);
      }).join(','));
    }

    const csv = csvLines.join('\n');

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
