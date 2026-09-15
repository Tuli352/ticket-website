import { useEffect, useState } from "react";
import { api } from "../utils/api.js";
import { Spinner, Button } from "../components/UI.jsx";
import { DigitalTicket } from "../components/Ticket.jsx";

export default function Result({ orderId, onStartOver }) {
  const [tickets, setTickets] = useState(null);

  useEffect(() => {
    let mounted = true;
    const id = setInterval(async () => {
      const t = await api.tickets(orderId);
      if (mounted && t.length) {
        setTickets(t);
        clearInterval(id);
      }
    }, 2000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [orderId]);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "3rem 1.5rem", textAlign: "center" }}>
      <div style={{ fontSize: "2.2rem" }}>✓</div>
      <h2 style={{ fontSize: "1.6rem", margin: "0.6rem 0" }}>Payment successful</h2>
      <p style={{ color: "var(--text-dim)", marginBottom: "2rem" }}>
        Your ticket(s) have also been emailed to you.
      </p>

      {!tickets ? (
        <Spinner />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {tickets.map((t) => (
            <DigitalTicket key={t.ticket_code} ticket={t} />
          ))}
        </div>
      )}

      <div style={{ marginTop: "2.5rem" }}>
        <Button variant="ghost" onClick={onStartOver}>Buy another ticket</Button>
      </div>
    </div>
  );
}
