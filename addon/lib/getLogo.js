function pickLogo(resp, language, original_language) {
  if (resp.find((data) => data.lang === language.split("-")[0]) != undefined) {
    return resp.find((data) => data.lang === language.split("-")[0]);
  } else if (
    resp.find((data) => data.lang === original_language) != undefined
  ) {
    return resp.find((data) => data.lang === original_language);
  } else if (resp.find((data) => data.lang === "en") != undefined) {
    return resp.find((data) => data.lang === "en");
  } else {
    return resp[0];
  }
}

async function getLogo(moviedb, fanart, tmdbId, language, originalLanguage) {
  if (!tmdbId) {
    throw new Error(`TMDB ID not available for logo: ${tmdbId}`);
  }

  const fanartLogo = fanart
    ? await fanart
        .getMovieImages(tmdbId)
        .then((response) => {
          const logos = response.hdmovielogo;
          if (logos) {
            const logo = pickLogo(logos, language, originalLanguage);
            return logo.url;
          }
          return "";
        })
        .catch(() => undefined)
    : undefined;

  if (fanartLogo) {
    return fanartLogo;
  }

  const tmdbLogo = await moviedb
    .movieImages({ id: tmdbId })
    .then((response) => {
      const logos = response.logos;
      if (logos && logos.length > 0) {
        const logo = logos.find(
          (logo) =>
            logo.iso_639_1 === language.split("-")[0] ||
            logo.iso_639_1 === originalLanguage ||
            logo.iso_639_1 === "en"
        );

        return logo
          ? `https://image.tmdb.org/t/p/original${logo.file_path}`
          : "";
      }
      return "";
    })
    .catch(() => "");

  return tmdbLogo;
}

async function getTvLogo(fanart, tvdb_id, tmdbId, language, original_language) {
  if (!tvdb_id && !tmdbId) {
    return Promise.reject(
      Error(`TVDB ID and TMDB ID not available for logos.`)
    );
  }

  const fanartLogo = fanart
    ? await fanart
        .getShowImages(tvdb_id)
        .then((res) => {
          const resp = res.hdtvlogo;
          if (resp !== undefined) {
            const { url } = pickLogo(resp, language, original_language);
            return url;
          } else {
            return "";
          }
        })
        .catch((err) => {
          console.error("Error fetching TV logo from Fanart.tv:", err);
          return "";
        })
    : "";

  if (fanartLogo) {
    return fanartLogo;
  } else if (tmdbId) {
    const tmdbLogo = await moviedb
      .tvImages({ id: tmdbId })
      .then((res) => {
        if (res.logos && res.logos.length > 0) {
          const logo =
            res.logos.find(
              (logo) => logo.iso_639_1 === language.split("-")[0]
            ) ||
            res.logos.find((logo) => logo.iso_639_1 === original_language) ||
            res.logos.find((logo) => logo.iso_639_1 === "en");

          const logoUrl = logo
            ? `https://image.tmdb.org/t/p/original${logo.file_path}`
            : "";
          return logoUrl;
        }
        return "";
      })
      .catch((err) => {
        console.error("Error fetching TV logo from TMDB:", err);
        return "";
      });

    return tmdbLogo;
  }

  return "";
}

module.exports = { getLogo, getTvLogo };
