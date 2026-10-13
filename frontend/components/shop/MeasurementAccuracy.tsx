"use client";

import { AlertTriangle, Check, Ruler } from "lucide-react";
import type { Job } from "../../lib/useBodyScan";
import { COMPARISON_NOTE, SIGNIFICANT_CM, buildComparison } from "../../lib/measurementCompare";
import type { ReferenceSet } from "../../lib/measurementCompare";

const fmt = (value: number | null, unit: string) => {
  if (value == null) return "—";
  const shown = unit === "in" ? value / 2.54 : value;
  return shown.toFixed(1);
};

/**
 * Reference vs model, measured off the generated geometry.
 *
 * Every model number is re-measured from the exported avatar. Bands whose avatar is
 * shaped to a supplied number show the fit residual, which is why the note insists a
 * small difference is a hit target and not evidence about anyone's real body.
 */
export default function MeasurementAccuracy({
  job,
  reference,
  unit,
}: {
  job: Job;
  reference: ReferenceSet | null;
  unit: string;
}) {
  const rows = buildComparison(job, reference);
  const comparable = rows.filter((row) => row.diffCm != null);
  const flagged = comparable.filter((row) => row.significant);
  const maxDiff = comparable.reduce((peak, row) => Math.max(peak, row.diffCm ?? 0), 0);
  const fitStatus = job.body_profile?.fit_status;
  const fitError = job.body_profile?.max_fit_error_cm;

  return (
    <section className="scan-accuracy" aria-label="Đối chiếu số đo gốc với mô hình 3D">
      <div className="scan-panel-head">
        <h3>
          <Ruler size={16} /> Đối chiếu với mô hình 3D
        </h3>
        <span>{comparable.length} số đo so được</span>
      </div>

      {!reference ? (
        <p className="scan-panel-note">
          Chưa có số đo gốc cho phiên này nên chưa đối chiếu được. Số gốc là số đo phiên được dựng lần đầu; khi bạn
          chỉnh mô hình, số gốc được giữ nguyên để so sánh.
        </p>
      ) : rows.length === 0 ? (
        <p className="scan-panel-note">Chưa có số đo nào để đối chiếu.</p>
      ) : (
        <>
          <div className="accuracy-table" role="table" aria-label="Bảng sai lệch">
            <div className="accuracy-row accuracy-head" role="row">
              <span role="columnheader">Số đo</span>
              <span role="columnheader">Gốc</span>
              <span role="columnheader">Mô hình 3D</span>
              <span role="columnheader">Lệch</span>
              <span role="columnheader">%</span>
            </div>
            {rows.map((row) => (
              <div
                className={`accuracy-row${row.significant ? " accuracy-row-flagged" : ""}${row.note ? " accuracy-row-partial" : ""}`}
                role="row"
                key={row.key}
              >
                <span role="cell">
                  {row.label}
                  <small>
                    {row.origin === "fitted_section" ? "khớp theo số nhập" : row.origin === "mesh_section" ? "đo từ mô hình, theo mẫu" : "—"}
                  </small>
                </span>
                <span role="cell">{fmt(row.referenceCm, unit)}</span>
                <span role="cell">{row.modelCm == null ? "không có" : fmt(row.modelCm, unit)}</span>
                <span role="cell">
                  {row.diffCm == null ? "—" : `${row.diffCm > 0 ? "" : ""}${fmt(row.diffCm, unit)}`}
                  {row.significant && <AlertTriangle size={13} />}
                </span>
                <span role="cell">
                  {row.percent == null ? "—" : `${row.percent.toFixed(1)}%`}
                </span>
              </div>
            ))}
          </div>

          <p className="scan-panel-foot">
            {comparable.length === 0 ? (
              "Chưa đối chiếu được số nào: chưa có cặp số gốc – mô hình hợp lệ."
            ) : flagged.length === 0 ? (
              <>
                <Check size={13} /> Mọi số so được đều lệch ≤ {SIGNIFICANT_CM} cm so với số gốc (mức lớn nhất{" "}
                {fmt(maxDiff, unit)} {unit}).
              </>
            ) : (
              <>
                <AlertTriangle size={13} /> {flagged.length} số lệch hơn {SIGNIFICANT_CM} cm so với số gốc:{" "}
                {flagged.map((row) => row.label).join(", ")}. Kéo các số này trong mục “Chỉnh số đo” nếu bạn muốn mô
                hình sát số gốc hơn.
              </>
            )}
          </p>

          <p className="scan-panel-foot">{COMPARISON_NOTE}</p>

          {fitError != null && (
            <p className="scan-panel-foot">
              Sai lệch khớp lớn nhất của phiên này: {fmt(fitError, unit)} {unit}
              {fitStatus ? ` · trạng thái: ${fitStatus === "matched" ? "khớp" : "gần đúng"}` : ""}.
            </p>
          )}

          {rows.some((row) => row.note === "no_reference") && (
            <p className="scan-panel-foot">
              Số chỉ có ở mô hình (không có số gốc) không tính được phần trăm — đó là phần mẫu 3D giữ nguyên.
            </p>
          )}
          {rows.some((row) => row.note === "not_in_model") && (
            <p className="scan-panel-foot">
              Số bạn nhập nhưng mô hình 3D không có (rộng vai, dài tay, dài trong chân) được ghi là “không có”, không
              bịa giá trị.
            </p>
          )}
        </>
      )}
    </section>
  );
}
