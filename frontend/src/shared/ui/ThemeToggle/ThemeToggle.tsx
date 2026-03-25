import { useThemeStore } from '../../../entities/theme/store';
import { SunIcon, MoonIcon } from '../Icons';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-surface-tertiary transition-colors text-text-secondary hover:text-text-primary"
      aria-label="Toggle theme"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
