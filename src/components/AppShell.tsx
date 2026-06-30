"use client";

import { AnimatePresence } from "motion/react";
import { useApp } from "@/components/providers/AppProvider";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { SetupScreen } from "@/components/auth/SetupScreen";
import { HomeScreen } from "@/components/home/HomeScreen";
import { PayRequestScreen } from "@/components/pay/PayRequestScreen";
import { Spinner } from "@/components/ui/Spinner";

export function AppShell() {
  const {
    isAuthLoading,
    isLoggedIn,
    isInitialized,
    delegationStatus,
    activeRequest,
    isRequestLoading,
  } = useApp();

  // Loading: checking existing auth session
  if (isAuthLoading || isRequestLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Spinner size={24} className="text-zinc-300" />
      </div>
    );
  }

  // Invalid or expired links should be explainable before sign-in.
  if (activeRequest && activeRequest.status !== "valid") {
    return <PayRequestScreen />;
  }

  // Not authenticated: show login
  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  // Authenticated but UA not initialized yet: brief loading
  if (!isInitialized) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Spinner size={24} className="text-zinc-300" />
      </div>
    );
  }

  // Delegation needed
  if (
    delegationStatus === "checking" ||
    delegationStatus === "unknown" ||
    delegationStatus === "not-delegated"
  ) {
    return <SetupScreen />;
  }

  // Main app
  return (
    <AnimatePresence mode="wait">
      {activeRequest ? (
        <PayRequestScreen key="pay" />
      ) : (
        <HomeScreen key="home" />
      )}
    </AnimatePresence>
  );
}
