// The week-grid surface. Slice #2 (issue #2) ships the structural
// skeleton — weekday column headers + hour-label rows — onto which
// later slices hang Session blocks (slice #4 add/delete), live tick
// highlight (#7), and the editor modal (#3).
//
// Markup is a real <table> so columnheader / rowheader / cell roles
// come from native HTML semantics — no manual ARIA. Visual layout
// (Tailwind grid alignment, day-cells per hour-row) is the wiring
// phase's job; it isn't what the tests assert.

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

// Matches the predecessor weekly_scheduler.html's gridStartH=8 /
// gridEndH=20 — twelve hour-rows, each spanning one hour starting at
// its label. The 8 AM–8 PM window stays user-configurable in a later
// slice (Settings panel, slice #10+).
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] as const;

function hourLabel(hour24: number): string {
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const h12 = hour24 % 12 || 12;
  return `${h12} ${ampm}`;
}

export function WeekGrid() {
  return (
    <table>
      <thead>
        <tr>
          {WEEKDAYS.map((day) => (
            <th key={day} scope="col">
              {day}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {HOURS.map((h) => (
          <tr key={h}>
            <th scope="row">{hourLabel(h)}</th>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
