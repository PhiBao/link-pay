import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/utils/supabaseServer";
import {
  rowToVerifiedRequest,
  type PaymentRequestRow,
  type PaymentRow,
} from "@/utils/linkpayRecords";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
    }

    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (paymentsError) throw paymentsError;

    return NextResponse.json(
      rowToVerifiedRequest(
        data as PaymentRequestRow,
        ((payments ?? []) as PaymentRow[])[0] ?? null,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load payment request" },
      { status: 500 },
    );
  }
}
