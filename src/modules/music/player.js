// src/modules/music/player.js
const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { SoundCloudPlugin } = require("@distube/soundcloud");
const ffmpeg = require("ffmpeg-static");

function initMusic(client) {
  const distube = new DisTube(client, {
    // Use ffmpeg-static for audio
    ffmpeg: {
      path: ffmpeg,
    },
    // No youtubeDL, no yt-dlp plugin – keep it simple
    plugins: [new SpotifyPlugin(), new SoundCloudPlugin()],
  });

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
        ?.send(`➕ Added to queue: **${song.name}**`)
        .catch(() => {});
    })
    .on("error", (channel, error) => {
      console.error("[music] DisTube error:", error);
      if (channel && channel.send) {
        channel.send(`❌ Music error: \`${error.message}\``).catch(() => {});
      }
    });

  console.log("🎵 Music system initialized (DisTube).");
}

module.exports = { initMusic };
