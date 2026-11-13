import assert from "node:assert/strict";
import { createQaCustomer } from './qa-customer.mjs';
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Creates only isolated fixtures and always removes them. Existing customers,
// bookings and the server clock are never modified.
const base = new URL(process.argv.find(arg => /^https?:\/\//.test(arg)) || "http://localhost:5173");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Review tests require a local development server.");
if (!existsSync(".sites-runtime/db-init.json")) throw new Error("Run npm run db:init before testing reviews.");
const stamp = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
const fixtures = { users: [], movies: [], rooms: [], showtimes: [], bookings: [] };
const fixtureSqlPath = resolve(".sites-runtime", `review-test-${stamp}.sql`);
let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions++; console.log(`OK ${message}`); }
function quote(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function ids(values) { return values.map(value => { assert.match(value, /^[a-f0-9-]{36}$/); return quote(value); }).join(",") || "''"; }
function execute(sql, { allowFailure = false } = {}) {
  writeFileSync(fixtureSqlPath, sql, "utf8");
  try {
    const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--persist-to", ".wrangler/state", "--config", ".sites-runtime/db-init.json", "--file", fixtureSqlPath, "--json"], { encoding: "utf8", env: process.env, windowsHide: true });
    if (!allowFailure && result.status !== 0) throw new Error(`Local fixture SQL failed: ${result.stderr || result.stdout || result.error}`);
    return result;
  } finally { rmSync(fixtureSqlPath, { force: true }); }
}
async function call(path, { method = "GET", body, cookie = "" } = {}) {
  const response = await fetch(new URL(path, base), { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const content = await response.text();
  let data; try { data = JSON.parse(content); } catch { data = null; }
  return { status: response.status, body: data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function login(email) {
  const response = await call("/api/auth/login", { method: "POST", body: { email, password: "Demo@123" } });
  assert.equal(response.status, 200, `Login ${email}`);
  return response.cookie;
}
async function register(label) {
  const response = await createQaCustomer(base, { name: `Review QA ${label}`, email: `reviews-${label}-${stamp}@cineverse.test`, password: "ReviewTest@123", birthDate: "2000-01-15" });
  assert.equal(response.status, 200, `Register isolated ${label} customer`);
  fixtures.users.push(response.body.user.id);
  return { ...response.body.user, cookie: response.cookie };
}
async function create(resource, body, cookie) {
  const response = await call(`/api/admin/${resource}`, { method: "POST", body, cookie });
  const key = { movies: "movie", rooms: "room" }[resource];
  if (response.body?.[key]?.id) fixtures[resource].push(response.body[key].id);
  assert.equal(response.status, 201, `Create isolated ${resource}: ${JSON.stringify(response.body)}`);
  return response.body[key];
}
function screeningSql(movie, room, startTime, viewers) {
  const showId = randomUUID(); fixtures.showtimes.push(showId);
  const statements = [`INSERT INTO showtimes (id,movie_id,room_id,start_time,price,format) VALUES (${quote(showId)},${quote(movie.id)},${quote(room.id)},${quote(startTime)},50000,'Review QA 2D')`];
  for (const [index, { user, status = "checked_in" }] of viewers.entries()) {
    const id = randomUUID(); fixtures.bookings.push(id);
    statements.push(`INSERT INTO bookings (id,user_id,showtime_id,seats,combos,total,code,status,created_at,payment_method) VALUES (${quote(id)},${quote(user.id)},${quote(showId)},${quote(JSON.stringify([`A${index + 1}`]))},'[]',50000,${quote(`REVIEW-QA-${id}`)},${quote(status)},${quote(new Date().toISOString())},'momo')`);
  }
  return statements.join(";\n") + ";";
}
function safePublicReview(review, knownEmails) {
  const forbiddenKeys = /^(?:email|userId|user_id|bookingId|booking_id|password|password_hash|session|token|paymentMethod|payment_method)$/i;
  const visit = value => {
    if (!value || typeof value !== "object") return true;
    return Object.entries(value).every(([key, nested]) => !forbiddenKeys.test(key) && visit(nested));
  };
  return visit(review) && knownEmails.every(email => !JSON.stringify(review).includes(email));
}

try {
  const admin = await login("admin@cineverse.vn");
  const staff = await login("staff@cineverse.vn");
  const own = await register("own");
  const other = await register("other");
  const invalid = await register("ineligible");
  const outsider = await register("outsider");
  const catalog = (await call("/api/bootstrap")).body;
  const { id: _id, rating: _rating, reviewCount: _count, ...template } = catalog.movies.find(movie => movie.status === "now");
  const movies = {};
  for (const label of ["main", "waiting", "cancelled", "paid", "pending", "future", "running"]) {
    movies[label] = await create("movies", { ...template, title: `Review QA ${label} ${stamp}`, duration: 90 }, admin);
  }
  const room = await create("rooms", { name: `Review QA ${stamp}`, rows: 2, cols: 8, type: "Standard" }, admin);
  const minutesAgo = minutes => new Date(Date.now() - minutes * 60000).toISOString();
  execute([
    screeningSql(movies.main, room, minutesAgo(240), [{ user: own }, { user: own }, { user: other }]),
    screeningSql(movies.waiting, room, minutesAgo(420), [{ user: own }, { user: own }]),
    screeningSql(movies.cancelled, room, minutesAgo(600), [{ user: invalid, status: "cancelled" }]),
    screeningSql(movies.paid, room, minutesAgo(780), [{ user: invalid, status: "paid" }]),
    screeningSql(movies.pending, room, minutesAgo(960), [{ user: invalid, status: "pending" }]),
    screeningSql(movies.future, room, minutesAgo(-180), [{ user: invalid }]),
    screeningSql(movies.running, room, minutesAgo(30), [{ user: invalid }]),
  ].join("\n"));
  const path = `/api/movies/${movies.main.id}/reviews`;
  const valid = { rating: 8, comment: "Phim có câu chuyện cuốn hút, âm thanh tốt và đáng để trải nghiệm." };

  const initial = await call(path);
  check(initial.status === 200 && initial.body.rating === 0 && initial.body.reviewCount === 0 && initial.body.total === 0 && initial.body.reviews.length === 0, "New movie has zero audience ratings and an empty public review list");
  check(initial.body.canReview === false && initial.body.ownReview === null, "Anonymous viewer cannot review");
  check((await call(path, { method: "POST", body: valid })).status === 401, "Posting requires authentication");
  check((await call("/api/reviews/me")).status === 401, "Personal movie review library requires authentication");
  for (const [role, cookie] of [["admin", admin], ["staff", staff]]) {
    check((await call(path, { method: "POST", body: valid, cookie })).status === 403, `${role} cannot publish an audience review`);
    check((await call("/api/reviews/me", { cookie })).status === 403, `${role} cannot use the customer review library`);
  }
  check((await call(path, { method: "POST", body: valid, cookie: outsider.cookie })).status === 403, "Customer without a watched booking cannot review");
  for (const label of ["cancelled", "paid", "pending", "future", "running"]) {
    const target = `/api/movies/${movies[label].id}/reviews`;
    check((await call(target, { cookie: invalid.cookie })).body.canReview === false, `${label} screening is not eligible in the public response`);
    check((await call(target, { method: "POST", body: valid, cookie: invalid.cookie })).status === 403, `${label} screening cannot be reviewed`);
  }
  const ineligibleLibrary = await call("/api/reviews/me", { cookie: invalid.cookie });
  check(ineligibleLibrary.body.reviewed.length === 0 && ineligibleLibrary.body.unreviewed.length === 0, "Unwatched, cancelled and incomplete screenings are absent from the library");
  check((await call(`/api/movies/${randomUUID()}/reviews`)).status === 404, "Unknown movie returns 404");

  const eligible = await call(path, { cookie: own.cookie });
  check(eligible.body.canReview === true && eligible.body.ownReview === null, "Checked-in customer becomes eligible after the screening ends");
  const before = (await call("/api/reviews/me", { cookie: own.cookie })).body;
  check(before.reviewed.length === 0 && before.unreviewed.length === 2 && new Set(before.unreviewed.map(item => item.movie.id)).size === 2, "Multiple tickets for one watched movie produce one unreviewed item");
  check(before.unreviewed.every(item => Number.isFinite(Date.parse(item.watchedAt)) && Date.parse(item.watchedAt) <= Date.now()), "Personal library includes past watched timestamps");
  for (const body of [
    { ...valid, rating: 0 }, { ...valid, rating: 11 }, { ...valid, rating: 5.5 }, { ...valid, rating: "8" }, { comment: valid.comment },
    { ...valid, comment: "" }, { ...valid, comment: "   " }, { ...valid, comment: "x".repeat(2001) }, { ...valid, comment: 123 }, { rating: 8 },
  ]) check((await call(path, { method: "POST", body, cookie: own.cookie })).status === 400, `Invalid review rejected (${JSON.stringify(body).slice(0, 80)})`);

  check((await call(path, { method: "POST", body: { ...valid, userId: other.id, movieId: movies.waiting.id }, cookie: own.cookie })).status === 400, "Review body cannot override the authenticated customer or target movie");
  const race = await Promise.all([0, 1].map(() => call(path, { method: "POST", body: valid, cookie: own.cookie })));
  check(race.filter(result => result.status === 201).length === 1 && race.filter(result => result.status === 409).length === 1, "Concurrent submissions allow only one review per customer and movie");
  const first = race.find(result => result.status === 201).body;
  check(first.review.rating === 8 && first.review.comment === valid.comment && first.rating === 8 && first.reviewCount === 1, "Accepted review immediately updates the average and count");
  check((await call(path, { method: "POST", body: { ...valid, rating: 1 }, cookie: own.cookie })).status === 409, "A repeat viewing or second submission cannot create another rating");
  const second = await call(path, { method: "POST", body: { rating: 5, comment: "Một vài đoạn hơi chậm nhưng hình ảnh rất đẹp." }, cookie: other.cookie });
  check(second.status === 201 && second.body.rating === 6.5 && second.body.reviewCount === 2, "Each verified customer contributes equally to the movie average");

  const publicList = (await call(path)).body;
  check(publicList.rating === 6.5 && publicList.reviewCount === 2 && publicList.total === 2 && publicList.reviews.length === 2, "Public review list and summary agree with persisted ratings");
  const secondPage = (await call(`${path}?offset=1`)).body;
  check(secondPage.reviews.length === 1 && secondPage.reviews[0].id === publicList.reviews[1].id && secondPage.nextOffset === null && secondPage.total === 2, "Review pagination preserves ordering and full aggregate");
  const emptyPage = (await call(`${path}?offset=2`)).body;
  check(emptyPage.reviews.length === 0 && emptyPage.nextOffset === null && emptyPage.total === 2, "Pagination beyond the final review returns an empty page");
  for (const offset of ["-1", "abc", "9007199254740992"]) check((await call(`${path}?offset=${offset}`)).status === 400, `Invalid pagination offset ${offset} is rejected`);
  check(publicList.reviews.every(review => safePublicReview(review, [own.email, other.email, invalid.email, outsider.email])), "Public reviews expose no email, account ID, booking, credential or payment fields");
  check(publicList.ownReview === null && publicList.canReview === false, "Public response contains no private viewer review state");
  const ownAfter = (await call(path, { cookie: own.cookie })).body;
  check(ownAfter.canReview === false && ownAfter.ownReview?.id === first.review.id, "Submitting customer sees their persisted review and cannot rate again");
  const outsiderAfter = (await call(path, { cookie: outsider.cookie })).body;
  check(outsiderAfter.ownReview === null && outsiderAfter.canReview === false, "Another account cannot inherit review ownership");
  const ownLibrary = (await call("/api/reviews/me", { cookie: own.cookie })).body;
  check(ownLibrary.reviewed.length === 1 && ownLibrary.reviewed[0].movie.id === movies.main.id && ownLibrary.reviewed[0].review.id === first.review.id, "Submitted movie moves into the customer's reviewed library");
  check(ownLibrary.unreviewed.length === 1 && ownLibrary.unreviewed[0].movie.id === movies.waiting.id, "Other watched movies remain in the unreviewed library");
  const otherLibrary = (await call("/api/reviews/me", { cookie: other.cookie })).body;
  check(otherLibrary.reviewed.length === 1 && otherLibrary.reviewed[0].review.id === second.body.review.id && otherLibrary.unreviewed.length === 0, "Libraries isolate customer reviews even for the same movie");
  const outsiderLibrary = (await call("/api/reviews/me", { cookie: outsider.cookie })).body;
  check(outsiderLibrary.reviewed.length === 0 && outsiderLibrary.unreviewed.length === 0, "Unrelated customer's library remains empty");
  const refreshed = (await call("/api/bootstrap")).body.movies.find(movie => movie.id === movies.main.id);
  check(refreshed.rating === 6.5 && refreshed.reviewCount === 2, "Customer catalog reads the aggregate from audience reviews");
  const adminMovie = (await call("/api/admin/movies", { cookie: admin })).body.movies.find(movie => movie.id === movies.main.id);
  check(adminMovie.rating === 6.5 && adminMovie.reviewCount === 2, "Admin catalog shows the same audience aggregate");
  for (const body of [{ rating: 10 }, { reviewCount: 100 }]) {
    const response = await call(`/api/admin/movies/${movies.main.id}`, { method: "PATCH", body, cookie: admin });
    check([400, 403].includes(response.status), `Admin cannot overwrite ${Object.keys(body)[0]}`);
  }
  const forbiddenCreate = await call("/api/admin/movies", { method: "POST", body: { ...template, title: `Review QA forged ${stamp}`, rating: 10 }, cookie: admin });
  if (forbiddenCreate.body?.movie?.id) fixtures.movies.push(forbiddenCreate.body.movie.id);
  check([400, 403].includes(forbiddenCreate.status), "Admin cannot assign a rating when creating a movie");
  for (const method of ["PATCH", "DELETE"]) {
    for (const endpoint of [path, `${path}/${first.review.id}`, `/api/admin/reviews/${first.review.id}`]) {
      check([403, 404, 405].includes((await call(endpoint, { method, cookie: admin, body: method === "PATCH" ? { rating: 1, comment: "Forged admin edit" } : undefined })).status), `Admin cannot ${method.toLowerCase()} review through ${endpoint.split("/").slice(0, 4).join("/")}`);
    }
  }
  const intact = (await call(path)).body;
  check(intact.rating === 6.5 && intact.reviewCount === 2 && intact.reviews.find(review => review.id === first.review.id)?.comment === valid.comment, "All admin mutation attempts leave reviews and average unchanged");

  const constraints = JSON.parse(execute("PRAGMA foreign_key_list(reviews);").stdout).flatMap(result => result.results || []);
  check(["users", "movies", "bookings"].every(table => constraints.some(constraint => constraint.table === table && ["RESTRICT", "NO ACTION"].includes(constraint.on_delete))), "Database review references prevent cascading deletion of users, movies and bookings");
  check((await call(`/api/admin/movies/${movies.main.id}`, { method: "DELETE", cookie: admin })).status === 409, "Deleting a movie cannot indirectly delete customer reviews");
  const deleteBookings = execute(`DELETE FROM bookings WHERE id IN (${ids(fixtures.bookings)});`, { allowFailure: true });
  check(deleteBookings.status !== 0 && /foreign key/i.test(`${deleteBookings.stderr}\n${deleteBookings.stdout}`), "Review foreign key prevents source ticket deletion from erasing a review");
  const deleteCustomer = execute(`DELETE FROM users WHERE id=${quote(own.id)};`, { allowFailure: true });
  check(deleteCustomer.status !== 0 && /foreign key/i.test(`${deleteCustomer.stderr}\n${deleteCustomer.stdout}`), "Review foreign key prevents customer deletion from cascading to reviews");
  const retained = (await call(path)).body;
  check(retained.reviewCount === 2 && retained.rating === 6.5 && retained.reviews.some(review => review.id === first.review.id), "Historical reviews survive all rejected parent deletion attempts");
  console.log(`\n${assertions} review integration assertions passed.`);
} finally {
  if (fixtures.movies.length || fixtures.users.length) {
    execute([
      `DELETE FROM membership_transactions WHERE user_id IN (${ids(fixtures.users)})`,
      `DELETE FROM reviews WHERE movie_id IN (${ids(fixtures.movies)}) AND user_id IN (${ids(fixtures.users)})`,
      `DELETE FROM booked_seats WHERE booking_id IN (${ids(fixtures.bookings)})`,
      `DELETE FROM bookings WHERE id IN (${ids(fixtures.bookings)})`,
      `DELETE FROM sessions WHERE user_id IN (${ids(fixtures.users)})`,
      `DELETE FROM users WHERE id IN (${ids(fixtures.users)})`,
      `DELETE FROM showtimes WHERE id IN (${ids(fixtures.showtimes)})`,
      `DELETE FROM rooms WHERE id IN (${ids(fixtures.rooms)})`,
      `DELETE FROM movies WHERE id IN (${ids(fixtures.movies)})`,
    ].join(";\n") + ";");
    console.log("Isolated review fixtures cleaned up.");
  }
}
