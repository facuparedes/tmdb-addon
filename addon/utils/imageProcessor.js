const axios = require("axios");

async function blurImage(imageUrl) {
  try {
    // Use weserv.nl to apply blur effect to the image
    // The 'blur' parameter accepts values from 0 to 100
    // Future alternative: https://silvia-odwyer.github.io/photon/
    const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(
      imageUrl
    )}&blur=20&output=webp`;

    const response = await axios.get(weservUrl, {
      responseType: "arraybuffer",
    });

    return response.data;
  } catch (error) {
    console.error("Erro ao processar imagem:", error);
    return null;
  }
}

module.exports = { blurImage };
