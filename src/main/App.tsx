import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Session, addSession, listSessions } from '../shared/ipc';
import { addDays, dateKey, getMondayOf } from '../shared/time';
import { NewSessionModal } from './NewSessionModal';
import { WeekGrid } from './WeekGrid';

// Root component for the main window. Slice #3 ships the
// click → modal → save → block-appears → restart-survives loop:
//   - useEffect loads Sessions for the current week on mount.
//   - onSave invokes addSession, clears the modal, refreshes the
//     list so the new block renders in its cell.
// Multi-week navigation (← → keyboard shortcuts) arrives in slice
// #7 once the Now Panel + tick land.

interface Editing {
  dateKey: string;
  hour: number;
}

export function App() {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  // Memoize weekStart so it has stable identity across renders —
  // otherwise the useEffect deps array would re-fire each render.
  const weekStart = useMemo(() => getMondayOf(new Date()), []);

  const refresh = useCallback(async () => {
    const fresh = await listSessions({
      start: dateKey(weekStart),
      end: dateKey(addDays(weekStart, 6)),
    });
    setSessions(fresh);
  }, [weekStart]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <main>
      <WeekGrid
        weekStart={weekStart}
        sessions={sessions}
        onCellClick={(dKey, hour) => {
          setEditing({ dateKey: dKey, hour });
        }}
      />
      {editing && (
        <NewSessionModal
          defaultDateKey={editing.dateKey}
          defaultHour={editing.hour}
          onSave={async (input) => {
            await addSession(input);
            setEditing(null);
            await refresh();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </main>
  );
}
