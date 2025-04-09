const { getGenreList } = require("./getGenreList");
const { parseMedia } = require("../utils/parseProps");

async function getTrending(moviedb, type, language, page, genre) {
  const media_type = type === "series" ? "tv" : type;
  const parameters = {
    media_type,
    time_window: genre ? genre.toLowerCase() : "day",
    language,
    page,
  };
  const genreList = await getGenreList(moviedb, language, type);
  return await moviedb
    .trending(parameters)
    .then(async (res) => {
      const metas = res.results.map((el) => parseMedia(el, type, genreList));
      return { metas };
    })
    .catch(console.error);
}

module.exports = { getTrending };
