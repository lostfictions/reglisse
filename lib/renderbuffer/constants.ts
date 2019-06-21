import { GLVAL } from "../constants";

export const FORMAT_SIZES = {
  [GLVAL.GL_RGBA4]: 2,
  [GLVAL.GL_RGB5_A1]: 2,
  [GLVAL.GL_RGB565]: 2,

  [GLVAL.GL_DEPTH_COMPONENT16]: 2,
  [GLVAL.GL_STENCIL_INDEX8]: 1,
  [GLVAL.GL_DEPTH_STENCIL]: 4,

  [GLVAL.GL_SRGB8_ALPHA8_EXT]: 4,
  [GLVAL.GL_RGBA32F_EXT]: 16,
  [GLVAL.GL_RGBA16F_EXT]: 8,
  [GLVAL.GL_RGB16F_EXT]: 6
} as const;

export type FORMATS = keyof typeof FORMAT_SIZES;

export function getRenderbufferSize(
  format: FORMATS,
  width: number,
  height: number
): number {
  return FORMAT_SIZES[format] * width * height;
}

export interface FormatTypes {
  types: {
    [format: string]: FORMATS;
  };
  reverseTypes: {
    [typeId in FORMATS]: string;
  };
}

export function getFormatTypes(extensions?: {
  [extname: string]: unknown;
}): FormatTypes {
  const types: { [format: string]: number } = {
    rgba4: GLVAL.GL_RGBA4,
    rgb565: GLVAL.GL_RGB565,
    "rgb5 a1": GLVAL.GL_RGB5_A1,
    depth: GLVAL.GL_DEPTH_COMPONENT16,
    stencil: GLVAL.GL_STENCIL_INDEX8,
    "depth stencil": GLVAL.GL_DEPTH_STENCIL
  };

  if (extensions) {
    if (extensions.ext_srgb) {
      types["srgba"] = GLVAL.GL_SRGB8_ALPHA8_EXT;
    }

    if (extensions.ext_color_buffer_half_float) {
      types["rgba16f"] = GLVAL.GL_RGBA16F_EXT;
      types["rgb16f"] = GLVAL.GL_RGB16F_EXT;
    }

    if (extensions.webgl_color_buffer_float) {
      types["rgba32f"] = GLVAL.GL_RGBA32F_EXT;
    }
  }

  const reverseTypes: { [typeId: number]: string } = [];
  for (const [k, v] of Object.entries(types)) {
    reverseTypes[v] = k;
  }

  return { types, reverseTypes } as any;
}
