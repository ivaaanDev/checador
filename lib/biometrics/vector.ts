export function averageEmbeddings(list: number[][]): number[] {
    const dim = list[0].length
    const out = new Array(dim).fill(0)
    for (const v of list) for (let i = 0; i < dim; i++) out[i] += v[i]
    return out.map((x) => x / list.length)
  }
  
export function l2normalize(v: number[]): number[] {
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
    return v.map((x) => x / norm)
}

export function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}