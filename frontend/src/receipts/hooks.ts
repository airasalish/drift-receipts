import { useEffect, useState } from "react";
import { receiptsApi, type Budget, type Examples } from "./api";

// One budget fetch per page load, shared by every component that asks.
let budgetPromise: Promise<Budget | null> | null = null;

export function useBudget(): Budget | null {
  const [b, setB] = useState<Budget | null>(null);
  useEffect(() => {
    budgetPromise ??= receiptsApi.budget().catch(() => null);
    budgetPromise.then(setB);
  }, []);
  return b;
}

// Saved channels/stocks for default suggestions + autocomplete, fetched once.
let examplesPromise: Promise<Examples | null> | null = null;

export function useExamples(): Examples | null {
  const [e, setE] = useState<Examples | null>(null);
  useEffect(() => {
    examplesPromise ??= receiptsApi.examples().catch(() => null);
    examplesPromise.then(setE);
  }, []);
  return e;
}

// Names people type for the SEBI case stock, including common misspellings.
export const isSebiCaseStock = (q: string) => /sad+h?a?na|sadhana|crystal\s*business/i.test(q);
