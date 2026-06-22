"use client";

import { Button } from '@/components/ui/button';
import type { ViewType } from '@/lib/attendance-types';

interface ViewToggleProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
}

const VIEW_OPTIONS: { value: ViewType; label: string }[] = [
  { value: 'year', label: 'Year' },
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
];

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-lg border bg-muted p-0.5">
      {VIEW_OPTIONS.map(({ value, label }) => (
        <Button
          key={value}
          variant={view === value ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs px-3 rounded-md"
          onClick={() => onViewChange(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
