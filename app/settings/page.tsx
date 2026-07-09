"use client";

import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme-context';
import { THEMES, ThemeId } from '@/lib/themes';
import { ColorMode } from '@/lib/color-modes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sun, Moon, Monitor, Upload } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { BackupCard } from '@/components/backup-card';
import { GroupManagement } from '@/components/group-management';
import { JobTitleManagement } from '@/components/job-title-management';
import { ColorConfigManagement } from '@/components/color-config-management';
import { OfficeCapacitySettings } from '@/components/office-capacity-settings';
import { SeedDemoDataCard } from '@/components/seed-demo-data-card';
import { EmployeeLinkSettings } from '@/components/employee-link-settings';
import { ApiKeyManagement } from '@/components/api-key-management';
import { ImportAttendanceDialog } from '@/components/import-attendance';
import { useHelp } from '@/lib/help-context';
import { HelpArea } from '@/components/help-area';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const { theme, setTheme, colorMode, setColorMode } = useTheme();
  const { user } = useAuth();
  const { setCurrentScreen } = useHelp();

  // Set the current screen for help context
  useEffect(() => {
    setCurrentScreen('settings');
  }, [setCurrentScreen]);

  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Check if user is admin (member of Master group or similar)
  // For now, we'll show theme controls to all users, but you can add group_id check here
  const isAdmin = user?.group_id === 1; // Master group

  // Check if user is superuser (can manage groups and job titles)
  const isSuperAdmin = user?.is_superuser === 1 || user?.group_id === 1;

  const colorModeOptions: { value: ColorMode; label: string; icon: typeof Sun; description: string }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: Sun,
      description: 'Always use light colors'
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: Moon,
      description: 'Always use dark colors'
    },
    {
      value: 'system',
      label: 'System',
      icon: Monitor,
      description: 'Match your system preference'
    },
  ];

  return (
    <div className="min-h-screen p-3">
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your application preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize how the application looks and feels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Color Mode - User Preference */}
            <div className="space-y-2">
              <HelpArea helpId="color-mode" bubblePosition="right">
                <Label htmlFor="color-mode" className="cursor-help">Color Mode</Label>
              </HelpArea>
              <Select
                value={colorMode}
                onValueChange={(value: ColorMode) => setColorMode(value)}
              >
                <SelectTrigger id="color-mode" className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorModeOptions.map(option => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {colorModeOptions.find(o => o.value === colorMode)?.description}
              </p>
            </div>

            {/* Theme - Admin Setting (only show to admins) */}
            {isAdmin && (
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <HelpArea helpId="layout-theme" bubblePosition="right">
                    <Label htmlFor="theme" className="cursor-help">Layout Theme</Label>
                  </HelpArea>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-primary/10 rounded">
                    Admin Only
                  </span>
                </div>
                <Select
                  value={theme}
                  onValueChange={(value: ThemeId) => setTheme(value)}
                >
                  <SelectTrigger id="theme" className="w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEMES.map(themeConfig => (
                      <SelectItem key={themeConfig.id} value={themeConfig.id}>
                        {themeConfig.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Controls layout density, typography, and spacing for all users.
                  This setting does not affect colors.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee Profile Link - All Users */}
        <EmployeeLinkSettings />

        {/* Groups Management - Super Admin Only */}
        {isSuperAdmin && <GroupManagement />}

        {/* Job Titles - Super Admin Only */}
        {isSuperAdmin && <JobTitleManagement />}

        {/* Color Configuration - Super Admin Only */}
        {isSuperAdmin && <ColorConfigManagement />}

        {/* Office Capacity Settings - Super Admin Only */}
        {isSuperAdmin && <OfficeCapacitySettings />}

        {/* Import Attendance Data - Super Admin Only */}
        {isSuperAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Import Attendance Data</CardTitle>
              <CardDescription>
                Import attendance records from an Excel file (.xlsx / .xlsm)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setImportDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Excel File
              </Button>
              <ImportAttendanceDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
            </CardContent>
          </Card>
        )}

        {/* API Keys - Super Admin Only */}
        {isSuperAdmin && <ApiKeyManagement />}

        {/* Database Backups - Admin Only */}
        {isAdmin && <BackupCard />}

        {/* Demo Data Seeding - Admin Only */}
        {isAdmin && <SeedDemoDataCard />}
      </div>
    </div>
  );
}
