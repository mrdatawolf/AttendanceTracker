'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Shield, Eye, EyeOff, Search } from 'lucide-react';
import { UserPermissionsDialog } from '@/components/user-permissions-dialog';
import { useHelp } from '@/lib/help-context';
import { HelpArea } from '@/components/help-area';
import { PageLoading } from '@/components/page-loading';
import { clearCachedDataByPrefix, getCachedData, setCachedData } from '@/lib/client-cache';

interface Role {
  id: number;
  name: string;
  description?: string;
}

interface User {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  group_id: number;
  role_id?: number;
  is_active: number;
  is_superuser?: number; // Deprecated
  last_login?: string;
  group?: Group;
  role?: Role;
}

interface Group {
  id: number;
  name: string;
  description?: string;
  is_master: number;
}

export default function UsersPage() {
  const { user: currentUser, isAuthenticated, isLoading: authLoading, authFetch, isMaster, isAdministrator, isManager } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    group_id: '',
    role_id: '',
  });

  // Set the current screen for help context
  const { setCurrentScreen } = useHelp();
  useEffect(() => {
    setCurrentScreen('users');
  }, [setCurrentScreen]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      if (currentUser && !isMaster && !isAdministrator && !isManager) {
        router.push('/');
        return;
      }
      loadUsers();
      loadGroups();
      loadRoles();
    }
  }, [isAuthenticated, showInactive, currentUser]);

  const loadUsers = async () => {
    const cacheKey = `users:list:${showInactive}`;
    const cachedUsers = getCachedData<User[]>(cacheKey);
    if (cachedUsers) {
      setUsers(cachedUsers);
      setIsLoading(false);
    }

    try {
      const response = await authFetch('/api/users');

      if (response.status === 401) return;

      if (response.ok) {
        const data = await response.json();
        const filteredUsers = showInactive ? data : data.filter((u: User) => u.is_active === 1);
        setUsers(filteredUsers);
        setCachedData(cacheKey, filteredUsers);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await authFetch('/api/groups');

      if (response.status === 401) return;

      if (response.ok) {
        const data = await response.json();
        setGroups(data);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await authFetch('/api/roles');

      if (response.status === 401) return;

      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const handleOpenPermissionsDialog = (user: User) => {
    setSelectedUserForPermissions(user);
    setPermissionsDialogOpen(true);
  };

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '',
        full_name: user.full_name,
        email: user.email || '',
        group_id: user.group_id.toString(),
        role_id: user.role_id?.toString() || '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        full_name: '',
        email: '',
        group_id: '',
        role_id: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      group_id: parseInt(formData.group_id),
      role_id: formData.role_id ? parseInt(formData.role_id) : undefined,
    };

    try {
      if (editingUser) {
        // Update user
        const updatePayload: any = {
          id: editingUser.id,
          full_name: formData.full_name,
          email: formData.email || undefined,
          group_id: parseInt(formData.group_id),
          role_id: formData.role_id ? parseInt(formData.role_id) : undefined,
        };

        // Only include password if it's been changed
        if (formData.password) {
          updatePayload.password = formData.password;
        }

        const response = await authFetch('/api/users', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        });

        if (response.status === 401) return;

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update user');
        }
      } else {
        // Create user
        if (!formData.password) {
          alert('Password is required for new users');
          return;
        }

        const response = await authFetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 401) return;

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create user');
        }
      }

      handleCloseDialog();
      clearCachedDataByPrefix('users:list:');
      loadUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      alert(error instanceof Error ? error.message : 'Failed to save user');
    }
  };

  const handleDelete = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('You cannot deactivate your own account');
      return;
    }

    if (!confirm(`Are you sure you want to deactivate ${user.full_name}?`)) {
      return;
    }

    try {
      const response = await authFetch(`/api/users?id=${user.id}`, {
        method: 'DELETE',
      });

      if (response.status === 401) return;

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      clearCachedDataByPrefix('users:list:');
      loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    }
  };

  const getGroupName = (groupId: number) => {
    return groups.find((g) => g.id === groupId)?.name || 'Unknown';
  };

  const getRoleName = (roleId?: number) => {
    if (!roleId) return 'No Role';
    return roles.find((r) => r.id === roleId)?.name || 'Unknown';
  };

  const visibleUsers = (isMaster || isAdministrator)
    ? users
    : users.filter(u => u.group_id === currentUser?.group_id);

  const filteredUsers = searchQuery.trim()
    ? visibleUsers.filter(u => {
        const q = searchQuery.toLowerCase();
        const groupName = u.group?.name ?? getGroupName(u.group_id);
        const roleName = u.role?.name ?? getRoleName(u.role_id);
        return (
          u.username.toLowerCase().includes(q) ||
          u.full_name.toLowerCase().includes(q) ||
          (u.email?.toLowerCase() ?? '').includes(q) ||
          groupName.toLowerCase().includes(q) ||
          roleName.toLowerCase().includes(q)
        );
      })
    : visibleUsers;

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto p-8">
        <PageLoading label="Loading users..." />
      </div>
    );
  }

  if (!isAuthenticated || (!isMaster && !isAdministrator && !isManager)) {
    return null;
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">System Users Management</h1>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowInactive(!showInactive)}
            className="gap-2"
          >
            {showInactive ? (
              <>
                <EyeOff className="h-4 w-4" />
                Hide Inactive
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Show Inactive
              </>
            )}
          </Button>
          <HelpArea helpId="add-user" bubblePosition="left">
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </HelpArea>
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by username, name, email, group, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {searchQuery.trim() ? 'No users match your search' : 'No users found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className={user.is_active === 0 ? 'opacity-50 bg-muted/30' : ''}
                >
                  <TableCell className="font-mono">{user.username}</TableCell>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>{user.group?.name || getGroupName(user.group_id)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {user.role?.name || getRoleName(user.role_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.is_active === 1 ? (
                      <Badge variant="default" className="bg-green-600">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString()
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {user.is_active === 1 && (
                        <>
                          <HelpArea helpId="edit-user" bubblePosition="left" showHighlight={false}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(user)}
                              title="Edit User"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </HelpArea>
                          {user.role_id !== 1 && (
                            <HelpArea helpId="permissions" bubblePosition="left" showHighlight={false}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenPermissionsDialog(user)}
                                title="Manage Group Permissions"
                              >
                                <Shield className="h-4 w-4" />
                              </Button>
                            </HelpArea>
                          )}
                          <HelpArea helpId="delete-user" bubblePosition="left" showHighlight={false}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(user)}
                              className="text-red-600 hover:text-red-700"
                              disabled={user.id === currentUser?.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </HelpArea>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update user information below.'
                : 'Create a new system user account.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">
                  Username <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  required
                  disabled={!!editingUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {editingUser && <span className="text-xs text-muted-foreground">(leave blank to keep current)</span>}
                  {!editingUser && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required={!editingUser}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="group_id">
                Group <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.group_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, group_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
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

            <div className="space-y-2">
              <Label htmlFor="role_id">
                Role <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.role_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, role_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      <div>
                        <div className="font-medium">{role.name}</div>
                        {role.description && (
                          <div className="text-xs text-muted-foreground">
                            {role.description}
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Roles control what actions the user can perform (create, read, update, delete)
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingUser ? 'Update' : 'Create'} User
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {selectedUserForPermissions && (
        <UserPermissionsDialog
          open={permissionsDialogOpen}
          onOpenChange={setPermissionsDialogOpen}
          userId={selectedUserForPermissions.id}
          userName={selectedUserForPermissions.full_name}
          isSuperuser={selectedUserForPermissions.is_superuser === 1}
        />
      )}
    </div>
  );
}
