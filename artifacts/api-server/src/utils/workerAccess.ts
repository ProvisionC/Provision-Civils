const SELF_SERVICE_PREFIXES = [
  '/api/auth/me',
  '/api/notifications',
  '/api/messages',
  '/api/leave',
  '/api/labour-entries',
  '/api/announcements',
  '/api/teams',
  '/api/push-tokens',
];

const RESTRICTED_PREFIXES = [
  '/api/jobs',
  '/api/employees',
  '/api/clients',
  '/api/payroll',
  '/api/invoices',
  '/api/expenses',
  '/api/leave/',
  '/api/labour-entries/',
];

export function isWorkerAllowedRoute(pathname: string): boolean {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (RESTRICTED_PREFIXES.some(prefix => normalized.startsWith(prefix))) {
    return false;
  }

  if (SELF_SERVICE_PREFIXES.some(prefix => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    return true;
  }

  return normalized === '/api/auth/login';
}
