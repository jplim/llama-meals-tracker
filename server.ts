import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limits for base64 image uploads
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Lazy init the Gemini client so it fails gracefully if key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is not set or is still the placeholder. Please set your credentials in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// ---------------------- API ROUTES ----------------------

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Endpoint to scan receipt or parse text and estimate calories
app.post("/api/scan-receipt", async (req, res) => {
  try {
    const { image, text, mimeType } = req.body;

    if (!image && !text) {
      return res.status(400).json({ error: "Please provide a receipt image or text description to estimate." });
    }

    const ai = getGeminiClient();

    let contents: any[] = [];
    let promptText = "";

    if (image) {
      // Decode image
      let cleanBase64 = image;
      let cleanMimeType = mimeType || "image/jpeg";

      // If prefixed (e.g. data:image/png;base64,xxxx), strip the prefix
      if (image.startsWith("data:")) {
        const matches = image.match(/^data:([^;]+);base64,(.*)$/);
        if (matches && matches.length === 3) {
          cleanMimeType = matches[1];
          cleanBase64 = matches[2];
        }
      }

      contents.push({
        inlineData: {
          mimeType: cleanMimeType,
          data: cleanBase64,
        },
      });

      promptText = "Analyze this receipt image. Extract the business/meal merchant name, the transaction/purchase date (in YYYY-MM-DD format if found, otherwise return empty), find individual food/beverage items with their prices, and estimate the calories (kcal) for each portion. Avoid adding tax, tip, or non-food items (or mark them with 0 calories). Support all items on the receipt.";
    } else {
      promptText = `Estimate a meal from this description: "${text}". Extract the date if one is mentioned (in YYYY-MM-DD format), otherwise return empty. List the items, estimate reasonable prices/costs for them, and calculate the estimated calories (kcal) for each.`;
    }

    contents.push({ text: promptText });

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "A friendly, suggested title for this meal, e.g., 'Chipotle Burrito Lunch', 'Italian Bistro Dinner'.",
        },
        amount: {
          type: Type.NUMBER,
          description: "The total expenditure or billing total, parsed from the receipt or estimated.",
        },
        date: {
          type: Type.STRING,
          description: "The date of the transaction/meal extracted from the receipt, formatted as YYYY-MM-DD. Return an empty string if no date can be found.",
        },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: "Name of the food or drink item, cleaned up for human readability.",
              },
              price: {
                type: Type.NUMBER,
                description: "Cost of this item.",
              },
              estimatedCalories: {
                type: Type.INTEGER,
                description: "Estimated kcal for this item partition. Let it be 0 if it is non-food/tax.",
              }
            },
            required: ["name", "price", "estimatedCalories"]
          }
        },
        estimatedCalories: {
          type: Type.INTEGER,
          description: "Sum of estimated calories for all items in the meal."
        }
      },
      required: ["title", "amount", "items", "estimatedCalories", "date"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: "You are an expert culinary scanner and calorie estimator. Your job is to extract billing details and estimate portion size calorie values based on standard database sizes.",
      }
    });

    const parsedText = response.text || "{}";
    const result = JSON.parse(parsedText);

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Scan receipt API Error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "An unexpected error occurred while analyzing the receipt with Gemini." 
    });
  }
});

// ---------------------- VITE / STATIC ROUTING ----------------------

async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

initServer().catch((err) => {
  console.error("Failed to start server:", err);
});
