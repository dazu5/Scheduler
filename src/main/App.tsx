import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type OvernightSpill,
  type Session,
  type SessionInput,
  type UpdateSessionInput,
  addSession,
  listSessions,
  updateSession,
} from '../shared/ipc';
import { addDays, dateKey, getMondayOf } from '../shared/time';
import { SessionEditor } from './SessionEditor';
import { WeekGrid } from './WeekGrid';

// Root component for the main window. Slice #4 routes between two
// flows from a single editor surface: clicking an empty grid cell
// opens SessionEditor in create mode; clicking a saved Session
// block opens it in edit mode pre-filled with that Session.

interface Editing {
  dateKey: string;
  hour: number;
  session: Session | null; // null → create flow
}

export function App() {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

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

  const daySessions = editing ? sessions.filter((s) => s.dateKey === editing.dateKey) : [];

  const handleCreate = async (input: SessionInput, _spill: OvernightSpill | null) => {
    // Create-flow overnight-split is deferred: slice #4 AC covers
    // the edit path explicitly. add_session will gain a spill arg
    // in a follow-up so create + edit are symmetric.
    await addSession(input);
    setEditing(null);
    await refresh();
  };

  const handleUpdate = async (id: string, input: UpdateSessionInput) => {
    await updateSession(id, input);
    setEditing(null);
    await refresh();
  };

  return (
    <main>
      <WeekGrid
        weekStart={weekStart}
        sessions={sessions}
        onCellClick={(dKey, hour) => {
          setEditing({ dateKey: dKey, hour, session: null });
        }}
        onSessionClick={(s) => {
          setEditing({
            dateKey: s.dateKey,
            hour: Math.floor(s.startMin / 60),
            session: s,
          });
        }}
      />
      {editing && (
        <SessionEditor
          editing={editing.session}
          defaultDateKey={editing.dateKey}
          defaultHour={editing.hour}
          daySessions={daySessions}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      )}
    </main>
  );
}
