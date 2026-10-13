"use client";
import {useState,useEffect,useRef} from "react";
import { detachManualJob, loadManualSession, saveManualSession } from "./manualSession";
type Health = { ready: boolean; engine: string; message: string; manual_ready?: boolean; measurement_engine?: string; manual_message?: string };
type Measurements = { height_cm?: number; chest_cm?: number; waist_cm?: number; hip_cm?: number; neck_cm?: number | null; head_cm?: number | null; thigh_cm?: number | null; calf_cm?: number | null; ankle_cm?: number | null; shoulder_width_cm?: number | null; arm_length_cm?: number | null; inseam_cm?: number | null };
export type MeasurementDetail = {key:string;label:string;value_cm:number|null;source:"user_input"|"user_input_unfitted"|"photo_estimate"|"photo_with_prior"|"template_model"|"unavailable";color:string;points_m:[number,number,number][]};
type BodyProfile = { capture_mode?:string; measurement_source?:"photos"|"manual"; measurement_details?:MeasurementDetail[]; fit_status?: string; max_fit_error_cm?: number; note?: string; sections?: {key:string;label:string;target_cm:number;model_cm:number;fit_error_cm:number;points_m:[number,number,number][]}[] };
export type Job = { id: string; status: "queued" | "processing" | "completed" | "failed"; stage: string; error?: string; model_url?: string; warnings?: string[]; measurements?: Measurements; body_profile?: BodyProfile; elapsed_seconds?: number };
type Slot = "front" | "side";
/** Values the manual form submits: the torso bands plus every supporting band.
 *  null means "left blank", which keeps that region on the model's own numbers. */
export type ManualInput = {
  height_cm: number; chest_cm: number; waist_cm: number; hip_cm: number | null;
  neck_cm: number | null; head_cm: number | null; thigh_cm: number | null;
  calf_cm: number | null; ankle_cm: number | null;
  shoulder_width_cm: number | null; arm_length_cm: number | null; inseam_cm: number | null;
};

