import test from 'node:test';
import assert from 'node:assert/strict';
import { isWorkerAllowedRoute } from './workerAccess.js';

test('allows worker self-service routes and blocks admin routes', () => {
  assert.equal(isWorkerAllowedRoute('/api/auth/me'), true);
  assert.equal(isWorkerAllowedRoute('/api/notifications'), true);
  assert.equal(isWorkerAllowedRoute('/api/messages'), true);
  assert.equal(isWorkerAllowedRoute('/api/leave'), true);
  assert.equal(isWorkerAllowedRoute('/api/labour-entries'), true);
  assert.equal(isWorkerAllowedRoute('/api/jobs'), false);
  assert.equal(isWorkerAllowedRoute('/api/employees'), false);
  assert.equal(isWorkerAllowedRoute('/api/payroll/summary'), false);
});
