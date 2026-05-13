// Issue #12 — first-launch onboarding modal.
//
// Asks the user whether to import their v4 `weekly_scheduler.html`
// data. "Skip" closes the modal without doing anything; "Import"
// opens the OS file picker, hands the picked path to Rust's
// `import_json_from_path`, and reports the row counts via a toast.
//
// The same modal is reused for the post-onboarding "Settings →
// Import" entry point. `onComplete` is the only side-channel; the
// caller decides what to do with the result (mark onboarded, refresh
// week, etc.).

import { open } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import { type ImportSummary, importJsonFromPath } from '../shared/ipc';
import { Button, Modal, useToast } from './ui';

export interface OnboardingCompleteResult {
  skipped: boolean;
  summary?: ImportSummary;
}

export interface OnboardingModalProps {
  /** Called when the user finishes the flow — either by clicking Skip
   *  or by successfully importing a file. Receives `{ skipped: true }`
   *  on Skip and `{ skipped: false, summary }` on successful import.
   *  Errors do NOT fire onComplete — the modal stays open so the user
   *  can retry. */
  onComplete: (result: OnboardingCompleteResult) => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const handleSkip = () => {
    onComplete({ skipped: true });
  };

  const handleImport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await open({
        title: 'Select your weekly_scheduler.html JSON export',
        multiple: false,
        directory: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      // `open` returns null when the user cancels the OS dialog. Don't
      // close the modal — they may want to re-attempt. With
      // `multiple: false` and `directory: false` the success case
      // narrows to `string`.
      if (picked === null || picked === undefined) {
        return;
      }
      const path = typeof picked === 'string' ? picked : String(picked);
      const summary = await importJsonFromPath(path);
      const offDayPart =
        summary.offDays > 0
          ? ` and ${summary.offDays} off-day${summary.offDays === 1 ? '' : 's'}`
          : '';
      toast.success(
        `Imported ${summary.sessions} session${summary.sessions === 1 ? '' : 's'}${offDayPart}`,
      );
      onComplete({ skipped: false, summary });
    } catch (err) {
      toast.error(`Couldn't import: ${(err as Error).message ?? 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Import from weekly_scheduler.html?"
      onClose={handleSkip}
      dismissOnBackdrop={false}
    >
      <div className="flex flex-col gap-4">
        <h2 className="m-0 text-lg font-semibold text-fg">
          Import from <code className="text-accent">weekly_scheduler.html</code>?
        </h2>
        <p className="m-0 text-sm leading-relaxed text-fg-muted">
          The previous version of Scheduler stored your sessions in your browser's local storage.
          Pick the JSON file you exported from <code>weekly_scheduler.html</code> and we'll pull
          every Session and Off-Day into the new database.
        </p>
        <p className="m-0 text-xs text-fg-muted">
          Importing the same file twice is safe — Sessions are deduplicated by id.
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={handleSkip} disabled={busy}>
            Skip
          </Button>
          <Button variant="primary" onClick={handleImport} disabled={busy}>
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
