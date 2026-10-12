module.exports = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    err = { status: 400, errors: [{ path: 'body', message: 'invalid JSON' }] };
  }

  if (err.status === 400 && err.errors) {
    const msg = err.errors.map((e) => e.path + ' ' + e.message).join('; ');
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: msg },
    });
  }

  if (err.status === 404 && !err.code) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Not found' },
    });
  }

  if (err.retryAfter) {
    res.set('Retry-After', String(err.retryAfter));
  }

  if (err.code && err.status) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
  }

  if (req.log) {
    req.log.error({ err }, 'unhandled error');
  } else {
    console.error('Unhandled error:', err);
  }

  res.status(500).json({
    error: { code: 'SERVER_ERROR', message: 'Unexpected error' },
  });
};
