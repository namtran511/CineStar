import assert from "node:assert/strict";
import { createQaCustomer } from './qa-customer.mjs';
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// All claims, clock changes and cleanup target this run's isolated QA fixtures.
// Never advance the server clock or alter an existing customer's reservation.
const base = new URL(process.argv.find(arg => /^https?:\/\//.test(arg)) || "http://localhost:5173");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Seat hold tests require a local development server.");
if (!existsSync(".sites-runtime/db-init.json")) throw new Error("Run npm run db:init before testing seat holds.");
const stamp = randomUUID();
const fixture = { users: [], movies: [], rooms: [], showtimes: [], bookings: [], tokens: [] };
const sqlPath = resolve(".sites-runtime", `seat-holds-qa-${stamp}.sql`);
let assertions = 0;
function check(value, label) { assert.ok(value, label); assertions++; console.log(`OK ${label}`); }
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const ids = values => values.map(value => { assert.match(value, /^[a-f0-9-]{36}$/); return quote(value); }).join(",") || "''";
function execute(sql) {
  writeFileSync(sqlPath, sql, "utf8");
  try {
    const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--persist-to", ".wrangler/state", "--config", ".sites-runtime/db-init.json", "--file", sqlPath, "--json"], { encoding: "utf8", env: process.env, windowsHide: true });
    assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
    return JSON.parse(result.stdout).flatMap(item => item.results || []);
  } finally { rmSync(sqlPath, { force: true }); }
}
async function call(path, { method = "GET", body, cookie = "" } = {}) {
  const response = await fetch(new URL(path, base), { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { throw new Error(`${method} ${path}: ${response.status} ${text.slice(0, 150)}`); }
  return { status: response.status, body: data, cookie: response.headers.get("set-cookie")?.split(";")[0], headers: response.headers };
}
async function login(email) {
  const result = await call("/api/auth/login", { method: "POST", body: { email, password: "Demo@123" } });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.cookie;
}
async function register(label) {
  const result = await createQaCustomer(base, { name: `Seat Hold QA ${label}`, email: `seat-hold-${label}-${stamp}@cineverse.test`, password: "SeatHoldQA@123", birthDate: "2000-01-15" });
  if (result.body.user?.id) fixture.users.push(result.body.user.id);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return { ...result.body.user, cookie: result.cookie };
}
async function create(resource, body, cookie) {
  const result = await call(`/api/admin/${resource}`, { method: "POST", body, cookie });
  const key = { movies: "movie", rooms: "room", showtimes: "showtime" }[resource];
  if (result.body[key]?.id) fixture[resource].push(result.body[key].id);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body[key];
}
function token() { const value = randomUUID(); fixture.tokens.push(value); return value; }
function hold(show, user, holdToken, seats) { return call(`/api/showtimes/${show.id}/seats`, { method: "PUT", cookie: user.cookie, body: { holdToken, seats } }); }
function release(show, user, holdToken) { return call(`/api/showtimes/${show.id}/seats`, { method: "DELETE", cookie: user.cookie, body: { holdToken } }); }
function snapshot(show, user, holdToken) { return call(`/api/showtimes/${show.id}/seats${holdToken ? `?holdToken=${encodeURIComponent(holdToken)}` : ""}`, { cookie: user?.cookie || "" }); }
async function book(show, user, holdToken, seats) {
  const result = await call("/api/bookings", { method: "POST", cookie: user.cookie, body: { showtimeId: show.id, ...(holdToken ? { holdToken } : {}), seats, combos: [], paymentMethod: "bank" } });
  if (result.body.booking?.id) fixture.bookings.push(result.body.booking.id);
  return result;
}

try {
  const admin = await login("admin@cineverse.vn");
  const staff = { cookie: await login("staff@cineverse.vn") };
  const own = await register("own"), other = await register("other");
  const catalog = (await call("/api/bootstrap")).body;
  const { id: _id, rating: _rating, reviewCount: _count, ...template } = catalog.movies.find(movie => movie.status === "now");
  const movie = await create("movies", { ...template, title: `Seat Hold QA ${stamp}`, duration: 90 }, admin);
  const room = await create("rooms", { name: `Seat Hold QA ${stamp}`, rows: 4, cols: 8, type: "Standard" }, admin);
  const show = await create("showtimes", { movieId: movie.id, roomId: room.id, startTime: new Date(Date.now() + 86400000).toISOString(), price: 50000, format: "Seat Hold QA 2D" }, admin);
  const path = `/api/showtimes/${show.id}/seats`;
  check((await call(path, { method: "PUT", body: { holdToken: token(), seats: ["A1"] } })).status === 401, "Selecting a seat requires authentication");
  const ownToken = token();
  for (const seats of [["Z1"], ["A0"], ["A9"], ["A1", "A1"], ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "B1"]]) {
    check((await hold(show, own, ownToken, seats)).status === 400, "Invalid, duplicate and more than eight seats are rejected");
  }
  const first = await hold(show, own, ownToken, ["A1"]);
  check(first.status === 200 && first.body.selected.includes("A1") && !first.body.occupied.includes("A1"), "Seat is held immediately before any payment or booking");
  check(first.body.expiresAt > first.body.serverNow && first.body.expiresAt - first.body.serverNow <= 600000, "Server limits a fresh reservation to at most ten minutes");
  check(first.headers.get("cache-control")?.includes("no-store"), "Seat availability responses cannot be cached");
  check((await call(`/api/admin/showtimes/${show.id}`, { method: "PATCH", cookie: admin, body: { price: 60000 } })).status === 409, "Admin cannot change a screening while a customer holds seats");
  check((await call(`/api/admin/showtimes/${show.id}`, { method: "DELETE", cookie: admin })).status === 409, "Admin cannot delete a held screening");
  assert.equal((await hold(show, own, ownToken, ["A1", "A8"])).status, 200);
  check((await call(`/api/admin/rooms/${room.id}`, { method: "PATCH", cookie: admin, body: { cols: 4 } })).status === 409, "Admin cannot shrink a room across a held seat");
  assert.equal((await hold(show, own, ownToken, ["A1"])).status, 200);
  const publicView = await snapshot(show);
  check(publicView.body.held.includes("A1") && publicView.body.selected.length === 0, "Other visitors see the held seat as unavailable");
  check(!JSON.stringify(publicView.body).includes(own.id) && !JSON.stringify(publicView.body).includes(ownToken), "Public availability exposes no holder identity or token");
  const guessed = await snapshot(show, other, ownToken);
  check(!guessed.body.selected.includes("A1") && guessed.body.held.includes("A1"), "Knowing another token does not grant its selected seats");
  const competingToken = token();
  check((await hold(show, other, competingToken, ["A1"])).status === 409, "Another customer cannot hold a selected seat");
  check([403, 409].includes((await hold(show, other, ownToken, ["A1"])).status), "Another customer cannot take over the hold token");
  await release(show, other, ownToken);
  check((await snapshot(show, own, ownToken)).body.selected.includes("A1"), "Another customer cannot release the owner's hold");
  check((await hold(show, own, token(), ["A1"])).status === 409, "A separate tab using the same account cannot take over the held seat");
  const edited = await hold(show, own, ownToken, ["A1", "A2"]);
  check(edited.status === 200 && edited.body.expiresAt === first.body.expiresAt, "Adding or refreshing seats never extends the original deadline");
  const forgedDeadline = await call(path, { method: "PUT", cookie: own.cookie, body: { holdToken: ownToken, seats: ["A1", "A2"], expiresAt: Date.now() + 86400000 } });
  check(forgedDeadline.status === 400 || (forgedDeadline.status === 200 && forgedDeadline.body.expiresAt === first.body.expiresAt), "Client cannot extend the hold deadline with a forged expiration");
  check((await book(show, other, competingToken, ["A1"])).status === 409, "Checkout cannot bypass another customer's active hold");
  check([400, 409].includes((await book(show, own, undefined, ["A1"])).status), "Checkout without a hold token is rejected");
  const otherHeld = await hold(show, other, competingToken, ["A3"]);
  assert.equal(otherHeld.status, 200, JSON.stringify(otherHeld.body));
  check((await hold(show, own, ownToken, ["A2", "A3"])).status === 409, "Conflicting replacement selection is rejected atomically");
  const retained = await snapshot(show, own, ownToken);
  check(retained.body.selected.includes("A1") && retained.body.selected.includes("A2"), "Failed replacement retains all previously selected seats");
  await hold(show, own, ownToken, ["A2"]);
  check(!(await snapshot(show)).body.held.includes("A1"), "Deselecting a seat makes it available immediately");
  await release(show, own, ownToken);
  check(!(await snapshot(show)).body.held.includes("A2"), "Closing or changing a selection can release its seats immediately");
  await release(show, other, competingToken);

  const contenders = [own, other], raceTokens = [token(), token()];
  const race = await Promise.all(contenders.map((user, index) => hold(show, user, raceTokens[index], ["B1"])));
  check(race.filter(result => result.status === 200).length === 1 && race.filter(result => result.status === 409).length === 1, "Two concurrent selectors have exactly one winner for the same seat");
  const winner = race.findIndex(result => result.status === 200);
  const sales = await Promise.all([1, 2].map(() => book(show, contenders[winner], raceTokens[winner], ["B1"])));
  check(sales.filter(result => result.status === 201).length === 1 && sales.filter(result => result.status === 409).length === 1, "Concurrent checkout of one hold produces exactly one paid ticket");
  check(sales.find(result => result.status === 201).body.booking.status === "paid", "Owner can convert an active seat hold to a paid ticket");
  const afterSale = await snapshot(show, contenders[winner], raceTokens[winner]);
  check(afterSale.body.occupied.includes("B1") && !afterSale.body.selected.includes("B1") && !afterSale.body.held.includes("B1"), "Checkout atomically changes held seat to booked and consumes the hold");
  check((await hold(show, contenders[1 - winner], raceTokens[1 - winner], ["B1"])).status === 409, "A paid seat cannot be held again");
  const orders = (await call("/api/bookings", { cookie: admin })).body.bookings.filter(booking => booking.showtimeId === show.id);
  check(orders.length === 1, "Rejected holds and checkouts leave no orphan bookings");

  const expiringToken = token();
  assert.equal((await hold(show, own, expiringToken, ["C1"])).status, 200);
  const expiredAt = Date.now() - 10000;
  execute(`UPDATE seat_hold_sessions SET created_at=${expiredAt - 600000},expires_at=${expiredAt} WHERE id=${quote(expiringToken)};`);
  const expired = await snapshot(show, own, expiringToken);
  check(!expired.body.selected.includes("C1") && !(await snapshot(show)).body.held.includes("C1"), "Expired holds disappear without requiring an owner heartbeat");
  check((await book(show, own, expiringToken, ["C1"])).status === 409, "The server rejects checkout after the ten-minute deadline");
  const takeoverToken = token();
  check((await hold(show, other, takeoverToken, ["C1"])).status === 200, "Another customer can claim an expired seat without waiting for cleanup");
  await release(show, own, expiringToken);
  check((await snapshot(show, other, takeoverToken)).body.selected.includes("C1"), "A late release of an expired hold cannot clear a new owner's claim");
  await release(show, other, takeoverToken);
  const selectedAgain = await hold(show, own, expiringToken, ["C1"]);
  check(selectedAgain.status === 200 && selectedAgain.body.expiresAt > selectedAgain.body.serverNow && selectedAgain.body.expiresAt - selectedAgain.body.serverNow <= 600000, "After expiry, a fresh explicit selection can begin another reservation in the same dialog");

  const staffToken = token();
  check((await hold(show, staff, staffToken, ["D1"])).status === 200, "Staff can hold seats while selling at the counter");
  check((await snapshot(show, own, ownToken)).body.held.includes("D1"), "Customer availability includes seats currently held by staff");
  check((await book(show, staff, staffToken, ["D1"])).status === 201, "Counter sale also requires and consumes a valid seat hold");
  const nearShow = await create("showtimes", { movieId: movie.id, roomId: room.id, startTime: new Date(Date.now() + 11 * 60000).toISOString(), price: 50000, format: "Seat Hold QA 2D" }, admin);
  const nearHold = await hold(nearShow, own, token(), ["A1"]);
  check(nearHold.status === 200 && nearHold.body.expiresAt <= Date.parse(nearShow.startTime) - 600000 && nearHold.body.expiresAt > nearHold.body.serverNow, "Near-showtime holds end at the sales cutoff instead of promising an unusable ten minutes");
  console.log(`\n${assertions} seat hold assertions passed.`);
} finally {
  execute([
    `DELETE FROM seat_hold_sessions WHERE id IN (${ids(fixture.tokens)})`,
    `DELETE FROM membership_transactions WHERE booking_id IN (${ids(fixture.bookings)})`,
    `DELETE FROM booked_seats WHERE booking_id IN (${ids(fixture.bookings)})`,
    `DELETE FROM bookings WHERE id IN (${ids(fixture.bookings)})`,
    `DELETE FROM sessions WHERE user_id IN (${ids(fixture.users)})`,
    `DELETE FROM users WHERE id IN (${ids(fixture.users)})`,
    `DELETE FROM showtimes WHERE id IN (${ids(fixture.showtimes)})`,
    `DELETE FROM rooms WHERE id IN (${ids(fixture.rooms)})`,
    `DELETE FROM movies WHERE id IN (${ids(fixture.movies)})`,
  ].join(";\n") + ";");
  console.log("Isolated seat hold fixtures removed; immutable QA audit records retained.");
}
