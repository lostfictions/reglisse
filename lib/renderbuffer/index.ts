import check from "../util/check";
import { Limits } from "../limits";
import { ExtensionCache } from "../extension";
import { GLVAL } from "../constants";

import { RenderbufferResource } from "./RenderbufferResource";
import { REGLRenderbuffer, RenderbufferConfig } from "./REGLRenderbuffer";
import { getFormatTypes } from "./constants";

export interface RenderbufferContext {
  count: number;
  set: { [id: number]: RenderbufferResource };
  create(): REGLRenderbuffer;
  create(config: RenderbufferConfig): REGLRenderbuffer;
  create(size: number): REGLRenderbuffer;
  create(width: number, height: number): REGLRenderbuffer;
  destroy(rb: RenderbufferResource): void;
  clear(): void;
  restore(): void;
}

export default function wrapRenderbuffers({
  gl,
  extensions,
  limits,
  stats,
  config
}: {
  gl: WebGLRenderingContext;
  extensions: ExtensionCache;
  limits: Limits;
  stats: any;
  config: { profile: boolean };
}): RenderbufferContext {
  const formatTypes = getFormatTypes(extensions);

  const context: RenderbufferContext = {
    count: 0,
    set: {},
    create(configOrWidthOrSize?: RenderbufferConfig | number, height?: number) {
      const rb = new RenderbufferResource(
        gl.createRenderbuffer()!,
        context.count++,
        () => {
          context.destroy(rb);
        }
      );

      const reglRenderbuffer = new REGLRenderbuffer(
        rb,
        {
          gl,
          maxRenderbufferSize: limits.maxRenderbufferSize,
          formatTypes,
          profile: config.profile
        },
        configOrWidthOrSize,
        height
      );

      context.set[rb.id] = rb;

      stats.renderbufferCount++;

      return reglRenderbuffer;
    },
    // TODO: weird that "destroy" is not the dual of "create" -- it takes a
    // resource instead of a regl renderbuffer.
    destroy(rb: RenderbufferResource) {
      const handle = rb.renderbuffer;
      check(handle, "must not double destroy renderbuffer");
      gl.bindRenderbuffer(GLVAL.GL_RENDERBUFFER, null);
      gl.deleteRenderbuffer(handle);
      rb.renderbuffer = null as any;
      rb.refCount = 0;
      delete context.set[rb.id];
      stats.renderbufferCount--;
    },
    clear() {
      Object.values(context.set).forEach(context.destroy);
      context.set = {};
    },
    restore() {
      Object.values(context.set).forEach(rb => {
        rb.renderbuffer = gl.createRenderbuffer()!;
        gl.bindRenderbuffer(GLVAL.GL_RENDERBUFFER, rb.renderbuffer);
        gl.renderbufferStorage(
          GLVAL.GL_RENDERBUFFER,
          rb.format,
          rb.width,
          rb.height
        );
      });
      gl.bindRenderbuffer(GLVAL.GL_RENDERBUFFER, null);
    }
  };

  if (config.profile) {
    stats.getTotalRenderbufferSize = () => {
      let total = 0;
      Object.values(context.set).forEach(rb => {
        total += rb.stats!.size;
      });
      return total;
    };
  }

  return context;
}
