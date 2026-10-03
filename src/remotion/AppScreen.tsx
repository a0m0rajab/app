import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Screen } from "./types";

type Props = {
  screen: Screen;
  navItems: string[];
  productName: string;
  brandColor: string;
  activeNav: number;
};

// A mock SaaS app screen (sidebar, metric cards and a chart, table or board) that animates in.
export function AppScreen({ screen, navItems, productName, brandColor, activeNav }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appear = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 200 } });

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#ffffff", color: "#0f172a" }}>
      <aside style={{ width: 210, flexShrink: 0, padding: "26px 18px", background: "#f8fafc", borderRight: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: brandColor }} />
          <span style={{ fontSize: 20, fontWeight: 700 }}>{productName}</span>
        </div>
        {navItems.map((item, i) => (
          <div
            key={i}
            style={{
              padding: "10px 12px",
              marginBottom: 4,
              borderRadius: 8,
              fontSize: 16,
              fontWeight: i === activeNav ? 600 : 400,
              color: i === activeNav ? brandColor : "#64748b",
              background: i === activeNav ? `${brandColor}1a` : "transparent",
            }}
          >
            {item}
          </div>
        ))}
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: 30, display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ fontSize: 26, fontWeight: 700, opacity: appear(4) }}>{screen.title}</div>

        <div style={{ display: "flex", gap: 16 }}>
          {screen.metrics.map((m, i) => {
            const p = appear(8 + i * 5);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  padding: "16px 18px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  opacity: p,
                  transform: `translateY(${(1 - p) * 20}px)`,
                }}
              >
                <div style={{ fontSize: 14, color: "#64748b" }}>{m.label}</div>
                <div style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>{m.value}</div>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          {screen.kind === "chart" && <Chart values={screen.chart} brandColor={brandColor} appear={appear} />}
          {screen.kind === "table" && <Table rows={screen.rows} brandColor={brandColor} appear={appear} />}
          {screen.kind === "board" && <Board rows={screen.rows} brandColor={brandColor} appear={appear} />}
        </div>
      </main>
    </div>
  );
}

type Appear = (delay: number) => number;

function Chart({ values, brandColor, appear }: { values: number[]; brandColor: string; appear: Appear }) {
  const max = Math.max(...values, 1);
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "flex-end",
        gap: 18,
        padding: "20px 22px 0",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
      }}
    >
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / max) * 90 * appear(20 + i * 4)}%`,
            borderRadius: "8px 8px 0 0",
            background: `linear-gradient(180deg, ${brandColor}, ${brandColor}66)`,
          }}
        />
      ))}
    </div>
  );
}

function StatusPill({ status, brandColor }: { status: string; brandColor: string }) {
  const s = status.toLowerCase();
  const color = /risk|block|late|fail/.test(s) ? "#dc2626" : /done|complete|paid|live/.test(s) ? "#16a34a" : brandColor;
  return (
    <span style={{ fontSize: 13, fontWeight: 600, color, background: `${color}1a`, padding: "4px 10px", borderRadius: 999 }}>
      {status}
    </span>
  );
}

type Row = Screen["rows"][number];

function Table({ rows, brandColor, appear }: { rows: Row[]; brandColor: string; appear: Appear }) {
  return (
    <div style={{ borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
      {rows.map((row, i) => {
        const p = appear(20 + i * 6);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 20px",
              borderTop: i === 0 ? "none" : "1px solid #e2e8f0",
              opacity: p,
              transform: `translateX(${(1 - p) * 40}px)`,
            }}
          >
            <span style={{ flex: 1, fontSize: 17, fontWeight: 500 }}>{row.title}</span>
            <span style={{ fontSize: 15, color: "#64748b" }}>{row.meta}</span>
            <StatusPill status={row.status} brandColor={brandColor} />
          </div>
        );
      })}
    </div>
  );
}

function Board({ rows, brandColor, appear }: { rows: Row[]; brandColor: string; appear: Appear }) {
  const columns = [...new Set(rows.map((r) => r.status))].slice(0, 3);
  return (
    <div style={{ display: "flex", gap: 14, height: "100%" }}>
      {columns.map((column, c) => (
        <div key={column} style={{ flex: 1, minWidth: 0, padding: 14, borderRadius: 12, background: "#f1f5f9" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#475569", marginBottom: 12 }}>{column}</div>
          {rows
            .filter((r) => r.status === column)
            .map((row, i) => {
              const p = appear(20 + c * 8 + i * 6);
              return (
                <div
                  key={i}
                  style={{
                    padding: 14,
                    marginBottom: 10,
                    borderRadius: 10,
                    background: "#ffffff",
                    boxShadow: "0 1px 3px rgba(15,23,42,0.12)",
                    opacity: p,
                    transform: `translateY(${(1 - p) * 30}px)`,
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{row.title}</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: brandColor, fontWeight: 600 }}>{row.meta}</div>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

// Count up the numeric part of a value like "5,000+" or "99.9%".
export function countUp(value: string, progress: number) {
  const match = value.match(/^([^\d]*)([\d,.]+)(.*)$/);
  if (!match) return value;
  const [, prefix, num, suffix] = match;
  const target = Number(num.replace(/,/g, ""));
  if (!Number.isFinite(target)) return value;
  const decimals = num.includes(".") ? num.split(".")[1].length : 0;
  const current = interpolate(progress, [0, 1], [0, target]);
  const formatted = current.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: num.includes(","),
  });
  return `${prefix}${formatted}${suffix}`;
}
