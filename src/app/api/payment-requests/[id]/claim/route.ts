import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/utils/supabaseServer";
import {
  rowToVerifiedRequest,
  type PaymentRequestRow,
} from "@/utils/linkpayRecords";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("claim_payment_request", {
      p_request_id: id,
    });

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
    }

    return NextResponse.json(rowToVerifiedRequest(data as PaymentRequestRow));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not claim payment request" },
      { status: 500 },
    );
  }
}
