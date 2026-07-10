import { getAddress, isAddress, verifyMessage } from "ethers";
import type {
  PaymentRequestPayload,
  SignedPaymentRequest,
  VerifiedPaymentRequest,
} from "@/utils/types";

export const ARBITRUM_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 42161);
export const ARBITRUM_USDC_ADDRESS =
  process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
export const PAYMENT_REQUEST_PARAM = "pay";
export const DEFAULT_EXPIRY_HOURS = 72;

const REQUEST_KIND = "linkpay.payment-request";
const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

export function normalizePaymentAmount(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Enter a dollar amount with up to 2 decimals");
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0.01) {
    throw new Error("Minimum request is $0.01");
  }

  return numeric.toFixed(2);
}

export function buildPaymentRequestPayload(input: {
  amount: string;
  memo: string;
  recipientAddress: string;
  recipientLabel: string;
  expiresInHours?: number;
}): PaymentRequestPayload {
  const now = Date.now();
  const expiresInHours = input.expiresInHours ?? DEFAULT_EXPIRY_HOURS;

  if (!isAddress(input.recipientAddress)) {
    throw new Error("Recipient wallet is not a valid address");
  }

  return {
    version: 1,
    kind: REQUEST_KIND,
    amount: normalizePaymentAmount(input.amount),
    memo: input.memo.trim().slice(0, 96),
    recipientAddress: getAddress(input.recipientAddress),
    recipientLabel: input.recipientLabel.trim().slice(0, 80) || "LinkPay user",
    chainId: ARBITRUM_CHAIN_ID,
    tokenAddress: getAddress(ARBITRUM_USDC_ADDRESS),
    tokenSymbol: "USDC",
    createdAt: now,
    expiresAt: now + expiresInHours * 60 * 60 * 1000,
    nonce: crypto.randomUUID(),
  };
}

export function buildPaymentRequestMessage(payload: PaymentRequestPayload): string {
  const normalized = normalizePayload(payload);

  return [
    "LinkPay payment request",
    `version=${normalized.version}`,
    `kind=${normalized.kind}`,
    `amount=${normalized.amount}`,
    `memo=${normalized.memo}`,
    `recipientAddress=${normalized.recipientAddress}`,
    `recipientLabel=${normalized.recipientLabel}`,
    `chainId=${normalized.chainId}`,
    `tokenAddress=${normalized.tokenAddress}`,
    `tokenSymbol=${normalized.tokenSymbol}`,
    `createdAt=${normalized.createdAt}`,
    `expiresAt=${normalized.expiresAt}`,
    `nonce=${normalized.nonce}`,
  ].join("\n");
}

export function encodePaymentRequest(request: SignedPaymentRequest): string {
  const json = JSON.stringify(request);
  return toBase64Url(json);
}

export function decodePaymentRequest(encoded: string): SignedPaymentRequest {
  const decoded = fromBase64Url(encoded);
  const parsed = JSON.parse(decoded) as SignedPaymentRequest;

  if (!parsed || typeof parsed !== "object" || typeof parsed.signature !== "string") {
    throw new Error("Payment link is malformed");
  }

  return {
    payload: normalizePayload(parsed.payload),
    signature: parsed.signature,
  };
}

export function verifySignedPaymentRequest(
  request: SignedPaymentRequest,
): VerifiedPaymentRequest {
  try {
    const payload = normalizePayload(request.payload);
    const signerAddress = getAddress(
      verifyMessage(buildPaymentRequestMessage(payload), request.signature),
    );

    if (signerAddress !== payload.recipientAddress) {
      return {
        request: null,
        status: "invalid",
        signerAddress,
        error: "The payment request was not signed by the receiving wallet.",
      };
    }

    if (payload.expiresAt <= Date.now()) {
      return {
        request: { payload, signature: request.signature },
        status: "expired",
        signerAddress,
        error: "This payment request has expired.",
      };
    }

    return {
      request: { payload, signature: request.signature },
      status: "valid",
      signerAddress,
    };
  } catch (error) {
    return {
      request: null,
      status: "invalid",
      error: error instanceof Error ? error.message : "Payment link is invalid.",
    };
  }
}

export function paymentRequestUrl(request: SignedPaymentRequest): string {
  const url = new URL("/", window.location.origin);
  url.searchParams.set(PAYMENT_REQUEST_PARAM, encodePaymentRequest(request));
  return url.toString();
}

export function verifiedRequestFromSearch(search: string): VerifiedPaymentRequest | null {
  const params = new URLSearchParams(search);
  const encoded = params.get(PAYMENT_REQUEST_PARAM);

  if (!encoded) return null;

  try {
    return verifySignedPaymentRequest(decodePaymentRequest(encoded));
  } catch (error) {
    return {
      request: null,
      status: "invalid",
      error: error instanceof Error ? error.message : "Payment link is invalid.",
    };
  }
}

export function shortAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function isTransactionHash(value: string | undefined): value is string {
  return Boolean(value && TX_HASH_PATTERN.test(value));
}

export function arbiscanTxUrl(hash: string): string {
  return `https://arbiscan.io/tx/${hash}`;
}

function normalizePayload(payload: PaymentRequestPayload): PaymentRequestPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payment request payload is missing");
  }

  if (payload.version !== 1 || payload.kind !== REQUEST_KIND) {
    throw new Error("Payment request version is unsupported");
  }

  if (payload.chainId !== ARBITRUM_CHAIN_ID) {
    throw new Error("Payment request is for an unsupported network");
  }

  if (!isAddress(payload.recipientAddress) || !isAddress(payload.tokenAddress)) {
    throw new Error("Payment request contains an invalid address");
  }

  if (getAddress(payload.tokenAddress) !== getAddress(ARBITRUM_USDC_ADDRESS)) {
    throw new Error("Payment request token is unsupported");
  }

  if (!payload.nonce || typeof payload.nonce !== "string") {
    throw new Error("Payment request is missing a nonce");
  }

  return {
    version: 1,
    kind: REQUEST_KIND,
    amount: normalizePaymentAmount(payload.amount),
    memo: String(payload.memo ?? "").trim().slice(0, 96),
    recipientAddress: getAddress(payload.recipientAddress),
    recipientLabel: String(payload.recipientLabel ?? "LinkPay user").trim().slice(0, 80),
    chainId: ARBITRUM_CHAIN_ID,
    tokenAddress: getAddress(payload.tokenAddress),
    tokenSymbol: "USDC",
    createdAt: Number(payload.createdAt),
    expiresAt: Number(payload.expiresAt),
    nonce: payload.nonce,
  };
}

function toBase64Url(value: string): string {
  const encoded = btoa(unescape(encodeURIComponent(value)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(base64)));
}
