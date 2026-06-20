import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { getDb } from "./db";

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

// Seed data constants
const SEED_FRIENDS = [
  { id: "1", name: "Alice Miller", color: "#F97316" }, // Orange
  { id: "2", name: "Bob Harris", color: "#10B981" },   // Basil Green
  { id: "3", name: "Charlotte Du", color: "#8B5CF6" }, // Grape Violet
];

const getSeedExpenses = () => [
  {
    id: "e1",
    title: "Artisanal Ramen Lunch",
    date: new Date(Date.now() - 48 * 3600000).toISOString().split("T")[0],
    paidById: "1", // Alice paid
    amount: 54.50,
    participants: ["1", "2", "3"], // All three shared
    items: [
      { id: "item1", name: "Tonkotsu Ramen", price: 16.50, estimatedCalories: 850 },
      { id: "item2", name: "Shoyu Ramen", price: 15.50, estimatedCalories: 720 },
      { id: "item3", name: "Spicy Miso Ramen", price: 17.50, estimatedCalories: 950 },
      { id: "item4", name: "Green Tea ice cream", price: 5.00, estimatedCalories: 240 }
    ],
    estimatedCalories: 2760,
    notes: "Delicious noodles! Alice covered for everyone."
  },
  {
    id: "e2",
    title: "Morning Bistro Espresso",
    date: new Date(Date.now() - 24 * 3600000).toISOString().split("T")[0],
    paidById: "2", // Bob paid
    amount: 18.25,
    participants: ["1", "2"], // Alice and Bob
    items: [
      { id: "item5", name: "Flat White Coffee", price: 4.75, estimatedCalories: 120 },
      { id: "item6", name: "Capuccino", price: 4.50, estimatedCalories: 140 },
      { id: "item7", name: "Almond Croissants (x2)", price: 9.00, estimatedCalories: 720 }
    ],
    estimatedCalories: 980,
    notes: "Quick coffee sync. Charlotte wasn't there."
  }
];

// Friends API Endpoints
app.get("/api/friends", async (req, res) => {
  try {
    const db = await getDb();
    const friends = await db.all("SELECT * FROM friends");
    res.json(friends);
  } catch (err: any) {
    console.error("GET /api/friends error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch friends" });
  }
});

app.post("/api/friends", async (req, res) => {
  try {
    const { id, name, color } = req.body;
    const db = await getDb();
    await db.run("INSERT INTO friends (id, name, color) VALUES (?, ?, ?)", [id, name, color]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/friends error:", err);
    res.status(500).json({ error: err.message || "Failed to add friend" });
  }
});

app.delete("/api/friends/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    await db.run("DELETE FROM friends WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/friends error:", err);
    res.status(500).json({ error: err.message || "Failed to delete friend" });
  }
});

// Expenses API Endpoints
app.get("/api/expenses", async (req, res) => {
  try {
    const db = await getDb();
    const expensesRaw = await db.all("SELECT * FROM expenses ORDER BY date DESC");
    const participantsRaw = await db.all("SELECT * FROM expense_participants");
    const itemsRaw = await db.all("SELECT * FROM expense_items");

    const participantsMap: Record<string, string[]> = {};
    participantsRaw.forEach((row: any) => {
      if (!participantsMap[row.expenseId]) participantsMap[row.expenseId] = [];
      participantsMap[row.expenseId].push(row.friendId);
    });

    const itemsMap: Record<string, any[]> = {};
    itemsRaw.forEach((row: any) => {
      if (!itemsMap[row.expenseId]) itemsMap[row.expenseId] = [];
      itemsMap[row.expenseId].push({
        id: row.id,
        name: row.name,
        price: row.price,
        estimatedCalories: row.estimatedCalories,
      });
    });

    const expenses = expensesRaw.map((row: any) => ({
      id: row.id,
      title: row.title,
      date: row.date,
      paidById: row.paidById,
      amount: row.amount,
      receiptImage: row.receiptImage || undefined,
      notes: row.notes || undefined,
      estimatedCalories: row.estimatedCalories,
      participants: participantsMap[row.id] || [],
      items: itemsMap[row.id] || [],
    }));

    res.json(expenses);
  } catch (err: any) {
    console.error("GET /api/expenses error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch expenses" });
  }
});

