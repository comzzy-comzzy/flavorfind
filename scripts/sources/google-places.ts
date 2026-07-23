/**
 * Google Places (New) "Text Search" source adapter.
 *
 * Pulls real restaurant listings from the public Google Places REST
 * endpoint using a server-side API key from `process.env`. We then
 * hydrate each place with a "Place Details" lookup so we have a real
 * address, a real rating, and a real review snippet. All data we
 * persist originated from Google's API -- nothing here is fabricated.
 *
 * Cities covered: Lagos, Abuja, Port Harcourt, Ibadan, Enugu, Kano --
 * exactly the dropdown choices the AC-9 filter bar exposes.
 *
 * Why the "New" Places API (places.googleapis.com/v1)?
 *   - It returns structured addressComponents + priceLevel + rating in
 *     a single Place Details call, which keeps the adapter small.
 *   - The legacy `/maps/api/place/*` endpoints still work but are
 *     being sunset; the new API is the recommended migration path.
 *
 * If `GOOGLE_PLACES_API_KEY` is not set, the adapter throws a clear
 * error and the orchestrator records the source as skipped -- the
 * script still exits 0 so a missing key is non-fatal at the GH Actions
 * level.
 */
import { load as loadHtml } from "cheerio";
import nodeFetch from "node-fetch";
import { delay } from "../lib/delay";
import {
  cleanText,
  priceLevelToBudgetTier,
  normaliseRating,
} from "../lib/normalizer";
import type {
  ScraperRestaurant,
  ScraperReview,
  ScraperSource,
} from "../lib/scraper-types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const CITIES = [
  "Lagos",
  "Abuja",
  "Port Harcourt",
  "Ibadan",
  "Enugu",
  "Kano",
] as const;

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.primaryType",
  "places.types",
  "places.editorialSummary",
  "places.googleMapsUri",
].join(",");

interface TextSearchResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;
    primaryType?: string;
    types?: string[];
    editorialSummary?: { text?: string };
    googleMapsUri?: string;
  }>;
}

interface PlaceDetailsResponse {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryType?: string;
  types?: string[];
  editorialSummary?: { text?: string };
  googleMapsUri?: string;
  reviews?: Array<{
    text?: { text?: string };
    rating?: number;
    googleMapsUri?: string;
  }>;
}

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const REVIEW_FETCH =
  "https://places.googleapis.com/v1/places/{PLACE_ID}?fields=" +
  [
    "id",
    "displayName",
    "formattedAddress",
    "rating",
    "userRatingCount",
    "priceLevel",
    "primaryType",
    "types",
    "editorialSummary",
    "googleMapsUri",
    "reviews",
  ].join(",");

/**
 * Cheap fetch wrapper that throws on non-2xx so callers can catch
 * per-city failures without parsing JSON.
 */
async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await nodeFetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} from ${url}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Parse a Google "Place Details" response into the scraper row format. */
function mapPlaceToRestaurant(
  place: PlaceDetailsResponse,
  city: string,
): ScraperRestaurant | null {
  const name = cleanText(place.displayName?.text);
  if (!name) return null;
  const priceLevelNumber = place.priceLevel
    ? PRICE_LEVEL_MAP[place.priceLevel]
    : undefined;
  const tier = priceLevelToBudgetTier(priceLevelNumber);
  const sourceUrl =
    cleanText(place.googleMapsUri) ??
    `https://www.google.com/maps/place/?q=place_id:${place.id ?? ""}`;

  const cuisine = cleanText(place.primaryType ?? place.types?.[0]);

  const reviews: ScraperReview[] = Array.isArray(place.reviews)
    ? place.reviews
        .map((r) => {
          const snippet = cleanText(r.text?.text, 400);
          if (!snippet) return null;
          return {
            snippet,
            rating: normaliseRating(r.rating),
            sourceUrl: cleanText(r.googleMapsUri) ?? sourceUrl,
          };
        })
        .filter((v): v is ScraperReview => v !== null)
    : [];

  // If the place came back with a rating but the details call did not
  // include any snippets, use the editorial summary as a single snippet
  // so the cached review_count is non-zero and the AC-7 ranking formula
  // has something to score.
  if (reviews.length === 0) {
    const editorial = cleanText(place.editorialSummary?.text, 400);
    if (editorial) {
      reviews.push({
        snippet: editorial,
        rating: normaliseRating(place.rating),
        sourceUrl,
      });
    }
  }

  return {
    name,
    city,
    area: null,
    cuisine,
    budgetTier: tier ?? 2,
    avgRating: normaliseRating(place.rating),
    reviewCount:
      typeof place.userRatingCount === "number" && place.userRatingCount >= 0
        ? Math.floor(place.userRatingCount)
        : reviews.length,
    address: cleanText(place.formattedAddress, 500),
    sourceUrl,
    imageUrl: null,
    reviews,
  };
}

/** Issue a text search for "restaurants in <city>" and return raw places. */
async function textSearch(
  apiKey: string,
  city: string,
): Promise<TextSearchResponse["places"]> {
  const body = {
    textQuery: `best restaurants in ${city} Nigeria`,
    maxResultCount: 10,
    regionCode: "NG",
  };
  const res = await nodeFetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `places:searchText failed for ${city}: HTTP ${res.status} ${text.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as TextSearchResponse;
  return json.places ?? [];
}

/** Fetch full details (including review snippets) for one place id. */
async function placeDetails(apiKey: string, placeId: string): Promise<PlaceDetailsResponse> {
  const url = REVIEW_FETCH.replace("{PLACE_ID}", encodeURIComponent(placeId));
  return getJson<PlaceDetailsResponse>(url, {
    "X-Goog-Api-Key": apiKey,
  });
}

/**
 * Adapter factory. Pulled out so the verify script can introspect the
 * adapter's `id` + `description` without constructing a real Google
 * client (which would need an API key).
 */
export function createGooglePlacesSource(apiKey: string): ScraperSource {
  return {
    id: "google-places",
    description: "Google Places API (New) text search + place details",

    async fetch(): Promise<ScraperRestaurant[]> {
      if (!apiKey) {
        throw new Error("GOOGLE_PLACES_API_KEY is not set");
      }

      const results: ScraperRestaurant[] = [];

      for (const city of CITIES) {
        const places = (await textSearch(apiKey, city)) ?? [];
        for (const place of places) {
          if (!place.id) continue;
          try {
            const details = await placeDetails(apiKey, place.id);
            const mapped = mapPlaceToRestaurant(details, city);
            if (mapped) results.push(mapped);
          } catch (err) {
            // One bad place id should not abort the whole city sweep.
            process.stderr.write(
              `[scrape] warn google-places detail skipped for ${place.id} in ${city}: ${
                (err as Error).message
              }\n`,
            );
          }
          // Respect the plan risk-control: at least 1s delay between
          // upstream requests so we never hammer Google's quota.
          await delay(1000);
        }
        await delay(1000);
      }

      return results;
    },
  };
}

/**
 * Export internals so the verify script can unit-test the normaliser
 * without hitting the live Google API.
 */
export const __testing = {
  mapPlaceToRestaurant,
  priceLevelMap: PRICE_LEVEL_MAP,
  reviewFetchTemplate: REVIEW_FETCH,
  textSearchEndpoint: ENDPOINT,
  cities: CITIES,
};

// Silence unused-import linter when cheerio is loaded only for type parity.
void loadHtml;