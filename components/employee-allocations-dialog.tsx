"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RotateCcw, Save } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { clearCachedDataByPrefix } from '@/lib/client-cache';

interface TimeAllocation {
  time_code: string;
  description: string;
  default_allocation: number | null;
  allocated_hours: number | null;
  is_override: boolean;
  notes: string | null;
}

interface EmployeeAllocationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: number;
  employeeName: string;
}

export function EmployeeAllocationsDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
}: EmployeeAllocationsDialogProps) {
  const { token } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [allocations, setAllocations] = useState<TimeAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedAllocations, setEditedAllocations] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (open && employeeId && token) {
      loadAllocations();
    }
  }, [open, employeeId, year, token]);

  const loadAllocations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/employee-allocations?employeeId=${employeeId}&year=${year}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAllocations(data.allocations);
        setEditedAllocations(new Map());
      }
    } catch (error) {
      console.error('Failed to load allocations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAllocationChange = (timeCode: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditedAllocations(new Map(editedAllocations.set(timeCode, numValue)));
  };

  const handleSave = async (timeCode: string) => {
    const newValue = editedAllocations.get(timeCode);
    if (newValue === undefined) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/employee-allocations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employee_id: employeeId,
          time_code: timeCode,
          allocated_hours: newValue,
          year,
        }),
      });

      if (response.ok) {
        clearCachedDataByPrefix(`attendance:data:${employeeId}:`);
        await loadAllocations();
      }
    } catch (error) {
      console.error('Failed to save allocation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevertToDefault = async (timeCode: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/employee-allocations?employeeId=${employeeId}&timeCode=${timeCode}&year=${year}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        clearCachedDataByPrefix(`attendance:data:${employeeId}:`);
        await loadAllocations();
      }
    } catch (error) {
      console.error('Failed to revert allocation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getCurrentValue = (allocation: TimeAllocation): number => {
    const edited = editedAllocations.get(allocation.time_code);
    if (edited !== undefined) return edited;
    return allocation.allocated_hours ?? 0;
  };

  const hasChanges = (allocation: TimeAllocation): boolean => {
    return editedAllocations.has(allocation.time_code);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Manage Time Allocations - {employeeName}
          </DialogTitle>
          <DialogDescription>
            Set custom hour allocations for this employee. Leave blank or revert to use company defaults.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="year">Year:</Label>
            <Input
              id="year"
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-32"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8">Loading allocations...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Default (hrs)</TableHead>
                  <TableHead className="text-right">Allocated (hrs)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations
                  .filter(a => a.default_allocation !== null)
                  .map((allocation) => (
                    <TableRow key={allocation.time_code}>
                      <TableCell className="font-medium">
                        {allocation.time_code}
                      </TableCell>
                      <TableCell>{allocation.description}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {allocation.default_allocation ?? '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={getCurrentValue(allocation)}
                          onChange={(e) =>
                            handleAllocationChange(allocation.time_code, e.target.value)
                          }
                          className={`w-24 text-right ${
                            allocation.is_override ? 'font-bold' : ''
                          }`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {hasChanges(allocation) && (
                            <Button
                              size="sm"
                              onClick={() => handleSave(allocation.time_code)}
                              disabled={isSaving}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                          )}
                          {allocation.is_override && !hasChanges(allocation) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRevertToDefault(allocation.time_code)}
                              disabled={isSaving}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Use Default
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
