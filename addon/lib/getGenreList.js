async function getGenreList(moviedb, language, type) {
  if (type === "movie") {
    const genre = await moviedb
      .genreMovieList({ language })
      .then((res) => {
        return res.genres;
      })
      .catch(console.error);
    return genre;
  } else {
    const genre = await moviedb
      .genreTvList({ language })
      .then((res) => {
        return res.genres;
      })
      .catch(console.error);
    return genre;
  }
}

module.exports = { getGenreList };
