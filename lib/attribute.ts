import { GL_FLOAT } from "./util/gl-types";

class AttributeRecord {
  state = 0;

  x = 0.0;
  y = 0.0;
  z = 0.0;
  w = 0.0;

  buffer = null;
  size = 0;
  normalized = false;
  type = GL_FLOAT;
  offset = 0;
  stride = 0;
  divisor = 0;
}

export default function wrapAttributeState(
  _gl: unknown,
  _extensions: unknown,
  limits: { maxAttributes: number },
  _stringStore: unknown
) {
  const NUM_ATTRIBUTES = limits.maxAttributes;
  const attributeBindings = new Array(NUM_ATTRIBUTES);
  for (let i = 0; i < NUM_ATTRIBUTES; ++i) {
    attributeBindings[i] = new AttributeRecord();
  }

  return {
    Record: AttributeRecord,
    scope: {},
    state: attributeBindings
  };
}
