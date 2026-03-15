import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUserStore } from '../../entities/user/store';
import { ThemeToggle } from '../../shared/ui/ThemeToggle';
import { Avatar } from '../../shared/ui/Avatar';

export function TopBar() {
  const { user, logout } = useUserStore();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="flex-none h-14 px-6 bg-surface border-b border-border-secondary flex items-center justify-between z-20">
      {/* Logo */}
      <Link to="/agents" className="text-xl font-bold text-text-primary tracking-tight hover:opacity-80 transition-opacity">
        Falah.ai
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-surface-tertiary transition-colors"
            >
              <Avatar name={user.full_name} size="sm" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-surface-secondary border border-border-primary rounded-xl shadow-xl py-1 z-50">
                <div className="px-4 py-2 border-b border-border-secondary">
                  <p className="text-sm font-medium text-text-primary truncate">{user.full_name}</p>
                  <p className="text-xs text-text-muted truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => { setShowMenu(false); logout(); }}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-surface-tertiary transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
