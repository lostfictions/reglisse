function join(x: any[]): string {
  return x.join("");
}

export default function createEnvironment() {
  // Unique variable id counter
  let varCounter = 0;

  // Linked values are passed from this scope into the generated code block
  // Calling link() passes a value into the generated scope and returns
  // the variable name which it is bound to
  const linkedNames: string[] = [];
  const linkedValues: unknown[] = [];
  function link(value: unknown) {
    for (let i = 0; i < linkedValues.length; ++i) {
      if (linkedValues[i] === value) {
        return linkedNames[i];
      }
    }

    const name = "g" + varCounter++;
    linkedNames.push(name);
    linkedValues.push(value);
    return name;
  }

  // create a code block
  function block() {
    const code: string[] = [];
    function push(...args: string[]) {
      code.push(...args);
    }

    const vars: string[] = [];
    function def(...args: string[]) {
      const name = "v" + varCounter++;
      vars.push(name);

      if (args.length > 0) {
        code.push(name, "=", ...args, ";");
      }

      return name;
    }

    return Object.assign(push, {
      def,
      toString() {
        return join([vars.length > 0 ? "var " + vars + ";" : "", join(code)]);
      }
    });
  }

  function scope() {
    const entry = block();
    const exit = block();

    const entryToString = entry.toString;
    const exitToString = exit.toString;

    function save(object: string, prop: string) {
      exit(object, prop, "=", entry.def(object, prop), ";");
    }

    return Object.assign(
      function(...args: string[]) {
        entry(...args);
      },
      {
        def: entry.def,
        entry,
        exit,
        save,
        set(object: string, prop: string, value: string) {
          save(object, prop);
          entry(object, prop, "=", value, ";");
        },
        toString() {
          return entryToString() + exitToString();
        }
      }
    );
  }

  function cond(...args: string[]) {
    const pred = join(args);
    const thenBlock = scope();
    const elseBlock = scope();

    const thenToString = thenBlock.toString;
    const elseToString = elseBlock.toString;

    return Object.assign(thenBlock, {
      then(...args_: string[]) {
        thenBlock(...args_);
        return this;
      },
      else(...args_: string[]) {
        elseBlock(...args_);
        return this;
      },
      toString() {
        let elseClause = elseToString();
        if (elseClause) {
          elseClause = "else{" + elseClause + "}";
        }
        return join(["if(", pred, "){", thenToString(), "}", elseClause]);
      }
    });
  }

  // procedure list
  const globalBlock = block();
  const procedures: { [name: string]: object } = {};
  function proc(name: string, count?: number) {
    const args: string[] = [];
    function arg() {
      const name_ = "a" + args.length;
      args.push(name_);
      return name_;
    }

    count = count || 0;
    for (let i = 0; i < count; ++i) {
      arg();
    }

    const body = scope();
    const bodyToString = body.toString;

    const result = (procedures[name] = Object.assign(body, {
      arg,
      toString() {
        return join(["function(", args.join(), "){", bodyToString(), "}"]);
      }
    }));

    return result;
  }

  function compile(): string {
    const code = ['"use strict";', globalBlock, "return {"];
    Object.keys(procedures).forEach(name => {
      code.push('"', name, '":', procedures[name].toString(), ",");
    });
    code.push("}");
    const src = join(code)
      .replace(/;/g, ";\n")
      .replace(/}/g, "}\n")
      .replace(/{/g, "{\n");
    const proc_ = Function.apply(null, linkedNames.concat(src));
    return proc_.apply(null, linkedValues);
  }

  return {
    global: globalBlock,
    link,
    block,
    proc,
    scope,
    cond,
    compile
  };
}
