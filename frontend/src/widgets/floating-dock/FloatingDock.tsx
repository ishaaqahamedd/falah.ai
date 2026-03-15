import { Link, useLocation } from 'react-router-dom';
import { BotIcon, ClockIcon, GlobeIcon, PlugIcon } from '../../shared/ui/Icons';

interface DockItem {
  icon: React.ReactNode;
  label: string;
  to: string;
}

const DOCK_ITEMS: DockItem[] = [
  { icon: <BotIcon className="w-6 h-6" />, label: 'Agents', to: '/agents' },
  { icon: <ClockIcon className="w-6 h-6" />, label: 'Sessions', to: '/sessions' },
  { icon: <GlobeIcon className="w-6 h-6" />, label: 'Community', to: '/community' },
  { icon: <PlugIcon className="w-6 h-6" />, label: 'Connectors', to: '/connectors' },
];

export function FloatingDock() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
      <div className="flex items-center gap-1 px-3 py-2 bg-surface-secondary/70 backdrop-blur-xl border border-border-primary/50 rounded-full shadow-2xl">
        {DOCK_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-all duration-200 group
                ${isActive
                  ? 'text-blue-500'
                  : 'text-text-muted hover:text-text-primary'
                }
                hover:scale-125
              `}
            >
              {item.icon}
              <span className="text-[10px] font-medium hidden md:block">{item.label}</span>
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
