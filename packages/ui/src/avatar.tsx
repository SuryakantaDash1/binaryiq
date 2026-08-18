import { cn } from './utils/cn.js';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' };

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps): React.JSX.Element {
  if (src) {
    return <img src={src} alt={name} className={cn('rounded-full object-cover', SIZE[size], className)} />;
  }
  return (
    <div
      className={cn(
        'bg-primary text-on-primary flex items-center justify-center rounded-full font-semibold',
        SIZE[size],
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
export type { AvatarProps };
