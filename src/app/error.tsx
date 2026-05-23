"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#F2EAD8] px-6 text-center text-[#0F1310]">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C28840]">
        Ty&apos;s Table
      </p>
      <h1 className="mt-4 max-w-md font-serif text-2xl font-normal italic leading-snug">
        Something slipped in the kitchen.
      </h1>
      <p className="mt-3 max-w-sm font-sans text-sm text-[#0F1310]/70">
        An unexpected error occurred. Your saved data is safe — let&apos;s try
        that again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-[#0F1310] px-6 py-3 font-sans text-sm font-semibold text-[#F2EAD8] transition-colors duration-200 hover:bg-[#C28840]"
      >
        Try again
      </button>
    </div>
  );
}
