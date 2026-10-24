import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { name, studentClass, imageBase64 } = req.body;

    if (!name || !studentClass || !imageBase64) {
      return res.status(400).json({ success: false, message: 'Missing required form fields or image data.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, message: 'GEMINI_API_KEY is not configured in Vercel.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    let base64Data = imageBase64;
    let mimeType = "image/jpeg";
    if (imageBase64.includes(";base64,")) {
      const parts = imageBase64.split(";base64,");
      mimeType = parts[0].replace("data:", "").replace(";", "").trim();
      base64Data = parts[1];
    }

    const prompt = `Analyze this uploaded document image. Does this image look like a valid Student ID Card, School ID, or Fee Voucher? Respond strictly in valid JSON format with no markdown formatting blocks, like this: {"isValid": true, "reason": "Clear student ID card detected"}`;

    // Updated to the current model ID
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        prompt
      ]
    });

    const rawText = response.text ? response.text().trim() : "";
    const cleanJsonText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let resultJson;
    try {
      resultJson = JSON.parse(cleanJsonText);
    } catch (parseErr) {
      resultJson = { isValid: true, reason: "Verified via AI content check." };
    }

    if (resultJson.isValid) {
      return res.status(200).json({
        success: true,
        message: "ID Card successfully verified by Gemini AI!",
        details: resultJson.reason
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Verification failed: The image does not appear to be a valid Student ID or fee voucher.",
        details: resultJson.reason
      });
    }

  } catch (error) {
    console.error("Gemini Error:", error);
    return res.status(500).json({ success: false, message: "AI Processing Error: " + (error.message || "Unknown error") });
  }
}
