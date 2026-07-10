"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Magic } from "magic-sdk";
import type { InstanceWithExtensions, SDKBase } from "magic-sdk";
import { EVMExtension } from "@magic-ext/evm";
import {
  UniversalAccount,
  UNIVERSAL_ACCOUNT_VERSION,
} from "@particle-network/universal-account-sdk";
import {
  BrowserProvider,
  getAddress,
  getBytes,
  isAddress,
  JsonRpcProvider,
  Signature,
  type Eip1193Provider,
} from "ethers";
import type {
  CreatedPaymentRequest,
  CreatePaymentRequestInput,
  DelegationStatus,
  PaymentRequestActivityItem,
  PaymentReceipt,
  SendStage,
  SignedPaymentRequest,
  UnifiedBalance,
  UserInfo,
  VerifiedPaymentRequest,
} from "@/utils/types";
import { formatCompactUSD } from "@/utils/formatCurrency";
import {
  ARBITRUM_CHAIN_ID,
  ARBITRUM_USDC_ADDRESS,
  buildPaymentRequestMessage,
  buildPaymentRequestPayload,
  isTransactionHash,
  verifiedRequestFromSearch,
} from "@/utils/paymentRequest";
import {
  claimTrackedPaymentRequest,
  createTrackedPaymentRequest,
  getPaymentActivity,
  getTrackedPaymentRequest,
  recordTrackedPayment,
} from "@/utils/linkpayApi";

interface AppState {
  isAuthLoading: boolean;
  isLoggedIn: boolean;
  user: UserInfo | null;
  authError: string | null;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;

  isInitialized: boolean;
  isDelegating: boolean;
  delegationStatus: DelegationStatus;
  balance: UnifiedBalance | null;
  balanceLabel: string;
  isLoadingBalance: boolean;
  delegate: () => Promise<boolean>;
  refreshBalance: () => Promise<void>;

  activeRequest: VerifiedPaymentRequest | null;
  isRequestLoading: boolean;
  clearActiveRequest: () => void;
  createPaymentRequest: (
    input: CreatePaymentRequestInput,
  ) => Promise<CreatedPaymentRequest | null>;

  sendStage: SendStage;
  sendError: string | null;
  sendResultId: string | null;
  lastReceipt: PaymentReceipt | null;
  paymentActivity: PaymentRequestActivityItem[];
  sendUSDC: (
    amount: string,
    receiverAddress: string,
    request?: SignedPaymentRequest,
    requestId?: string,
  ) => Promise<boolean>;
  resetSend: () => void;
}

type MagicInstance = InstanceWithExtensions<SDKBase, [EVMExtension]> & {
  rpcProvider: Eip1193Provider;
  wallet: {
    sign7702Authorization: (payload: {
      contractAddress: string;
      chainId: number;
      nonce: number;
    }) => Promise<{ r: string; s: string; v: number }>;
    send7702Transaction: (payload: {
      to: string;
      data: string;
      authorizationList: Array<{ r: string; s: string; v: number }>;
    }) => Promise<unknown>;
  };
};

const AppContext = createContext<AppState | null>(null);
const MAGIC_API_KEY = usablePublicEnv(process.env.NEXT_PUBLIC_MAGIC_API_KEY);

