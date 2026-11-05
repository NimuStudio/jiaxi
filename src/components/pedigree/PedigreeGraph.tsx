"use client";

import type { ExtractedPerson } from "@/lib/extract/client";
import {
  CANVAS,
  DISEASE_LABEL,
  EDGES,
  RELATION_LABEL,
  SLOTS,
  isMale,
  type Slot,
} from "@/lib/pedigree/viz";
import type { RelationType } from "@/lib/pedigree/types";

export interface PedigreeGraphProps {
  persons: ExtractedPerson[];
  /** 刚刚新增的节点，用于播放「长出来」的动画。 */
  highlight?: string | null;
  /** 当前选中的节点（点开看依据 / 修改）。 */
  selected?: string | null;
  onSelect?: (relation: string) => void;
}

const NODE_SIZE = 38;
const HALF = NODE_SIZE / 2;

/** 正交连线：先竖直、再横向、再竖直，符合临床家系图画法。 */
function orthPath(from: Slot, to: Slot): string {
  if (Math.abs(from.y - to.y) < 1) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
  const midY = (from.y + to.y) / 2;
  return [
    `M ${from.x} ${from.y + HALF}`,
    `L ${from.x} ${midY}`,
    `L ${to.x} ${midY}`,
    `L ${to.x} ${to.y - HALF}`,
  ].join(" ");
}

/**
 * 同胞连线：走节点**上方**，避免横穿同一排中间的其他节点
 * （父亲与舅舅之间隔着母亲，若走水平线会穿过母亲的节点）。
 */
function siblingPath(from: Slot, to: Slot): string {
  const y = Math.min(from.y, to.y) - HALF - 16;
  return [
    `M ${from.x} ${from.y - HALF}`,
    `L ${from.x} ${y}`,
    `L ${to.x} ${y}`,
    `L ${to.x} ${to.y - HALF}`,
  ].join(" ");
}

function labelFor(relation: string): string {
  return RELATION_LABEL[relation as RelationType] ?? relation;
}

function diseaseText(person: ExtractedPerson): string {
  const names = person.conditions
    .map((c) => DISEASE_LABEL[c.code] ?? c.code)
    .filter(Boolean);
  if (names.length === 0) return "未记录";
  return names.join("、");
}

