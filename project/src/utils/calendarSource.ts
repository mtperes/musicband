export const defaultCalendarUrl = 'https://calendar.google.com/calendar/ical/1aa1550534d11c7cdfa85fbcbf1b0852806cdac52efb8e540d22ffdfbb3d6ea5%40group.calendar.google.com/public/basic.ics';

export function publicCalendarUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'calendar.google.com' || url.port || url.username || url.password || url.search || url.hash || !/^\/calendar\/ical\/[^/]+\/public\/basic\.ics$/.test(url.pathname)) {
    throw new Error('Use o endereço público em formato iCal do Google Calendar, terminado em /public/basic.ics.');
  }
  return url.href;
}