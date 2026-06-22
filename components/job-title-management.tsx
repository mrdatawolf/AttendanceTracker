"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Briefcase, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface JobTitle {
  id: number;
  name: string;
  description?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface JobTitleFormData {
  name: string;
  description: string;
  is_active: boolean;
}

const emptyFormData: JobTitleFormData = {
  name: '',
  description: '',
  is_active: true,
};

export function JobTitleManagement() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedJobTitle, setSelectedJobTitle] = useState<JobTitle | null>(null);
  const [formData, setFormData] = useState<JobTitleFormData>(emptyFormData);

  const fetchJobTitles = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const res = await fetch('/api/job-titles', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setJobTitles(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch job titles:', res.status);
        setJobTitles([]);
      }
    } catch (error) {
      console.error('Failed to fetch job titles:', error);
      setJobTitles([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchJobTitles();
  }, [fetchJobTitles]);

  const handleAddJobTitle = async () => {
    if (!token || !formData.name.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/job-titles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          is_active: formData.is_active ? 1 : 0,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Job title created',
          description: `Job title "${formData.name}" has been created.`,
        });
        setIsAddDialogOpen(false);
        setFormData(emptyFormData);
        fetchJobTitles();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to create job title.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while creating the job title.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditJobTitle = async () => {
    if (!token || !selectedJobTitle || !formData.name.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/job-titles', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: selectedJobTitle.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          is_active: formData.is_active ? 1 : 0,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Job title updated',
          description: `Job title "${formData.name}" has been updated.`,
        });
        setIsEditDialogOpen(false);
        setSelectedJobTitle(null);
        setFormData(emptyFormData);
        fetchJobTitles();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to update job title.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while updating the job title.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteJobTitle = async () => {
    if (!token || !selectedJobTitle) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/job-titles?id=${selectedJobTitle.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast({
          title: 'Job title deleted',
          description: `Job title "${selectedJobTitle.name}" has been deleted.`,
        });
        setIsDeleteDialogOpen(false);
        setSelectedJobTitle(null);
        fetchJobTitles();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete job title.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while deleting the job title.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (jobTitle: JobTitle) => {
    setSelectedJobTitle(jobTitle);
    setFormData({
      name: jobTitle.name,
      description: jobTitle.description || '',
      is_active: jobTitle.is_active === 1,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (jobTitle: JobTitle) => {
    setSelectedJobTitle(jobTitle);
    setIsDeleteDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Job Titles
              </CardTitle>
              <CardDescription>
                Define job titles that can be assigned to employees
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
              Add Job Title
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobTitles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No job titles found. Create your first job title to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobTitles.map((jobTitle) => (
                  <TableRow key={jobTitle.id}>
                    <TableCell className="font-medium">
                      {jobTitle.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {jobTitle.description || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {jobTitle.is_active === 1 ? (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(jobTitle)}
                          title="Edit job title"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(jobTitle)}
                          title="Delete job title"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Job Title Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Job Title</DialogTitle>
            <DialogDescription>
              Create a new job title that can be assigned to employees.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Operator, Supervisor, Manager"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-description">Description</Label>
              <Input
                id="add-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of responsibilities"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="add-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive job titles will not be available for assignment
                </p>
              </div>
              <Switch
                id="add-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddJobTitle} disabled={isSaving || !formData.name.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Job Title
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Job Title Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Job Title</DialogTitle>
            <DialogDescription>
              Update job title details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">
                Title <span className="text-destructive">*</span>
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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="edit-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive job titles will not be available for assignment
                </p>
              </div>
              <Switch
                id="edit-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditJobTitle} disabled={isSaving || !formData.name.trim()}>
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
            <AlertDialogTitle>Delete Job Title</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the job title &quot;{selectedJobTitle?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteJobTitle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Job Title
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
