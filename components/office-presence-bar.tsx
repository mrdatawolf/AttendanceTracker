"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface PresenceEmployee {
  id: number;
  firstName: string;
  lastName: string;
  abbreviation: string;
  isOut: boolean;
}

const POLL_INTERVAL_MS = 5_000; // Refresh every 5 seconds

export function OfficePresenceBar() {
  const { authFetch, user, isMaster, isAdministrator } = useAuth();
  const [employees, setEmployees] = useState<PresenceEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = isMaster || isAdministrator;

  const fetchPresence = useCallback(async () => {
    try {
      const res = await authFetch('/api/office-presence');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees);
      }
    } catch {
      // Silently fail — bar just won't update
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchPresence();
    const interval = setInterval(fetchPresence, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchPresence]);

  const handleToggle = async (employeeId: number) => {
    // Permission check: self or admin
    const isSelf = user?.employee_id === employeeId;
    if (!isSelf && !isAdmin) return;

    // Optimistic update
    setEmployees(prev =>
      prev.map(e =>
        e.id === employeeId ? { ...e, isOut: !e.isOut } : e
      )
    );

    try {
      const res = await authFetch('/api/office-presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId }),
      });

      if (res.ok) {
        // Notify other components (e.g. attendance grid) to refresh
        window.dispatchEvent(new CustomEvent('office-presence-changed'));
      } else {
        // Revert on failure
        setEmployees(prev =>
          prev.map(e =>
            e.id === employeeId ? { ...e, isOut: !e.isOut } : e
          )
        );
      }
    } catch {
      // Revert on error
      setEmployees(prev =>
        prev.map(e =>
          e.id === employeeId ? { ...e, isOut: !e.isOut } : e
        )
      );
    }
  };

  if (loading || employees.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {employees.map(emp => {
        const canToggle = isAdmin || user?.employee_id === emp.id;

        return (
          <button
            key={emp.id}
            onClick={() => handleToggle(emp.id)}
            disabled={!canToggle}
            title={`${emp.firstName} ${emp.lastName} — ${emp.isOut ? 'Out of Office' : 'In Office'}${canToggle ? ' (click to toggle)' : ''}`}
            className={cn(
              'h-6 min-w-[28px] px-1.5 rounded-full text-[10px] font-bold leading-none',
              'transition-colors duration-150 border',
              emp.isOut
                ? 'bg-red-500 text-white border-red-600'
                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
              canToggle ? 'cursor-pointer' : 'cursor-default opacity-70'
            )}
          >
            {emp.abbreviation}
          </button>
        );
      })}
    </div>
  );
}
