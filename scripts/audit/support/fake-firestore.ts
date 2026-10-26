import assert from "node:assert/strict";
import type { Firestore } from "firebase-admin/firestore";

type Data = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
class Ref {
  constructor(readonly db: MemoryFirestore, readonly collectionName: string, readonly id: string) {}
  get path() { return `${this.collectionName}/${this.id}`; }
  get parent() { return { id: this.collectionName }; }
  async get() { return this.db.snapshot(this); }
  async update(data: Data) { this.db.update(this, data); }
  async set(data: Data) { this.db.records.set(this.path, copy(data)); }
  async delete() { this.db.records.delete(this.path); }
}
class Query {
  constructor(readonly db: MemoryFirestore, readonly name: string, readonly filters: [string, string, any][] = [], readonly max = Infinity) {
    assert.ok(name.startsWith("lzecher_"), "No other application collections may be touched");
  }
  doc(id = `generated-${++this.db.sequence}`) { return new Ref(this.db, this.name, id); }
  where(key: string, op: string, value: unknown) { assert.ok(["==", ">="].includes(op)); return new Query(this.db, this.name, [...this.filters, [key, op, value]], this.max); }
  count() { return { get: async () => { const snap = await this.get(); return { data: () => ({ count: snap.size }) }; } }; }
  orderBy() { return this; }
  limit(count: number) { return new Query(this.db, this.name, this.filters, count); }
  async get() {
    const docs = [...this.db.records.entries()].filter(([path, data]) => path.startsWith(this.name + "/")
      && this.filters.every(([key, op, value]) => op === "==" ? data[key] === value : data[key] >= value)).slice(0, this.max)
      .map(([path]) => this.db.snapshot(new Ref(this.db, this.name, path.slice(this.name.length + 1))));
    return { docs, empty: docs.length === 0, size: docs.length };
  }
}

/** Isolated transaction contract double: staged writes, rollback, serialized
 * contenders, read-before-write enforcement, and explicit retry/fault injection.
 * It is not a replacement for validation against a Firestore emulator. */
export class MemoryFirestore {
  records = new Map<string, Data>();
  sequence = 0;
  transactions = 0;
  failTransaction = -1;
  retryOnce = false;
  maxWrites = 0;
  private tail: Promise<unknown> = Promise.resolve();
  asFirestore() { return this as unknown as Firestore; }
  collection(name: string) { return new Query(this, name); }
  put(collection: string, id: string, data: Data) { this.records.set(`${collection}/${id}`, copy(data)); return this; }
  data(collection: string, id: string) { return copy(this.records.get(`${collection}/${id}`)); }
  snapshot(ref: Ref) {
    const value = copy(this.records.get(ref.path));
    return { id: ref.id, ref, exists: value !== undefined, data: () => copy(value) };
  }
  async getAll(...refs: Ref[]) { return refs.map(ref => this.snapshot(ref)); }
  batch() {
    const writes: (() => void)[] = [];
    return {
      set: (ref: Ref, data: Data) => writes.push(() => { this.records.set(ref.path, copy(data)); }),
      update: (ref: Ref, data: Data) => writes.push(() => this.update(ref, data)),
      delete: (ref: Ref) => writes.push(() => { this.records.delete(ref.path); }),
      commit: async () => {
        assert.ok(writes.length <= 500);
        const before = copy(this.records);
        try { for (const write of writes) write(); }
        catch (error) { this.records = before; throw error; }
      },
    };
  }
  update(ref: Ref, values: Data) {
    const data = copy(this.records.get(ref.path));
    assert.ok(data, `Cannot update missing document ${ref.path}`);
    for (const [key, value] of Object.entries(values)) {
      const keys = key.split("."); let target = data;
      while (keys.length > 1) { const field = keys.shift()!; target = target[field] ??= {}; }
      target[keys[0]] = copy(value);
    }
    this.records.set(ref.path, data);
  }
  runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      this.transactions++;
      let result!: T;
      let writes: (() => void)[] = [];
      const execute = async () => {
        writes = [];
        result = await fn({
          get: async (target: Ref | Query) => { assert.equal(writes.length, 0, "All reads must precede writes"); return target.get(); },
          getAll: async (...refs: Ref[]) => { assert.equal(writes.length, 0); return this.getAll(...refs); },
          set: (ref: Ref, data: Data) => writes.push(() => { this.records.set(ref.path, copy(data)); }),
          update: (ref: Ref, data: Data) => writes.push(() => this.update(ref, data)),
          delete: (ref: Ref) => writes.push(() => { this.records.delete(ref.path); }),
        });
      };
      await execute();
      if (this.retryOnce) { this.retryOnce = false; await execute(); }
      assert.ok(writes.length <= 500, "Firestore write limit");
      this.maxWrites = Math.max(this.maxWrites, writes.length);
      if (this.transactions === this.failTransaction) throw new Error("Simulated lost connection before commit");
      const before = copy(this.records);
      try { for (const write of writes) write(); }
      catch (error) { this.records = before; throw error; }
      return result;
    });
    this.tail = run.catch(() => {});
    return run;
  }
}
