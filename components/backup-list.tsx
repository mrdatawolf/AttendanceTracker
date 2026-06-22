"use client";

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  CheckCircle,
  XCircle,
  Shield,
  Loader2,
} from 'lucide-react';

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

interface BackupListProps {
  backups: BackupMetadata[];
  onRestore: (backupId: string) => Promise<void>;
  onDelete: (backupId: string) => Promise<void>;
  onVerify: (backupId: string) => Promise<{ valid: boolean }>;
  onDownload: (backupId: string, db: 'attendance' | 'auth') => void;
  isLoading?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getTypeBadgeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case 'daily':
      return 'default';
    case 'weekly':
      return 'secondary';
    case 'monthly':
      return 'outline';
    case 'manual':
      return 'destructive';
    default:
      return 'default';
  }
}

export function BackupList({
  backups,
  onRestore,
  onDelete,
  onVerify,
  onDownload,
  isLoading = false,
}: BackupListProps) {
  const [confirmAction, setConfirmAction] = useState<{
    type: 'restore' | 'delete';
    backupId: string;
    backupDate: string;
  } | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ id: string; valid: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleVerify = async (backupId: string) => {
    setVerifying(backupId);
    setVerifyResult(null);
    try {
      const result = await onVerify(backupId);
      setVerifyResult({ id: backupId, valid: result.valid });
    } catch (error) {
      setVerifyResult({ id: backupId, valid: false });
    } finally {
      setVerifying(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    setActionLoading(true);
    try {
      if (confirmAction.type === 'restore') {
        await onRestore(confirmAction.backupId);
      } else {
        await onDelete(confirmAction.backupId);
      }
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading backups...</span>
      </div>
    );
  }

  if (backups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No backups found. Create your first backup using the button above.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.map((backup) => {
              const totalSize =
                backup.totalSize ||
                backup.databases.attendance.size + backup.databases.auth.size;

              return (
                <TableRow key={backup.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {formatDate(backup.timestamp)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(backup.timestamp)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getTypeBadgeVariant(backup.type)}>
                      {backup.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{formatBytes(totalSize)}</span>
                  </TableCell>
                  <TableCell>
                    {verifying === backup.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : verifyResult?.id === backup.id ? (
                      verifyResult.valid ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleVerify(backup.id)}
                        title="Verify integrity"
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onDownload(backup.id, 'attendance')}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Attendance DB
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDownload(backup.id, 'auth')}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Auth DB
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            setConfirmAction({
                              type: 'restore',
                              backupId: backup.id,
                              backupDate: formatDateTime(backup.timestamp),
                            })
                          }
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Restore
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() =>
                            setConfirmAction({
                              type: 'delete',
                              backupId: backup.id,
                              backupDate: formatDateTime(backup.timestamp),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === 'restore' ? 'Restore Backup?' : 'Delete Backup?'}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                {confirmAction?.type === 'restore' ? (
                  <>
                    <p>
                      This will restore the database to the state from{' '}
                      <strong>{confirmAction.backupDate}</strong>. A backup of the current
                      state will be created before restoring.
                    </p>
                    <p className="mt-2 text-destructive font-medium">
                      Warning: All changes made after this backup will be lost!
                    </p>
                  </>
                ) : (
                  <p>
                    This will permanently delete the backup from{' '}
                    <strong>{confirmAction?.backupDate}</strong>. This action cannot be undone.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={actionLoading}
              variant={confirmAction?.type === 'delete' ? 'destructive' : 'default'}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {confirmAction?.type === 'restore' ? 'Restore' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
