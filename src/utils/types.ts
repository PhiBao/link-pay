export type DelegationStatus = "unknown" | "checking" | "delegated" | "not-delegated";

export type SendStage = "idle" | "sending" | "success" | "error";

export type LinkVerificationStatus = "valid" | "expired" | "invalid";

export type PaymentRequestStatus =
  | "open"
  | "processing"
  | "submitted"
  | "paid"
  | "expired"
  | "cancelled";

export type PaymentStatus = "submitted" | "confirmed" | "failed";

export interface UserInfo {
  email: string;
  eoaAddress: string;
}

export interface PaymentRequestPayload {
  version: 1;
  kind: "linkpay.payment-request";
  amount: string;
  memo: string;
  recipientAddress: string;
  recipientLabel: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: "USDC";
  createdAt: number;
  expiresAt: number;
  nonce: string;
}

export interface SignedPaymentRequest {
  payload: PaymentRequestPayload;
  signature: string;
}

export interface VerifiedPaymentRequest {
  id?: string;
  request: SignedPaymentRequest | null;
  status: LinkVerificationStatus;
  backendStatus?: PaymentRequestStatus;
  signerAddress?: string;
  error?: string;
  paidAt?: string | null;
  latestPayment?: PaymentReceipt | null;
}

export interface CreatePaymentRequestInput {
  amount: string;
  memo: string;
  expiresInHours?: number;
}

export interface CreatedPaymentRequest {
  id?: string;
  request: SignedPaymentRequest;
  url: string;
}

export interface PaymentReceipt {
  id: string;
  requestId?: string;
  amount: string;
  memo: string;
  recipientAddress: string;
  recipientLabel: string;
  payerAddress?: string | null;
  payerEmail?: string | null;
  transactionId: string;
  transactionHash?: string;
  explorerUrl?: string;
  timestamp: number;
  status: PaymentStatus;
}

export interface PaymentRequestActivityItem {
  id: string;
  url: string;
  amount: string;
  memo: string;
  recipientAddress: string;
  recipientLabel: string;
  status: PaymentRequestStatus;
  createdAt: string;
  expiresAt: string;
  paidAt?: string | null;
  latestPayment?: PaymentReceipt | null;
}

export interface PrimaryAssetInfo {
  chainId: number;
  type: string;
  amount: string;
  amountInUsd: number;
}

export interface UnifiedBalance {
  totalAmountInUSD: number;
  assets: PrimaryAssetInfo[];
}
