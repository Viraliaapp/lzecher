import type { Firestore, Transaction } from "firebase-admin/firestore";

// Firestore's standard retry list excludes this closed-transaction response.
// Callbacks must contain only transactional reads/writes: they can run again.
export async function runLearningTransaction<T>(db: Firestore, work: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.runTransaction(work);
    } catch (error) {
      const e = error as { code?: number; details?: string };
      if (attempt >= 2 || e.code !== 3 || e.details !== "Transaction is invalid or closed.") throw error;
      await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
}