export function AppProvider({ children }: { children: ReactNode }) {
  const magicRef = useRef<MagicInstance | null>(null);
  const uaRef = useRef<InstanceType<typeof UniversalAccount> | null>(null);
  const providerRef = useRef<BrowserProvider | null>(null);

  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(MAGIC_API_KEY));
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authError, setAuthError] = useState<string | null>(
    MAGIC_API_KEY ? null : "Magic API key is not configured. Add a real NEXT_PUBLIC_MAGIC_API_KEY.",
  );

  const [isInitialized, setIsInitialized] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);
  const [delegationStatus, setDelegationStatus] = useState<DelegationStatus>("unknown");
  const [balance, setBalance] = useState<UnifiedBalance | null>(null);
  const [balanceLabel, setBalanceLabel] = useState("$0.00");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const [activeRequest, setActiveRequest] = useState<VerifiedPaymentRequest | null>(() => {
    if (typeof window === "undefined") return null;
    return verifiedRequestFromSearch(window.location.search);
  });
  const [isRequestLoading, setIsRequestLoading] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(paymentRequestIdFromPath());
  });
  const [sendStage, setSendStage] = useState<AppState["sendStage"]>("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResultId, setSendResultId] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<PaymentReceipt | null>(null);
  const [paymentActivity, setPaymentActivity] = useState<PaymentRequestActivityItem[]>([]);

  useEffect(() => {
    const requestId = paymentRequestIdFromPath();
    if (!requestId) return;
    const trackedRequestId = requestId;

    let cancelled = false;

    async function loadRequest() {
      try {
        const request = await getTrackedPaymentRequest(trackedRequestId);
        if (!cancelled) setActiveRequest(request);
      } catch (error) {
        if (!cancelled) {
          setActiveRequest({
            id: trackedRequestId,
            request: null,
            status: "invalid",
            error: error instanceof Error ? error.message : "Payment request not found",
          });
        }
      } finally {
        if (!cancelled) setIsRequestLoading(false);
      }
    }

    loadRequest();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const apiKey = MAGIC_API_KEY;
    if (!apiKey) {
      return;
    }

    const rpcUrl = process.env.NEXT_PUBLIC_ARB_RPC_URL || "https://arb1.arbitrum.io/rpc";
    let cancelled = false;

    async function init() {
      try {
        const magic = new Magic(apiKey!, {
          extensions: [
            new EVMExtension([
              { rpcUrl, chainId: ARBITRUM_CHAIN_ID, default: true },
            ]),
          ],
        }) as MagicInstance;

        magicRef.current = magic;
        providerRef.current = new BrowserProvider(magic.rpcProvider);

        const isLogged = await magic.user.isLoggedIn();
        if (isLogged && !cancelled) {
          const metadata = await magic.user.getInfo();
          const email = metadata.email || "unknown";
          const eoa = metadata.wallets.ethereum?.publicAddress || "";
          setUser({ email, eoaAddress: eoa });
          setIsLoggedIn(true);
        }
      } catch (e) {
        if (!cancelled) {
          setAuthError(e instanceof Error ? e.message : "Magic failed to initialize");
        }
      } finally {
        if (!cancelled) setIsAuthLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const initUA = useCallback(async (ownerAddress: string) => {
    const projectId = usablePublicEnv(process.env.NEXT_PUBLIC_PROJECT_ID);
    const clientKey = usablePublicEnv(process.env.NEXT_PUBLIC_CLIENT_KEY);
    const appId = usablePublicEnv(process.env.NEXT_PUBLIC_APP_ID);

    if (!projectId || !clientKey || !appId) {
      setAuthError("Particle project keys are not configured. Add real project values.");
      return;
    }

    const owner = getAddress(ownerAddress);
    const instance = new UniversalAccount({
      projectId,
      projectClientKey: clientKey,
      projectAppUuid: appId,
      ownerAddress: owner,
      smartAccountOptions: {
        useEIP7702: true,
        name: "UNIVERSAL" as const,
        version: UNIVERSAL_ACCOUNT_VERSION,
        ownerAddress: owner,
      },
      tradeConfig: { slippageBps: 100 },
    });

    uaRef.current = instance;
    setIsInitialized(true);

    try {
      const deployments = await instance.getEIP7702Deployments();
      const arb = deployments.find(
        (d: { chainId: number; isDelegated: boolean }) =>
          d.chainId === ARBITRUM_CHAIN_ID,
      );
      setDelegationStatus(arb?.isDelegated ? "delegated" : "not-delegated");
    } catch {
      setDelegationStatus("not-delegated");
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    const ua = uaRef.current;
    if (!ua || delegationStatus !== "delegated") return;
    setIsLoadingBalance(true);

    try {
      const [assetsResult, onChain] = await Promise.all([
        ua.getPrimaryAssets(),
        (async () => {
          try {
            const provider = new JsonRpcProvider(
              process.env.NEXT_PUBLIC_ARB_RPC_URL || "https://arb1.arbitrum.io/rpc",
            );
            const abi = `0x70a08231${user!.eoaAddress.slice(2).padStart(64, "0")}`;
            const raw = await provider.call({
              to: ARBITRUM_USDC_ADDRESS,
              data: abi,
            });
            return Number(BigInt(raw)) / 1e6;
          } catch {
            return 0;
          }
        })(),
      ]);

      const rawAssets = (assetsResult as { assets?: Array<Record<string, unknown>> }).assets ?? [];
      const total = (assetsResult as { totalAmountInUSD?: number }).totalAmountInUSD ?? 0;
      const mapped = rawAssets.map((asset) => ({
        chainId: (
          Number(
            (asset.chainAggregation as Array<{ token?: { chainId?: number } }>)?.[0]?.token?.chainId
          ) || ARBITRUM_CHAIN_ID
        ) as number,
        type: asset.tokenType as string,
        amount: String(asset.amount ?? "0"),
        amountInUsd: Number(asset.amountInUSD ?? 0),
      }));

      if (onChain > 0) {
        const existing = mapped.find(
          (a) => a.type === "USDC" && a.chainId === ARBITRUM_CHAIN_ID,
        );
        if (existing) {
          existing.amount = String(onChain);
        } else {
          mapped.push({
            chainId: ARBITRUM_CHAIN_ID,
            type: "USDC",
            amount: String(onChain),
            amountInUsd: onChain,
          });
        }
      }

      setBalance({
        totalAmountInUSD: onChain || total,
        assets: mapped,
      });
      setBalanceLabel(
        onChain > 0 ? `${onChain.toFixed(2)} USDC` : formatCompactUSD(total),
      );
    } catch {
      setBalance(null);
      setBalanceLabel("$0.00");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [delegationStatus, user]);

  const refreshPaymentActivity = useCallback(async () => {
    if (!user?.eoaAddress) return;

    try {
      const activity = await getPaymentActivity(user.eoaAddress);
      setPaymentActivity(activity);
    } catch (error) {
      console.error("Payment activity:", error);
    }
  }, [user]);

  useEffect(() => {
    if (isLoggedIn && user && !isInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- UA init is an external SDK sync after auth.
      initUA(user.eoaAddress);
    }
  }, [isLoggedIn, user, isInitialized, initUA]);

  useEffect(() => {
    if (delegationStatus === "delegated") {
      refreshBalance();
    }
  }, [delegationStatus, refreshBalance]);

  useEffect(() => {
    if (isLoggedIn && user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- activity syncs external backend state after auth.
      refreshPaymentActivity();
    }
  }, [isLoggedIn, user, refreshPaymentActivity]);

  const login = useCallback(async (email: string) => {
    const magic = magicRef.current;
    if (!magic) return;

    setAuthError(null);
    try {
      await magic.auth.loginWithEmailOTP({ email, showUI: true });
      const metadata = await magic.user.getInfo();
      setUser({
        email: metadata.email || email,
        eoaAddress: metadata.wallets.ethereum?.publicAddress || "",
      });
      setIsLoggedIn(true);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Sign-in failed");
    }
  }, []);

  const logout = useCallback(async () => {
    if (magicRef.current) await magicRef.current.user.logout();
    setIsLoggedIn(false);
    setUser(null);
    setAuthError(null);
    setIsInitialized(false);
    setDelegationStatus("unknown");
    setBalance(null);
    setBalanceLabel("$0.00");
    setSendStage("idle");
    setSendError(null);
    setSendResultId(null);
    setLastReceipt(null);
    setPaymentActivity([]);
    uaRef.current = null;
  }, []);

  const delegate = useCallback(async (): Promise<boolean> => {
    const ua = uaRef.current;
    const magic = magicRef.current;
    if (!ua || !magic || !user?.eoaAddress) return false;

    setIsDelegating(true);
    try {
      await magic.evm.switchChain(ARBITRUM_CHAIN_ID);
      const [auth] = await ua.getEIP7702Auth([ARBITRUM_CHAIN_ID]);

      // User signs the EIP-7702 authorization with their Magic EOA key.
      // The transaction is then relayed by a funded server wallet so the
      // user never needs to hold ETH for gas.
      const authorization = await magic.wallet.sign7702Authorization({
        contractAddress: auth.address,
        chainId: ARBITRUM_CHAIN_ID,
        nonce: auth.nonce ?? 0,
      });

      const relayResponse = await fetch("/api/delegate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: user.eoaAddress,
          authorization,
        }),
      });

      if (!relayResponse.ok) {
        const errorPayload = (await relayResponse.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errorPayload.error || "Delegation relay failed");
      }

      const relayResult = (await relayResponse.json()) as {
        transactionHash?: string;
      };

      const provider = new JsonRpcProvider(
        process.env.NEXT_PUBLIC_ARB_RPC_URL || "https://arb1.arbitrum.io/rpc",
      );

      if (relayResult.transactionHash) {
        await provider.waitForTransaction(relayResult.transactionHash);
      }

      const eip7702Prefix = "0xef0100";
      const code = await provider.getCode(user.eoaAddress);
      if (code.startsWith(eip7702Prefix)) {
        setDelegationStatus("delegated");
        return true;
      }

      const deployments = await ua.getEIP7702Deployments();
      const arb = deployments.find(
        (d: { chainId: number; isDelegated: boolean }) =>
          d.chainId === ARBITRUM_CHAIN_ID,
      );

      if (arb?.isDelegated) {
        setDelegationStatus("delegated");
        return true;
      }

      setDelegationStatus("not-delegated");
      return false;
    } catch (e) {
      console.error("Delegation error:", e);
      setDelegationStatus("not-delegated");
      return false;
    } finally {
      setIsDelegating(false);
    }
  }, [user]);

  const createPaymentRequest = useCallback(
    async (input: CreatePaymentRequestInput): Promise<CreatedPaymentRequest | null> => {
      const provider = providerRef.current;
      if (!provider || !user?.eoaAddress) {
        setAuthError("Sign in before creating a payment link");
        return null;
      }

      const payload = buildPaymentRequestPayload({
        ...input,
        recipientAddress: user.eoaAddress,
        recipientLabel: user.email,
      });
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(buildPaymentRequestMessage(payload));
      const request = { payload, signature };

      const tracked = await createTrackedPaymentRequest(request, user.email);
      await refreshPaymentActivity();
      return tracked;
    },
    [refreshPaymentActivity, user],
  );

  const sendUSDC = useCallback(
    async (
      amount: string,
      receiverAddress: string,
      request?: SignedPaymentRequest,
      requestId?: string,
    ): Promise<boolean> => {
      const ua = uaRef.current;
      const provider = providerRef.current;
      if (!ua || !provider) return false;

      if (!isAddress(receiverAddress)) {
        setSendError("Recipient address is invalid");
        setSendStage("error");
        return false;
      }

      setSendStage("sending");
      setSendError(null);
      setSendResultId(null);
      setLastReceipt(null);

      try {
        if (requestId) {
          const claimed = await claimTrackedPaymentRequest(requestId);
          if (claimed.backendStatus === "paid") {
            throw new Error("This payment link has already been paid.");
          }
          if (claimed.backendStatus && claimed.backendStatus !== "processing") {
            throw new Error(`This payment link is ${claimed.backendStatus}.`);
          }
          setActiveRequest(claimed);
        }

        const recipient = getAddress(receiverAddress);
        const transaction = await ua.createTransferTransaction({
          token: {
            chainId: ARBITRUM_CHAIN_ID,
            address: ARBITRUM_USDC_ADDRESS,
          },
          amount,
          receiver: recipient,
        });

        const authorizations: Array<{ userOpHash: string; signature: string }> = [];

        if (transaction.userOps) {
          for (const userOp of transaction.userOps) {
            if (userOp.eip7702Auth && !userOp.eip7702Delegated) {
              const magic = magicRef.current;
              if (!magic) throw new Error("Magic wallet is not available");

              const auth = await magic.wallet.sign7702Authorization({
                contractAddress: userOp.eip7702Auth.address,
                chainId: userOp.eip7702Auth.chainId || userOp.chainId,
                nonce: userOp.eip7702Auth.nonce,
              });
              const sig = Signature.from({ r: auth.r, s: auth.s, v: auth.v });
              authorizations.push({
                userOpHash: userOp.userOpHash,
                signature: sig.serialized,
              });
            }
          }
        }

        const signer = await provider.getSigner();
        const signature = await signer.signMessage(getBytes(transaction.rootHash));
        const result = await ua.sendTransaction(
          transaction,
          signature,
          authorizations.length > 0 ? authorizations : undefined,
        );

        const transactionId = String(result?.transactionId ?? result?.hash ?? "submitted");
        const transactionHash = extractTransactionHash(result);
        let receipt: PaymentReceipt = {
          id: crypto.randomUUID(),
          amount,
          memo: request?.payload.memo || "USDC payment",
          recipientAddress: recipient,
          recipientLabel: request?.payload.recipientLabel || "Recipient",
          payerAddress: user?.eoaAddress || null,
          payerEmail: user?.email || null,
          transactionId,
          transactionHash,
          timestamp: Date.now(),
          status: "submitted",
        };

        if (requestId) {
          const recorded = await recordTrackedPayment({
            requestId,
            amount,
            payerAddress: user?.eoaAddress,
            payerEmail: user?.email,
            transactionId,
            transactionHash,
          });
          receipt = recorded.receipt;
          setActiveRequest(recorded.request);
          await refreshPaymentActivity();
        }

        setSendResultId(transactionId);
        setLastReceipt(receipt);
        setSendStage("success");
        setTimeout(() => refreshBalance(), 5000);
        return true;
      } catch (e) {
        if (requestId) {
          try {
            await fetch(`/api/payment-requests/${requestId}/release`, { method: "POST" });
          } catch {
            // best-effort release
          }
        }
        setSendError(e instanceof Error ? e.message : "Send failed");
        setSendStage("error");
        return false;
      }
    },
    [refreshBalance, refreshPaymentActivity, user],
  );

  const resetSend = useCallback(() => {
    setSendStage("idle");
    setSendError(null);
    setSendResultId(null);
    setLastReceipt(null);
  }, []);

  const clearActiveRequest = useCallback(() => {
    setActiveRequest(null);
    setIsRequestLoading(false);
    resetSend();
    window.history.replaceState({}, "", "/");
  }, [resetSend]);

  return (
    <AppContext.Provider
      value={{
        isAuthLoading,
        isLoggedIn,
        user,
        authError,
        login,
        logout,
        isInitialized,
        isDelegating,
        delegationStatus,
        balance,
        balanceLabel,
        isLoadingBalance,
        delegate,
        refreshBalance,
        activeRequest,
        isRequestLoading,
        clearActiveRequest,
        createPaymentRequest,
        sendStage,
        sendError,
        sendResultId,
        lastReceipt,
        paymentActivity,
        sendUSDC,
        resetSend,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

function extractTransactionHash(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const stack = [value as Record<string, unknown>];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const [key, candidate] of Object.entries(current)) {
      if (
        typeof candidate === "string" &&
        isTransactionHash(candidate) &&
        /hash|tx/i.test(key)
      ) {
        return candidate;
      }
      if (candidate && typeof candidate === "object") {
        stack.push(candidate as Record<string, unknown>);
      }
    }
  }

  return undefined;
}

function paymentRequestIdFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/pay\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function usablePublicEnv(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || /(placeholder|your_|replace_me|changeme)/i.test(trimmed)) return null;
  return trimmed;
}
