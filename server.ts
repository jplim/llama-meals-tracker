import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { getDb } from "./db";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

const app = express();
const PORT = 3000;

// JWT & Google Identity Auth configurations
const JWT_SECRET = process.env.JWT_SECRET || "meals-tracker-jwt-secret-987654";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Extend Express Request for type-safety
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        picture?: string;
      };
    }
  }
}

// Authentication Token Validator Middleware
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired session token" });
    }
    req.user = user;
    next();
  });
}

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

async function seedTracker(db: any, trackerId: string) {
  const friendsCount = await db.get("SELECT COUNT(*) as count FROM friends WHERE trackerId = ?", [trackerId]);
  const expensesCount = await db.get("SELECT COUNT(*) as count FROM expenses WHERE trackerId = ?", [trackerId]);
  if (friendsCount.count === 0 && expensesCount.count === 0) {
    for (const f of SEED_FRIENDS) {
      await db.run(
        "INSERT INTO friends (id, trackerId, name, color) VALUES (?, ?, ?, ?)",
        [f.id, trackerId, f.name, f.color]
      );
    }
    for (const e of getSeedExpenses()) {
      await db.run(
        "INSERT INTO expenses (id, trackerId, title, date, paidById, amount, estimatedCalories, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [e.id, trackerId, e.title, e.date, e.paidById, e.amount, e.estimatedCalories, e.notes]
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
  }
}

// Scoped Tracker verification
async function ensureTracker(db: any, trackerId: string, userId: string, userName: string) {
  const tracker = await db.get("SELECT * FROM trackers WHERE id = ?", [trackerId]);
  if (!tracker) {
    if (trackerId === userId || trackerId === `${userId}-default`) {
      await db.run(
        "INSERT INTO trackers (id, name, ownerId) VALUES (?, ?, ?)",
        [trackerId, `${userName}'s Tracker`, userId]
      );
      await seedTracker(db, trackerId);
    } else {
      throw new Error("Tracker not found. Check shared ID.");
    }
  }
}

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

// Seed data constants moved to top for scoping/hoisting

// Friends API Endpoints
app.get("/api/friends", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const trackerId = (req.headers["x-tracker-id"] as string) || `${userId}-default`;
    const db = await getDb();
    
    await ensureTracker(db, trackerId, userId, req.user!.name);
    
    const friends = await db.all("SELECT * FROM friends WHERE trackerId = ?", [trackerId]);
    res.json(friends);
  } catch (err: any) {
    console.error("GET /api/friends error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch friends" });
  }
});

app.post("/api/friends", authenticateToken, async (req, res) => {
  try {
    const { id, name, color } = req.body;
    const userId = req.user!.id;
    const trackerId = (req.headers["x-tracker-id"] as string) || `${userId}-default`;
    const db = await getDb();
    
    await ensureTracker(db, trackerId, userId, req.user!.name);
    
    await db.run(
      "INSERT INTO friends (id, trackerId, name, color) VALUES (?, ?, ?, ?)",
      [id, trackerId, name, color]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/friends error:", err);
    res.status(500).json({ error: err.message || "Failed to add friend" });
  }
});

app.delete("/api/friends/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const trackerId = (req.headers["x-tracker-id"] as string) || `${userId}-default`;
    const db = await getDb();
    
    await ensureTracker(db, trackerId, userId, req.user!.name);
    
    await db.run("DELETE FROM friends WHERE id = ? AND trackerId = ?", [id, trackerId]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/friends error:", err);
    res.status(500).json({ error: err.message || "Failed to delete friend" });
  }
});

