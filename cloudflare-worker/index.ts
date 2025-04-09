import { getFanart, getMoviedb } from "../addon/lib/apiClients";
import { cacheWrapMeta } from "../addon/lib/getCache";
import { getCatalog } from "../addon/lib/getCatalog";
import { DEFAULT_LANGUAGE, getManifest } from "../addon/lib/getManifest";
import { getMeta } from "../addon/lib/getMeta";
import { getFavorites, getWatchList } from "../addon/lib/getPersonalLists";
import { getSearch } from "../addon/lib/getSearch";
import { getRequestToken, getSessionId } from "../addon/lib/getSession";
import { getTmdb } from "../addon/lib/getTmdb";
import { getTrending } from "../addon/lib/getTrending";
import { blurImage } from "../addon/utils/imageProcessor";
import {
  checkIfExists,
  getRpdbPoster,
  parseConfig,
} from "../addon/utils/parseProps";
import { match } from "path-to-regexp";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
};

async function createJsonResponse(data: any): Promise<Response> {
  if (data instanceof Promise) {
    data = await data;
  }
  return new Response(JSON.stringify(data, null, 4), {
    headers: HEADERS,
  });
}

function createResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: HEADERS,
  });
}

function handleRequest(url, routes) {
  for (let route of routes) {
    const matcher = match(route.path);
    const result = matcher(url);

    if (result) {
      return route.handler(result.params);
    }
  }

  return createResponse("Not found", 404);
}

export default {
  async fetch(request, env, ctx) {
    const moviedb = getMoviedb();
    const fanart = getFanart();
    const url = new URL(decodeURIComponent(request.url));
    const components = url.pathname.split("/").splice(1);

    if (request.method === "OPTIONS") {
      return createResponse("", 200);
    }

    return handleRequest(url.pathname, [
      // {
      //   path: "/favicon.ico",
      //   handler: () => {
      //     return env.ASSETS.fetch(request);
      //   },
      // },
      // {
      //   path: "/assets/*paths",
      //   handler: () => {
      //     return env.ASSETS.fetch(request);
      //   },
      // },
      {
        path: "{*anypath}/configure",
        handler: () => {
          return env.ASSETS.fetch(request);
        },
      },
      {
        path: "/",
        handler: () => {
          return Response.redirect(url.origin + "/configure", 301);
        },
      },
      {
        path: "{/:config}/manifest.json",
        handler: ({ config }) => {
          if (!config) return createJsonResponse(getManifest(moviedb));
          const parsedConfig = parseConfig(config);
          return createJsonResponse(getManifest(moviedb, parsedConfig));
        },
      },
      {
        path: "/request_token",
        handler: () => {
          return createJsonResponse(getRequestToken());
        },
      },
      {
        path: "/session_id",
        handler: () => {
          return createJsonResponse(
            getSessionId(url.searchParams.get("request_token"))
          );
        },
      },
      {
        path: "/stats",
        handler: () => {
          return createJsonResponse({ uniqueUserCount: 0 });
        },
      },
      {
        path: "{/:config}/catalog/:type/:id{/:extra}.json",
        handler: async ({ config, type, id, extra }) => {
          const parsedConfig = parseConfig(config);
          const language = parsedConfig.language || DEFAULT_LANGUAGE;
          const rpdbkey = parsedConfig.rpdbkey;
          const sessionId = parsedConfig.sessionId;
          const { genre, skip, search } = extra
            ? Object.fromEntries(new URLSearchParams(extra).entries())
            : {};
          const page = Math.ceil(skip ? Number(skip) / 20 + 1 : 1) || 1;
          let metas: any = [];

          try {
            const args = [type, language, page];

            if (search) {
              metas = await getSearch(
                moviedb,
                type,
                language,
                search,
                parsedConfig
              );
            } else {
              switch (id) {
                case "tmdb.trending":
                  metas = await getTrending(moviedb, ...args, genre);
                  break;
                case "tmdb.favorites":
                  metas = await getFavorites(
                    moviedb,
                    ...args,
                    genre,
                    sessionId
                  );
                  break;
                case "tmdb.watchlist":
                  metas = await getWatchList(
                    moviedb,
                    ...args,
                    genre,
                    sessionId
                  );
                  break;
                default:
                  metas = await getCatalog(
                    moviedb,
                    ...args,
                    id,
                    genre,
                    parsedConfig
                  );
                  break;
              }
            }

            if (rpdbkey) {
              metas = JSON.parse(JSON.stringify(metas));
              metas.metas = await Promise.all(
                metas.metas.map(async (el) => {
                  const rpdbImage = getRpdbPoster(
                    type,
                    el.id.replace("tmdb:", ""),
                    language,
                    rpdbkey
                  );
                  el.poster = (await checkIfExists(rpdbImage))
                    ? rpdbImage
                    : el.poster;
                  return el;
                })
              );
            }

            return createJsonResponse(metas);
          } catch (e) {
            return createResponse((e || {}).message || "Not found", 404);
          }
        },
      },
      {
        path: "{/:config}/meta/:type/:id.json",
        handler: async ({ config, type, id }) => {
          const parsedConfig = parseConfig(config);
          const tmdbId = id.split(":")[1];
          const language = parsedConfig.language || DEFAULT_LANGUAGE;
          const rpdbkey = parsedConfig.rpdbkey;
          const imdbId = id.split(":")[0];

          if (id.includes("tmdb:")) {
            const resp = await cacheWrapMeta(
              `${language}:${type}:${tmdbId}`,
              async () => {
                const metas = await getMeta(
                  moviedb,
                  fanart,
                  type,
                  language,
                  tmdbId,
                  rpdbkey,
                  {
                    hideEpisodeThumbnails:
                      parsedConfig.hideEpisodeThumbnails === "true",
                  }
                );
                return metas;
              }
            );
            return createJsonResponse(resp);
          }

          if (request.params.id.includes("tt")) {
            const tmdbId = await getTmdb(moviedb, type, imdbId);
            if (tmdbId) {
              const resp = await cacheWrapMeta(
                `${language}:${type}:${tmdbId}`,
                async () => {
                  return await getMeta(
                    moviedb,
                    fanart,
                    type,
                    language,
                    tmdbId,
                    rpdbkey,
                    {
                      hideEpisodeThumbnails:
                        parsedConfig.hideEpisodeThumbnails === "true",
                    }
                  );
                }
              );
              return createJsonResponse(resp);
            }
          }

          return createJsonResponse({ meta: {} });
        },
      },
      {
        path: "/api/image/blur",
        handler: async () => {
          const imageUrl = url.searchParams.get("url");

          if (!imageUrl) {
            return createResponse("Image URL not provided", 400);
          }

          try {
            const blurredImageBuffer = await blurImage(imageUrl);

            if (!blurredImageBuffer) {
              return createResponse("Error processing image", 500);
            }

            return new Response(blurredImageBuffer, {
              headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "public, max-age=31536000",
              },
            });
          } catch (error) {
            return createResponse("Error processing image", 500);
          }
        },
      },
      {
        path: "/*anypath",
        handler: () => {
          return env.ASSETS.fetch(request);
        },
      },
    ]);
  },
};
