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
import { Minus, Plus, Trash2, PlusCircle, Clock } from 'lucide-react';
import type { AttendanceEntry, EntryChangeResult } from '@/lib/attendance-types';
import { HelpArea } from '@/components/help-area';

interface TimeCode {
  code: string;
  description: string;
}

interface MultiEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  entries: AttendanceEntry[];
  timeCodes: TimeCode[];
  // `originalDate` is passed when the user changed the date field, so the
  // caller knows which date to move entries away from.
  onSave: (date: string, entries: AttendanceEntry[], originalDate?: string) => Promise<EntryChangeResult> | void;
  employeeNameMap?: Record<number, string>;
  readOnly?: boolean;
}

interface EditableEntry {
  id?: number;
  employee_id?: number;
  tempId: string;
  time_code: string;
  hours: number;
  minutes: number;
  notes: string;
}

export function MultiEntryDialog({
  open,
  onOpenChange,
  date,
  entries,
  timeCodes,
  onSave,
  employeeNameMap,
  readOnly = false,
}: MultiEntryDialogProps) {
  const [editableEntries, setEditableEntries] = useState<EditableEntry[]>([]);
  const [localDate, setLocalDate] = useState(date);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalDate(date);
      setSaveError(null);
      // Convert entries to editable format
      if (entries.length === 0) {
        // Start with one empty entry
        setEditableEntries([{
          tempId: `new-${Date.now()}`,
          time_code: '__NONE__',
          hours: 0,
          minutes: 0,
          notes: '',
        }]);
      } else {
        setEditableEntries(entries.map((entry, index) => ({
          id: entry.id,
          employee_id: entry.employee_id,
          tempId: entry.id ? `id-${entry.id}` : `new-${Date.now()}-${index}`,
          time_code: entry.time_code,
          hours: Math.floor(entry.hours),
          minutes: Math.round((entry.hours % 1) * 60),
          notes: entry.notes || '',
        })));
      }
    }
  }, [open, entries]);

  const handleAddEntry = () => {
    setEditableEntries([...editableEntries, {
      tempId: `new-${Date.now()}`,
      time_code: '__NONE__',
      hours: 0,
      minutes: 0,
      notes: '',
    }]);
  };

  const handleRemoveEntry = (tempId: string) => {
    setEditableEntries(editableEntries.filter(e => e.tempId !== tempId));
  };

  const updateEntry = (tempId: string, field: keyof EditableEntry, value: any) => {
    setEditableEntries(editableEntries.map(e =>
      e.tempId === tempId ? { ...e, [field]: value } : e
    ));
  };

  const incrementHours = (tempId: string) => {
    setEditableEntries(editableEntries.map(e =>
      e.tempId === tempId ? { ...e, hours: e.hours + 1 } : e
    ));
  };

  const decrementHours = (tempId: string) => {
    setEditableEntries(editableEntries.map(e =>
      e.tempId === tempId ? { ...e, hours: Math.max(0, e.hours - 1) } : e
    ));
  };

  const incrementMinutes = (tempId: string) => {
    setEditableEntries(editableEntries.map(e => {
      if (e.tempId !== tempId) return e;
      let newMinutes = e.minutes;
      if (newMinutes === 0) newMinutes = 15;
      else if (newMinutes === 15) newMinutes = 30;
      else if (newMinutes === 30) newMinutes = 45;
      else newMinutes = 0;
      return { ...e, minutes: newMinutes };
    }));
  };

  const decrementMinutes = (tempId: string) => {
    setEditableEntries(editableEntries.map(e => {
      if (e.tempId !== tempId) return e;
      let newMinutes = e.minutes;
      if (newMinutes === 0) newMinutes = 45;
      else if (newMinutes === 15) newMinutes = 0;
      else if (newMinutes === 30) newMinutes = 15;
      else newMinutes = 30;
      return { ...e, minutes: newMinutes };
    }));
  };

  const setAllDay = (tempId: string) => {
    setEditableEntries(editableEntries.map(e =>
      e.tempId === tempId ? { ...e, hours: 8, minutes: 0 } : e
    ));
  };

  const getTotalHours = () => {
    return editableEntries
      .filter(e => e.time_code !== '__NONE__')
      .reduce((sum, e) => sum + e.hours + e.minutes / 60, 0);
  };

  const handleSave = async () => {
    const totalHours = getTotalHours();

    if (totalHours > 24) {
      alert('Total hours cannot exceed 24 hours per day.');
      return;
    }

    if (!localDate) {
      setSaveError('Please choose a date.');
      return;
    }

    // Convert back to AttendanceEntry format, filtering out empty entries
    const savedEntries: AttendanceEntry[] = editableEntries
      .filter(e => e.time_code !== '__NONE__')
      .map(e => ({
        id: e.id,
        entry_date: localDate,
        time_code: e.time_code,
        hours: e.hours + e.minutes / 60,
        notes: e.notes.trim() || undefined,
      }));

    const dateChanged = localDate !== date;
    setSaveError(null);
    setSaving(true);
    try {
      const result = await onSave(localDate, savedEntries, dateChanged ? date : undefined);
      if (result && !result.success) {
        setSaveError(result.error || 'Failed to save entries.');
        return;
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const totalHours = getTotalHours();
  const isOverLimit = totalHours > 24;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? 'Entries for' : 'Edit Entries for'} {date}</DialogTitle>
        </DialogHeader>

        {!readOnly && (
          <div className="space-y-1">
            <HelpArea helpId="entry-date" bubblePosition="right" showHighlight={false}>
              <Label htmlFor="multi-entry-date" className="text-xs cursor-help">
                Date
              </Label>
            </HelpArea>
            <Input
              id="multi-entry-date"
              type="date"
              value={localDate}
              onChange={e => setLocalDate(e.target.value)}
              className="h-9 w-[200px]"
            />
          </div>
        )}

        <div className="space-y-4 py-4">
          {editableEntries.map((entry, index) => (
            <div key={entry.tempId} className="p-4 border rounded-lg space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  {entry.employee_id && employeeNameMap?.[entry.employee_id]
                    ? employeeNameMap[entry.employee_id]
                    : `Entry ${index + 1}`}
                </h3>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveEntry(entry.tempId)}
                    className="text-red-600 hover:text-red-700"
                    title="Delete entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <HelpArea helpId="entry-time-code" bubblePosition="right" showHighlight={false}>
                  <Label htmlFor={`time-code-${entry.tempId}`} className="text-xs cursor-help">
                    Time Code
                  </Label>
                </HelpArea>
                <Select
                  value={entry.time_code}
                  onValueChange={(value) => updateEntry(entry.tempId, 'time_code', value)}
                  disabled={readOnly}
                >
                  <SelectTrigger id={`time-code-${entry.tempId}`} className="h-9">
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

              <div className="space-y-2">
                <HelpArea helpId="entry-time" bubblePosition="right" showHighlight={false}>
                  <Label className="text-xs cursor-help">Time</Label>
                </HelpArea>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs font-bold">hrs</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => decrementHours(entry.tempId)}
                    className="h-8 w-8"
                    disabled={readOnly}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="text"
                    value={entry.hours}
                    readOnly
                    className="text-center h-8 w-10 px-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => incrementHours(entry.tempId)}
                    className="h-8 w-8"
                    disabled={readOnly}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>

                  <span className="text-xs font-bold ml-2">min</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => decrementMinutes(entry.tempId)}
                    className="h-8 w-8"
                    disabled={readOnly}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="text"
                    value={entry.minutes}
                    readOnly
                    className="text-center h-8 w-10 px-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => incrementMinutes(entry.tempId)}
                    className="h-8 w-8"
                    disabled={readOnly}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setAllDay(entry.tempId)}
                    className="h-8 ml-2 gap-1 text-xs"
                    title="Set to 8 hours (full day)"
                    disabled={readOnly}
                  >
                    <Clock className="h-3 w-3" />
                    All Day
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <HelpArea helpId="entry-notes" bubblePosition="right" showHighlight={false}>
                  <Label htmlFor={`notes-${entry.tempId}`} className="text-xs cursor-help">
                    Notes
                  </Label>
                </HelpArea>
                <Textarea
                  id={`notes-${entry.tempId}`}
                  value={entry.notes}
                  onChange={(e) => updateEntry(entry.tempId, 'notes', e.target.value)}
                  className="min-h-[60px]"
                  placeholder="Optional notes"
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </div>
            </div>
          ))}

          {editableEntries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No entries for this date. Saving will delete any existing entries.
            </p>
          )}

          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              onClick={handleAddEntry}
              className="w-full gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              {editableEntries.length === 0 ? 'Add Entry' : 'Add Another Entry'}
            </Button>
          )}
        </div>

        <div className="border-t pt-4">
          <div className={`flex items-center justify-between text-sm ${isOverLimit ? 'text-red-600 font-bold' : 'font-semibold'}`}>
            <span>Total Hours:</span>
            <span>{totalHours.toFixed(2)} {isOverLimit && '(exceeds 24 hour limit!)'}</span>
          </div>
          {saveError && (
            <p className="text-sm text-red-600 mt-2">{saveError}</p>
          )}
        </div>

        <DialogFooter>
          {readOnly ? (
            <>
              <p className="text-xs text-muted-foreground mr-auto self-center">
                Select a specific employee to make changes
              </p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isOverLimit || saving}>
                {saving ? 'Saving...' : 'Save All Changes'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
