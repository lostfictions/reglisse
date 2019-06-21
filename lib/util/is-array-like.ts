import isTypedArray, { TypedArray } from "./is-typed-array";
export default function isArrayLike(s: any): s is Array<any> | TypedArray {
  return Array.isArray(s) || isTypedArray(s);
}
