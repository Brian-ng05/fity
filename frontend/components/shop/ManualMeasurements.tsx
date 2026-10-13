"use client";

import { Fragment, useState } from "react";
import { ArrowRight, LoaderCircle, PencilRuler, Ruler, ShieldCheck } from "lucide-react";
import type { ManualInput } from "../../lib/useBodyScan";

/** Every band the service accepts, in centimetre ranges matching its own bounds.
 *
 *  `fitted` records whether the avatar is really reshaped to the number. A band that
 *  is only recorded is still accepted and shown back to the user, and the result list
 *  says so, rather than pretending the 3D model measures it.
 */
export const MANUAL_FIELDS = [
  { key: "height_cm", label: "Chiều cao", hint: "Đo khi đứng thẳng, không mang giày.", min: 100, max: 230, required: true, placeholder: "170", group: "core" },
  { key: "chest_cm", label: "Vòng ngực", hint: "Vòng quanh ngực ở chỗ đầy nhất, thước nằm ngang.", min: 40, max: 220, required: true, placeholder: "92", group: "core" },
  { key: "waist_cm", label: "Vòng eo", hint: "Vòng nhỏ nhất quanh bụng, trên rốn một chút.", min: 35, max: 220, required: true, placeholder: "76", group: "core" },
  { key: "hip_cm", label: "Vòng mông", hint: "Vòng quanh chỗ rộng nhất của hông. Để trống nếu chưa đo.", min: 45, max: 250, required: false, placeholder: "96", group: "core" },
  { key: "neck_cm", label: "Vòng cổ", hint: "Vòng quanh giữa cổ, thước hơi chúc xuống phía trước.", min: 20, max: 70, required: false, placeholder: "35", group: "girth" },
  { key: "head_cm", label: "Vòng đầu", hint: "Vòng quanh đầu ngang trán và chỗ lồi nhất phía sau.", min: 35, max: 90, required: false, placeholder: "56", group: "girth" },
  { key: "thigh_cm", label: "Vòng đùi", hint: "Đo một bên, ngay dưới mông. Mô hình áp dụng cho cả hai chân.", min: 25, max: 110, required: false, placeholder: "55", group: "girth" },
  { key: "calf_cm", label: "Vòng bắp chân", hint: "Đo một bên, ở chỗ bắp chân to nhất.", min: 15, max: 80, required: false, placeholder: "36", group: "girth" },
  { key: "ankle_cm", label: "Vòng cổ chân", hint: "Đo một bên, ngay trên mắt cá.", min: 10, max: 50, required: false, placeholder: "22", group: "girth" },
  { key: "shoulder_width_cm", label: "Rộng vai", hint: "Khoảng cách hai mũi vai, đo phía sau lưng.", min: 25, max: 80, required: false, placeholder: "42", group: "recorded" },
  { key: "arm_length_cm", label: "Dài tay", hint: "Từ mũi vai tới hết cổ tay.", min: 40, max: 100, required: false, placeholder: "60", group: "recorded" },
  { key: "inseam_cm", label: "Dài trong chân", hint: "Từ đáy quần tới mắt cá trong.", min: 40, max: 130, required: false, placeholder: "80", group: "recorded" },
] as const;

const GROUPS = [
  { id: "core", title: "Số đo chính", note: "Chiều cao, vòng ngực và vòng eo là bắt buộc." },
  { id: "girth", title: "Vòng bổ sung", note: "Không bắt buộc · được dựng vào mô hình 3D." },
  { id: "recorded", title: "Số đo để đối chiếu", note: "Không bắt buộc · hiện trong danh sách kèm nhãn riêng, không dựng vào mô hình." },
] as const;

type FieldKey = (typeof MANUAL_FIELDS)[number]["key"];
export type ManualDraft = Record<FieldKey, string>;
export type ManualFieldErrors = Partial<Record<FieldKey, string>>;
type DraftSource = Partial<Record<FieldKey, number | null>>;

export const EMPTY_DRAFT: ManualDraft = {
  height_cm: "", chest_cm: "", waist_cm: "", hip_cm: "",
  neck_cm: "", head_cm: "", thigh_cm: "", calf_cm: "", ankle_cm: "",
  shoulder_width_cm: "", arm_length_cm: "", inseam_cm: "",
};

export function draftFromJob(measurements?: DraftSource): ManualDraft {
  const text = (value?: number | null) => (value == null ? "" : String(value));
  return Object.fromEntries(MANUAL_FIELDS.map((field) => [field.key, text(measurements?.[field.key])])) as ManualDraft;
}

