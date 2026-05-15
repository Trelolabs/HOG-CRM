import AppShell from '@/components/AppShell';
import Toaster from '@/components/ui/Toaster';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <Toaster />
    </>
  );
}
