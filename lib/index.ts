import check from "./util/check";
import { define as defineDynamic } from "./dynamic";
import raf from "./util/raf";
import clock from "./util/clock";
import createStringStore from "./strings";
import initWebGL, { ReglConfig } from "./webgl";
import wrapExtensions from "./extension";
import wrapLimits from "./limits";
import wrapBuffers from "./buffer";
import wrapElements from "./elements";
import wrapTextures from "./texture";
import wrapRenderbuffers from "./renderbuffer";
import wrapFramebuffers from "./framebuffer";
import wrapAttributes from "./attribute";
import wrapShaders from "./shader";
import wrapRead from "./read";
import createCore from "./core";
import createStats from "./stats";
import createTimer from "./timer";

const GL_COLOR_BUFFER_BIT = 16384;
const GL_DEPTH_BUFFER_BIT = 256;
const GL_STENCIL_BUFFER_BIT = 1024;

const GL_ARRAY_BUFFER = 34962;

const CONTEXT_LOST_EVENT = "webglcontextlost";
const CONTEXT_RESTORED_EVENT = "webglcontextrestored";

const DYN_PROP = 1;
const DYN_CONTEXT = 2;
const DYN_STATE = 3;

function find<T>(haystack: T[], needle: T): number {
  for (let i = 0; i < haystack.length; ++i) {
    if (haystack[i] === needle) {
      return i;
    }
  }
  return -1;
}

export interface ContextState {
  tick: number;
  time: number;
  viewportWidth: number;
  viewportHeight: number;
  framebufferWidth: number;
  framebufferHeight: number;
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  pixelRatio: number;
}

