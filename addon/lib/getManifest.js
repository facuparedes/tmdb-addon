require("dotenv").config();
const { getGenreList } = require("./getGenreList");
const { getLanguages } = require("./getLanguages");
const packageJson = require("../../package.json");
const catalogsTranslations = require("../static/translations.json");
const CATALOG_TYPES = require("../static/catalog-types.json");
const DEFAULT_LANGUAGE = "en-US";

function generateArrayOfYears(maxYears) {
  const max = new Date().getFullYear();
  const min = max - maxYears;
  const years = [];
  for (let i = max; i >= min; i--) {
    years.push(i.toString());
  }
  return years;
}

function setOrderLanguage(language, languagesArray) {
  const languageObj = languagesArray.find(
    (lang) => lang.iso_639_1 === language
  );
  const fromIndex = languagesArray.indexOf(languageObj);
  const element = languagesArray.splice(fromIndex, 1)[0];
  languagesArray = languagesArray.sort((a, b) => (a.name > b.name ? 1 : -1));
  languagesArray.splice(0, 0, element);
  return [...new Set(languagesArray.map((el) => el.name))];
}

function loadTranslations(language) {
  const defaultTranslations = catalogsTranslations[DEFAULT_LANGUAGE] || {};
  const selectedTranslations = catalogsTranslations[language] || {};

  return { ...defaultTranslations, ...selectedTranslations };
}

function createCatalog(
  id,
  type,
  catalogDef,
  options,
  tmdbPrefix,
  translatedCatalogs,
  showInHome = false
) {
  const extra = [];

  if (catalogDef.extraSupported.includes("genre")) {
    if (catalogDef.defaultOptions) {
      const formattedOptions = catalogDef.defaultOptions.map((option) => {
        if (option.includes(".")) {
          const [field, order] = option.split(".");
          if (translatedCatalogs[field] && translatedCatalogs[order]) {
            return `${translatedCatalogs[field]} (${translatedCatalogs[order]})`;
          }
          return option;
        }
        return translatedCatalogs[option] || option;
      });
      extra.push({
        name: "genre",
        options: formattedOptions,
        isRequired: showInHome ? false : true,
      });
    } else {
      extra.push({
        name: "genre",
        options,
        isRequired: showInHome ? false : true,
      });
    }
  }
  if (catalogDef.extraSupported.includes("search")) {
    extra.push({ name: "search" });
  }
  if (catalogDef.extraSupported.includes("skip")) {
    extra.push({ name: "skip" });
  }

  return {
    id,
    type,
    name: `${tmdbPrefix ? "TMDB - " : ""}${
      translatedCatalogs[catalogDef.nameKey]
    }`,
    pageSize: 20,
    extra,
  };
}

function getCatalogDefinition(catalogId) {
  const [provider, type] = catalogId.split(".");

  for (const category of Object.keys(CATALOG_TYPES)) {
    if (CATALOG_TYPES[category][type]) {
      return CATALOG_TYPES[category][type];
    }
  }

  return null;
}

function getOptionsForCatalog(
  catalogDef,
  type,
  showInHome,
  { years, genres_movie, genres_series, filterLanguages }
) {
  if (catalogDef.defaultOptions) return catalogDef.defaultOptions;

  const movieGenres = showInHome ? [...genres_movie] : ["Top", ...genres_movie];
  const seriesGenres = showInHome
    ? [...genres_series]
    : ["Top", ...genres_series];

  switch (catalogDef.nameKey) {
    case "year":
      return years;
    case "language":
      return filterLanguages;
    case "popular":
      return type === "movie" ? movieGenres : seriesGenres;
    default:
      return type === "movie" ? movieGenres : seriesGenres;
  }
}

async function getManifest(config) {
  const language = config.language || DEFAULT_LANGUAGE;
  const tmdbPrefix = config.tmdbPrefix === "true";
  const provideImdbId = config.provideImdbId === "true";
  const sessionId = config.sessionId;
  const userCatalogs = config.catalogs || getDefaultCatalogs();
  const translatedCatalogs = loadTranslations(language);

  const [genresMovie, genresSeries, languagesArray] = await Promise.all([
    getGenreList(language, "movie"),
    getGenreList(language, "series"),
    getLanguages(),
  ]);

  const years = generateArrayOfYears(20);
  const genres_movie = genresMovie.map((el) => el.name).sort();
  const genres_series = genresSeries.map((el) => el.name).sort();
  const filterLanguages = setOrderLanguage(language, languagesArray);
  const options = { years, genres_movie, genres_series, filterLanguages };

  let catalogs = userCatalogs
    .filter((userCatalog) => {
      const catalogDef = getCatalogDefinition(userCatalog.id);
      if (!catalogDef) return false;
      if (catalogDef.requiresAuth && !sessionId) return false;
      return true;
    })
    .map((userCatalog) => {
      const catalogDef = getCatalogDefinition(userCatalog.id);
      const catalogOptions = getOptionsForCatalog(
        catalogDef,
        userCatalog.type,
        userCatalog.showInHome,
        options
      );

      return createCatalog(
        userCatalog.id,
        userCatalog.type,
        catalogDef,
        catalogOptions,
        tmdbPrefix,
        translatedCatalogs,
        userCatalog.showInHome
      );
    });

  if (config.searchEnabled !== "false") {
    const searchCatalogMovie = {
      id: "tmdb.search",
      type: "movie",
      name: `${tmdbPrefix ? "TMDB - " : ""}${translatedCatalogs.search}`,
      extra: [{ name: "search", isRequired: true, options: [] }],
    };

    const searchCatalogSeries = {
      id: "tmdb.search",
      type: "series",
      name: `${tmdbPrefix ? "TMDB - " : ""}${translatedCatalogs.search}`,
      extra: [{ name: "search", isRequired: true, options: [] }],
    };

    catalogs = [...catalogs, searchCatalogMovie, searchCatalogSeries];
  }

  const descriptionSuffix =
    language && language !== DEFAULT_LANGUAGE
      ? ` with ${language} language.`
      : ".";

  return {
    id: packageJson.name,
    version: packageJson.version,
    favicon: `${process.env.HOST_NAME}/favicon.png`,
    logo: `${process.env.HOST_NAME}/logo.png`,
    background: `${process.env.HOST_NAME}/background.png`,
    name: "The Movie Database Addon",
    description: packageJson.description + descriptionSuffix,
    resources: ["catalog", "meta"],
    types: ["movie", "series"],
    idPrefixes: provideImdbId ? ["tmdb:", "tt"] : ["tmdb:"],
    behaviorHints: {
      configurable: true,
      configurationRequired: false,
    },
    catalogs,
  };
}

function getDefaultCatalogs() {
  const defaultTypes = ["movie", "series"];
  const defaultCatalogs = Object.keys(CATALOG_TYPES.default);

  return defaultCatalogs.flatMap((id) =>
    defaultTypes.map((type) => ({
      id: `tmdb.${id}`,
      type,
      showInHome: true,
    }))
  );
}

module.exports = { getManifest, DEFAULT_LANGUAGE };
