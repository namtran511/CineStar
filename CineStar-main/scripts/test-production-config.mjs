import assert from 'node:assert/strict';
import { seedAccounts, accountAllowed } from '../lib/server/seed-accounts.js';
assert.equal(seedAccounts({}).accounts.length, 3);
assert.throws(() => seedAccounts({APP_ENV:'production'}));
assert.throws(() => seedAccounts({APP_ENV:'production',INITIAL_ADMIN_EMAIL:'owner@example.com',INITIAL_ADMIN_PASSWORD:'Demo@123'}));
const seed = seedAccounts({APP_ENV:'production',INITIAL_ADMIN_EMAIL:'Owner@Example.com',INITIAL_ADMIN_PASSWORD:'test-only-long-password-123'});
assert.deepEqual(seed.accounts, [['admin-production','Quản trị CineStar','owner@example.com','admin']]);
for (const id of ['admin-demo','staff-demo','user-demo']) {
 assert.equal(accountAllowed({APP_ENV:'production'},id),false);
 assert.equal(accountAllowed({},id),true);
}
assert.equal(accountAllowed({APP_ENV:'production'},'admin-production'),true);
console.log('PASS production requires private admin credentials, seeds only the owner, and denies demo logins/sessions; local demo preserved.');
