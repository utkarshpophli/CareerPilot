import { describe, expect, it } from "vitest";

import { createLoginLock, LockBusy } from "./login-lock";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createLoginLock", () => {
  it("runs one task at a time, in the order they came", async () => {
    const lock = createLoginLock({ maxQueued: 10 });
    const log: string[] = [];
    let running = 0;
    let most = 0;
    const task = (name: string) => async () => {
      running++;
      most = Math.max(most, running);
      log.push(`start ${name}`);
      await tick();
      log.push(`end ${name}`);
      running--;
      return name;
    };
    const results = await Promise.all([lock.run(task("a")), lock.run(task("b")), lock.run(task("c"))]);
    expect(results).toEqual(["a", "b", "c"]);
    expect(most).toBe(1);
    expect(log).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"]);
  });

  it("keeps going after a task fails", async () => {
    const lock = createLoginLock({ maxQueued: 10 });
    const failing = lock.run(async () => {
      throw new Error("boom");
    });
    const next = lock.run(async () => "fine");
    await expect(failing).rejects.toThrow("boom");
    await expect(next).resolves.toBe("fine");
  });

  it("refuses more waiting tasks than it allows, instead of queueing without end", async () => {
    const lock = createLoginLock({ maxQueued: 2 });
    let open!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const first = lock.run(() => gate);
    const second = lock.run(async () => "second");
    await expect(lock.run(async () => "third")).rejects.toBeInstanceOf(LockBusy);
    open();
    await first;
    await expect(second).resolves.toBe("second");
    await expect(lock.run(async () => "after")).resolves.toBe("after");
  });
});
