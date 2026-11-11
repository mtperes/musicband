import React, { useLayoutEffect, useRef, useState } from "react";
import "../index.css";
import SectionTitle from "./sectionTitle";
import { TextFade } from "../effects/TextFade";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { useReducedMotion } from "framer-motion";
import videoSrc from "/w-bg.mp4";
import type { CalendarEvent } from "../utils/calendarEvents";

const TIMEZONE = "Europe/Lisbon";

const fmt = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleString("pt-BR", { ...options, timeZone: TIMEZONE });

const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

const EventItem: React.FC<{ event: CalendarEvent }> = ({ event }) => {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = descRef.current;
    if (el && !expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [event.description, expanded]);

  const { startDate, endDate } = event;
  const sameDay = !!endDate && fmt(startDate, { dateStyle: "short" }) === fmt(endDate, { dateStyle: "short" });
  const endText = endDate
    ? sameDay
      ? fmt(endDate, timeOpts)
      : fmt(endDate, { day: "2-digit", month: "short", ...timeOpts })
    : null;
  const descId = `event-desc-${event.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div className="grid grid-cols-1 gap-4 border-b border-gray-300 py-6 last:border-b-0 sm:py-8 md:grid-cols-[8rem_1fr_13rem] md:gap-8">
      <div className="order-1 flex items-baseline gap-2 md:order-none md:block">
        <p className="text-base capitalize">{fmt(startDate, { weekday: "long" })}</p>
        <p className="text-3xl leading-tight capitalize">{fmt(startDate, { month: "short" })}</p>
        <p className="text-3xl leading-tight">{fmt(startDate, { day: "numeric" })}</p>
      </div>

      <div className="order-3 min-w-0 border-b border-gray-300 pb-4 md:order-none">
        <h3 className="mb-3">{event.title}</h3>
        {event.description && (
          <>
            <div
              id={descId}
              ref={descRef}
              className="calendar-description"
              style={expanded ? undefined : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              dangerouslySetInnerHTML={{ __html: event.description }}
            />
            {(overflows || expanded) && (
              <button
                type="button"
                className="mt-3 min-h-11 text-[17px] underline-offset-4 hover:underline"
                aria-expanded={expanded}
                aria-controls={descId}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "− Mostrar menos" : "+ Ler mais"}
              </button>
            )}
          </>
        )}
      </div>

      <div className="order-2 md:order-none md:text-right">
        <p className="mb-3 text-xl">
          {fmt(startDate, timeOpts)}
          {endText && ` - ${endText}`}
        </p>
        {event.location && <p>{event.location}</p>}
      </div>
    </div>
  );
};

const Calendar: React.FC = () => {
  const { events, isLoading, error, retry } = useCalendarEvents();
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <section id="calendar" aria-labelledby="calendar-heading" className="flex min-h-dvh flex-col px-3 sm:px-5 md:px-8">
      <SectionTitle titleText="Agenda" id="calendar-heading" />

      <article className="mx-auto mt-10 w-full max-w-screen-2xl flex-1 z-10 p-4 lg:p-10 relative bg-sky-500/20 rounded-4xl font-(family-name:--font1family) text-justify">
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
            {events.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
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
