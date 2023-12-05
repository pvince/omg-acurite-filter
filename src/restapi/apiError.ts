import { StatusCodes } from 'http-status-codes';

/**
 * Standardized API Error object
 */
export interface IAPIError {
  /**
   * Error status code
   */
  code: StatusCodes;
  /**
   * Error message
   */
  message: string;
}

/**
 * Build a success object
 * @returns - A basic 'success' status object.
 */
export function buildSuccess(): IAPIError {
  return { message: 'Ok', code: StatusCodes.OK };
}

/**
 * Builds a standard API error object.
 * @param message - Error message
 * @param code - Error code
 * @returns - a basic error object.
 */
export function buildError(message: string, code: StatusCodes = StatusCodes.INTERNAL_SERVER_ERROR): IAPIError {
  return { code, message };
}


/**
 * Translates the provided error into an error message we can return.
 * @param err - Error we received
 * @param code - Status code to return
 * @returns - Translated error message.
 */
export function translateError(err: unknown, code: StatusCodes = StatusCodes.INTERNAL_SERVER_ERROR): IAPIError {
  const result = buildError(`${err}`, code);

  if (err instanceof Error) {
    result.message = err.message;
  }

  return result;
}

/**
 * Check if the provided status object is a success or failure.
 * @param status - Status
 * @returns - True if is success
 */
export function isSuccess(status: IAPIError): boolean {
  const MIN_VALID = 200;
  const MAX_VALID = 299;
  return status.code.valueOf() >= MIN_VALID && status.code.valueOf() <= MAX_VALID;
}

/**
 * Check if the provided status object is in an error state.
 * @param status - Status to check
 * @returns - True if error
 */
export function isError(status: IAPIError): boolean {
  return !isSuccess(status);
}
