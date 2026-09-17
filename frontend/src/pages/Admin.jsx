import { useEffect, useState } from "react";
import { api } from "../utils/api.js";
import { Button, Spinner, Toast } from "../components/UI.jsx";

function Login({ onLoggedIn }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await api.adminLogin(form);
      sessionStorage.setItem("neyo_admin_token", token);
      onLoggedIn(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "6rem auto", padding: "0 1.5rem" }}>
      <h2 style={{ marginBottom: "1.5rem" }}>Admin sign in</h2>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        <input
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
        />
        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        {error && <Toast tone="error" message={error} />}
        <Button type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
      </form>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: "var(--bg-raised)", border: "1px solid var(--line)", borderRadius: 10, padding: "1.1rem" }}>
      <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", marginTop: "0.3rem" }}>{value}</div>
    </div>
  );
}

function Overview({ token }) {
  const [summary, setSummary] = useState(null);
  const [closing, setClosing] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { api.adminSummary(token).then(setSummary); }, [token]);

  async function closeSales() {
    if (!confirm("Close sales now? Orders and payment history are kept — this only stops new purchases.")) return;
    setClosing(true);
    await api.adminCloseSales(token);
    setMsg("Sales closed. Existing orders and records are untouched.");
    api.adminSummary(token).then(setSummary);
    setClosing(false);
  }

  if (!summary) return <Spinner />;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.8rem", marginBottom: "1.2rem" }}>
        <StatCard label="Revenue" value={`KSh ${Number(summary.revenue).toLocaleString()}`} />
        <StatCard label="Tickets sold" value={summary.ticketsSold} />
        <StatCard label="Pending M-Pesa" value={summary.pendingMpesa} />
        <StatCard label="Pending bank" value={summary.pendingBank} />
        <StatCard label="Sales status" value={summary.salesStatus} />
      </div>
      {msg && <Toast tone="success" message={msg} />}
      <div style={{ marginTop: "1rem" }}>
        <Button variant="danger" onClick={closeSales} disabled={closing || summary.salesStatus === "closed"}>
          {summary.salesStatus === "closed" ? "Sales already closed" : "Close sales now"}
        </Button>
      </div>
    </div>
  );
}

function DataTable({ rows, columns }) {
  if (!rows) return <Spinner />;
  if (!rows.length) return <p style={{ color: "var(--text-dim)" }}>Nothing here yet.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: "left", padding: "0.6rem", borderBottom: "1px solid var(--line)", color: "var(--text-dim)" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: "0.6rem", borderBottom: "1px solid var(--line)" }}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Orders({ token }) {
  const [orders, setOrders] = useState(null);
  useEffect(() => { api.adminOrders(token).then(setOrders); }, [token]);
  return (
    <DataTable
      rows={orders}
      columns={[
        { key: "customer_name", label: "Customer" },
        { key: "customer_phone", label: "Phone" },
        { key: "ticket_type_name", label: "Tier" },
        { key: "quantity", label: "Qty" },
        { key: "total_amount", label: "Amount", render: (r) => `KSh ${Number(r.total_amount).toLocaleString()}` },
        { key: "status", label: "Status" },
        { key: "created_at", label: "Created", render: (r) => new Date(r.created_at).toLocaleString() },
      ]}
    />
  );
}

function Payments({ token }) {
  const [payments, setPayments] = useState(null);
  useEffect(() => { api.adminPayments(token).then(setPayments); }, [token]);
  return (
    <DataTable
      rows={payments}
      columns={[
        { key: "customer_name", label: "Customer" },
        { key: "method", label: "Method" },
        { key: "amount", label: "Amount", render: (r) => `KSh ${Number(r.amount).toLocaleString()}` },
        { key: "status", label: "Status" },
        { key: "provider_reference", label: "Reference" },
        { key: "created_at", label: "Created", render: (r) => new Date(r.created_at).toLocaleString() },
      ]}
    />
  );
}

function Tickets({ token }) {
  const [tickets, setTickets] = useState(null);
  useEffect(() => { api.adminTickets(token).then(setTickets); }, [token]);
  return (
    <DataTable
      rows={tickets}
      columns={[
        { key: "ticket_code", label: "Code" },
        { key: "customer_name", label: "Customer" },
        { key: "customer_email", label: "Email" },
        { key: "checked_in", label: "Checked in", render: (r) => (r.checked_in ? "Yes" : "No") },
        { key: "issued_at", label: "Issued", render: (r) => new Date(r.issued_at).toLocaleString() },
      ]}
    />
  );
}

const TABS = { overview: Overview, orders: Orders, tickets: Tickets, payments: Payments };

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem("neyo_admin_token"));
  const [tab, setTab] = useState("overview");

  if (!token) return <Login onLoggedIn={setToken} />;

  const TabComponent = TABS[tab];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2>Ne-Yo Admin</h2>
        <button
          onClick={() => { sessionStorage.removeItem("neyo_admin_token"); setToken(null); }}
          style={{ background: "none", color: "var(--text-dim)", fontSize: "0.85rem" }}
        >
          Sign out
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--line)" }}>
        {Object.keys(TABS).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              background: "none",
              padding: "0.7rem 1rem",
              color: tab === key ? "var(--gold)" : "var(--text-dim)",
              borderBottom: tab === key ? "2px solid var(--gold)" : "2px solid transparent",
              textTransform: "capitalize",
            }}
          >
            {key}
          </button>
        ))}
      </div>

      <TabComponent token={token} />
    </div>
  );
}
