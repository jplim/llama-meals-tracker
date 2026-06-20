import React, { useState, useEffect, useRef } from "react";
import { Friend, Expense, TrackerInfo } from "./types";
import FriendManager from "./components/FriendManager";
import ExpenseForm from "./components/ExpenseForm";
import ExpenseList from "./components/ExpenseList";
import DashboardStats from "./components/DashboardStats";
import { Plus, Sparkles, Smile, RefreshCw, Filter, Sun, Moon, Monitor, LogOut, Share2, Trash2, Check, Link, Mail, FolderOpen, PlusCircle, X } from "lucide-react";
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

  // Multi-tracker state
  const [trackers, setTrackers] = useState<TrackerInfo[]>([]);
  const [isNewTrackerModalOpen, setIsNewTrackerModalOpen] = useState(false);
  const [newTrackerName, setNewTrackerName] = useState("");
  const [trackerCreateLoading, setTrackerCreateLoading] = useState(false);
  const [shareModalTracker, setShareModalTracker] = useState<TrackerInfo | null>(null);
  const [shareMode, setShareMode] = useState<"email" | "link">("link");
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareResult, setShareResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [deletingTrackerId, setDeletingTrackerId] = useState<string | null>(null);
  const newTrackerInputRef = useRef<HTMLInputElement>(null);
  const joinedTrackerIdsRef = useRef<Set<string>>(new Set());

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

  // Focus new tracker name input when modal opens
  useEffect(() => {
    if (isNewTrackerModalOpen && newTrackerInputRef.current) {
      setTimeout(() => newTrackerInputRef.current?.focus(), 80);
    }
  }, [isNewTrackerModalOpen]);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "friends">("dashboard");
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [preselectedFormPayer, setPreselectedFormPayer] = useState<Friend | undefined>(undefined);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // PWA install prompt
  const deferredInstallPrompt = useRef<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstallingPWA, setIsInstallingPWA] = useState(false);
  // iOS detection (Safari doesn't fire beforeinstallprompt — needs manual guidance)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

  // Register Service Worker + capture install prompt
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        console.log("ServiceWorker registered scope:", reg.scope);
      }).catch((err) => {
        console.error("ServiceWorker registration failed:", err);
      });
    }

    // Android/Chrome: capture native install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredInstallPrompt.current = e;
      // Show banner after a short delay so the user has seen the app first
      if (!isInStandaloneMode && !localStorage.getItem("pwa_install_dismissed")) {
        setTimeout(() => setShowInstallBanner(true), 3000);
      }
    };

    // iOS: show manual install hint after first visit
    if (isIOS && !isInStandaloneMode && !localStorage.getItem("pwa_install_dismissed")) {
      setTimeout(() => setShowInstallBanner(true), 3000);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", () => {
      setShowInstallBanner(false);
      deferredInstallPrompt.current = null;
      localStorage.setItem("pwa_install_dismissed", "1");
    });

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
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
    setTrackers([]);
  };

  // Fetch all trackers accessible to the user
  const fetchTrackers = async (currentToken: string) => {
    try {
      const res = await fetch("/api/trackers", {
        headers: { "Authorization": `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTrackers(data);
      }
    } catch (err) {
      console.error("Failed to fetch trackers:", err);
    }
  };

  // Create a new tracker
  const handleCreateTracker = async () => {
    const name = newTrackerName.trim();
    if (!name || !token) return;
    setTrackerCreateLoading(true);
    try {
      const res = await fetch("/api/trackers", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create tracker");
      }
      const newTracker: TrackerInfo = await res.json();
      setTrackers(prev => [...prev, newTracker]);
      setNewTrackerName("");
      setIsNewTrackerModalOpen(false);
      // Switch to the newly created tracker
      handleSwitchTracker(newTracker);
      setToast(`Tracker "${newTracker.name}" created!`);
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert(err.message || "Error creating tracker.");
    } finally {
      setTrackerCreateLoading(false);
    }
  };

  // Delete a tracker (owner only)
  const handleDeleteTracker = async (tracker: TrackerInfo) => {
    if (!confirm(`Delete tracker "${tracker.name}"? This will permanently remove all its meals, friends, and data.`)) return;
    setDeletingTrackerId(tracker.id);
    try {
      const res = await fetch(`/api/trackers/${tracker.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete tracker");
      }
      setTrackers(prev => prev.filter(t => t.id !== tracker.id));
      // If we were on this tracker, switch back to default
      if (trackerId === tracker.id && defaultTrackerId) {
        handleSwitchTracker({ id: defaultTrackerId, name: "My Tracker", ownerId: user?.id || "", ownerName: user?.name || "", isOwner: 1 });
      }
      setToast(`Tracker "${tracker.name}" deleted.`);
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert(err.message || "Error deleting tracker.");
    } finally {
      setDeletingTrackerId(null);
    }
  };

  // Switch active tracker
  const handleSwitchTracker = (tracker: TrackerInfo) => {
    const url = new URL(window.location.href);
    if (tracker.id === defaultTrackerId) {
      url.searchParams.delete("tracker");
      setSharedTrackerInfo(null);
    } else {
      url.searchParams.set("tracker", tracker.id);
      if (tracker.isOwner === 0) {
        setSharedTrackerInfo({ id: tracker.id, name: tracker.name, ownerName: tracker.ownerName });
      } else {
        setSharedTrackerInfo(null);
      }
    }
    window.history.pushState({}, "", url.toString());
    setTrackerId(tracker.id);
    setIsProfileMenuOpen(false);
    setFriends([]);
    setExpenses([]);
  };

  // Share tracker by email
  const handleShareByEmail = async () => {
    if (!shareModalTracker || !shareEmail.trim() || !token) return;
    setShareLoading(true);
    setShareResult(null);
    try {
      const res = await fetch(`/api/trackers/${shareModalTracker.id}/share`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: shareEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to share");
      setShareResult({ ok: true, msg: data.message || "Tracker shared successfully!" });
      setShareEmail("");
    } catch (err: any) {
      setShareResult({ ok: false, msg: err.message || "Error sharing tracker." });
    } finally {
      setShareLoading(false);
    }
  };

  // Copy share link to clipboard
  const handleCopyShareLink = (tid: string) => {
    const shareUrl = `${window.location.origin}/?tracker=${tid}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setToast("Tracker share link copied!");
      setTimeout(() => setToast(null), 3000);
    });
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
  // The GET /api/trackers/:id endpoint also auto-joins the viewer to tracker_shares.
  useEffect(() => {
    if (!token || !trackerId) return;
    if (defaultTrackerId && trackerId === defaultTrackerId) {
      setSharedTrackerInfo(null);
      return;
    }

    const fetchTrackerInfo = async () => {
      try {
        const res = await fetch(`/api/trackers/${trackerId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const info = await res.json();
          setSharedTrackerInfo(info);
          // Refresh sidebar list so the auto-joined tracker appears there
          await fetchTrackers(token);
          // Show a welcome toast the first time this session we join this tracker
          if (!joinedTrackerIdsRef.current.has(trackerId)) {
            joinedTrackerIdsRef.current.add(trackerId);
            setToast(`\u201c${info.name}\u201d added to your trackers!`);
            setTimeout(() => setToast(null), 4000);
          }
        }
      } catch (err) {
        console.error("Failed to fetch tracker info:", err);
      }
    };
    fetchTrackerInfo();
  }, [token, trackerId, defaultTrackerId]);

  // Poll for fresh data every 30 s when viewing a tracker you don't own (shared link)
  useEffect(() => {
    if (!token || !trackerId || trackerId === defaultTrackerId) return;
    const poll = setInterval(async () => {
      try {
        const [fRes, eRes] = await Promise.all([
          fetch("/api/friends", { headers: { "Authorization": `Bearer ${token}`, "x-tracker-id": trackerId } }),
          fetch("/api/expenses", { headers: { "Authorization": `Bearer ${token}`, "x-tracker-id": trackerId } }),
        ]);
        if (fRes.ok) setFriends(await fRes.json());
        if (eRes.ok) setExpenses(await eRes.json());
      } catch (err) {
        // silently ignore poll errors
      }
    }, 30_000);
    return () => clearInterval(poll);
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

  // Fetch trackers whenever token is available
  useEffect(() => {
    if (token) fetchTrackers(token);
  }, [token]);

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
            <div className="w-16 h-16 rounded-3xl overflow-hidden shadow-lg shadow-amber-500/25 mx-auto">
              <img src="/icon-192.png" alt="Meals Tracker" className="w-full h-full object-cover" />
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

  // Active tracker display name
  const activeTrackerName = trackers.find(t => t.id === trackerId)?.name
    ?? (trackerId === defaultTrackerId ? "My Tracker" : null);

  return (
    <div className="min-h-screen pb-16 flex flex-col pt-1 bg-stone-50 dark:bg-stone-950 transition-colors" id="applet-viewport">

      {/* New Tracker Modal */}
      <AnimatePresence>
        {isNewTrackerModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) { setIsNewTrackerModalOpen(false); setNewTrackerName(""); } }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 w-full sm:max-w-sm z-10"
            >
              {/* Drag handle (mobile) */}
              <div className="w-10 h-1 bg-stone-200 dark:bg-stone-700 rounded-full mx-auto mb-5 sm:hidden" />

              <button
                onClick={() => { setIsNewTrackerModalOpen(false); setNewTrackerName(""); }}
                className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors hidden sm:flex"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-amber-500/10 dark:bg-amber-500/15 rounded-xl flex items-center justify-center">
                  <PlusCircle className="w-4.5 h-4.5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-900 dark:text-stone-100">New Tracker</p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">Give your tracker a name</p>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  ref={newTrackerInputRef}
                  type="text"
                  placeholder="e.g. Tokyo Trip, Office Lunches..."
                  value={newTrackerName}
                  onChange={(e) => setNewTrackerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateTracker();
                    if (e.key === "Escape") { setIsNewTrackerModalOpen(false); setNewTrackerName(""); }
                  }}
                  className="w-full bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-3 outline-none focus:border-amber-400 dark:focus:border-amber-500 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 transition-colors"
                />
                <p className="text-[10px] text-stone-400 dark:text-stone-500 px-1">Starts empty — add friends and meals after creating.</p>
                <button
                  onClick={handleCreateTracker}
                  disabled={trackerCreateLoading || !newTrackerName.trim()}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold py-3 px-4 rounded-xl text-sm transition-colors cursor-pointer shadow-md shadow-amber-500/10 flex items-center justify-center gap-2"
                >
                  {trackerCreateLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  {trackerCreateLoading ? "Creating..." : "Create Tracker"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share modal overlay */}
      <AnimatePresence>
        {shareModalTracker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShareModalTracker(null); setShareResult(null); setShareEmail(""); } }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm z-10"
            >
              <button
                onClick={() => { setShareModalTracker(null); setShareResult(null); setShareEmail(""); }}
                className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-amber-500/10 dark:bg-amber-500/15 rounded-xl flex items-center justify-center">
                  <Share2 className="w-4.5 h-4.5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-900 dark:text-stone-100">Share Tracker</p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate max-w-[180px]">{shareModalTracker.name}</p>
                </div>
              </div>

              {/* Mode toggle */}
              <div className="bg-stone-100 dark:bg-stone-800 p-0.5 rounded-xl flex gap-0.5 mb-4 text-xs font-semibold border border-stone-200/40 dark:border-stone-700/40">
                <button
                  onClick={() => { setShareMode("link"); setShareResult(null); }}
                  className={`flex-1 py-1.5 rounded-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${shareMode === "link" ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs" : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
                    }`}
                >
                  <Link className="w-3 h-3" /> Copy Link
                </button>
                <button
                  onClick={() => { setShareMode("email"); setShareResult(null); }}
                  className={`flex-1 py-1.5 rounded-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${shareMode === "email" ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs" : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
                    }`}
                >
                  <Mail className="w-3 h-3" /> By Email
                </button>
              </div>

              {shareMode === "link" ? (
                <div className="space-y-3">
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">Anyone with this link can view and contribute to this tracker.</p>
                  <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 flex-1 truncate font-mono">{window.location.origin}/?tracker={shareModalTracker.id}</span>
                  </div>
                  <button
                    onClick={() => handleCopyShareLink(shareModalTracker.id)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5"
                  >
                    <Link className="w-3.5 h-3.5" /> Copy Share Link
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">Share directly with a user who has already signed in to Meals Tracker.</p>
                  <input
                    type="email"
                    placeholder="friend@example.com"
                    value={shareEmail}
                    onChange={(e) => { setShareEmail(e.target.value); setShareResult(null); }}
                    onKeyDown={(e) => e.key === "Enter" && handleShareByEmail()}
                    className="w-full bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2.5 outline-none focus:border-amber-400 dark:focus:border-amber-500 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 transition-colors"
                  />
                  {shareResult && (
                    <p className={`text-[11px] font-semibold px-1 ${shareResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                      {shareResult.msg}
                    </p>
                  )}
                  <button
                    onClick={handleShareByEmail}
                    disabled={shareLoading || !shareEmail.trim()}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5"
                  >
                    {shareLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    {shareLoading ? "Sharing..." : "Share via Email"}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-stone-250/60 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs sticky top-0 z-50 transition-colors">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 sm:px-6 flex flex-wrap items-center justify-between gap-y-3 gap-x-2">
          {/* Logo & branding */}
          <div className="flex items-center gap-2.5 sm:gap-3 order-1">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden shadow-md shadow-amber-500/10 shrink-0">
              <img src="/icon-192.png" alt="Meals Tracker" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold font-display tracking-tight text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
                Meals Tracker
                <span className="text-[9px] sm:text-[10px] bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/40 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                  AI
                </span>
              </h1>
              {activeTrackerName && (
                <p className="text-[10px] sm:text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" />
                  {activeTrackerName}
                </p>
              )}
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

          {/* Profile + tracker dropdown */}
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
                  className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-stone-250/60 dark:border-stone-800 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md shadow-xl z-50 text-left overflow-hidden"
                >
                  {/* User info */}
                  <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                    <img
                      src={user.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
                      alt={user.name}
                      className="w-9 h-9 rounded-full border border-stone-200 dark:border-stone-700/80 object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">{user.name}</p>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="h-px bg-stone-150 dark:bg-stone-800 mx-1" />

                  {/* Trackers section */}
                  <div className="px-3 pt-3 pb-2">
                    <p className="text-[10px] font-extrabold text-stone-400 dark:text-stone-500 uppercase tracking-wider px-1 mb-2">My Trackers</p>
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {trackers.length === 0 && (
                        <p className="text-[11px] text-stone-400 dark:text-stone-500 px-1 py-1">No trackers yet.</p>
                      )}
                      {trackers.map(t => {
                        const isActive = t.id === trackerId;
                        const isOwned = t.isOwner === 1;
                        const isDefaultTracker = t.id === defaultTrackerId;
                        const isDeleting = deletingTrackerId === t.id;
                        return (
                          <div
                            key={t.id}
                            className={`group flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors ${isActive
                                ? "bg-amber-50 dark:bg-amber-950/25 border border-amber-200/60 dark:border-amber-800/30"
                                : "hover:bg-stone-100 dark:hover:bg-stone-800/60 border border-transparent"
                              }`}
                          >
                            <button
                              onClick={() => !isActive && handleSwitchTracker(t)}
                              className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                              disabled={isActive}
                            >
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-amber-500 text-white" : "bg-stone-100 dark:bg-stone-800 text-stone-500"
                                }`}>
                                {isActive ? <Check className="w-3 h-3" /> : <FolderOpen className="w-3 h-3" />}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-[11px] font-semibold truncate ${isActive ? "text-amber-800 dark:text-amber-300" : "text-stone-800 dark:text-stone-200"
                                  }`}>{t.name}</p>
                                {!isOwned && (
                                  <p className="text-[9px] text-stone-400 dark:text-stone-500 truncate">by {t.ownerName}</p>
                                )}
                                {isOwned && isDefaultTracker && (
                                  <p className="text-[9px] text-stone-400 dark:text-stone-500">Default</p>
                                )}
                              </div>
                            </button>

                            {/* Share & delete controls — visible on hover */}
                            <div className={`flex items-center gap-0.5 transition-opacity ${isDeleting ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                              {isOwned && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setShareModalTracker(t); setShareMode("link"); setShareResult(null); setIsProfileMenuOpen(false); }}
                                  title="Share tracker"
                                  className="p-1 rounded-lg text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer"
                                >
                                  <Share2 className="w-3 h-3" />
                                </button>
                              )}
                              {isOwned && !isDefaultTracker && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteTracker(t); }}
                                  title="Delete tracker"
                                  disabled={isDeleting}
                                  className="p-1 rounded-lg text-stone-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* New Tracker — opens a dedicated modal (mobile friendly) */}
                    <button
                      onClick={() => { setIsProfileMenuOpen(false); setIsNewTrackerModalOpen(true); }}
                      className="mt-1.5 w-full flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-[11px] font-semibold text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/15 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      New Tracker
                    </button>
                  </div>

                  <div className="h-px bg-stone-150 dark:bg-stone-800 mx-1" />

                  {/* Theme switcher */}
                  <div className="px-3 pt-3 pb-2">
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 font-extrabold uppercase tracking-wider px-1 block mb-2">Appearance</span>
                    <div className="bg-stone-100 dark:bg-stone-800 p-0.5 rounded-xl flex items-center gap-0.5 font-semibold text-xs border border-stone-200/40 dark:border-stone-700/40">
                      <button
                        onClick={() => setTheme("light")}
                        className={`flex-1 py-1.5 rounded-[10px] transition-all cursor-pointer flex justify-center items-center gap-1.5 ${theme === "light" ? "bg-white dark:bg-stone-900 text-amber-500 shadow-xs" : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-200"
                          }`}
                        title="Light Mode"
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Light</span>
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`flex-1 py-1.5 rounded-[10px] transition-all cursor-pointer flex justify-center items-center gap-1.5 ${theme === "dark" ? "bg-white dark:bg-stone-900 text-indigo-400 shadow-xs" : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-200"
                          }`}
                        title="Dark Mode"
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Dark</span>
                      </button>
                      <button
                        onClick={() => setTheme("system")}
                        className={`flex-1 py-1.5 rounded-[10px] transition-all cursor-pointer flex justify-center items-center gap-1.5 ${theme === "system" ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs" : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-200"
                          }`}
                        title="System Mode"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span className="text-[10px]">System</span>
                      </button>
                    </div>
                  </div>

                  {/* Install App (only shown if not already installed) */}
                  {!isInStandaloneMode && (
                    <>
                      <div className="h-px bg-stone-150 dark:bg-stone-800 mx-1" />
                      <div className="px-3 pt-2 pb-1">
                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            if (deferredInstallPrompt.current) {
                              deferredInstallPrompt.current.prompt();
                              deferredInstallPrompt.current.userChoice.then((choice: any) => {
                                if (choice.outcome === "accepted") {
                                  localStorage.setItem("pwa_install_dismissed", "1");
                                  setShowInstallBanner(false);
                                }
                                deferredInstallPrompt.current = null;
                              });
                            } else {
                              setShowInstallBanner(true);
                            }
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 active:bg-amber-100 transition-colors text-left cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Install App</span>
                        </button>
                      </div>
                    </>
                  )}

                  <div className="h-px bg-stone-150 dark:bg-stone-800 mx-1" />

                  {/* Logout Button */}
                  <div className="px-3 pt-2 pb-3">
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
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Shared Tracker Banner */}
      {sharedTrackerInfo && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/40 py-2.5 px-4 text-center text-xs font-semibold text-amber-800 dark:text-amber-300 flex flex-wrap items-center justify-center gap-2">
          <span>Viewing shared tracker: <strong className="text-amber-950 dark:text-amber-200 font-bold">{sharedTrackerInfo.name}</strong> <span className="font-normal opacity-75">by {sharedTrackerInfo.ownerName}</span></span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={async () => {
                setIsLoading(true);
                try {
                  const [fRes, eRes] = await Promise.all([
                    fetch("/api/friends", { headers: { "Authorization": `Bearer ${token}`, "x-tracker-id": trackerId! } }),
                    fetch("/api/expenses", { headers: { "Authorization": `Bearer ${token}`, "x-tracker-id": trackerId! } }),
                  ]);
                  if (fRes.ok) setFriends(await fRes.json());
                  if (eRes.ok) setExpenses(await eRes.json());
                } finally { setIsLoading(false); }
              }}
              className="bg-white dark:bg-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-200/80 dark:border-amber-700/40 px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide cursor-pointer transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Refresh
            </button>
            <button
              onClick={handleSwitchToDefault}
              className="bg-white dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-stone-700 text-amber-900 dark:text-amber-300 border border-amber-200/80 dark:border-stone-700 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide cursor-pointer transition-colors"
            >
              Back to Mine
            </button>
          </div>
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
            <span>Built with AI 🤖.</span>
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

      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-4 left-4 right-4 z-[200] max-w-sm mx-auto"
          >
            <div className="bg-stone-900 dark:bg-stone-800 border border-stone-700/60 rounded-2xl shadow-2xl shadow-black/40 p-4 flex items-center gap-3">
              <img
                src="/icon-192.png"
                alt="Meals Tracker"
                className="w-12 h-12 rounded-xl shrink-0 border border-stone-700/40"
              />
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm leading-tight">Add to Home Screen</p>
                {isIOS ? (
                  <p className="text-stone-400 text-[11px] mt-0.5 leading-snug">
                    Tap <strong className="text-stone-300">Share ⧆</strong> then <strong className="text-stone-300">Add to Home Screen</strong>
                  </p>
                ) : (
                  <p className="text-stone-400 text-[11px] mt-0.5">Install for a faster, app-like experience</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {!isIOS && (
                  <button
                    onClick={async () => {
                      if (!deferredInstallPrompt.current) return;
                      setIsInstallingPWA(true);
                      deferredInstallPrompt.current.prompt();
                      const choice = await deferredInstallPrompt.current.userChoice;
                      setIsInstallingPWA(false);
                      if (choice.outcome === "accepted") {
                        localStorage.setItem("pwa_install_dismissed", "1");
                        setShowInstallBanner(false);
                      }
                      deferredInstallPrompt.current = null;
                    }}
                    disabled={isInstallingPWA}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-stone-950 font-extrabold text-[11px] px-3 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
                  >
                    {isInstallingPWA ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Install
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowInstallBanner(false);
                    localStorage.setItem("pwa_install_dismissed", "1");
                  }}
                  className="text-stone-500 hover:text-stone-300 text-[10px] font-semibold transition-colors cursor-pointer px-1"
                >
                  Not now
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
