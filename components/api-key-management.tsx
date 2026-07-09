"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { KeyRound, Plus, Trash2, Loader2, Copy, Check, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiKeyRow {
  id: number;
  name: string;
  key_prefix: string;
  user_id: number;
  is_active: number;
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
  username?: string;
  user_full_name?: string;
}

interface UserOption {
  id: number;
  username: string;
  full_name: string;
  is_active: number;
}

const emptyFormData = { name: '', user_id: '', expires_in_days: '' };

export function ApiKeyManagement() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKeyRow | null>(null);
  const [formData, setFormData] = useState(emptyFormData);

  // Newly created key, shown exactly once
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchApiKeys = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const res = await fetch('/api/api-keys', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setApiKeys(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch API keys:', res.status);
        setApiKeys([]);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      setApiKeys([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data.filter((u: UserOption) => u.is_active === 1) : []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchApiKeys();
    fetchUsers();
  }, [fetchApiKeys, fetchUsers]);

  const handleCreateKey = async () => {
    if (!token || !formData.name.trim() || !formData.user_id) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          user_id: parseInt(formData.user_id),
          expires_in_days: formData.expires_in_days ? parseInt(formData.expires_in_days) : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsAddDialogOpen(false);
        setFormData(emptyFormData);
        setCopied(false);
        setCreatedKey(data.key);
        fetchApiKeys();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to create API key.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while creating the API key.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!token || !selectedKey) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/api-keys?id=${selectedKey.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast({
          title: 'API key revoked',
          description: `API key "${selectedKey.name}" can no longer be used.`,
        });
        setIsRevokeDialogOpen(false);
        setSelectedKey(null);
        fetchApiKeys();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to revoke API key.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while revoking the API key.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Select the key text and copy it manually.',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
    return isNaN(date.getTime()) ? value : date.toLocaleString();
  };

  const keyStatus = (key: ApiKeyRow) => {
    if (key.is_active !== 1) return { label: 'Revoked', variant: 'secondary' as const, className: '' };
    if (key.expires_at && new Date(`${key.expires_at.replace(' ', 'T')}Z`) < new Date()) {
      return { label: 'Expired', variant: 'secondary' as const, className: '' };
    }
    return { label: 'Active', variant: 'default' as const, className: 'bg-green-500 hover:bg-green-600' };
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Keys for programmatic access to the API. Each key acts with the
                permissions of the user it belongs to.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href="/api-docs" target="_blank" rel="noreferrer">
                  <BookOpen className="h-4 w-4 mr-2" />
                  API Docs
                </a>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setFormData(emptyFormData);
                  setIsAddDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Key
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No API keys yet. Create one to allow scripts and other systems to call the API.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Acts As</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => {
                  const status = keyStatus(key);
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {key.key_prefix}…
                        </code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {key.user_full_name || key.username || `User #${key.user_id}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {key.last_used_at ? formatDate(key.last_used_at) : 'Never'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {key.expires_at ? formatDate(key.expires_at) : 'Never'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={status.variant} className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {key.is_active === 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedKey(key);
                              setIsRevokeDialogOpen(true);
                            }}
                            title="Revoke API key"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              The key inherits the permissions of the selected user. For system
              integrations, create a dedicated service-account user first.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="key-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="key-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Power BI reports, HR sync script"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="key-user">
                Acts as user <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.user_id}
                onValueChange={(value) => setFormData({ ...formData, user_id: value })}
              >
                <SelectTrigger id="key-user">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.full_name} ({user.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="key-expiry">Expires in (days)</Label>
              <Input
                id="key-expiry"
                type="number"
                min="1"
                value={formData.expires_in_days}
                onChange={(e) => setFormData({ ...formData, expires_in_days: e.target.value })}
                placeholder="Leave empty for no expiration"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateKey}
              disabled={isSaving || !formData.name.trim() || !formData.user_id}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show-once key dialog */}
      <Dialog open={createdKey !== null} onOpenChange={(open) => { if (!open) setCreatedKey(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy this key now — it will not be shown again. Use it as a bearer
              token: <code className="text-xs">Authorization: Bearer &lt;key&gt;</code>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <code className="flex-1 text-sm bg-muted px-3 py-2 rounded break-all select-all">
              {createdKey}
            </code>
            <Button variant="outline" size="icon" onClick={handleCopyKey} title="Copy key">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke &quot;{selectedKey?.name}&quot;?
              Anything using this key will immediately lose access. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
