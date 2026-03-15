import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

type Padding = 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  interactive?: boolean;
  children?: ReactNode;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'md', interactive = false, className = '', children, ...rest }, ref) => {
    const paddingClasses: Record<Padding, string> = {
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6',
    };

    const classes = [
      'bg-slate-800 border border-slate-700 rounded-xl',
      paddingClasses[padding],
      interactive ? 'hover:border-blue-500 transition-colors cursor-pointer' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={classes} {...rest}>
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';

export { Card };
export type { CardProps };
