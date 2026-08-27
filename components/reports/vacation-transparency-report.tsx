"use client";

import { Fragment, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/spinner';
import { ChevronDown, ChevronRight, Info, Search } from 'lucide-react';

export interface VacationTransparencyRow {
  id: number;
  name: string;
  job_title: string | null;
  group_name: string | null;
  employment_type: string | null;
  date_of_hire: string | null;
  vacation_hours: number | null;
  vacation_days: number | null;
  basis: 'override' | 'employee_rule' | 'brand_rule' | 'default' | 'none';
  explanation: string;
  formula_breakdown: string | null;
}

export interface VacationTransparencyData {
  year: number;
  employees: VacationTransparencyRow[];
}

interface VacationTransparencyReportProps {
  data: VacationTransparencyData | null;
  loading: boolean;
}

const COLUMN_COUNT = 7;

const BASIS_LABEL: Record<VacationTransparencyRow['basis'], string> = {
  override: 'Manual',
  employee_rule: 'Negotiated',
  brand_rule: 'Standard tier',
  default: 'Flat',
  none: '—',
};

const BASIS_BADGE_CLASS: Record<VacationTransparencyRow['basis'], string> = {
  override: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  employee_rule: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  brand_rule: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  none: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

// Generic, employee-independent explanation of what each basis *means* —
// shown behind the (i) button, separate from the employee-specific tier
// data in the expanded row.
const BASIS_DEFINITION: Record<VacationTransparencyRow['basis'], string> = {
  override: 'An administrator set this employee\'s vacation balance directly. It does not follow a formula and will not change automatically as their tenure increases.',
  employee_rule: 'This employee has a vacation schedule that was individually negotiated at hire, instead of following the standard company-wide tier.',
  brand_rule: 'This employee follows the standard company-wide vacation tier, based on years of service.',
  default: 'A single fixed amount is applied to every employee for this time code — there is no tiering or formula involved.',
  none: 'No vacation amount could be calculated for this employee — see the explanation for why.',
};

function formatDays(row: VacationTransparencyRow): string {
  if (row.vacation_hours === null) return '—';
  const days = row.vacation_days ?? row.vacation_hours / 8;
  const daysLabel = Number.isInteger(days) ? days : days.toFixed(1);
  return `${daysLabel}d (${row.vacation_hours}h)`;
}

export function VacationTransparencyReport({ data, loading }: VacationTransparencyReportProps) {
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredEmployees = useMemo(() => {
    if (!data?.employees) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.employees;
    return data.employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.job_title || '').toLowerCase().includes(q) ||
      (e.group_name || '').toLowerCase().includes(q)
    );
  }, [data?.employees, search]);

  if (loading) {
    return (
      <div className="border rounded-lg p-2 flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data || data.employees.length === 0) {
    return (
      <div className="border rounded-lg p-2 text-center text-muted-foreground">
        No employees found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative print:hidden max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by name, job title, or group..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Employment</TableHead>
              <TableHead>Date of Hire</TableHead>
              <TableHead>Vacation</TableHead>
              <TableHead>Basis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map(row => {
              const isExpanded = expandedIds.has(row.id);
              return (
                <Fragment key={row.id}>
                  <TableRow>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.job_title || '—'}</TableCell>
                    <TableCell>{row.group_name || '—'}</TableCell>
                    <TableCell className="capitalize">{row.employment_type?.replace('_', ' ') || '—'}</TableCell>
                    <TableCell>{row.date_of_hire || '—'}</TableCell>
                    <TableCell className="font-medium">{formatDays(row)}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(row.id)}
                        aria-expanded={isExpanded}
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${BASIS_BADGE_CLASS[row.basis]} print:hidden`}
                        aria-label={`How ${row.name}'s vacation was calculated`}
                      >
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {BASIS_LABEL[row.basis]}
                      </button>
                      <span className="hidden print:inline text-xs">
                        {row.explanation}
                        {row.formula_breakdown ? ` ${row.formula_breakdown.replace('\n', ' ')}` : ''}
                      </span>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="print:hidden">
                      <TableCell colSpan={COLUMN_COUNT} className="bg-muted/50 text-sm py-2">
                        <div className="flex items-start gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
                                aria-label={`What does "${BASIS_LABEL[row.basis]}" mean?`}
                              >
                                <Info className="h-4 w-4" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 text-sm" side="top" align="start">
                              <p className="font-medium mb-1">{BASIS_LABEL[row.basis]}</p>
                              <p className="text-muted-foreground">{BASIS_DEFINITION[row.basis]}</p>
                              {row.formula_breakdown && (
                                <p className="text-foreground mt-2 pt-2 border-t">{row.explanation}</p>
                              )}
                            </PopoverContent>
                          </Popover>
                          {row.formula_breakdown ? (
                            <div className="space-y-0.5">
                              {row.formula_breakdown.split('\n').map((line, i) => (
                                <div key={i} className={i === 0 ? 'text-muted-foreground' : 'font-mono text-xs'}>
                                  {line}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span>{row.explanation}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {search.trim() && filteredEmployees.length === 0 && (
        <div className="text-center text-muted-foreground text-sm">No employees match your search</div>
      )}
    </div>
  );
}

// Export helper for CSV generation
export function prepareVacationTransparencyCsvData(data: VacationTransparencyData | null): {
  headers: string[];
  rows: (string | number)[][];
} {
  if (!data || data.employees.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = [
    'Name', 'Job Title', 'Group', 'Employment', 'Date of Hire',
    'Vacation Hours', 'Vacation Days', 'Basis', 'Explanation', 'Formula',
  ];

  const rows = data.employees.map(row => [
    row.name,
    row.job_title || '',
    row.group_name || '',
    row.employment_type || '',
    row.date_of_hire || '',
    row.vacation_hours ?? '',
    row.vacation_days ?? '',
    BASIS_LABEL[row.basis],
    row.explanation,
    row.formula_breakdown ? row.formula_breakdown.replace('\n', ' ') : '',
  ]);

  return { headers, rows };
}
