"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { Job } from "./useBodyScan";
import type { Product } from "./catalog";

export interface SizeAdviceResult {
  status: "matched" | "no_match" | "insufficient_measurements" | "error";
  candidates: string[];
  message: string;
  warning?: string;
  chart_name?: string;
}

interface ScanContextValue {
  job: Job | null;
  setJob: (job: Job | null) => void;
  adviceCache: Record<string, SizeAdviceResult>;
  fetchAdviceForProduct: (product: Product, currentJob?: Job | null) => Promise<SizeAdviceResult>;
  clearScanSession: () => Promise<void>;
  // Global modal helpers
  isScanModalOpen: boolean;
  activeScanProduct: Product | null;
  openScanModal: (product: Product) => void;
  closeScanModal: () => void;
  // Size applied directly to product from scan
  appliedSizes: Record<string, string>; // productId -> selected size
  applySizeToProduct: (productId: string, size: string) => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [job, setJobState] = useState<Job | null>(null);
  const [adviceCache, setAdviceCache] = useState<Record<string, SizeAdviceResult>>({});
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [activeScanProduct, setActiveScanProduct] = useState<Product | null>(null);
  const [appliedSizes, setAppliedSizes] = useState<Record<string, string>>({});

  const setJob = useCallback((newJob: Job | null) => {
    setJobState(newJob);
    if (!newJob) {
      // Clear dependent size advice if session ends or is reset
      setAdviceCache({});
    }
  }, []);

  const clearScanSession = useCallback(async () => {
    if (job?.id) {
      try {
        await fetch(`/api/scans/${job.id}`, { method: "DELETE" });
      } catch {
        // Backend cleanup
      }
    }
    setJobState(null);
    setAdviceCache({});
  }, [job?.id]);

  const fetchAdviceForProduct = useCallback(
    async (product: Product, currentJob?: Job | null): Promise<SizeAdviceResult> => {
      const activeJob = currentJob || job;
      if (!activeJob || activeJob.status !== "completed") {
        return {
          status: "error",
          candidates: [],
          message: "Chưa có dữ liệu scan hoàn chỉnh.",
        };
      }

      // Check cache first
      if (adviceCache[product.id]) {
        return adviceCache[product.id];
      }

      try {
        const res = await fetch(`/api/scans/${activeJob.id}/size-advice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(product.chart),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg = typeof data.detail === "string" ? data.detail : "Không thể đối chiếu bảng size.";
          const failResult: SizeAdviceResult = {
            status: "error",
            candidates: [],
            message: errMsg,
          };
          setAdviceCache((prev) => ({ ...prev, [product.id]: failResult }));
          return failResult;
        }

        const adviceResult = data as SizeAdviceResult;
        setAdviceCache((prev) => ({ ...prev, [product.id]: adviceResult }));
        return adviceResult;
      } catch (err: any) {
        const errResult: SizeAdviceResult = {
          status: "error",
          candidates: [],
          message: err?.message || "Không thể kết nối dịch vụ đối chiếu size.",
        };
        return errResult;
      }
    },
    [job, adviceCache]
  );

  const openScanModal = useCallback((product: Product) => {
    setActiveScanProduct(product);
    setIsScanModalOpen(true);
  }, []);

  const closeScanModal = useCallback(() => {
    setIsScanModalOpen(false);
  }, []);

  const applySizeToProduct = useCallback((productId: string, size: string) => {
    setAppliedSizes((prev) => ({ ...prev, [productId]: size }));
  }, []);

  return (
    <ScanContext.Provider
      value={{
        job,
        setJob,
        adviceCache,
        fetchAdviceForProduct,
        clearScanSession,
        isScanModalOpen,
        activeScanProduct,
        openScanModal,
        closeScanModal,
        appliedSizes,
        applySizeToProduct,
      }}
    >
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used within a ScanProvider");
  return ctx;
}
