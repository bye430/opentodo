import { useCallback, useEffect, useRef, useState } from "react";

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_FACE = 108;
const R_INNER_LABEL = 48;
const R_OUTER_LABEL = 86;
const R_HAND_SHORT = 38;
const R_HAND_LONG = 80;
/** 径向滑动过此半径切换上午/下午指针 */
const R_HAND_SWITCH = 62;
const SWITCH_HYST = 10;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(":").map(Number);
  return {
    hour: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9,
    minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  };
}

function hmFromParts(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

function pos(deg: number, radius: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return {
    x: CX + radius * Math.cos(rad),
    y: CY + radius * Math.sin(rad),
  };
}

/** 指针末端箭头（指向表盘外缘） */
function arrowHeadPath(deg: number, tipRadius: number, size: number): string {
  const tip = pos(deg, tipRadius);
  const rad = ((deg - 90) * Math.PI) / 180;
  const back = size * 1.1;
  const wing = size * 0.62;
  const bx = tip.x - back * Math.cos(rad);
  const by = tip.y - back * Math.sin(rad);
  const lx = bx + wing * Math.cos(rad + Math.PI / 2);
  const ly = by + wing * Math.sin(rad + Math.PI / 2);
  const rx = bx + wing * Math.cos(rad - Math.PI / 2);
  const ry = by + wing * Math.sin(rad - Math.PI / 2);
  return `M ${tip.x} ${tip.y} L ${lx} ${ly} L ${rx} ${ry} Z`;
}

function polarFromPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { deg: number; radius: number } {
  const x = clientX - rect.left - CX;
  const y = clientY - rect.top - CY;
  let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
  if (deg < 0) deg += 360;
  return { deg, radius: Math.hypot(x, y) };
}

function h12ToDeg(h12: number): number {
  return (h12 % 12) * 30;
}

function minuteToDeg(m: number): number {
  return m * 6;
}

function degToH12(deg: number): number {
  const h = Math.round(deg / 30) % 12;
  return h === 0 ? 12 : h;
}

function degToMinute(deg: number): number {
  return Math.round(deg / 6) % 60;
}

function to24Hour(h12: number, pm: boolean): number {
  if (h12 === 12) return pm ? 12 : 0;
  return pm ? h12 + 12 : h12;
}

function from24Hour(hour: number): { h12: number; pm: boolean } {
  const pm = hour >= 12;
  const h12 = hour % 12 || 12;
  return { h12, pm };
}

const H12_LABELS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

type Mode = "hour" | "minute";
type DragHand = "am" | "pm";

type Props = {
  value: string;
  onChange: (hm: string) => void;
};

export function ClockTimePicker({ value, onChange }: Props) {
  const { hour, minute } = parseHm(value || "09:00");
  const { h12, pm } = from24Hour(hour);
  const [mode, setMode] = useState<Mode>("hour");
  const [activeHand, setActiveHand] = useState<DragHand>(pm ? "pm" : "am");
  const dragging = useRef(false);
  const dragHand = useRef<DragHand>(pm ? "pm" : "am");
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const hand: DragHand = pm ? "pm" : "am";
    dragHand.current = hand;
    setActiveHand(hand);
  }, [pm]);

  const setHour24 = (h: number) => {
    onChange(hmFromParts(h, minute));
  };

  const applyHandFromRadius = useCallback((radius: number) => {
    let hand: DragHand = dragHand.current;
    if (radius < R_HAND_SWITCH - SWITCH_HYST) {
      hand = "am";
    } else if (radius > R_HAND_SWITCH + SWITCH_HYST) {
      hand = "pm";
    }
    if (hand !== dragHand.current) {
      dragHand.current = hand;
      setActiveHand(hand);
    }
  }, []);

  const applyHourAtDeg = useCallback(
    (deg: number, hand: DragHand) => {
      onChange(hmFromParts(to24Hour(degToH12(deg), hand === "pm"), minute));
    },
    [minute, onChange],
  );

  const pickFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const { deg, radius } = polarFromPoint(clientX, clientY, rect);
      if (mode === "hour") {
        applyHandFromRadius(radius);
        applyHourAtDeg(deg, dragHand.current);
      } else {
        onChange(hmFromParts(hour, degToMinute(deg)));
      }
    },
    [mode, hour, applyHandFromRadius, applyHourAtDeg, onChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const svg = svgRef.current;
    if (svg && mode === "hour") {
      const { radius } = polarFromPoint(
        e.clientX,
        e.clientY,
        svg.getBoundingClientRect(),
      );
      const hand: DragHand = radius < R_HAND_SWITCH ? "am" : "pm";
      dragHand.current = hand;
      setActiveHand(hand);
    }
    pickFromEvent(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    pickFromEvent(e.clientX, e.clientY);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const hourDeg = h12ToDeg(h12);
  const shortEnd = pos(hourDeg, R_HAND_SHORT);
  const longEnd = pos(hourDeg, R_HAND_LONG);
  const minDeg = minuteToDeg(minute);
  const minEnd = pos(minDeg, R_HAND_LONG);

  const minuteLabels = Array.from({ length: 12 }, (_, i) => i * 5);
  const isAmActive = activeHand === "am";

  return (
    <div className="flex flex-col items-center py-1">
      <div className="mb-2 flex rounded-lg border border-border/80 bg-surface/80 p-0.5">
        <button
          type="button"
          className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
            mode === "hour"
              ? "bg-[rgb(var(--accent))] text-white shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMode("hour")}
        >
          小时
        </button>
        <button
          type="button"
          className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
            mode === "minute"
              ? "bg-[rgb(var(--accent))] text-white shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMode("minute")}
        >
          分钟
        </button>
      </div>

      <div
        className="relative touch-none select-none"
        style={{ width: SIZE, height: SIZE }}
      >
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[2rem] font-bold tabular-nums leading-none text-foreground">
            {pad(hour)}
            <span className="text-muted/80">:</span>
            {pad(minute)}
          </span>
        </div>

        <svg
          ref={svgRef}
          width={SIZE}
          height={SIZE}
          className="cursor-pointer"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label="钟表选择时间"
        >
          <circle
            cx={CX}
            cy={CY}
            r={R_FACE}
            fill="rgb(var(--accent) / 0.04)"
            stroke="rgb(var(--accent) / 0.2)"
            strokeWidth={1.5}
          />

          {mode === "hour" ? (
            <>
              <circle
                cx={CX}
                cy={CY}
                r={R_INNER_LABEL}
                fill="none"
                stroke="rgb(var(--accent) / 0.15)"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
              <circle
                cx={CX}
                cy={CY}
                r={R_HAND_SWITCH}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.5}
                strokeDasharray="2 3"
                className="text-border/50"
              />
            </>
          ) : null}

          {Array.from({ length: 60 }, (_, i) => {
            const deg = i * 6;
            const tickR = mode === "hour" ? R_FACE : R_FACE;
            const a = pos(deg, tickR - (i % 5 === 0 ? 10 : 5));
            const b = pos(deg, tickR);
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="currentColor"
                strokeWidth={i % 5 === 0 ? 1.2 : 0.5}
                className="text-border/70"
              />
            );
          })}

          {mode === "hour" ? (
            <>
              {isAmActive ? (
                <>
                  <line
                    x1={CX}
                    y1={CY}
                    x2={shortEnd.x}
                    y2={shortEnd.y}
                    stroke="rgb(var(--accent))"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                  />
                  <path
                    d={arrowHeadPath(hourDeg, R_HAND_SHORT, 11)}
                    fill="rgb(var(--accent))"
                  />
                </>
              ) : (
                <>
                  <line
                    x1={CX}
                    y1={CY}
                    x2={longEnd.x}
                    y2={longEnd.y}
                    stroke="rgb(var(--accent))"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                  />
                  <path
                    d={arrowHeadPath(hourDeg, R_HAND_LONG, 11)}
                    fill="rgb(var(--accent))"
                  />
                </>
              )}
            </>
          ) : (
            <>
              <line
                x1={CX}
                y1={CY}
                x2={minEnd.x}
                y2={minEnd.y}
                stroke="rgb(var(--accent))"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              <path
                d={arrowHeadPath(minDeg, R_HAND_LONG, 11)}
                fill="rgb(var(--accent))"
              />
            </>
          )}
          <circle cx={CX} cy={CY} r={5} fill="rgb(var(--accent))" />

          {mode === "hour"
            ? H12_LABELS.flatMap((n) => {
                const deg = h12ToDeg(n === 12 ? 0 : n);
                const inner = pos(deg, R_INNER_LABEL);
                const outer = pos(deg, R_OUTER_LABEL);
                const innerActive = !pm && h12 === n;
                const outerActive = pm && h12 === n;
                const am24 = to24Hour(n, false);
                const pm24 = to24Hour(n, true);
                return [
                  <g
                    key={`am-${n}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      dragHand.current = "am";
                      setActiveHand("am");
                      setHour24(am24);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <text
                      x={inner.x}
                      y={inner.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={innerActive ? 13 : 12}
                      fontWeight={innerActive ? 800 : 600}
                      fill={innerActive ? "rgb(var(--accent))" : "currentColor"}
                      className={innerActive ? "" : "text-foreground/75"}
                    >
                      {am24}
                    </text>
                  </g>,
                  <g
                    key={`pm-${n}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      dragHand.current = "pm";
                      setActiveHand("pm");
                      setHour24(pm24);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <text
                      x={outer.x}
                      y={outer.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={outerActive ? 13 : 12}
                      fontWeight={outerActive ? 800 : 600}
                      fill={outerActive ? "rgb(var(--accent))" : "currentColor"}
                      className={outerActive ? "" : "text-foreground/85"}
                    >
                      {pm24}
                    </text>
                  </g>,
                ];
              })
            : minuteLabels.map((n) => {
                const deg = minuteToDeg(n);
                const { x, y } = pos(deg, R_OUTER_LABEL);
                const active = minute === n;
                return (
                  <g
                    key={`min-${n}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(hmFromParts(hour, n));
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={active ? 13 : 12}
                      fontWeight={active ? 800 : 600}
                      fill={active ? "rgb(var(--accent))" : "currentColor"}
                      className={active ? "" : "text-foreground/90"}
                    >
                      {pad(n)}
                    </text>
                  </g>
                );
              })}
        </svg>
      </div>
    </div>
  );
}
