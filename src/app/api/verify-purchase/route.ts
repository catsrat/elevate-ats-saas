import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "No session ID provided" }, { status: 400 });
    }

    // Retrieve the checkout session from Stripe to verify payment
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      // Verify the userId matches the session metadata
      const sessionUserId = session.metadata?.userId;
      if (sessionUserId && sessionUserId !== userId) {
        return NextResponse.json({ error: "Session does not belong to this user" }, { status: 403 });
      }

      // Update credits
      await prisma.user.update({
        where: { id: userId },
        data: { credits: 9999 },
      });

      console.log(`✅ Purchase verified and credits granted to user ${userId}`);
      return NextResponse.json({ success: true, credits: 9999 });
    }

    return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
  } catch (error: any) {
    console.error("Verify Purchase Error:", error?.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
