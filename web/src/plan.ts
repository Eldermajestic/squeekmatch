import type { Order, Squeek } from "./api";

export type Counts = number[];

export function countByLevel(squeeks: Squeek[], max: number): Counts {
  const c = Array(max + 1).fill(0);
  for (const s of squeeks) if (s.level >= 1 && s.level <= max) c[s.level]++;
  return c;
}

export function cascade(counts: Counts, max: number) {
  const c = [...counts];
  let merges = 0;
  for (let l = 1; l < max; l++) {
    const pairs = Math.floor(c[l] / 2);
    merges += pairs;
    c[l] -= pairs * 2;
    c[l + 1] += pairs;
  }
  return { merges, counts: c };
}

export const power = (counts: Counts, base: number[]) => counts.reduce((p, n, l) => (l ? p + n * (base[l - 1] ?? 0) : p), 0);

export const pairGain = (level: number, base: number[]) => (base[level] ?? 0) - 2 * (base[level - 1] ?? 0);

export type PlanStep = { order: Order; level: number; price: bigint };
export type Plan = { steps: PlanStep[]; cost: bigint; merges: number; powerBefore: number; powerAfter: number; finalCounts: Counts };

export function bestPlans(counts: Counts, asks: Order[], max: number, base: number[], maxBuys = 5): Plan[] {
  const book = new Map<number, Order[]>();
  for (const a of asks) {
    const list = book.get(a.level) ?? [];
    list.push(a);
    book.set(a.level, list);
  }
  for (const list of book.values()) list.sort((x, y) => (BigInt(x.price!) < BigInt(y.price!) ? -1 : 1));
  const start = cascade(counts, max);
  const powerBefore = power(start.counts, base);
  const plans: Plan[] = [];
  for (let target = 1; target < max; target++) {
    const used = new Map<number, number>();
    const steps: PlanStep[] = [];
    let c = [...counts];
    let cost = 0n;
    for (let i = 0; i < maxBuys; i++) {
      let best: { level: number; order: Order; gain: number } | null = null;
      for (let l = 1; l <= target; l++) {
        const list = book.get(l) ?? [];
        const order = list[used.get(l) ?? 0];
        if (!order) continue;
        const next = [...c];
        next[l]++;
        const before = cascade(c, max);
        const after = cascade(next, max);
        const reached = after.counts.slice(target).reduce((a, b) => a + b, 0) > before.counts.slice(target).reduce((a, b) => a + b, 0);
        const gain = power(after.counts, base) - power(before.counts, base) - (base[l - 1] ?? 0) + (reached ? 1e9 : 0);
        if (after.merges > before.merges && (!best || gain > best.gain)) best = { level: l, order, gain };
      }
      if (!best) break;
      steps.push({ order: best.order, level: best.level, price: BigInt(best.order.price!) });
      cost += BigInt(best.order.price!);
      used.set(best.level, (used.get(best.level) ?? 0) + 1);
      c[best.level]++;
      if (cascade(c, max).counts[target + 1] > start.counts[target + 1]) break;
    }
    if (!steps.length) continue;
    const end = cascade(c, max);
    const key = steps.map((s) => s.order.id).join(",");
    if (plans.some((p) => p.steps.map((s) => s.order.id).join(",") === key)) continue;
    plans.push({ steps, cost, merges: end.merges - start.merges, powerBefore, powerAfter: power(end.counts, base), finalCounts: end.counts });
  }
  return plans.sort((a, b) => b.powerAfter - b.powerBefore - (a.powerAfter - a.powerBefore) || (a.cost < b.cost ? -1 : 1)).slice(0, 4);
}
