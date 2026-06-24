"use client";

import { Button } from '@/components/ui/button';
import { HelpArea } from '@/components/help-area';
import { Printer } from 'lucide-react';

interface PrintReportButtonProps {
  disabled?: boolean;
}

export function PrintReportButton({ disabled = false }: PrintReportButtonProps) {
  return (
    <HelpArea helpId="print-report" bubblePosition="top" showHighlight={false}>
      <Button
        onClick={() => window.print()}
        disabled={disabled}
        variant="outline"
        className="gap-1.5"
      >
        <Printer className="h-4 w-4" />
        Print / Save as PDF
      </Button>
    </HelpArea>
  );
}
