import { Context } from "hono";

export const generateRequestId = () => crypto.randomUUID();

export const formatSuccess = (data: any, meta: any = {}, requestId: string) => {
  return {
    ok: true,
    data,
    meta,
    request_id: requestId,
  };
};

export const formatError = (
  code: string,
  message: string,
  requestId: string,
) => {
  return {
    ok: false,
    error: {
      code,
      message,
    },
    request_id: requestId,
  };
};

export const errorHandler = (err: Error, c: Context) => {
  const requestId = c.get("requestId") || generateRequestId();

  if (err.name === "ZodError") {
    return c.json(
      formatError("validation_error", "Invalid input data", requestId),
      400,
    );
  }

  // Handle expected errors, hide stack traces
  console.error(`[${requestId}] Error:`, err.message);

  const status = (err as any).status || 500;
  const code = (err as any).code || "internal_server_error";
  const message = status === 500 ? "Internal Server Error" : err.message;

  return c.json(formatError(code, message, requestId), status);
};
