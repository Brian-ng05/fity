"""Range matching against an explicitly supplied BODY measurement chart."""
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator


class Range(BaseModel):
    model_config = ConfigDict(extra="forbid")
    min: float = Field(ge=10, le=250, allow_inf_nan=False)
    max: float = Field(ge=10, le=250, allow_inf_nan=False)

    @model_validator(mode="after")
    def ordered(self):
        if self.max < self.min:
            raise ValueError("Giới hạn trên cần lớn hơn hoặc bằng giới hạn dưới.")
        return self


class SizeRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    size: str = Field(min_length=1, max_length=20)
    chest_cm: Range | None = None
    waist_cm: Range | None = None
    hip_cm: Range | None = None


class SizeChart(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    garment: Literal["top", "bottom"]
    source: Literal["illustrative", "user_provided"]
    measurement_basis: Literal["body_cm"]
    rows: list[SizeRow] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def dimensions(self):
        required = ("chest_cm", "waist_cm") if self.garment == "top" else ("waist_cm", "hip_cm")
        if len({r.size.strip() for r in self.rows}) != len(self.rows) or any(not r.size.strip() for r in self.rows):
            raise ValueError("Tên size cần khác nhau và không để trống.")
        if any(getattr(r, key) is None for r in self.rows for key in required):
            raise ValueError("Áo cần ngực/eo; quần cần eo/mông. Nhập khoảng số đo cơ thể bằng cm.")
        return self


def recommend_size(measurements, chart: SizeChart):
    dimensions = ("chest_cm", "waist_cm") if chart.garment == "top" else ("waist_cm", "hip_cm")
    if any(measurements.get(k) is None for k in dimensions):
        return {"status": "insufficient_measurements", "candidates": [], "message": "Chưa đủ số đo để đối chiếu bảng size."}
    candidates, comparisons = [], []
    for row in chart.rows:
        checks = {key: {"value_cm": measurements[key], "min_cm": getattr(row, key).min, "max_cm": getattr(row, key).max,
                        "within": getattr(row, key).min <= measurements[key] <= getattr(row, key).max}
                  for key in ("chest_cm", "waist_cm", "hip_cm") if getattr(row, key) is not None}
        fits = all(c["within"] for c in checks.values())
        if fits:
            candidates.append(row.size)
        comparisons.append({"size": row.size, "fits": fits, "checks": checks})
    return {"status": "matched" if candidates else "no_match", "candidates": candidates,
            "chart_name": chart.name, "chart_source": chart.source, "comparisons": comparisons,
            "message": "Khớp các khoảng trong bảng đã chọn." if candidates else "Không size nào khớp tất cả số đo. Không tự chọn size gần nhất.",
            "warning": "Số đo từ ảnh chưa được kiểm chứng; đây là gợi ý tham khảo. Độ co giãn và độ rộng trang phục chưa được mô phỏng."}
