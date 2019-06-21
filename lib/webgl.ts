// Context and canvas creation helper functions
import check from "./util/check";

function createCanvas(element: HTMLElement, pixelRatio: number) {
  const canvas = document.createElement("canvas");

  Object.assign(canvas.style, {
    border: 0,
    margin: 0,
    padding: 0,
    top: 0,
    left: 0
  });

  element.appendChild(canvas);

  if (element === document.body) {
    canvas.style.position = "absolute";
    Object.assign(element.style, {
      margin: 0,
      padding: 0
    });
  }

  function resize() {
    let w = window.innerWidth;
    let h = window.innerHeight;
    if (element !== document.body) {
      const bounds = element.getBoundingClientRect();
      w = bounds.right - bounds.left;
      h = bounds.bottom - bounds.top;
    }
    canvas.width = pixelRatio * w;
    canvas.height = pixelRatio * h;
    Object.assign(canvas.style, {
      width: w + "px",
      height: h + "px"
    });
  }

  window.addEventListener("resize", resize, false);

  function onDestroy() {
    window.removeEventListener("resize", resize);
    element.removeChild(canvas);
  }

  resize();

  return {
    canvas,
    onDestroy
  };
}

function createContext(
  canvas: HTMLCanvasElement,
  contextAttributes?: {}
): WebGLRenderingContext | null {
  function get(name: string) {
    try {
      return canvas.getContext(
        name,
        contextAttributes
      ) as WebGLRenderingContext;
    } catch (e) {
      return null;
    }
  }
  return get("webgl") || get("experimental-webgl") || get("webgl-experimental");
}

function isHTMLElement(obj: any): obj is HTMLElement {
  return (
    typeof obj.nodeName === "string" &&
    typeof obj.appendChild === "function" &&
    typeof obj.getBoundingClientRect === "function"
  );
}

function isWebGLContext(obj: any): obj is WebGLRenderingContext {
  return (
    typeof obj.drawArrays === "function" ||
    typeof obj.drawElements === "function"
  );
}

function parseExtensions(input: string | string[]): string[] {
  if (typeof input === "string") {
    return [input];
  }
  check(Array.isArray(input), "invalid extension array");
  return input;
}

function ensureElement(desc: string | HTMLElement): HTMLElement | null {
  if (typeof desc === "string") {
    check(typeof document !== "undefined", "not supported outside of DOM");
    return document.querySelector(desc);
  }
  return desc;
}

type ReglConfig = (
  | {
      gl: WebGLRenderingContext;
    }
  | {
      canvas: string | HTMLCanvasElement;
    }
  | {
      container: string | HTMLElement;
    }) & {
  attributes?: {};
  extensions?: string | string[];
  optionalExtensions?: string | string[];
  pixelRatio?: number;
  profile?: boolean;
  onDone?: (err: any) => void;
  onDestroy?: () => void;
};

export interface ReglInit {
  gl: WebGLRenderingContext;
  canvas: HTMLCanvasElement | null;
  container: HTMLElement | null;
  extensions: string[];
  optionalExtensions: string[];
  pixelRatio: number;
  profile: boolean;
  onDone: (err: any) => void;
  onDestroy: () => void;
}

export default function parseArgs(): ReglInit;
export default function parseArgs(selector: string): ReglInit;
export default function parseArgs(element: HTMLElement): ReglInit;
export default function parseArgs(context: WebGLRenderingContext): ReglInit;
export default function parseArgs(config: ReglConfig): ReglInit;
export default function parseArgs(
  args_?: string | HTMLElement | WebGLRenderingContext | ReglConfig
): ReglInit {
  const args = args_ || ({} as ReglConfig);
  let element: HTMLElement | undefined;
  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let gl: WebGLRenderingContext | null = null;

  let contextAttributes = {};
  let extensions: string[] = [];
  let optionalExtensions: string[] = [];
  let pixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  let profile = false;
  let onDone = (err: any) => {
    if (err) {
      check.raise(err);
    }
  };
  let onDestroy = () => {};

  if (typeof args === "string") {
    check(
      typeof document !== "undefined",
      "selector queries only supported in DOM enviroments"
    );
    element = document.querySelector(args) as HTMLElement;
    check(element, "invalid query string for element");
  } else if (typeof args === "object") {
    if (isHTMLElement(args)) {
      element = args;
    } else if (isWebGLContext(args)) {
      gl = args;
      canvas = gl.canvas;
    } else {
      check.constructor(args);

      if ("gl" in args) {
        gl = args.gl!;
      } else if ("canvas" in args) {
        canvas = ensureElement(args.canvas!) as HTMLCanvasElement;
      } else if ("container" in args) {
        container = ensureElement(args.container!);
      }

      if ("attributes" in args) {
        contextAttributes = args.attributes!;
        check.type(contextAttributes, "object", "invalid context attributes");
      }
      if ("extensions" in args) {
        extensions = parseExtensions(args.extensions!);
      }
      if ("optionalExtensions" in args) {
        optionalExtensions = parseExtensions(args.optionalExtensions!);
      }
      if ("onDone" in args) {
        check.type(
          args.onDone,
          "function",
          "invalid or missing onDone callback"
        );
        onDone = args.onDone!;
      }
      if ("profile" in args) {
        profile = !!args.profile;
      }
      if ("pixelRatio" in args) {
        pixelRatio = +args.pixelRatio!;
        check(pixelRatio > 0, "invalid pixel ratio");
      }
    }
  } else {
    check.raise("invalid arguments to regl");
  }

  if (element) {
    if (element.nodeName.toLowerCase() === "canvas") {
      canvas = element as HTMLCanvasElement;
    } else {
      container = element;
    }
  }

  if (!gl) {
    if (!canvas) {
      check(
        typeof document !== "undefined",
        "must manually specify webgl context outside of DOM environments"
      );

      ({ canvas, onDestroy } = createCanvas(
        container! || document.body,
        pixelRatio
      ));
    }
    gl = createContext(canvas, contextAttributes);
  }

  if (!gl) {
    onDestroy();
    onDone(
      "webgl not supported, try upgrading your browser or graphics drivers http://get.webgl.org"
    );
  }

  return {
    gl: gl!,
    canvas,
    container,
    extensions,
    optionalExtensions,
    pixelRatio,
    profile,
    onDone,
    onDestroy
  };
}
