import { Zip, ZipPassThrough } from 'fflate';

/**
 * Emitted chunks are wrapped into Blob parts once this much data has accumulated.
 * Browser Blob storage is disk-backed, so paging chunks out keeps the JS heap flat
 * instead of growing to the full archive size (which can be ~1 GB for a long sequence).
 */
const BLOB_FLUSH_BYTES = 8 * 1024 * 1024;

export interface StoredZip {
  addFile(name: string, data: Uint8Array): void;
  finish(): Promise<Blob>;
}

/**
 * Streaming ZIP writer using STORE (no compression).
 *
 * PNG payloads are already deflate streams, so ZIP-level DEFLATE measurably *grows*
 * them (~-0.03%) while burning CPU. STORE is the correct method here.
 */
export function createStoredZip(): StoredZip {
  const parts: BlobPart[] = [];
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;

  let error: unknown = null;
  let isFinal = false;
  let onFinal: (() => void) | null = null;

  function flushPending(): void {
    if (pending.length === 0) return;
    parts.push(new Blob(pending));
    pending = [];
    pendingBytes = 0;
  }

  const zip = new Zip((err, chunk, final) => {
    if (err) {
      error = err;
      onFinal?.();
      return;
    }
    if (chunk.length > 0) {
      pending.push(chunk);
      pendingBytes += chunk.length;
      if (pendingBytes >= BLOB_FLUSH_BYTES) flushPending();
    }
    if (final) {
      isFinal = true;
      onFinal?.();
    }
  });

  return {
    addFile(name, data) {
      if (error) throw error;
      const file = new ZipPassThrough(name);
      zip.add(file);
      file.push(data, true);
    },

    finish() {
      return new Promise<Blob>((resolve, reject) => {
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          if (error) {
            reject(error);
            return;
          }
          flushPending();
          resolve(new Blob(parts, { type: 'application/zip' }));
        };

        // ZipPassThrough emits synchronously, so the handler may fire during end().
        onFinal = settle;
        zip.end();
        if (isFinal || error) settle();
      });
    },
  };
}
