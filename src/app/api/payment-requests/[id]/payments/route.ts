import { NextResponse } from "next/server";
import { getAddress, isAddress } from "ethers";
import { getAppBaseUrl, getSupabaseAdmin } from "@/utils/supabaseServer";
import {
  rowToReceipt,
  rowToVerifiedRequest,
  type PaymentRequestRow,
  type PaymentRow,
} from "@/utils/linkpayRecords";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      amount?: string;
      payerAddress?: string;
      payerEmail?: string;
      transactionId?: string;
      transactionHash?: string;
      rawResult?: unknown;
    };

    if (!body.amount || !body.transactionId) {
      return NextResponse.json(
        { error: "Amount and transaction id are required" },
        { status: 400 },
      );
    }

    const payerAddress =
      body.payerAddress && isAddress(body.payerAddress)
        ? getAddress(body.payerAddress)
        : "";

    const supabase = getSupabaseAdmin();
    const { data: payment, error } = await supabase.rpc("record_payment_submission", {
      p_request_id: id,
      p_amount: body.amount,
      p_payer_address: payerAddress,
      p_payer_email: body.payerEmail || "",
      p_transaction_id: body.transactionId,
      p_transaction_hash: body.transactionHash || "",
      p_raw_result: sanitizeJson(body.rawResult),
    });

    if (error) throw error;

    const { data: requestRow, error: requestError } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (requestError) throw requestError;

    const typedRequest = requestRow as PaymentRequestRow;
    const typedPayment = payment as PaymentRow;
    const receipt = rowToReceipt(typedPayment, typedRequest);

    await createRecipientNotification(typedRequest, receipt);

    return NextResponse.json({
      receipt,
      request: rowToVerifiedRequest(typedRequest, typedPayment),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not record payment" },
      { status: 500 },
    );
  }
}

function sanitizeJson(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

async function createRecipientNotification(
  request: PaymentRequestRow,
  receipt: ReturnType<typeof rowToReceipt>,
) {
  const supabase = getSupabaseAdmin();
  const recipientEmail = request.recipient_email;
  const subject = `LinkPay payment received: $${Number(receipt.amount).toFixed(2)} USDC`;
  const message = `${receipt.payerEmail || "Someone"} paid ${request.recipient_label} for "${receipt.memo}". View the request at ${getAppBaseUrl().replace(/\/$/, "")}/pay/${request.id}.`;

  if (!recipientEmail || !process.env.RESEND_API_KEY) {
    await supabase.from("notifications").insert({
      request_id: request.id,
      payment_id: receipt.id,
      recipient_email: recipientEmail,
      recipient_address: request.recipient_address,
      status: "skipped",
      subject,
      message,
      error: recipientEmail ? "RESEND_API_KEY not configured" : "Recipient email missing",
    });
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFICATION_FROM_EMAIL || "LinkPay <onboarding@resend.dev>",
        to: recipientEmail,
        subject,
        text: message,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    await supabase.from("notifications").insert({
      request_id: request.id,
      payment_id: receipt.id,
      recipient_email: recipientEmail,
      recipient_address: request.recipient_address,
      status: "sent",
      subject,
      message,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    await supabase.from("notifications").insert({
      request_id: request.id,
      payment_id: receipt.id,
      recipient_email: recipientEmail,
      recipient_address: request.recipient_address,
      status: "failed",
      subject,
      message,
      error: error instanceof Error ? error.message : "Email failed",
    });
  }
}
