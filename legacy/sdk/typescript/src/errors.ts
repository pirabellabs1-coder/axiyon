/** Typed exceptions raised by the SDK. */

export class AxionError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AxionError";
    this.status = status;
  }
}

export class AuthError extends AxionError {
  constructor(m: string) { super(m, 401); this.name = "AuthError"; }
}
export class NotFoundError extends AxionError {
  constructor(m: string) { super(m, 404); this.name = "NotFoundError"; }
}
export class ConflictError extends AxionError {
  constructor(m: string) { super(m, 409); this.name = "ConflictError"; }
}
export class ValidationError extends AxionError {
  constructor(m: string) { super(m, 422); this.name = "ValidationError"; }
}
export class RateLimited extends AxionError {
  constructor(m: string) { super(m, 429); this.name = "RateLimited"; }
}
export class ServerError extends AxionError {
  constructor(m: string, status = 500) { super(m, status); this.name = "ServerError"; }
}
