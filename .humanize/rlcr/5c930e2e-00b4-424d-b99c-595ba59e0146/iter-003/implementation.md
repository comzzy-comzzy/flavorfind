Good. Goal tracker confirms AC-2 is still pending and shows AC-1 is done.

Now let me fix the AC-2 issue. The reviewer wants:
- Hex literals ONLY in tailwind.config.ts
- Non-class consumers (like viewport.themeColor) should DERIVE from the config, not duplicate it

Best approach: Create a small `lib/theme.ts` that imports the Tailwind config and exports typed color getters. This way:
- tailwind.config.ts remains the single source of truth for hex literals
- lib/theme.ts derives from it via a runtime import
- app/layout.tsx uses the derived constant for themeColor

Let me try this approach.

Actually wait — Next.js with TypeScript will need to be able to import the .ts tailwind config. Let me check if that's straightforward. The tailwind config file is `tailwind.config.ts` and uses `import type { Config } from "tailwindcss"`. Next.js can typically handle this via its TS support.

But actually there might be issues because Next.js by default doesn't include `tailwind.config.ts` in its module resolution paths for runtime imports. Let me think about an alternative approach.

Alternative: Use `tailwindcss/resolveConfig` and the `tailwind.config.ts` import. But that introduces runtime coupling to Tailwind internals.

Better alternative: Just use `require()` for the config. The config is a simple TS file. Node/Next.js with TS support can handle it.

Even better alternative: Use a CSS custom property pattern.

Approach: 
1. In `app/globals.css`, use `theme()` to set CSS custom properties on `:root`:
   ```css
   :root {
     --color-brand-light: theme('colors.brand.light');
     --color-brand-dark: theme('colors.brand.dark');
     --color-brand-cream: theme('colors.brand.cream');
   }
   ```
2. In `app/layout.tsx`, at server start (or via a helper), read the CSS var via... wait, we can't read CSS vars at server-start metadata time.

Hmm. The cleanest approach is to import the Tailwind config in TS.

Let me try yet another approach: a `lib/brand.ts` (or rename to `lib/theme.ts`) that re-exports values from the Tailwind config via a TS import. This is the natural Node/Next.js way.

The structure would be:
```ts
// lib/brand.ts
import tailwindConfig from "../tailwind.config";

// narrow to just brand colors, exported as readonly strings
export const brandColors = {
  light: tailwindConfig.theme?.extend?.colors?.brand?.light,
  dark: tailwindConfig.theme?.extend?.colors?.brand?.dark,
  cream: tailwindConfig.theme?.extend?.colors?.brand?.cream,
} as const;
```

This way:
- All hex literals live ONLY in tailwind.config.ts
- lib/brand.ts imports the config (no literals)
- app/layout.tsx uses brandColors.dark for themeColor

Wait — there's a caveat. The Tailwind config object might have the values as strings at runtime, but TS might complain. Let me check.

Looking at tailwind.config.ts:
```ts
const config: Config = {
  theme: {
    extend: {
      colors: {
        brand: {
          light: "#C8A165",
          ...
        }
      }
    }
  }
};
export default config;
```

When imported, `config.theme.extend.colors.brand.light` would be `string`. We can re-export.

But Next.js might not include `tailwind.config.ts` in its TS compilation by default. Let me verify by checking if there's an explicit path issue.

Actually, looking at Next.js docs: Tailwind config files are excluded from Next.js's automatic module resolution in some versions. To be safe, we could use a relative import with explicit extension `.ts`.

Let me try it. If it doesn't work, I'll use a CSS variable approach.

Actually, let me look at this differently. The reviewer said:
"Keep the literal palette only in tailwind.config.ts and derive any non-class consumer from that configuration, or defer/remove the themeColor value until it can consume a config-derived token without duplicating literals."

So two acceptable options:
1. Derive from config (import the config in TS)
2. Defer/remove themeColor

Let me go with option 2 first since it's simpler — drop the themeColor from viewport metadata. Then in the AC-11 iteration, re-add it using a derived approach.

Actually that's risky because AC-11 specifically calls out `theme-color matching brand.dark`. So I can't just drop it permanently.

Let me go with option 1: derive via TS import.

Actually, here's a cleaner option 3: Use `require()` with the absolute path to the config. Or use a build-time injection.

Or option 4: Since the brand.dark hex is just a string the browser needs for theme-color meta, and Next.js exports viewport.themeColor as part of the metadata, I can use a `dynamic` approach where the value is read at runtime from a CSS variable on the server. But theme-color meta is rendered to HTML on server, so this doesn't help.

