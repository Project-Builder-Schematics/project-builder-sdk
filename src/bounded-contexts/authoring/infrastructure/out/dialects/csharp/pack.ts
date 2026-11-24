// The runtime op pack lives apart from index.ts so a dialect that extends C# (aspnet) composes
// the same ops without importing the `find` entry point.
import type { CsharpDocument } from "./ast.ts";
import { addBaseType, addConstructorParameter, addMember, addUsing, type FromOptions, type UsingOptions } from "./ops.ts";

export type CsharpOps = {
  addUsing: (ast: CsharpDocument, namespace: string, options?: UsingOptions) => void;
  addBaseType: (ast: CsharpDocument, typeName: string, base: string, options?: FromOptions) => void;
  addMember: (ast: CsharpDocument, typeName: string, source: string) => void;
  addConstructorParameter: (ast: CsharpDocument, typeName: string, name: string, type: string, options?: FromOptions) => void;
};

export const csharpOps: CsharpOps = { addUsing, addBaseType, addMember, addConstructorParameter };
