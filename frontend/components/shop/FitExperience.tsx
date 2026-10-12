"use client";
import { useEffect, useState, useCallback } from "react";
import { ArrowRight, Camera, Check, LoaderCircle, RotateCcw, ScanLine, ShieldCheck, Sun } from "lucide-react";
import { useBodyScan, type Job } from "../../lib/useBodyScan";
import { money, type Product } from "../../lib/catalog";
import { useScan, type SizeAdviceResult } from "../../lib/ScanContext";
import ScanResult from "./ScanResult";
import CaptureSession from "./CaptureSession";

export default function FitExperience({
  product,
  onSelectSize,
  active,
}: {
  product: Product;
  onSelectSize: (size: string) => void;
  active: boolean;
}) {
  const scanContext = useScan();
  const s = useBodyScan();
  const [capturing, setCapturing] = useState(false);
  const [advice, setAdvice] = useState<SizeAdviceResult | null>(null);
  const [adviceError, setAdviceError] = useState("");
  const [retry, setRetry] = useState(0);

  // Sync active job between local hook and shared ScanContext
  const currentJob: Job | null = s.job || scanContext.job;

  // Whenever local hook gets a completed job, store it in scanContext
  useEffect(() => {
    if (s.job && s.job.status === "completed") {
      scanContext.setJob(s.job);
    }
  }, [s.job, scanContext]);

  useEffect(() => {
    if (!active) setCapturing(false);
  }, [active]);

  // Query size advice whenever active job or product changes
  useEffect(() => {
    if (!currentJob || currentJob.status !== "completed") return;

    let aborted = false;
    setAdvice(null);
    setAdviceError("");

    scanContext
      .fetchAdviceForProduct(product, currentJob)
      .then((data) => {
        if (!aborted) {
          setAdvice(data);
        }
      })
      .catch((err) => {
        if (!aborted) {
          setAdviceError(err?.message || "Chưa đối chiếu được bảng size.");
        }
      });

    return () => {
      aborted = true;
    };
  }, [currentJob?.id, currentJob?.status, product.id, retry, scanContext, product]);

  const handleReset = useCallback(async () => {
    await s.clear();
    await scanContext.clearScanSession();
  }, [s, scanContext]);

  const renderProductContextBar = () => {
    if (!product) return null;
    return (
      <div className="fit-product-context" aria-label={`Sản phẩm đang chọn: ${product.name}`}>
        <div className="fit-product-thumb">
          <img src={product.image} alt={product.name} />
        </div>
        <div className="fit-product-meta">
          <span className="fit-product-category">{product.categoryName} · Tìm size phù hợp cho</span>
          <strong className="fit-product-name">{product.name}</strong>
        </div>
        <div className="fit-product-price">
          <span>{money(product.price)}</span>
        </div>
      </div>
    );
  };

  if (currentJob && currentJob.status === "completed") {
    return (
      <div className="fit-experience">
        {renderProductContextBar()}
        <ScanResult
          job={currentJob}
          active={active}
          onReset={handleReset}
          deleting={s.deleting}
          onSelectSize={onSelectSize}
          advice={advice}
          adviceError={adviceError}
          onRetry={() => setRetry((n) => n + 1)}
          error={s.error}
          product={product}
        />
      </div>
    );
  }

  if (capturing && active) {
    return (
      <div className="fit-experience">
        {renderProductContextBar()}
        <CaptureSession
          mode={s.captureMode}
          onCancel={() => setCapturing(false)}
          onComplete={(pair) => {
            setCapturing(false);
            s.choose("front", pair.front);
            s.choose("side", pair.side);
            void s.scan(pair);
          }}
        />
      </div>
    );
  }

  if (s.busy) {
    return (
      <div className="fit-experience">
        {renderProductContextBar()}
        <div className="scan-processing-screen" role="status">
          <div className="scan-processing-icon">
            <ScanLine size={42} />
            <LoaderCircle size={72} className="spin" />
          </div>
          <h2>Đang dựng hình thể của bạn</h2>
          <p>{s.job?.stage || "Đang gửi hai góc chụp…"}</p>
          <div>
            <span>
              <Check size={16} /> Chính diện
            </span>
            <span>
              <Check size={16} /> Góc nghiêng 90°
            </span>
          </div>
          <p className="scan-processing-note">
            Bạn đã có thể rời camera. Kết quả sẽ hiện ngay tại đây.
          </p>
          {s.error && (
            <div role="alert" style={{ marginTop: 16 }}>
              <p>{s.error}</p>
              <button
                className="shop-secondary"
                onClick={() => {
                  s.setError("");
                  s.setPollRetry((n) => n + 1);
                }}
              >
                Kiểm tra kết quả
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const validHeight =
    Number.isFinite(Number(s.height)) && Number(s.height) >= 100 && Number(s.height) <= 230;

  return (
    <div className="fit-experience">
      {renderProductContextBar()}
      <section className="scan-onboarding">
        <div className="scan-intro">
          <div className="scan-intro-icon">
            <ScanLine size={27} />
          </div>
          <h1>Tìm size từ hình thể của bạn.</h1>
          <p>
            Chỉ cần camera và chiều cao. MORPH tự chụp hai góc, dựng hình thể 3D và giúp bạn đối
            chiếu size cho <strong>{product.name}</strong>.
          </p>
        </div>
        <ol className="scan-journey">
          <li>
            <span>01</span>
            <div>
              <strong>Nhìn thẳng</strong>
              <p>Đếm ngược và tự chụp chính diện.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Xoay người 90°</strong>
              <p>Tự chuyển bước, đếm ngược lần nữa.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Xem hình thể & size</strong>
              <p>Nhận kết quả ngay khi xử lý xong.</p>
            </div>
          </li>
        </ol>
        <div className="scan-setup">
          <div className="scan-setup-title">
            <h2>Chuẩn bị trước khi quét</h2>
            <span>Hai góc · Một phiên camera</span>
          </div>
          <div className="scan-setup-fields">
            <label htmlFor="scan-height">
              Chiều cao của bạn
              <div className="scan-height-input">
                <input
                  id="scan-height"
                  type="number"
                  inputMode="decimal"
                  min="100"
                  max="230"
                  step=".1"
                  value={s.height}
                  onChange={(e) => s.setHeight(e.target.value)}
                  aria-invalid={!validHeight}
                />
                <span>cm</span>
              </div>
              {!validHeight && <small>Nhập chiều cao từ 100 đến 230 cm.</small>}
            </label>
            <label htmlFor="scan-framing">
              Khung chụp
              <select
                id="scan-framing"
                value={s.captureMode}
                onChange={(e) => s.setCaptureMode(e.target.value as "upper_body" | "full_body")}
              >
                <option value="upper_body">Webcam · từ đầu đến cạp quần</option>
                <option value="full_body">Camera · toàn thân</option>
              </select>
            </label>
          </div>
          <div className="scan-preparation">
            <Sun size={20} />
            <p>
              Mặc đồ ôm sát, đủ sáng, tay hơi tách thân.{" "}
              {s.captureMode === "upper_body"
                ? "Giữ đầu, vai, eo và cạp quần trong khung; không cần thấy chân."
                : "Giữ đủ đầu và bàn chân trong khung."}
            </p>
          </div>
          <label className="scan-camera-consent">
            <input
              type="checkbox"
              checked={s.consent}
              onChange={(e) => s.setConsent(e.target.checked)}
            />
            <span>
              Tôi đồng ý gửi khung hình và hai ảnh chụp tới máy chủ để hướng dẫn tư thế, ước lượng
              hình thể.
            </span>
          </label>
          <button
            className="shop-primary scan-start"
            disabled={!s.consent || !validHeight || !s.health?.ready || s.deleting}
            onClick={() => {
              s.setError("");
              setCapturing(true);
            }}
          >
            <Camera size={20} />
            Mở camera & bắt đầu
            <ArrowRight size={18} />
          </button>
          {!s.health?.ready && (
            <p className="scan-service" role="status">
              {s.health ? "Dịch vụ scan chưa kết nối." : "Đang kết nối dịch vụ scan…"}
              {s.health && (
                <button className="shop-inline" onClick={s.checkHealth}>
                  Thử kết nối lại
                </button>
              )}
            </p>
          )}
          {s.error && (
            <p className="fit-error" role="alert">
              {s.error}
            </p>
          )}
          <div className="scan-privacy">
            <ShieldCheck size={16} />
            <p>
              Không lưu hồ sơ ảnh. Upload camera có thể dùng file tạm; kết quả giữ tối đa một giờ và
              có thể xóa sớm.
            </p>
          </div>
        </div>
        <p className="scan-estimate-note">
          {s.captureMode === "upper_body"
            ? "Ngực/eo ước lượng từ ảnh và tỷ lệ mẫu theo chiều cao; phần mông/chân theo mẫu 3D."
            : "Ngực/eo/mông ước lượng từ hai góc chụp."}{" "}
          Chưa kiểm chứng độ chính xác trên người thật; không dùng cho may đo.
        </p>
      </section>
    </div>
  );
}
