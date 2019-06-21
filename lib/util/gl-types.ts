export const GL_BYTE = 5120;
export const GL_UNSIGNED_BYTE = 5121;
export const GL_SHORT = 5122;
export const GL_UNSIGNED_SHORT = 5123;
export const GL_INT = 5124;
export const GL_UNSIGNED_INT = 5125;
export const GL_FLOAT = 5126;

export interface GLTypesToTypedArray {
  [GL_BYTE]: Int8Array;
  [GL_UNSIGNED_BYTE]: Uint8Array;
  [GL_SHORT]: Int16Array;
  [GL_UNSIGNED_SHORT]: Uint16Array;
  [GL_INT]: Int32Array;
  [GL_UNSIGNED_INT]: Uint32Array;
  [GL_FLOAT]: Float32Array;
}

export type GLType = keyof GLTypesToTypedArray;
