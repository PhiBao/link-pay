import { NextResponse, type NextRequest } from "next/server";
import { Wallet, getAddress, JsonRpcProvider, type AuthorizationLike } from "ethers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const privateKey = process.env.RELAYER_PRIVATE_KEY;
    const rpcUrl =
      process.env.NEXT_PUBLIC_ARB_RPC_URL || "https://arb1.arbitrum.io/rpc";

    if (!privateKey) {
      return NextResponse.json(
        { error: "Relayer is not configured (RELAYER_PRIVATE_KEY missing)" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      userAddress?: string;
      authorization?: {
        contractAddress?: string;
        address?: string;
        chainId?: number | string;
        nonce?: number | string;
        v?: number | string;
        r?: string;
        s?: string;
      };
    };

    const { userAddress, authorization } = body;
    if (!userAddress || !authorization) {
      return NextResponse.json(
        { error: "userAddress and authorization are required" },
        { status: 400 },
      );
    }

    const contractAddress = authorization.contractAddress || authorization.address;
    if (!contractAddress) {
      return NextResponse.json(
        { error: "Authorization is missing the contract address" },
        { status: 400 },
      );
    }

    const auth: AuthorizationLike = {
      address: getAddress(contractAddress),
      chainId: authorization.chainId ?? 0,
      nonce: authorization.nonce ?? 0,
      signature: {
        r: authorization.r ?? "0x",
        s: authorization.s ?? "0x",
        v: Number(authorization.v ?? 0),
      },
    };

    const provider = new JsonRpcProvider(rpcUrl);
    const relayer = new Wallet(privateKey, provider);

    const tx = await relayer.sendTransaction({
      type: 4,
      to: getAddress(userAddress),
      data: "0x",
      authorizationList: [auth],
    });

    return NextResponse.json({ transactionHash: tx.hash });
  } catch (error) {
    console.error("[delegate] relay failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delegation relay failed" },
      { status: 500 },
    );
  }
}
