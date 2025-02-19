const express = require("express");
const { extractResumeData, searchResume } = require("../controllers/resumeController");
const { auth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(auth)

router.post("/extract", extractResumeData);
router.post("/search", searchResume);

module.exports = router;
