"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowSquareOut,
  Check,
  CheckCircle,
  Copy,
  ShieldCheck,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatUSD } from "@/utils/formatCurrency";
import { ARBITRUM_CHAIN_ID, shortAddress } from "@/utils/paymentRequest";
import type { PaymentReceipt } from "@/utils/types";

export function PayRequestScreen() {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const {
    activeRequest,
    balance,
    balanceLabel,
    clearActiveRequest,
    lastReceipt,
    refreshBalance,
    sendError,
    sendStage,
    sendUSDC,
    user,
  } = useApp();

  useEffect(() => { refreshBalance(); }, [refreshBalance]);
  const [isReleasing, setIsReleasing] = useState(false);

  const handlePay = useCallback(async () => {
    if (!activeRequest?.request) return;
    const r = activeRequest.request;
    await sendUSDC(r.payload.amount, r.payload.recipientAddress, r, activeRequest?.id);
  }, [activeRequest, sendUSDC]);

  if (!activeRequest || !activeRequest.request) {
    return (
      <LinkState
        title="Link can't be verified"
        message={activeRequest?.error || "This payment link is missing or malformed."}
        onClose={clearActiveRequest}
      />
    );
  }

  if (activeRequest.status === "expired") {
    return (
      <LinkState
        title="Request expired"
        message="Ask the recipient to create a new payment link."
        onClose={clearActiveRequest}
      />
    );
  }

  if (activeRequest.backendStatus === "paid" && activeRequest.latestPayment) {
    return (
      <PaidState receipt={activeRequest.latestPayment} onDone={clearActiveRequest} />
    );
  }

  if (
    activeRequest.backendStatus === "cancelled" ||
    activeRequest.backendStatus === "expired"
  ) {
    return (
      <LinkState
        title="Request unavailable"
        message={`This payment request is ${activeRequest.backendStatus}.`}
        onClose={clearActiveRequest}
      />
    );
  }

  const request = activeRequest.request;
  const activeRequestId = activeRequest.id;
  const payload = request.payload;
  const amountValue = Number(payload.amount);
  const usdcAmount =
    balance?.assets?.reduce((sum, a) => {
      if (a.type === "USDC" && a.chainId === ARBITRUM_CHAIN_ID) {
        return sum + Number(a.amount);
      }
      return sum;
    }, 0) ?? 0;
  const hasInsufficientBalance =
    balance !== null && usdcAmount + 0.000001 < amountValue;
  const isProcessingElsewhere = activeRequest.backendStatus === "processing";
  async function handleRetry() {
    setIsReleasing(true);
    try {
      if (activeRequestId) {
        await fetch(`/api/payment-requests/${activeRequestId}/release`, { method: "POST" });
      }
    } catch {
      // best-effort
    }
    setIsReleasing(false);
    await handlePay();
  }

  if (sendStage === "sending") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex min-h-[100dvh] flex-col items-center justify-center px-6"
      >
        <div className="w-full max-w-sm text-center">
          <Spinner size={36} className="mx-auto mb-6 text-zinc-500 dark:text-zinc-300" />
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Paying {formatUSD(amountValue)}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Signing and submitting on Arbitrum.
          </p>
        </div>
      </motion.div>
    );
  }

  if (sendStage === "success" && lastReceipt) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex min-h-[100dvh] flex-col px-5 py-6"
      >
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <CheckCircle size={34} weight="fill" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Payment submitted
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {formatUSD(Number(lastReceipt.amount))} USDC to{" "}
              {lastReceipt.recipientLabel}
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <ReceiptRow label="Recipient" value={shortAddress(lastReceipt.recipientAddress)} />
            <ReceiptRow label="Memo" value={lastReceipt.memo || "USDC payment"} />
            <ReceiptRow
              label="Transaction"
              value={shortId(lastReceipt.transactionHash || lastReceipt.transactionId)}
            />
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {lastReceipt.explorerUrl && (
              <a
                href={lastReceipt.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                View on Arbiscan <ArrowSquareOut size={16} weight="bold" />
              </a>
            )}
            <Button variant="secondary" size="lg" onClick={clearActiveRequest}>
              Done
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex min-h-[100dvh] flex-col px-5 py-6"
    >
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="mb-8 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <ShieldCheck size={15} weight="fill" />
            {activeRequest.backendStatus === "processing"
              ? "Payment in progress"
              : "Verified request"}
          </div>
          <button
            onClick={clearActiveRequest}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close payment request"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Pay</p>
          <h1 className="mt-2 text-6xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {formatUSD(amountValue)}
          </h1>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-300">
            {payload.memo || "USDC payment"}
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <ReceiptRow label="To" value={payload.recipientLabel} />
          <ReceiptRow label="Wallet" value={shortAddress(payload.recipientAddress)} />
          <ReceiptRow label="Network" value="Arbitrum" />
          <ReceiptRow
            label="Available"
            value={usdcAmount > 0 ? `${usdcAmount.toFixed(2)} USDC` : balanceLabel}
          />
        </div>

        {hasInsufficientBalance && (
          <div className="mt-4 space-y-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <p>Fund USDC on Arbitrum.</p>
            {user?.eoaAddress && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(user.eoaAddress).then(() => {
                    setCopiedAddress(true);
                    setTimeout(() => setCopiedAddress(false), 1600);
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-100/80 px-2.5 py-1.5 text-xs font-mono transition-colors hover:bg-amber-200/80 dark:bg-amber-900/50 dark:hover:bg-amber-800/50"
              >
                {copiedAddress ? (
                  <><Check size={13} weight="bold" /> Copied</>
                ) : (
                  <><Copy size={13} weight="bold" /> {shortAddress(user.eoaAddress)}</>
                )}
              </button>
            )}
          </div>
        )}

        {isProcessingElsewhere && (
          <div className="mt-4 space-y-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <p>Previous payment attempt did not complete.</p>
            <button
              onClick={handleRetry}
              disabled={isReleasing}
              className="inline-flex h-9 items-center rounded-lg bg-amber-200/80 px-4 text-xs font-medium transition-colors hover:bg-amber-300/80 disabled:opacity-50 dark:bg-amber-800/50 dark:hover:bg-amber-700/50"
            >
              {isReleasing ? "Releasing…" : "Retry payment"}
            </button>
          </div>
        )}

        {sendStage === "error" && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {sendError || "Payment failed"}
          </div>
        )}

        <div className="mt-auto pt-8">
          <Button
            onClick={handlePay}
            size="lg"
            className="w-full"
            disabled={hasInsufficientBalance || isProcessingElsewhere}
          >
            {isProcessingElsewhere ? "In progress" : `Pay ${formatUSD(amountValue)}`}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function PaidState({
  receipt,
  onDone,
}: {
  receipt: PaymentReceipt | null;
  onDone: () => void;
}) {
  if (!receipt) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-[100dvh] flex-col px-5 py-6"
    >
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <CheckCircle size={34} weight="fill" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Already paid
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {formatUSD(Number(receipt.amount))} USDC has been submitted for this link.
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <ReceiptRow label="Recipient" value={shortAddress(receipt.recipientAddress)} />
          <ReceiptRow label="Memo" value={receipt.memo || "USDC payment"} />
          <ReceiptRow
            label="Transaction"
            value={shortId(receipt.transactionHash || receipt.transactionId)}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {receipt.explorerUrl && (
            <a
              href={receipt.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              View on Arbiscan <ArrowSquareOut size={16} weight="bold" />
            </a>
          )}
          <Button variant="secondary" size="lg" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function LinkState({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-[100dvh] flex-col items-center justify-center px-6"
    >
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300">
          <WarningCircle size={30} weight="fill" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {message}
        </p>
        <Button onClick={onClose} variant="secondary" size="lg" className="mt-7 w-full">
          Close
        </Button>
      </div>
    </motion.div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </span>
    </div>
  );
}

function shortId(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}
