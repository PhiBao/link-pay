"use client";

import { useMemo, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import {
  ArrowClockwise,
  ArrowSquareOut,
  Check,
  Copy,
  LinkSimple,
  PaperPlaneRight,
  SignOut,
} from "@phosphor-icons/react";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Spinner";
import { formatUSD } from "@/utils/formatCurrency";
import { normalizePaymentAmount, shortAddress } from "@/utils/paymentRequest";
import { isAddress } from "ethers";

export function HomeScreen() {
  const {
    balanceLabel,
    createPaymentRequest,
    isLoadingBalance,
    logout,
    paymentActivity,
    refreshBalance,
    sendError,
    sendStage,
    sendUSDC,
    resetSend,
    user,
  } = useApp();
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [formError, setFormError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);

  const [sendAddr, setSendAddr] = useState("");
  const [sendAmt, setSendAmt] = useState("");
  const [sendErr, setSendErr] = useState("");

  const amountPreview = useMemo(() => {
    try {
      return amount ? formatUSD(Number(normalizePaymentAmount(amount))) : "$0.00";
    } catch {
      return "$0.00";
    }
  }, [amount]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setCopied(false);

    try {
      normalizePaymentAmount(amount);
      if (memo.trim().length < 2) {
        throw new Error("Add a short memo for the payment");
      }

      setIsCreating(true);
      const result = await createPaymentRequest({ amount, memo });
      if (result) {
        setCreatedUrl(result.url);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create link");
    } finally {
      setIsCreating(false);
    }
  }

  async function copyLink() {
    if (!createdUrl) return;
    await navigator.clipboard.writeText(createdUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function shareLink() {
    if (!createdUrl) return;
    if (navigator.share) {
      await navigator.share({
        title: `Pay ${amountPreview} with LinkPay`,
        text: memo.trim(),
        url: createdUrl,
      });
      return;
    }
    await copyLink();
  }

  async function handleSend() {
    setSendErr("");
    resetSend();
    if (!isAddress(sendAddr)) {
      setSendErr("Invalid address");
      return;
    }
    const amt = sendAmt.trim();
    if (!amt || isNaN(Number(amt)) || Number(amt) <= 0) {
      setSendErr("Enter a valid amount");
      return;
    }
    await sendUSDC(amt, sendAddr);
    if (sendStage === "success") {
      setSendAddr("");
      setSendAmt("");
    }
  }

  const isSending = sendStage === "sending";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-[100dvh] flex-col px-5 py-6"
    >
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <header className="mb-7 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                <LinkSimple size={18} weight="bold" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  LinkPay
                </h1>
                <p className="max-w-[210px] truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Sign out"
          >
            <SignOut size={18} weight="bold" />
          </button>
        </header>

        <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Available</p>
              {isLoadingBalance ? (
                <Skeleton className="mt-2 h-9 w-28" />
              ) : (
                <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {balanceLabel}
                </p>
              )}
            </div>
            <button
              onClick={refreshBalance}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Refresh balance"
            >
              <ArrowClockwise size={18} weight="bold" />
            </button>
          </div>
          {user?.eoaAddress && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(user.eoaAddress).then(() => {
                  setCopiedAddr(true);
                  setTimeout(() => setCopiedAddr(false), 1600);
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-mono text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              {copiedAddr ? (
                <><Check size={13} weight="bold" /> Copied</>
              ) : (
                <><Copy size={13} weight="bold" /> {shortAddress(user.eoaAddress)}</>
              )}
            </button>
          )}
        </section>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Request
            </p>
            <p className="mb-5 text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {amountPreview}
            </p>
            <div className="flex flex-col gap-4">
              <Input
                label="Amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="25.00"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setFormError("");
                  setCreatedUrl("");
                }}
              />
              <Input
                label="Memo"
                placeholder="Design review, dinner, invoice #18"
                value={memo}
                maxLength={96}
                onChange={(event) => {
                  setMemo(event.target.value);
                  setFormError("");
                  setCreatedUrl("");
                }}
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-[1rem] bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </div>
          )}

          <Button type="submit" size="lg" isLoading={isCreating} className="w-full">
            Create payment link
          </Button>
        </form>

        {createdUrl && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
          >
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
              <Check size={16} weight="bold" />
              Verified link ready
            </div>
            <p className="mb-4 truncate rounded-lg bg-white px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              {createdUrl}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="secondary" onClick={copyLink}>
                {copied ? <Check size={17} weight="bold" /> : <Copy size={17} weight="bold" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button type="button" onClick={shareLink}>
                Share
              </Button>
            </div>
          </motion.div>
        )}

        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center gap-2">
            <PaperPlaneRight size={16} weight="bold" className="text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Send USDC</h2>
          </div>
          <div className="flex flex-col gap-3">
            <Input
              label="To address"
              placeholder="0x..."
              value={sendAddr}
              onChange={(e) => { setSendAddr(e.target.value); setSendErr(""); }}
            />
            <Input
              label="Amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="10.00"
              value={sendAmt}
              onChange={(e) => { setSendAmt(e.target.value); setSendErr(""); }}
            />
          </div>
          {sendErr && (
            <div className="mt-3 rounded-[1rem] bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {sendErr}
            </div>
          )}
          {sendStage === "error" && (
            <div className="mt-3 rounded-[1rem] bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {sendError || "Send failed"}
            </div>
          )}
          {sendStage === "success" && (
            <div className="mt-3 rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              Payment submitted
            </div>
          )}
          <Button
            onClick={handleSend}
            size="lg"
            isLoading={isSending}
            className="mt-4 w-full"
          >
            Send
          </Button>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Payment links
            </h2>
          </div>

          {paymentActivity.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white px-5 py-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Created links and paid receipts will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {paymentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {item.memo}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {statusLabel(item.status)} · {shortAddress(item.recipientAddress)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatUSD(Number(item.amount))}
                    </span>
                    {(item.latestPayment?.explorerUrl || item.url) && (
                      <a
                        href={item.latestPayment?.explorerUrl || item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        aria-label={item.latestPayment?.explorerUrl ? "Open transaction" : "Open payment link"}
                      >
                        <ArrowSquareOut size={15} weight="bold" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Unpaid";
    case "processing":
      return "In progress";
    case "paid":
      return "Paid";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return "Submitted";
  }
}
