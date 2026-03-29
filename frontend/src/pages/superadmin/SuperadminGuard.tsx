import { Navigate, Outlet } from 'react-router-dom';
import { useUserStore } from '../../entities/user/store';

export function SuperadminGuard() {
  const user = useUserStore((s) => s.user);

  if (user?.role !== 'superadmin') return <Navigate to="/agents" replace />;

  return <Outlet />;
}
