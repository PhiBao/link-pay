import type {
  PaymentRequestActivityItem,
  PaymentReceipt,
  PaymentRequestStatus,
  PaymentStatus,
  SignedPaymentRequest,
  VerifiedPaymentRequest,
} from "@/utils/types";
import {
  arbiscanTxUrl,
  verifySignedPaymentRequest,
} from "@/utils/paymentRequest";

export interface PaymentRequestRow {
  id: string;
  payload: SignedPaymentRequest["payload"];
  signature: string;
  amount: string | number;
  memo: string;
  recipient_address: string;
  recipient_label: string;
  recipient_email: string | null;
  status: PaymentRequestStatus;
  paid_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface PaymentRow {
  id: string;
  request_id: string;
  amount: string | number;
  payer_address: string | null;
  payer_email: string | null;
  transaction_id: string;
  transaction_hash: string | null;
  status: PaymentStatus;
  submitted_at: string;
  created_at: string;
}

export function rowToSignedRequest(row: PaymentRequestRow): SignedPaymentRequest {
  return {
    payload: row.payload,
    signature: row.signature,
  };
}

export function rowToVerifiedRequest(
  row: PaymentRequestRow,
  latestPayment?: PaymentRow | null,
): VerifiedPaymentRequest {
  const verified = verifySignedPaymentRequest(rowToSignedRequest(row));

  return {
    ...verified,
    id: row.id,
    backendStatus: row.status,
    paidAt: row.paid_at,
    latestPayment: latestPayment ? rowToReceipt(latestPayment, row) : null,
  };
}

export function rowToReceipt(row: PaymentRow, request?: PaymentRequestRow): PaymentReceipt {
  const transactionHash = row.transaction_hash || undefined;

  return {
    id: row.id,
    requestId: row.request_id,
    amount: String(row.amount),
    memo: request?.memo || request?.payload.memo || "USDC payment",
    recipientAddress: request?.recipient_address || request?.payload.recipientAddress || "",
    recipientLabel: request?.recipient_label || request?.payload.recipientLabel || "Recipient",
    payerAddress: row.payer_address,
    payerEmail: row.payer_email,
    transactionId: row.transaction_id,
    transactionHash,
    explorerUrl: transactionHash ? arbiscanTxUrl(transactionHash) : undefined,
    timestamp: new Date(row.submitted_at || row.created_at).getTime(),
    status: row.status,
  };
}

export function rowToActivityItem(
  row: PaymentRequestRow,
  baseUrl: string,
  latestPayment?: PaymentRow | null,
): PaymentRequestActivityItem {
  return {
    id: row.id,
    url: `${baseUrl.replace(/\/$/, "")}/pay/${row.id}`,
    amount: String(row.amount),
    memo: row.memo || row.payload.memo || "USDC payment",
    recipientAddress: row.recipient_address,
    recipientLabel: row.recipient_label,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    latestPayment: latestPayment ? rowToReceipt(latestPayment, row) : null,
  };
}
