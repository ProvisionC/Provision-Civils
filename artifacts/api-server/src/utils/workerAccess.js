const RESTRICTED_PREFIXES = [
  '/api/jobs',
  '/api/employees',
  '/api/clients',
  '/api/payroll',
  '/api/invoices',
  '/api/expenses',
  '/api/recycle',
];

export function isWorkerAllowedRoute(pathname) {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const withApiPrefix = normalized.startsWith('/api') ? normalized : `/api${normalized}`;

  if (RESTRICTED_PREFIXES.some(prefix => withApiPrefix === prefix || withApiPrefix.startsWith(`${prefix}/`))) {
    return false;
  }

  return true;
}
