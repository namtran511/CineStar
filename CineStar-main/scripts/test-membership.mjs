import assert from "node:assert/strict";
import { createQaCustomer } from './qa-customer.mjs';
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { birthdayWindow, membershipTier, validateBirthDate, vietnamToday } from "../lib/membership-rules.js";

// All writes target fresh QA accounts and screenings. No existing customer's
// birthday, points, tickets, reviews, or credentials are changed by this suite.
const base = new URL(process.argv.find(arg => /^https?:\/\//.test(arg)) || "http://localhost:5173");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Membership tests require a local development server.");
const stamp = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
const fixtures = { users: [], movies: [], rooms: [], showtimes: [], bookings: [], combos: [], promotions: [] };
const sqlPath = resolve(".sites-runtime", `membership-test-${stamp}.sql`);
const password = "MembershipQA@123";
let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions++; console.log(`OK ${message}`); }
function quote(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function ids(values) { return values.map(value => { assert.match(value, /^[a-f0-9-]{36}$/); return quote(value); }).join(",") || "''"; }
function execute(sql) {
  writeFileSync(sqlPath, sql, "utf8");
  try {
    const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--persist-to", ".wrangler/state", "--config", ".sites-runtime/db-init.json", "--file", sqlPath, "--json"], { encoding: "utf8", env: process.env, windowsHide: true });
    if (result.status !== 0) throw new Error(`Membership fixture SQL failed: ${result.stderr || result.stdout || result.error}`);
    return JSON.parse(result.stdout).flatMap(result => result.results || []);
  } finally { rmSync(sqlPath, { force: true }); }
}
async function call(path, { method = "GET", body, cookie = "" } = {}) {
  const response = await fetch(new URL(path, base), { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { throw new Error(`${method} ${path}: non-JSON response ${response.status}: ${text.slice(0, 120)}`); }
  return { status: response.status, body: data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function login(email, loginPassword = "Demo@123") {
  const response = await call("/api/auth/login", { method: "POST", body: { email, password: loginPassword } });
  assert.equal(response.status, 200, `Login isolated account: ${JSON.stringify(response.body)}`);
  return response.cookie;
}
async function register(label, birthDate = "2000-01-15") {
  const response = await createQaCustomer(base, { name: `Membership QA ${label}`, email: `membership-${label}-${stamp}@cineverse.test`, password, birthDate });
  if (response.body.user?.id) fixtures.users.push(response.body.user.id);
  assert.equal(response.status, 200, `Register ${label}: ${JSON.stringify(response.body)}`);
  return { ...response.body.user, cookie: response.cookie };
}
async function create(resource, body, cookie) {
  const response = await call(`/api/admin/${resource}`, { method: "POST", body, cookie });
  const key = { users: "user", movies: "movie", rooms: "room", showtimes: "showtime", combos: "combo", promotions: "promotion" }[resource];
  if (response.body[key]?.id) fixtures[resource].push(response.body[key].id);
  assert.equal(response.status, 201, `Create ${resource}: ${JSON.stringify(response.body)}`);
  return response.body[key];
}
async function book(user, showtime, seats, extras = {}) {
  const holdToken = randomUUID();
  const path = `/api/showtimes/${showtime.id}/seats`;
  const held = await call(path, { method: "PUT", cookie: user.cookie, body: { holdToken, seats } });
  if (held.status !== 200) return held;
  try {
    const response = await call("/api/bookings", { method: "POST", cookie: user.cookie, body: { showtimeId: showtime.id, holdToken, seats, combos: [], paymentMethod: "momo", ...extras } });
    if (response.body.booking?.id) fixtures.bookings.push(response.body.booking.id);
    return response;
  } finally {
    await call(path, { method: "DELETE", cookie: user.cookie, body: { holdToken } });
  }
}
async function membership(user) {
  const result = await call("/api/membership/me", { cookie: user.cookie });
  assert.equal(result.status, 200, `Read member account: ${JSON.stringify(result.body)}`);
  return result.body.membership;
}
async function cancel(user, booking) {
  return call(`/api/bookings/${booking.id}`, { method: "PATCH", cookie: user.cookie, body: { action: "cancel" } });
}
function testCalendarRules() {
  check(vietnamToday("2026-12-31T17:00:00Z") === "2027-01-01", "Membership dates use Vietnam's day across UTC midnight");
  check(validateBirthDate("2027-01-01", "2026-12-31T17:00:00Z") === "2027-01-01", "DOB validation accepts today's date in Vietnam");
  for (const value of [undefined, null, "", "2026-2-03", "2000-02-30", "2001-02-29", "1899-12-31", "2027-01-02", "2000-01-01T00:00:00Z"]) {
    assert.throws(() => validateBirthDate(value, "2026-12-31T17:00:00Z")); assertions++;
  }
  check(validateBirthDate("2000-02-29", "2026-10-10T00:00:00Z") === "2000-02-29", "Real leap-day birthday is valid");
  for (const [now, active] of [["2026-10-04", false], ["2026-10-05", true], ["2026-10-25", true], ["2026-10-26", false]]) {
    check(birthdayWindow("2000-10-15", `${now}T05:00:00Z`).active === active, `Birthday window is inclusive on both tenth days (${now})`);
  }
  const nextYear = birthdayWindow("2000-01-05", "2026-12-29T05:00:00Z");
  check(nextYear.active && nextYear.year === 2027 && nextYear.startsOn === "2026-12-26" && nextYear.endsOn === "2027-01-15", "January anniversary can start in December with next-year claim key");
  const previousYear = birthdayWindow("2000-12-28", "2027-01-04T05:00:00Z");
  check(previousYear.active && previousYear.year === 2026 && previousYear.endsOn === "2027-01-07", "December anniversary remains available into January with same claim key");
  check(birthdayWindow("2000-02-29", "2027-02-18T05:00:00Z").active && !birthdayWindow("2000-02-29", "2027-02-17T05:00:00Z").active, "Leap-day birthday maps to February 28 in ordinary years");
  check(birthdayWindow("2000-02-29", "2028-02-19T05:00:00Z").active && !birthdayWindow("2000-02-29", "2028-02-18T05:00:00Z").active, "Leap-year anniversary retains February 29");
  check(!birthdayWindow(null).active, "Legacy member without a birthday receives no birthday eligibility");
  check(membershipTier(99).minPoints === 0 && membershipTier(100).minPoints === 100 && membershipTier(299).minPoints === 100 && membershipTier(300).minPoints === 300 && membershipTier(1000).minPoints === 1000, "Tier thresholds use 100, 300, and 1000 lifetime points");
}

testCalendarRules();
if (process.argv.includes("--rules-only")) {
  console.log(`\n${assertions} membership rule assertions passed.`);
  process.exit(0);
}
if (!existsSync(".sites-runtime/db-init.json")) throw new Error("Run npm run db:init before testing membership.");

try {
  const admin = await login("admin@cineverse.vn");
  const staff = await login("staff@cineverse.vn");
  for (const path of ["/api/membership/me", "/api/admin/users", "/api/admin/rewards"]) check((await call(path)).status === 401, `${path} requires authentication`);
  for (const birthDate of [undefined, "", "2001-02-29", "2000-13-01", "2000-01-32", "1899-12-31", "2999-01-01", "01/01/2000"]) {
    const invalid = await call("/api/auth/register", { method: "POST", body: { name: "Invalid DOB QA", email: `invalid-${randomUUID()}@cineverse.test`, password, birthDate } });
    if (invalid.body.user?.id) fixtures.users.push(invalid.body.user.id);
    check(invalid.status === 400, `Registration rejects missing, impossible, or future birth date (${String(birthDate)})`);
  }
  const own = await register("own");
  const other = await register("other");
  const legacy = await register("legacy");
  const birthday = await register("birthday", `2000${vietnamToday().slice(4)}`);
  for (const cookie of [own.cookie, staff]) {
    check((await call("/api/admin/users", { cookie })).status === 403, "Only admin can list all accounts and balances");
    check((await call("/api/admin/users", { method: "POST", cookie, body: { name: "Forged", email: `forged-${stamp}@cineverse.test`, password, role: "admin", birthDate: "2000-01-15" } })).status === 403, "Members and staff cannot create administrative accounts");
    check((await call(`/api/admin/users/${other.id}`, { method: "PATCH", cookie, body: { birthDate: "2000-05-01" } })).status === 403, "Members and staff cannot edit another account's birthday");
    check((await call(`/api/admin/users/${other.id}`, { method: "DELETE", cookie })).status === 403, "Members and staff cannot delete accounts");
  }
  check((await call("/api/membership/me", { cookie: admin })).status === 403, "Administrator cannot act as a customer member");
  check((await call("/api/membership/me", { method: "PATCH", cookie: own.cookie, body: { birthDate: "2000-05-01" } })).status === 409, "Customer cannot change a birthday supplied at registration");
  execute(`UPDATE users SET birth_date=NULL WHERE id=${quote(legacy.id)};`);
  const dobRace = await Promise.all(["2000-03-01", "2000-03-02"].map(birthDate => call("/api/membership/me", { method: "PATCH", cookie: legacy.cookie, body: { birthDate } })));
  check(dobRace.filter(result => result.status === 200).length === 1 && dobRace.filter(result => result.status === 409).length === 1, "Concurrent first birthday saves accept exactly one value for a legacy account");
  const legacySaved = (await call("/api/auth/me", { cookie: legacy.cookie })).body.user.birthDate;
  check(["2000-03-01", "2000-03-02"].includes(legacySaved), "Saved birthday is persisted in the member's profile");
  for (const body of [{ birthDate: null }, { points: 10000 }, { birthDate: "2000-03-01", userId: other.id }]) check([400, 409].includes((await call("/api/membership/me", { method: "PATCH", cookie: legacy.cookie, body })).status), "Member profile endpoint rejects date clearing and forged account/point fields");

  const managed = await create("users", { name: "Managed Member QA", email: `managed-${stamp}@cineverse.test`, password, role: "user", birthDate: "2000-02-29" }, admin);
  check(managed.birthDate === "2000-02-29" && managed.role === "user", "Admin creates an account with an exact birth date");
  let managedCookie = await login(managed.email, password);
  const changed = await call(`/api/admin/users/${managed.id}`, { method: "PATCH", cookie: admin, body: { name: "Managed Member Updated", email: `managed-updated-${stamp}@cineverse.test`, role: "user", birthDate: "1999-12-31" } });
  check(changed.status === 200 && changed.body.user.birthDate === "1999-12-31" && changed.body.user.name === "Managed Member Updated", "Admin edits name, email, and previously locked birthday");
  check((await call('/api/auth/me', {cookie:managedCookie})).body.user === null, 'Email change revokes previous session');
  managedCookie = await login(changed.body.user.email, password);
  const newPassword = 'ResetMember@456';
  check((await call(`/api/admin/users/${managed.id}`, {method:'PATCH',cookie:admin,body:{password:newPassword}})).status === 200, 'Admin resets password');
  check((await call('/api/auth/me', {cookie:managedCookie})).body.user === null, 'Password reset revokes previous session');
  check((await call('/api/auth/login', {method:'POST',body:{email:changed.body.user.email,password}})).status === 401, 'Old password rejected after reset');
  managedCookie = await login(changed.body.user.email, newPassword);
  for (const body of [{ birthDate: "2001-02-29" }, { birthDate: "2999-01-01" }, { points: 99999 }, { lifetimePoints: 99999 }, { role: "superadmin" }]) check((await call(`/api/admin/users/${managed.id}`, { method: "PATCH", cookie: admin, body })).status === 400, "Account editing rejects invalid dates, roles, and direct balance manipulation");
  const duplicate = await call("/api/admin/users", { method: "POST", cookie: admin, body: { name: "Duplicate QA", email: changed.body.user.email, password, role: "user", birthDate: "2000-01-15" } });
  check(duplicate.status === 409, "Admin cannot create duplicate email addresses");
  const temporaryAdmin = await create("users", { name: "Temporary Admin QA", email: `temporary-admin-${stamp}@cineverse.test`, password, role: "admin", birthDate: "2000-01-15" }, admin);
  const temporaryAdminCookie = await login(temporaryAdmin.email, password);
  check([400, 409].includes((await call(`/api/admin/users/${temporaryAdmin.id}`, { method: "DELETE", cookie: temporaryAdminCookie })).status), "Admin cannot delete their own active account");
  check((await call(`/api/admin/users/${randomUUID()}`, { method: "DELETE", cookie: admin })).status === 404, "Deleting an unknown account returns 404");

  // The booking/reward scenarios below use a private room and catalog fixture.
  const catalog = (await call("/api/bootstrap")).body;
  const { id: _movieId, rating: _rating, reviewCount: _reviewCount, ...movieFields } = catalog.movies.find(movie => movie.status === "now");
  const movie = await create("movies", { ...movieFields, title: `Membership QA ${stamp}`, duration: 90 }, admin);
  const room = await create("rooms", { name: `Membership QA ${stamp}`, rows: 10, cols: 10, type: "Standard" }, admin);
  const show = await create("showtimes", { movieId: movie.id, roomId: room.id, startTime: new Date(Date.now() + 90 * 60000).toISOString(), price: 100000, format: "Membership QA" }, admin);
  const combo = await create("combos", { name: `Membership Combo ${stamp}`, description: "QA isolated combo", price: 20000, image: "/images/combo-solo.svg" }, admin);
  const promotion = await create("promotions", { code: `MQ${stamp.replaceAll("-", "").slice(-14)}`, discountPercent: 10, minTotal: 0, active: true }, admin);

  const before = await membership(own);
  check(before.points === 0 && before.lifetimePoints === 0 && before.cardNumber.startsWith("CV"), "New member receives a stable card and zero balance");
  check((await membership(birthday)).birthday.active && !(await membership(birthday)).birthday.used, "Birthday notification active for today's birthday");
  const full = await book(own, show, ["A1"], { combos: [{ id: combo.id, qty: 1 }] });
  check(full.status === 201 && full.body.booking.total === 120000, "Server calculates ticket and combo total");
  check((await membership(own)).points === 0, "Payment alone does not award points before check-in");
  const checkins = await Promise.all([1, 2].map(() => call(`/api/bookings/${full.body.booking.id}`, { method: "PATCH", cookie: staff, body: { action: "checkin" } })));
  check(checkins.filter(r => r.status === 200).length === 1 && checkins.filter(r => r.status === 409).length === 1, "Concurrent check-ins award points only once");
  check((await membership(own)).points === 12 && (await membership(own)).lifetimePoints === 12, "Earn one point per 10,000VND net paid at check-in");
  const spent = await book(own, show, ["A2"], { redeemPoints: 10 });
  check(spent.status === 201 && spent.body.booking.total === 90000 && spent.body.booking.pointsSpent === 10, "Ten points reduce the order by10,000VND");
  check((await membership(own)).points === 2, "Booking atomically deducts spent points");
  const cancellations = await Promise.all([1,2].map(() => cancel(own, spent.body.booking)));
  check(cancellations.filter(r => r.status === 200).length === 1 && cancellations.filter(r => r.status === 409).length === 1, "Concurrent cancellation refunds only once");
  check((await membership(own)).points === 12 && (await membership(own)).lifetimePoints === 12, "Cancellation restores spent balance without changing lifetime points");
  for (const extras of [{ redeemPoints: -1 }, { redeemPoints: 1.5 }, { redeemPoints: '1' }, { redeemPoints: 13 }, { useBirthday: 'true' }, { promotionCode: promotion.code, redeemPoints: 1 }, { redeemPoints: 1, useBirthday: true }]) check((await book(own, show, ["A3"], extras)).status === 400, "Invalid, unaffordable and stacked benefits rejected");
  execute(`UPDATE users SET points=100,lifetime_points=100 WHERE id=${quote(other.id)};`);
  check((await book(other, show, ["A3"], { redeemPoints: 31 })).status === 400, "Point discount cannot exceed30percent");
  check((await membership(other)).tier.name === "Bạc", "Lifetime100points reaches Silver");
  const seatCollision = await book(other, show, ["A1"], { redeemPoints: 10 });
  check(seatCollision.status === 409 && (await membership(other)).points === 100, "Seat collision rolls back the points debit");
  execute(`UPDATE users SET points=30 WHERE id=${quote(other.id)};`);
  const spendRace = await Promise.all(["A4", "A5"].map(seat => book(other, show, [seat], { redeemPoints: 30 })));
  check(spendRace.filter(r => r.status === 201).length === 1 && spendRace.filter(r => [400,409].includes(r.status)).length === 1 && (await membership(other)).points === 0, "Parallel booking cannot spend the same points twice");
  await cancel(other, spendRace.find(r => r.status === 201).body.booking);
  check((await membership(other)).points === 30, "Race winner cancellation restores exact points");
  const promoBooking = await book(own, show, ["B1"], { promotionCode: promotion.code });
  check(promoBooking.status === 201 && promoBooking.body.booking.total === 90000, "Existing promo remains available");
  await call(`/api/bookings/${promoBooking.body.booking.id}`, { method: "PATCH", cookie: staff, body: { action: "checkin" } });
  check((await membership(own)).points === 21 && (await membership(own)).lifetimePoints === 21, "Promo earns on net90,000VND not full price");
  const birthdayRace = await Promise.all(["B2", "B3"].map(seat => book(birthday, show, [seat], { useBirthday: true })));
  const birthdayWinner = birthdayRace.find(r => r.status === 201);
  check(Boolean(birthdayWinner) && birthdayRace.filter(r => r.status === 201).length === 1 && birthdayWinner.body.booking.total === 80000, "Birthday20percent discount usable by one concurrent order only");
  check((await membership(birthday)).birthday.used, "Birthday offer displays used after payment");
  await cancel(birthday, birthdayWinner.body.booking);
  check(!(await membership(birthday)).birthday.used, "Cancellation releases birthday entitlement");
  const birthdaySeatFailure = await book(birthday, show, ["A1"], { useBirthday: true });
  check(birthdaySeatFailure.status === 409 && !(await membership(birthday)).birthday.used, "Seat failure does not consume birthday entitlement");
  const outside = `2000-${String((Number(vietnamToday().slice(5,7)) + 5) % 12 + 1).padStart(2,'0')}-15`;
  await call(`/api/admin/users/${own.id}`, { method: "PATCH", cookie: admin, body: { birthDate: outside } });
  check((await book(own, show, ["B4"], { useBirthday: true })).status === 400, "Birthday discount denied outside21day window");
  for (const cookie of [staff, admin]) check((await call('/api/membership/redeem', { method:'POST', cookie, body:{ rewardKey:'keepsake' } })).status === 403, "Staff/admin cannot redeem member points");
  check((await call('/api/membership/redeem', { method:'POST', cookie:own.cookie, body:{ rewardKey:'keepsake' } })).status === 400, "Insufficient balance cannot create a voucher");
  execute(`UPDATE users SET points=50,lifetime_points=300 WHERE id=${quote(other.id)};`);
  const redeemRace = await Promise.all([1,2].map(() => call('/api/membership/redeem', { method:'POST', cookie:other.cookie, body:{ rewardKey:'keepsake' } })));
  check(redeemRace.filter(r=>r.status===200 || r.status===201).length===1 && (await membership(other)).points===0, "Concurrent gift redemption never overdrafts balance");
  const gift = (await membership(other)).redemptions.find(r=>r.type==='gift');
  check((await membership(other)).tier.name==='Vàng', "Redeeming points does not lower earned tier");
  check((await call('/api/admin/rewards',{cookie:own.cookie})).status===403, 'Customers cannot list other members reward codes');
  check((await call('/api/admin/rewards',{cookie:staff})).body.rewards.some(r=>r.id===gift.id), 'Staff can look up member rewards');
  check((await call(`/api/admin/rewards/${gift.id}`, {method:'PATCH',cookie:own.cookie,body:{action:'fulfill'}})).status===403, 'Customers cannot fulfill gifts');
  const fulfillRace=await Promise.all([staff,admin].map(cookie=>call(`/api/admin/rewards/${gift.id}`,{method:'PATCH',cookie,body:{action:'fulfill'}})));
  check(fulfillRace.filter(r=>r.status===200).length===1&&fulfillRace.filter(r=>r.status===409).length===1, 'Concurrent staff/admin fulfillment accepts exactly one request');
  check((await call(`/api/admin/rewards/${gift.id}`,{method:'PATCH',cookie:admin,body:{action:'fulfill'}})).status===409, "Gift code cannot be fulfilled twice");
  execute(`UPDATE users SET points=240,lifetime_points=1000 WHERE id=${quote(other.id)};`);
  const comboRedemption=await call('/api/membership/redeem',{method:'POST',cookie:other.cookie,body:{rewardKey:'popcorn-combo'}});
  check([200,201].includes(comboRedemption.status), "Member can redeem combo");
  const comboReward=(await membership(other)).redemptions.find(r=>r.type==='combo');
  check((await call(`/api/admin/rewards/${comboReward.id}`,{method:'PATCH',cookie:staff,body:{action:'fulfill'}})).status===200, 'Staff can apply a redeemed combo for the customer');
  const staffId=(await call('/api/auth/me',{cookie:staff})).body.user.id;
  check(execute(`SELECT fulfilled_by FROM membership_rewards WHERE id=${quote(comboReward.id)}`)[0].fulfilled_by===staffId,'Fulfillment audit records the staff account');
  check((await call(`/api/admin/rewards/${comboReward.id}`,{method:'PATCH',cookie:staff,body:{action:'fulfill'}})).status===409,'Staff cannot reuse a fulfilled combo');
  const voucherResponse=await call('/api/membership/redeem',{method:'POST',cookie:other.cookie,body:{rewardKey:'movie-ticket'}});
  check([200,201].includes(voucherResponse.status) && (await membership(other)).points===40, "Combo80 and ticket120 deduct correct costs");
  const voucher=(await membership(other)).redemptions.find(r=>r.type==='ticket');
  check((await membership(other)).tier.name==='Kim cương', "Lifetime1000 reaches Diamond");
  check(!(await membership(own)).redemptions.some(r=>r.id===voucher.id), "Member wallet hides other members' vouchers");
  check((await book(own,show,['C1'],{rewardId:voucher.id})).status===400, "Cannot spend another member's ticket voucher");
  const ticketRace=await Promise.all(['C2','C3'].map(seat=>book(other,show,[seat],{rewardId:voucher.id,combos:[{id:combo.id,qty:1}]})));
  const ticketWinner=ticketRace.find(r=>r.status===201);
  check(ticketRace.filter(r=>r.status===201).length===1 && ticketWinner.body.booking.total===20000, "Ticket voucher coversone seat but notcombo, and concurrent reuse rejected");
  await cancel(other,ticketWinner.body.booking);
  check((await membership(other)).redemptions.find(r=>r.id===voucher.id).status==='available', "Cancellation restores ticket voucher without refunding redemptionpoints");
  check((await membership(other)).points===40, "Voucher cancellation does not mint extra points");
  const ticketAgain=await book(other,show,['C4'],{rewardId:voucher.id});
  check(ticketAgain.status===201 && ticketAgain.body.booking.total===0, "One-seat voucher may fullycover ticket");
  await call(`/api/bookings/${ticketAgain.body.booking.id}`,{method:'PATCH',cookie:staff,body:{action:'checkin'}});
  check((await membership(other)).points===40, "Zero-paid ticket earns no points");
  const adminUsers=(await call('/api/admin/users',{cookie:admin})).body.users;
  check(adminUsers.find(u=>u.id===other.id).points===40 && adminUsers.find(u=>u.id===other.id).tier.name==='Kim cương', "Admin sees accurate points and tier");
  const bootstrapOwn=(await call('/api/bootstrap',{cookie:own.cookie})).body;
  check(bootstrapOwn.membership.points===(await membership(own)).points && !(await call('/api/bootstrap')).body.membership, "Bootstrap exposes membership only for current authenticatedmember");

  const reviewBookingId = randomUUID(); fixtures.bookings.push(reviewBookingId);
  const pastShowId = randomUUID(); fixtures.showtimes.push(pastShowId);
  const reviewId = randomUUID();
  execute([
    `INSERT INTO showtimes(id,movie_id,room_id,start_time,price,format) VALUES(${quote(pastShowId)},${quote(movie.id)},${quote(room.id)},${quote(new Date(Date.now() - 5 * 3600000).toISOString())},100000,'QA history')`,
    `INSERT INTO bookings(id,user_id,showtime_id,seats,combos,total,code,status,created_at,payment_method) VALUES(${quote(reviewBookingId)},${quote(managed.id)},${quote(pastShowId)},'["J10"]','[]',100000,${quote(`MEMQA-${reviewBookingId}`)},'checked_in',${quote(new Date().toISOString())},'momo')`,
    `INSERT INTO reviews(id,user_id,movie_id,booking_id,author_name,rating,comment,created_at) VALUES(${quote(reviewId)},${quote(managed.id)},${quote(movie.id)},${quote(reviewBookingId)},'Managed Member Updated',8,'Review must survive account deletion',${quote(new Date().toISOString())})`,
  ].join(";\n") + ";");
  const deleted = await call(`/api/admin/users/${managed.id}`, { method: "DELETE", cookie: admin });
  check(deleted.status === 200, "Admin deletes an account with booking and review history using soft deletion");
  check((await call("/api/auth/login", { method: "POST", body: { email: changed.body.user.email, password: newPassword } })).status === 401, "Deleted account cannot sign in");
  check((await call("/api/auth/me", { cookie: managedCookie })).body.user === null && (await call("/api/membership/me", { cookie: managedCookie })).status === 401, "Deleting account invalidates its existing session");
  check(!(await call("/api/admin/users", { cookie: admin })).body.users.some(user => user.id === managed.id), "Deleted account disappears from active administrative account list");
  const retained = (await call(`/api/movies/${movie.id}/reviews`)).body;
  check(retained.reviews.some(review => review.id === reviewId && review.rating === 8) && retained.rating === 8, "Account deletion preserves public review and its contribution to the overall score");
  check(execute(`SELECT id FROM bookings WHERE id=${quote(reviewBookingId)};`).length === 1, "Account deletion preserves historical ticket");
  console.log(`\n${assertions} membership integration assertions passed.`);
} finally {
  if (fixtures.users.length || fixtures.movies.length) {
    execute([
      `DELETE FROM membership_transactions WHERE user_id IN (${ids(fixtures.users)})`,
      `DELETE FROM membership_reward_claims WHERE booking_id IN (SELECT id FROM bookings WHERE user_id IN (${ids(fixtures.users)}))`,
      `DELETE FROM membership_birthday_claims WHERE user_id IN (${ids(fixtures.users)})`,
      `DELETE FROM membership_rewards WHERE user_id IN (${ids(fixtures.users)})`,
      `DELETE FROM reviews WHERE user_id IN (${ids(fixtures.users)})`,
      `DELETE FROM booked_seats WHERE booking_id IN (SELECT id FROM bookings WHERE user_id IN (${ids(fixtures.users)}))`,
      `DELETE FROM bookings WHERE user_id IN (${ids(fixtures.users)})`,
      `DELETE FROM sessions WHERE user_id IN (${ids(fixtures.users)})`,
      `DELETE FROM users WHERE id IN (${ids(fixtures.users)})`,
      ...["showtimes", "rooms", "movies", "combos", "promotions"].map(table => `DELETE FROM ${table} WHERE id IN (${ids(fixtures[table])})`),
    ].join(";\n") + ";");
    console.log("Isolated membership fixtures cleaned up.");
  }
}
