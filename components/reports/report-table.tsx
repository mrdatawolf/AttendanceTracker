"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Spinner } from '@/components/spinner';
import { HelpArea } from '@/components/help-area';

interface Column {
  key: string;
  header: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface ReportTableProps {
  columns: Column[];
  data: any[];
  loading: boolean;
  emptyMessage?: string;
  helpId?: string;
}

export function ReportTable({
  columns,
  data,
  loading,
  emptyMessage = 'No results found.',
  helpId = 'report-results',
}: ReportTableProps) {
  return (
    <HelpArea helpId={helpId} bubblePosition="top">
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={col.key}>{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <Spinner />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow key={index}>
                  {columns.map(col => (
                    <TableCell key={col.key}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </HelpArea>
  );
}
