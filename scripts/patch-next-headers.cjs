const fs = require("node:fs");
const path = require("node:path");

// Next 16.4.5 calls hasOwnProperty directly on request headers. Some
// runtimes supply null-prototype objects, so use the prototype method safely.
// Patch the bundled runtimes too: they embed copies of the server code.
const nextRoot = path.dirname(require.resolve("next/package.json"));
let replacements = 0;

function patchDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      patchDirectory(filename);
    } else if (entry.name.endsWith(".js")) {
      const original = fs.readFileSync(filename, "utf8");
      const patched = original.replace(
        /\b(rawHeaders|headers)\.hasOwnProperty\(/g,
        (_, name) => {
          replacements++;
          return `Object.prototype.hasOwnProperty.call(${name},`;
        },
      );
      if (patched !== original) fs.writeFileSync(filename, patched);
    }
  }
}

patchDirectory(path.join(nextRoot, "dist/server"));
patchDirectory(path.join(nextRoot, "dist/compiled/next-server"));
console.log(`Patched ${replacements} Next.js header property checks.`);
