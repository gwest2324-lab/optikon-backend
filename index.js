import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/analyze-photo", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const imageBase64 = req.file.buffer.toString("base64");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are an expert photography judge. 
Return ONLY JSON in this format:

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

Scores must vary realistically based on the image.
`
        },
        {
          role: "user",
          content: [
            { type: "input_image", url: \`data:image/jpeg;base64,\${imageBase64}\` },
            {
              type: "text",
              text: "Analyze this photo and respond ONLY with JSON. No explanations."
            }
          ]
        }
      ]
    });

    const raw = completion.choices[0].message.content.trim();
    const json = JSON.parse(raw);

    res.json(json);
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: "AI_ANALYSIS_FAILED" });
  }
});

app.listen(3000, () => {
  console.log("OPTIKON backend running on port 3000");
});
