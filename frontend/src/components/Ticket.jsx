import { Button } from "./UI.jsx";

export function TicketTierCard({ tier, selected, onSelect }) {
  const soldOut = tier.available <= 0;
  return (
    <button
      onClick={() => !soldOut && onSelect(tier.id)}
      disabled={soldOut}
      style={{
        textAlign: "left",
        background: selected ? "var(--plum)" : "var(--bg-raised)",
        border: `1px solid ${selected ? "var(--gold)" : "var(--line)"}`,
        borderRadius: 10,
        padding: "1.2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        opacity: soldOut ? 0.4 : 1,
      }}
    >
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>{tier.name}</div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
          {soldOut ? "Sold out" : `${tier.available} left`}
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: "var(--gold)" }}>
        KSh {Number(tier.price).toLocaleString()}
      </div>
    </button>
  );
}

export function QuantityStepper({ value, onChange, max = 8 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
      <Button variant="ghost" onClick={() => onChange(Math.max(1, value - 1))}>–</Button>
      <span style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", minWidth: 24, textAlign: "center" }}>
        {value}
      </span>
      <Button variant="ghost" onClick={() => onChange(Math.min(max, value + 1))}>+</Button>
    </div>
  );
}

export function OrderSummary({ tier, quantity }) {
  if (!tier) return null;
  const total = tier.price * quantity;
  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem", marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-dim)", fontSize: "0.9rem" }}>
        <span>{tier.name} × {quantity}</span>
        <span>KSh {total.toLocaleString()}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>
        <span>Total</span>
        <span style={{ color: "var(--gold)" }}>KSh {total.toLocaleString()}</span>
      </div>
    </div>
  );
}

export function DigitalTicket({ ticket }) {
  return (
    <div
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--gold)",
        borderRadius: 12,
        padding: "1.4rem",
        display: "flex",
        gap: "1rem",
        alignItems: "center",
      }}
    >
      <img src={ticket.qr_data} alt="Ticket QR code" width={90} height={90} style={{ borderRadius: 6 }} />
      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", letterSpacing: "0.04em" }}>Ne-Yo Live</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>{ticket.ticket_code}</div>
      </div>
    </div>
  );
}
