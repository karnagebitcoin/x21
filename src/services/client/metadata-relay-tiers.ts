export function getMetadataRelayTiers(
  preferredReadRelays: string[],
  favoriteRelays: string[],
  fallbackRelays: string[]
): { tier1: string[]; tier2: string[]; tier3: string[] } {
  // Tier 1: User's read relays (most preferred)
  const tier1 = preferredReadRelays.slice(0, 4)

  // Tier 2: Favorite relays (excluding those already in tier 1)
  const tier1Set = new Set(tier1)
  const tier2 = favoriteRelays.filter((url) => !tier1Set.has(url)).slice(0, 4)

  // Tier 3: Fallback relays excluding those already selected
  const usedSet = new Set([...tier1, ...tier2])
  const tier3 = fallbackRelays.filter((url) => !usedSet.has(url))

  return { tier1, tier2, tier3 }
}
