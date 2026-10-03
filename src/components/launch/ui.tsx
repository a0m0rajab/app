import type { ButtonHTMLAttributes, ReactNode } from "react";

// Shared pieces of the launch flow, styled after the Reelsmith design in Paper.

export function Eyebrow({ children, muted = false, className = "" }: { children: ReactNode; muted?: boolean; className?: string }) {
  return (
    <div className={`text-xs/4 font-semibold uppercase tracking-[0.14em] ${muted ? "text-muted" : "text-ink"} ${className}`}>
      {children}
    </div>
  );
}

export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2.5">
      <Eyebrow muted>{label}</Eyebrow>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3.5 py-2.25 text-sm/4.5 font-semibold transition-colors ${
              o.value === value ? "border border-ink bg-ink text-white" : "border border-edge hover:border-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex h-14 items-center justify-center gap-3 rounded-xl border-[1.5px] border-ink bg-sun px-7 text-[17px]/5.5 font-extrabold tracking-[-0.01em] text-ink shadow-[4px_4px_0_0_#0E0E0E] transition-[translate,box-shadow] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_#0E0E0E] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex h-12 items-center justify-center rounded-xl border border-edge px-4 text-[15px]/4.5 font-semibold hover:border-ink disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="rounded-[10px] border border-red-500/40 bg-red-50 p-3 text-sm text-red-700">{children}</p>;
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const ArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <path d="M5 12h14" {...stroke} />
    <path d="M13 5l7 7-7 7" {...stroke} />
  </svg>
);

export const ArrowUp = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 19V5" {...stroke} />
    <path d="M5 12l7-7 7 7" {...stroke} />
  </svg>
);

export const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 4v12" {...stroke} />
    <path d="M6 11l6 6 6-6" {...stroke} />
    <path d="M5 20h14" {...stroke} />
  </svg>
);

export type Preset = { id: string; label: string; meta: string };

// One-click bundles of settings, shown as a row of cards.
export function PresetPicker({ presets, activeId, onSelect }: { presets: readonly Preset[]; activeId?: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <Eyebrow>Presets</Eyebrow>
        <span className="text-[13px]/4 text-muted">One click sets everything below</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {presets.map((p) => {
          const active = p.id === activeId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              aria-pressed={active}
              className={`flex min-w-36 flex-1 flex-col gap-1.5 rounded-[10px] p-3 text-left transition-colors ${
                active ? "border-[1.5px] border-ink bg-sun" : "border border-line bg-paper hover:border-ink"
              }`}
            >
              <span className="text-sm/4.5 font-bold">{p.label}</span>
              <span className={`font-mono text-xs/4 ${active ? "text-ink" : "text-muted"}`}>{p.meta}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
