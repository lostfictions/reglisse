let VARIABLE_COUNTER = 0;

const DYN_FUNC = 0;

export class DynamicVariable {
  id: number;
  type: number;
  data: unknown;

  constructor(type: number, data: unknown) {
    this.id = VARIABLE_COUNTER++;
    this.type = type;
    this.data = data;
  }
}

function escapeStr(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function splitParts(str: string): string[] {
  if (str.length === 0) {
    return [] as string[];
  }

  const firstChar = str.charAt(0);
  const lastChar = str.charAt(str.length - 1);

  if (
    str.length > 1 &&
    firstChar === lastChar &&
    (firstChar === '"' || firstChar === "'")
  ) {
    return ['"' + escapeStr(str.substr(1, str.length - 2)) + '"'];
  }

  const parts = /\[(false|true|null|\d+|'[^']*'|"[^"]*")\]/.exec(str);
  if (parts) {
    return splitParts(str.substr(0, parts.index))
      .concat(splitParts(parts[1]))
      .concat(splitParts(str.substr(parts.index + parts[0].length)));
  }

  const subparts = str.split(".");
  if (subparts.length === 1) {
    return ['"' + escapeStr(str) + '"'];
  }

  let result: string[] = [];
  for (let i = 0; i < subparts.length; ++i) {
    result = result.concat(splitParts(subparts[i]));
  }
  return result;
}

export function accessor(str: string) {
  return `[${splitParts(str).join("][")}]`;
}

export function define(type: number, data: string) {
  return new DynamicVariable(type, accessor(data + ""));
}

export function isDynamic(x: any): x is DynamicVariable {
  return (
    (typeof x === "function" && !x._reglType) || x instanceof DynamicVariable
  );
}

export function unbox(x: unknown, _path: unknown) {
  if (typeof x === "function") {
    return new DynamicVariable(DYN_FUNC, x);
  }
  return x;
}
