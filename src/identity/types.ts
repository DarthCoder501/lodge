export type LoginProvider = "google" | "microsoft" | "password";

export interface CurrentUser {
  id: string;
  email: string;
  emailVerified: boolean;
  loginProvider: LoginProvider;
}

export interface APIError {
  error: {
    code:
      | "VALIDATION_ERROR"
      | "EMAIL_TAKEN"
      | "INVALID_LOGIN"
      | "UNAUTHENTICATED"
      | "EMAIL_UNVERIFIED";
    message: string;
  };
}
