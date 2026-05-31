# Dualingo API Unofficial

Unofficial read-only API wrapper for Duolingo profile stats. It returns streak data, total XP, and XP per course.

This is not an official Duolingo API. Duolingo can change or block the underlying endpoints at any time. Use it gently and do not use it for XP farming, automation, spam, or anything that violates Duolingo's terms.

## Requirements

- Node.js 20+
- A public Duolingo username
- Optional: your Duolingo JWT token if your profile data is not visible anonymously

## Start

```bash
npm start
```

Default URL:

```text
http://127.0.0.1:3000
```

For custom settings, copy `.env.example` to `.env` and edit values.

## Endpoints

```http
GET /health
GET /api/users/:username/summary
GET /api/users/:username/streak
GET /api/users/:username/courses
GET /api/users/:username/raw
GET /api/users/id/:id/summary
```

Examples:

```bash
curl http://127.0.0.1:3000/api/users/YourUsername/summary
curl http://127.0.0.1:3000/api/users/YourUsername/streak
curl http://127.0.0.1:3000/api/users/YourUsername/courses
```

With a Duolingo JWT for private/limited profiles:

```bash
curl -H "X-Duolingo-JWT: your-jwt-token" http://127.0.0.1:3000/api/users/YourUsername/summary
```

You can also set `DUOLINGO_JWT` in `.env`.

## Response Example

```json
{
  "id": 123456789,
  "username": "YourUsername",
  "name": "Your Name",
  "picture": "https://...",
  "streak": 100,
  "totalXp": 15000,
  "currentCourseId": "DUOLINGO_ES_EN",
  "learningLanguage": "es",
  "fromLanguage": "en",
  "courses": [
    {
      "id": "DUOLINGO_ES_EN",
      "title": "Spanish",
      "learningLanguage": "es",
      "fromLanguage": "en",
      "xp": 10000,
      "crowns": 50,
      "healthEnabled": true,
      "placementTestAvailable": false
    }
  ]
}
```

## Optional API Key

Set this in `.env`:

```env
API_KEY=change-this
```

Then every request must include:

```http
X-API-Key: change-this
```

## Notes

The wrapper uses Duolingo's observed `2017-06-30/users` profile endpoint:

- Username lookup: `https://www.duolingo.com/2017-06-30/users?username=:username`
- User id lookup: `https://www.duolingo.com/2017-06-30/users/:id`

The normalized API is intentionally read-only.

## License

MIT. You can copy, fork, and modify this project, but keep the copyright/license text and, when practical, link back to the original repository.
