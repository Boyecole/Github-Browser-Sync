import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/lib/db";

const CATEGORIES = [
  "Entertainment", "Software", "Productivity", "Cloud Storage",
  "Education", "Utilities", "Mobile", "Internet", "Memberships", "Other",
] as const;

const FREQUENCIES = ["monthly", "quarterly", "semi-annual", "annual"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const costRaw = typeof body.cost === "string" ? body.cost : (typeof body.cost === "number" ? body.cost : null);
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "USD";
  const billingFrequency = typeof body.billing_frequency === "string" ? body.billing_frequency.trim() : "";
  const renewalDate = typeof body.renewal_date === "string" ? body.renewal_date.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  // Validate required fields
  const errors: string[] = [];
  if (!name) errors.push("Name is required.");
  if (!category || !(CATEGORIES as readonly string[]).includes(category)) {
    errors.push(`Category must be one of: ${CATEGORIES.join(", ")}.`);
  }
  if (costRaw === null || costRaw === "" || isNaN(Number(costRaw)) || Number(costRaw) <= 0) {
    errors.push("Cost must be a positive number.");
  }
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    errors.push(`Currency must be one of: ${CURRENCIES.join(", ")}.`);
  }
  if (!billingFrequency || !(FREQUENCIES as readonly string[]).includes(billingFrequency)) {
    errors.push(`Billing frequency must be one of: ${FREQUENCIES.join(", ")}.`);
  }
  if (!renewalDate || isNaN(Date.parse(renewalDate + "T00:00:00"))) {
    errors.push("A valid renewal date is required.");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 422 });
  }

  const userId = parseInt(session.user.id, 10);
  const cost = parseFloat(String(costRaw));

  try {
    const [created] = await db
      .insert(schema.subscriptions)
      .values({
        user_id: userId,
        name,
        category,
        cost: cost.toFixed(2),
        currency,
        billing_frequency: billingFrequency,
        renewal_date: renewalDate,
        notes: notes || null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("Error creating subscription:", err);
    return NextResponse.json({ error: "Failed to create subscription." }, { status: 500 });
  }
}