export default function wrapREGL(): unknown;
export default function wrapREGL(selector: string): unknown;
export default function wrapREGL(element: HTMLElement): unknown;
export default function wrapREGL(context: WebGLRenderingContext): unknown;
export default function wrapREGL(config: ReglConfig): unknown;
export default function wrapREGL(
  args?: string | HTMLElement | WebGLRenderingContext | ReglConfig
) {
  const config = initWebGL(args as any);
  if (!config) {
    return null;
  }

  const gl = config.gl;
  const glAttributes = gl.getContextAttributes();
  let contextLost = gl.isContextLost();

  const extensionState = wrapExtensions(gl, config);
  if (!extensionState) {
    return null;
  }

  const stringStore = createStringStore();
  const stats = createStats();
  const extensions = extensionState.extensions;
  const timer = createTimer(gl, extensions);

  const START_TIME = clock();
  const WIDTH = gl.drawingBufferWidth;
  const HEIGHT = gl.drawingBufferHeight;

  const contextState: ContextState = {
    tick: 0,
    time: 0,
    viewportWidth: WIDTH,
    viewportHeight: HEIGHT,
    framebufferWidth: WIDTH,
    framebufferHeight: HEIGHT,
    drawingBufferWidth: WIDTH,
    drawingBufferHeight: HEIGHT,
    pixelRatio: config.pixelRatio
  };
  const uniformState = {};
  const drawState = {
    elements: null,
    primitive: 4, // GL_TRIANGLES
    count: -1,
    offset: 0,
    instances: -1
  };

  const limits = wrapLimits(gl, extensions);
  const attributeState = wrapAttributes(gl, extensions, limits, stringStore);
  const bufferState = wrapBuffers(gl, stats, config, attributeState);
  const elementState = wrapElements(gl, extensions, bufferState, stats);
  const shaderState = wrapShaders(gl, stringStore, stats, config);
  const textureState = wrapTextures(
    gl,
    extensions,
    limits,
    function() {
      core.procs.poll();
    },
    contextState,
    stats,
    config
  );
  const renderbufferState = wrapRenderbuffers({
    gl,
    extensions,
    limits,
    stats,
    config
  });
  const framebufferState = wrapFramebuffers(
    gl,
    extensions,
    limits,
    textureState,
    renderbufferState,
    stats
  );
  const core = createCore(
    gl,
    stringStore,
    extensions,
    limits,
    bufferState,
    elementState,
    textureState,
    framebufferState,
    uniformState,
    attributeState,
    shaderState,
    drawState,
    contextState,
    timer,
    config
  );
  const readPixels = wrapRead(
    gl,
    framebufferState,
    core.procs.poll,
    contextState,
    glAttributes,
    extensions,
    limits
  );

  const nextState = core.next;
  const canvas = gl.canvas;

  // TODO
  const rafCallbacks: ((c: ContextState, _: null, __: number) => void)[] = [];
  const lossCallbacks: (() => void)[] = [];
  const restoreCallbacks: (() => void)[] = [];
  const destroyCallbacks = [config.onDestroy];

  let activeRAF: number | null = null;
  function handleRAF() {
    if (rafCallbacks.length === 0) {
      if (timer) {
        timer.update();
      }
      activeRAF = null;
      return;
    }

    // schedule next animation frame
    activeRAF = raf.next(handleRAF);

    // poll for changes
    poll();

    // fire a callback for all pending rafs
    for (let i = rafCallbacks.length - 1; i >= 0; --i) {
      const cb = rafCallbacks[i];
      if (cb) {
        cb(contextState, null, 0);
      }
    }

    // flush all pending webgl calls
    gl.flush();

    // poll GPU timers *after* gl.flush so we don't delay command dispatch
    if (timer) {
      timer.update();
    }
  }

  function startRAF() {
    if (!activeRAF && rafCallbacks.length > 0) {
      activeRAF = raf.next(handleRAF);
    }
  }

  function stopRAF() {
    if (activeRAF) {
      raf.cancel(handleRAF);
      activeRAF = null;
    }
  }

  function handleContextLoss(event: Event) {
    event.preventDefault();

    // set context lost flag
    contextLost = true;

    // pause request animation frame
    stopRAF();

    // lose context
    lossCallbacks.forEach(cb => {
      cb();
    });
  }

  function handleContextRestored(_event: Event) {
    // clear error code
    gl.getError();

    // clear context lost flag
    contextLost = false;

    // refresh state
    extensionState!.restore();
    shaderState.restore();
    bufferState.restore();
    textureState.restore();
    renderbufferState.restore();
    framebufferState.restore();
    if (timer) {
      timer.restore();
    }

    // refresh state
    core.procs.refresh();

    // restart RAF
    startRAF();

    // restore context
    restoreCallbacks.forEach(cb => {
      cb();
    });
  }

  if (canvas) {
    canvas.addEventListener(CONTEXT_LOST_EVENT, handleContextLoss, false);
    canvas.addEventListener(
      CONTEXT_RESTORED_EVENT,
      handleContextRestored,
      false
    );
  }

  function destroy() {
    rafCallbacks.length = 0;
    stopRAF();

    if (canvas) {
      canvas.removeEventListener(CONTEXT_LOST_EVENT, handleContextLoss);
      canvas.removeEventListener(CONTEXT_RESTORED_EVENT, handleContextRestored);
    }

    shaderState.clear();
    framebufferState.clear();
    renderbufferState.clear();
    textureState.clear();
    elementState.clear();
    bufferState.clear();

    if (timer) {
      timer.clear();
    }

    destroyCallbacks.forEach(function(cb) {
      cb();
    });
  }

  function compileProcedure(options) {
    check(!!options, "invalid args to regl({...})");
    check.type(options, "object", "invalid args to regl({...})");

    function flattenNestedOptions(options) {
      var result = extend({}, options);
      delete result.uniforms;
      delete result.attributes;
      delete result.context;

      if ("stencil" in result && result.stencil.op) {
        result.stencil.opBack = result.stencil.opFront = result.stencil.op;
        delete result.stencil.op;
      }

      function merge(name) {
        if (name in result) {
          var child = result[name];
          delete result[name];
          Object.keys(child).forEach(function(prop) {
            result[name + "." + prop] = child[prop];
          });
        }
      }
      merge("blend");
      merge("depth");
      merge("cull");
      merge("stencil");
      merge("polygonOffset");
      merge("scissor");
      merge("sample");

      return result;
    }

    function separateDynamic(object) {
      var staticItems = {};
      var dynamicItems = {};
      Object.keys(object).forEach(function(option) {
        var value = object[option];
        if (dynamic.isDynamic(value)) {
          dynamicItems[option] = dynamic.unbox(value, option);
        } else {
          staticItems[option] = value;
        }
      });
      return {
        dynamic: dynamicItems,
        static: staticItems
      };
    }

    // Treat context variables separate from other dynamic variables
    const context = separateDynamic(options.context || {});
    const uniforms = separateDynamic(options.uniforms || {});
    const attributes = separateDynamic(options.attributes || {});
    const opts = separateDynamic(flattenNestedOptions(options));

    const stats = {
      gpuTime: 0.0,
      cpuTime: 0.0,
      count: 0
    };

    const compiled = core.compile(opts, attributes, uniforms, context, stats);

    const draw = compiled.draw;
    const batch = compiled.batch;
    const scope = compiled.scope;

    // FIXME: we should modify code generation for batch commands so this
    // isn't necessary
    const EMPTY_ARRAY: null[] = [];
    function reserve(count: number) {
      while (EMPTY_ARRAY.length < count) {
        EMPTY_ARRAY.push(null);
      }
      return EMPTY_ARRAY;
    }

    function REGLCommand(args, body) {
      let i;
      if (contextLost) {
        check.raise("context lost");
      }
      if (typeof args === "function") {
        return scope.call(this, null, args, 0);
      } else if (typeof body === "function") {
        if (typeof args === "number") {
          for (i = 0; i < args; ++i) {
            scope.call(this, null, body, i);
          }
          return;
        } else if (Array.isArray(args)) {
          for (i = 0; i < args.length; ++i) {
            scope.call(this, args[i], body, i);
          }
          return;
        } else {
          return scope.call(this, args, body, 0);
        }
      } else if (typeof args === "number") {
        if (args > 0) {
          return batch.call(this, reserve(args | 0), args | 0);
        }
      } else if (Array.isArray(args)) {
        if (args.length) {
          return batch.call(this, args, args.length);
        }
      } else {
        return draw.call(this, args);
      }
    }

    return Object.assign(REGLCommand, {
      stats: stats
    });
  }

  const setFBO = (framebufferState.setFBO = compileProcedure({
    framebuffer: defineDynamic.call(null, DYN_PROP, "framebuffer")
  }));

  function clearImpl(_, options) {
    var clearFlags = 0;
    core.procs.poll();

    var c = options.color;
    if (c) {
      gl.clearColor(+c[0] || 0, +c[1] || 0, +c[2] || 0, +c[3] || 0);
      clearFlags |= GL_COLOR_BUFFER_BIT;
    }
    if ("depth" in options) {
      gl.clearDepth(+options.depth);
      clearFlags |= GL_DEPTH_BUFFER_BIT;
    }
    if ("stencil" in options) {
      gl.clearStencil(options.stencil | 0);
      clearFlags |= GL_STENCIL_BUFFER_BIT;
    }

    check(!!clearFlags, "called regl.clear with no buffer specified");
    gl.clear(clearFlags);
  }

  function clear(options) {
    check(
      typeof options === "object" && options,
      "regl.clear() takes an object as input"
    );
    if ("framebuffer" in options) {
      if (
        options.framebuffer &&
        options.framebuffer_reglType === "framebufferCube"
      ) {
        for (var i = 0; i < 6; ++i) {
          setFBO(
            extend(
              {
                framebuffer: options.framebuffer.faces[i]
              },
              options
            ),
            clearImpl
          );
        }
      } else {
        setFBO(options, clearImpl);
      }
    } else {
      clearImpl(null, options);
    }
  }

  function frame(cb) {
    check.type(cb, "function", "regl.frame() callback must be a function");
    rafCallbacks.push(cb);

    function cancel() {
      // FIXME:  should we check something other than equals cb here?
      // what if a user calls frame twice with the same callback...
      //
      var i = find(rafCallbacks, cb);
      check(i >= 0, "cannot cancel a frame twice");
      function pendingCancel() {
        var index = find(rafCallbacks, pendingCancel);
        rafCallbacks[index] = rafCallbacks[rafCallbacks.length - 1];
        rafCallbacks.length -= 1;
        if (rafCallbacks.length <= 0) {
          stopRAF();
        }
      }
      rafCallbacks[i] = pendingCancel;
    }

    startRAF();

    return {
      cancel: cancel
    };
  }

  // poll viewport
  function pollViewport() {
    const { viewport, scissor_box: scissorBox } = nextState;
    viewport[0] = viewport[1] = scissorBox[0] = scissorBox[1] = 0;
    contextState.viewportWidth = contextState.framebufferWidth = contextState.drawingBufferWidth = viewport[2] = scissorBox[2] =
      gl.drawingBufferWidth;
    contextState.viewportHeight = contextState.framebufferHeight = contextState.drawingBufferHeight = viewport[3] = scissorBox[3] =
      gl.drawingBufferHeight;
  }

  function poll() {
    contextState.tick += 1;
    contextState.time = now();
    pollViewport();
    core.procs.poll();
  }

  function refresh() {
    pollViewport();
    core.procs.refresh();
    if (timer) {
      timer.update();
    }
  }

  function now() {
    return (clock() - START_TIME) / 1000.0;
  }

  refresh();

  function addListener(
    event: "frame" | "lost" | "restore" | "destroy",
    callback: () => void
  ) {
    check.type(callback, "function", "listener callback must be a function");

    let callbacks: (() => void)[];
    switch (event) {
      case "frame":
        return frame(callback);
      case "lost":
        callbacks = lossCallbacks;
        break;
      case "restore":
        callbacks = restoreCallbacks;
        break;
      case "destroy":
        callbacks = destroyCallbacks;
        break;
      default:
        check.raise("invalid event, must be one of frame,lost,restore,destroy");
        return;
    }

    callbacks.push(callback);
    return {
      cancel() {
        for (let i = 0; i < callbacks.length; ++i) {
          if (callbacks[i] === callback) {
            callbacks[i] = callbacks[callbacks.length - 1];
            callbacks.pop();
            return;
          }
        }
      }
    };
  }

  const regl = Object.assign(compileProcedure, {
    // Clear current FBO
    clear: clear,

    // Short cuts for dynamic variables
    prop: defineDynamic.bind(null, DYN_PROP),
    context: defineDynamic.bind(null, DYN_CONTEXT),
    this: defineDynamic.bind(null, DYN_STATE),

    // executes an empty draw command
    draw: compileProcedure({}),

    // Resources
    buffer(options) {
      return bufferState.create(options, GL_ARRAY_BUFFER, false, false);
    },
    elements(options) {
      return elementState.create(options, false);
    },
    texture: textureState.create2D,
    cube: textureState.createCube,
    renderbuffer: renderbufferState.create,
    framebuffer: framebufferState.create,
    framebufferCube: framebufferState.createCube,

    // Expose context attributes
    attributes: glAttributes,

    // Frame rendering
    frame,
    on: addListener,

    // System limits
    limits,
    hasExtension(name: string) {
      return limits.extensions.indexOf(name.toLowerCase()) >= 0;
    },

    // Read pixels
    read: readPixels,

    // Destroy regl and all associated resources
    destroy,

    // Direct GL state manipulation
    _gl: gl,
    _refresh: refresh,

    poll() {
      poll();
      if (timer) {
        timer.update();
      }
    },

    // Current time
    now,

    // regl Statistics Information
    stats
  });

  config.onDone(null, regl);

  return regl;
}
