import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { UserCircleIcon, BotIcon } from '../../shared/ui/Icons';

const navItems = [
  { to: '/superadmin/users', label: 'Users',      Icon: UserCircleIcon },
  { to: '/superadmin/ai',    label: 'Gemini AI',  Icon: BotIcon },
];

export function SuperadminLayout() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen w-full bg-surface overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 border-r border-border-primary flex flex-col">
        <div
          className="px-5 py-5 border-b border-border-primary cursor-pointer"
          onClick={() => navigate('/superadmin/users')}
        >
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">Falah.ai</p>
          <p className="text-sm font-bold text-text-primary mt-0.5">Superadmin</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600/10 text-blue-500'
                    : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
                ].join(' ')
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-border-primary">
          <p className="text-xs text-text-muted">Owner access only</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
