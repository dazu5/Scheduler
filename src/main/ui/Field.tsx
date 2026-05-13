// Issue #18 chunk 2 — form field primitives.
//
// Four wrappers — Input, Select, TextArea, Checkbox — sharing a
// consistent visual shell: surface-tier background, border in the
// neutral palette, accent-coloured focus ring, danger ring on error.
//
// Each accepts an optional `label` that renders as a wrapping
// <label> element — auto-association without juggling htmlFor / id.
// `hint` shows a muted helper line below the control; `error`
// replaces the hint with a `role="alert"` message and toggles
// `aria-invalid`.

import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react';

const FIELD_BASE =
  'w-full rounded-md bg-bg border border-border text-fg text-sm px-3 py-2 ' +
  'placeholder:text-fg-muted ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-accent ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

interface SharedFieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

// The label is rendered as a sibling of the field (not as a wrapper)
// so that `getByLabelText('X')` matches against just the label text
// — not the concatenation of label text + error message text, which
// would happen if the error span lived inside the label element.
function FieldShell({
  label,
  hint,
  error,
  htmlFor,
  children,
}: SharedFieldProps & { htmlFor: string; children: ReactNode }) {
  if (!label && !hint && !error) return <>{children}</>;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs uppercase tracking-wider text-fg-muted font-medium"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-fg-muted">{hint}</span>
      ) : null}
    </div>
  );
}

// ---- Input ----

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    SharedFieldProps {}

export function Input({ label, hint, error, className, id, ...rest }: InputProps) {
  const autoId = useId();
  const finalId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={finalId}>
      <input
        id={finalId}
        aria-invalid={error ? true : undefined}
        className={[FIELD_BASE, className].filter(Boolean).join(' ')}
        {...rest}
      />
    </FieldShell>
  );
}

// ---- Select ----

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, SharedFieldProps {}

export function Select({ label, hint, error, className, id, children, ...rest }: SelectProps) {
  const autoId = useId();
  const finalId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={finalId}>
      <select
        id={finalId}
        aria-invalid={error ? true : undefined}
        className={[FIELD_BASE, 'appearance-none pr-8', className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

// ---- TextArea ----

export interface TextAreaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    SharedFieldProps {}

export function TextArea({ label, hint, error, className, id, ...rest }: TextAreaProps) {
  const autoId = useId();
  const finalId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={finalId}>
      <textarea
        id={finalId}
        aria-invalid={error ? true : undefined}
        className={[FIELD_BASE, 'min-h-[60px] resize-y font-sans', className]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
    </FieldShell>
  );
}

// ---- Checkbox ----

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
}

export function Checkbox({ label, className, id, ...rest }: CheckboxProps) {
  const autoId = useId();
  const finalId = id ?? autoId;
  const input = (
    <input
      id={finalId}
      type="checkbox"
      className={[
        'size-4 rounded border-border bg-bg text-accent',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'focus-visible:ring-offset-bg cursor-pointer',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
  if (!label) return input;
  return (
    <label htmlFor={finalId} className="inline-flex items-center gap-2 text-sm text-fg">
      {input}
      <span>{label}</span>
    </label>
  );
}