export function PedigreeGraph({
  persons,
  highlight,
  selected,
  onSelect,
}: PedigreeGraphProps) {
  const byRelation = new Map<string, ExtractedPerson>();
  for (const p of persons) byRelation.set(p.relation, p);

  const has = (r: RelationType) => byRelation.has(r);
  const hasFather = has("father");
  const hasMother = has("mother");

  /**
   * 同胞连线：旁系亲属（伯叔姑舅姨）正常情况下通过祖辈连接。
   * 但用户常常只说「我舅舅」，不说外公外婆——这时如果严格按标准画法，
   * 舅舅就成了一个悬空的孤点。所以祖辈缺失时，改为直接连到同胞（父母）。
   */
  const siblingLinks: Array<readonly [RelationType, RelationType]> = [];
  const paternalAncestorMissing =
    !has("paternal-grandfather") && !has("paternal-grandmother");
  const maternalAncestorMissing =
    !has("maternal-grandfather") && !has("maternal-grandmother");

  if (paternalAncestorMissing && hasFather) {
    if (has("paternal-uncle")) siblingLinks.push(["father", "paternal-uncle"]);
    if (has("paternal-aunt")) siblingLinks.push(["father", "paternal-aunt"]);
  }
  if (maternalAncestorMissing && hasMother) {
    if (has("maternal-uncle")) siblingLinks.push(["mother", "maternal-uncle"]);
    if (has("maternal-aunt")) siblingLinks.push(["mother", "maternal-aunt"]);
  }

  /** 祖辈婚配线：两人都在时连接，更符合临床家系图的读法。 */
  const coupleLines: ReadonlyArray<readonly [RelationType, RelationType]> = [
    ["paternal-grandfather", "paternal-grandmother"],
    ["maternal-grandfather", "maternal-grandmother"],
  ];

  return (
    <svg
      className="pedigree-canvas"
      viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
      role="group"
      aria-label="家系图（每个节点都可聚焦，回车查看依据）"
    >
      {/* 连线先画，节点后画，避免线压在节点上 */}
      <g className="pedigree-edges">
        {EDGES.map(([fromRel, toRel]) => {
          const from = SLOTS[fromRel];
          const to = SLOTS[toRel];
          if (!from || !to) return null;
          if (!byRelation.has(fromRel) || !byRelation.has(toRel)) return null;
          return (
            <path
              key={`${fromRel}-${toRel}`}
              d={orthPath(from, to)}
              fill="none"
              stroke="#B9CFE0"
              strokeWidth={1.4}
            />
          );
        })}

        {/* 婚配线：父母之间的横线 */}
        {hasFather && hasMother && SLOTS.father && SLOTS.mother && (
          <line
            x1={SLOTS.father.x + HALF}
            y1={SLOTS.father.y}
            x2={SLOTS.mother.x - HALF}
            y2={SLOTS.mother.y}
            stroke="#B9CFE0"
            strokeWidth={1.4}
          />
        )}

        {/* 祖辈婚配线 */}
        {coupleLines.map(([a, b]) => {
          const from = SLOTS[a];
          const to = SLOTS[b];
          if (!from || !to || !has(a) || !has(b)) return null;
          return (
            <line
              key={`couple-${a}-${b}`}
              x1={from.x + HALF}
              y1={from.y}
              x2={to.x - HALF}
              y2={to.y}
              stroke="#B9CFE0"
              strokeWidth={1.4}
            />
          );
        })}

        {/* 旁系同胞线（祖辈缺失时的兜底连接） */}
        {siblingLinks.map(([a, b]) => {
          const from = SLOTS[a];
          const to = SLOTS[b];
          if (!from || !to) return null;
          return (
            <path
              key={`sib-${a}-${b}`}
              d={siblingPath(from, to)}
              fill="none"
              stroke="#B9CFE0"
              strokeWidth={1.4}
              strokeDasharray="4 3"
            />
          );
        })}
      </g>

      {Array.from(byRelation.values()).map((person) => {
        const slot = SLOTS[person.relation as RelationType];
        if (!slot) return null;

        const affected = person.conditions.length > 0;
        const male = isMale(person.sex);
        const isNew = highlight === person.relation;

        return (
          <g
            key={person.relation}
            className={`pedigree-node${isNew ? " is-new" : ""}${
              selected === person.relation ? " is-selected" : ""
            }`}
            onClick={() => onSelect?.(person.relation)}
            style={{ cursor: onSelect ? "pointer" : "default" }}
            role="button"
            tabIndex={0}
            aria-label={`${RELATION_LABEL[person.relation as RelationType] ?? person.relation}：${
              person.conditions.length > 0
                ? person.conditions.map((c) => DISEASE_LABEL[c.code] ?? c.code).join("、")
                : "无记录"
            }`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(person.relation);
              }
            }}
          >
            {male ? (
              <rect
                x={slot.x - HALF}
                y={slot.y - HALF}
                width={NODE_SIZE}
                height={NODE_SIZE}
                rx={7}
                className={affected ? "node-shape affected" : "node-shape"}
              />
            ) : (
              <circle
                cx={slot.x}
                cy={slot.y}
                r={HALF}
                className={affected ? "node-shape affected" : "node-shape"}
              />
            )}

            <text
              x={slot.x}
              y={slot.y + HALF + 16}
              textAnchor="middle"
              className="node-label"
            >
              {labelFor(person.relation)}
            </text>
            <text
              x={slot.x}
              y={slot.y + HALF + 31}
              textAnchor="middle"
              className={affected ? "node-disease" : "node-disease is-empty"}
            >
              {diseaseText(person)}
            </text>
          </g>
        );
      })}

      {persons.length === 0 && (
        <text
          x={CANVAS.width / 2}
          y={CANVAS.height / 2}
          textAnchor="middle"
          className="canvas-empty"
        >
          还没有信息。在左边说说家里人的情况，这张图会长出来。
        </text>
      )}
    </svg>
  );
}
