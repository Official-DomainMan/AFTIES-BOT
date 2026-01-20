// src/modules/music/player.js
const { DisTube } = require("distube");
const { YtDlpPlugin } = require("@distube/yt-dlp");
const { SpotifyPlugin } = require("@distube/spotify");

let distube = null;

/**
 * Initialize the global DisTube instance and attach it to the client.
 * Call this once from index.js after the client is created.
 */
function initMusic(client) {
  // If it's already on the client, reuse it
  if (client.distube) {
    distube = client.distube;
    console.log("[music] DisTube already initialized on client.");
    return distube;
  }

  if (distube) {
    // We have a module-level instance but it wasn't on the client yet
    client.distube = distube;
    console.log("[music] Attached existing DisTube instance to client.");
    return distube;
  }

  console.log("[music] Initializing DisTube...");

  // Keep options minimal so newer DisTube versions don't throw INVALID_KEY
  distube = new DisTube(client, {
    plugins: [
      // yt-dlp for YouTube
      new YtDlpPlugin({
        // Don't auto-update binary (safer on Railway/Windows)
        update: false,
      }),
      // Basic Spotify support – no extra options
      new SpotifyPlugin(),
    ],
  });

  // Attach to client so commands can access interaction.client.distube
  client.distube = distube;

  // ───────────────────────────
  // Optional: Event logging
  // ───────────────────────────
  distube
    .on("playSong", (queue, song) => {
      const channel = queue.textChannel;
      if (!channel) return;

      channel
        .send(
          `🎶 Now playing: **${song.name}** \`${song.formattedDuration}\`\n` +
            `Requested by <@${song.user?.id || "unknown"}>`,
        )
        .catch(() => {});
    })
    .on("addSong", (queue, song) => {
      const channel = queue.textChannel;
      if (!channel) return;

      channel
        .send(
          `➕ Added to queue: **${song.name}** \`${song.formattedDuration}\`\n` +
            `Requested by <@${song.user?.id || "unknown"}>`,
        )
        .catch(() => {});
    })
    .on("error", (channel, error) => {
      console.error("[music] DisTube error:", error);
      try {
        if (channel && channel.send) {
          channel
            .send("❌ There was an error with the music system.")
            .catch(() => {});
        }
      } catch {
        // ignore
      }
    });

  console.log("🎵 Music system initialized (DisTube).");
  return distube;
}

/**
 * Optional getter for modules that want direct access.
 */
function getDisTube() {
  if (!distube) {
    throw new Error(
      "[music] DisTube not initialized yet. Call initMusic(client) first.",
    );
  }
  return distube;
}

module.exports = {
  initMusic,
  getDisTube,
};
