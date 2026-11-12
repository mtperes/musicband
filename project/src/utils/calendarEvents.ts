import ICAL from 'ical.js';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date | null;
  location?: string;
}

export function parseUpcomingCalendarEvents(
  icsText: string,
  now = new Date(),
  limit = 5,
): CalendarEvent[] {
  const calendar = new ICAL.Component(ICAL.parse(icsText));
  if (calendar.name !== 'vcalendar') {
    throw new Error('Invalid calendar feed');
  }

  for (const component of calendar.getAllSubcomponents('vtimezone')) {
    ICAL.TimezoneService.register(new ICAL.Timezone(component));
  }

  const horizon = new Date(now);
  horizon.setFullYear(horizon.getFullYear() + 1);
  const events = new Map<string, CalendarEvent>();

  const addOccurrence = (event: ICAL.Event, start: ICAL.Time, end: ICAL.Time, recurrenceId: ICAL.Time) => {
    if (event.component.getFirstPropertyValue('status') === 'CANCELLED') return;
    const startDate = start.toJSDate();
    const endDate = end.toJSDate();
    if (endDate <= now || startDate > horizon) return;

    const id = `${event.uid}-${recurrenceId.toString()}`;
    events.set(id, {
      id,
      title: event.summary || 'Sem t\u00edtulo',
      description: event.description,
      startDate,
      endDate,
      location: event.location,
    });
  };

  for (const component of calendar.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(component);
    if (event.component.getFirstPropertyValue('status') === 'CANCELLED') continue;

    if (event.isRecurrenceException()) {
      addOccurrence(event, event.startDate, event.endDate, event.recurrenceId);
    } else if (!event.isRecurring()) {
      addOccurrence(event, event.startDate, event.endDate, event.startDate);
    } else {
      const iterator = event.iterator();
      for (let count = 0; count < 10000; count += 1) {
        const occurrence = iterator.next();
        if (!occurrence || occurrence.toJSDate() > horizon) break;
        const details = event.getOccurrenceDetails(occurrence);
        addOccurrence(details.item, details.startDate, details.endDate, occurrence);
      }
    }
  }

  return [...events.values()]
    .sort((first, second) => first.startDate.getTime() - second.startDate.getTime())
    .slice(0, limit);
}