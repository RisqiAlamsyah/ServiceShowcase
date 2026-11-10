"use client";

import { useEffect, type RefObject } from "react";

// Memindahkan fokus ke kolom bermasalah pertama setelah submit gagal (aksesibilitas form).
export function useFocusFirstError(
  failed: boolean,
  state: unknown,
  formRef: RefObject<HTMLFormElement | null>,
): void {
  useEffect(() => {
    if (!failed) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [failed, state, formRef]);
}
