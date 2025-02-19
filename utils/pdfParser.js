const axios = require("axios");
const pdfParse = require("pdf-parse");

const parsePDF = async (url) => {
    try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        const text = await pdfParse(response.data);

        if (!text) {
            return res.status(500).json({
                message: "No text in the pdf"
            })
        }

        return text.text;
    } catch (err) {
        throw new Error("Error parsing PDF");
    }
};

module.exports = parsePDF;
