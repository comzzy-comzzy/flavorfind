# AC-7 Recommendation Endpoint

The FlavorFind `/api/recommend` route returns the top restaurants in
`public.restaurants` ranked by a transparent weighted formula that
combines average rating, normalised review volume, and a soft city
preference.

## Endpoint contract

`GET /api/recommend`

| Query param | Type            | Required | Default | Notes |
| ----------- | --------------- | -------- | ------- | ----- |
| `city`      | string (1..80)  | no       | --      | Case-insensitive exact match against `restaurants.city`. Acts as a **soft preference** (see below). |
| `budgetTier`| integer 1, 2, 3 | no       | --      | Hard equality on `restaurants.budget_tier`. |
| `cuisine`   | string (1..80)  | no       | --      | Case-insensitive exact match against `restaurants.cuisine`. |
| `limit`     | integer 1..100  | no       | 20      | Result-list size. Clamped to [1, 100]. |

### Response (`200 OK`)

```json
{
  "filter":          { "city": "Lagos", "budgetTier": 2, "cuisine": "Nigerian" },
  "limit":           20,
  "total_candidates": 41,
  "count":           8,
  "results": [
    {
      "id": "...",
      "name": "Nkwu Eze",
      "city": "Lagos",
      "avg_rating": 4.8,
      "review_count": 312,
      "score": 4.66,
      "match_explanations": {
        "rating_component":    2.88,
        "review_component":    1.28,
        "location_component":  0.5,
        "city_matched":        true,
        "city_filter_supplied": true
      },
      "...": "remaining RestaurantRow columns"
    }
  ]
}
```

### Error responses

| Status | Error code              | Cause                                                  |
| ------ | ----------------------- | ------------------------------------------------------ |
| 400    | `invalid_query`         | One or more query params failed Zod validation.        |
| 500    | `supabase_query_failed` | The Supabase call threw -- see `message` for details.  |
| 503    | `supabase_unconfigured` | `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` not set.      |

## Ranking formula

```
score = avg_rating           * 0.6
      + normalised_reviews   * 0.3
      + location_match_bonus * 0.1
```

The formula is the canonical one referenced in the plan:

> `score = avg_rating * 0.6 + normalized_review_count * 0.3 + location_match_bonus * 0.1`

### Components

| Component                | Formula                                                  | Max contribution |
| ------------------------ | -------------------------------------------------------- | ---------------- |
| `avg_rating`             | `restaurants.avg_rating` (or 0 if NULL)                  | 5 * 0.6 = **3.0** |
| `normalised_reviews`     | `min(review_count, 100) / 100 * 5`                       | 5 * 0.3 = **1.5** |
| `location_match_bonus`   | 5 when `city` filter was supplied **and** the restaurant`s city matches it (case-insensitive), else 0 | 5 * 0.1 = **0.5** |

Total possible score: **5.0**.

### Why city is a soft preference, not a hard filter

City matching flows through the `location_match_bonus * 0.1` term
rather than dropping non-matching rows. This means:

- A user filtering by `city=Lagos` still sees Lagos restaurants
  surfaced first, but also sees well-rated Abuja / Port Harcourt
  spots as alternatives when their exact-match set is short.
- The score fully encodes the formula instead of redundantly
  boosting every remaining row by `0.5`.

`budgetTier` and `cuisine`, by contrast, **are** hard filters --
passing `budgetTier=1&cuisine=Nigerian` yields only tier-1
Nigerian restaurants.

## Verification

Run the offline checker (no network required):

```
npm run verify:recommend
```

It exercises:

- The `app/api/recommend/route.ts` shape (file exists, exports GET,
  returns NextResponse, validates inputs, calls `rankRestaurants`).
- The five pure helpers in `lib/recommend.ts` (`computeScore`,
  `normalizeReviewCount`, `locationMatchBonus`, `applyHardFilters`,
  `rankRestaurants`).
- The formula weights at boundary cases
  (5.0 perfect / 4.5 missing city bonus / 0 null rating / etc.).
- Deterministic rank order for identical inputs.

## Live smoke test

```bash
curl "http://localhost:3000/api/recommend?city=Lagos&budgetTier=2"
```

Expected response shape (truncated):

```json
{
  "filter": { "city": "Lagos", "budgetTier": 2 },
  "limit": 20,
  "count": 3,
  "results": [ { "name": "...", "score": 4.66, ... } ]
}
```

The endpoint requires `NEXT_PUBLIC_SUPABASE_URL` +
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in the deployment environment
(see `.env.example`). Without them, the response is `503
supabase_unconfigured`, **not** a 500 -- so a Reviewer can
distinguish "wired but unconfigured" from "crashed".