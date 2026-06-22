"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Users, Plus, Pencil, Trash2, Loader2, Check, X, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Group {
  id: number;
  name: string;
  description?: string;
  is_master: number;
  can_view_all: number;
  can_edit_all: number;
  created_at: string;
  updated_at: string;
  employee_count?: number;
}

interface GroupFormData {
  name: string;
  description: string;
  can_view_all: boolean;
  can_edit_all: boolean;
}

const emptyFormData: GroupFormData = {
  name: '',
  description: '',
  can_view_all: false,
  can_edit_all: false,
};

export function GroupManagement() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState<GroupFormData>(emptyFormData);

  const fetchGroups = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const res = await fetch('/api/groups', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch groups:', res.status);
        setGroups([]);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleAddGroup = async () => {
    if (!token || !formData.name.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          can_view_all: formData.can_view_all ? 1 : 0,
          can_edit_all: formData.can_edit_all ? 1 : 0,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Group created',
          description: `Group "${formData.name}" has been created.`,
        });
        setIsAddDialogOpen(false);
        setFormData(emptyFormData);
        fetchGroups();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to create group.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while creating the group.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditGroup = async () => {
    if (!token || !selectedGroup || !formData.name.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: selectedGroup.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          can_view_all: formData.can_view_all ? 1 : 0,
          can_edit_all: formData.can_edit_all ? 1 : 0,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Group updated',
          description: `Group "${formData.name}" has been updated.`,
        });
        setIsEditDialogOpen(false);
        setSelectedGroup(null);
        setFormData(emptyFormData);
        fetchGroups();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to update group.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while updating the group.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!token || !selectedGroup) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/groups?id=${selectedGroup.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast({
          title: 'Group deleted',
          description: `Group "${selectedGroup.name}" has been deleted.`,
        });
        setIsDeleteDialogOpen(false);
        setSelectedGroup(null);
        fetchGroups();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete group.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while deleting the group.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (group: Group) => {
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      can_view_all: group.can_view_all === 1,
      can_edit_all: group.can_edit_all === 1,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (group: Group) => {
    setSelectedGroup(group);
    setIsDeleteDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Groups Management
              </CardTitle>
              <CardDescription>
                Create and manage employee groups
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setFormData(emptyFormData);
                setIsAddDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Group
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No groups found. Create your first group to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">View All</TableHead>
                  <TableHead className="text-center">Edit All</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {group.name}
                        {group.is_master === 1 && (
                          <span title="Master Group">
                            <Shield className="h-4 w-4 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {group.description || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {group.can_view_all === 1 || group.is_master === 1 ? (
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {group.can_edit_all === 1 || group.is_master === 1 ? (
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(group)}
                          title="Edit group"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {group.is_master !== 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(group)}
                            title="Delete group"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Group Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Group</DialogTitle>
            <DialogDescription>
              Create a new group for organizing employees.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Production, Office, Warehouse"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-description">Description</Label>
              <Input
                id="add-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="add-view-all">Can View All Groups</Label>
                <p className="text-xs text-muted-foreground">
                  Members can view employees from all groups
                </p>
              </div>
              <Switch
                id="add-view-all"
                checked={formData.can_view_all}
                onCheckedChange={(checked) => setFormData({ ...formData, can_view_all: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="add-edit-all">Can Edit All Groups</Label>
                <p className="text-xs text-muted-foreground">
                  Members can edit employees from all groups
                </p>
              </div>
              <Switch
                id="add-edit-all"
                checked={formData.can_edit_all}
                onCheckedChange={(checked) => setFormData({ ...formData, can_edit_all: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddGroup} disabled={isSaving || !formData.name.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>
              Update group settings and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            {selectedGroup?.is_master !== 1 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-view-all">Can View All Groups</Label>
                    <p className="text-xs text-muted-foreground">
                      Members can view employees from all groups
                    </p>
                  </div>
                  <Switch
                    id="edit-view-all"
                    checked={formData.can_view_all}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_view_all: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-edit-all">Can Edit All Groups</Label>
                    <p className="text-xs text-muted-foreground">
                      Members can edit employees from all groups
                    </p>
                  </div>
                  <Switch
                    id="edit-edit-all"
                    checked={formData.can_edit_all}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_edit_all: checked })}
                  />
                </div>
              </>
            )}
            {selectedGroup?.is_master === 1 && (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                Master groups have full access to all groups and cannot have permissions modified.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditGroup} disabled={isSaving || !formData.name.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the group &quot;{selectedGroup?.name}&quot;?
              This action cannot be undone.
              {selectedGroup?.employee_count && selectedGroup.employee_count > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Warning: This group has {selectedGroup.employee_count} employee(s) assigned to it.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
