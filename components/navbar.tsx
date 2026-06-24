"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { config } from '@/lib/config';
import { getCurrentBrandId } from '@/lib/brand-config';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { getTheme } from '@/lib/themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Shield, Map, FlaskConical, Settings, HelpCircle, KeyRound } from 'lucide-react';
import { useHelp } from '@/lib/help-context';
import { OfficePresenceBar } from '@/components/office-presence-bar';
import { ChangePasswordDialog } from '@/components/change-password-dialog';

const NAV_ITEMS = [
  { href: '/attendance', label: 'Attendance', enabled: true, superuserOnly: false },
  { href: '/employees', label: 'Employees', enabled: true, superuserOnly: false },
  { href: '/users', label: 'Users', enabled: true, superuserOnly: true },
  { href: '/dashboard', label: 'Dashboard', enabled: config.features.enableDashboard, superuserOnly: false },
  { href: '/reports', label: 'Reports', enabled: config.features.enableReports, superuserOnly: false },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout, isLoading, isMaster, isAdministrator, isManager } = useAuth();
  const { theme: themeId } = useTheme();
  const { isHelpMode, toggleHelpMode } = useHelp();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const themeConfig = getTheme(themeId);
  const showAdminMenu = isMaster || isAdministrator;

  // Persist the last visited main page so the app can return to it on re-open
  const TRACKED_PATHS = ['/attendance', '/employees', '/users', '/dashboard', '/reports', '/settings'];
  useEffect(() => {
    if (isAuthenticated && TRACKED_PATHS.includes(pathname)) {
      localStorage.setItem('last_visited_page', pathname);
    }
  }, [pathname, isAuthenticated]);
  const enabledItems = NAV_ITEMS.filter(item => {
    if (!item.enabled) return false;
    // superuserOnly items are visible to admins and managers
    if (item.superuserOnly && !showAdminMenu && !isManager) return false;
    return true;
  });

  const isNFL = getCurrentBrandId() === 'NFL';

  const logoSrc = themeConfig.branding.logo || '/default.png';
  const logoAlt = themeConfig.branding.logoAlt || 'Logo';
  const appTitle = themeConfig.branding.appTitle;

  return (
    <nav className={cn('border-b sticky top-0 z-50 print:hidden', isNFL ? 'bg-muted' : 'bg-background')}>
      <div className="max-w-full mx-auto px-3">
        <div className="flex h-10 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-10 items-center justify-center rounded-md border border-gray-300 bg-gray-200 p-1 shadow-sm">
                <span className="relative h-6 w-8">
                  <Image
                    src={logoSrc}
                    alt={logoAlt}
                    fill
                    priority
                    sizes="32px"
                    className="object-contain"
                  />
                </span>
              </span>
              <span className={cn('hidden sm:inline font-bold', isNFL ? 'text-xl' : 'text-lg')}>{appTitle}</span>
            </Link>
            {isAuthenticated && <OfficePresenceBar />}
          </div>
          <div className="flex items-center space-x-4">
            {isAuthenticated && enabledItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm transition-colors',
                  isNFL
                    ? cn(
                        'font-semibold text-[#0F172A] dark:text-[#F8FAFC] hover:opacity-80',
                        pathname === item.href && 'border-b-2 border-primary pb-0.5'
                      )
                    : cn(
                        'font-medium hover:text-primary',
                        pathname === item.href ? 'text-primary' : 'text-muted-foreground'
                      )
                )}
              >
                {item.label}
              </Link>
            ))}

            {/* Help Mode Toggle */}
            {isAuthenticated && (
              <Button
                variant={isHelpMode ? 'default' : 'ghost'}
                size="sm"
                onClick={toggleHelpMode}
                className={cn(
                  'gap-1.5',
                  isHelpMode && 'bg-blue-600 hover:bg-blue-700 text-white'
                )}
                title={isHelpMode ? 'Exit Help Mode' : 'Enter Help Mode'}
              >
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">
                  {isHelpMode ? 'Help On' : 'Help'}
                </span>
              </Button>
            )}

            {!isLoading && (
              <>
                {isAuthenticated && user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <User className="h-4 w-4" />
                        <span className="hidden sm:inline">{user.full_name}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled>
                        <Shield className="mr-2 h-4 w-4" />
                        <span>{user.role?.name || user.group.name}</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setChangePasswordOpen(true)} className="cursor-pointer">
                        <KeyRound className="mr-2 h-4 w-4" />
                        <span>Change Password</span>
                      </DropdownMenuItem>
                      {showAdminMenu && (
                        <>
                          <DropdownMenuItem onClick={() => router.push('/tests')} className="cursor-pointer">
                            <FlaskConical className="mr-2 h-4 w-4" />
                            <span>Tests</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push('/roadmap')} className="cursor-pointer">
                            <Map className="mr-2 h-4 w-4" />
                            <span>Roadmap</span>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={logout} className="text-red-600">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
        ) : pathname === '/login' || pathname === '/' ? null : (
                  <Link href="/login">
                    <Button variant="default" size="sm" className="h-7 px-3 text-xs">
                      Sign In
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </nav>
  );
}
