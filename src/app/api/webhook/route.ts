import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const prisma = new PrismaClient();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    if (!stripe) {
      throw new Error("Stripe is not configured.");
    }
    if (!endpointSecret) {
      console.warn("⚠️  STRIPE_WEBHOOK_SECRET is NOT set. Skipping signature verification in dev mode.");
      event = JSON.parse(body);
    } else {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    }
  } catch (err: any) {
    console.error(`❌ Webhook error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    if (userId) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { credits: 9999 } // Giving "Unlimited" credits
        });
        console.log(`✅ User ${userId} upgraded to Unlimited Credits.`);
      } catch (error) {
        console.error("❌ Failed to update user credits:", error);
      }
    }
  }

  return NextResponse.json({ received: true });
}
