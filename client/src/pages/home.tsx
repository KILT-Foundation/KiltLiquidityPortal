import { MainDashboard } from '@/components/main-dashboard';
import { usePrefetch } from '@/hooks/use-prefetch';

export default function Home() {
  // Prefetch critical data for faster navigation
  usePrefetch();
  
  return <MainDashboard />;
}
