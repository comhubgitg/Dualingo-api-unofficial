import assert from "node:assert/strict";
import test from "node:test";
import {
  DuolingoClient,
  fieldsFromQuery,
  normalizeCourses,
  toStreak,
  toSummary
} from "../src/duolingoClient.js";

const sampleUser = {
  id: 123,
  username: "demo",
  name: "Demo User",
  streak: 42,
  totalXp: 3450,
  currentCourseId: "DUOLINGO_ES_EN",
  learningLanguage: "es",
  fromLanguage: "en",
  courses: [
    {
      id: "DUOLINGO_FR_EN",
      title: "French",
      learningLanguage: "fr",
      fromLanguage: "en",
      xp: 200,
      crowns: 5
    },
    {
      id: "DUOLINGO_ES_EN",
      title: "Spanish",
      learningLanguage: "es",
      fromLanguage: "en",
      xp: 3250,
      crowns: 20
    }
  ]
};

test("toSummary returns streak and courses sorted by XP", () => {
  const summary = toSummary(sampleUser);

  assert.equal(summary.streak, 42);
  assert.equal(summary.totalXp, 3450);
  assert.equal(summary.courses[0].title, "Spanish");
  assert.equal(summary.courses[0].xp, 3250);
});

test("toStreak keeps raw streak details", () => {
  assert.deepEqual(toStreak(sampleUser), {
    id: 123,
    username: "demo",
    streak: 42,
    rawStreak: 42,
    currentStreak: null,
    previousStreak: null
  });
});

test("normalizeCourses handles missing courses", () => {
  assert.deepEqual(normalizeCourses(undefined), []);
});

test("fieldsFromQuery parses comma separated fields", () => {
  assert.deepEqual(fieldsFromQuery("streak,totalXp,courses"), [
    "streak",
    "totalXp",
    "courses"
  ]);
});

test("client fetches a user by username from the Duolingo users endpoint", async () => {
  const requests = [];
  const client = new DuolingoClient({
    baseUrl: "https://example.test",
    cacheTtlMs: 0,
    fetchFn: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ users: [sampleUser] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  const user = await client.getUserByUsername("demo");

  assert.equal(user.username, "demo");
  assert.equal(requests[0].url.pathname, "/2017-06-30/users");
  assert.equal(requests[0].url.searchParams.get("username"), "demo");
});
