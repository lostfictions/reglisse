export default function isPow2(v: number): boolean {
  return !(v & (v - 1)) && !!v;
}
