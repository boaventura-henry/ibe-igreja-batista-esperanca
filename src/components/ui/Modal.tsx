"use client";

import { useId, type ReactNode } from "react";

type ModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: "md" | "lg";
};

const sizeClass = {
  md: "max-w-xl",
  lg: "max-w-3xl"
} as const;

export function Modal({ title, children, onClose, size = "md" }: ModalProps) {
  const titleId = useId();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/30 p-3 sm:p-4">
      <section aria-labelledby={titleId} aria-modal="true" role="dialog" className={`mx-auto my-3 flex max-h-[calc(100dvh-1.5rem)] w-full ${sizeClass[size]} flex-col overflow-hidden rounded-md bg-white shadow-xl sm:my-6 sm:max-h-[calc(100dvh-3rem)]`}>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hope-100 px-4 py-3 sm:px-5">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="font-bold text-ink-600">Fechar</button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
      </section>
    </div>
  );
}
