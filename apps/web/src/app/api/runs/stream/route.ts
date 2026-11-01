import { logServerError } from "@/lib/log";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/route";
import { loadRunsSnapshot } from "@/lib/runs";
import { runsSignature } from "@/lib/runs-view";

/** How often the stream looks for a change. A database check rather than an in-process signal, so it also sees runs written by another process. */
const CHECK_MS = 2_000;
/** Keeps proxies from closing a quiet stream. */
const HEARTBEAT_MS = 15_000;

/**
 * The runs list as Server-Sent Events: the list now, then again whenever
 * something about any run changes (a step, a finish, a run going stalled).
 */
export const GET = route(async (request) => {
  const encoder = new TextEncoder();
  let stop = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let last: string | null = null; // null until the first send, so an empty list is still sent once
      let busy = false;
      const check = async () => {
        if (closed || busy) return;
        busy = true;
        try {
          const runs = await loadRunsSnapshot(prisma);
          const signature = runsSignature(runs);
          if (!closed && signature !== last) {
            last = signature;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ runs })}\n\n`));
          }
        } catch (error) {
          // The database may be busy for a moment: say so, and the next check tries again.
          logServerError("runs stream", error);
        } finally {
          busy = false;
        }
      };
      const poll = setInterval(check, CHECK_MS);
      const heartbeat = setInterval(() => !closed && controller.enqueue(encoder.encode(": waiting\n\n")), HEARTBEAT_MS);
      stop = () => {
        if (closed) return;
        closed = true;
        clearInterval(poll);
        clearInterval(heartbeat);
        controller.close();
      };
      request.signal.addEventListener("abort", () => stop(), { once: true });
      await check();
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      // Tells nginx not to buffer the stream.
      "x-accel-buffering": "no",
    },
  });
});
