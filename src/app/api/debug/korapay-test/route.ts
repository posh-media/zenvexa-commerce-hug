import { NextResponse } from "next/server";
import { initializeKorapayTransaction, verifyKorapayTransaction } from "@/lib/server/korapay";
import { getKorapaySecretKey } from "@/lib/server/env";

export async function GET() {
  console.log("[KoraPayTest] Starting isolated KoraPay verification test");
  
  try {
    // Check if KoraPay is configured
    if (!getKorapaySecretKey()) {
      return NextResponse.json(
        { ok: false, reason: "KoraPay not configured" },
        { status: 500 }
      );
    }

    // Step 1: Initialize a test transaction
    const testOrderId = `test-${Date.now()}`;
    const testEmail = "test@example.com";
    const testAmount = 1000; // 1000 Naira
    const testReference = `TEST_${testOrderId}`;

    console.log("[KoraPayTest] Step 1: Initializing transaction", {
      orderId: testOrderId,
      email: testEmail,
      amount: testAmount,
      reference: testReference,
    });

    const initResult = await initializeKorapayTransaction({
      email: testEmail,
      amountNaira: testAmount,
      reference: testReference,
      redirectUrl: "http://localhost:3000/test",
      metadata: {
        orderId: testOrderId,
        customerName: "Test Customer",
      },
    });

    console.log("[KoraPayTest] Step 2: Initialization successful", {
      korapayReference: initResult.reference,
      checkoutUrl: initResult.checkout_url,
    });

    // Step 3: Verify the transaction using the exact reference from KoraPay
    console.log("[KoraPayTest] Step 3: Verifying transaction", {
      reference: initResult.reference,
    });

    const verifyResult = await verifyKorapayTransaction(initResult.reference);
    
    console.log("[KoraPayTest] Step 4: Verification successful", {
      status: verifyResult.status,
      amount: verifyResult.amount,
      currency: verifyResult.currency,
      reference: verifyResult.reference,
      metadata: verifyResult.metadata,
    });

    return NextResponse.json({
      ok: true,
      test: "KoraPay verification test",
      steps: {
        initialization: {
          reference: initResult.reference,
          checkoutUrl: initResult.checkout_url,
        },
        verification: {
          status: verifyResult.status,
          amount: verifyResult.amount,
          currency: verifyResult.currency,
          reference: verifyResult.reference,
          metadata: verifyResult.metadata,
        },
      },
    });
  } catch (error) {
    console.error("[KoraPayTest] Test failed", error);
    return NextResponse.json(
      {
        ok: false,
        reason: error instanceof Error ? error.message : "Unknown error",
        test: "KoraPay verification test failed",
      },
      { status: 500 }
    );
  }
}
