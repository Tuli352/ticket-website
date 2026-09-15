import axios from "axios";
import dayjs from "dayjs";

const {
  DARAJA_BASE_URL = "https://sandbox.safaricom.co.ke",
  DARAJA_CONSUMER_KEY,
  DARAJA_CONSUMER_SECRET,
  DARAJA_SHORTCODE,
  DARAJA_PASSKEY,
  DARAJA_CALLBACK_URL,
} = process.env;

export async function getAccessToken() {
  const auth = Buffer.from(
    `${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`
  ).toString("base64");

  const { data } = await axios.get(
    `${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return data.access_token;
}

function timestamp() {
  return dayjs().format("YYYYMMDDHHmmss");
}

function password(ts) {
  return Buffer.from(`${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${ts}`).toString(
    "base64"
  );
}

// phone must be in 2547XXXXXXXX format
export async function stkPush({ phone, amount, orderId }) {
  const token = await getAccessToken();
  const ts = timestamp();

  const { data } = await axios.post(
    `${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: DARAJA_SHORTCODE,
      Password: password(ts),
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: DARAJA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: DARAJA_CALLBACK_URL,
      AccountReference: orderId,
      TransactionDesc: "Ne-Yo Ticket Purchase",
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  // data.CheckoutRequestID is used to correlate the async callback
  return data;
}

// Parses Safaricom's callback body into a normalized result.
// Safaricom may retry callbacks — handle idempotently at the call site
// by checking payment.status before updating.
export function parseCallback(body) {
  const stk = body?.Body?.stkCallback;
  if (!stk) return null;

  const base = {
    checkoutRequestId: stk.CheckoutRequestID,
    resultCode: stk.ResultCode,
    resultDesc: stk.ResultDesc,
  };

  if (stk.ResultCode !== 0) {
    return { ...base, success: false };
  }

  const items = Object.fromEntries(
    (stk.CallbackMetadata?.Item || []).map((i) => [i.Name, i.Value])
  );

  return {
    ...base,
    success: true,
    amount: items.Amount,
    mpesaReceiptNumber: items.MpesaReceiptNumber,
    phoneNumber: items.PhoneNumber,
    transactionDate: items.TransactionDate,
  };
}