// Expenses API Endpoints
app.get("/api/expenses", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const trackerId = (req.headers["x-tracker-id"] as string) || `${userId}-default`;
    const db = await getDb();
    
    await ensureTracker(db, trackerId, userId, req.user!.name);
    
    const expensesRaw = await db.all("SELECT * FROM expenses WHERE trackerId = ? ORDER BY date DESC", [trackerId]);
    const participantsRaw = await db.all(
      "SELECT ep.* FROM expense_participants ep JOIN expenses e ON ep.expenseId = e.id WHERE e.trackerId = ?",
      [trackerId]
    );
    const itemsRaw = await db.all(
      "SELECT ei.* FROM expense_items ei JOIN expenses e ON ei.expenseId = e.id WHERE e.trackerId = ?",
      [trackerId]
    );

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

app.post("/api/expenses", authenticateToken, async (req, res) => {
  try {
    const { id, title, date, paidById, amount, participants, receiptImage, items, estimatedCalories, notes } = req.body;
    const userId = req.user!.id;
    const trackerId = (req.headers["x-tracker-id"] as string) || `${userId}-default`;
    const db = await getDb();
    
    await ensureTracker(db, trackerId, userId, req.user!.name);
    
    await db.run("BEGIN TRANSACTION");
    try {
      await db.run(
        "INSERT INTO expenses (id, trackerId, title, date, paidById, amount, estimatedCalories, notes, receiptImage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, trackerId, title, date, paidById, amount, estimatedCalories, notes || null, receiptImage || null]
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

app.put("/api/expenses/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, paidById, amount, participants, receiptImage, items, estimatedCalories, notes } = req.body;
    const userId = req.user!.id;
    const trackerId = (req.headers["x-tracker-id"] as string) || `${userId}-default`;
    const db = await getDb();

    await ensureTracker(db, trackerId, userId, req.user!.name);

    await db.run("BEGIN TRANSACTION");
    try {
      const existing = await db.get("SELECT id FROM expenses WHERE id = ? AND trackerId = ?", [id, trackerId]);
      if (!existing) {
        throw new Error("Expense record not found in this tracker");
      }

      await db.run(
        "UPDATE expenses SET title = ?, date = ?, paidById = ?, amount = ?, estimatedCalories = ?, notes = ?, receiptImage = ? WHERE id = ? AND trackerId = ?",
        [title, date, paidById, amount, estimatedCalories, notes || null, receiptImage || null, id, trackerId]
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

app.delete("/api/expenses/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const trackerId = (req.headers["x-tracker-id"] as string) || `${userId}-default`;
    const db = await getDb();
    
    await ensureTracker(db, trackerId, userId, req.user!.name);
    
    await db.run("DELETE FROM expenses WHERE id = ? AND trackerId = ?", [id, trackerId]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/expenses error:", err);
    res.status(500).json({ error: err.message || "Failed to delete expense" });
  }
});

// Database reset/restore seed APIs
app.post("/api/db/reset", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const trackerId = (req.headers["x-tracker-id"] as string) || `${userId}-default`;
    const db = await getDb();
    
    await ensureTracker(db, trackerId, userId, req.user!.name);

    await db.run("BEGIN TRANSACTION");
    try {
      await db.run("DELETE FROM friends WHERE trackerId = ?", [trackerId]);
      await db.run("DELETE FROM expenses WHERE trackerId = ?", [trackerId]);
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


// Authentication Routes

// Config Endpoint to send GOOGLE_CLIENT_ID to the UI
app.get("/api/config", (req, res) => {
  res.json({
    googleClientId: GOOGLE_CLIENT_ID || null,
  });
});

// Google Sign-In verification endpoint
app.post("/api/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: "Missing credential token" });
    }

    let payload: any;

    if (GOOGLE_CLIENT_ID && googleClient) {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else {
      console.warn("GOOGLE_CLIENT_ID is not configured. Falling back to Mock Verification.");
      payload = jwt.decode(credential);
    }

    if (!payload || !payload.sub || !payload.email) {
      return res.status(400).json({ error: "Invalid Google credential payload" });
    }

    const db = await getDb();
    
    const existingUser = await db.get("SELECT * FROM users WHERE id = ?", [payload.sub]);
    if (!existingUser) {
      await db.run(
        "INSERT INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)",
        [payload.sub, payload.email, payload.name || "Google User", payload.picture || null]
      );
    } else {
      await db.run(
        "UPDATE users SET name = ?, picture = ? WHERE id = ?",
        [payload.name || existingUser.name, payload.picture || existingUser.picture, payload.sub]
      );
    }

    const defaultTrackerId = `${payload.sub}-default`;
    await ensureTracker(db, defaultTrackerId, payload.sub, payload.name || "Google User");

    const token = jwt.sign(
      {
        id: payload.sub,
        email: payload.email,
        name: payload.name || "Google User",
        picture: payload.picture || "",
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name || "Google User",
        picture: payload.picture || "",
      },
      defaultTrackerId,
    });
  } catch (err: any) {
    console.error("Google Auth error:", err);
    res.status(500).json({ error: err.message || "Failed to authenticate with Google" });
  }
});

// Developer Mock Bypass login endpoint
app.post("/api/auth/mock", async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: "Email and Name are required for Mock login" });
    }

    const mockId = `mock-user-${Buffer.from(email).toString("hex").slice(0, 12)}`;
    const db = await getDb();
    
    const existingUser = await db.get("SELECT * FROM users WHERE id = ?", [mockId]);
    if (!existingUser) {
      await db.run(
        "INSERT INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)",
        [mockId, email, name, `https://api.dicebear.com/7.x/initials/svg?seed=${name}`]
      );
    }

    const defaultTrackerId = `${mockId}-default`;
    await ensureTracker(db, defaultTrackerId, mockId, name);

    const token = jwt.sign(
      {
        id: mockId,
        email,
        name,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: mockId,
        email,
        name,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
      },
      defaultTrackerId,
    });
  } catch (err: any) {
    console.error("Mock Auth error:", err);
    res.status(500).json({ error: err.message || "Failed to authenticate in Mock Mode" });
  }
});

// Endpoint to fetch tracker details
app.get("/api/trackers/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const tracker = await db.get(
      "SELECT t.id, t.name, t.ownerId, u.name as ownerName FROM trackers t JOIN users u ON t.ownerId = u.id WHERE t.id = ?",
      [id]
    );
    if (!tracker) {
      return res.status(404).json({ error: "Tracker not found" });
    }
    res.json(tracker);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

  // Note: Seeding is now handled per-tracker dynamically upon user registration/default tracker creation.

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
