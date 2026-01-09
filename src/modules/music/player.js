const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { SoundCloudPlugin } = require("@distube/soundcloud");

function initMusic(client) {
  // Minimal, safe config: only pass plugins
  const distube = new DisTube(client, {
    plugins: [new SpotifyPlugin(), new SoundCloudPlugin()],
  });

  // Attach instance to client so commands can use it
  client.distube = distube;

  distube
    .on("playSong", (queue, song) => {
      queue.textChannel
        ?.send(
          `🎶 Now playing: **${song.name}** \`[${song.formattedDuration}]\` requested by <@${song.user?.id}>`
        )
        .catch(() => {});
    })
    .on("addSong", (queue, song) => {
      queue.textChannel
        ?.send(
          `➕ Added to queue: **${song.name}** \`[${song.formattedDuration}]\` by <@${song.user?.id}>`
        )
        .catch(() => {});
    })
    .on("error", (channel, error) => {
      console.error("[music] error:", error);
      channel?.send("❌ Music error occurred.").catch(() => {});
    });

  console.log("🎵 Music system initialized (DisTube).");
}

module.exports = { initMusic };
