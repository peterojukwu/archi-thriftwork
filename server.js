const { app, cfg } = require('./app');

const port = Number(process.env.PORT || cfg.PORT);
app.listen(port, '0.0.0.0', () => {
  const mailMode = !cfg.EMAIL.ENABLED ? 'off'
    : (cfg.EMAIL.SMTP_HOST ? `SMTP ${cfg.EMAIL.SMTP_HOST}:${cfg.EMAIL.SMTP_PORT}` : 'log-only (set SMTP_* to send real email)');
  console.log(`Archi Thrift listening on 0.0.0.0:${port}`);
  console.log(`Email notifications: ${mailMode}`);
});
