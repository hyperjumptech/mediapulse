export type ResendSendErrorDetails = {
  message: string;
  name?: string;
  statusCode?: number | null;
};

export type ResendEmailsSendResult = {
  data?: unknown;
  error?: ResendSendErrorDetails | null;
};

export class ResendSendError extends Error {
  readonly resendErrorName: string | undefined;
  readonly statusCode: number | null | undefined;

  constructor(details: ResendSendErrorDetails) {
    super(`Resend email send failed: ${details.message}`);
    this.name = "ResendSendError";
    this.resendErrorName = details.name;
    this.statusCode = details.statusCode;
  }
}

export function assertResendSendSucceeded(
  result: ResendEmailsSendResult,
): void {
  if (result.error) {
    throw new ResendSendError(result.error);
  }
}

export function readResendEmailId(
  result: ResendEmailsSendResult,
): string | undefined {
  const data = result.data;
  if (typeof data !== "object" || data === null || !("id" in data)) {
    return undefined;
  }

  const emailId = (data as { id: unknown }).id;

  return typeof emailId === "string" ? emailId : undefined;
}
