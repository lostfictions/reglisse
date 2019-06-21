import check from "./util/check";
import { ReglInit } from "./webgl";

export default function createExtensionCache(
  gl: WebGLRenderingContext,
  config: ReglInit
) {
  const extensions: { [extname: string]: unknown } = {};

  function tryLoadExtension(name_: string): boolean {
    check.type(name_, "string", "extension name must be string");
    const name = name_.toLowerCase();
    let ext: unknown;
    try {
      ext = extensions[name] = gl.getExtension(name);
    } catch (e) {
      // don't care
    }
    return !!ext;
  }

  for (let i = 0; i < config.extensions.length; ++i) {
    const name = config.extensions[i];
    if (!tryLoadExtension(name)) {
      config.onDestroy();
      config.onDone(
        '"' +
          name +
          '" extension is not supported by the current WebGL context, try upgrading your system or a different browser'
      );
      return null;
    }
  }

  config.optionalExtensions.forEach(tryLoadExtension);

  return {
    extensions,
    restore() {
      Object.keys(extensions).forEach(name => {
        if (extensions[name] && !tryLoadExtension(name)) {
          throw new Error("(regl): error restoring extension " + name);
        }
      });
    }
  };
}
