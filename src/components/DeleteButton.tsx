"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DeleteButtonProps {
  id: number;
  name: string;
}

export function DeleteButton({ id, name }: DeleteButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard?deleted=1");
        router.refresh();
      } else {
        // Try to get error from response
        const data = await res.json().catch(() => ({ error: "Failed to delete." }));
        alert(data.error || "Failed to delete subscription.");
        setConfirming(false);
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return confirming ? (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs text-rose-600">Delete &quot;{name}&quot;?</span>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs font-medium text-rose-600 hover:text-rose-800 disabled:opacity-50"
      >
        {deleting ? "..." : "Yes"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={deleting}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        No
      </button>
    </span>
  ) : (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs font-medium text-rose-600 hover:text-rose-800"
    >
      Delete
    </button>
  );
}
