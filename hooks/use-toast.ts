// Simple toast hook placeholder
// In a production app, you'd use something like sonner or radix-ui toast

export function useToast() {
  return {
    toast: (props: { title?: string; description?: string; variant?: string }) => {
      console.log('Toast:', props);
    },
  };
}
