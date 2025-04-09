const { getLogo, getTvLogo } = require("./getLogo");
const Utils = require("../utils/parseProps");
const { getEpisodes } = require("./getEpisodes");
const { getImdbRating } = require("./getImdbRating");

const blacklistLogoUrls = [
  // fanart bug, responds with "The Crime" logo for all IDs it considers invalid
  "https://assets.fanart.tv/fanart/tv/0/hdtvlogo/-60a02798b7eea.png",
];

async function getMeta(
  moviedb,
  fanart,
  type,
  language,
  tmdbId,
  rpdbkey,
  config = {}
) {
  if (type === "movie") {
    const meta = await moviedb
      .movieInfo({ id: tmdbId, language, append_to_response: "videos,credits" })
      .then(async (res) => {
        const imdbRating =
          (res.external_ids?.imdb_id &&
            (await getImdbRating(res.external_ids.imdb_id, type))) ||
          res.vote_average.toFixed(1);
        const resp = {
          imdb_id: res.imdb_id,
          cast: Utils.parseCast(res.credits),
          country: Utils.parseCoutry(res.production_countries),
          description: res.overview,
          director: Utils.parseDirector(res.credits),
          genre: Utils.parseGenres(res.genres),
          imdbRating: imdbRating || "N/A",
          name: res.title,
          released: new Date(res.release_date),
          slug: Utils.parseSlug(type, res.title, res.imdb_id),
          type: type,
          writer: Utils.parseWriter(res.credits),
          year: res.release_date ? res.release_date.substr(0, 4) : "",
          trailers: Utils.parseTrailers(res.videos),
          background: `https://image.tmdb.org/t/p/original${res.backdrop_path}`,
          poster: await Utils.parsePoster(
            type,
            tmdbId,
            res.poster_path,
            language,
            rpdbkey
          ),
          runtime: Utils.parseRunTime(res.runtime),
          id: `tmdb:${tmdbId}`,
          genres: Utils.parseGenres(res.genres),
          releaseInfo: res.release_date ? res.release_date.substr(0, 4) : "",
          trailerStreams: Utils.parseTrailerStream(res.videos),
          links: new Array(
            Utils.parseImdbLink(imdbRating, res.imdb_id),
            Utils.parseShareLink(res.title, res.imdb_id, type),
            ...Utils.parseGenreLink(res.genres, type, language),
            ...Utils.parseCreditsLink(res.credits)
          ),
          behaviorHints: {
            defaultVideoId: res.imdb_id ? res.imdb_id : `tmdb:${res.id}`,
            hasScheduledVideos: false,
          },
        };
        try {
          resp.logo = await getLogo(
            moviedb,
            fanart,
            tmdbId,
            language,
            res.original_language
          );
        } catch (e) {
          console.log(
            `warning: logo could not be retrieved for ${tmdbId} - ${type}`
          );
          console.log((e || {}).message || "unknown error");
        }
        if (resp.logo && blacklistLogoUrls.includes(resp.logo)) {
          delete resp.logo;
        }
        if (resp.logo) {
          resp.logo = resp.logo.replace("http://", "https://");
        }
        return resp;
      })
      .catch(console.error);
    return Promise.resolve({ meta });
  } else {
    const meta = await moviedb
      .tvInfo({
        id: tmdbId,
        language,
        append_to_response: "videos,credits,external_ids",
      })
      .then(async (res) => {
        const imdbRating =
          (res.external_ids?.imdb_id &&
            (await getImdbRating(res.external_ids.imdb_id, type))) ||
          res.vote_average.toFixed(1);
        const runtime =
          res.episode_run_time?.[0] ??
          res.last_episode_to_air?.runtime ??
          res.next_episode_to_air?.runtime ??
          null;
        const resp = {
          cast: Utils.parseCast(res.credits),
          country: Utils.parseCoutry(res.production_countries),
          description: res.overview,
          genre: Utils.parseGenres(res.genres),
          imdbRating: imdbRating || "N/A",
          imdb_id: res.external_ids.imdb_id,
          name: res.name,
          poster: await Utils.parsePoster(
            type,
            tmdbId,
            res.poster_path,
            language,
            rpdbkey
          ),
          released: new Date(res.first_air_date),
          runtime: Utils.parseRunTime(runtime),
          status: res.status,
          type: type,
          writer: Utils.parseCreatedBy(res.created_by),
          year: Utils.parseYear(
            res.status,
            res.first_air_date,
            res.last_air_date
          ),
          background: `https://image.tmdb.org/t/p/original${res.backdrop_path}`,
          slug: Utils.parseSlug(type, res.name, res.external_ids.imdb_id),
          id: `tmdb:${tmdbId}`,
          genres: Utils.parseGenres(res.genres),
          releaseInfo: Utils.parseYear(
            res.status,
            res.first_air_date,
            res.last_air_date
          ),
          videos: [],
          links: new Array(
            Utils.parseImdbLink(imdbRating, res.external_ids.imdb_id),
            Utils.parseShareLink(res.name, res.external_ids.imdb_id, type),
            ...Utils.parseGenreLink(res.genres, type, language),
            ...Utils.parseCreditsLink(res.credits)
          ),
          trailers: Utils.parseTrailers(res.videos),
          trailerStreams: Utils.parseTrailerStream(res.videos),
          behaviorHints: {
            defaultVideoId: null,
            hasScheduledVideos: true,
          },
        };
        try {
          resp.logo = await getTvLogo(
            fanart,
            res.external_ids.tvdb_id,
            res.id,
            language,
            res.original_language
          );
        } catch (e) {
          console.log(
            `warning: logo could not be retrieved for ${tmdbId} - ${type}`
          );
          console.log((e || {}).message || "unknown error");
        }
        if (resp.logo && blacklistLogoUrls.includes(resp.logo || "")) {
          delete resp.logo;
        }
        if (resp.logo) {
          resp.logo = resp.logo.replace("http://", "https://");
        }
        try {
          resp.videos = await getEpisodes(
            moviedb,
            language,
            tmdbId,
            res.external_ids.imdb_id,
            res.seasons,
            { hideEpisodeThumbnails: config.hideEpisodeThumbnails }
          );
        } catch (e) {
          console.log(
            `warning: episodes could not be retrieved for ${tmdbId} - ${type}`
          );
          console.log((e || {}).message || "unknown error");
        }
        return resp;
      })
      .catch(console.error);
    return Promise.resolve({ meta });
  }
}

module.exports = { getMeta };
