// The runtime op pack lives apart from index.ts so a dialect that extends TypeScript
// (src/dialects/nestjs) composes the same ops without importing the `find` entry point.
import {
  addImport,
  addDefaultImport,
  addNamespaceImport,
  addTypeImport,
  addSideEffectImport,
  addReExport,
  addExportAll,
  addFunction,
  addVariable,
  addClass,
  removeImport,
  removeExport,
  removeExportAll,
} from "./ops.ts";
import { addArrayElement } from "./array-element.ts";

export const typescriptOps = {
  addImport,
  addDefaultImport,
  addNamespaceImport,
  addTypeImport,
  addSideEffectImport,
  addReExport,
  addExportAll,
  addFunction,
  addVariable,
  addClass,
  removeImport,
  removeExport,
  removeExportAll,
  addArrayElement,
};
