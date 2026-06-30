import type {
  CreatedPaymentRequest,
  PaymentRequestActivityItem,
  PaymentReceipt,
  SignedPaymentRequest,
  VerifiedPaymentRequest,
} from "@/utils/types";

export async function createTrackedPaymentRequest(
  request: SignedPaymentRequest,
  recipientEmail?: string,
): Promise<CreatedPaymentRequest> {
  return fetchJson<CreatedPaymentRequest>("/api/payment-requests", {
    method: "POST",
    body: JSON.stringify({ request, recipientEmail }),
  });
}

export async function getTrackedPaymentRequest(id: string): Promise<VerifiedPaymentRequest> {
  return fetchJson<VerifiedPaymentRequest>(`/api/payment-requests/${id}`);
}

export async function claimTrackedPaymentRequest(id: string): Promise<VerifiedPaymentRequest> {
  return fetchJson<VerifiedPaymentRequest>(`/api/payment-requests/${id}/claim`, {
    method: "POST",
  });
}

export async function recordTrackedPayment(input: {
  requestId: string;
  amount: string;
  payerAddress?: string;
  payerEmail?: string;
  transactionId: string;
  transactionHash?: string;
  rawResult?: unknown;
}): Promise<{ receipt: PaymentReceipt; request: VerifiedPaymentRequest }> {
  return fetchJson<{ receipt: PaymentReceipt; request: VerifiedPaymentRequest }>(
    `/api/payment-requests/${input.requestId}/payments`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function getPaymentActivity(wallet: string): Promise<PaymentRequestActivityItem[]> {
  const params = new URLSearchParams({ wallet });
  return fetchJson<PaymentRequestActivityItem[]>(`/api/payment-requests?${params.toString()}`);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "LinkPay request failed");
  }

  return payload as T;
}
