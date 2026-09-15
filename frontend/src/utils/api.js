const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  getEvent: () => request("/event"),
  createOrder: (payload) => request("/orders", { method: "POST", body: JSON.stringify(payload) }),
  payMpesa: (payload) => request("/payments/mpesa", { method: "POST", body: JSON.stringify(payload) }),
  payCard: (payload) => request("/payments/card", { method: "POST", body: JSON.stringify(payload) }),
  payBank: (payload) => request("/payments/bank", { method: "POST", body: JSON.stringify(payload) }),
  orderStatus: (orderId) => request(`/payments/order/${orderId}/status`),
  tickets: (orderId) => request(`/tickets/${orderId}`),
};
