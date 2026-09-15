import { useState } from "react";
import Home from "./pages/Home.jsx";
import Checkout from "./pages/Checkout.jsx";
import Result from "./pages/Result.jsx";

export default function App() {
  const [step, setStep] = useState("home"); // home | checkout | result
  const [tier, setTier] = useState(null);
  const [orderId, setOrderId] = useState(null);

  return (
    <div style={{ minHeight: "100vh" }}>
      {step === "home" && (
        <Home onProceed={(t) => { setTier(t); setStep("checkout"); }} />
      )}
      {step === "checkout" && (
        <Checkout
          tier={tier}
          onBack={() => setStep("home")}
          onPaid={(id) => { setOrderId(id); setStep("result"); }}
        />
      )}
      {step === "result" && (
        <Result orderId={orderId} onStartOver={() => setStep("home")} />
      )}
    </div>
  );
}
