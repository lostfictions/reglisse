import { TypedArray } from "./is-typed-array";
import pool from "./pool";
import { GLType, GLTypesToTypedArray } from "./gl-types";

function flatten1D<T extends TypedArray>(array: T, nx: number, out: T) {
  for (let i = 0; i < nx; ++i) {
    out[i] = array[i];
  }
}

function flatten2D<T extends TypedArray>(
  array: T[],
  nx: number,
  ny: number,
  out: T
) {
  let ptr = 0;
  for (let i = 0; i < nx; ++i) {
    const row = array[i];
    for (let j = 0; j < ny; ++j) {
      out[ptr++] = row[j];
    }
  }
}

function flatten3D<T extends TypedArray>(
  array: T[][],
  nx: number,
  ny: number,
  nz: number,
  out: T,
  ptr_: number
) {
  let ptr = ptr_;
  for (let i = 0; i < nx; ++i) {
    const row = array[i];
    for (let j = 0; j < ny; ++j) {
      const col = row[j];
      for (let k = 0; k < nz; ++k) {
        out[ptr++] = col[k];
      }
    }
  }
}

function flattenRec<T extends TypedArray>(
  array: T[][][],
  shape_: number[],
  level: number,
  out: T,
  ptr: number
) {
  let stride = 1;
  for (let i = level + 1; i < shape_.length; ++i) {
    stride *= shape_[i];
  }
  const n = shape_[level];
  if (shape_.length - level === 4) {
    const nx = shape_[level + 1];
    const ny = shape_[level + 2];
    const nz = shape_[level + 3];
    for (let i = 0; i < n; ++i) {
      flatten3D(array[i], nx, ny, nz, out, ptr);
      ptr += stride;
    }
  } else {
    for (let i = 0; i < n; ++i) {
      flattenRec(array[i] as any, shape_, level + 1, out, ptr);
      ptr += stride;
    }
  }
}

export function flatten<T extends TypedArray>(
  array: T | T[] | T[][] | T[][][],
  shape_: number[]
): T;
export function flatten<K extends GLType>(
  array:
    | GLTypesToTypedArray[K]
    | GLTypesToTypedArray[K][]
    | GLTypesToTypedArray[K][][]
    | GLTypesToTypedArray[K][][][],
  shape_: number[],
  type: K,
  out_: GLTypesToTypedArray[K]
): GLTypesToTypedArray[K];
export function flatten<K extends GLType>(
  array:
    | GLTypesToTypedArray[K]
    | GLTypesToTypedArray[K][]
    | GLTypesToTypedArray[K][][]
    | GLTypesToTypedArray[K][][][],
  shape_: number[],
  type?: K,
  out_?: GLTypesToTypedArray[K]
): GLTypesToTypedArray[K] {
  let sz = 1;
  if (shape_.length) {
    for (let i = 0; i < shape_.length; ++i) {
      sz *= shape_[i];
    }
  } else {
    sz = 0;
  }
  const out = out_ || pool.allocType(type!, sz);
  switch (shape_.length) {
    case 0:
      break;
    case 1:
      flatten1D(array as TypedArray, shape_[0], out);
      break;
    case 2:
      flatten2D(array as TypedArray[], shape_[0], shape_[1], out);
      break;
    case 3:
      flatten3D(
        array as TypedArray[][],
        shape_[0],
        shape_[1],
        shape_[2],
        out,
        0
      );
      break;
    default:
      flattenRec(array as TypedArray[][][], shape_, 0, out, 0);
  }
  return out;
}

export function shape(array_: any[]): number[] {
  const shape_ = [];
  for (let array = array_; array.length; array = array[0]) {
    shape_.push(array.length);
  }
  return shape_;
}
