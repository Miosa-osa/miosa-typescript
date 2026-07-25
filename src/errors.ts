export interface MiosaErrorBody {
  error?: string | {
    code?: string;
    message?: string;
    details?: unknown;
  };
  message?: string;
  code?: string;
  detail?: string;
  details?: unknown;
  reason?: string;
  request_id?: string;
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
    const nested = typeof body.error === "object" ? body.error : undefined;
    const flatError = typeof body.error === "string" ? body.error : undefined;
    const flatErrorIsCode = !!flatError && /^[A-Z][A-Z0-9_]+$/.test(flatError);
    const message = nested?.message ?? body.message ?? body.detail ?? body.reason ?? flatError ?? `HTTP ${status}`;
    const code = nested?.code ?? body.code ?? (flatErrorIsCode ? flatError : "UNKNOWN_ERROR");
    const details = nested?.details ?? body.details ??
      (body.detail || body.reason ? { detail: body.detail, reason: body.reason } : undefined);
    requestId ??= body.request_id;

    const connectError = connectErrorFromCode(code, message, status, details, requestId);
    if (connectError) return connectError;

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

function connectErrorFromCode(
  code: string,
  message: string,
  status: number,
  details?: unknown,
  requestId?: string,
): MiosaError | undefined {
  switch (code) {
    case "PROJECT_NOT_LINKED":
      return new ProjectNotLinkedError(message, status, details, requestId);
    case "SUBJECT_NOT_ALLOWED":
      return new SubjectNotAllowedError(message, status, details, requestId);
    case "SCOPE_NOT_ALLOWED":
      return new ScopeNotAllowedError(message, status, details, requestId);
    case "MANAGED_PROVIDER_BINDING_ONLY":
      return new ManagedProviderBindingOnlyError(message, status, details, requestId);
    case "INSTALLATION_REQUIRED":
      return new InstallationRequiredError(message, status, details, requestId);
    case "USER_AUTHORIZATION_REQUIRED":
      return new UserAuthorizationRequiredError(message, status, details, requestId);
    case "EGRESS_HOST_NOT_ALLOWED":
      return new EgressHostNotAllowedError(message, status, details, requestId);
    case "TOKEN_REFRESH_FAILED":
      return new TokenRefreshFailedError(message, status, details, requestId);
    default:
      return undefined;
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

export class ProjectNotLinkedError extends MiosaError {
  constructor(message: string, status = 403, details?: unknown, requestId?: string) {
    super(message, status, "PROJECT_NOT_LINKED", details, requestId);
    this.name = "ProjectNotLinkedError";
  }
}

export class SubjectNotAllowedError extends MiosaError {
  constructor(message: string, status = 403, details?: unknown, requestId?: string) {
    super(message, status, "SUBJECT_NOT_ALLOWED", details, requestId);
    this.name = "SubjectNotAllowedError";
  }
}

export class ScopeNotAllowedError extends MiosaError {
  constructor(message: string, status = 403, details?: unknown, requestId?: string) {
    super(message, status, "SCOPE_NOT_ALLOWED", details, requestId);
    this.name = "ScopeNotAllowedError";
  }
}

export class ManagedProviderBindingOnlyError extends MiosaError {
  constructor(message: string, status = 403, details?: unknown, requestId?: string) {
    super(message, status, "MANAGED_PROVIDER_BINDING_ONLY", details, requestId);
    this.name = "ManagedProviderBindingOnlyError";
  }
}

export class InstallationRequiredError extends MiosaError {
  constructor(message: string, status = 409, details?: unknown, requestId?: string) {
    super(message, status, "INSTALLATION_REQUIRED", details, requestId);
    this.name = "InstallationRequiredError";
  }
}

export class UserAuthorizationRequiredError extends MiosaError {
  constructor(message: string, status = 403, details?: unknown, requestId?: string) {
    super(message, status, "USER_AUTHORIZATION_REQUIRED", details, requestId);
    this.name = "UserAuthorizationRequiredError";
  }
}

export class EgressHostNotAllowedError extends MiosaError {
  constructor(message: string, status = 403, details?: unknown, requestId?: string) {
    super(message, status, "EGRESS_HOST_NOT_ALLOWED", details, requestId);
    this.name = "EgressHostNotAllowedError";
  }
}

export class TokenRefreshFailedError extends MiosaError {
  constructor(message: string, status = 502, details?: unknown, requestId?: string) {
    super(message, status, "TOKEN_REFRESH_FAILED", details, requestId);
    this.name = "TokenRefreshFailedError";
  }
}
