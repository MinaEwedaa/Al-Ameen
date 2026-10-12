class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const E = {
  validation: (m) => new AppError(400, 'VALIDATION_ERROR', m),
  unauthorized: (m = 'Unauthorized') => new AppError(401, 'UNAUTHORIZED', m),
  forbidden: (m = 'Forbidden', code = 'FORBIDDEN') => new AppError(403, code, m),
  notFound: (m = 'Not found') => new AppError(404, 'NOT_FOUND', m),
  conflict: (m, code = 'CONFLICT') => new AppError(409, code, m),
  tooMany: (m, retryAfter) => Object.assign(new AppError(429, 'TOO_MANY_REQUESTS', m), { retryAfter }),
};

module.exports = { AppError, E };
