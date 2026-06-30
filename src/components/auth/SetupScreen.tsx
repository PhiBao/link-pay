"use client";

import { motion } from "motion/react";
import { ShieldCheck } from "@phosphor-icons/react";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export function SetupScreen() {
  const { isDelegating, delegationStatus, delegate } = useApp();

  const isSettingUp = isDelegating || delegationStatus === "checking" || delegationStatus === "unknown";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-[100dvh] flex-col items-center justify-center px-6"
    >
      <div className="w-full max-w-sm text-center">
        {isSettingUp ? (
          <>
            <Spinner size={32} className="mx-auto mb-6 text-zinc-400" />
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Preparing LinkPay
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Checking your Arbitrum account
            </p>
          </>
        ) : delegationStatus === "not-delegated" ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <ShieldCheck size={26} weight="fill" className="text-zinc-600 dark:text-zinc-300" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Upgrade your account
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                LinkPay uses a one-time Arbitrum activation so future USDC
                payments can stay simple.
              </p>
            </motion.div>
            <Button onClick={delegate} size="lg" className="w-full" isLoading={isDelegating}>
              Activate LinkPay
            </Button>
          </>
        ) : (
          <Spinner size={28} className="mx-auto text-zinc-400" />
        )}
      </div>
    </motion.div>
  );
}