app.post("/api/expenses", async (req, res) => {
  try {
    const { id, title, date, paidById, amount, participants, receiptImage, items, estimatedCalories, notes } = req.body;
    const db = await getDb();
    
    await db.run("BEGIN TRANSACTION");
    try {
      await db.run(
        "INSERT INTO expenses (id, title, date, paidById, amount, estimatedCalories, notes, receiptImage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, title, date, paidById, amount, estimatedCalories, notes || null, receiptImage || null]
      );
      
      for (const friendId of participants) {
        await db.run(
          "INSERT INTO expense_participants (expenseId, friendId) VALUES (?, ?)",
          [id, friendId]
        );
      }
      
      for (const item of items) {
        await db.run(
          "INSERT INTO expense_items (id, expenseId, name, price, estimatedCalories) VALUES (?, ?, ?, ?, ?)",
          [item.id, id, item.name, item.price, item.estimatedCalories]
        );
      }
      
      await db.run("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await db.run("ROLLBACK");
      throw err;
    }
  } catch (err: any) {
    console.error("POST /api/expenses error:", err);
    res.status(500).json({ error: err.message || "Failed to log expense" });
  }
});

app.put("/api/expenses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, paidById, amount, participants, receiptImage, items, estimatedCalories, notes } = req.body;
    const db = await getDb();

    await db.run("BEGIN TRANSACTION");
    try {
      await db.run(
        "UPDATE expenses SET title = ?, date = ?, paidById = ?, amount = ?, estimatedCalories = ?, notes = ?, receiptImage = ? WHERE id = ?",
        [title, date, paidById, amount, estimatedCalories, notes || null, receiptImage || null, id]
      );
      
      await db.run("DELETE FROM expense_participants WHERE expenseId = ?", [id]);
      for (const friendId of participants) {
        await db.run(
          "INSERT INTO expense_participants (expenseId, friendId) VALUES (?, ?)",
          [id, friendId]
        );
      }
      
      await db.run("DELETE FROM expense_items WHERE expenseId = ?", [id]);
      for (const item of items) {
        await db.run(
          "INSERT INTO expense_items (id, expenseId, name, price, estimatedCalories) VALUES (?, ?, ?, ?, ?)",
          [item.id, id, item.name, item.price, item.estimatedCalories]
        );
      }
      
      await db.run("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await db.run("ROLLBACK");
      throw err;
    }
  } catch (err: any) {
    console.error("PUT /api/expenses error:", err);
    res.status(500).json({ error: err.message || "Failed to update expense" });
  }
});

app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    await db.run("DELETE FROM expenses WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/expenses error:", err);
    res.status(500).json({ error: err.message || "Failed to delete expense" });
  }
});

// Database reset/restore seed APIs
app.post("/api/db/reset", async (req, res) => {
  try {
    const db = await getDb();
    await db.run("BEGIN TRANSACTION");
    try {
      await db.run("DELETE FROM friends");
      await db.run("DELETE FROM expenses");
      await db.run("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await db.run("ROLLBACK");
      throw err;
    }
  } catch (err: any) {
    console.error("POST /api/db/reset error:", err);
    res.status(500).json({ error: err.message || "Failed to reset database" });
  }
});

app.post("/api/db/restore", async (req, res) => {
  try {
    const db = await getDb();
    await db.run("BEGIN TRANSACTION");
    try {
      await db.run("DELETE FROM friends");
      await db.run("DELETE FROM expenses");
      
      for (const f of SEED_FRIENDS) {
        await db.run("INSERT INTO friends (id, name, color) VALUES (?, ?, ?)", [f.id, f.name, f.color]);
      }
      
      for (const e of getSeedExpenses()) {
        await db.run(
          "INSERT INTO expenses (id, title, date, paidById, amount, estimatedCalories, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [e.id, e.title, e.date, e.paidById, e.amount, e.estimatedCalories, e.notes]
        );
        
        for (const pId of e.participants) {
          await db.run("INSERT INTO expense_participants (expenseId, friendId) VALUES (?, ?)", [e.id, pId]);
        }
        
        for (const item of e.items) {
          await db.run(
            "INSERT INTO expense_items (id, expenseId, name, price, estimatedCalories) VALUES (?, ?, ?, ?, ?)",
            [item.id, e.id, item.name, item.price, item.estimatedCalories]
          );
        }
      }
      
      await db.run("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await db.run("ROLLBACK");
      throw err;
    }
  } catch (err: any) {
    console.error("POST /api/db/restore error:", err);
    res.status(500).json({ error: err.message || "Failed to restore database samples" });
  }
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
  // Initialize Database
  console.log("Initializing database...");
  const db = await getDb();

  // Auto-seed if database is empty on first launch
  const friendsCount = await db.get("SELECT COUNT(*) as count FROM friends");
  const expensesCount = await db.get("SELECT COUNT(*) as count FROM expenses");
  if (friendsCount.count === 0 && expensesCount.count === 0) {
    console.log("Database is empty. Auto-seeding initial sample data...");
    await db.run("BEGIN TRANSACTION");
    try {
      for (const f of SEED_FRIENDS) {
        await db.run("INSERT INTO friends (id, name, color) VALUES (?, ?, ?)", [f.id, f.name, f.color]);
      }
      for (const e of getSeedExpenses()) {
        await db.run(
          "INSERT INTO expenses (id, title, date, paidById, amount, estimatedCalories, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [e.id, e.title, e.date, e.paidById, e.amount, e.estimatedCalories, e.notes]
        );
        for (const pId of e.participants) {
          await db.run("INSERT INTO expense_participants (expenseId, friendId) VALUES (?, ?)", [e.id, pId]);
        }
        for (const item of e.items) {
          await db.run(
            "INSERT INTO expense_items (id, expenseId, name, price, estimatedCalories) VALUES (?, ?, ?, ?, ?)",
            [item.id, e.id, item.name, item.price, item.estimatedCalories]
          );
        }
      }
      await db.run("COMMIT");
      console.log("Auto-seeding completed successfully.");
    } catch (err) {
      await db.run("ROLLBACK");
      console.error("Auto-seeding failed:", err);
    }
  }

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
