import React, { useState } from "react";
import { Friend, Expense } from "../types";
import { Plus, Trash2, UserPlus, AlertCircle, Sparkles, Users } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FriendManagerProps {
  friends: Friend[];
  expenses: Expense[];
  onAddFriend: (name: string, color: string) => void;
  onDeleteFriend: (id: string) => void;
}

// Warm food-inspired beautiful color palette presets
const COLOR_PRESETS = [
  { hex: "#EF4444", label: "Tomato Red" },
  { hex: "#F97316", label: "Orange Peel" },
  { hex: "#F59E0B", label: "Warm Amber" },
  { hex: "#10B981", label: "Basil Green" },
  { hex: "#06B6D4", label: "Mint Cyan" },
  { hex: "#3B82F6", label: "Berry Blue" },
  { hex: "#8B5CF6", label: "Grape Violet" },
  { hex: "#EC4899", label: "Dragonfruit Rose" },
  { hex: "#78716C", label: "Stone Gray" },
];

export default function FriendManager({ friends, expenses, onAddFriend, onDeleteFriend }: FriendManagerProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[2].hex); // Warm Amber default
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please write name to add a friend.");
      return;
    }

    if (trimmedName.length > 25) {
      setError("Name is too long (maximum 25 characters).");
      return;
    }

    // Check if name is duplicate
    if (friends.some((f) => f.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError("A friend with this name already exists.");
      return;
    }

    onAddFriend(trimmedName, selectedColor);
    setName("");
    // Cycle color
    const currentIndex = COLOR_PRESETS.findIndex((c) => c.hex === selectedColor);
    const nextIndex = (currentIndex + 1) % COLOR_PRESETS.length;
    setSelectedColor(COLOR_PRESETS[nextIndex].hex);
  };

  // Helper to check if a friend is in any logged expenses
  const isFriendReferencedInExpenses = (friendId: string) => {
    return expenses.some(
      (expense) => expense.paidById === friendId || expense.participants?.includes(friendId)
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="friend-manager-root">
      {/* Add Friend Form Column */}
      <div className="md:col-span-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-xs self-start transition-colors">
        <h3 className="text-lg font-bold font-display text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-stone-600 dark:text-stone-400" />
          Add a Friend
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
              Friend Name
            </label>
            <input
              type="text"
              id="friend-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alice, Bob"
              className="w-full bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-2.5 outline-none focus:border-stone-400 dark:focus:border-stone-600 focus:bg-white dark:focus:bg-stone-950 text-sm transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
              Choose Avatar Theme Color
            </label>
            <div className="grid grid-cols-5 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => setSelectedColor(preset.hex)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform cursor-pointer relative ${
                    selectedColor === preset.hex
                      ? "border-stone-900 dark:border-stone-100 scale-110 shadow-sm"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: preset.hex }}
                  title={preset.label}
                >
                  {selectedColor === preset.hex && (
                    <span className="absolute inset-0 m-auto w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-rose-600 dark:text-rose-455 font-medium flex items-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            id="add-friend-submit-btn"
            className="w-full bg-stone-900 dark:bg-amber-500 hover:bg-stone-800 dark:hover:bg-amber-600 text-white dark:text-stone-950 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add to Group
          </button>
        </form>
      </div>

      {/* Friends List Column */}
      <div className="md:col-span-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-xs transition-colors">
        <h3 className="text-lg font-bold font-display text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          Group Members ({friends.length})
        </h3>

        {friends.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-stone-100 dark:border-stone-800 rounded-xl space-y-2 transition-colors">
            <Users className="w-10 h-10 text-stone-300 dark:text-stone-700 mx-auto" />
            <p className="text-stone-500 dark:text-stone-400 text-sm">Your dining group is currently empty.</p>
            <p className="text-xs text-stone-400 dark:text-stone-500">Add friends on the left to start dining together!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="friends-list-grid">
            <AnimatePresence>
              {friends.map((friend) => {
                const isLocked = isFriendReferencedInExpenses(friend.id);

                return (
                  <motion.div
                    key={friend.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-between p-3.5 border border-stone-200 dark:border-stone-800 rounded-xl hover:border-stone-300 dark:hover:border-stone-700 transition-colors bg-stone-50/50 dark:bg-stone-950/20"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-xs animate-pulse"
                        style={{ backgroundColor: friend.color }}
                      >
                        {friend.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-stone-800 dark:text-stone-200 text-sm">{friend.name}</p>
                        <p className="text-xs text-stone-400 dark:text-stone-500">
                          {isLocked ? "Meals active" : "No meals logged"}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteFriend(friend.id)}
                      disabled={isLocked}
                      className={`p-2 rounded-lg transition-colors ${
                        isLocked
                          ? "text-stone-300 dark:text-stone-700 cursor-not-allowed"
                          : "text-stone-400 dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                      }`}
                      title={
                        isLocked
                          ? "This friend is part of logged expenses and cannot be deleted unless the expenses are deleted."
                          : "Delete Friend"
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
