// KIT-03: pure args→Directive; never renders templates, never touches AST.

import type { Directive, JsonValue } from "./wire.ts";

export interface CreateArgs {
  pathTemplate: string;
  template: string;
  options: JsonValue;
  force?: boolean;
}

export interface ModifyArgs {
  path: string;
  content: string;
}

export interface RemoveArgs {
  path: string;
}

export interface RenameArgs {
  path: string;
  newName: string;
  force?: boolean;
}

export interface MoveArgs {
  path: string;
  toDir: string;
}

export interface CopyArgs {
  from: string;
  to: string;
  force?: boolean;
}

export class DirectiveFactory {
  create(a: CreateArgs): Directive {
    return {
      op: "create",
      create: {
        pathTemplate: a.pathTemplate,
        template: a.template,
        options: a.options,
        ...(a.force !== undefined ? { force: a.force } : {}),
      },
    };
  }

  modify(a: ModifyArgs): Directive {
    return { op: "modify", modify: { path: a.path, content: a.content } };
  }

  // Author verb `remove` lowers to wire op `delete` — ADR-0028 vocabulary; they deliberately differ.
  remove(a: RemoveArgs): Directive {
    return { op: "delete", delete: { path: a.path } };
  }

  rename(a: RenameArgs): Directive {
    return {
      op: "rename",
      rename: {
        path: a.path,
        newName: a.newName,
        ...(a.force !== undefined ? { force: a.force } : {}),
      },
    };
  }

  move(a: MoveArgs): Directive {
    return { op: "move", move: { path: a.path, toDir: a.toDir } };
  }

  // `copy` emits the ADR-0028 shape only — apply behaviour is deferred to vNext.
  copy(a: CopyArgs): Directive {
    return {
      op: "copy",
      copy: {
        from: a.from,
        to: a.to,
        ...(a.force !== undefined ? { force: a.force } : {}),
      },
    };
  }
}
