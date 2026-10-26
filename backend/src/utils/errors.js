class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const E = {
  badRequest: (m = 'Bad request', d) => new AppError(400, 'BAD_REQUEST', m, d),
  validation: (m, d) => new AppError(400, 'VALIDATION_ERROR', m, d),
  unauthorized: (m = 'Unauthorized') => new AppError(401, 'UNAUTHORIZED', m),
  forbidden: (m = 'Forbidden', code = 'FORBIDDEN') => new AppError(403, code, m),
  notFound: (m = 'Not found', code = 'NOT_FOUND') => new AppError(404, code, m),
  conflict: (m, code = 'CONFLICT', d) => new AppError(409, code, m, d),
  unprocessable: (m, code = 'INVALID_STATUS_TRANSITION', d) => new AppError(422, code, m, d),
  tooMany: (m, retryAfter) => Object.assign(new AppError(429, 'TOO_MANY_REQUESTS', m), { retryAfter }),
};

module.exports = { AppError, E };
