import { GLVAL } from "./constants";
import pool from "./util/pool";
import { ExtensionCache } from "./extension";

export type Limits = ReturnType<typeof limits>;

// TODO: some values still untyped! could also fix via pr to typescript
// lib.dom.d.ts.
export default function limits(
  gl: WebGLRenderingContext,
  extensions: ExtensionCache
) {
  let maxAnisotropic = 1;
  if (extensions.ext_texture_filter_anisotropic) {
    maxAnisotropic = gl.getParameter(GLVAL.GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT);
  }

  let maxDrawbuffers = 1;
  let maxColorAttachments = 1;
  if (extensions.webgl_draw_buffers) {
    maxDrawbuffers = gl.getParameter(GLVAL.GL_MAX_DRAW_BUFFERS_WEBGL);
    maxColorAttachments = gl.getParameter(GLVAL.GL_MAX_COLOR_ATTACHMENTS_WEBGL);
  }

  // detect if reading float textures is available (Safari doesn't support)
  let readFloat = !!extensions.oes_texture_float;
  if (readFloat) {
    const readFloatTexture = gl.createTexture();
    gl.bindTexture(GLVAL.GL_TEXTURE_2D, readFloatTexture);
    gl.texImage2D(
      GLVAL.GL_TEXTURE_2D,
      0,
      GLVAL.GL_RGBA,
      1,
      1,
      0,
      GLVAL.GL_RGBA,
      GLVAL.GL_FLOAT,
      null
    );

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(GLVAL.GL_FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      GLVAL.GL_FRAMEBUFFER,
      GLVAL.GL_COLOR_ATTACHMENT0,
      GLVAL.GL_TEXTURE_2D,
      readFloatTexture,
      0
    );
    gl.bindTexture(GLVAL.GL_TEXTURE_2D, null);

    if (
      gl.checkFramebufferStatus(GLVAL.GL_FRAMEBUFFER) !==
      GLVAL.GL_FRAMEBUFFER_COMPLETE
    ) {
      readFloat = false;
    } else {
      gl.viewport(0, 0, 1, 1);
      gl.clearColor(1.0, 0.0, 0.0, 1.0);
      gl.clear(GLVAL.GL_COLOR_BUFFER_BIT);
      const pixels = pool.allocType(GLVAL.GL_FLOAT, 4);
      gl.readPixels(0, 0, 1, 1, GLVAL.GL_RGBA, GLVAL.GL_FLOAT, pixels);

      if (gl.getError()) {
        readFloat = false;
      } else {
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(readFloatTexture);

        readFloat = pixels[0] === 1.0;
      }

      pool.freeType(pixels);
    }
  }

  // detect non power of two cube textures support (IE doesn't support)
  const isIE =
    typeof navigator !== "undefined" &&
    (/MSIE/.test(navigator.userAgent) ||
      /Trident\//.test(navigator.appVersion) ||
      /Edge/.test(navigator.userAgent));

  let npotTextureCube = true;

  if (!isIE) {
    const cubeTexture = gl.createTexture();
    const data = pool.allocType(GLVAL.GL_UNSIGNED_BYTE, 36);
    gl.activeTexture(GLVAL.GL_TEXTURE0);
    gl.bindTexture(GLVAL.GL_TEXTURE_CUBE_MAP, cubeTexture);
    gl.texImage2D(
      GLVAL.GL_TEXTURE_CUBE_MAP_POSITIVE_X,
      0,
      GLVAL.GL_RGBA,
      3,
      3,
      0,
      GLVAL.GL_RGBA,
      GLVAL.GL_UNSIGNED_BYTE,
      data
    );
    pool.freeType(data);
    gl.bindTexture(GLVAL.GL_TEXTURE_CUBE_MAP, null);
    gl.deleteTexture(cubeTexture);
    npotTextureCube = !gl.getError();
  }

  return {
    // drawing buffer bit depth
    colorBits: [
      gl.getParameter(GLVAL.GL_RED_BITS),
      gl.getParameter(GLVAL.GL_GREEN_BITS),
      gl.getParameter(GLVAL.GL_BLUE_BITS),
      gl.getParameter(GLVAL.GL_ALPHA_BITS)
    ] as readonly number[],
    depthBits: gl.getParameter(GLVAL.GL_DEPTH_BITS) as number,
    stencilBits: gl.getParameter(GLVAL.GL_STENCIL_BITS) as number,
    subpixelBits: gl.getParameter(GLVAL.GL_SUBPIXEL_BITS) as number,

    // supported extensions
    extensions: Object.keys(extensions).filter(ext => !!extensions[ext]),

    // max aniso samples
    maxAnisotropic,

    // max draw buffers
    maxDrawbuffers,
    maxColorAttachments,

    // point and line size ranges
    pointSizeDims: gl.getParameter(GLVAL.GL_ALIASED_POINT_SIZE_RANGE),
    lineWidthDims: gl.getParameter(GLVAL.GL_ALIASED_LINE_WIDTH_RANGE),
    maxViewportDims: gl.getParameter(GLVAL.GL_MAX_VIEWPORT_DIMS),
    maxCombinedTextureUnits: gl.getParameter(
      GLVAL.GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS
    ) as number,
    maxCubeMapSize: gl.getParameter(
      GLVAL.GL_MAX_CUBE_MAP_TEXTURE_SIZE
    ) as number,
    maxRenderbufferSize: gl.getParameter(
      GLVAL.GL_MAX_RENDERBUFFER_SIZE
    ) as number,
    maxTextureUnits: gl.getParameter(
      GLVAL.GL_MAX_TEXTURE_IMAGE_UNITS
    ) as number,
    maxTextureSize: gl.getParameter(GLVAL.GL_MAX_TEXTURE_SIZE) as number,
    maxAttributes: gl.getParameter(GLVAL.GL_MAX_VERTEX_ATTRIBS) as number,
    maxVertexUniforms: gl.getParameter(
      GLVAL.GL_MAX_VERTEX_UNIFORM_VECTORS
    ) as number,
    maxVertexTextureUnits: gl.getParameter(
      GLVAL.GL_MAX_VERTEX_TEXTURE_IMAGE_UNITS
    ) as number,
    maxVaryingVectors: gl.getParameter(GLVAL.GL_MAX_VARYING_VECTORS) as number,
    maxFragmentUniforms: gl.getParameter(
      GLVAL.GL_MAX_FRAGMENT_UNIFORM_VECTORS
    ) as number,

    // vendor info
    glsl: gl.getParameter(GLVAL.GL_SHADING_LANGUAGE_VERSION) as string,
    renderer: gl.getParameter(GLVAL.GL_RENDERER) as string,
    vendor: gl.getParameter(GLVAL.GL_VENDOR) as string,
    version: gl.getParameter(GLVAL.GL_VERSION) as string,

    // quirks
    readFloat,
    npotTextureCube
  };
}
