// @ts-check
// server/middleware/securityHeaders.js
// Pure, static HTTP security headers set on every response of the proxied rooms
// service. Mounted EARLY in server/server.js (before routes + static) so it
// covers static assets, the ws-upgrade origin, and error responses too. Mirrors
// the suite hub's makeSecurityHeaders (see /var/www/suite/hub/middleware/
// securityHeaders.js). connect-src includes wss:/ws: because the rooms service
// is a WebSocket origin. The static front door (DocumentRoot public/) gets the
// same headers at the Apache layer — see deploy/sprintplan.uk.conf.

export const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' wss: ws:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/**
 * @param {{ contentSecurityPolicy?: string }} [opts]
 * @returns {(req: any, res: any, next: () => void) => void}
 */
export function makeSecurityHeaders({ contentSecurityPolicy = DEFAULT_CSP } = {}) {
  return function securityHeaders(_req, res, next) {
    res.setHeader("Content-Security-Policy", contentSecurityPolicy);
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=(), payment=()");
    next();
  };
}
