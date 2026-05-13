// Unified create + edit modal for Sessions. Refactored in issue #18
// chunk 3 to use the primitive library (Modal, Input, Select,
// TextArea, Button) and the Tailwind v4 design tokens.
//
//   editing === null   → create flow; calls onCreate(input, spill)
//   editing === Session → edit flow; calls onUpdate(id, input)
//
// The Modal primitive owns Escape-to-close and focus management;
// this component owns Ctrl/Cmd+Enter to submit, live overlap
// detection, the overnight-spill hint, and the audit-log generation
// via applySessionEdit.

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
import { Button, Input, Modal, Select, TextArea } from './ui';

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

  // Modal owns Escape; this handler covers Ctrl/Cmd+Enter to submit.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const form = document.querySelector<HTMLFormElement>('form[data-role="session-editor"]');
        form?.requestSubmit();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

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
    <Modal title={dialogTitle} onClose={onCancel}>
      <form data-role="session-editor" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wider text-fg-muted">
          {dialogTitle} <span className="text-fg-muted/60">— {originDateKey}</span>
        </h2>

        <Input label="Label" type="text" value={label} onChange={(e) => setLabel(e.target.value)} />

        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start"
            type="time"
            step="900"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Input
            label="End"
            type="time"
            step="900"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>

        <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        {typeof overnightHintEnd === 'number' && overnightHintEnd > 0 && (
          <p
            data-testid="overnight-hint"
            className="m-0 rounded-md bg-surface-2 px-3 py-2 text-xs text-fg-muted"
          >
            ↪ Ends {formatTime(overnightHintEnd)} the next day — saved as two linked Sessions.
          </p>
        )}

        {overlaps.length > 0 && (
          <p
            role="alert"
            data-testid="overlap-warning"
            className="m-0 rounded-md bg-warn/10 px-3 py-2 text-xs text-warn"
          >
            ⚠ Overlaps with {overlaps.map((o) => o.label).join(', ')}. You can still save.
          </p>
        )}

        {error && (
          <p role="alert" className="m-0 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
