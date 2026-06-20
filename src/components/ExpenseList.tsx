import React, { useState } from "react";
import { Friend, Expense } from "../types";
import { 
  Calendar, 
  Trash2, 
  FileText, 
  Flame, 
  CheckCircle,
  Clock, 
  ChevronsUpDown,
  Search,
  ChevronDown,
  ChevronUp,
  Tag,
  DollarSign,
  Edit
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ExpenseListProps {
  expenses: Expense[];
  friends: Friend[];
  onDeleteExpense: (id: string) => void;
  onEditExpense: (expense: Expense) => void;
}

export default function ExpenseList({ expenses, friends, onDeleteExpense, onEditExpense }: ExpenseListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const getFriendName = (id: string) => {
    return friends.find((f) => f.id === id)?.name || "Unknown Friend";
  };

  const getFriendColor = (id: string) => {
    return friends.find((f) => f.id === id)?.color || "#CBD5E1";
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter expenses based on text search (title, payer, or notes)
  const filteredExpenses = expenses.filter((expense) => {
    const titleMatch = expense.title.toLowerCase().includes(searchTerm.toLowerCase());
    const payerName = getFriendName(expense.paidById).toLowerCase();
    const payerMatch = payerName.includes(searchTerm.toLowerCase());
    const notesMatch = expense.notes?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    return titleMatch || payerMatch || notesMatch;
  });

  return (
    <div className="space-y-4" id="expense-list-root">
      
      {/* Header and Filter panel */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
        <h3 className="text-base font-bold font-display text-stone-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-stone-600" />
          Dining Ledger ({filteredExpenses.length} meals)
        </h3>

        <div className="relative flex-1 sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search restaurant, host..."
            className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-4 py-1.5 text-xs outline-none focus:bg-white focus:border-stone-400 text-stone-900 transition-colors"
          />
        </div>
      </div>

      {/* Render Ledger */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center space-y-3" id="empty-ledger-view">
          <Clock className="w-10 h-10 text-stone-300 mx-auto" />
          <p className="text-stone-500 text-sm font-medium">
            {expenses.length === 0 ? "No meals recorded for this period." : "No matching meals found."}
          </p>
          <p className="text-xs text-stone-400 max-w-xs mx-auto">
            {expenses.length === 0 
              ? "Change your period filter or log a new meal to see stats for this timeframe." 
              : "Try altering your search keywords or period filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3" id="ledger-cards-container">
          <AnimatePresence>
            {filteredExpenses.map((expense) => {
              const isExpanded = expandedId === expense.id;
              const splitShareAmount = expense.amount / (expense.participants?.length || 1);

              return (
                <motion.div
                  key={expense.id}
                  layout="position"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:border-stone-300 transition-colors"
                  id={`expense-card-${expense.id}`}
                >
                  {/* Card visible summary bar */}
                  <div
                    onClick={() => toggleExpand(expense.id)}
                    className="p-4 md:p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Avatar of Payer */}
                      <div
                        className="w-10 h-10 rounded-xl flex flex-col items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm"
                        style={{ backgroundColor: getFriendColor(expense.paidById) }}
                      >
                        {getFriendName(expense.paidById).charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-bold text-stone-900 text-sm md:text-base leading-tight truncate">
                          {expense.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500 mt-1">
                          <span className="font-mono bg-stone-100 px-2 py-0.5 rounded text-[10px]">
                            {expense.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                            Paid by <strong className="text-stone-700">{getFriendName(expense.paidById)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-base md:text-lg font-bold font-mono text-stone-900">
                          RM{expense.amount.toFixed(2)}
                        </div>
                        {expense.estimatedCalories > 0 && (
                          <div className="text-[10px] text-orange-650 font-bold flex items-center gap-0.5 justify-end mt-0.5">
                            <Flame className="w-3 h-3 text-orange-500" />
                            {expense.estimatedCalories} kcal
                          </div>
                        )}
                      </div>

                      <div className="text-stone-400 hover:text-stone-700 transition-colors">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail box */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-stone-100 bg-stone-50/40"
                      >
                        <div className="p-5 space-y-5 text-xs text-stone-700">
                          
                          {/* Split layout block */}
                          <div className="bg-white border border-stone-200/60 rounded-xl p-4 space-y-3.5">
                            <div className="flex justify-between items-center pb-2 border-b border-stone-100 font-medium">
                              <span className="text-stone-500">Split Share Details</span>
                              <span className="text-stone-850 font-mono font-bold">
                                RM{splitShareAmount.toFixed(2)} each
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">
                                Eaten by ({expense.participants?.length || 0}):
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {expense.participants?.map((pId) => (
                                  <div
                                    key={pId}
                                    className="inline-flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-full px-2.5 py-1 text-[11px]"
                                  >
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: getFriendColor(pId) }}
                                    />
                                    <span className="font-medium text-stone-700">{getFriendName(pId)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Items and estimates */}
                          {expense.items && expense.items.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">
                                Dish Breakdown & Nutrition Analysis:
                              </span>
                              <div className="bg-white border border-stone-150 rounded-xl overflow-hidden divide-y divide-stone-100">
                                {expense.items.map((it) => (
                                  <div key={it.id} className="p-2.5 flex items-center justify-between text-xs">
                                    <span className="font-semibold text-stone-850">{it.name}</span>
                                    <div className="flex items-center gap-4 text-stone-500 font-mono">
                                      {it.estimatedCalories > 0 && (
                                        <span className="text-orange-700/90 font-bold flex items-center gap-0.5">
                                          <Flame className="w-3 h-3 text-orange-400 fill-orange-100" />
                                          {it.estimatedCalories} kcal
                                        </span>
                                      )}
                                      <span className="text-stone-700 font-bold">RM{it.price.toFixed(2)}</span>
                                    </div>
                                  </div>
                                ))}

                                {expense.estimatedCalories > 0 && (
                                  <div className="p-2.5 bg-orange-50/40 flex justify-between items-center font-bold text-stone-850">
                                    <span className="flex items-center gap-1 text-orange-800">
                                      <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-100 animate-pulse" />
                                      AI Estimated Calories (Portions Sum)
                                    </span>
                                    <span className="font-mono text-orange-850">{expense.estimatedCalories} kcal</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Render notes or receipt upload */}
                          {(expense.notes || expense.receiptImage) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {expense.notes && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">
                                    Notes
                                  </span>
                                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-600 leading-relaxed italic">
                                    "{expense.notes}"
                                  </div>
                                </div>
                              )}

                              {expense.receiptImage && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">
                                    Scanned Receipt Image
                                  </span>
                                  <div className="inline-block bg-white border border-stone-200 rounded-xl p-2 max-w-xs shadow-xs">
                                    <img
                                      src={expense.receiptImage}
                                      alt="Scanned Receipt Thumbnail"
                                      className="max-h-40 rounded-lg object-contain w-auto hover:scale-105 transition-transform duration-300"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Delete/Edit transaction row */}
                          <div className="flex justify-between items-center pt-2 border-t border-stone-100">
                            <span className="text-[10px] text-stone-400 font-mono">
                              ID: {expense.id.slice(0, 8)}...
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditExpense(expense);
                                }}
                                className="text-stone-500 hover:text-amber-600 font-bold flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                Edit Record
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this shared expense? Balances will be recalculated.")) {
                                    onDeleteExpense(expense.id);
                                  }
                                }}
                                className="text-stone-400 hover:text-rose-600 font-bold flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove Meal Record
                              </button>
                            </div>
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
