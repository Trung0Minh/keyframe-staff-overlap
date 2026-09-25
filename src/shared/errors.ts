export type DataSourceErrorCode = "NETWORK" | "NOT_FOUND" | "RATE_LIMITED" | "SCHEMA_CHANGED" | "PARSE_FAILED" | "ABORTED";

export class DataSourceError extends Error {
  readonly code: DataSourceErrorCode;

  constructor(code: DataSourceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
    this.name = "DataSourceError";
  }
}
