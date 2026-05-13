// Behaviour tests for <OnboardingModal /> — the first-launch prompt
// that asks the user to import their v4 weekly_scheduler.html data.
//
// The modal owns the prompt copy + the two CTAs ("Skip" / "Import").
// "Import" opens the Tauri file picker (mocked here), reads the file
// (mocked), invokes the `importJson` IPC wrapper, then fires
// `onComplete`. "Skip" fires `onComplete` directly without invoking
// the importer.
//
// The file-read path uses `@tauri-apps/plugin-dialog`'s `open`
// command — we mock it because the test runs in happy-dom, not in a
// Tauri window. The same code path is exercised by the real picker
// when the app boots.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('../shared/ipc', () => ({
  importJsonFromPath: vi.fn(),
}));

import { open } from '@tauri-apps/plugin-dialog';
import { importJsonFromPath } from '../shared/ipc';
import { OnboardingModal } from './OnboardingModal';
import { ToastProvider } from './ui';

function renderModal(props: Partial<React.ComponentProps<typeof OnboardingModal>> = {}) {
  const defaults: React.ComponentProps<typeof OnboardingModal> = {
    onComplete: vi.fn(),
  };
  return render(
    <ToastProvider>
      <OnboardingModal {...defaults} {...props} />
    </ToastProvider>,
  );
}

describe('<OnboardingModal />', () => {
  beforeEach(() => {
    vi.mocked(open).mockReset();
    vi.mocked(importJsonFromPath).mockReset();
  });

  it('renders a dialog with the v4-import prompt copy', () => {
    renderModal();
    expect(
      screen.getByRole('dialog', { name: /import from weekly_scheduler\.html/i }),
    ).toBeInTheDocument();
    // Body copy mentions the predecessor by name at least once.
    expect(screen.getAllByText(/weekly_scheduler\.html/i).length).toBeGreaterThan(0);
  });

  it('renders Skip and Import buttons', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^import$/i })).toBeInTheDocument();
  });

  it('Skip fires onComplete without invoking importJsonFromPath', () => {
    const onComplete = vi.fn();
    renderModal({ onComplete });

    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ skipped: true });
    expect(importJsonFromPath).not.toHaveBeenCalled();
  });

  it('Import opens the file picker, hands the path to Rust, and fires onComplete with the summary', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/sched.json');
    vi.mocked(importJsonFromPath).mockResolvedValue({ sessions: 3, offDays: 1 });

    const onComplete = vi.fn();
    renderModal({ onComplete });

    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(open).toHaveBeenCalled());
    await waitFor(() => expect(importJsonFromPath).toHaveBeenCalledWith('/tmp/sched.json'));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());

    expect(onComplete).toHaveBeenCalledWith({
      skipped: false,
      summary: { sessions: 3, offDays: 1 },
    });
  });

  it('fires a success toast describing the row counts after a successful import', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/sched.json');
    vi.mocked(importJsonFromPath).mockResolvedValue({ sessions: 12, offDays: 2 });

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent(/imported 12 sessions/i);
    expect(toast).toHaveAttribute('data-variant', 'success');
  });

  it('cancelling the file picker leaves the modal open and does not fire onComplete', async () => {
    vi.mocked(open).mockResolvedValue(null); // user cancelled the OS dialog

    const onComplete = vi.fn();
    renderModal({ onComplete });

    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(importJsonFromPath).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('fires an error toast when the import throws', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/sched.json');
    vi.mocked(importJsonFromPath).mockRejectedValueOnce(
      new Error('invalid json: unexpected token'),
    );

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    const toast = await screen.findByRole('status');
    expect(toast).toHaveAttribute('data-variant', 'error');
    expect(toast).toHaveTextContent(/couldn['’]t import/i);
  });
});
