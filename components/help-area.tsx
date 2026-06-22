'use client';

import { ReactNode, useState } from 'react';
import { useHelp } from '@/lib/help-context';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface HelpAreaProps {
  /** Unique section identifier matching help content */
  helpId: string;
  /** Child elements to wrap */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Preferred position for the help bubble (Radix will auto-adjust if needed) */
  bubblePosition?: 'top' | 'bottom' | 'left' | 'right';
  /** Whether to show the highlight ring when help mode is active */
  showHighlight?: boolean;
}

/**
 * HelpArea Component
 *
 * Wraps UI sections with help functionality. When help mode is active:
 * - Shows a highlight ring around the section (optional)
 * - Displays help popover on hover (no click required)
 * - Uses Radix UI Popover for automatic viewport collision detection
 */
export function HelpArea({
  helpId,
  children,
  className,
  bubblePosition = 'bottom',
  showHighlight = true,
}: HelpAreaProps) {
  const { isHelpMode, getSectionHelp } = useHelp();
  const [isOpen, setIsOpen] = useState(false);

  const helpContent = getSectionHelp(helpId);

  // If not in help mode, render children without any wrapper
  if (!isHelpMode) {
    return <>{children}</>;
  }

  // If no help content defined for this section, render with optional highlight only
  if (!helpContent) {
    return (
      <div
        className={cn(
          showHighlight && 'ring-2 ring-blue-400/50 ring-offset-1 rounded',
          className
        )}
      >
        {children}
      </div>
    );
  }

  // Map position to Radix side
  const sideMap = {
    top: 'top',
    bottom: 'bottom',
    left: 'left',
    right: 'right',
  } as const;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          data-help-id={helpId}
          className={cn(
            'cursor-help transition-all duration-200',
            showHighlight && [
              'ring-2 ring-blue-400 ring-offset-1 rounded',
              'hover:ring-blue-500',
            ],
            className
          )}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          role="button"
          aria-label={`Help for ${helpContent.title}`}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side={sideMap[bubblePosition]}
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="w-80 p-0 border-blue-200 dark:border-blue-800 pointer-events-none"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 rounded-t-md">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <h3 className="font-semibold text-sm text-blue-700 dark:text-blue-300">
            {helpContent.title}
          </h3>
        </div>

        {/* Content sections */}
        <div className="p-3 space-y-3 text-sm">
          <div>
            <p className="font-medium text-muted-foreground text-xs mb-1">What it is:</p>
            <p className="text-foreground">{helpContent.whatItIs}</p>
          </div>

          <div>
            <p className="font-medium text-muted-foreground text-xs mb-1">How to use:</p>
            <p className="text-foreground">{helpContent.howToUse}</p>
          </div>

          <div>
            <p className="font-medium text-muted-foreground text-xs mb-1">How to update:</p>
            <p className="text-foreground">{helpContent.howToUpdate}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
