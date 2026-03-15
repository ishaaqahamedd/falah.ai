import { Outlet } from 'react-router-dom';
import { TopBar } from '../../widgets/top-bar';
import { FloatingDock } from '../../widgets/floating-dock';

export function AppLayout() {
  return (
    <div className="flex flex-col h-screen w-full bg-surface overflow-hidden">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>
      <FloatingDock />
    </div>
  );
}
