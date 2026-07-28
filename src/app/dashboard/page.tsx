import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { DeleteButton } from "@/components/DeleteButton";

// ─── helpers ────────────────────────────────────────────────────────────────

type BillingFrequency = "monthly" | "quarterly" | "semi-annual" | "annual";

interface SubscriptionRow {
  id: number;
  name: string;
  category: string;
  cost: string;
  currency: string;
  billing_frequency: string;
  renewal_date: string;
}

function toMonthly(cost: number, freq: BillingFrequency): number {
  switch (freq) {
    case "monthly":      return cost;
    case "quarterly":    return cost / 3;
    case "semi-annual":  return cost / 6;
    case "annual":       return cost / 12;
    default:             return cost;
  }
}

function toAnnual(cost: number, freq: BillingFrequency): number {
  switch (freq) {
    case "monthly":      return cost * 12;
    case "quarterly":    return cost * 4;
    case "semi-annual":  return cost * 2;
    case "annual":       return cost;
    default:             return cost;
  }
}

function daysFromNow(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function freqLabel(freq: string): string {
  switch (freq) {
    case "monthly":     return "Monthly";
    case "quarterly":   return "Quarterly";
    case "semi-annual": return "Semi-Annual";
    case "annual":      return "Annual";
    default:            return freq;
  }
}

// ─── icons ──────────────────────────────────────────────────────────────────

function IconMoney({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconEmpty({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}

// ─── summary card ───────────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon, accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "indigo" | "green" | "amber" | "rose";
}) {
  const borders: Record<string, string> = {
    indigo: "border-l-indigo-500", green: "border-l-green-500",
    amber: "border-l-amber-500",   rose: "border-l-rose-500",
  };
  const bgs: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600", green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borders[accent]} p-5`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgs[accent]}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ─── dashboard page (server component) ──────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { created?: string; updated?: string; deleted?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  let subscriptions: SubscriptionRow[] = [];
  let dbError = false;

  try {
    const rows = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.user_id, parseInt(session.user.id, 10)))
      .orderBy(schema.subscriptions.renewal_date);

    subscriptions = rows.map((r) => ({
      ...r,
      cost: String(r.cost),
      renewal_date:
        typeof r.renewal_date === "string"
          ? r.renewal_date
          : (r.renewal_date as unknown as Date).toISOString().slice(0, 10),
    }));
  } catch {
    dbError = true;
  }

  // calculations
  const activeCount = subscriptions.length;

  const monthlySpend = subscriptions.reduce(
    (sum, s) => sum + toMonthly(parseFloat(s.cost), s.billing_frequency as BillingFrequency), 0,
  );

  const annualSpend = subscriptions.reduce(
    (sum, s) => sum + toAnnual(parseFloat(s.cost), s.billing_frequency as BillingFrequency), 0,
  );

  const upcomingRenewalsAll = subscriptions
    .filter((s) => { const d = daysFromNow(s.renewal_date); return d >= 0 && d <= 30; })
    .sort((a, b) => daysFromNow(a.renewal_date) - daysFromNow(b.renewal_date));

  const upcomingCount = upcomingRenewalsAll.length;
  const next7Days = upcomingRenewalsAll.filter((s) => daysFromNow(s.renewal_date) <= 7);

  // success flash messages from query params
  const flashMessage =
    searchParams.created === "1" ? "Subscription added successfully!" :
    searchParams.updated === "1" ? "Subscription updated successfully!" :
    searchParams.deleted === "1" ? "Subscription deleted." :
    null;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-indigo-600">
              SubTrack
            </Link>
            <Link
              href="/dashboard/subscriptions/new"
              className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${
                activeCount >= 10
                  ? "bg-gray-400 cursor-not-allowed pointer-events-none opacity-60"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
              aria-disabled={activeCount >= 10}
              tabIndex={activeCount >= 10 ? -1 : undefined}
            >
              + Add Subscription
            </Link>
            {activeCount >= 10 && (
              <Link
                href="/dashboard/upgrade"
                className="inline-flex items-center rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Upgrade to add more
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{session.user.name}</span>
            <Link
              href="/api/auth/signout"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {session.user.name}!
        </h1>
        <p className="mt-1 text-gray-500">
          Here&apos;s your subscription overview.
        </p>

        {/* Success flash */}
        {flashMessage && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            ✓ {flashMessage}
          </div>
        )}

        {/* Summary Cards */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Monthly Spend" value={`$${monthlySpend.toFixed(2)}`}
            icon={<IconMoney className="w-5 h-5" />} accent="indigo" />
          <SummaryCard label="Annual Spend" value={`$${annualSpend.toFixed(2)}`}
            icon={<IconCalendar className="w-5 h-5" />} accent="green" />
          <SummaryCard label="Active Subscriptions" value={String(activeCount)}
            icon={<IconGrid className="w-5 h-5" />} accent="amber" />
          <SummaryCard label="Upcoming Renewals" value={String(upcomingCount)}
            icon={<IconClock className="w-5 h-5" />} accent="rose" />
        </div>

        {/* DB error banner */}
        {dbError && (
          <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
            ⚠️ Database not connected. Showing empty state. Add your{" "}
            <code className="bg-amber-100 px-1 rounded">DATABASE_URL</code> in{" "}
            <code className="bg-amber-100 px-1 rounded">.env.local</code> to see
            your subscriptions.
          </div>
        )}

        {/* Free tier usage indicator */}
        {!dbError && activeCount >= 7 && (
          <div className="mt-6">
            {activeCount < 10 ? (
              <div className="rounded-lg bg-white border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    You&apos;ve used {activeCount} of 10 free subscriptions
                  </p>
                  <span className="text-xs text-gray-500">
                    {10 - activeCount} remaining
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      activeCount >= 9 ? "bg-amber-500" : "bg-indigo-500"
                    }`}
                    style={{ width: `${(activeCount / 10) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  <Link
                    href="/dashboard/upgrade"
                    className="text-indigo-600 font-medium hover:underline"
                  >
                    Upgrade to Pro
                  </Link>{" "}
                  for unlimited subscriptions.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 border border-amber-300 p-5 text-center">
                <p className="text-amber-800 font-semibold">
                  You&apos;ve reached the free tier limit.
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Upgrade to Pro for unlimited subscriptions.
                </p>
                <Link
                  href="/dashboard/upgrade"
                  className="mt-3 inline-flex items-center rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  Upgrade to Pro
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!dbError && activeCount === 0 && (
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-10 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
              <IconEmpty className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              No subscriptions yet
            </h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              You haven&apos;t added any subscriptions. Start tracking your
              recurring expenses to see your spending at a glance.
            </p>
            <Link
              href="/dashboard/subscriptions/new"
              className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              + Add Subscription
            </Link>
          </div>
        )}

        {/* Subscription List Table */}
        {activeCount > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              All Subscriptions
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Responsive table wrapper */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Renewal</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">{sub.name}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {sub.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          ${parseFloat(sub.cost).toFixed(2)} <span className="text-gray-400 text-xs">{sub.currency}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {freqLabel(sub.billing_frequency)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(sub.renewal_date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/dashboard/subscriptions/${sub.id}/edit`}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                            >
                              Edit
                            </Link>
                            <DeleteButton id={sub.id} name={sub.name} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Renewals */}
        {activeCount > 0 && (
          <div className="mt-8">
            {next7Days.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Due in the next 7 days
                </h2>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {next7Days.map((sub) => (
                    <RenewalRow key={sub.id} sub={sub} />
                  ))}
                </div>
              </div>
            )}

            {upcomingRenewalsAll.length > next7Days.length && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Due in the next 30 days
                </h2>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {upcomingRenewalsAll
                    .filter((s) => daysFromNow(s.renewal_date) > 7)
                    .map((sub) => (
                      <RenewalRow key={sub.id} sub={sub} />
                    ))}
                </div>
              </div>
            )}

            {upcomingRenewalsAll.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-500">
                  No renewals due in the next 30 days.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── renewal list row ───────────────────────────────────────────────────────

function RenewalRow({ sub }: { sub: SubscriptionRow }) {
  const days = daysFromNow(sub.renewal_date);
  const label =
    days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;

  const urgency =
    days <= 3 ? "text-rose-600 bg-rose-50" : "text-amber-600 bg-amber-50";

  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 uppercase">
          {sub.name.slice(0, 2)}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{sub.name}</p>
          <p className="text-xs text-gray-500 capitalize">
            {sub.billing_frequency} · {sub.category}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <p className="text-sm font-semibold text-gray-900">
          ${parseFloat(sub.cost).toFixed(2)}
        </p>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${urgency}`}>
          {label}
        </span>
      </div>
    </div>
  );
}