export function useBodyScan(initialJob?: Job | null) {
  const [captureMode,setCaptureMode]=useState<"upper_body"|"full_body">("upper_body");
  const [front, setFront] = useState<File | null>(null);
  const [side, setSide] = useState<File | null>(null);
  const [height, setHeight] = useState("170");
  const [consent, setConsent] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [job, setJob] = useState<Job | null>(initialJob || null);
  const [submitting, setSubmitting] = useState(false);
  const [camera, setCamera] = useState<Slot | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [rotation, setRotation] = useState(false);
  const [showRings, setShowRings] = useState(true);
  const [reset, setReset] = useState(0);
  const [privacy, setPrivacy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pollRetry, setPollRetry] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const busy = submitting || job?.status === "queued" || job?.status === "processing";
  const complete = job?.status === "completed";

  async function checkHealth() {
    try { const r = await fetch("/api/health"); if (!r.ok) throw new Error(); setHealth(await r.json()); }
    catch { setHealth({ ready: false, engine: "offline", message: "Chưa kết nối backend. Chạy start-backend.ps1 rồi bấm Kiểm tra lại." }); }
  }
  useEffect(() => { void checkHealth(); }, []);
  useEffect(() => {
    if (!job || !["queued", "processing"].includes(job.status)) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    async function poll() {
      try {
        const r = await fetch(`/api/scans/${job!.id}`);
        if (r.status === 404) {
          if (alive) { setJob(null); setError("Phiên đã hết hạn hoặc máy chủ đã khởi động lại. Vui lòng quét lại."); }
          return;
        }
        if (!r.ok) throw new Error("Không đọc được trạng thái scan.");
        const data: Job = await r.json();
        if (!alive) return;
        failures = 0; setJob(data);
        if (data.status === "failed") setError(data.error || "Chưa dựng được hình. Hãy thử ảnh khác.");
        if (["queued", "processing"].includes(data.status)) timer = setTimeout(poll, 1200);
      } catch {
        if (!alive) return;
        failures += 1;
        if (failures < 5) timer = setTimeout(poll, 2000);
        else { setError("Mất kết nối backend. Kết quả có thể vẫn đang xử lý; kiểm tra backend rồi bấm Kiểm tra kết quả."); }
      }
    }
    timer = setTimeout(poll, 500);
    return () => { alive = false; clearTimeout(timer); };
  }, [job?.id, job?.status, pollRetry]);
  // A reload must not silently lose an avatar built from typed measurements. The service
  // drops a session after an hour, so re-attach to it while it is still alive; the typed
  // numbers stay saved either way, so the form can always rebuild in one click.
  useEffect(() => {
    if (initialJob) return;
    const saved = loadManualSession();
    if (!saved?.jobId) return;
    const expected = saved.jobId;
    let alive = true;
    fetch(`/api/scans/${expected}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Job | null) => {
        if (!alive) return;
        // The user may have reset or rebuilt while this was in flight; storage is the
        // source of truth, so a stale response must not put the old session back.
        if (loadManualSession()?.jobId !== expected) return;
        if (data?.status === "completed") setJob(data);
        else if (!data) detachManualJob();
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [initialJob]);

  function choose(slot: Slot, file: File | null) {
    if (file) {
      if (/\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type)) {
        setError("Ảnh HEIC (iPhone) chưa được hỗ trợ trực tiếp. Hãy xuất/chuyển đổi thành JPG hoặc vào Cài đặt > Camera > Định dạng chọn 'Tương thích nhất'.");
        return;
      }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
        setError("Hãy chọn ảnh JPG, PNG hoặc WebP, tối đa 10 MB.");
        return;
      }
    }
    setError(""); (slot === "front" ? setFront : setSide)(file);
  }
  async function scan(captured?: {front:File;side:File}) {
    const frontPhoto=captured?.front||front,sidePhoto=captured?.side||side;
    if (!frontPhoto || !sidePhoto || !consent) { setError("Chụp đủ hai góc và đồng ý xử lý ảnh trước khi tạo mô hình."); return; }
    if (!Number.isFinite(Number(height)) || Number(height) < 100 || Number(height) > 230) { setError("Chiều cao cần nằm trong khoảng 100–230 cm."); return; }
    setError(""); setSubmitting(true);
    try {
      if (job) {
        const deleted = await fetch(`/api/scans/${job.id}`, { method: "DELETE" });
        if (!deleted.ok && deleted.status !== 404) throw new Error("Chưa xóa được phiên cũ. Kiểm tra kết nối rồi thử lại.");
        setJob(null);
      }
      const body = new FormData(); body.append("front", frontPhoto); body.append("side", sidePhoto); body.append("height_cm", height); body.append("consent", "true");
      body.append("capture_mode",captureMode);
      const r = await fetch("/api/scans", { method: "POST", body });
      const data = await r.json();
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Không gửi được ảnh. Hãy kiểm tra dữ liệu và thử lại.");
      setJob(data); setRotation(false);
      // A photo session replaces the manual one; keep the typed numbers, drop the id.
      detachManualJob();
    } catch (e) { setError(e instanceof Error ? e.message : "Không kết nối được backend."); }
    finally { setSubmitting(false); }
  }
  async function scanManual(values: ManualInput, previousId?: string) {
    setError(""); setSubmitting(true);
    try {
      // The session being replaced may only exist in the shared context.
      const stale = previousId || job?.id;
      if (stale) {
        const deleted = await fetch(`/api/scans/${stale}`, { method: "DELETE" });
        if (!deleted.ok && deleted.status !== 404) throw new Error("Chưa xóa được phiên cũ. Kiểm tra kết nối rồi thử lại.");
        setJob(null);
      }
      const r = await fetch("/api/scans/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await r.json();
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Số đo chưa hợp lệ. Hãy kiểm tra lại từng ô.");
      // Keep the numbers even if the build later fails, so nothing typed is lost.
      saveManualSession(values);
      setJob(data); setRotation(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Không kết nối được backend."); }
    finally { setSubmitting(false); }
  }
  /**
   * Rebuild for an adjustment, without retiring the current session first.
   *
   * Two reasons: a refused payload must not leave the user with no model at all, and the
   * session on screen has to keep its GLB while the browser-side preview is being shown,
   * otherwise the viewer would have nothing to deform. The caller retires the old session
   * once the replacement has landed.
   */
  async function rebuildFromMeasurements(values: ManualInput) {
    setError(""); setSubmitting(true);
    try {
      const r = await fetch("/api/scans/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await r.json();
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Số đo chưa hợp lệ. Hãy kiểm tra lại từng ô.");
      saveManualSession(values);
      setJob(data); setRotation(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Không kết nối được backend."); }
    finally { setSubmitting(false); }
  }
  async function clear() {
    setDeleting(true);
    try {
      if (job) { const r = await fetch(`/api/scans/${job.id}`, { method: "DELETE" }); if (!r.ok && r.status !== 404) throw new Error(); }
      setJob(null); setFront(null); setSide(null); setConsent(false); setError(""); setReset(n => n + 1);
    } catch { setError("Chưa xóa được dữ liệu trên backend. Hãy kiểm tra kết nối rồi thử lại."); }
    finally { setDeleting(false); }
  }

  return {captureMode,setCaptureMode,front,side,height,setHeight,consent,setConsent,health,error,setError,job,setJob,camera,setCamera,wireframe,setWireframe,rotation,setRotation,showRings,setShowRings,reset,setReset,privacy,setPrivacy,deleting,setPollRetry,viewport,busy,complete,choose,scan,scanManual,rebuildFromMeasurements,clear,checkHealth};
}
