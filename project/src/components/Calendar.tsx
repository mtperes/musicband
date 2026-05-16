import React from 'react';
import SectionTitle from './sectionTitle';
import { useCalendarEvents } from '../hooks/useCalendarEvents';

const Calendar: React.FC = () => {
  const { events } = useCalendarEvents();

  return (
    <>
      {events.length > 0 && (
        <>
          <SectionTitle titleText="Agenda" />
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="border-b pb-3 last:border-b-0">
                  <h3 className="font-semibold text-gray-800">{event.title}</h3>
                  
                  {event.startDate && (
                    <p className="text-sm text-gray-600">
                      {event.startDate.toLocaleString('pt-BR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                  
                  {event.endDate && (
                    <p className="text-sm text-gray-600">
                      até {event.endDate.toLocaleString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                  
                  {event.location && (
                    <p className="text-sm text-gray-500">📍 {event.location}</p>
                  )}
                  
                  {event.description && (
                    <p className="text-sm text-gray-500 mt-1">{event.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Calendar;