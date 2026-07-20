import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

const CATEGORIES = [
  "Entertainment", "Software", "Productivity", "Cloud Storage",
  "Education", "Utilities", "Mobile", "Internet", "Memberships", "Other",
] as const;

const FREQUENCIES = ["monthly", "quarterly", "semi-annual", "annual"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;

async function getOwnedSubscription(userId: number, id: number) {
  const [sub] = await db
    .select()
    .from(schema.subscriptions)
    .where(
      and(
        eq(schema.subscriptions.id, id),
        eq(schema.subscriptions.user_id, userId),
      ),
    )
    .limit(1);
  return sub ?? null;
}

// GET /api/subscriptions/[id]
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid subscription ID" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);
  const sub = await getOwnedSubscription(userId, id);

  if (!sub) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  return NextResponse.json(sub);
}

// PUT /api/subscriptions/[id]
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid subscription ID" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);
  const existing = await getOwnedSubscription(userId, id);
  if (!existing) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const category = typeof body.category === "string" ? body.category.trim() : undefined;
  const costRaw = body.cost !== undefined ? body.cost : undefined;
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : undefined;
  const billingFrequency = typeof body.billing_frequency === "string" ? body.billing_frequency.trim() : undefined;
  const renewalDate = typeof body.renewal_date === "string" ? body.renewal_date.trim() : undefined;
  const notes = body.notes !== undefined ? (typeof body.notes === "string" ? body.notes.trim() : null) : undefined;

  const errors: string[] = [];

  if (name !== undefined && !name) errors.push("Name is required.");
  if (category !== undefined && !(CATEGORIES as readonly string[]).includes(category)) {
    errors.push(`Category must be one of: ${CATEGORIES.join(", ")}.`);
  }
  if (costRaw !== undefined && (costRaw === null || costRaw === "" || isNaN(Number(costRaw)) || Number(costRaw) <= 0)) {
    errors.push("Cost must be a positive number.");
  }
  if (currency !== undefined && !(CURRENCIES as readonly string[]).includes(currency)) {
    errors.push(`Currency must be one of: ${CURRENCIES.join(", ")}.`);
  }
  if (billingFrequency !== undefined && !(FREQUENCIES as readonly string[]).includes(billingFrequency)) {
    errors.push(`Billing frequency must be one of: ${FREQUENCIES.join(", ")}.`);
  }
  if (renewalDate !== undefined && (!renewalDate || isNaN(Date.parse(renewalDate + "T00:00:00")))) {
    errors.push("A valid renewal date is required.");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 422 });
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (category !== undefined) updates.category = category;
  if (costRaw !== undefined) updates.cost = parseFloat(String(costRaw)).toFixed(2);
  if (currency !== undefined) updates.currency = currency;
  if (billingFrequency !== undefined) updates.billing_frequency = billingFrequency;
  if (renewalDate !== undefined) updates.renewal_date = renewalDate;
  if (notes !== undefined) updates.notes = notes;
  updates.updated_at = new Date();

  try {
    const [updated] = await db
      .update(schema.subscriptions)
      .set(updates)
      .where(
        and(
          eq(schema.subscriptions.id, id),
          eq(schema.subscriptions.user_id, userId),
        ),
      )
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error updating subscription:", err);
    return NextResponse.json({ error: "Failed to update subscription." }, { status: 500 });
  }
}

// DELETE /api/subscriptions/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid subscription ID" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);
  const existing = await getOwnedSubscription(userId, id);
  if (!existing) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  try {
    await db
      .delete(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.id, id),
          eq(schema.subscriptions.user_id, userId),
        ),
      );

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Error deleting subscription:", err);
    return NextResponse.json({ error: "Failed to delete subscription." }, { status: 500 });
  }
}
