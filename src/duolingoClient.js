const DEFAULT_FIELDS = [
  "id",
  "username",
  "name",
  "streak",
  "streakData{currentStreak,previousStreak}",
  "totalXp",
  "courses",
  "currentCourseId",
  "learningLanguage",
  "fromLanguage",
  "picture",
  "creationDate"
];

export class DuolingoError extends Error {
  constructor(message, { status = 502, upstreamStatus, details } = {}) {
    super(message);
    this.name = "DuolingoError";
    this.status = status;
    this.upstreamStatus = upstreamStatus;
    this.details = details;
  }
}

export class DuolingoClient {
  constructor({
    baseUrl = "https://www.duolingo.com",
    jwt = "",
    timeoutMs = 15000,
    cacheTtlMs = 60000,
    fetchFn = globalThis.fetch
  } = {}) {
    if (typeof fetchFn !== "function") {
      throw new Error("A fetch implementation is required.");
    }

    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.jwt = jwt;
    this.timeoutMs = timeoutMs;
    this.cacheTtlMs = cacheTtlMs;
    this.fetchFn = fetchFn;
    this.cache = new Map();
  }

  async getUserByUsername(username, options = {}) {
    const normalizedUsername = normalizeUsername(username);
    const url = new URL("/2017-06-30/users", this.baseUrl);
    url.searchParams.set("username", normalizedUsername);
    setFields(url, options.fields);

    const data = await this.#fetchJson(url, options);
    const user = Array.isArray(data.users) ? data.users[0] : undefined;
    if (!user) {
      throw new DuolingoError("Duolingo user was not found.", {
        status: 404,
        details: { username: normalizedUsername }
      });
    }

    return user;
  }

  async getUserById(userId, options = {}) {
    const normalizedId = normalizeUserId(userId);
    const url = new URL(`/2017-06-30/users/${normalizedId}`, this.baseUrl);
    setFields(url, options.fields);
    return this.#fetchJson(url, options);
  }

  async #fetchJson(url, options = {}) {
    const jwt = stripBearer(options.jwt || this.jwt);
    const cacheKey = `${url.toString()}::${jwt ? "auth" : "anon"}`;
    const cached = this.#getCached(cacheKey);
    if (cached) {
      return cached;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: "GET",
        headers: buildHeaders(jwt),
        signal: controller.signal
      });

      const text = await response.text();
      const data = parseJson(text);

      if (!response.ok) {
        throw new DuolingoError("Duolingo rejected the request.", {
          status: mapUpstreamStatus(response.status),
          upstreamStatus: response.status,
          details: data
        });
      }

      this.#setCached(cacheKey, data);
      return data;
    } catch (error) {
      if (error instanceof DuolingoError) {
        throw error;
      }

      if (error?.name === "AbortError") {
        throw new DuolingoError("Duolingo request timed out.", {
          status: 504
        });
      }

      throw new DuolingoError("Duolingo request failed.", {
        status: 502,
        details: { message: error?.message || String(error) }
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  #getCached(key) {
    if (this.cacheTtlMs <= 0) {
      return undefined;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  #setCached(key, value) {
    if (this.cacheTtlMs <= 0) {
      return;
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs
    });
  }
}

export function toSummary(user) {
  const courses = normalizeCourses(user?.courses);
  const totalXp =
    numberOrNull(user?.totalXp) ??
    courses.reduce((sum, course) => sum + (course.xp || 0), 0);

  return {
    id: user?.id ?? null,
    username: user?.username ?? null,
    name: user?.name ?? null,
    picture: user?.picture ?? null,
    streak: getCurrentStreak(user),
    totalXp,
    currentCourseId: user?.currentCourseId ?? null,
    learningLanguage: user?.learningLanguage ?? null,
    fromLanguage: user?.fromLanguage ?? null,
    courses
  };
}

export function toStreak(user) {
  return {
    id: user?.id ?? null,
    username: user?.username ?? null,
    streak: getCurrentStreak(user),
    rawStreak: numberOrNull(user?.streak),
    currentStreak: user?.streakData?.currentStreak ?? null,
    previousStreak: user?.streakData?.previousStreak ?? null
  };
}

export function normalizeCourses(courses) {
  if (!Array.isArray(courses)) {
    return [];
  }

  return courses
    .map((course) => ({
      id: course?.id ?? null,
      title: course?.title ?? null,
      learningLanguage: course?.learningLanguage ?? null,
      fromLanguage: course?.fromLanguage ?? null,
      xp: numberOrNull(course?.xp) ?? 0,
      crowns: numberOrNull(course?.crowns),
      healthEnabled: course?.healthEnabled ?? null,
      placementTestAvailable: course?.placementTestAvailable ?? null
    }))
    .sort((a, b) => b.xp - a.xp);
}

export function fieldsFromQuery(value) {
  if (!value) {
    return DEFAULT_FIELDS;
  }

  return String(value)
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
}

function setFields(url, fields) {
  const selected = fields && fields.length ? fields : DEFAULT_FIELDS;
  url.searchParams.set("fields", selected.join(","));
}

function buildHeaders(jwt) {
  const headers = {
    Accept: "application/json",
    "User-Agent": "Dualingo-api-unofficial/1.0"
  };

  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
    headers.Cookie = `jwt_token=${jwt}`;
  }

  return headers;
}

function getCurrentStreak(user) {
  const candidates = [
    user?.streak,
    user?.streakData?.currentStreak?.length,
    user?.streakData?.currentStreak?.count,
    user?.streakData?.currentStreak?.days
  ]
    .map(numberOrNull)
    .filter((value) => value !== null);

  return candidates.length ? Math.max(...candidates) : 0;
}

function normalizeUsername(username) {
  const value = String(username || "").trim();
  if (!/^[A-Za-z0-9_.-]{2,40}$/.test(value)) {
    throw new DuolingoError("Invalid username.", {
      status: 400,
      details: { username }
    });
  }

  return value;
}

function normalizeUserId(userId) {
  const value = String(userId || "").trim();
  if (!/^\d+$/.test(value)) {
    throw new DuolingoError("Invalid user id.", {
      status: 400,
      details: { userId }
    });
  }

  return value;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stripBearer(token) {
  return String(token || "").replace(/^Bearer\s+/i, "").trim();
}

function parseJson(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new DuolingoError("Duolingo returned invalid JSON.", {
      status: 502,
      details: { bodyPreview: text.slice(0, 160) }
    });
  }
}

function mapUpstreamStatus(status) {
  if (status === 401 || status === 403) {
    return 401;
  }

  if (status === 404) {
    return 404;
  }

  if (status === 429) {
    return 429;
  }

  return 502;
}
