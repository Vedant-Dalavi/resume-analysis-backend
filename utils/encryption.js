require("dotenv").config();
const CryptoJS = require("crypto-js");


const encrypt = (text) => CryptoJS.AES.encrypt(text, process.env.ENCRYPTION_SECRET).toString();
const decrypt = (ciphertext) => CryptoJS.AES.decrypt(ciphertext, process.env.ENCRYPTION_SECRET).toString(CryptoJS.enc.Utf8);

module.exports = { encrypt, decrypt };
