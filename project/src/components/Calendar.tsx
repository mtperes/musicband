import React, { useRef } from "react";
import "../index.css";
import SectionTitle from "./sectionTitle";
import { TextFade } from "../effects/TextFade";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import videoSrc from "/public/w-bg.mp4";

const TIMEZONE = "Europe/Lisbon";

const Calendar: React.FC = () => {
  const { events, isLoading, error } = useCalendarEvents();
  const vidRef = useRef<HTMLVideoElement | null>(null);
  if (vidRef.current) {
    vidRef.current.playbackRate = 1;
  }

  if (isLoading || error) {
    return <section id="calendar" />;
  }

  return (
    <section id="calendar">
      <SectionTitle titleText="Agenda" />

      <article className="md:mt-40 lg:mx-70 mt-10 z-10 p-4 lg:p-10 relative bg-sky-500/20 rounded-4xl font-(family-name:--font1family) text-justify">
        <video
          className="video-bg"
          style={styles.bgVideo}
          id="bgVideo"
          ref={vidRef}
          src={videoSrc}
          autoPlay
          muted
          loop
        ></video>

        {events.length === 0 ? (
          <TextFade direction="up">
            <p className="mb-10">Nenhum evento agendado.</p>
          </TextFade>
        ) : (
          <TextFade direction="up">
            {events.map((event) => {
              const sameDay =
                event.endDate &&
                event.startDate.toDateString() === event.endDate.toDateString();

              return (
                <div key={event.id} className="mb-10  last:mb-0 border-b border-gray-300 pb-10">
                  <h2 className="mb-3">{event.title}</h2>

                  <p className="mb-3">
                    {event.startDate.toLocaleString("pt-BR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: TIMEZONE,
                    })}
                  </p>

                  {event.endDate && !sameDay && (
                    <p className="mb-3">
                      até{" "}
                      {event.endDate.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: TIMEZONE,
                      })}
                    </p>
                  )}

                  {event.endDate && sameDay && (
                    <p className="mb-3">
                      até{" "}
                      {event.endDate.toLocaleString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: TIMEZONE,
                      })}
                    </p>
                  )}

                  {event.location && <p className="mb-3">📍 {event.location}</p>}

                  {event.description && (
                    <div
                      className="calendar-description"
                      dangerouslySetInnerHTML={{ __html: event.description }}
                    />
                  )}
                </div>
              );
            })}
          </TextFade>
        )}
      </article>
    </section>
  );
};

const styles = {
  bgVideo: {
    position: "absolute" as const,
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    zIndex: -1,
    borderRadius: "30px",
    opacity: 0.6,
  },
};

export default Calendar;
