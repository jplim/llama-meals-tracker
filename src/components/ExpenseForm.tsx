import React, { useState, useRef } from "react";
import { Friend, Expense, MealItem } from "../types";
import { 
  Camera, 
  Upload, 
  Plus, 
  Minus, 
  Trash2, 
  Sparkles, 
  Loader2, 
  Flame, 
  PlusCircle, 
  DollarSign, 
  AlertCircle,
  FileText,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ExpenseFormProps {
  friends: Friend[];
  onAddExpense: (expense: Omit<Expense, "id">) => void;
  onCancel: () => void;
  preselectedPayer?: Friend;
  editingExpense?: Expense;
  onUpdateExpense?: (expense: Expense) => void;
  token?: string | null;
  trackerId?: string | null;
}

export default function ExpenseForm({ friends, onAddExpense, onCancel, preselectedPayer, editingExpense, onUpdateExpense, token, trackerId }: ExpenseFormProps) {
  // Main form states
  const [title, setTitle] = useState(editingExpense?.title || "");
  const [date, setDate] = useState(editingExpense?.date || new Date().toISOString().split("T")[0]);
  const [paidById, setPaidById] = useState(editingExpense?.paidById || preselectedPayer?.id || friends[0]?.id || "");
  const [amount, setAmount] = useState<number | "">(editingExpense ? editingExpense.amount : "");
  const [participants, setParticipants] = useState<string[]>(editingExpense?.participants || friends.map((f) => f.id));
  const [items, setItems] = useState<MealItem[]>(editingExpense?.items || []);
  const [notes, setNotes] = useState(editingExpense?.notes || "");
  const [receiptImage, setReceiptImage] = useState<string | undefined>(editingExpense?.receiptImage);

  // Scanning & AI status states
  const [isScanning, setIsScanning] = useState(false);
  const [aiAnalysisMethod, setAiAnalysisMethod] = useState<"upload" | "text" | null>(null);
  const [promptText, setPromptText] = useState("");
  const [scanError, setScanError] = useState("");
  const [manualError, setManualError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Handle setting participants
  const toggleParticipant = (friendId: string) => {
    if (participants.includes(friendId)) {
      setParticipants(participants.filter((id) => id !== friendId));
    } else {
      setParticipants([...participants, friendId]);
    }
  };

  const selectAllParticipants = () => {
    setParticipants(friends.map((f) => f.id));
  };

  const selectNoneParticipants = () => {
    setParticipants([]);
  };

  // Handle raw item updates
  const handleAddItem = () => {
    const newItem: MealItem = {
      id: crypto.randomUUID(),
      name: "",
      price: 0,
      estimatedCalories: 0,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (itemId: string) => {
    const updatedItems = items.filter((item) => item.id !== itemId);
    setItems(updatedItems);
    // Recalculate billing amount if items have values
    const newTotal = updatedItems.reduce((sum, item) => sum + (item.price || 0), 0);
    if (newTotal > 0) {
      setAmount(Number(newTotal.toFixed(2)));
    }
  };

  const handleUpdateItem = (itemId: string, field: keyof MealItem, value: any) => {
    const updated = items.map((item) => {
      if (item.id === itemId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setItems(updated);

    // If updating prices, optionally auto-adjust total amount
    if (field === "price") {
      const newTotal = updated.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
      setAmount(Number(newTotal.toFixed(2)));
    }
  };

  // Convert File to base64
  const handleFileChange = (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setScanError("Please select a valid receipt image (PNG, JPEG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      setReceiptImage(base64String);
      scanReceiptImage(base64String, file.type);
    };
    reader.onerror = () => {
      setScanError("Failed to read sample image file.");
    };
    reader.readAsDataURL(file);
  };

  // Dragon-drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Hit the server Gemini API endpoint for Intelligent Receipt Parsing
  const scanReceiptImage = async (base64Data: string, mimeType: string) => {
    setIsScanning(true);
    setScanError("");
    setAiAnalysisMethod("upload");

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (trackerId) headers["x-tracker-id"] = trackerId;

      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        headers,
        body: JSON.stringify({ image: base64Data, mimeType }),
      });

      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error || "Failed to analyze receipt. The Gemini server returned an error.");
      }

      applyAiResult(body.data);
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || "Could not complete image analysis. Please set GEMINI_API_KEY in secrets.");
    } finally {
      setIsScanning(false);
    }
  };

  // Parse text description (e.g. "We got 2 burgers for 12 dollars each, plus a 4 dollar diet coke")
  const scanReceiptText = async () => {
    if (!promptText.trim()) {
      setScanError("Please type a meal description to scan.");
      return;
    }

    setIsScanning(true);
    setScanError("");
    setAiAnalysisMethod("text");

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (trackerId) headers["x-tracker-id"] = trackerId;

      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: promptText }),
      });

      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error || "Failed to estimate calorie layout from prompt text.");
      }

      applyAiResult(body.data);
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || "Failed to analyze meal text. Please try again or fill manually.");
    } finally {
      setIsScanning(false);
    }
  };

  // Map AI results into frontend states
  const applyAiResult = (data: any) => {
    if (data.title) setTitle(data.title);
    if (data.amount) setAmount(Number(data.amount.toFixed(2)));
    
    // Parse and validate date: only update if captured date is valid
    if (data.date && typeof data.date === "string") {
      let cleanDate = data.date.trim().replace(/\//g, "-");
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
        setDate(cleanDate);
      }
    }

    if (data.items && Array.isArray(data.items)) {
      setItems(
        data.items.map((it: any) => ({
          id: crypto.randomUUID(),
          name: it.name || "Dish Item",
          price: typeof it.price === "number" ? it.price : 0,
          estimatedCalories: typeof it.estimatedCalories === "number" ? it.estimatedCalories : 0,
        }))
      );
    }
  };

  // Submit complete transaction
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError("");

    if (!title.trim()) {
      setManualError("Please enter a name or title for this meal.");
      return;
    }

    if (amount === "" || amount <= 0) {
      setManualError("Total bill amount must be greater than 0.");
      return;
    }

    if (!paidById) {
      setManualError("Specify who covered this bill.");
      return;
    }

    if (participants.length === 0) {
      setManualError("Select at least one group member to split the meal cost.");
      return;
    }

    // Calculate sum of calories
    const totalCal = items.reduce((sum, item) => sum + (Number(item.estimatedCalories) || 0), 0);

    const expensePayload = {
      title: title.trim(),
      date,
      paidById,
      amount: Number(amount),
      participants,
      receiptImage,
      items,
      estimatedCalories: totalCal,
      notes: notes.trim() || undefined,
    };

    if (editingExpense && onUpdateExpense) {
      onUpdateExpense({
        ...expensePayload,
        id: editingExpense.id,
      });
    } else {
      onAddExpense(expensePayload);
    }
  };

  // Populate helper templates for fast demonstration testing
  const tryDemoMock = (recipe: string) => {
    setPromptText(recipe);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="bg-white border border-stone-200 rounded-3xl p-6 md:p-8 shadow-md"
      id="expense-form-container"
    >
      <div className="flex items-center justify-between border-b border-stone-100 pb-5 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-stone-900">
            {editingExpense ? "Edit Group Meal" : "Log Group Meal"}
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Instantly capture billing info, auto-split tabs fairly, and estimate calories.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-sm font-semibold text-stone-500 hover:text-stone-800 px-3 py-1.5 rounded-lg hover:bg-stone-50 cursor-pointer"
        >
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Receipt Scanning Options */}
        <div className="lg:col-span-5 space-y-6 lg:border-r lg:border-stone-100 lg:pr-8" id="ai-photo-section">
          <div className="space-y-2">
            <h3 className="text-sm font-bold font-display text-stone-800 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Scan Receipt & Add Calories
            </h3>
            <p className="text-xs text-stone-500">
              Drag-and-drop your receipt image or enter a text description. Gemini AI will automate items parsing, prices matching, and nutrient diagnostics.
            </p>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 relative ${
              isDragOver
                ? "border-amber-500 bg-amber-50/20"
                : "border-stone-200 hover:border-stone-400 bg-stone-50/50"
            }`}
            id="drag-drop-zone"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              className="hidden"
              accept="image/*"
            />

            {receiptImage ? (
              <div className="space-y-3" id="preview-image-state">
                <img
                  src={receiptImage}
                  alt="Receipt Preview"
                  className="max-h-40 mx-auto rounded-xl shadow-sm object-cover"
                />
                <p className="text-xs font-semibold text-stone-600 flex items-center justify-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-stone-400" /> Image uploaded successfully
                </p>
                <span className="text-[10px] text-amber-600 font-medium hover:underline">
                  Click or Drop to replace
                </span>
              </div>
            ) : (
              <div className="space-y-3" id="empty-image-state">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-stone-500">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-700">Drop your receipt photo here</p>
                  <p className="text-[11px] text-stone-400 mt-1">Supports PNG, JPEG, WEBP and mobile crops</p>
                </div>
                <button
                  type="button"
                  className="bg-white hover:bg-stone-100 text-stone-800 border border-stone-200 text-xs font-semibold py-1.5 px-3.5 rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  Browse Files
                </button>
              </div>
            )}
          </div>

          {/* Fast Description input if no photo is available */}
          <div className="space-y-3 pt-2" id="text-desc-section">
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-stone-150" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 font-semibold text-stone-400 uppercase tracking-widest text-[9px]">
                  OR describe the meal
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Example: We ate at Taco Bell, I ordered one Beef Quesarito for RM6.50, and Jane had a Crunchwrap Supreme for RM7.00. Estimating to add up around 1100 total kcal."
                rows={3}
                className="w-full bg-stone-50 text-stone-950 border border-stone-200 rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:border-stone-400 text-xs transition-colors"
              />

              <div className="flex flex-wrap gap-1.5 justify-start">
                <button
                  type="button"
                  onClick={() => tryDemoMock("Starbucks Breakfast: 2 Caffè Lattes (RM4.50 each) and 2 Butter Croissants (RM3.75 each)")}
                  className="text-[10px] border border-stone-200 hover:border-stone-300 rounded-full px-2.5 py-1 text-stone-600 bg-stone-50 cursor-pointer"
                >
                  ☕ Preset: Cafe Breakfast
                </button>
                <button
                  type="button"
                  onClick={() => tryDemoMock("Lunch at Sweetgreen: 2 Harvest Bowls (RM14.25 each) and a Hibiscus Tea (RM3.50)")}
                  className="text-[10px] border border-stone-200 hover:border-stone-300 rounded-full px-2.5 py-1 text-stone-600 bg-stone-50 cursor-pointer"
                >
                  🥗 Preset: Sweetgreen Lunch
                </button>
              </div>

              <button
                type="button"
                onClick={scanReceiptText}
                disabled={isScanning || !promptText.trim()}
                className="w-full bg-stone-100 hover:bg-stone-200 disabled:opacity-50 disabled:hover:bg-stone-100 text-stone-850 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {isScanning && aiAnalysisMethod === "text" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Estimating calories...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-300" />
                    Apply Gemini Estimations
                  </>
                )}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isScanning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-amber-50/50 text-amber-800 p-4 border border-amber-100 rounded-xl text-xs space-y-1.5"
                id="scanning-loading-notification"
              >
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                  <span className="font-semibold">Gemini AI is parsing your dining items...</span>
                </div>
                <p className="text-stone-500">
                  This scans food portions, automatically allocates corresponding nutritional kcal indexes, and sets up transaction components.
                </p>
              </motion.div>
            )}

            {scanError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                id="scan-error-log"
                className="bg-rose-50 border border-rose-100 text-rose-800 rounded-xl p-3 text-xs flex gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <p>{scanError}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Ledger Form Fields */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="space-y-6" id="bill-details-form">
            <h3 className="text-sm font-bold font-display text-stone-800 uppercase tracking-wider">
              Meal Details & Splitting
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
                  Meal Title / Restaurant
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Olive Garden Feast"
                  className="w-full bg-stone-50 text-stone-900 border border-stone-200 rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:border-stone-400 text-sm transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
                  Meal Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-stone-50 text-stone-900 border border-stone-200 rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:border-stone-400 text-sm transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
                  Who paid the bill?
                </label>
                <select
                  id="payer-select"
                  value={paidById}
                  onChange={(e) => setPaidById(e.target.value)}
                  className="w-full bg-stone-50 text-stone-900 border border-stone-200 rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:border-stone-400 text-sm cursor-pointer transition-all"
                  required
                >
                  <option value="" disabled>Select payer...</option>
                  {friends.map((friend) => (
                    <option key={friend.id} value={friend.id}>
                      {friend.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
                  Total Billing Amount (RM)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400 text-sm">
                    RM
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    id="total-amount-input"
                    value={amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAmount(val === "" ? "" : Number(val));
                    }}
                    className="w-full bg-stone-50 text-stone-900 border border-stone-200 rounded-xl pl-10 pr-3 py-2.5 outline-none focus:bg-white focus:border-stone-400 text-sm font-mono transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Friends who shared the meal */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-stone-400" /> Shared splits (who participants in eating)
                </label>
                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={selectAllParticipants}
                    className="text-[10px] uppercase tracking-wider font-extrabold text-stone-500 hover:text-stone-800 transition-colors"
                  >
                    Select All
                  </button>
                  <span className="text-stone-300">/</span>
                  <button
                    type="button"
                    onClick={selectNoneParticipants}
                    className="text-[10px] uppercase tracking-wider font-extrabold text-stone-500 hover:text-stone-800 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2" id="split-participants-pool">
                {friends.map((friend) => {
                  const isChecked = participants.includes(friend.id);
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => toggleParticipant(friend.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer select-none transition-all duration-200 ${
                        isChecked
                          ? "bg-stone-900 text-stone-50 border-stone-900 shadow-sm"
                          : "bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shadow-inner"
                        style={{ backgroundColor: friend.color }}
                      />
                      <span>{friend.name}</span>
                      {isChecked && (
                        <span className="ml-1 text-[10px] bg-stone-800 text-stone-300 px-1.5 py-0.5 rounded-full font-mono">
                          1/n
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {participants.length > 0 && amount !== "" && amount > 0 && (
                <p className="text-[11px] text-stone-500 font-medium">
                  Fair Split Share: <strong className="text-stone-800 font-mono">RM{(Number(amount) / participants.length).toFixed(2)}</strong> each (across {participants.length} people)
                </p>
              )}
            </div>

            {/* Dynamic Items & Calories Checklist */}
            <div className="space-y-3.5 border-t border-stone-100 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold font-display text-stone-800 uppercase tracking-wider">
                    Break Down Dishes & Caloric Estimates
                  </h4>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    Optional but recommended for precise calorie health calculations.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-stone-800 hover:text-stone-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer bg-stone-100 hover:bg-stone-150 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Dish
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-stone-200 bg-stone-50/20 rounded-xl">
                  <p className="text-xs text-stone-400">No dishes mapped to this meal yet.</p>
                  <p className="text-[10px] text-stone-300 mt-0.5">Click "Add Dish" or scan a receipt above to extract automatically.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1" id="items-list-inputs">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2.5 bg-stone-50 border border-stone-150 rounded-xl text-xs"
                    >
                      <input
                        type="text"
                        placeholder="e.g. Caesar Salad"
                        value={item.name}
                        onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                        className="flex-1 bg-white font-medium text-stone-900 border border-stone-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-stone-400"
                        required
                      />

                      <div className="relative w-20">
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-stone-400 text-[10px]">
                          RM
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={item.price ?? ""}
                          onChange={(e) => handleUpdateItem(item.id, "price", e.target.value === "" ? 0 : Number(e.target.value))}
                          className="w-full bg-white font-mono text-stone-900 border border-stone-200 rounded-lg pl-7 pr-1.5 py-1.5 outline-none focus:border-stone-400 text-right"
                          required
                        />
                      </div>

                      <div className="relative w-20">
                        <input
                          type="number"
                          placeholder="kcal"
                          value={item.estimatedCalories ?? ""}
                          onChange={(e) => handleUpdateItem(item.id, "estimatedCalories", e.target.value === "" ? 0 : Number(e.target.value))}
                          className="w-full bg-white font-mono text-stone-900 border border-stone-200 rounded-lg pr-7 pl-1.5 py-1.5 outline-none focus:border-stone-400 text-right"
                        />
                        <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-[10px] text-orange-500/80 font-bold pointer-events-none">
                          <Flame className="w-3 h-3" />
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {items.length > 0 && (
                <div className="flex justify-between items-center bg-stone-50 border border-stone-200/60 p-3 rounded-xl text-xs font-mono font-semibold" id="items-sumory">
                  <span className="text-stone-500 uppercase tracking-wider text-[10px]">Total Calories (AI Sum)</span>
                  <span className="text-orange-700 flex items-center gap-1">
                    <Flame className="w-4 h-4 text-orange-500 fill-orange-200" />
                    {items.reduce((sum, item) => sum + (Number(item.estimatedCalories) || 0), 0)} kcal
                  </span>
                </div>
              )}
            </div>

            {/* Optional Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
                Additional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Write any custom details (e.g., Alice left early or split was offset)"
                rows={2}
                className="w-full bg-stone-50 text-stone-950 border border-stone-200 rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:border-stone-400 text-xs transition-colors"
              />
            </div>

            {manualError && (
              <div id="manual-error-log" className="bg-rose-50 border border-rose-100 text-rose-800 rounded-xl p-3 text-xs flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <p>{manualError}</p>
              </div>
            )}

            <div className="pt-4 flex gap-3" id="form-submission-buttons">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold py-3 px-4 rounded-xl text-sm transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>

              <button
                type="submit"
                id="submit-expense-btn"
                className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                {editingExpense ? "Save Changes" : "Save Dining Transaction"}
              </button>
            </div>

          </form>
        </div>

      </div>
    </motion.div>
  );
}
