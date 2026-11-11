import { useState, useEffect } from 'react';
import { parseUpcomingCalendarEvents, type CalendarEvent } from '../utils/calendarEvents';

export type { CalendarEvent } from '../utils/calendarEvents';

interface UseCalendarEventsResult {
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

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
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(getFeedUrl(), {
          method: 'GET',
          headers: { Accept: 'text/calendar' },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const icsText = await response.text();
        const upcoming = parseUpcomingCalendarEvents(icsText);

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
  }, [retryCount]);

  return { events, isLoading, error, retry: () => setRetryCount((count) => count + 1) };
}
