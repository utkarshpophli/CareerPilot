/** A problem a service reports in plain terms; the REST API maps the code to 400, 403, 404 or 409. */
export class ServiceError extends Error {
  constructor(
    readonly code: "bad_request" | "forbidden" | "not_found" | "conflict",
    message: string,
  ) {
    super(message);
  }
}
