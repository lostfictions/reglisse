export default function loop<T>(n: number, f: (i: number) => T): T[] {
  const result = Array<T>(n);
  for (let i = 0; i < n; ++i) {
    result[i] = f(i);
  }
  return result;
}
