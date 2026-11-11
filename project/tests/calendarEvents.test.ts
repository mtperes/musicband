import assert from 'node:assert/strict';
import test from 'node:test';
import { parseUpcomingCalendarEvents } from '../src/utils/calendarEvents.ts';

const feed = (...events: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('\r\n')}\r\nEND:VCALENDAR`;
const event = (properties: string) => `BEGIN:VEVENT\r\n${properties.trim().replace(/\n/g, '\r\n')}\r\nEND:VEVENT`;

test('expands old weekly series into the next five unique occurrences', () => {
  const events = parseUpcomingCalendarEvents(feed(event(`
UID:weekly
SUMMARY:Rehearsal
DTSTART:20250101T193000Z
DTEND:20250101T220000Z
RRULE:FREQ=WEEKLY;BYDAY=WE
`)), new Date('2026-11-11T12:00:00Z'));
  assert.equal(events.length, 5);
  assert.equal(events[0].startDate.toISOString(), '2026-11-11T19:30:00.000Z');
  assert.equal(events[4].startDate.toISOString(), '2026-12-09T19:30:00.000Z');
  assert.equal(new Set(events.map((item) => item.id)).size, 5);
});

test('honors excluded dates, moved occurrences and cancellations without duplicates', () => {
  const events = parseUpcomingCalendarEvents(feed(
    event(`
UID:weekly
SUMMARY:Rehearsal
DTSTART:20261104T193000Z
DTEND:20261104T220000Z
RRULE:FREQ=WEEKLY;COUNT=5
EXDATE:20261111T193000Z
`), event(`
UID:weekly
RECURRENCE-ID:20261118T193000Z
SUMMARY:Moved rehearsal
DTSTART:20261119T200000Z
DTEND:20261119T220000Z
`), event(`
UID:weekly
RECURRENCE-ID:20261125T193000Z
STATUS:CANCELLED
DTSTART:20261125T193000Z
DTEND:20261125T220000Z
`)), new Date('2026-11-11T12:00:00Z'));
  assert.deepEqual(events.map((item) => item.startDate.toISOString()), [
    '2026-11-19T20:00:00.000Z',
    '2026-12-02T19:30:00.000Z',
  ]);
  assert.equal(events[0].title, 'Moved rehearsal');
});

test('keeps ongoing all-day events and excludes ended or cancelled events', () => {
  const events = parseUpcomingCalendarEvents(feed(event(`
UID:all-day
SUMMARY:Festival
DTSTART;VALUE=DATE:20261111
DTEND;VALUE=DATE:20261112
`), event(`
UID:ended
DTSTART:20261110T120000Z
DTEND:20261110T130000Z
`), event(`
UID:cancelled
STATUS:CANCELLED
DTSTART:20261112T120000Z
DTEND:20261112T130000Z
`)), new Date('2026-11-11T12:00:00Z'));
  assert.deepEqual(events.map((item) => item.title), ['Festival']);
});

test('rejects HTML returned instead of an ICS feed', () => {
  assert.throws(() => parseUpcomingCalendarEvents('<html>Not found</html>'));
});

test('uses Lisbon timezone transitions rather than the browser timezone', () => {
  const timezone = `BEGIN:VTIMEZONE
TZID:Europe/Lisbon
BEGIN:DAYLIGHT
DTSTART:19700329T010000
TZOFFSETFROM:+0000
TZOFFSETTO:+0100
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
DTSTART:19701025T020000
TZOFFSETFROM:+0100
TZOFFSETTO:+0000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`.replace(/\n/g, '\r\n');
  const events = parseUpcomingCalendarEvents(feed(timezone, event(`
UID:lisbon
DTSTART;TZID=Europe/Lisbon:20261021T193000
DTEND;TZID=Europe/Lisbon:20261021T220000
RRULE:FREQ=WEEKLY;COUNT=2
`)), new Date('2026-10-21T12:00:00Z'));
  assert.deepEqual(events.map((item) => item.startDate.toISOString()), [
    '2026-10-21T18:30:00.000Z',
    '2026-10-28T19:30:00.000Z',
  ]);
});

test('includes additional RDATE occurrences and preserves duration', () => {
  const events = parseUpcomingCalendarEvents(feed(event(`
UID:extra
SUMMARY:Extra rehearsal
DTSTART:20261101T193000Z
DURATION:PT2H
RDATE:20261112T193000Z,20261114T193000Z
`)), new Date('2026-11-11T12:00:00Z'));
  assert.equal(events.length, 2);
  assert.equal(events[0].endDate?.toISOString(), '2026-11-12T21:30:00.000Z');
});