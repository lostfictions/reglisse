import { TypedArray } from "./is-typed-array";
import loop from "./loop";
import {
  GLType,
  GLTypesToTypedArray,
  GL_BYTE,
  GL_UNSIGNED_BYTE,
  GL_SHORT,
  GL_UNSIGNED_SHORT,
  GL_INT,
  GL_UNSIGNED_INT,
  GL_FLOAT
} from "./gl-types";

function nextPow16(v: number): number {
  for (let i = 16; i <= 1 << 28; i *= 16) {
    if (v <= i) {
      return i;
    }
  }
  return 0;
}

function log2(v: number): number {
  let r: number;
  let shift: number;
  r = +(v > 0xffff) << 4;
  v >>>= r;
  shift = +(v > 0xff) << 3;
  v >>>= shift;
  r |= shift;
  shift = +(v > 0xf) << 2;
  v >>>= shift;
  r |= shift;
  shift = +(v > 0x3) << 1;
  v >>>= shift;
  r |= shift;
  return r | (v >> 1);
}

function createPool() {
  const bufferPool = loop<ArrayBuffer[]>(8, () => []);

  function alloc(n: number) {
    const sz = nextPow16(n);
    const bin = bufferPool[log2(sz) >> 2];
    if (bin.length > 0) {
      return bin.pop()!;
    }
    return new ArrayBuffer(sz);
  }

  function free(buf: ArrayBuffer): void {
    bufferPool[log2(buf.byteLength) >> 2].push(buf);
  }

  function allocType<K extends GLType>(
    type: K,
    n: number
  ): GLTypesToTypedArray[K] {
    let result = null;
    switch (type) {
      case GL_BYTE:
        result = new Int8Array(alloc(n), 0, n);
        break;
      case GL_UNSIGNED_BYTE:
        result = new Uint8Array(alloc(n), 0, n);
        break;
      case GL_SHORT:
        result = new Int16Array(alloc(2 * n), 0, n);
        break;
      case GL_UNSIGNED_SHORT:
        result = new Uint16Array(alloc(2 * n), 0, n);
        break;
      case GL_INT:
        result = new Int32Array(alloc(4 * n), 0, n);
        break;
      case GL_UNSIGNED_INT:
        result = new Uint32Array(alloc(4 * n), 0, n);
        break;
      case GL_FLOAT:
        result = new Float32Array(alloc(4 * n), 0, n);
        break;
      default:
        throw new Error("Unknown allocation type!");
    }

    // ts complains about symbol.tostringtag if we don't cast :(
    if (result.length !== n) {
      return result.subarray(0, n) as any;
    }
    return result as any;
  }

  function freeType(array: TypedArray) {
    free(array.buffer);
  }

  return {
    alloc,
    free,
    allocType,
    freeType
  };
}

const pool = createPool();
export default pool;

// zero pool for initial zero data
export const zero = createPool();
