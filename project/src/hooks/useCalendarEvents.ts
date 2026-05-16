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

const CALENDAR_ID = '1aa1550534d11c7cdfa85fbcbf1b0852806cdac52efb8e540d22ffdfbb3d6ea5@group.calendar.google.com';
const CALENDAR_FEED = `/calendar/ical/${CALENDAR_ID}/public/basic.ics`;

export function useCalendarEvents(): UseCalendarEventsResult {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      try {
        const response = await fetch(CALENDAR_FEED);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const icsText = await response.text();
        const parsedEvents = parseICS(icsText);
        
        if (isMounted) {
          setEvents(parsedEvents);
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

function parseICS(icsText: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let currentEvent: Partial<CalendarEvent> & { _dtstart?: string; _dtend?: string; _uid?: string } = {};
  let inVEVENT = false;

  const lines = icsText.split('\n');

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inVEVENT = true;
      currentEvent = {
        title: '',
        description: '',
        startDate: new Date(),
        endDate: null,
      };
    } else if (line === 'END:VEVENT') {
      if (inVEVENT && currentEvent.title) {
        const start = parseDateTime(currentEvent._dtstart as string);
        const end = currentEvent._dtend ? parseDateTime(currentEvent._dtend as string) : null;

        events.push({
          id: currentEvent._uid as string || '',
          title: currentEvent.title || 'Sem título',
          description: currentEvent.description,
          startDate: start,
          endDate: end,
          location: currentEvent.location,
        });
      }
      inVEVENT = false;
      currentEvent = {};
    } else if (inVEVENT) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':');

      switch (key) {
        case 'SUMMARY':
          currentEvent.title = decodeURIComponent(value);
          break;
        case 'DESCRIPTION':
          currentEvent.description = decodeURIComponent(value);
          break;
        case 'DTSTART':
          currentEvent._dtstart = value;
          break;
        case 'DTEND':
          currentEvent._dtend = value;
          break;
        case 'UID':
          currentEvent._uid = value;
          break;
        case 'LOCATION':
          currentEvent.location = decodeURIComponent(value);
          break;
      }
    }
  }

  return events;
}

function parseDateTime(dateString: string): Date {
  const dt = dateString.replace('T', ' ').replace('Z', '');
  
  let [datePart, timePart] = dt.split(' ');
  
  if (!timePart) {
    const date = new Date(datePart);
    return date;
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  const date = new Date(year, month - 1, day, hour, minute);
  
  const now = new Date();
  if (date > now) {
    return date;
  } else {
    const futureDate = new Date(year, month - 1, day, hour, minute);
    futureDate.setFullYear(now.getFullYear());
    return futureDate;
  }
}
