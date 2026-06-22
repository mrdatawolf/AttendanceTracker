"use client";

import { Button } from '@/components/ui/button';
import { HelpArea } from '@/components/help-area';
import { Parser } from 'json2csv';

interface ReportExportProps {
  data: any[];
  filename?: string;
  disabled?: boolean;
  columns?: string[];
}

export function ReportExport({
  data,
  filename = 'report.csv',
  disabled = false,
  columns,
}: ReportExportProps) {
  const handleExportCsv = () => {
    if (data.length === 0) return;

    const json2csvParser = columns
      ? new Parser({ fields: columns })
      : new Parser();
    const csv = json2csvParser.parse(data);

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
        disabled={disabled || data.length === 0}
        variant="outline"
      >
        Export CSV
      </Button>
    </HelpArea>
  );
}
