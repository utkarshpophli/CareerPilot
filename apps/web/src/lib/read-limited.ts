// Reading a request body without letting it be larger than we are willing to
// hold (audit B-20): refused at once when it announces a size over the limit,
// and stopped while streaming when it turns out to be bigger than it said.

export class BodyTooLarge extends Error {}

/** The request's body as text, or a BodyTooLarge error once it is known to be over `maxBytes`. */
export async function readLimitedText(request: Request, maxBytes: number): Promise<string> {
  const announced = Number(request.headers.get("content-length"));
  if (Number.isFinite(announced) && announced > maxBytes) throw new BodyTooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      // Not awaited: on a cloned request (a tee) cancel() settles only once the other branch is cancelled too, which would hang here.
      void reader.cancel().catch(() => {});
      throw new BodyTooLarge();
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
