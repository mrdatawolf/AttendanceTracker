import { Spinner } from '@/components/spinner';

interface PageLoadingProps {
  label?: string;
}

export function PageLoading({ label = 'Loading...' }: PageLoadingProps) {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-lg border bg-card/70 shadow-sm">
      <div className="text-center">
        <Spinner />
        <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