/** Field-level rules, mirroring the backend's own bounds and required fields. */
export function validateManual(draft: ManualDraft): { values?: ManualInput; errors: ManualFieldErrors } {
  const errors: ManualFieldErrors = {};
  const values = {} as Record<FieldKey, number | null>;
  for (const field of MANUAL_FIELDS) {
    const raw = draft[field.key].trim().replace(",", ".");
    values[field.key] = null;
    if (!raw) {
      if (field.required) errors[field.key] = `Nhập ${field.label.toLowerCase()} để dựng mô hình.`;
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      errors[field.key] = "Số đo chỉ gồm chữ số, ví dụ 88 hoặc 88.5.";
      continue;
    }
    if (value < field.min || value > field.max) {
      errors[field.key] = `${field.label} cần trong khoảng ${field.min}–${field.max} cm.`;
      continue;
    }
    values[field.key] = value;
  }
  if (Object.keys(errors).length) return { errors };
  // Required bands are non-null by the loop above; a blank optional band stays null and
  // the service then keeps the model's own number for that region.
  return { errors, values: values as unknown as ManualInput };
}

export default function ManualMeasurements({
  initial = EMPTY_DRAFT,
  onSubmit,
  onCancel,
  submitting,
  error,
  ready,
  notReadyMessage,
}: {
  initial?: ManualDraft;
  onSubmit: (values: ManualInput) => void;
  onCancel?: () => void;
  submitting: boolean;
  error: string;
  ready: boolean;
  notReadyMessage?: string;
}) {
  const [draft, setDraft] = useState<ManualDraft>(initial);
  const [errors, setErrors] = useState<ManualFieldErrors>({});
  const [touched, setTouched] = useState(false);

  const update = (key: FieldKey, value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (touched) setErrors(validateManual(next).errors);
  };

  const submit = () => {
    setTouched(true);
    const result = validateManual(draft);
    setErrors(result.errors);
    if (result.values) onSubmit(result.values);
  };

  return (
    <section className="manual-entry" aria-label="Nhập số đo thủ công">
      <div className="scan-setup-title">
        <h2>Nhập số đo của bạn</h2>
        <span>Đơn vị: cm · Dùng thước dây</span>
      </div>

      <form
        className="manual-fields"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        {GROUPS.map((group) => (
          <Fragment key={group.id}>
            <h3 className="manual-group">
              {group.title}
              <small>{group.note}</small>
            </h3>
            {MANUAL_FIELDS.filter((field) => field.group === group.id).map((field) => (
              <label key={field.key} htmlFor={`manual-${field.key}`} className={field.required ? "" : "manual-optional"}>
                {field.label}
                {field.required ? <em aria-hidden="true"> *</em> : <small> (không bắt buộc)</small>}
                <div className="scan-height-input" data-invalid={Boolean(errors[field.key])}>
                  <input
                    id={`manual-${field.key}`}
                    type="number"
                    inputMode="decimal"
                    min={field.min}
                    max={field.max}
                    step=".1"
                    placeholder={field.placeholder}
                    value={draft[field.key]}
                    onChange={(e) => update(field.key, e.target.value)}
                    aria-invalid={Boolean(errors[field.key])}
                    aria-describedby={`manual-${field.key}-help`}
                  />
                  <span>cm</span>
                </div>
                <small id={`manual-${field.key}-help`} className={errors[field.key] ? "manual-error" : ""}>
                  {errors[field.key] || field.hint}
                </small>
              </label>
            ))}
          </Fragment>
        ))}
      </form>

      <div className="scan-preparation">
        <Ruler size={20} />
        <p>
          Đo sát người, thước không siết chặt và không chùng. Nhập số đo cơ thể của bạn, không phải số đo quần áo có sẵn.
          Càng nhiều vòng, mô hình càng sát bạn; phần để trống giữ nguyên theo mẫu 3D.
        </p>
      </div>

      {error && (
        <p className="fit-error" role="alert">
          {error}
        </p>
      )}

      {!ready && <p className="scan-service" role="status">{notReadyMessage || "Dịch vụ dựng hình từ số đo chưa kết nối."}</p>}

      <div className="manual-actions">
        <button className="shop-primary scan-start" type="button" onClick={submit} disabled={!ready || submitting}>
          {submitting ? <LoaderCircle size={18} className="spin" /> : <PencilRuler size={18} />}
          {submitting ? "Đang dựng mô hình…" : "Dựng mô hình từ số đo"}
          {!submitting && <ArrowRight size={18} />}
        </button>
        {onCancel && (
          <button className="shop-secondary" type="button" onClick={onCancel} disabled={submitting}>
            Hủy
          </button>
        )}
      </div>

      <p className="scan-estimate-note">
        Mọi vòng bạn nhập đều được khớp trên mẫu 3D: ngực, eo, mông, cổ, đầu, đùi, bắp chân và cổ chân. Vòng đùi/bắp
        chân/cổ chân áp dụng cho cả hai chân vì một lần đo không phân biệt trái với phải. Rộng vai, dài tay và dài
        trong chân chỉ được ghi lại để bạn đối chiếu, không dựng vào mô hình.
      </p>
      <div className="scan-privacy">
        <ShieldCheck size={16} />
        <p>Không gửi ảnh, không cần camera. Số đo được dùng để dựng mô hình trong phiên này và có thể xóa bất cứ lúc nào.</p>
      </div>
    </section>
  );
}
