import { useState } from "react";
import { api } from "../utils/api.js";
import { Button, Toast, Spinner } from "../components/UI.jsx";
import { QuantityStepper, OrderSummary } from "../components/Ticket.jsx";

export default function Checkout({ tier, onPaid, onBack }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState("mpesa");
  const [order, setOrder] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | processing | pending | failed
  const [error, setError] = useState("");

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setStatus("processing");
    try {
      const created = await api.createOrder({
        name: form.name,
        phone: form.phone,
        email: form.email,
        ticketTypeId: tier.id,
        quantity,
      });
      setOrder(created);

      if (method === "mpesa") {
        await api.payMpesa({ orderId: created.orderId, phone: form.phone });
        setStatus("pending");
        poll(created.orderId);
      } else if (method === "bank") {
        const details = await api.payBank({ orderId: created.orderId });
        setBankDetails(details);
        setStatus("idle");
      } else {
        await api.payCard({ orderId: created.orderId });
        setStatus("pending");
        // In production: redirect to the processor's hosted checkout here.
      }
    } catch (err) {
      setError(err.message);
      setStatus("failed");
    }
  }

  function poll(orderId) {
    const id = setInterval(async () => {
      const { status: s } = await api.orderStatus(orderId);
      if (s === "paid") {
        clearInterval(id);
        onPaid(orderId);
      } else if (s === "failed" || s === "expired") {
        clearInterval(id);
        setStatus("failed");
        setError("Payment did not go through. You can try again.");
      }
    }, 3000);
  }

  if (status === "pending") {
    return (
      <div style={{ maxWidth: 420, margin: "5rem auto", textAlign: "center", padding: "0 1.5rem" }}>
        <Spinner />
        <p style={{ marginTop: "1rem" }}>Waiting for payment confirmation…</p>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
          Check your phone for the M-Pesa PIN prompt.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <button onClick={onBack} style={{ background: "none", color: "var(--text-dim)", marginBottom: "1rem" }}>
        ← Back
      </button>
      <h2 style={{ fontSize: "1.6rem", marginBottom: "1.5rem" }}>Checkout</h2>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <input placeholder="Full name" required value={form.name} onChange={update("name")} />
        <input placeholder="Phone (2547XXXXXXXX)" required value={form.phone} onChange={update("phone")} />
        <input placeholder="Email" type="email" required value={form.email} onChange={update("email")} />

        <div style={{ marginTop: "0.5rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>Quantity</div>
          <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, tier.available)} />
        </div>

        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
          {[
            ["mpesa", "M-Pesa"],
            ["card", "Card"],
            ["bank", "Bank"],
          ].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setMethod(val)}
              style={{
                flex: 1,
                padding: "0.7rem",
                borderRadius: 8,
                border: `1px solid ${method === val ? "var(--gold)" : "var(--line)"}`,
                background: method === val ? "var(--plum)" : "var(--bg-raised)",
                color: "var(--text)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <OrderSummary tier={tier} quantity={quantity} />

        {bankDetails && (
          <Toast
            tone="info"
            message={`Pay KSh ${bankDetails.amount} to ${bankDetails.bankName} A/C ${bankDetails.accountNumber} (${bankDetails.accountName}). Use reference ${bankDetails.reference}. We'll confirm once it reflects.`}
          />
        )}
        {error && <Toast tone="error" message={error} />}

        <Button type="submit" disabled={status === "processing"}>
          {status === "processing" ? "Processing…" : `Pay with ${method === "mpesa" ? "M-Pesa" : method === "card" ? "Card" : "Bank Transfer"}`}
        </Button>
      </form>
    </div>
  );
}
