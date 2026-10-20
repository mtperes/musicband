import { useState, useEffect } from 'react';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date | null;
  location?: string;
}

interface UseCalendarEventsResult {
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
}

const MAX_EVENTS = 5;

function getFeedUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_MOCK_CALENDAR === '1') {
    return '/mock-calendar.ics';
  }
  return '/api/calendar';
}

export function useCalendarEvents(): UseCalendarEventsResult {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      try {
        const response = await fetch(getFeedUrl(), {
          method: 'GET',
          headers: { Accept: 'text/calendar' },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const icsText = await response.text();
        const parsed = parseICS(icsText);

        const now = new Date();
        const upcoming = parsed
          .filter((event) => event.startDate.getTime() >= now.getTime())
          .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
          .slice(0, MAX_EVENTS);

        if (isMounted) {
          setEvents(upcoming);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error fetching calendar events:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    };

    fetchEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  return { events, isLoading, error };
}

function unfoldICS(icsText: string): string {
  return icsText
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .replace(/\r[ \t]/g, '');
}

function unescapeICS(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseICS(icsText: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const unfolded = unfoldICS(icsText);
  const lines = unfolded.split(/\r?\n/);

  type Raw = Partial<CalendarEvent> & { _dtstart?: string; _dtend?: string; _uid?: string };
  let current: Raw = {};
  let inVEVENT = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    if (line === 'BEGIN:VEVENT') {
      inVEVENT = true;
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (inVEVENT && current._dtstart) {
        const start = parseDateTime(current._dtstart);
        const end = current._dtend ? parseDateTime(current._dtend) : null;
        events.push({
          id: current._uid ?? `${start.toISOString()}-${current.title ?? ''}`,
          title: current.title ?? 'Sem título',
          description: current.description,
          startDate: start,
          endDate: end,
          location: current.location,
        });
      }
      inVEVENT = false;
      current = {};
      continue;
    }

    if (!inVEVENT) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const name = prop.split(';')[0].toUpperCase();

    switch (name) {
      case 'SUMMARY':
        current.title = unescapeICS(value);
        break;
      case 'DESCRIPTION':
        current.description = unescapeICS(value);
        break;
      case 'LOCATION':
        current.location = unescapeICS(value);
        break;
      case 'DTSTART':
        current._dtstart = value;
        break;
      case 'DTEND':
        current._dtend = value;
        break;
      case 'UID':
        current._uid = value;
        break;
    }
  }

  return events;
}

function parseDateTime(raw: string): Date {
  const value = raw.trim();

  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/;
  const dateTimeUtc = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;
  const dateTimeLocal = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/;

  let m = dateTimeUtc.exec(value);
  if (m) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  }

  m = dateTimeLocal.exec(value);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }

  m = dateOnly.exec(value);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
  }

  return new Date(value);
}
