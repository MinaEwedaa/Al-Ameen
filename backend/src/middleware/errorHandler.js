module.exports = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    err = { status: 400, errors: [{ path: 'body', message: 'invalid JSON' }] };
  }

  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' },
    });
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
  const error = { code: err.code, message: err.message };

  if (err.guest_id) {
    error.guest_id = err.guest_id;
  }

  return res.status(err.status).json({ error });
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
