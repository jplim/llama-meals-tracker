import React from "react";
import { Friend, Expense } from "../types";
import { calculateBalances, getRecommendedPayer } from "../lib/calculations";
import { Users, DollarSign, Calendar, Flame, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface DashboardStatsProps {
  friends: Friend[];
  expenses: Expense[];
  onQuickPayClick?: (payer: Friend) => void;
}

export default function DashboardStats({ friends, expenses, onQuickPayClick }: DashboardStatsProps) {
  const balances = calculateBalances(friends, expenses);
  const recommendedPayer = getRecommendedPayer(friends, expenses);

  const totalSpend = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCaloriesVal = expenses.reduce((sum, e) => sum + (e.estimatedCalories || 0), 0);

  // Group balances for color indicators
  const highestLender = [...balances].sort((a, b) => b.netBalance - a.netBalance)[0];
  const highestBorrower = [...balances].sort((a, b) => a.netBalance - b.netBalance)[0];

  return (
    <div className="space-y-6" id="dashboard-stats-root">
      {/* Next Payer Recommendation Hero Card */}
      {friends.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-stone-900 text-stone-100 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden"
          id="next-payer-card"
        >
          {/* Subtle background glow */}
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-amber-500 rounded-full blur-3xl opacity-20" />
          <div className="absolute -left-12 -top-12 w-48 h-48 bg-emerald-500 rounded-full blur-3xl opacity-10" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold font-display">
                Fairness Smart Recommendation
              </span>
              {recommendedPayer ? (
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-white flex items-center gap-3">
                    <span
                      className="inline-block w-4 h-4 rounded-full"
                      style={{ backgroundColor: recommendedPayer.color }}
                    />
                    {recommendedPayer.name} should pay next
                  </h3>
                  <p className="text-stone-300 text-sm mt-2 max-w-md">
                    Based on group balance algorithms, {recommendedPayer.name} is furthest in debt or has paid the least total. Having them cover the next meal maintains maximum group balance fairness.
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="text-2xl font-bold font-display text-white">Add expenses to get recommendations</h3>
                  <p className="text-stone-400 text-sm mt-1">
                    Once meals are recorded, the algorithm will dynamically tell you who should pay next.
                  </p>
                </div>
              )}
            </div>

            {recommendedPayer && onQuickPayClick && (
              <button
                id="quick-pay-btn"
                onClick={() => onQuickPayClick(recommendedPayer)}
                className="bg-white hover:bg-stone-105 active:scale-95 text-stone-900 font-semibold px-5 py-3 rounded-2xl text-sm transition-all duration-200 shadow-md flex items-center gap-2 shrink-0 self-start md:self-center cursor-pointer"
              >
                <DollarSign className="w-4 h-4 text-amber-500 animate-bounce" />
                Log a meal for {recommendedPayer.name}
              </button>
            )}
          </div>
        </motion.div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 p-6 rounded-2xl border border-amber-200 dark:border-amber-900/40 flex gap-3 shadow-xs" id="no-friends-warning">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <h4 className="font-semibold text-sm">No friends added yet</h4>
            <p className="text-xs text-amber-800 dark:text-amber-400/80 mt-1">
              Add friends in the <strong>Friends</strong> tab first so the app can start tracking shared balances and calculating who pays next.
            </p>
          </div>
        </div>
      )}

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="stats-grid">
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 shadow-xs space-y-2 transition-colors" id="stat-total-group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Group Spend To Date</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold font-mono text-stone-900 dark:text-stone-100 break-words">
              RM{totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Accumulated across {expenses.length} meals</p>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 shadow-xs space-y-2 transition-colors" id="stat-meals-logged">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Meals Logged</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold font-mono text-stone-900 dark:text-stone-100">{expenses.length}</div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Shared food gatherings logged</p>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 shadow-xs space-y-2 transition-colors" id="stat-calories">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Estimated Portions</span>
            <div className="p-2 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 rounded-xl">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold font-mono text-stone-900 dark:text-stone-100">
              {totalCaloriesVal.toLocaleString()} <span className="text-sm font-sans font-medium text-stone-500 dark:text-stone-400">kcal</span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">AI-estimated total caloric intake</p>
          </div>
        </div>
      </div>

      {/* Comparative Balance Visualizer */}
      {friends.length > 0 && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-xs transition-colors" id="balance-visualizer-container">
          <h3 className="text-lg font-bold font-display tracking-tight text-stone-900 dark:text-stone-50 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-stone-600 dark:text-stone-400" />
            Friend Balances & Ledger Overview
          </h3>

          <div className="space-y-4">
            {balances.map((item) => {
              const isLender = item.netBalance >= 0;
              // Find coordinates for building relative horizontal comparative visual bars
              const maxAbsBalance = Math.max(...balances.map(b => Math.abs(b.netBalance)), 1);
              const barPercent = Math.min((Math.abs(item.netBalance) / maxAbsBalance) * 100, 100);

              return (
                <div key={item.friend.id} className="space-y-2" id={`balance-item-${item.friend.id}`}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full shadow-inner animate-pulse"
                        style={{ backgroundColor: item.friend.color }}
                      />
                      <span className="font-semibold text-stone-800 dark:text-stone-200">{item.friend.name}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                        Spent: RM{item.totalSpent.toFixed(2)}
                      </span>
                      <span
                        className={`font-mono font-bold text-xs px-2.5 py-1 rounded-full transition-colors ${
                          item.netBalance > 0
                            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40"
                            : item.netBalance < 0
                            ? "bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40"
                            : "bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-100 dark:border-stone-800"
                        }`}
                      >
                        {item.netBalance > 0 ? "+" : ""}
                        RM{item.netBalance.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Aesthetic clean dual-direction balance bar */}
                  <div className="w-full bg-stone-100 dark:bg-stone-800 h-2.5 rounded-full overflow-hidden flex relative transition-colors">
                    {/* Visual center point marker */}
                    <div className="absolute left-1/2 top-0 h-full w-0.5 bg-stone-300 dark:bg-stone-700 z-10" />

                    {isLender ? (
                      <div className="w-1/2 h-full flex justify-start pl-[50%]">
                        <div
                          className="h-full bg-emerald-500 rounded-r-full transition-all duration-500 origin-left"
                          style={{ width: `${barPercent / 2}%` }}
                        />
                      </div>
                    ) : (
                      <div className="w-1/2 h-full flex justify-end pr-[50%] ml-auto">
                        <div
                          className="h-full bg-rose-500 rounded-l-full transition-all duration-500 origin-right"
                          style={{ width: `${barPercent / 2}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row gap-2 justify-between text-xs text-stone-500 dark:text-stone-400 transition-colors">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Positive Balance (+): Lent more money than eaten</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Negative Balance (-): Owe money (Cover next meal!)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
