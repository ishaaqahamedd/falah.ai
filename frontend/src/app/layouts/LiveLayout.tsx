import { Outlet } from 'react-router-dom';

export function LiveLayout() {
  return (
    <div className="h-screen w-full overflow-hidden flex flex-col">
      <Outlet />
    </div>
  );
}
