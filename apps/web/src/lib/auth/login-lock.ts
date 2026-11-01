// Password checks happen one at a time (audit A-03). Argon2 is deliberately
// slow and the throttle is only updated after a check, so a burst of parallel
// guesses used to all pass the "are you blocked?" test before any of them
// failed. Running the check inside this lock, and testing the block again
// inside it, means the sixth guess in a burst sees the block the fifth created.
// Everyone waiting behind a long queue is turned away instead of queueing
// without end.

export class LockBusy extends Error {}

export function createLoginLock({ maxQueued }: { maxQueued: number }) {
  let tail: Promise<unknown> = Promise.resolve();
  let queued = 0; // running plus waiting

  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      if (queued >= maxQueued) throw new LockBusy("Too many sign-in attempts are waiting.");
      queued++;
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => (release = resolve));
      try {
        await previous;
        return await task();
      } finally {
        queued--;
        release();
      }
    },
  };
}
