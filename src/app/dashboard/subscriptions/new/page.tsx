import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import NewSubscriptionForm from "@/components/NewSubscriptionForm";

export default async function NewSubscriptionPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const userId = parseInt(session.user.id, 10);

  let atLimit = false;
  let subCount = 0;

  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.user_id, userId));

    subCount = result[0].count;
    atLimit = subCount >= 10;
  } catch {
    // If DB is down, let the user try anyway — the API will also enforce the limit
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
            SubTrack
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Add Subscription</h1>
        <p className="mt-1 text-gray-500">
          Track a new recurring expense.
        </p>

        {atLimit ? (
          <div className="mt-6 rounded-xl bg-amber-50 border border-amber-300 p-8 text-center">
            <p className="text-amber-800 font-semibold text-lg">
              Free tier limit reached
            </p>
            <p className="text-sm text-amber-700 mt-2 max-w-sm mx-auto">
              You&apos;ve reached the 10 subscription limit. Upgrade to Pro for
              unlimited subscriptions.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href="/dashboard/upgrade"
                className="inline-flex items-center rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Upgrade to Pro
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <NewSubscriptionForm />
        )}
      </div>
    </main>
  );
}
