import type { APIError } from "./types.ts";

export type IdentityErrorCode = APIError["error"]["code"];

export class IdentityError extends Error {
  readonly code: IdentityErrorCode;

  constructor(code: IdentityErrorCode, message: string) {
    super(message);
    this.name = "IdentityError";
    this.code = code;
  }
}
