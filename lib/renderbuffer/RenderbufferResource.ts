import { GLVAL } from "../constants";
import { FORMATS } from "./constants";

export class RenderbufferResource {
  id: number;
  renderbuffer: WebGLRenderbuffer;
  refCount = 1;
  format: FORMATS = GLVAL.GL_RGBA4;
  width = 0;
  height = 0;

  onDestroy: () => void;
  stats?: { size: number };

  constructor(
    renderbuffer: WebGLRenderbuffer,
    id: number,
    onDestroy: () => void,
    profile?: boolean
  ) {
    this.renderbuffer = renderbuffer;
    this.id = id;
    this.onDestroy = onDestroy;

    if (profile) {
      this.stats = { size: 0 };
    }
  }

  decRef() {
    if (--this.refCount <= 0) {
      this.onDestroy();
    }
  }
}
