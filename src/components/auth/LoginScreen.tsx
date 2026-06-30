"use client";

import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { ArrowRight, Envelope, LinkSimple } from "@phosphor-icons/react";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatUSD } from "@/utils/formatCurrency";

export function LoginScreen() {
  const { activeRequest, login, authError } = useApp();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const request = activeRequest?.request?.payload;

  function validateEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateEmail(email)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError("");
    setIsLoading(true);
    await login(email);
    setIsLoading(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-[100dvh] flex-col items-center justify-center px-6"
    >
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12 text-center"
        >
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-900 dark:bg-white">
            {request ? (
              <LinkSimple
                size={22}
                weight="bold"
                className="text-white dark:text-zinc-900"
              />
            ) : (
              <Envelope
                size={22}
                weight="fill"
                className="text-white dark:text-zinc-900"
              />
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {request ? `Pay ${formatUSD(Number(request.amount))}` : "LinkPay"}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {request
              ? `${request.recipientLabel} requested USDC for ${request.memo || "a payment"}.`
              : "Create and pay verified USDC links."}
          </p>
        </motion.div>

        {request && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Memo</span>
              <span className="min-w-0 truncate text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {request.memo || "USDC payment"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">To</span>
              <span className="min-w-0 truncate text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {request.recipientLabel}
              </span>
            </div>
          </motion.div>
        )}

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError("");
            }}
            error={emailError || authError}
            autoFocus
            autoComplete="email"
          />
          <Button type="submit" size="lg" isLoading={isLoading} className="w-full">
            Continue <ArrowRight size={18} weight="bold" />
          </Button>
          <p className="text-center text-xs text-zinc-400">
            We&rsquo;ll send you a verification code
          </p>
        </motion.form>
      </div>
    </motion.div>
  );
}
