import { NextResponse, type NextRequest } from "next/server";
import { getAddress, id as hashText, isAddress } from "ethers";
import type { SignedPaymentRequest } from "@/utils/types";
import {
  buildPaymentRequestMessage,
  verifySignedPaymentRequest,
} from "@/utils/paymentRequest";
import { getAppBaseUrl, getSupabaseAdmin } from "@/utils/supabaseServer";
import {
  rowToActivityItem,
  type PaymentRequestRow,
  type PaymentRow,
} from "@/utils/linkpayRecords";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      request?: SignedPaymentRequest;
      recipientEmail?: string;
    };

    if (!body.request) {
      return NextResponse.json({ error: "Payment request is required" }, { status: 400 });
    }

    const verified = verifySignedPaymentRequest(body.request);
    if (verified.status !== "valid" || !verified.request) {
      return NextResponse.json(
        { error: verified.error || "Payment request is not valid" },
        { status: 400 },
      );
    }

    const payload = verified.request.payload;
    const requestHash = hashText(
      `${buildPaymentRequestMessage(payload)}\nsignature=${verified.request.signature}`,
    );
    const supabase = getSupabaseAdmin();

    const { data: existing, error: existingError } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("request_hash", requestHash)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      const existingRow = existing as PaymentRequestRow;
      return NextResponse.json({
        id: existingRow.id,
        request: verified.request,
        url: `${getAppBaseUrl().replace(/\/$/, "")}/pay/${existingRow.id}`,
      });
    }

    const { data, error } = await supabase
      .from("payment_requests")
      .insert({
        version: payload.version,
        kind: payload.kind,
        request_hash: requestHash,
        payload,
        signature: verified.request.signature,
        amount: payload.amount,
        memo: payload.memo,
        recipient_address: payload.recipientAddress,
        recipient_label: payload.recipientLabel,
        recipient_email: body.recipientEmail || null,
        chain_id: payload.chainId,
        token_address: payload.tokenAddress,
        token_symbol: payload.tokenSymbol,
        expires_at: new Date(payload.expiresAt).toISOString(),
      })
      .select("*")
      .single();

    if (error) throw error;

    const row = data as PaymentRequestRow;
    return NextResponse.json({
      id: row.id,
      request: verified.request,
      url: `${getAppBaseUrl().replace(/\/$/, "")}/pay/${row.id}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create payment request" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");
    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: "Valid wallet query is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: requests, error } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("recipient_address_lc", getAddress(wallet).toLowerCase())
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) throw error;

    const rows = (requests ?? []) as PaymentRequestRow[];
    const requestIds = rows.map((row) => row.id);
    let paymentsByRequest = new Map<string, PaymentRow>();

    if (requestIds.length > 0) {
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .in("request_id", requestIds)
        .order("created_at", { ascending: false });

      if (paymentsError) throw paymentsError;

      paymentsByRequest = new Map(
        ((payments ?? []) as PaymentRow[]).map((payment) => [
          payment.request_id,
          payment,
        ]),
      );
    }

    return NextResponse.json(
      rows.map((row) =>
        rowToActivityItem(row, getAppBaseUrl(), paymentsByRequest.get(row.id) ?? null),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load payment activity" },
      { status: 500 },
    );
  }
}
