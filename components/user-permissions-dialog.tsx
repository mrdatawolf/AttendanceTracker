'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Shield, Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Group {
  id: number;
  name: string;
  description?: string;
}

interface UserGroupPermission {
  id: number;
  user_id: number;
  group_id: number;
  can_create: number;
  can_read: number;
  can_update: number;
  can_delete: number;
}

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  userName: string;
  isSuperuser: boolean;
}

export function UserPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  isSuperuser,
}: UserPermissionsDialogProps) {
  const { token } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [permissions, setPermissions] = useState<UserGroupPermission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [newPermission, setNewPermission] = useState({
    can_create: false,
    can_read: true,
    can_update: false,
    can_delete: false,
  });

  useEffect(() => {
    if (open) {
      loadGroups();
      loadPermissions();
    }
  }, [open, userId]);

  const loadGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGroups(data);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const loadPermissions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/user-group-permissions?userId=${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions || []);
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPermission = async () => {
    if (!selectedGroupId) return;

    try {
      const response = await fetch('/api/user-group-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          groupId: parseInt(selectedGroupId),
          ...newPermission,
        }),
      });

      if (response.ok) {
        setSelectedGroupId('');
        setNewPermission({
          can_create: false,
          can_read: true,
          can_update: false,
          can_delete: false,
        });
        loadPermissions();
      } else {
        const error = await response.json();
        alert(`Failed to add permission: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to add permission:', error);
      alert('Failed to add permission');
    }
  };

  const handleUpdatePermission = async (permission: UserGroupPermission, field: string, value: boolean) => {
    try {
      const response = await fetch('/api/user-group-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          groupId: permission.group_id,
          can_create: field === 'can_create' ? value : permission.can_create === 1,
          can_read: field === 'can_read' ? value : permission.can_read === 1,
          can_update: field === 'can_update' ? value : permission.can_update === 1,
          can_delete: field === 'can_delete' ? value : permission.can_delete === 1,
        }),
      });

      if (response.ok) {
        loadPermissions();
      }
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  const handleRemovePermission = async (permission: UserGroupPermission) => {
    if (!confirm('Remove access to this group?')) return;

    try {
      const response = await fetch(
        `/api/user-group-permissions?userId=${userId}&groupId=${permission.group_id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        loadPermissions();
      }
    } catch (error) {
      console.error('Failed to remove permission:', error);
    }
  };

  const getGroupName = (groupId: number) => {
    return groups.find((g) => g.id === groupId)?.name || 'Unknown';
  };

  const availableGroups = groups.filter(
    (g) => !permissions.some((p) => p.group_id === g.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Permissions - {userName}
          </DialogTitle>
          <DialogDescription>
            {isSuperuser ? (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="default" className="bg-purple-600">Superuser</Badge>
                <span className="text-sm">This user has full access to all groups and features.</span>
              </div>
            ) : (
              'Configure which groups this user can access and what actions they can perform.'
            )}
          </DialogDescription>
        </DialogHeader>

        {!isSuperuser && (
          <>
            {/* Add New Permission */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Group Access
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Group</Label>
                  <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id.toString()}>
                          {group.name}
                          {group.description && (
                            <span className="text-xs text-muted-foreground ml-2">
                              - {group.description}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="new-create"
                      checked={newPermission.can_create}
                      onCheckedChange={(checked) =>
                        setNewPermission({ ...newPermission, can_create: checked as boolean })
                      }
                    />
                    <Label htmlFor="new-create" className="cursor-pointer">
                      Can Create
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="new-read"
                      checked={newPermission.can_read}
                      onCheckedChange={(checked) =>
                        setNewPermission({ ...newPermission, can_read: checked as boolean })
                      }
                    />
                    <Label htmlFor="new-read" className="cursor-pointer">
                      Can Read
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="new-update"
                      checked={newPermission.can_update}
                      onCheckedChange={(checked) =>
                        setNewPermission({ ...newPermission, can_update: checked as boolean })
                      }
                    />
                    <Label htmlFor="new-update" className="cursor-pointer">
                      Can Update
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="new-delete"
                      checked={newPermission.can_delete}
                      onCheckedChange={(checked) =>
                        setNewPermission({ ...newPermission, can_delete: checked as boolean })
                      }
                    />
                    <Label htmlFor="new-delete" className="cursor-pointer">
                      Can Delete
                    </Label>
                  </div>
                </div>

                <Button
                  onClick={handleAddPermission}
                  disabled={!selectedGroupId}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Permission
                </Button>
              </div>
            </div>

            {/* Current Permissions */}
            <div className="space-y-3">
              <h3 className="font-semibold">Current Group Access</h3>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : permissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                  No group permissions assigned. Add access above.
                </div>
              ) : (
                <div className="space-y-2">
                  {permissions.map((permission) => (
                    <div
                      key={permission.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{getGroupName(permission.group_id)}</h4>
                          <p className="text-xs text-muted-foreground">
                            Group ID: {permission.group_id}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePermission(permission)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`create-${permission.id}`}
                            checked={permission.can_create === 1}
                            onCheckedChange={(checked) =>
                              handleUpdatePermission(permission, 'can_create', checked as boolean)
                            }
                          />
                          <Label
                            htmlFor={`create-${permission.id}`}
                            className="cursor-pointer text-sm"
                          >
                            Create
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`read-${permission.id}`}
                            checked={permission.can_read === 1}
                            onCheckedChange={(checked) =>
                              handleUpdatePermission(permission, 'can_read', checked as boolean)
                            }
                          />
                          <Label
                            htmlFor={`read-${permission.id}`}
                            className="cursor-pointer text-sm"
                          >
                            Read
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`update-${permission.id}`}
                            checked={permission.can_update === 1}
                            onCheckedChange={(checked) =>
                              handleUpdatePermission(permission, 'can_update', checked as boolean)
                            }
                          />
                          <Label
                            htmlFor={`update-${permission.id}`}
                            className="cursor-pointer text-sm"
                          >
                            Update
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`delete-${permission.id}`}
                            checked={permission.can_delete === 1}
                            onCheckedChange={(checked) =>
                              handleUpdatePermission(permission, 'can_delete', checked as boolean)
                            }
                          />
                          <Label
                            htmlFor={`delete-${permission.id}`}
                            className="cursor-pointer text-sm"
                          >
                            Delete
                          </Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
