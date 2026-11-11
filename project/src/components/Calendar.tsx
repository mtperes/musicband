import React from "react";
import "../index.css";
import SectionTitle from "./sectionTitle";
import { TextFade } from "../effects/TextFade";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { useReducedMotion } from "framer-motion";
import videoSrc from "/w-bg.mp4";

const TIMEZONE = "Europe/Lisbon";

const Calendar: React.FC = () => {
  const { events, isLoading, error, retry } = useCalendarEvents();
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <section id="calendar" aria-labelledby="calendar-heading" className="px-3 sm:px-5 md:px-8">
      <SectionTitle titleText="Agenda" id="calendar-heading" />

      <article className="md:mt-40 lg:mx-70 mt-10 z-10 p-4 lg:p-10 relative bg-sky-500/20 rounded-4xl font-(family-name:--font1family) text-justify">
        <video
          className="video-bg"
          style={styles.bgVideo}
          src={videoSrc}
          autoPlay={!prefersReducedMotion}
          muted
          loop={!prefersReducedMotion}
          playsInline
          preload={prefersReducedMotion ? "none" : "metadata"}
          aria-hidden="true"
          tabIndex={-1}
        ></video>

        {isLoading ? (
          <TextFade direction="up">
            <p className="mb-10" role="status" aria-live="polite">Carregando agenda...</p>
          </TextFade>
        ) : error ? (
          <div className="mb-10" role="alert">
            <p className="mb-4">Não foi possível carregar a agenda.</p>
            <button className="min-h-11 rounded-xl border border-white/50 px-4 py-2 text-base" type="button" onClick={retry}>
              Tentar novamente
            </button>
          </div>
        ) : events.length === 0 ? (
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
                <div key={event.id} className="mb-6 border-b border-gray-300 pb-6 last:mb-0 sm:mb-8 sm:pb-8">
                  <h3 className="mb-3">{event.title}</h3>

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

                  {event.location && <p className="mb-3">Local: {event.location}</p>}

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
