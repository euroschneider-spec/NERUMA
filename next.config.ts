import type { NextConfig } from 'next';

// 'unsafe-inline' scripts are required: Next streams inline RSC payload scripts, and the theme
// script in [locale]/layout.tsx must run before paint (GOTCHA.md, 8 October 2026). A nonce would
// remove it but forces every prerendered page to render dynamically. The policy still blocks
// third-party scripts, plugins, framing, <base> hijacking and off-site form posts.
const development = process.env.NODE_ENV === 'development';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const config: NextConfig = {
  // Use the compiler API; this also works in containers that restrict detached CLI subprocesses.
  experimental: { useTypeScriptCli: false },
  poweredByHeader: false, // Avoid advertising the framework version to probing clients.
  // How it works is a section of the home page now; the old address keeps working for links and QR codes.
  async redirects() {
    return [{ source: '/:locale(en|ro|de)/how-it-works', destination: '/:locale#how-it-works', permanent: true }];
  },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      // Browsers ignore this over plain HTTP, so local runs are unaffected.
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    ] }, {
      // Pages only. API routes that serve files set their own, stricter sandboxed policy, and a
      // config header would replace it.
      source: '/((?!api/).*)', headers: [{ key: 'Content-Security-Policy', value: contentSecurityPolicy }],
    }];
  }
};
export default config;
