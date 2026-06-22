"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, AlertCircle, CheckCircle2, Loader2, ArrowLeft, ArrowRight, UserPlus } from 'lucide-react';
import {
  type ImportRow,
  type ImportRecord,
  buildAbsenceTypeMapping,
  matchEmployees,
} from '@/lib/import-mappings';
import type { Employee } from '@/lib/queries-sqlite';
import type { BrandTimeCode } from '@/lib/brand-time-codes';

interface ExistingEntry {
  employee_id: number;
  entry_date: string;
}

type Stage = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

interface ImportAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportAttendanceDialog({ open, onOpenChange }: ImportAttendanceDialogProps) {
  const { authFetch } = useAuth();

  const [stage, setStage] = useState<Stage>('upload');
  const [error, setError] = useState('');

  // Data from Excel
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);

  // Reference data from DB
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timeCodes, setTimeCodes] = useState<BrandTimeCode[]>([]);
  const [existingEntries, setExistingEntries] = useState<ExistingEntry[]>([]);

  // Mappings (user-editable)
  const [employeeMap, setEmployeeMap] = useState<Record<string, number | null>>({});
  const [absenceMap, setAbsenceMap] = useState<Record<string, string>>({});

  // Per-row time code overrides (for rows whose absence type has no global mapping)
  // Key: row index, Value: time code string
  const [rowTimeCodeOverrides, setRowTimeCodeOverrides] = useState<Record<number, string>>({});

  // Duplicate overwrite selections
  const [overwriteSet, setOverwriteSet] = useState<Set<string>>(new Set());

  // Create employee inline
  const [creatingFor, setCreatingFor] = useState<string | null>(null); // Excel name being created
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Import results
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [importProgress, setImportProgress] = useState(false);

  // Load employees and time codes when dialog opens
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const [empRes, tcRes] = await Promise.all([
          authFetch('/api/employees'),
          authFetch('/api/time-codes'),
        ]);
        if (empRes.ok) {
          const data = await empRes.json();
          setEmployees(Array.isArray(data) ? data : data.employees || []);
        }
        if (tcRes.ok) {
          const data = await tcRes.json();
          setTimeCodes(Array.isArray(data) ? data : data.timeCodes || []);
        }
      } catch {
        // non-fatal
      }
    };
    load();
  }, [open, authFetch]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStage('upload');
      setError('');
      setParsedRows([]);
      setEmployeeMap({});
      setAbsenceMap({});
      setOverwriteSet(new Set());
      setRowTimeCodeOverrides({});
      setExistingEntries([]);
      setImportResult(null);
    }
  }, [open]);

  // Start creating a new employee for an unmatched Excel name
  const startCreateEmployee = (excelName: string) => {
    const parts = excelName.split(',').map(s => s.trim());
    setCreatingFor(excelName);
    setNewLastName(parts[0] || '');
    setNewFirstName(parts[1] || '');
    setCreateError('');
  };

  const cancelCreateEmployee = () => {
    setCreatingFor(null);
    setNewFirstName('');
    setNewLastName('');
    setCreateError('');
  };

  const handleCreateEmployee = async () => {
    if (!newFirstName.trim() || !newLastName.trim()) {
      setCreateError('First and last name are required.');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await authFetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: newFirstName.trim(),
          last_name: newLastName.trim(),
          role: 'employee',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || data.message || 'Failed to create employee');
        return;
      }
      // Add to local employees list and auto-map
      setEmployees(prev => [...prev, data]);
      if (creatingFor) {
        setEmployeeMap(prev => ({ ...prev, [creatingFor]: data.id }));
      }
      cancelCreateEmployee();
    } catch {
      setCreateError('Failed to create employee');
    } finally {
      setCreateLoading(false);
    }
  };

  // Parse the Excel file
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheet = workbook.Sheets['Data Table'];
        if (!sheet) {
          setError('Sheet "Data Table" not found in the workbook.');
          return;
        }

        const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });
        if (json.length === 0) {
          setError('No data rows found in the "Data Table" sheet.');
          return;
        }

        const rows: ImportRow[] = json
          .filter((row: any) => row['Last, First'] && row['Date of Absence'])
          .map((row: any) => {
            let dateStr = '';
            const raw = row['Date of Absence'];
            if (typeof raw === 'number') {
              // Excel serial date
              const parsed = XLSX.SSF.parse_date_code(raw);
              dateStr = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
            } else if (raw instanceof Date) {
              dateStr = raw.toISOString().split('T')[0];
            } else if (typeof raw === 'string') {
              dateStr = raw.substring(0, 10);
            }

            return {
              excelName: String(row['Last, First']).trim(),
              lastName: String(row['Last Name'] || '').trim(),
              firstName: String(row['First Name'] || '').trim(),
              dateOfAbsence: dateStr,
              dayOfWeek: String(row['Day of Week'] || '').trim(),
              typeOfAbsence: String(row['Type of Absence'] || '').trim(),
              timeMissed: Number(row['Time Missed']) || 0,
              reasonGiven: String(row['Reason Given'] || '').trim(),
            };
          });

        if (rows.length === 0) {
          setError('No valid data rows found. Check that the sheet has "Last, First" and "Date of Absence" columns.');
          return;
        }

        setParsedRows(rows);

        // Build initial mappings
        const uniqueNames = [...new Set(rows.map(r => r.excelName))];
        const uniqueAbsenceTypes = [...new Set(rows.map(r => r.typeOfAbsence))];

        setEmployeeMap(matchEmployees(uniqueNames, employees));
        setAbsenceMap(buildAbsenceTypeMapping(uniqueAbsenceTypes, timeCodes));

        setStage('mapping');
      } catch (err: any) {
        setError(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [employees, timeCodes]);

  // Unique values for mapping stage
  const uniqueNames = useMemo(() => [...new Set(parsedRows.map(r => r.excelName))], [parsedRows]);
  const uniqueAbsenceTypes = useMemo(() => [...new Set(parsedRows.map(r => r.typeOfAbsence))], [parsedRows]);

  // Check if all employees are mapped (absence types are optional — unmapped ones become row errors in preview)
  const allEmployeesMapped = uniqueNames.every(n => employeeMap[n] != null);
  const unmappedAbsenceCount = uniqueAbsenceTypes.filter(t => !absenceMap[t]).length;
  const canProceedToPreview = allEmployeesMapped;

  // Load existing entries for duplicate detection when entering preview
  const loadExistingEntries = useCallback(async () => {
    const mappedEmployeeIds = [...new Set(Object.values(employeeMap).filter((v): v is number => v != null))];
    if (mappedEmployeeIds.length === 0) return;

    const allEntries: ExistingEntry[] = [];
    // Fetch attendance for each mapped employee
    for (const empId of mappedEmployeeIds) {
      try {
        const res = await authFetch(`/api/attendance?employeeId=${empId}`);
        if (res.ok) {
          const data = await res.json();
          const entries = Array.isArray(data) ? data : data.entries || [];
          for (const e of entries) {
            allEntries.push({ employee_id: e.employee_id, entry_date: e.entry_date });
          }
        }
      } catch {
        // non-fatal
      }
    }
    setExistingEntries(allEntries);
  }, [authFetch, employeeMap]);

  const goToPreview = useCallback(async () => {
    await loadExistingEntries();
    setStage('preview');
  }, [loadExistingEntries]);

  // Build preview rows with status
  const previewRows = useMemo(() => {
    const existingSet = new Set(existingEntries.map(e => `${e.employee_id}:${e.entry_date}`));

    return parsedRows.map((row, idx) => {
      const employeeId = employeeMap[row.excelName];
      // Per-row override takes priority, then global mapping
      const timeCode = rowTimeCodeOverrides[idx] || absenceMap[row.typeOfAbsence] || '';
      const needsMapping = !absenceMap[row.typeOfAbsence] && !rowTimeCodeOverrides[idx];
      const key = `${employeeId}:${row.dateOfAbsence}`;
      const isDuplicate = employeeId != null && !needsMapping && timeCode !== '' && existingSet.has(key);
      const hasError = employeeId == null || !timeCode;

      return {
        ...row,
        idx,
        employeeId,
        timeCode,
        needsMapping,
        isDuplicate,
        hasError,
        rowKey: `${idx}:${key}`,
      };
    });
  }, [parsedRows, employeeMap, absenceMap, rowTimeCodeOverrides, existingEntries]);

  const newCount = previewRows.filter(r => !r.hasError && !r.isDuplicate).length;
  const dupCount = previewRows.filter(r => !r.hasError && r.isDuplicate).length;
  const overwriteCount = previewRows.filter(r => r.isDuplicate && overwriteSet.has(r.rowKey)).length;
  const unmappedRowCount = previewRows.filter(r => r.needsMapping && !r.timeCode).length;
  const errorCount = previewRows.filter(r => r.hasError).length;

  const toggleOverwrite = (rowKey: string) => {
    setOverwriteSet(prev => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const toggleAllOverwrites = () => {
    const dupKeys = previewRows.filter(r => r.isDuplicate && !r.hasError).map(r => r.rowKey);
    if (overwriteCount === dupCount) {
      // Uncheck all
      setOverwriteSet(prev => {
        const next = new Set(prev);
        dupKeys.forEach(k => next.delete(k));
        return next;
      });
    } else {
      // Check all
      setOverwriteSet(prev => {
        const next = new Set(prev);
        dupKeys.forEach(k => next.add(k));
        return next;
      });
    }
  };

  // Execute import
  const handleImport = async () => {
    setImportProgress(true);
    setStage('importing');

    const records: ImportRecord[] = previewRows
      .filter(r => !r.hasError)
      .filter(r => !r.isDuplicate || overwriteSet.has(r.rowKey))
      .map(r => ({
        employee_id: r.employeeId!,
        entry_date: r.dateOfAbsence,
        time_code: r.timeCode,
        hours: r.timeMissed,
        notes: r.reasonGiven,
        overwrite: r.isDuplicate,
      }));

    try {
      const res = await authFetch('/api/import/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      const data = await res.json();
      setImportResult(data);
    } catch (err: any) {
      setImportResult({ imported: 0, skipped: 0, errors: [err.message] });
    } finally {
      setImportProgress(false);
      setStage('done');
    }
  };

  const getEmployeeName = (id: number) => {
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.last_name}, ${emp.first_name}` : `ID: ${id}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Import Attendance Data
            {stage !== 'upload' && stage !== 'done' && (
              <span className="ml-3 text-sm font-normal text-muted-foreground">
                Step {stage === 'mapping' ? '1: Map Data' : stage === 'preview' ? '2: Review' : '3: Importing'}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {/* STAGE: Upload */}
          {stage === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">Upload Excel File</p>
              <p className="text-sm text-muted-foreground">
                Select an .xlsx or .xlsm file with a &quot;Data Table&quot; sheet
              </p>
              <input
                type="file"
                accept=".xlsx,.xlsm"
                onChange={handleFileUpload}
                className="block text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
              />
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* STAGE: Mapping */}
          {stage === 'mapping' && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Parsed {parsedRows.length} rows from the Excel file. Review and adjust the mappings below.
              </p>

              {/* Employee Mapping */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Employee Matching ({uniqueNames.length} unique names)</h3>
                <div className="border rounded max-h-[30vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">Excel Name</TableHead>
                        <TableHead>Matched Employee</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uniqueNames.map(name => (
                        <TableRow key={name}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell>
                            {creatingFor === name ? (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <div>
                                    <Label className="text-xs">First Name</Label>
                                    <Input
                                      value={newFirstName}
                                      onChange={e => setNewFirstName(e.target.value)}
                                      className="h-8 w-36"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Last Name</Label>
                                    <Input
                                      value={newLastName}
                                      onChange={e => setNewLastName(e.target.value)}
                                      className="h-8 w-36"
                                    />
                                  </div>
                                  <div className="flex items-end gap-1">
                                    <Button size="sm" onClick={handleCreateEmployee} disabled={createLoading}>
                                      {createLoading ? 'Creating...' : 'Create'}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={cancelCreateEmployee}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                                {createError && <p className="text-xs text-red-600">{createError}</p>}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Select
                                  value={employeeMap[name] != null ? String(employeeMap[name]) : '__none__'}
                                  onValueChange={(val) => {
                                    setEmployeeMap(prev => ({
                                      ...prev,
                                      [name]: val === '__none__' ? null : Number(val),
                                    }));
                                  }}
                                >
                                  <SelectTrigger className={`w-64 ${employeeMap[name] == null ? 'border-red-400' : ''}`}>
                                    <SelectValue placeholder="Select employee..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">-- Not Matched --</SelectItem>
                                    {employees
                                      .filter(e => e.is_active)
                                      .sort((a, b) => a.last_name.localeCompare(b.last_name))
                                      .map(emp => (
                                        <SelectItem key={emp.id} value={String(emp.id)}>
                                          {emp.last_name}, {emp.first_name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                {employeeMap[name] == null && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startCreateEmployee(name)}
                                    title="Create new employee"
                                  >
                                    <UserPlus className="h-4 w-4 mr-1" />
                                    New
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Absence Type Mapping */}
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Absence Type Mapping ({uniqueAbsenceTypes.length} unique types)
                  {unmappedAbsenceCount > 0 && (
                    <span className="ml-2 text-xs font-normal text-amber-600">
                      {unmappedAbsenceCount} unmapped — those rows will be skipped
                    </span>
                  )}
                </h3>
                <div className="border rounded max-h-[30vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">Excel Absence Type</TableHead>
                        <TableHead>Mapped Time Code</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uniqueAbsenceTypes.map(type => (
                        <TableRow key={type}>
                          <TableCell className="font-medium">{type}</TableCell>
                          <TableCell>
                            <Select
                              value={absenceMap[type] || '__none__'}
                              onValueChange={(val) => {
                                setAbsenceMap(prev => ({
                                  ...prev,
                                  [type]: val === '__none__' ? '' : val,
                                }));
                              }}
                            >
                              <SelectTrigger className={`w-64 ${!absenceMap[type] ? 'border-red-400' : ''}`}>
                                <SelectValue placeholder="Select time code..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">-- Not Mapped --</SelectItem>
                                {timeCodes
                                  .filter(tc => tc.is_active)
                                  .map(tc => (
                                    <SelectItem key={tc.code} value={tc.code}>
                                      {tc.code} - {tc.description}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" onClick={() => setStage('upload')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={goToPreview} disabled={!canProceedToPreview}>
                  Review Import <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              {!canProceedToPreview && (
                <p className="text-sm text-red-600">
                  All employees must be mapped before proceeding. Use &quot;New&quot; to create missing employees.
                </p>
              )}
            </div>
          )}

          {/* STAGE: Preview */}
          {stage === 'preview' && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex flex-wrap gap-3 items-center">
                <Badge variant="outline" className="text-green-700 border-green-300">
                  {newCount} new
                </Badge>
                <Badge variant="outline" className="text-amber-700 border-amber-300">
                  {dupCount} duplicates ({overwriteCount} selected to overwrite)
                </Badge>
                {unmappedRowCount > 0 && (
                  <Badge variant="outline" className="text-amber-700 border-amber-300">
                    {unmappedRowCount} need time code
                  </Badge>
                )}
                {errorCount > 0 && errorCount !== unmappedRowCount && (
                  <Badge variant="outline" className="text-red-700 border-red-300">
                    {errorCount} errors
                  </Badge>
                )}
                {dupCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={toggleAllOverwrites} className="text-xs">
                    {overwriteCount === dupCount ? 'Deselect' : 'Select'} all duplicates
                  </Button>
                )}
              </div>

              <div className="border rounded max-h-[55vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Status</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Excel Type</TableHead>
                      <TableHead>Time Code</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-10">Overwrite</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map(row => (
                      <TableRow
                        key={row.rowKey}
                        className={
                          row.hasError ? 'bg-red-50 dark:bg-red-950/20' :
                          row.isDuplicate ? 'bg-amber-50 dark:bg-amber-950/20' : ''
                        }
                      >
                        <TableCell>
                          {row.hasError ? (
                            <Badge variant="destructive" className="text-xs">Error</Badge>
                          ) : row.isDuplicate ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">Dup</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-700 border-green-300 text-xs">New</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.employeeId != null ? getEmployeeName(row.employeeId) : (
                            <span className="text-red-600">{row.excelName} (unmapped)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{row.dateOfAbsence}</TableCell>
                        <TableCell className="text-sm">{row.typeOfAbsence}</TableCell>
                        <TableCell>
                          {row.needsMapping ? (
                            <Select
                              value={rowTimeCodeOverrides[row.idx] || '__none__'}
                              onValueChange={(val) => {
                                setRowTimeCodeOverrides(prev => ({
                                  ...prev,
                                  [row.idx]: val === '__none__' ? '' : val,
                                }));
                              }}
                            >
                              <SelectTrigger className="w-40 h-7 text-xs border-amber-400">
                                <SelectValue placeholder="Pick code..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">-- Pick --</SelectItem>
                                {timeCodes
                                  .filter(tc => tc.is_active)
                                  .map(tc => (
                                    <SelectItem key={tc.code} value={tc.code}>
                                      {tc.code} - {tc.description}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ) : row.timeCode ? (
                            <Badge variant="secondary">{row.timeCode}</Badge>
                          ) : (
                            <span className="text-red-600 text-sm">Unmapped</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">{row.timeMissed}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate" title={row.reasonGiven}>
                          {row.reasonGiven}
                        </TableCell>
                        <TableCell>
                          {row.isDuplicate && !row.hasError && (
                            <Checkbox
                              checked={overwriteSet.has(row.rowKey)}
                              onCheckedChange={() => toggleOverwrite(row.rowKey)}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" onClick={() => setStage('mapping')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Mapping
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={(newCount + overwriteCount) === 0}
                >
                  Import {newCount + overwriteCount} Records
                  {errorCount > 0 && ` (${errorCount} skipped)`}
                </Button>
              </div>
              {unmappedRowCount > 0 && (
                <p className="text-sm text-amber-600">
                  {unmappedRowCount} rows still need a time code selected. Pick one from the dropdown in each row, or they will be skipped.
                </p>
              )}
            </div>
          )}

          {/* STAGE: Importing */}
          {stage === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-lg font-medium">Importing records...</p>
            </div>
          )}

          {/* STAGE: Done */}
          {stage === 'done' && importResult && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-lg font-medium">Import Complete</p>
              <div className="space-y-1 text-center text-sm">
                <p className="text-green-700">{importResult.imported} records imported</p>
                {importResult.skipped > 0 && (
                  <p className="text-muted-foreground">{importResult.skipped} duplicates skipped</p>
                )}
                {importResult.errors.length > 0 && (
                  <div className="mt-4 text-left max-w-lg">
                    <p className="text-red-600 font-medium">{importResult.errors.length} errors:</p>
                    <ul className="list-disc ml-5 text-red-600 text-xs max-h-40 overflow-auto">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
