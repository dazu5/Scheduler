// Unified create + edit modal for Sessions. Replaces the slice #3
// NewSessionModal — the `editing` prop selects between modes:
//   - editing === null  → create flow; calls onCreate(input, spill)
//   - editing === Session → edit flow; calls onUpdate(id, input)
//
// Slice #4 adds the live overlap warning, the overnight hint, the
// audit-log generation via applySessionEdit, and Esc / Ctrl+Enter
// keyboard shortcuts.

import { useEffect, useState } from 'react';
import { applySessionEdit } from '../shared/adjustments';
import type { OvernightSpill, Session, SessionInput, UpdateSessionInput } from '../shared/ipc';
import { findOverlaps } from '../shared/overlap';
import {
  addDays,
  dateKey,
  formatTime,
  mmToInput,
  parseDateKey,
  readEditTimes,
} from '../shared/time';

const CATEGORIES = ['animation', 'workflow', 'cornerman', 'break'] as const;
type Category = (typeof CATEGORIES)[number];

export interface SessionEditorProps {
  /** Existing Session being edited; null for create flow. */
  editing: Session | null;
  /** dateKey for the day the editor was opened on. Used as
   *  origin-date for the overnight spill's next-day calculation. */
  defaultDateKey: string;
  /** Hour (24-hour, 0..23) the editor was opened on. Drives create
   *  flow's default start/end. */
  defaultHour: number;
  /** Other Sessions on the same day, for the live overlap warning. */
  daySessions: Session[];
  onCreate: (input: SessionInput, spill: OvernightSpill | null) => void | Promise<void>;
  onUpdate: (id: string, input: UpdateSessionInput) => void | Promise<void>;
  onCancel: () => void;
}

export function SessionEditor({
  editing,
  defaultDateKey,
  defaultHour,
  daySessions,
  onCreate,
  onUpdate,
  onCancel,
}: SessionEditorProps) {
  const originDateKey = editing?.dateKey ?? defaultDateKey;
  const [category, setCategory] = useState<Category>(
    (editing?.category as Category) ?? 'animation',
  );
  const [label, setLabel] = useState(editing?.label ?? '');
  const [start, setStart] = useState(() => mmToInput(editing?.startMin ?? defaultHour * 60));
  const [end, setEnd] = useState(() => mmToInput(editing?.endMin ?? (defaultHour + 1) * 60));
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  // Live parsing — drives the overlap warning + overnight hint
  // without needing a Save click.
  const parsed = readEditTimes(start, end);
  const editingId = editing?.id ?? '__new__';
  const overlaps =
    parsed && !parsed.zeroLength
      ? findOverlaps(daySessions, {
          id: editingId,
          startMin: parsed.startMin,
          endMin: parsed.endMin,
        })
      : [];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const form = document.querySelector<HTMLFormElement>('form[data-role="session-editor"]');
        form?.requestSubmit();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!parsed) {
      setError('Please enter valid start and end times.');
      return;
    }
    if (parsed.zeroLength) {
      setError('End time must be after start time.');
      return;
    }

    const labelOrFallback = label.trim() || category;
    const notesOrNull = notes.trim() || null;
    const overnightSpill: OvernightSpill | null =
      parsed.overnightEnd !== null && parsed.overnightEnd > 0
        ? {
            nextDateKey: dateKey(addDays(parseDateKey(originDateKey), 1)),
            endMin: parsed.overnightEnd,
          }
        : null;

    if (editing) {
      const result = applySessionEdit(editing, {
        category,
        label: labelOrFallback,
        startMin: parsed.startMin,
        endMin: parsed.endMin,
        notes: notesOrNull,
      });
      void onUpdate(editing.id, {
        category,
        label: labelOrFallback,
        startMin: parsed.startMin,
        endMin: parsed.endMin,
        notes: notesOrNull,
        audit: result.audit,
        overnightSpill,
      });
    } else {
      void onCreate(
        {
          dateKey: originDateKey,
          category,
          label: labelOrFallback,
          startMin: parsed.startMin,
          endMin: parsed.endMin,
          notes: notesOrNull,
        },
        overnightSpill,
      );
    }
  };

  const dialogTitle = editing ? 'Edit Session' : 'New Session';
  const overnightHintEnd = parsed?.overnightEnd;

  return (
    // biome-ignore lint/a11y/useSemanticElements: native <dialog> needs .showModal() which happy-dom partial-mocks; div + role keeps tests portable, revisit when we polish UX
    <div role="dialog" aria-label={dialogTitle}>
      <form data-role="session-editor" onSubmit={handleSubmit}>
        <h2>
          {dialogTitle} — {originDateKey}
        </h2>

        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label>
          Label
          {/* biome-ignore lint/a11y/noAutofocus: editor convention from
              weekly_scheduler.html — first field gets focus on open */}
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        </label>

        <label>
          Start
          <input type="time" step="900" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>

        <label>
          End
          <input type="time" step="900" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>

        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {typeof overnightHintEnd === 'number' && overnightHintEnd > 0 && (
          <p data-testid="overnight-hint">
            ↪ Ends {formatTime(overnightHintEnd)} the next day — saved as two linked blocks.
          </p>
        )}

        {overlaps.length > 0 && (
          <p role="alert" data-testid="overlap-warning">
            ⚠ Overlaps with {overlaps.map((o) => o.label).join(', ')}. You can still save.
          </p>
        )}

        {error && <p role="alert">{error}</p>}

        <div>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  );
}
