import { createAuthClient } from '@neon/auth';

window.archiAuthReady = fetch('/api/config', { headers: { Accept: 'application/json' } })
  .then(async response => {
    const data = await response.json();
    if (!response.ok || !data.authUrl) {
      throw new Error(data.error || 'Neon Auth is not configured.');
    }
    window.archiAuth = createAuthClient(data.authUrl);
    return window.archiAuth;
  });
