const { app } = require('../app');

module.exports = (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost');
  const originalPath = requestUrl.searchParams.get('__path');
  if (originalPath && originalPath.startsWith('/')) {
    requestUrl.searchParams.delete('__path');
    req.url = originalPath + (requestUrl.searchParams.size ? `?${requestUrl.searchParams}` : '');
  }
  return app(req, res);
};