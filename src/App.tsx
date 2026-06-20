import React, { useState, useEffect } from "react";
import { Friend, Expense } from "./types";
import FriendManager from "./components/FriendManager";
import ExpenseForm from "./components/ExpenseForm";
import ExpenseList from "./components/ExpenseList";
import DashboardStats from "./components/DashboardStats";
import { Plus, Users, UtensilsCrossed, Sparkles, BookOpen, Smile, RefreshCw, Layers, Filter, Sun, Moon, Monitor, LogOut } from "lucide-react";
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
  // Theme state
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    return (localStorage.getItem("meal_tracker_theme") as "light" | "dark" | "system") || "system";
  });

  // Authentication states
  const [token, setToken] = useState<string | null>(localStorage.getItem("meal_tracker_token"));
  const [user, setUser] = useState<any | null>(() => {
    const saved = localStorage.getItem("meal_tracker_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [defaultTrackerId, setDefaultTrackerId] = useState<string | null>(localStorage.getItem("meal_tracker_default_id"));
  const [trackerId, setTrackerId] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [sharedTrackerInfo, setSharedTrackerInfo] = useState<{ id: string; name: string; ownerName: string } | null>(null);
  const [showMockLogin, setShowMockLogin] = useState(false);
  const [mockEmail, setMockEmail] = useState("");
  const [mockName, setMockName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#profile-dropdown-container")) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isProfileMenuOpen]);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "friends">("dashboard");
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [preselectedFormPayer, setPreselectedFormPayer] = useState<Friend | undefined>(undefined);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Register Service Worker for PWA
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        console.log("ServiceWorker registered successfully scope: ", reg.scope);
      }).catch((err) => {
        console.error("ServiceWorker registration failed: ", err);
      });
    }
  }, []);

  // Theme Sync Engine
  useEffect(() => {
    localStorage.setItem("meal_tracker_theme", theme);
    const root = window.document.documentElement;
    
    const applyTheme = () => {
      root.classList.remove("light", "dark");
      if (theme === "system") {
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.add(systemDark ? "dark" : "light");
      } else {
        root.classList.add(theme);
      }
    };

    applyTheme();

    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme();
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, [theme]);

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

  const handleLogout = () => {
    localStorage.removeItem("meal_tracker_token");
    localStorage.removeItem("meal_tracker_user");
    localStorage.removeItem("meal_tracker_default_id");
    setToken(null);
    setUser(null);
    setDefaultTrackerId(null);
    setTrackerId(null);
    setSharedTrackerInfo(null);
  };

  // API Fetch Helper wrapping Authorization and Tracker ID headers
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
    } as Record<string, string>;

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (trackerId) {
      headers["x-tracker-id"] = trackerId;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      handleLogout();
      throw new Error("Session expired or unauthorized. Please log in again.");
    }

    return response;
  };

  // Load configuration & URL parameters on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/config");
        const config = await res.json();
        setGoogleClientId(config.googleClientId);
      } catch (err) {
        console.error("Failed to load auth config:", err);
      }
    };
    loadConfig();

    const urlParams = new URLSearchParams(window.location.search);
    const queryTracker = urlParams.get("tracker");
    if (queryTracker) {
      setTrackerId(queryTracker);
    }
  }, []);

  // Update trackerId when defaultTrackerId is retrieved (if not already viewing a shared tracker)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryTracker = urlParams.get("tracker");
    if (!queryTracker && defaultTrackerId) {
      setTrackerId(defaultTrackerId);
    }
  }, [defaultTrackerId]);

  // Load Google GIS library dynamically
  useEffect(() => {
    if (!googleClientId || token) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const g = (window as any).google;
      if (g) {
        g.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleSignInResponse,
        });
        
        const btnContainer = document.getElementById("google-signin-button");
        if (btnContainer) {
          g.accounts.id.renderButton(btnContainer, {
            theme: "outline",
            size: "large",
            width: 280,
          });
        }
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [googleClientId, token, showMockLogin]);

  // Fetch shared tracker info if viewing someone else's tracker
  useEffect(() => {
    if (!token || !trackerId) return;
    if (defaultTrackerId && trackerId === defaultTrackerId) {
      setSharedTrackerInfo(null);
      return;
    }

    const fetchTrackerInfo = async () => {
      try {
        const res = await fetch(`/api/trackers/${trackerId}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const info = await res.json();
          setSharedTrackerInfo(info);
        }
      } catch (err) {
        console.error("Failed to fetch tracker info:", err);
      }
    };
    fetchTrackerInfo();
  }, [token, trackerId, defaultTrackerId]);

  // Fetch initial data from SQLite backend when token and trackerId are ready
  useEffect(() => {
    if (!token || !trackerId) {
      setFriends([]);
      setExpenses([]);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const friendsRes = await apiFetch("/api/friends");
        const friendsData = await friendsRes.json();
        setFriends(friendsData);

        const expensesRes = await apiFetch("/api/expenses");
        const expensesData = await expensesRes.json();
        setExpenses(expensesData);
      } catch (err) {
        console.error("Failed to load initial data from database:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token, trackerId]);

  const handleGoogleSignInResponse = async (response: any) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed Google login");
      }
      const data = await res.json();
      localStorage.setItem("meal_tracker_token", data.token);
      localStorage.setItem("meal_tracker_user", JSON.stringify(data.user));
      localStorage.setItem("meal_tracker_default_id", data.defaultTrackerId);
      
      setToken(data.token);
      setUser(data.user);
      setDefaultTrackerId(data.defaultTrackerId);
      
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get("tracker")) {
        setTrackerId(data.defaultTrackerId);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error logging in with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMockLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockName.trim() || !mockEmail.trim()) {
      alert("Name and email are required for developer mock login");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mockName.trim(), email: mockEmail.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed Mock login");
      }
      const data = await res.json();
      localStorage.setItem("meal_tracker_token", data.token);
      localStorage.setItem("meal_tracker_user", JSON.stringify(data.user));
      localStorage.setItem("meal_tracker_default_id", data.defaultTrackerId);
      
      setToken(data.token);
      setUser(data.user);
      setDefaultTrackerId(data.defaultTrackerId);
      
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get("tracker")) {
        setTrackerId(data.defaultTrackerId);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error logging in with Mock mode.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareTracker = () => {
    const shareId = defaultTrackerId || trackerId;
    if (!shareId) return;
    const shareUrl = `${window.location.origin}/?tracker=${shareId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setToast("Tracker share link copied to clipboard!");
      setTimeout(() => setToast(null), 3000);
    }).catch(err => {
      console.error("Failed to copy share link:", err);
    });
  };

  const handleSwitchToDefault = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("tracker");
    window.history.pushState({}, "", url.toString());
    setTrackerId(defaultTrackerId);
    setSharedTrackerInfo(null);
  };

  // State manipulation handlers communicating with the SQLite API
  const handleAddFriend = async (name: string, color: string) => {
    const newFriend: Friend = {
      id: crypto.randomUUID(),
      name,
      color,
    };
    try {
      const response = await apiFetch("/api/friends", {
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
      const response = await apiFetch(`/api/friends/${id}`, {
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
      const response = await apiFetch("/api/expenses", {
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
      const response = await apiFetch(`/api/expenses/${updatedExpense.id}`, {
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
      const response = await apiFetch(`/api/expenses/${id}`, {
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
        const response = await apiFetch("/api/db/reset", { method: "POST" });
        if (!response.ok) throw new Error("Failed to reset database");
        setFriends([]);
        setExpenses([]);
      } catch (err) {
        console.error("Failed to reset database:", err);
        alert("Error resetting database.");
      }
    }
  };



  // Whenever token is cleared or showMockLogin changes, try to render the Google button
  useEffect(() => {
    if (!token && googleClientId && !showMockLogin) {
      const g = (window as any).google;
      if (g) {
        const timer = setTimeout(() => {
          const btnContainer = document.getElementById("google-signin-button");
          if (btnContainer) {
            g.accounts.id.renderButton(btnContainer, {
              theme: "outline",
              size: "large",
              width: 280,
            });
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [token, googleClientId, showMockLogin]);

  if (!token || !user) {
    return (
      <div className="min-h-screen bg-stone-900 text-white flex flex-col justify-center items-center px-4 relative overflow-hidden">
        {/* Glow ambient effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-orange-600/10 blur-[120px] pointer-events-none" />

        <div className="max-w-md w-full text-center space-y-8 z-10">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-3xl flex items-center justify-center shadow-lg shadow-amber-500/25 mx-auto">
              <UtensilsCrossed className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight font-display bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Meals Tracker
              </h1>
              <p className="text-sm text-stone-400 mt-2">
                A collaborative culinary ledger & portion-level split manager.
              </p>
            </div>
          </div>

          <div className="bg-stone-900/50 backdrop-blur-xl border border-stone-800 p-8 rounded-3xl shadow-2xl space-y-6">
            {googleClientId ? (
              <div className="space-y-4 flex flex-col items-center">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  Sign In to Continue
                </p>
                <div id="google-signin-button" className="min-h-[44px] flex justify-center items-center w-full" />
                
                <div className="relative w-full py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-800" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-stone-900 px-3 text-stone-500 font-bold tracking-widest text-[9px]">Or Use Mock Bypass</span></div>
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-stone-400 text-xs">
                <Sparkles className="w-5 h-5 text-amber-500 mx-auto mb-2 animate-pulse" />
                <p className="font-semibold text-stone-300">Mock Authentication Mode</p>
                <p className="mt-1">Google client ID is not configured. Falling back to local developer mode.</p>
              </div>
            )}

            {(!googleClientId || showMockLogin) ? (
              <form onSubmit={handleMockLogin} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={mockName}
                    onChange={(e) => setMockName(e.target.value)}
                    className="w-full bg-stone-950/40 border border-stone-800 rounded-xl px-3 py-2.5 outline-none focus:border-stone-600 text-sm text-white transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="jane.doe@example.com"
                    value={mockEmail}
                    onChange={(e) => setMockEmail(e.target.value)}
                    className="w-full bg-stone-950/40 border border-stone-800 rounded-xl px-3 py-2.5 outline-none focus:border-stone-600 text-sm text-white transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold py-3 px-4 rounded-xl text-sm transition-colors cursor-pointer shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5"
                >
                  <Smile className="w-4 h-4" /> Enter Sandbox
                </button>
                {googleClientId && (
                  <button
                    type="button"
                    onClick={() => setShowMockLogin(false)}
                    className="w-full text-center text-xs text-stone-400 hover:text-stone-300 font-semibold underline mt-2 block"
                  >
                    Back to Google Sign-In
                  </button>
                )}
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowMockLogin(true)}
                className="w-full bg-stone-800/40 hover:bg-stone-800 text-stone-300 hover:text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer border border-stone-800"
              >
                Show Developer Mock Login
              </button>
            )}
          </div>

          <div className="text-[10px] text-stone-600 font-semibold uppercase tracking-wider">
            Secured via JSON Web Token (JWT)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16 flex flex-col pt-1 bg-stone-50 dark:bg-stone-950 transition-colors" id="applet-viewport">

      {/* Top ambient notification of local timezone and details */}
      <header className="border-b border-stone-250/60 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs sticky top-0 z-50 transition-colors">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 sm:px-6 flex flex-wrap items-center justify-between gap-y-3 gap-x-2">
          {/* Logo & branding */}
          <div className="flex items-center gap-2.5 sm:gap-3 order-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-amber-500/10 shrink-0">
              <UtensilsCrossed className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold font-display tracking-tight text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
                Meals Tracker
                <span className="text-[9px] sm:text-[10px] bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/40 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                  AI
                </span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 hidden sm:block">Group Dining Split & Caloric Ledger</p>
            </div>
          </div>

          {/* Quick Controls Section */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 order-3 w-full sm:w-auto sm:order-2 sm:ml-auto">
            {/* Quick-toggle tabs */}
            <div className="bg-stone-100 dark:bg-stone-800 p-1 rounded-xl flex items-center gap-1 font-semibold text-xs border border-stone-200/40 dark:border-stone-700/40 flex-1 sm:flex-initial">
              <button
                onClick={() => {
                  setActiveTab("dashboard");
                  setIsAddingExpense(false);
                }}
                className={`flex-1 sm:flex-initial text-center px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === "dashboard" && !isAddingExpense
                    ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs"
                    : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-200"
                  }`}
              >
                Ledger
              </button>
              <button
                onClick={() => {
                  setActiveTab("friends");
                  setIsAddingExpense(false);
                }}
                className={`flex-1 sm:flex-initial text-center px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === "friends" && !isAddingExpense
                    ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs"
                    : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-200"
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
                className="bg-stone-900 dark:bg-amber-500 hover:bg-stone-800 dark:hover:bg-amber-600 text-white dark:text-stone-950 text-xs font-semibold px-3.5 py-2 rounded-xl shadow-md cursor-pointer transition-colors flex items-center gap-1.5 shrink-0"
                id="log-meal-header-btn"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Meal</span>
              </button>
            )}
          </div>

          <div id="profile-dropdown-container" className="relative flex items-center order-2 sm:order-3">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="focus:outline-hidden rounded-full transition-all duration-200 active:scale-95 flex items-center justify-center p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800/60"
              aria-label="Toggle profile menu"
            >
              <img
                src={user.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-stone-200 dark:border-stone-700/80 object-cover"
              />
            </button>

            <AnimatePresence>
              {isProfileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-stone-250/60 dark:border-stone-800 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md shadow-xl p-4 z-50 text-left flex flex-col gap-3.5"
                >
                  <div className="px-1 py-0.5">
                    <p className="text-xs font-bold text-stone-900 dark:text-stone-100">{user.name}</p>
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">{user.email}</p>
                  </div>

                  <div className="h-px bg-stone-150 dark:bg-stone-800" />

                  {/* Actions */}
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      handleShareTracker();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20 active:bg-amber-100/60 transition-colors text-left cursor-pointer border border-transparent"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Share Tracker</span>
                  </button>

                  <div className="h-px bg-stone-150 dark:bg-stone-800" />

                  {/* Theme switcher */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 font-extrabold uppercase tracking-wider px-1">Appearance</span>
                    <div className="bg-stone-100 dark:bg-stone-800 p-1 rounded-xl flex items-center gap-1 font-semibold text-xs border border-stone-200/40 dark:border-stone-700/40">
                      <button
                        onClick={() => setTheme("light")}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex justify-center items-center gap-1.5 ${theme === "light"
                            ? "bg-white dark:bg-stone-900 text-amber-500 shadow-xs"
                            : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-200"
                          }`}
                        title="Light Mode"
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Light</span>
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex justify-center items-center gap-1.5 ${theme === "dark"
                            ? "bg-white dark:bg-stone-900 text-indigo-400 shadow-xs"
                            : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-200"
                          }`}
                        title="Dark Mode"
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Dark</span>
                      </button>
                      <button
                        onClick={() => setTheme("system")}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex justify-center items-center gap-1.5 ${theme === "system"
                            ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs"
                            : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-200"
                          }`}
                        title="System Mode"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span className="text-[10px]">System</span>
                      </button>
                    </div>
                  </div>

                  <div className="h-px bg-stone-150 dark:bg-stone-800" />

                  {/* Logout Button */}
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 active:bg-red-100 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Shared Tracker Banner */}
      {sharedTrackerInfo && (
        <div className="bg-amber-50 border-b border-amber-200 py-2.5 px-4 text-center text-xs font-semibold text-amber-800 flex items-center justify-center gap-2">
          <span>Viewing shared tracker: <strong className="text-amber-950 font-bold">{sharedTrackerInfo.name}</strong> (owned by {sharedTrackerInfo.ownerName})</span>
          <button
            onClick={handleSwitchToDefault}
            className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-200/80 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide cursor-pointer transition-colors"
          >
            Back to My Tracker
          </button>
        </div>
      )}

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
                token={token}
                trackerId={trackerId}
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 border border-stone-250/60 dark:border-stone-800 rounded-2xl p-4 shadow-xs transition-colors">
                  <div>
                    <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <Filter className="w-4 h-4 text-amber-500" />
                      Dashboard Overview
                    </h2>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      Statistics and balances for the selected period
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-extrabold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                      Period:
                    </label>
                    <select
                      value={`${filterType}:${filterValue}`}
                      onChange={(e) => {
                        const [type, val] = e.target.value.split(":");
                        setFilterType(type as "all" | "year" | "month");
                        setFilterValue(val || "");
                      }}
                      className="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-stone-400 dark:focus:border-stone-600 font-semibold cursor-pointer shadow-xs transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
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
                  <h3 className="text-sm font-bold font-display text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                    Gathering History
                  </h3>
                  {friends.length > 0 && expenses.length === 0 && (
                    <button
                      onClick={() => setIsAddingExpense(true)}
                      className="text-stone-700 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
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
      <footer className="mt-auto border-t border-stone-200/50 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 py-6 text-xs text-stone-500 dark:text-stone-450 text-center transition-colors">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row justify-center items-center gap-4">
          <div className="flex items-center gap-1.5 justify-center">
            <Smile className="w-4 h-4 text-amber-500" />
            <span>Built with Gemini Flash 3.5 AI. Secure sandbox storage local persistence.</span>
          </div>
        </div>
      </footer>

      {/* Floating share notification toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-stone-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold z-50 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toast}</span>
        </div>
      )}

    </div>
  );
}
