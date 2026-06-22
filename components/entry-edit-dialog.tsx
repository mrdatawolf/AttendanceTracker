"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Minus, Plus } from 'lucide-react';

interface TimeCode {
  code: string;
  description:string;
}

interface EntryEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  timeCode: string;
  hours: number;
  notes: string;
  timeCodes: TimeCode[];
  onSave: (date: string, timeCode: string, hours: number, notes: string) => void;
}

export function EntryEditDialog({
  open,
  onOpenChange,
  date,
  timeCode,
  hours,
  notes,
  timeCodes,
  onSave,
}: EntryEditDialogProps) {
  const [localTimeCode, setLocalTimeCode] = useState(timeCode);
  const [localHours, setLocalHours] = useState(Math.floor(hours));
  const [localMinutes, setLocalMinutes] = useState(Math.round((hours % 1) * 60));
  const [localNotes, setLocalNotes] = useState(notes);

  useEffect(() => {
    setLocalTimeCode(timeCode);
    setLocalHours(Math.floor(hours));
    setLocalMinutes(Math.round((hours % 1) * 60));
    setLocalNotes(notes);
  }, [timeCode, hours, notes]);

  const handleSave = () => {
    const totalHours = localHours + localMinutes / 60;
    onSave(date, localTimeCode, totalHours, localNotes);
    onOpenChange(false);
  };

  const incrementMinutes = () => {
    setLocalMinutes(prev => {
      if (prev === 0) return 15;
      if (prev === 15) return 30;
      if (prev === 30) return 45;
      return 0;
    });
  };

  const decrementMinutes = () => {
    setLocalMinutes(prev => {
      if (prev === 0) return 45;
      if (prev === 15) return 0;
      if (prev === 30) return 15;
      return 30;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Entry for {date}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="time-code" className="text-right">
              Time Code
            </Label>
            <Select value={localTimeCode} onValueChange={setLocalTimeCode}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a time code" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">-</SelectItem>
                {timeCodes.map(tc => (
                  <SelectItem key={tc.code} value={tc.code}>
                    {tc.code} - {tc.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              Time
            </Label>
            <div className="col-span-3 flex items-center gap-1">
              {/* Hours */}
              <span className="text-xs font-bold">hrs</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setLocalHours(Math.max(0, localHours - 1))}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="text"
                value={localHours}
                readOnly
                className="text-center h-8 w-10 px-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setLocalHours(localHours + 1)}
                className="h-8 w-8"
              >
                <Plus className="h-3 w-3" />
              </Button>

              {/* Minutes */}
              <span className="text-xs font-bold ml-2">min</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={decrementMinutes}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="text"
                value={localMinutes}
                readOnly
                className="text-center h-8 w-10 px-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={incrementMinutes}
                className="h-8 w-8"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={localNotes}
              onChange={e => setLocalNotes(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
