import { WeekGrid } from './WeekGrid';

// Root component for the main window. Slice #2 (issue #2) renders
// only the WeekGrid; later slices add the Now Panel above and the
// Dashboard / Reports tabs alongside it.
export function App() {
  return (
    <main>
      <WeekGrid />
    </main>
  );
}
