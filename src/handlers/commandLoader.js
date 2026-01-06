const fs = require("fs");
const path = require("path");

function loadCommands(dir) {
  const commands = new Map();

  function walk(folder) {
    for (const file of fs.readdirSync(folder)) {
      const fullPath = path.join(folder, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) walk(fullPath);
      else if (file.endsWith(".js")) {
        const cmd = require(fullPath);
        if (cmd?.data?.name && typeof cmd.execute === "function") {
          commands.set(cmd.data.name, cmd);
        }
      }
    }
  }

  walk(dir);
  return commands;
}

module.exports = { loadCommands };
