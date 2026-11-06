"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-quiet print:hidden">
      Print QR card
    </button>
  );
}
