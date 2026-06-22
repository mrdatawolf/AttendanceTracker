"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Coffee, UtensilsCrossed, Clock, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface BreakWindow {
  start: string;
  end: string;
  duration: number;
}

interface BreakConfig {
  breaks: {
    break_1?: BreakWindow;
    lunch?: BreakWindow;
    break_2?: BreakWindow;
  };
  requireTimeEntry?: boolean;
  graceMinutes?: number;
}

interface BreakComplianceResult {
  compliant: boolean;
  reason: string;
}

interface BreakEntry {
  id: number;
  employee_id: number;
  entry_date: string;
  break_type: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  notes: string | null;
  compliance?: BreakComplianceResult;
}

interface BreakEntryWidgetProps {
  employeeId: number;
}

type BreakType = 'break_1' | 'lunch' | 'break_2';

const BREAK_ICONS: Record<BreakType, typeof Coffee> = {
  break_1: Coffee,
  lunch: UtensilsCrossed,
  break_2: Coffee,
};

const BREAK_LABELS: Record<BreakType, string> = {
  break_1: 'Break 1',
  lunch: 'Lunch',
  break_2: 'Break 2',
};

function getBreakStatusColor(entry: BreakEntry | undefined): string {
  if (!entry) {
    return 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-600';
  }
  if (entry.compliance?.compliant) {
    return 'bg-green-100 hover:bg-green-200 border-green-300 text-green-700';
  }
  return 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-700';
}

function getBreakStatusIcon(entry: BreakEntry | undefined): typeof Check | typeof AlertTriangle | typeof Clock {
  if (!entry) {
    return Clock;
  }
  if (entry.compliance?.compliant) {
    return Check;
  }
  return AlertTriangle;
}

export function BreakEntryWidget({ employeeId }: BreakEntryWidgetProps) {
  const { authFetch } = useAuth();
  const [config, setConfig] = useState<BreakConfig | null>(null);
  const [entries, setEntries] = useState<BreakEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<BreakType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compliancePrompt, setCompliancePrompt] = useState<{ breakType: BreakType; reason: string } | null>(null);

  const loadBreakEntries = useCallback(async () => {
    if (!employeeId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/api/break-entries?employeeId=${employeeId}`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setEntries(data.entries || []);
      } else if (response.status === 403) {
        // Feature not enabled - don't show error
        setConfig(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load breaks');
      }
    } catch (err) {
      console.error('Failed to load break entries:', err);
      setError('Failed to load breaks');
    } finally {
      setLoading(false);
    }
  }, [authFetch, employeeId]);

  useEffect(() => {
    loadBreakEntries();
  }, [loadBreakEntries]);

  const handleLogBreak = async (breakType: BreakType) => {
    if (!config) return;

    const breakConfig = config.breaks[breakType];
    if (!breakConfig) return;

    setSaving(breakType);
    try {
      const response = await authFetch('/api/break-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          breakType,
          durationMinutes: breakConfig.duration,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedEntries: BreakEntry[] = data.entries || [];
        setEntries(updatedEntries);

        // Check if the entry we just logged is non-compliant
        const loggedEntry = updatedEntries.find(e => e.break_type === breakType);
        if (loggedEntry && loggedEntry.compliance && !loggedEntry.compliance.compliant) {
          setCompliancePrompt({ breakType, reason: loggedEntry.compliance.reason });
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to log break');
      }
    } catch (err) {
      console.error('Failed to log break:', err);
      setError('Failed to log break');
    } finally {
      setSaving(null);
    }
  };

  const handleConfirmCompliance = async () => {
    if (!compliancePrompt) return;

    try {
      const response = await authFetch('/api/break-entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          breakType: compliancePrompt.breakType,
          complianceOverride: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to set compliance override:', err);
    } finally {
      setCompliancePrompt(null);
    }
  };

  // Don't render if feature is disabled or no employee selected
  if (!loading && !config) {
    return null;
  }

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Today&apos;s Breaks</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={loadBreakEntries}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return null;
  }

  const breakTypes: BreakType[] = ['break_1', 'lunch', 'break_2'];
  const configuredBreaks = breakTypes.filter(bt => config.breaks[bt]);
  const loggedCount = entries.length;
  const totalRequired = configuredBreaks.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Today&apos;s Breaks</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={loadBreakEntries}
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {configuredBreaks.map((breakType) => {
            const breakConfig = config.breaks[breakType]!;
            const entry = entries.find(e => e.break_type === breakType);
            const Icon = BREAK_ICONS[breakType];
            const StatusIcon = getBreakStatusIcon(entry);
            const isLogging = saving === breakType;

            return (
              <Button
                key={breakType}
                variant="outline"
                className={cn(
                  'h-auto py-3 px-2 flex flex-col items-center gap-1 border-2 transition-colors',
                  getBreakStatusColor(entry),
                  isLogging && 'opacity-50'
                )}
                onClick={() => handleLogBreak(breakType)}
                disabled={isLogging}
              >
                <div className="flex items-center gap-1">
                  <Icon className="h-4 w-4" />
                  {entry && <StatusIcon className="h-3 w-3" />}
                </div>
                <span className="text-xs font-medium">{BREAK_LABELS[breakType]}</span>
                {entry ? (
                  <span className="text-xs opacity-75">{entry.start_time}</span>
                ) : (
                  <span className="text-xs opacity-75">
                    {breakConfig.start}-{breakConfig.end}
                  </span>
                )}
                <span className="text-xs opacity-50">{breakConfig.duration} min</span>
              </Button>
            );
          })}
        </div>
        <div className="mt-3 text-center">
          <span className={cn(
            'text-xs',
            loggedCount === totalRequired ? 'text-green-600' : 'text-muted-foreground'
          )}>
            {loggedCount}/{totalRequired} logged
            {loggedCount === totalRequired && ' ✓'}
          </span>
        </div>
      </CardContent>

      <AlertDialog open={!!compliancePrompt} onOpenChange={(open) => !open && setCompliancePrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Break Compliance Check</AlertDialogTitle>
            <AlertDialogDescription>
              Your {compliancePrompt ? BREAK_LABELS[compliancePrompt.breakType] : ''} entry was flagged
              as out of compliance: {compliancePrompt?.reason}.
              <br /><br />
              You either took the break or are aware we want you to take a break during that time?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCompliance}>
              Yes, I did
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
