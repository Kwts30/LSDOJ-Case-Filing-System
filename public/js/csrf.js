(() => {
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (!token || !window.fetch) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      headers.set('X-CSRF-Token', token);
      init.headers = headers;
    }
    return originalFetch(input, init);
  };
})();
