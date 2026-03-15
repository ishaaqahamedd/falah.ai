import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Intent = 'primary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';
type Actor = 'user' | 'agent' | 'system';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: Intent;
  size?: Size;
  isLoading?: boolean;
  actor?: Actor;
  children?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      intent = 'primary',
      size = 'md',
      isLoading = false,
      actor = 'user',
      disabled,
      children,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const intentClasses: Record<Intent, string> = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      danger: 'bg-red-600 text-white hover:bg-red-700',
      ghost: 'bg-transparent text-slate-300 hover:bg-slate-700',
      outline: 'border border-slate-600 text-slate-300 hover:bg-slate-700',
    };

    const sizeClasses: Record<Size, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    const actorClass = actor === 'agent' ? 'ring-1 ring-purple-400' : '';

    const isDisabled = disabled || isLoading;

    const classes = [
      'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900',
      intentClasses[intent],
      sizeClasses[size],
      actorClass,
      isDisabled ? 'opacity-50 cursor-not-allowed' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} className={classes} disabled={isDisabled} {...rest}>
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button };
export type { ButtonProps };