Let me try the TS import approach. If the TS import doesn't work, I'll fall back to a CSS var approach.

Actually, I realize there's an even simpler approach: Use `tailwindcss/resolveConfig` with a manual re-require. Or just use the Tailwind config directly.

OK let me just try the simplest possible thing: import the tailwind config.

```ts
// lib/brand.ts
import type { Config } from "tailwindcss";
import tailwindConfig from "../tailwind.config";

type DeepBrand = NonNullable<
  NonNullable<NonNullable<Config["theme"]>["extend"]>["colors"]
>["brand"];

function getBrand<K extends keyof DeepBrand>(key: K): string {
  const brand = (tailwindConfig.theme?.extend?.colors as any)?.brand;
  if (!brand || typeof brand[key] !== "string") {
    throw new Error(`Tailwind config is missing theme.extend.colors.brand.${String(key)}`);
  }
  return brand[key] as string;
}

export const brandColors = {
  get light() { return getBrand("light"); },
  get dark() { return getBrand("dark"); },
  get cream() { return getBrand("cream"); },
} as const;
```

But this is overkill. Let me simplify:

```ts
// lib/brand.ts
import tailwindConfig from "../tailwind.config";

/**
 * Brand palette tokens derived from the single source of truth at
 * `tailwind.config.ts`. Do NOT add new hex literals here; extend the
 * Tailwind config's `theme.extend.colors.brand` instead.
 */
export const brandColors = {
  light: tailwindConfig.theme!.extend!.colors!.brand!.light!,
  dark: tailwindConfig.theme!.extend!.colors!.brand!.dark!,
  cream: tailwindConfig.theme!.extend!.colors!.brand!.cream!,
} as const;
```

But the Config type doesn't have all those required by default, so I might need `any` casts or runtime guards.

Actually the simplest:

```ts
import tailwindConfig from "../tailwind.config";

const brand = (tailwindConfig.theme?.extend?.colors as any)?.brand ?? {};

export const brandColors = {
  light: brand.light as string,
  dark: brand.dark as string,
  cream: brand.cream as string,
} as const;
```

This works. The hex literals live ONLY in tailwind.config.ts.

OK, but there's a catch: Next.js TypeScript may complain about importing tailwind.config.ts directly because tailwindcss's Config type might not align cleanly. Let me just test it.

Actually, I think the cleanest pattern Next.js projects use is:

```ts
import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "../tailwind.config";

export const fullConfig = resolveConfig(tailwindConfig);
export const brandColors = fullConfig.theme.colors.brand;
```

This uses Tailwind's own resolveConfig which normalizes the config. But resolveConfig expects a `Config` type, and importing TS config at runtime requires the bundler to support it.

For Next.js 14 with TS, importing a `.ts` file works in server components. Let me try.

Actually, let me first check if the simpler approach of just importing the config works.

Let me also try another approach: use a JS config file. But the current config is TS.

Let me just do the straightforward approach and test it.

Actually wait — I just realized that the current `tailwind.config.ts` uses `import type { Config } from "tailwindcss"`. This is `import type` which means it's a type-only import that gets erased at runtime. The actual config is just an object. So importing it as a runtime value should work.

Let me proceed.

Plan for iter-003:
1. Replace lib/brand.ts to derive from tailwind.config (no hex literals)
2. Keep app/layout.tsx using brandColors.dark
3. Run grep to confirm only tailwind.config.ts has hex literals
4. Try a TS type-check (may not have node available)
5. Write implementation_result.json

Let me also check the goal-tracker alignment. The tracker currently shows AC-2 as pending. After this iteration, it should remain pending (or be marked done if successful).

Wait — I should NOT directly edit goal-tracker.md after Round 0. So I include a "Goal Tracker Update Request" section in the implementation summary.

Let me start implementing.Build succeeded. Only the pre-existing metadataBase warning remains, which is unrelated to AC-2.

Let me also run a runtime check: start dev server briefly and verify the page renders with brand dark theme color in meta.Excellent! The rendered HTML shows:
- `<meta name="theme-color" content="#3E2723"/>` — the viewport.themeColor is correctly resolved from `brandColors.dark`, which derives from `tailwind.config.ts`'s `#3E2723`. ✓
- `<meta name="viewport" content="width=device-width, initial-scale=1"/>` ✓
- Body uses `bg-brand-cream` and `text-brand-dark` ✓
- Title is correct ✓

This proves the derivation works at runtime. The lib/brand.ts getter resolves correctly at server-render time.

Now let me clean up any leftover dev server processes and write the implementation_result.json.