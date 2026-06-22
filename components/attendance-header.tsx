"use client";

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import Link from 'next/link';

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  employee_number?: string;
}


interface AttendanceHeaderProps {
  employees: Employee[];
  selectedEmployeeId?: number;
  year: number;
  onEmployeeChange: (employeeId: number) => void;
  onYearChange: (year: number) => void;
  onNewEmployee: () => void;
}

export function AttendanceHeader({
  employees,
  selectedEmployeeId,
  year,
  onEmployeeChange,
  onYearChange,
  onNewEmployee,
}: AttendanceHeaderProps) {
  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  const years = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - 2 + i
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2 p-2 border rounded-lg bg-card">
        <div className="flex-1 min-w-[200px] space-y-1">
          <Label htmlFor="employee" className="text-xs">Employee</Label>
          <Select
            value={selectedEmployeeId?.toString() || ''}
            onValueChange={(value) => onEmployeeChange(parseInt(value))}
          >
            <SelectTrigger id="employee" className="h-8 text-xs">
              <SelectValue placeholder="Select employee..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id.toString()}>
                  {emp.last_name}, {emp.first_name}
                  {emp.employee_number && ` (${emp.employee_number})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-24 space-y-1">
          <Label htmlFor="year" className="text-xs">Year</Label>
          <Select
            value={year.toString()}
            onValueChange={(value) => onYearChange(parseInt(value))}
          >
            <SelectTrigger id="year" className="h-8 text-xs">
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
        </div>

        {selectedEmployee && (
          <div className="flex-1 min-w-[200px] space-y-1">
            <Label className="text-xs">Employee Info</Label>
            <div className="text-xs space-y-0.5 py-1">
              <div>
                <span className="font-medium">Name: </span>
                {selectedEmployee.first_name} {selectedEmployee.last_name}
              </div>
              {selectedEmployee.employee_number && (
                <div>
                  <span className="font-medium">ID: </span>
                  {selectedEmployee.employee_number}
                </div>
              )}
            </div>
          </div>
        )}
         <Button onClick={onNewEmployee} variant="outline" size="sm">
            <Plus className="h-3 w-3 mr-1" />
            New Employee
          </Button>
      </div>
    </div>
  );
}
