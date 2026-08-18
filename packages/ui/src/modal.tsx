'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from './utils/cn.js';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
  children?: ReactNode;
}

const sizeMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

/**
 * The single modal system. Every dialog in the app is a configuration of this
 * (confirm redemption, spin result, already-voted, etc.). See design-system/13 §4.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  footer,
  children,
}: ModalProps): React.JSX.Element {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2',
            'border-border bg-surface rounded-lg border shadow-lg focus:outline-none',
            sizeMap[size],
          )}
        >
          <div className="border-border flex items-start justify-between border-b px-5 py-4">
            <div>
              {title && (
                <Dialog.Title className="text-text text-lg font-semibold">{title}</Dialog.Title>
              )}
              {description && (
                <Dialog.Description className="text-text-muted mt-1 text-sm">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="text-text-muted hover:text-text focus-visible:ring-focus rounded-sm focus-visible:outline-none focus-visible:ring-[3px]"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          {children && <div className="px-5 py-4">{children}</div>}
          {footer && <div className="border-border border-t px-5 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
