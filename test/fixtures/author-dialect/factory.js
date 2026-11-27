// A factory that edits through an author-defined dialect it imports by package name. The test
// copies it into a fresh folder and links that name into the folder's node_modules.
import { ini } from "@company/ini-dialect";

export default async function authorDialectFactory() {
  await ini.find("settings.ini").modify((tree) => {
    tree.text = "colour=blue";
  });
}
