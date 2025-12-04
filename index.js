import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

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

Return ONLY valid JSON in this exact format:

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

Do not include any extra text before or after the JSON.
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
              text: "Analyze this photo realistically and respond ONLY with JSON.",
            },
          ],
        },
      ],
    });

    // 4) Safely extract text content from the response
    const messageContent = completion.choices[0].message.content;

    let raw;
    if (Array.isArray(messageContent)) {
      // some SDK responses are structured as an array of parts
      raw = messageContent
        .map((part) => ("text" in part ? part.text : ""))
        .join("")
        .trim();
    } else {
      raw = (messageContent || "").trim();
    }

    console.log("RAW AI RESPONSE:", raw);

    const json = JSON.parse(raw);
    return res.json(json);
  } catch (err) {
    console.error("AI ERROR:", err);
    return res.status(500).json({ error: "AI_ANALYSIS_FAILED" });
  }
});

// 5) Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`OPTIKON backend running on port ${port}`);
});
