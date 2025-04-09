require("dotenv").config();
const FanartTvApi = require("fanart.tv-api");
const { MovieDb } = require("moviedb-promise");
const querystring = require("querystring");
const FANART_API_KEY = process.env.FANART_API;
const TMDB_API_KEY = process.env.TMDB_API;

const getFanart = () => {
  if (FANART_API_KEY) {
    try {
      const options = {
        baseUrl: "http://webservice.fanart.tv/v3/",
        timeout: 5 * 1000,
      };
      const fanart = new FanartTvApi({ api_key: FANART_API_KEY, options });

      fanart._request = async function ({ uri, qs }, cb) {
        const url = `${options.baseUrl}${uri}?${querystring.stringify(qs)}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          timeout: 5 * 1000,
        });

        if (!response.ok) {
          return cb(
            new Error(
              `Fanart.tv API request failed: ${response.status} ${response.statusText}`
            )
          );
        }

        return cb(null, response, await response.json());
      };

      fanart._get = async function (uri, qs, retry = true) {
        if (this._debug)
          console.warn(
            `Making request to uri: ${uri}, qs: '${querystring.stringify(qs)}'`
          );
        return new Promise((resolve, reject) => {
          return this._request({ uri, qs }, (err, res, body) => {
            if (err && retry) {
              return resolve(this._get(uri, qs, false));
            } else if (err) {
              return reject(err);
            } else if (!body || res.status >= 400) {
              return reject(
                new Error(
                  `No data found for uri: ${uri}, qs: '${querystring.stringify(
                    qs
                  )}', statuscode: ${res.status}`
                )
              );
            } else {
              return resolve(body);
            }
          });
        });
      };

      return fanart;
    } catch (error) {
      console.error("Error initializing FanartTvApi:", error);
    }
  } else {
    console.warn(
      "FANART_API key not found in environment variables. Fanart.tv features might be disabled."
    );
    return null;
  }
};

const getMoviedb = () => {
  if (TMDB_API_KEY) {
    try {
      return new MovieDb(TMDB_API_KEY);
    } catch (error) {
      console.error("Error initializing MovieDb:", error);
    }
  }
  throw new Error(
    "TMDB_API key not found in environment variables. TMDB features are essential and cannot be disabled."
  );
};

module.exports = { getFanart, getMoviedb };
