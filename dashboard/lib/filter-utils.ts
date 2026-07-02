export function parseIds(val: string | null): number[] {
  if (!val) return []
  return val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
}

export function buildIdFilter(col: string, ids: number[], paramIdx: () => number, params: any[]): string {
  if (ids.length === 0) return ''
  const placeholders = ids.map(() => `$${paramIdx()}`)
  params.push(...ids)
  return `${col} IN (${placeholders.join(',')})`
}

export function buildOptionalFilter(col: string, singleVal: string | null, idsParam: string | null, paramIdx: () => number, params: any[]): string {
  const ids = parseIds(idsParam)
  if (ids.length > 0) return buildIdFilter(col, ids, paramIdx, params)
  if (singleVal) { params.push(parseInt(singleVal)); return `${col} = $${paramIdx()}` }
  return ''
}
