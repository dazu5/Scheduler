// Issue #7 — Off-Days modal.
//
// Confirms marking a single Day as off with an optional reason.
// Reuses the chunk 2 <Modal> primitive so Escape + focus trap +
// backdrop-click + fade-in all come for free.

import { useState } from 'react';
import { Button, Input, Modal } from './ui';

export interface DayOffModalProps {
  /** dateKey being toggled. Shown in the dialog title. */
  dateKey: string;
  /** Pre-filled reason when editing an existing off-Day. */
  initialReason?: string;
  /** Already off — show an "Unmark" affordance instead of "Mark". */
  alreadyOff?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
  onUnmark?: () => void | Promise<void>;
  onCancel: () => void;
}

export function DayOffModal({
  dateKey,
  initialReason = '',
  alreadyOff = false,
  onConfirm,
  onUnmark,
  onCancel,
}: DayOffModalProps) {
  const [reason, setReason] = useState(initialReason);
  const title = alreadyOff ? 'Off-Day reason' : 'Mark Day off';
  return (
    <Modal title={title} onClose={onCancel}>
      <form
        data-role="day-off-modal"
        onSubmit={(e) => {
          e.preventDefault();
          void onConfirm(reason.trim() || 'Off');
        }}
        className="flex flex-col gap-3"
      >
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wider text-fg-muted">
          {title} <span className="text-fg-muted/60">— {dateKey}</span>
        </h2>

        <Input
          label="Reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint="Shown on hover over the off-Day card."
        />

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          {alreadyOff && onUnmark && (
            <Button type="button" variant="danger" onClick={() => void onUnmark()}>
              Unmark
            </Button>
          )}
          <Button type="submit" variant="primary">
            {alreadyOff ? 'Update' : 'Mark off'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
