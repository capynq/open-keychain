/** A tiny insertion-ordered cache for immutable-by-convention worker results. */
export class BoundedResultCache<T> {
  private readonly entries = new Map<string, T>();
  private readonly weights = new Map<string, number>();

  constructor(
    private readonly limit = 8,
    private readonly maxWeight = 64 * 1024 * 1024,
    private readonly weightOf: (value: T) => number = () => 0,
  ) {}

  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: string, value: T): void {
    const weight = this.weightOf(value);
    this.entries.delete(key);
    this.weights.delete(key);
    if (weight > this.maxWeight) return;
    this.entries.set(key, value);
    this.weights.set(key, weight);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
      this.weights.delete(oldest);
    }
    while (this.totalWeight() > this.maxWeight) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
      this.weights.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
    this.weights.clear();
  }

  private totalWeight(): number {
    let total = 0;
    for (const weight of this.weights.values()) total += weight;
    return total;
  }
}
