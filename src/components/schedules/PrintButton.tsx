"use client";
export function PrintButton() { return <button type="button" onClick={() => window.print()} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold print:hidden">Imprimir</button>; }
