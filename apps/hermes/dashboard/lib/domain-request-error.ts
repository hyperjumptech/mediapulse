export class DomainRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "DomainRequestError";
  }
}

export const domainRequestFailedError = (
  status: number,
  detail?: string,
): DomainRequestError =>
  new DomainRequestError(
    status,
    detail
      ? `Domain dashboard request failed (${status}): ${detail}`
      : `Domain dashboard request failed (${status})`,
    detail,
  );

const readStringField = (
  payload: unknown,
  field: string,
): string | undefined => {
  if (typeof payload !== "object" || payload === null || !(field in payload)) {
    return undefined;
  }
  const value = (payload as Record<string, unknown>)[field];

  return typeof value === "string" && value.trim() !== "" ? value : undefined;
};

export const readDomainErrorDetail = async (
  response: Response,
): Promise<string | undefined> => {
  const payload = (await response.json().catch(() => null)) as unknown;

  return (
    readStringField(payload, "message") ?? readStringField(payload, "error")
  );
};
