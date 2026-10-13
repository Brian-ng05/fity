"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Job } from "./useBodyScan";
import type { Product } from "./catalog";

export interface SizeAdviceResult {
  status: "matched" | "no_match" | "insufficient_measurements" | "error";
  candidates: string[];
  message: string;
  warning?: string;
  chart_name?: string;
}

export interface ScanContextValue {
  job: Job | null;
  setJob: (job: Job | null) => void;
  jobError: string;
  setJobError: (err: string) => void;
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

export function computeClientSizeAdvice(
  measurements: Record<string, number | null | undefined>,
  chart: Product["chart"]
): SizeAdviceResult {
  const isBottom = chart.garment === "bottom";
  const required = isBottom ? (["waist_cm", "hip_cm"] as const) : (["chest_cm", "waist_cm"] as const);

  if (isBottom && (measurements.hip_cm == null || measurements.hip_cm === undefined)) {
    return {
      status: "insufficient_measurements",
      candidates: [],
      chart_name: chart.name,
      message: "Chưa đủ dữ liệu để gợi ý (cần số đo vòng mông)",
      warning: "Webcam thân trên không đo được vòng mông. Hãy chụp toàn thân để có số đo này.",
    };
  }

  for (const dim of required) {
    if (measurements[dim] == null || measurements[dim] === undefined) {
      return {
        status: "insufficient_measurements",
        candidates: [],
        chart_name: chart.name,
        message: isBottom ? "Chưa đủ dữ liệu để gợi ý (cần số đo vòng mông)" : "Chưa đủ số đo để đối chiếu bảng size.",
      };
    }
  }

  const candidates: string[] = [];
  for (const row of chart.rows) {
    let fits = true;
    for (const dim of required) {
      const range = row[dim];
      const val = measurements[dim];
      if (range && val != null) {
        if (val < range.min || val > range.max) {
          fits = false;
          break;
        }
      }
    }
    if (fits) {
      candidates.push(row.size);
    }
  }

  return {
    status: candidates.length > 0 ? "matched" : "no_match",
    candidates,
    chart_name: chart.name,
    message:
      candidates.length > 0
        ? "Khớp các khoảng trong bảng đã chọn."
        : "Không có size nào khớp tất cả số đo của bạn trong bảng.",
    warning:
      "Số đo từ ảnh chưa được kiểm chứng; đây là gợi ý tham khảo. Độ co giãn và độ rộng trang phục chưa được mô phỏng.",
  };
}

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [job, setJobState] = useState<Job | null>(null);
  const [jobError, setJobError] = useState<string>("");
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

  // Shared job polling: Maintain active job polling in ScanContext across modal open/close
  useEffect(() => {
    if (!job || !["queued", "processing"].includes(job.status)) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;

    async function poll() {
      try {
        const r = await fetch(`/api/scans/${job!.id}`);
        if (r.status === 404) {
          if (alive) {
            setJobState(null);
            setAdviceCache({});
            setJobError("Phiên đã hết hạn hoặc máy chủ đã khởi động lại. Vui lòng quét lại.");
          }
          return;
        }
        if (!r.ok) throw new Error("Không đọc được trạng thái scan.");
        const data: Job = await r.json();
        if (!alive) return;
        failures = 0;
        setJobState(data);
        if (data.status === "failed") {
          setJobError(data.error || "Chưa dựng được hình. Hãy thử ảnh khác.");
        } else if (data.status === "completed") {
          setJobError("");
        }
        if (["queued", "processing"].includes(data.status)) {
          timer = setTimeout(poll, 1200);
        }
      } catch {
        if (!alive) return;
        failures += 1;
        if (failures < 5) {
          timer = setTimeout(poll, 2000);
        } else {
          setJobError("Mất kết nối backend. Kết quả có thể vẫn đang xử lý; kiểm tra backend rồi thử lại.");
        }
      }
    }

    timer = setTimeout(poll, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [job?.id, job?.status]);

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
    setJobError("");
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

      // Composite cache key
      const cacheKey = `${activeJob.id}:${product.id}:${product.chart.name}:${product.chart.rows.length}`;
      if (adviceCache[cacheKey]) {
        return adviceCache[cacheKey];
      }

      try {
        const res = await fetch(`/api/scans/${activeJob.id}/size-advice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(product.chart),
        });

        if (res.status === 404) {
          setJobState(null);
          setAdviceCache({});
          const expiredMsg = "Phiên đã hết hạn hoặc máy chủ đã khởi động lại. Vui lòng quét lại.";
          setJobError(expiredMsg);
          throw new Error(expiredMsg);
        }

        if (res.ok) {
          const data = (await res.json()) as SizeAdviceResult;
          if (
            data.status === "insufficient_measurements" &&
            (product.chart.garment === "bottom" || activeJob.measurements?.hip_cm == null)
          ) {
            data.message = "Chưa đủ dữ liệu để gợi ý (cần số đo vòng mông)";
          }
          setAdviceCache((prev) => ({ ...prev, [cacheKey]: data }));
          return data;
        }

        let detailMsg = "Không thể lấy gợi ý size từ máy chủ.";
        try {
          const errData = await res.json();
          if (errData?.detail && typeof errData.detail === "string") {
            detailMsg = errData.detail;
          }
        } catch {}
        throw new Error(detailMsg);
      } catch (err) {
        if (err instanceof Error && err.message === "Phiên đã hết hạn hoặc máy chủ đã khởi động lại. Vui lòng quét lại.") {
          throw err;
        }
        throw new Error("Lỗi kết nối máy chủ khi đối chiếu size. Vui lòng thử lại.");
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
        jobError,
        setJobError,
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
