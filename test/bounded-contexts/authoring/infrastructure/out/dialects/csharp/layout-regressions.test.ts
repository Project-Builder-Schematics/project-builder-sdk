import { describe, it } from "bun:test";
import * as aspnet from "../../../../../../../src/dialects/aspnet/index.ts";
import { expectFile } from "./harness.ts";

describe("layout around comments and preprocessor lines (A-108, A-109, A-113, A-116)", () => {
  it("addMember after a trailing #endregion keeps the closing brace on its own line", async () => {
    await expectFile(
      "class A\n{\n    #region R\n    int x;\n    #endregion\n}\n",
      (h) => h.addMember("A", "int y;"),
      "class A\n{\n    #region R\n    int x;\n    #endregion\n    int y;\n}\n"
    );
  });

  it("addMember after a trailing #endif indents the member one unit deeper than the type", async () => {
    await expectFile(
      "class A\n{\n#if DEBUG\n    int x;\n#endif\n}\n",
      (h) => h.addMember("A", "int y;"),
      "class A\n{\n#if DEBUG\n    int x;\n#endif\n    int y;\n}\n"
    );
  });

  it("addUsing keeps a trailing comment on the directive it belongs to", async () => {
    await expectFile(
      "using System; // core\n\nclass A {}\n",
      (h) => h.addUsing("System.IO"),
      "using System; // core\nusing System.IO;\n\nclass A {}\n"
    );
  });

  it("addUsing into a file with a header comment and a blank line leaves one blank line before the code", async () => {
    await expectFile(
      "// header\n\nnamespace A;\n",
      (h) => h.addUsing("System"),
      "// header\nusing System;\n\nnamespace A;\n"
    );
  });

  it("addService keeps a trailing comment on the statement it belongs to", async () => {
    await expectFile(
      "var builder = WebApplication.CreateBuilder(args); // init\nvar app = builder.Build();\n",
      (h) => (h as unknown as ReturnType<typeof aspnet.find>).addService("Scoped", "IA", "A"),
      "var builder = WebApplication.CreateBuilder(args); // init\nbuilder.Services.AddScoped<IA, A>();\nvar app = builder.Build();\n",
      aspnet.find
    );
  });
  it("addUsing into a file that is only a comment with no final newline starts the directive on its own line", async () => {
    await expectFile("// header", (h) => h.addUsing("System"), "// header\nusing System;\n");
  });
});
