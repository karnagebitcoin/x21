type TTranslationTree = Record<string, unknown>

function isPlainObject(value: unknown): value is TTranslationTree {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function mergeWithFallback(base: TTranslationTree, override: TTranslationTree): TTranslationTree {
  const result: TTranslationTree = { ...base }

  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key]
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      result[key] = mergeWithFallback(baseValue, value)
    } else {
      result[key] = value
    }
  }

  return result
}

export function collectMissingKeys(
  base: TTranslationTree,
  candidate: TTranslationTree,
  prefix = ''
): string[] {
  const missing: string[] = []

  for (const [key, value] of Object.entries(base)) {
    const path = prefix ? `${prefix}.${key}` : key
    const candidateValue = candidate[key]

    if (isPlainObject(value)) {
      if (!isPlainObject(candidateValue)) {
        missing.push(path)
        continue
      }
      missing.push(...collectMissingKeys(value, candidateValue, path))
      continue
    }

    if (!(key in candidate)) {
      missing.push(path)
    }
  }

  return missing
}
