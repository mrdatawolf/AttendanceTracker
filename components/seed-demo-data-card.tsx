"use client";

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';

export function SeedDemoDataCard() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSeed = async () => {
    if (!token) return;

    setIsSeeding(true);
    setResult(null);
    try {
      const res = await fetch('/api/settings/seed-demo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message || 'Demo data has been loaded.' });
        toast({ title: 'Demo data loaded', description: data.message });
      } else {
        setResult({ success: false, message: data.error || 'Failed to seed demo data.' });
        toast({ title: 'Seeding failed', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      setResult({ success: false, message: 'An error occurred while seeding demo data.' });
      toast({ title: 'Error', description: 'An error occurred while seeding demo data.', variant: 'destructive' });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Demo Data
        </CardTitle>
        <CardDescription>
          Load this server with sample employees, attendance history, and demo logins for presentations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isSeeding}>
              {isSeeding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Seed Demo Data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Seed demo data?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes all employees, attendance entries, leave allocations,
                office presence, and break records, then replaces them with the
                standard demo dataset: 10 sample employees, a year of attendance
                history, and demo logins for the manager, HR, and employee roles
                (password <span className="font-mono">demo123</span>).
                <span className="block mt-2 text-destructive font-medium">
                  This cannot be undone. Only do this on a fresh install or a
                  server you intend to use for demos.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSeed}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Seed Demo Data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {result && (
          <div
            className={`text-sm rounded-md p-3 ${
              result.success
                ? 'bg-green-500/10 text-green-600'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {result.message}
            {result.success && (
              <Button
                type="button"
                variant="link"
                className="px-1 h-auto"
                onClick={() => window.location.reload()}
              >
                Reload now
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
