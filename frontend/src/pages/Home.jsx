import { useEffect, useState } from "react";
import { api } from "../utils/api.js";
import { Button, Countdown, Spinner } from "../components/UI.jsx";
import { TicketTierCard } from "../components/Ticket.jsx";

function Hero({ event }) {
  return (
    <section
      style={{
        position: "relative",
        borderRadius: "0 0 var(--radius-xl) var(--radius-xl)",
        overflow: "hidden",
        marginBottom: "1rem",
      }}
    >
      <style>{`
        @keyframes heroSlideInLeft {
          from { transform: translateX(-105%); }
          to   { transform: translateX(0); }
        }
        @keyframes heroSlideInRight {
          from { transform: translateX(105%); }
          to   { transform: translateX(0); }
        }
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-half-left {
          animation: heroSlideInLeft 1000ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .hero-half-right {
          animation: heroSlideInRight 1000ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .hero-copy > * {
          animation: heroFadeUp 700ms ease both;
        }
        .hero-copy > *:nth-child(1) { animation-delay: 750ms; }
        .hero-copy > *:nth-child(2) { animation-delay: 820ms; }
        .hero-copy > *:nth-child(3) { animation-delay: 890ms; }
        .hero-copy > *:nth-child(4) { animation-delay: 960ms; }
        @media (prefers-reduced-motion: reduce) {
          .hero-half-left, .hero-half-right { animation: none; }
          .hero-copy > * { animation: none; }
        }
      `}</style>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "clamp(320px, 52vw, 480px)",
          overflow: "hidden",
        }}
      >
        {/* Left half: shows the left 50% of the artwork, slides in from off-screen left */}
        <div
          className="hero-half-left"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "50%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <img
            src="/images/ne-yo-red.jpg"
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "200%",
              maxWidth: "none",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center center",
              display: "block",
            }}
          />
        </div>

        {/* Right half: shows the right 50% of the artwork, slides in from off-screen right */}
        <div
          className="hero-half-right"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "50%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <img
            src="/images/ne-yo-red.jpg"
            alt="Ne-Yo — R.E.D."
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "200%",
              maxWidth: "none",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center center",
              display: "block",
            }}
          />
        </div>
      </div>

      {/* Gradient scrim so text stays legible over the art */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, var(--bg) 4%, rgba(11,8,13,0.55) 42%, rgba(11,8,13,0.05) 70%)",
        }}
      />

      <div
        className="hero-copy"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "0 1.5rem 1.8rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "0.8rem", letterSpacing: "0.08em", color: "var(--gold-soft)" }}>
          Live in Nairobi
        </div>
        <h1 style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)", margin: "0.6rem 0" }}>
          {event?.event_name || "Ne-Yo Live"}
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: "1.05rem" }}>
          {event ? new Date(event.event_date).toLocaleString("en-KE", { dateStyle: "full", timeStyle: "short" }) : ""} · {event?.venue}
        </p>
        {event && (
          <div style={{ marginTop: "1.8rem", display: "flex", justifyContent: "center" }}>
            <Countdown target={new Date(event.sales_close_at).getTime()} />
          </div>
        )}
      </div>
    </section>
  );
}

export default function Home({ onProceed }) {
  const [event, setEvent] = useState(null);
  const [types, setTypes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getEvent().then(({ settings, ticketTypes }) => {
      setEvent(settings);
      setTypes(ticketTypes);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "6rem" }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Hero event={event} />

      <section style={{ padding: "0 1.5rem 2rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        <h2 style={{ fontSize: "1.1rem", color: "var(--text-dim)", fontWeight: 400, marginBottom: "0.4rem" }}>
          Choose your ticket
        </h2>
        {types.map((t) => (
          <TicketTierCard key={t.id} tier={t} selected={selected === t.id} onSelect={setSelected} />
        ))}
      </section>

      <section style={{ padding: "0 1.5rem 4rem", display: "flex", justifyContent: "center" }}>
        <Button
          disabled={!selected || event.status === "closed"}
          onClick={() => onProceed(types.find((t) => t.id === selected))}
        >
          {event.status === "closed" ? "Sales closed" : "Continue"}
        </Button>
      </section>

      <footer style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-dim)", fontSize: "0.8rem" }}>
        All sales final unless the event is cancelled or rescheduled. Contact support for order issues.
      </footer>
    </div>
  );
}