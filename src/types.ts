export interface Friend {
  id: string;
  name: string;
  color: string; // Tailwind color class or hex, e.g. '#FF6B6B'
}

export interface MealItem {
  id: string;
  name: string;
  price: number;
  estimatedCalories: number; // estimated calories for this item
}

export interface Expense {
  id: string;
  title: string;
  date: string;
  paidById: string; // The friend ID who paid the bill
  amount: number;
  participants: string[]; // Friend IDs who shared the meal
  receiptImage?: string; // Base64 encoding or image url
  items: MealItem[];
  estimatedCalories: number; // Estimated total calories
  notes?: string;
}

export interface ReceiptScanResult {
  title: string;
  amount: number;
  date?: string;
  items: {
    name: string;
    price: number;
    estimatedCalories: number;
  }[];
  estimatedCalories: number;
  suggestedParticipants?: string[];
}
