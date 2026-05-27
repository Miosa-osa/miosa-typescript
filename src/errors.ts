export interface MiosaErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  message?: string;
  code?: string;
}

export class MiosaError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(
    message: string,
    status: number,
    code: string,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = "MiosaError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  static fromResponse(
    status: number,
    body: MiosaErrorBody,
    requestId?: string,
  ): MiosaError {
    const message = body.error?.message ?? body.message ?? `HTTP ${status}`;
    const code = body.error?.code ?? body.code ?? "UNKNOWN_ERROR";
    const details = body.error?.details;

    if (status === 401 || status === 403) {
      return new AuthError(message, status, code, details, requestId);
    }
    if (status === 404) {
      return new NotFoundError(message, code, details, requestId);
    }
    if (status === 429) {
      return new RateLimitError(message, details, requestId);
    }
    if (status === 402) {
      return new InsufficientCreditsError(message, details, requestId);
    }
    if (status >= 400 && status < 500) {
      return new ValidationError(message, status, code, details, requestId);
    }

    return new MiosaError(message, status, code, details, requestId);
  }
}

export class AuthError extends MiosaError {
  constructor(
    message: string,
    status: number = 401,
    code: string = "UNAUTHORIZED",
    details?: unknown,
    requestId?: string,
  ) {
    super(message, status, code, details, requestId);
    this.name = "AuthError";
  }
}

export class NotFoundError extends MiosaError {
  constructor(
    message: string,
    code: string = "NOT_FOUND",
    details?: unknown,
    requestId?: string,
  ) {
    super(message, 404, code, details, requestId);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends MiosaError {
  readonly retryAfter: number | undefined;

  constructor(
    message: string,
    details?: unknown,
    requestId?: string,
    retryAfter?: number,
  ) {
    super(message, 429, "RATE_LIMITED", details, requestId);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class InsufficientCreditsError extends MiosaError {
  constructor(message: string, details?: unknown, requestId?: string) {
    super(message, 402, "INSUFFICIENT_CREDITS", details, requestId);
    this.name = "InsufficientCreditsError";
  }
}

export class ValidationError extends MiosaError {
  constructor(
    message: string,
    status: number,
    code: string = "VALIDATION_ERROR",
    details?: unknown,
    requestId?: string,
  ) {
    super(message, status, code, details, requestId);
    this.name = "ValidationError";
  }
}

export class TimeoutError extends MiosaError {
  constructor(message: string = "Request timed out") {
    super(message, 408, "TIMEOUT");
    this.name = "TimeoutError";
  }
}

export class NetworkError extends MiosaError {
  readonly cause: Error;

  constructor(message: string, cause: Error) {
    super(message, 0, "NETWORK_ERROR");
    this.name = "NetworkError";
    this.cause = cause;
  }
}
