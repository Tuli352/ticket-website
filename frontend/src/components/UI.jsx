import { useEffect, useState } from "react";

export function Button({ children, variant = "primary", ...props }) {
  const styles = {
    primary: { background: "var(--gold)", color: "#1A1220" },
    ghost: { background: "transparent", color: "var(--text)", border: "1px solid var(--line)" },
    danger: { background: "var(--danger)", color: "#fff" },
  };
  return (
    <button
      {...props}
      style={{
        padding: "0.85rem 1.6rem",
        borderRadius: "999px",
        fontSize: "0.95rem",
        fontWeight: 600,
        letterSpacing: "0.01em",
        transition: "transform 0.15s ease, opacity 0.15s ease",
        opacity: props.disabled ? 0.5 : 1,
        ...styles[variant],
        ...props.style,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}

// Countdown to a target Date. Purely presentational — the backend
// enforces the actual close, this just shows the person where things stand.
export function Countdown({ target }) {
  const [remaining, setRemaining] = useState(target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining <= 0) {
    return <span style={{ color: "var(--danger)", fontWeight: 600 }}>Sales closed</span>;
  }

  const h = Math.floor(remaining / 3.6e6);
  const m = Math.floor((remaining % 3.6e6) / 6e4);
  const s = Math.floor((remaining % 6e4) / 1000);
  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div style={{ display: "flex", gap: "0.6rem", alignItems: "baseline" }}>
      {[["h", h], ["m", m], ["s", s]].map(([label, val]) => (
        <div key={label} style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem" }}>{pad(val)}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

export function Spinner() {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        border: "3px solid var(--line)",
        borderTopColor: "var(--gold)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function Toast({ message, tone = "info" }) {
  if (!message) return null;
  const colors = { info: "var(--gold)", error: "var(--danger)", success: "var(--success)" };
  return (
    <div
      style={{
        background: "var(--bg-raised)",
        borderLeft: `3px solid ${colors[tone]}`,
        padding: "0.8rem 1rem",
        borderRadius: 6,
        fontSize: "0.9rem",
      }}
    >
      {message}
    </div>
  );
}
