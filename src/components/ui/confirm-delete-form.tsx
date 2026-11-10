"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/types/action";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  // Teks tombol pertama dan nama objek untuk pertanyaan konfirmasi, mis. "Hapus paket" / "paket ini".
  label: string;
  subject: string;
};

// Hapus selalu dua langkah (RULES_FRONTEND §3): tombol pertama hanya membuka konfirmasi, tombol
// submit sebenarnya ada di dalam form (bukan link GET).
export function ConfirmDeleteForm({ action, id, label, subject }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {confirming ? (
        <div
          className="flex flex-wrap items-center gap-3"
          role="group"
          aria-label={`Konfirmasi ${label}`}
        >
          <p className="text-sm font-medium">
            Yakin menghapus {subject}? Tindakan ini tidak bisa dibatalkan.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-md bg-danger px-4 py-2 font-semibold text-canvas disabled:opacity-60"
          >
            {pending ? "Menghapus…" : "Ya, hapus"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-11 rounded-md border border-ink px-4 py-2 font-semibold"
          >
            Batal
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-11 rounded-md border border-danger px-4 py-2 font-semibold text-danger"
        >
          {label}
        </button>
      )}
      <div aria-live="polite">
        {state && !state.ok ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
