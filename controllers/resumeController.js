const pdfParse = require('pdf-parse');
const axios = require('axios');
const mongoose = require('mongoose');
const Applicant = require('../models/Applicant');
const parsePDF = require('../utils/pdfParser');
const { encrypt, decrypt } = require('../utils/encryption');

require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.extractResumeData = async (req, res) => {
    const { url } = req.body;

    try {
        const text = await parsePDF(url);


        if (!text) {
            return res.status(500).json({ error: 'No text found in the PDF' });
        }

        // LLM Prompt
        const prompt = `Extract the following information from the resume text:
            - Name
            - Email 
            - Education (degree, branch, institution, year) If degree is missing, return null.
            - Experience (job_title, company, start_date, end_date) - list top 1-2 entries only.
            - Skills 
            - Summary

            Format the data into a JSON object as follows. Do not include any additional text or explanations outside of the JSON. Ensure the JSON is valid and can be parsed directly by JSON.parse(). Omit empty values.
            \`\`\`json
            {
              "name": <name>,
              "email": <email>,
              "education": {
                "degree": <degree>,
                "branch": <branch>,
                "institution": <institution>,
                "year": <year>
              },
              "experience": {
                "job_title": <job_title>,
                "company": <company>,
                "start_date": <start_date>,
                "end_date": <end_date>
              },
              "skills": [<skill_1>, <skill_2>, ...],
              "summary": < write a short summary about the candidate profile based on resume data>
            }
            \`\`\`

            Resume Text:
            ${text}`

        // Call Gemini API
        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }]
            }
        );


        let llmResult = geminiResponse.data.candidates[0].content.parts[0].text;

        llmResult = llmResult.replace(/```json\n/g, ''); // Remove ```json\n at the beginning
        llmResult = llmResult.replace(/```/g, '');       // Remove ``` at the end or anywhere else

    

        let parsedData;
        try {
            parsedData = JSON.parse(llmResult);
        } catch (error) {
            console.error("Error parsing LLM response:", error);
            return res.status(500).json({ error: "Failed to parse LLM response" });
        }

        // Encrypt sensitive data
        const encryptedName = encrypt(parsedData.name);
        const encryptedEmail = encrypt(parsedData.email);

        const applicant = new Applicant({
            name: encryptedName,
            email: encryptedEmail,
            education: parsedData.education,
            experience: parsedData.experience,
            skills: parsedData.skills,
            summary: parsedData.summary
        });

        await applicant.save();

        res.status(200).json({ message: 'Resume data extracted and saved.' });

    } catch (error) {
        console.error("Error during resume extraction:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.searchResume = async (req, res) => {
    const { name } = req.body;

    try {
        const applicants = await Applicant.find({});

        const filteredApplicants = applicants.map(applicant => {
            const decryptedName = decrypt(applicant.name);
            const decryptedEmail = decrypt(applicant.email);

            if (decryptedName && decryptedEmail) {
                return {
                    ...applicant.toObject(),
                    name: decryptedName,
                    email: decryptedEmail
                };
            } else {
                console.error("Decryption failed for applicant:", applicant._id);
                return null;
            }
        }).filter(applicant => {
            if (!applicant) return false;

            const nameParts = applicant.name.toLowerCase().split(/\s+/);  // Split into words
            const searchTokens = name.toLowerCase().split(/\s+/);        // Split search term into words

            return searchTokens.every(token =>
                nameParts.some(namePart => namePart.startsWith(token))
            );
        });


        if (filteredApplicants.length === 0) {
            return res.status(404).json({ message: 'No resumes found with that name.' });
        }

        res.status(200).json(filteredApplicants);

    } catch (error) {
        console.error("Error during resume search:", error);
        res.status(500).json({ error: error.message });
    }
};

