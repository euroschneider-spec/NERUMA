// Test-only transport. Production code never imports this module.
if (process.env.VIANORAE_TEST_FIXTURE === '1') {
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.hostname === 'vianorae-fixture.supabase.co') {
      url.protocol = 'http:'; url.host = '127.0.0.1:3012';
      input = input instanceof Request ? new Request(url, input) : url;
    }
    // Stripe's API, faked by the same fixture (payments).
    if (url.hostname === 'api.stripe.com') {
      url.protocol = 'http:'; url.host = '127.0.0.1:3012'; url.pathname = `/__stripe${url.pathname}`;
      input = input instanceof Request ? new Request(url, input) : url;
    }
    return original(input, init);
  };
}
