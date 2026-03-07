export class BoundedMap<K, V> extends Map<K, V> {
  constructor(private readonly maxEntries: number) {
    super()
  }

  override get(key: K): V | undefined {
    if (!super.has(key)) {
      return undefined
    }

    const value = super.get(key) as V
    super.delete(key)
    super.set(key, value)
    return value
  }

  override set(key: K, value: V): this {
    if (super.has(key)) {
      super.delete(key)
    }

    super.set(key, value)
    while (super.size > this.maxEntries) {
      const oldestKey = this.keys().next().value
      if (oldestKey === undefined) {
        break
      }
      super.delete(oldestKey)
    }
    return this
  }
}
