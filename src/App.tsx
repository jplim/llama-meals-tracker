import React, { useState, useEffect } from "react";
import { Friend, Expense } from "./types";
import FriendManager from "./components/FriendManager";
import ExpenseForm from "./components/ExpenseForm";
import ExpenseList from "./components/ExpenseList";
import DashboardStats from "./components/DashboardStats";
import { Plus, Users, UtensilsCrossed, Sparkles, BookOpen, Smile, RefreshCw, Layers, Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Beautiful custom initial seed data
const SEED_FRIENDS: Friend[] = [
  { id: "1", name: "Alice Miller", color: "#F97316" }, // Orange
  { id: "2", name: "Bob Harris", color: "#10B981" },   // Basil Green
  { id: "3", name: "Charlotte Du", color: "#8B5CF6" }, // Grape Violet
];

const SEED_EXPENSES: Expense[] = [
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

export default function App() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "friends">("dashboard");
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [preselectedFormPayer, setPreselectedFormPayer] = useState<Friend | undefined>(undefined);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Timeframe filtering states and derivations
  const [filterType, setFilterType] = useState<"all" | "year" | "month">("all");
  const [filterValue, setFilterValue] = useState<string>("");

  const uniqueYears = Array.from(
    new Set(expenses.map((e) => e.date.split("-")[0]).filter(Boolean))
  ).sort().reverse() as string[];

  const uniqueMonths = Array.from(
    new Set(expenses.map((e) => e.date.substring(0, 7)).filter((m) => m && m.length === 7))
  ).sort().reverse() as string[];

  // Reset filter if the selected value is no longer present in unique sets
  useEffect(() => {
    if (filterType === "year" && !uniqueYears.includes(filterValue)) {
      setFilterType("all");
      setFilterValue("");
    } else if (filterType === "month" && !uniqueMonths.includes(filterValue)) {
      setFilterType("all");
      setFilterValue("");
    }
  }, [expenses, filterType, filterValue, uniqueYears, uniqueMonths]);

  const filteredExpenses = expenses.filter((e) => {
    if (filterType === "all") return true;
    if (filterType === "year") return e.date.startsWith(filterValue);
    if (filterType === "month") return e.date.substring(0, 7) === filterValue;
    return true;
  });

  // Fetch initial data from SQLite backend on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const friendsRes = await fetch("/api/friends");
        const friendsData = await friendsRes.json();
        setFriends(friendsData);

        const expensesRes = await fetch("/api/expenses");
        const expensesData = await expensesRes.json();
        setExpenses(expensesData);
      } catch (err) {
        console.error("Failed to load initial data from database:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // State manipulation handlers communicating with the SQLite API
  const handleAddFriend = async (name: string, color: string) => {
    const newFriend: Friend = {
      id: crypto.randomUUID(),
      name,
      color,
    };
    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFriend),
      });
      if (!response.ok) throw new Error("Failed to save friend to database");
      setFriends([...friends, newFriend]);
    } catch (err) {
      console.error("Failed to add friend:", err);
      alert("Error adding friend. Please check connection.");
    }
  };

  const handleDeleteFriend = async (id: string) => {
    try {
      const response = await fetch(`/api/friends/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete friend from database");
      setFriends(friends.filter((f) => f.id !== id));
    } catch (err) {
      console.error("Failed to delete friend:", err);
      alert("Error deleting friend.");
    }
  };

  const handleAddExpense = async (expenseData: Omit<Expense, "id">) => {
    const newExpense: Expense = {
      ...expenseData,
      id: crypto.randomUUID(),
    };
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newExpense),
      });
      if (!response.ok) throw new Error("Failed to save expense to database");
      setExpenses([newExpense, ...expenses]);
      setIsAddingExpense(false);
      setPreselectedFormPayer(undefined);
    } catch (err) {
      console.error("Failed to add expense:", err);
      alert("Error saving expense.");
    }
  };

  const handleUpdateExpense = async (updatedExpense: Expense) => {
    try {
      const response = await fetch(`/api/expenses/${updatedExpense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedExpense),
      });
      if (!response.ok) throw new Error("Failed to update expense in database");
      setExpenses(expenses.map((e) => (e.id === updatedExpense.id ? updatedExpense : e)));
      setIsAddingExpense(false);
      setEditingExpense(undefined);
    } catch (err) {
      console.error("Failed to update expense:", err);
      alert("Error updating expense.");
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsAddingExpense(true);
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const response = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete expense from database");
      setExpenses(expenses.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to delete expense:", err);
      alert("Error deleting expense.");
    }
  };

  // Quick action from recommendation hero
  const handleQuickPay = (payer: Friend) => {
    setPreselectedFormPayer(payer);
    setIsAddingExpense(true);
  };

  // Erase all custom states to start fully fresh
  const handleResetData = async () => {
    if (confirm("Reset application? All logged expenses and friend lists will be cleared.")) {
      try {
        const response = await fetch("/api/db/reset", { method: "POST" });
        if (!response.ok) throw new Error("Failed to reset database");
        setFriends([]);
        setExpenses([]);
      } catch (err) {
        console.error("Failed to reset database:", err);
        alert("Error resetting database.");
      }
    }
  };

  // Restore Seed Templates
  const handleRestoreSamples = async () => {
    try {
      const response = await fetch("/api/db/restore", { method: "POST" });
      if (!response.ok) throw new Error("Failed to restore seed templates");
      
      const friendsRes = await fetch("/api/friends");
      const friendsData = await friendsRes.json();
      setFriends(friendsData);

      const expensesRes = await fetch("/api/expenses");
      const expensesData = await expensesRes.json();
      setExpenses(expensesData);
    } catch (err) {
      console.error("Failed to restore samples:", err);
      alert("Error restoring samples.");
    }
  };

  return (
    <div className="min-h-screen pb-16 flex flex-col pt-1" id="applet-viewport">

      {/* Top ambient notification of local timezone and details */}
      <header className="border-b border-stone-200/60 bg-white shadow-xs sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-amber-500/10">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display tracking-tight text-stone-900 flex items-center gap-2">
                Meals Tracker
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  AI-Powered
                </span>
              </h1>
              <p className="text-[11px] text-stone-500">Group Dining Split & Caloric Ledger</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick-toggle tabs */}
            <div className="bg-stone-100 p-1 rounded-xl flex items-center gap-1 font-semibold text-xs">
              <button
                onClick={() => {
                  setActiveTab("dashboard");
                  setIsAddingExpense(false);
                }}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === "dashboard" && !isAddingExpense
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-500 hover:text-stone-850"
                  }`}
              >
                Let Ledger
              </button>
              <button
                onClick={() => {
                  setActiveTab("friends");
                  setIsAddingExpense(false);
                }}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === "friends" && !isAddingExpense
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-500 hover:text-stone-850"
                  }`}
              >
                Friends ({friends.length})
              </button>
            </div>

            {/* Quick Meal Action Button */}
            {friends.length > 0 && !isAddingExpense && (
              <button
                onClick={() => {
                  setPreselectedFormPayer(undefined);
                  setIsAddingExpense(true);
                }}
                className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-md cursor-pointer transition-colors flex items-center gap-1.5"
                id="log-meal-header-btn"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Meal</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container Stage */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:px-6">

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4" id="app-loading-state">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-sm font-semibold text-stone-500">Loading ledger data...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
          {isAddingExpense ? (
            <motion.div
              key="expense-form-wrapper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ExpenseForm
                friends={friends}
                onAddExpense={handleAddExpense}
                onCancel={() => {
                  setIsAddingExpense(false);
                  setPreselectedFormPayer(undefined);
                  setEditingExpense(undefined);
                }}
                preselectedPayer={preselectedFormPayer}
                editingExpense={editingExpense}
                onUpdateExpense={handleUpdateExpense}
              />
            </motion.div>
          ) : activeTab === "dashboard" ? (
            <motion.div
              key="dashboard-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Dynamic Timeframe Selector Bar */}
              {expenses.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-stone-250/60 rounded-2xl p-4 shadow-xs">
                  <div>
                    <h2 className="text-sm font-bold text-stone-905 flex items-center gap-1.5">
                      <Filter className="w-4 h-4 text-amber-500" />
                      Dashboard Overview
                    </h2>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Statistics and balances for the selected period
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider">
                      Period:
                    </label>
                    <select
                      value={`${filterType}:${filterValue}`}
                      onChange={(e) => {
                        const [type, val] = e.target.value.split(":");
                        setFilterType(type as "all" | "year" | "month");
                        setFilterValue(val || "");
                      }}
                      className="bg-stone-50 border border-stone-200 text-stone-900 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-stone-400 font-semibold cursor-pointer shadow-xs transition-colors hover:bg-stone-100"
                    >
                      <option value="all:">All Time</option>

                      {uniqueYears.length > 0 && (
                        <optgroup label="Years">
                          {uniqueYears.map((yr) => (
                            <option key={yr} value={`year:${yr}`}>{yr}</option>
                          ))}
                        </optgroup>
                      )}

                      {uniqueMonths.length > 0 && (
                        <optgroup label="Months">
                          {uniqueMonths.map((mo) => {
                            const [yr, mn] = mo.split("-");
                            const dateObj = new Date(Number(yr), Number(mn) - 1);
                            const monthName = dateObj.toLocaleString("default", { month: "long" });
                            return (
                              <option key={mo} value={`month:${mo}`}>
                                {monthName} {yr}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>
              )}

              {/* Top summary stats dashboard */}
              <DashboardStats
                friends={friends}
                expenses={filteredExpenses}
                onQuickPayClick={handleQuickPay}
              />

              {/* Expense list below */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold font-display text-gray-500 uppercase tracking-widest">
                    Gathering History
                  </h3>
                  {friends.length > 0 && expenses.length === 0 && (
                    <button
                      onClick={() => setIsAddingExpense(true)}
                      className="text-stone-700 hover:text-stone-900 text-xs font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Log First Meal
                    </button>
                  )}
                </div>

                <ExpenseList
                  expenses={filteredExpenses}
                  friends={friends}
                  onDeleteExpense={handleDeleteExpense}
                  onEditExpense={handleEditExpense}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="friends-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <FriendManager
                friends={friends}
                expenses={expenses}
                onAddFriend={handleAddFriend}
                onDeleteFriend={handleDeleteFriend}
              />
            </motion.div>
          )}
        </AnimatePresence>
        )}

      </main>

      {/* Footer controls for development testing, seed reset, or credentials setup help */}
      <footer className="mt-auto border-t border-stone-200/50 bg-stone-50 py-6 text-xs text-stone-500 text-center">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-1.5 justify-center sm:justify-start">
            <Smile className="w-4 h-4 text-amber-500" />
            <span>Built with Gemini Flash 3.5 AI. Secure sandbox storage local persistence.</span>
          </div>

          <div className="flex flex-wrap gap-4 items-center justify-center font-semibold">
            <button
              onClick={handleRestoreSamples}
              className="text-stone-600 hover:text-stone-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Restore Sample Group
            </button>
            <span className="text-stone-300">|</span>
            <button
              onClick={handleResetData}
              className="text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
            >
              Reset All
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
