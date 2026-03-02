# i18n Workflow (Staggered Translation)

## Rule
- `en` is the canonical source of truth.
- Non-English locales can lag behind and are allowed to be partial.

## How It Works
- At runtime, each non-English locale is merged on top of English.
- Missing keys automatically fall back to English.
- In development, missing keys are logged for visibility.

## Developer Flow
1. Add new copy in `src/i18n/locales/en.ts` only.
2. Ship feature without blocking on other locales.
3. Translate other languages in batches over time.

## Notes
- Non-English locale files are marked with `// @ts-nocheck` to avoid blocking feature work with locale-only TypeScript churn.
- English remains checked and should stay clean.
