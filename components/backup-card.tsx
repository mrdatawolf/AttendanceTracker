"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackupList } from './backup-list';
import { Database, HardDrive, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BackupMetadata {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'manual';
  timestamp: string;
  databases: {
    attendance: { filename: string; size: number; checksum: string };
    auth: { filename: string; size: number; checksum: string };
  };
  totalSize?: number;
  promotedFrom?: string;
  createdBy?: string;
}

interface BackupStatus {
  enabled: boolean;
  lastBackup: string | null;
  storage: {
    total: number;
    byType: {
      daily: number;
      weekly: number;
      monthly: number;
      manual: number;
    };
    backupCount: {
      daily: number;
      weekly: number;
      monthly: number;
      manual: number;
    };
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function BackupCard() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) return;

    try {
      const [backupsRes, statusRes] = await Promise.all([
        fetch('/api/backup', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/backup?action=status', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (backupsRes.ok) {
        const data = await backupsRes.json();
        setBackups(data.backups || []);
      }

      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch backup data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateBackup = async () => {
    if (!token) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast({
          title: 'Backup created',
          description: 'A new backup has been created successfully.',
        });
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: 'Backup failed',
          description: data.error || 'Failed to create backup.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while creating the backup.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async (backupId: string) => {
    if (!token) return;

    const res = await fetch(`/api/backup/${backupId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      toast({
        title: 'Restore complete',
        description: 'The database has been restored. You may need to refresh the page.',
      });
      fetchData();
    } else {
      const data = await res.json();
      toast({
        title: 'Restore failed',
        description: data.error || 'Failed to restore backup.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (backupId: string) => {
    if (!token) return;

    const res = await fetch(`/api/backup/${backupId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      toast({
        title: 'Backup deleted',
        description: 'The backup has been deleted.',
      });
      fetchData();
    } else {
      const data = await res.json();
      toast({
        title: 'Delete failed',
        description: data.error || 'Failed to delete backup.',
        variant: 'destructive',
      });
    }
  };

  const handleVerify = async (backupId: string) => {
    if (!token) return { valid: false };

    const res = await fetch(`/api/backup/${backupId}?action=verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
    return { valid: false };
  };

  const handleDownload = (backupId: string, db: 'attendance' | 'auth') => {
    if (!token) return;

    // Create a temporary link to trigger download
    const url = `/api/backup/${backupId}/download?db=${db}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${backupId}-${db}.db`;

    // We need to fetch with auth header, so use fetch + blob
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch((error) => {
        console.error('Download failed:', error);
        toast({
          title: 'Download failed',
          description: 'Failed to download backup file.',
          variant: 'destructive',
        });
      });
  };

  const totalBackupCount = status
    ? status.storage.backupCount.daily +
      status.storage.backupCount.weekly +
      status.storage.backupCount.monthly +
      status.storage.backupCount.manual
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Backups
            </CardTitle>
            <CardDescription>
              Automatic backups with 7-day, 4-week, and 12-month retention
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleCreateBackup}
              disabled={isCreating}
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Backup
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Summary */}
        {status && (
          <div className="flex flex-wrap gap-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>{totalBackupCount}</strong> backups using{' '}
                <strong>{formatBytes(status.storage.total)}</strong>
              </span>
            </div>
            {status.lastBackup && (
              <div className="text-sm text-muted-foreground">
                Last backup:{' '}
                {new Date(status.lastBackup).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
        )}

        {/* Backup List */}
        <BackupList
          backups={backups}
          onRestore={handleRestore}
          onDelete={handleDelete}
          onVerify={handleVerify}
          onDownload={handleDownload}
          isLoading={isLoading}
        />
      </CardContent>
    </Card>
  );
}
