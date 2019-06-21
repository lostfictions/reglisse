import check from "../util/check";
import { GLVAL } from "../constants";

import { RenderbufferResource } from "./RenderbufferResource";
import { FormatTypes, getRenderbufferSize, FORMATS } from "./constants";

/**
 * Some values from the context we need to capture to do our job. Only assigned
 * on construction, but we refer to these values on updates too so they need to
 * stick around.
 *
 * It'd be nice to get rid of this, but in the meantime we can be explicit about
 * our dependencies.
 */
export interface RenderbufferInit {
  gl: WebGLRenderingContext;
  formatTypes: FormatTypes;
  profile: boolean;
  maxRenderbufferSize: number;
}

export interface RenderbufferConfig {
  /**
   * Sets the internal format of the render buffer. Default is`rgba4`.
   */
  format?: string;
  /**
   * Sets the width of the render buffer in pixels.
   */
  width?: number;
  /**
   * Sets the height of the render buffer in pixels.
   */
  height?: number;
  /**
   * Alias for width and height.
   */
  shape?: [number, number];
  /**
   * Simultaneously sets width and height.
   */
  radius?: number;
}

export class REGLRenderbuffer {
  width!: number;
  height!: number;
  format!: string;

  readonly _reglType = "renderbuffer";
  readonly _renderbuffer: RenderbufferResource;
  private readonly _init: RenderbufferInit;

  constructor(
    renderbufferResource: RenderbufferResource,
    init: RenderbufferInit,
    configOrWidthOrSize?: RenderbufferConfig | number,
    height?: number
  ) {
    this._renderbuffer = renderbufferResource;
    this._init = init;
    this.update(configOrWidthOrSize as any, height as any);
  }

  update(): this;
  update(config: RenderbufferConfig): this;
  update(size: number): this;
  update(width: number, height: number): this;
  update(
    configOrWidthOrSize?: RenderbufferConfig | number,
    height?: number
  ): this {
    const {
      gl,
      maxRenderbufferSize,
      profile,
      formatTypes: { types, reverseTypes }
    } = this._init;

    let w = 1;
    let h = 1;
    let format: FORMATS = GLVAL.GL_RGBA4;

    if (typeof configOrWidthOrSize === "object") {
      const options = configOrWidthOrSize;
      if (options.shape) {
        const { shape } = options;
        check(
          Array.isArray(shape) && shape.length >= 2,
          "invalid renderbuffer shape"
        );
        w = shape[0] | 0;
        h = shape[1] | 0;
      } else {
        if (options.radius != null) {
          w = h = options.radius | 0;
        }
        if (options.width != null) {
          w = options.width | 0;
        }
        if (options.height != null) {
          h = options.height | 0;
        }
      }
      if (options.format) {
        check.parameter(
          options.format,
          this._init.formatTypes.types,
          "invalid renderbuffer format"
        );
        format = types[options.format];
      }
    } else if (typeof configOrWidthOrSize === "number") {
      w = configOrWidthOrSize | 0;
      if (typeof height === "number") {
        h = height | 0;
      } else {
        h = w;
      }
    } else {
      w = h = 1;
    }

    // check shape
    check(
      w > 0 && h > 0 && w <= maxRenderbufferSize && h <= maxRenderbufferSize,
      "invalid renderbuffer size"
    );

    this.width = w;
    this.height = h;

    if (
      w === this._renderbuffer.width &&
      h === this._renderbuffer.height &&
      format === this._renderbuffer.format
    ) {
      return this;
    }

    this.width = this._renderbuffer.width = w;
    this.height = this._renderbuffer.height = h;
    this._renderbuffer.format = format;

    gl.bindRenderbuffer(GLVAL.GL_RENDERBUFFER, this._renderbuffer.renderbuffer);
    gl.renderbufferStorage(GLVAL.GL_RENDERBUFFER, format, w, h);

    check(gl.getError() === 0, "invalid render buffer format");

    if (profile) {
      this._renderbuffer.stats!.size = getRenderbufferSize(
        this._renderbuffer.format,
        this._renderbuffer.width,
        this._renderbuffer.height
      );
    }
    this.format = reverseTypes[this._renderbuffer.format];

    return this;
  }

  resize(w_: number, h_?: number): this {
    const w = w_ | 0;
    const h = h_ ? h_ | 0 : w;

    if (w === this._renderbuffer.width && h === this._renderbuffer.height) {
      return this;
    }

    // check shape
    check(
      w > 0 &&
        h > 0 &&
        w <= this._init.maxRenderbufferSize &&
        h <= this._init.maxRenderbufferSize,
      "invalid renderbuffer size"
    );

    const rb = this._renderbuffer;
    const { gl, profile } = this._init;

    this.width = rb.width = w;
    this.height = rb.height = h;

    gl.bindRenderbuffer(GLVAL.GL_RENDERBUFFER, rb.renderbuffer);
    gl.renderbufferStorage(GLVAL.GL_RENDERBUFFER, rb.format, w, h);

    check(gl.getError() === 0, "invalid render buffer format");

    // also, recompute size.
    if (profile) {
      rb.stats!.size = getRenderbufferSize(rb.format, rb.width, rb.height);
    }

    return this;
  }

  destroy() {
    this._renderbuffer.decRef();
  }
}
