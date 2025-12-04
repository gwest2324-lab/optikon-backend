import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

const app = express();
app.use(cors());

// Use memory storage so we can read the file buffer
const upload = multer({ storage: multer.memoryStorage() });

// OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/analyze-photo", upload.single("image"), async (req, res) => {
  try {
    // 1) Make sure we actually got a file
    if (!req.file) {
      console.error("No file received in request");
      return res.status(400).json({ error: "NO_IMAGE_UPLOADED" });
    }

    // 2) Convert buffer -> base64
    const imageBase64 = req.file.buffer.toString("base64");

    // 3) Call OpenAI with image_url format
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are an expert photography judge.

You MUST return ONLY valid JSON and nothing else.
Use a 0–100 scoring scale (NOT 0–10):

- 0–39 = very weak
- 40–59 = needs work
- 60–74 = decent
- 75–89 = strong
- 90–100 = exceptional / portfolio-level

Format:

{
  "overallScore": number,
  "scores": {
    "composition": number,
    "lighting": number,
    "color": number,
    "sharpness": number,
    "creativity": number,
    "subjectClarity": number
  },
  "summary": string,
  "improvements": [string, string, string]
}
          `,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
            {
              type: "text",
              text: "Analyze this photo realistically and respond ONLY with JSON in the specified format.",
            },
          ],
        },
      ],
    });

    // 4) Safely extract text content from the response
    const messageContent = completion.choices[0].message.content;

    let raw;
    if (Array.isArray(messageContent)) {
      // Some SDK responses are structured as an array of parts
      raw = messageContent
        .map((part) => ("text" in part ? part.text : ""))
        .join("")
        .trim();
    } else {
      raw = (messageContent || "").trim();
    }

    console.log("RAW AI RESPONSE:", raw);

    let json = JSON.parse(raw);

    // --- Normalize scores to 0–100 scale --- //
    function normalizeScore(score) {
      if (score == null || isNaN(score)) return 0;

      const n = Number(score);

      // If it looks like a 0–1 score, scale to 0–100
      if (n > 0 && n <= 1) return Math.round(n * 100);

      // If it looks like a 0–10 score, scale to 0–100
      if (n > 1 && n <= 10) return Math.round(n * 10);

      // Already 0–100, just clamp
      if (n < 0) return 0;
      if (n > 100) return 100;
      return Math.round(n);
    }

    // Normalize overall
    json.overallScore = normalizeScore(json.overallScore);

    // Normalize each sub-score
    if (json.scores) {
      Object.keys(json.scores).forEach((key) => {
        json.scores[key] = normalizeScore(json.scores[key]);
      });
    }

    return res.json(json);
  } catch (err) {
    console.error("AI ERROR:", err);
    return res.status(500).json({ error: "AI_ANALYSIS_FAILED" });
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`OPTIKON backend running on port ${port}`);
});
