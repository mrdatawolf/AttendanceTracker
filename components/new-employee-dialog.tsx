"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NewEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (employee: {
    first_name: string;
    last_name: string;
    employee_number: string;
    email: string;
  }) => void;
}

export function NewEmployeeDialog({
  open,
  onOpenChange,
  onSubmit,
}: NewEmployeeDialogProps) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    employee_number: '',
    email: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      first_name: '',
      last_name: '',
      employee_number: '',
      email: '',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>
            Create a new employee record for attendance tracking.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-3 py-3">
            <div className="grid gap-1.5">
              <Label htmlFor="first_name">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="last_name">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="employee_number">Employee Number</Label>
              <Input
                id="employee_number"
                value={formData.employee_number}
                onChange={(e) =>
                  setFormData({ ...formData, employee_number: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Employee</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
