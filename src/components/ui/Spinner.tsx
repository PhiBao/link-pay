"use client";

import { motion, AnimatePresence } from "motion/react";
import { CircleNotch } from "@phosphor-icons/react";

export function Spinner({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={className}
      style={{ display: "inline-block" }}
    >
      <CircleNotch size={size} weight="bold" />
    </motion.span>
  );
}

export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-zinc-200/60 dark:bg-zinc-800/60 ${className}`}
    />
  );
}

export function Toast({
  message,
  type = "info",
  onDismiss,
}: {
  message: string;
  type?: "info" | "success" | "error";
  onDismiss?: () => void;
}) {
  const colors = {
    info: "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
    success: "bg-emerald-600 text-white",
    error: "bg-red-600 text-white",
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.96 }}
        className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-medium shadow-lg ${colors[type]}`}
        onClick={onDismiss}
      >
        {message}
      </motion.div>
    </AnimatePresence>
  );
}
