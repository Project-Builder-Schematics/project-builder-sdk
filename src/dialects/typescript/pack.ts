// The runtime op pack lives apart from index.ts so a dialect that extends TypeScript
// (src/dialects/nestjs) composes the same ops without importing the `find` entry point.
import {
  addImport,
  addDefaultImport,
  addNamespaceImport,
  addTypeImport,
  addSideEffectImport,
  addFunction,
  addVariable,
  addClass,
  removeImport,
} from "./ops.ts";

export const typescriptOps = {
  addImport,
  addDefaultImport,
  addNamespaceImport,
  addTypeImport,
  addSideEffectImport,
  addFunction,
  addVariable,
  addClass,
  removeImport,
};
