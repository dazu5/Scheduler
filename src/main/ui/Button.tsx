// Issue #18 chunk 2 — Button primitive.
//
// Four variants drive the visual hierarchy:
//   primary   — main CTA (Save, confirm)
//   secondary — neutral default (Cancel, header nav)
//   ghost     — borderless, for inline / icon-button uses
//   danger    — destructive (Delete confirmation)
//
// The `type` default is "button" — the HTML default of "submit"
// causes accidental form submission inside <form>s; matches the
// convention in weekly_scheduler.html.

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium ' +
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-1.5 text-sm',
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white border-accent hover:bg-accent-hover ' + 'active:translate-y-px',
  secondary: 'bg-surface-2 text-fg border-border hover:bg-border ' + 'active:translate-y-px',
  ghost: 'bg-transparent text-fg border-transparent hover:bg-surface-2 ' + 'active:translate-y-px',
  danger: 'bg-danger text-white border-danger hover:bg-red-600 ' + 'active:translate-y-px',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [BASE, SIZE[size], VARIANT[variant], className].filter(Boolean).join(' ');
  return (
    <button type={type} data-variant={variant} data-size={size} className={classes} {...rest}>
      {children}
    </button>
  );
}
