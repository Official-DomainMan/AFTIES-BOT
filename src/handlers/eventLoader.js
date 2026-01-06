const fs = require("fs");
const path = require("path");

function loadEvents(client, dir) {
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".js")) continue;

    const event = require(path.join(dir, file));
    if (!event?.name || typeof event.execute !== "function") continue;

    if (event.once)
      client.once(event.name, (...args) => event.execute(...args));
    else client.on(event.name, (...args) => event.execute(...args));
  }
}

module.exports = { loadEvents };
