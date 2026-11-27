// The author-facing dialect kit (A-16): the one part of the core kit that leaves the ADR-0009
// boundary, so an author can build, compose and route a Dialect of their own.

export {
  defineAuthorDialect as defineDialect,
  defineOpPack,
  withOps,
  withoutOps,
  overrideOps,
  byExtension,
  query,
} from "../bounded-contexts/authoring/domain/services/define-dialect.ts";
export type {
  Dialect,
  DialectAst,
  DialectDescriptor,
  ExtensionRouter,
  Handle,
  Op,
  OpPack,
  Query,
} from "../bounded-contexts/authoring/domain/services/define-dialect.ts";
