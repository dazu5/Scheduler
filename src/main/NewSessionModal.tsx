// New Session modal — the form a user sees after clicking an empty
// grid cell. Slice #3 chunk C ships a working form with Save / Cancel;
// Esc / Ctrl+Enter keyboard shortcuts, live overlap warning, and
// "(next day)" hint for overnight ranges arrive in slice #4 (issue
// #4) where the editor surfaces are unified.
//
// State is fully local: the caller mounts/unmounts this component to
// open/close it; on each fresh mount, defaults are derived from
// defaultDateKey + defaultHour.

import { useState } from 'react';
import type { SessionInput } from '../shared/ipc';
import { mmToInput, readEditTimes } from '../shared/time';

// Matches CATEGORY_INFO in weekly_scheduler.html / CONTEXT.md.
// Promoted to a shared module when more callers need it (slice #4+).
const CATEGORIES = ['animation', 'workflow', 'cornerman', 'break'] as const;
type Category = (typeof CATEGORIES)[number];

export interface NewSessionModalProps {
  /** dateKey for the day the user clicked. */
  defaultDateKey: string;
  /** Hour (24-hour, 0–23) the user clicked. */
  defaultHour: number;
  /** Called when the user submits a valid form. */
  onSave: (input: SessionInput) => void | Promise<void>;
  /** Called when the user dismisses the modal. */
  onCancel: () => void;
}

export function NewSessionModal({
  defaultDateKey,
  defaultHour,
  onSave,
  onCancel,
}: NewSessionModalProps) {
  const [category, setCategory] = useState<Category>('animation');
  const [label, setLabel] = useState('');
  const [start, setStart] = useState(() => mmToInput(defaultHour * 60));
  const [end, setEnd] = useState(() => mmToInput((defaultHour + 1) * 60));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = readEditTimes(start, end);
    if (!parsed) {
      setError('Please enter valid start and end times.');
      return;
    }
    if (parsed.zeroLength) {
      setError('End time must be after start time.');
      return;
    }

    onSave({
      dateKey: defaultDateKey,
      category,
      label: label.trim() || category,
      startMin: parsed.startMin,
      endMin: parsed.endMin,
      notes: null,
    });
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: native <dialog> needs .showModal() which happy-dom partial-mocks; div + role keeps tests portable, revisit in slice #4
    <div role="dialog" aria-label="New Session">
      <form onSubmit={handleSubmit}>
        <h2>New Session — {defaultDateKey}</h2>

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
