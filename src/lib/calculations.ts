import { Friend, Expense } from "../types";

export interface FriendBalance {
  friend: Friend;
  totalSpent: number; // How much this person has paid out of pocket
  totalShare: number; // How much this person's split of meals came to
  netBalance: number; // totalSpent - totalShare (+ is lender, - is borrower)
}

/**
 * Calculates the total actual spend, share, and net balances for all friends.
 */
export function calculateBalances(friends: Friend[], expenses: Expense[]): FriendBalance[] {
  const balances: Record<string, { totalSpent: number; totalShare: number }> = {};

  // Initialize for all friends
  friends.forEach((f) => {
    balances[f.id] = { totalSpent: 0, totalShare: 0 };
  });

  // Calculate based on expenses
  expenses.forEach((expense) => {
    const payerId = expense.paidById;
    const amount = expense.amount;
    const participants = expense.participants || [];

    // Add to payer's total spent
    if (balances[payerId]) {
      balances[payerId].totalSpent += amount;
    }

    if (participants.length > 0) {
      const splitShare = amount / participants.length;
      participants.forEach((pId) => {
        if (balances[pId]) {
          balances[pId].totalShare += splitShare;
        }
      });
    }
  });

  return friends.map((friend) => {
    const data = balances[friend.id] || { totalSpent: 0, totalShare: 0 };
    return {
      friend,
      totalSpent: data.totalSpent,
      totalShare: data.totalShare,
      netBalance: data.totalSpent - data.totalShare,
    };
  });
}

/**
 * Determines who is recommended to pay next.
 * Primarily based on the most negative net balance (highest borrower).
 * Secondarily based on least actual spent if balances are equal/zero.
 */
export function getRecommendedPayer(friends: Friend[], expenses: Expense[]): Friend | null {
  if (friends.length === 0) return null;

  const balances = calculateBalances(friends, expenses);

  // Sort by netBalance ascending (most negative first)
  // If net balances are extremely close (e.g., zero), sort by totalSpent ascending (least spent first)
  const sorted = [...balances].sort((a, b) => {
    if (Math.abs(a.netBalance - b.netBalance) < 0.01) {
      return a.totalSpent - b.totalSpent;
    }
    return a.netBalance - b.netBalance;
  });

  return sorted[0]?.friend || null;
}
