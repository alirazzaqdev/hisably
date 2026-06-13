"""Industry profile registry.

A data-driven catalog of optional invoice fields plus a set of named
presets that turn a curated subset of them on by default. Tenants pick a
preset (``industry_profile``) and may further toggle individual fields
(``enabled_fields`` overrides) and rename labels (``field_labels``).

This is a Python mirror of packages/shared/src/industry-profiles/index.ts —
keep the field ids, preset keys, and merge semantics identical between the
two.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FieldDefinition:
    id: str
    scope: str  # "header" | "line" | "module"
    label_en: str
    label_ar: str
    data_type: str  # "string" | "number" | "boolean" | "enum"
    enum_options: list[str] | None = None


@dataclass(frozen=True)
class IndustryPreset:
    key: str
    label_en: str
    label_ar: str
    description: str
    enabled_fields: list[str] = field(default_factory=list)


FIELD_CATALOG: list[FieldDefinition] = [
    # Header-scope fields
    FieldDefinition("header.lpo_no", "header", "LPO / PO No.", "رقم أمر الشراء", "string"),
    FieldDefinition("header.project_no", "header", "Project No.", "رقم المشروع", "string"),
    FieldDefinition("header.villa_no", "header", "Villa / Unit No.", "رقم الفيلا / الوحدة", "string"),
    FieldDefinition("header.site_address", "header", "Site / Delivery Address", "عنوان الموقع / التسليم", "string"),
    FieldDefinition("header.vehicle_plate", "header", "Vehicle Plate No.", "رقم لوحة المركبة", "string"),
    FieldDefinition("header.vehicle_make_model", "header", "Vehicle Make / Model", "نوع وموديل المركبة", "string"),
    FieldDefinition("header.both_party_trn", "header", "Show Both Parties' TRN", "إظهار الرقم الضريبي للطرفين", "boolean"),
    FieldDefinition("header.warranty_months", "header", "Warranty (months)", "الضمان (أشهر)", "number"),

    # Line-scope fields
    FieldDefinition("line.width_height_sqm", "line", "Width x Height (SQM)", "العرض × الارتفاع (متر مربع)", "boolean"),
    FieldDefinition("line.linear_meter", "line", "Linear Meter", "المتر الخطي", "boolean"),
    FieldDefinition("line.serial_imei", "line", "Serial / IMEI No.", "الرقم التسلسلي / IMEI", "string"),
    FieldDefinition("line.brand_model", "line", "Brand / Model", "العلامة التجارية / الموديل", "string"),
    FieldDefinition("line.capacity_kw", "line", "Capacity (kW)", "السعة (كيلوواط)", "number"),
    FieldDefinition("line.parts_labour_split", "line", "Parts vs Labour", "قطع غيار / أجرة", "enum", ["parts", "labour"]),
    FieldDefinition("line.hourly_rate", "line", "Hours x Rate", "الساعات × السعر", "boolean"),
    FieldDefinition("line.warranty_months", "line", "Warranty (months)", "الضمان (أشهر)", "number"),

    # Module-scope fields (toggle whole optional modules on/off)
    FieldDefinition("module.job_register", "module", "Job / Project Register", "سجل المشاريع", "boolean"),
]

INDUSTRY_PRESETS: list[IndustryPreset] = [
    IndustryPreset(
        key="general",
        label_en="General Retail / Shop",
        label_ar="تجارة عامة / محل",
        description="Simple quantity x rate invoicing. The default for every business.",
        enabled_fields=[],
    ),
    IndustryPreset(
        key="glass_aluminium",
        label_en="Glass & Aluminium / Fit-out Contracting",
        label_ar="زجاج وألمنيوم / تشطيبات",
        description="Area and linear-meter pricing, LPO/Villa references for contracting work.",
        enabled_fields=["header.lpo_no", "header.villa_no", "header.site_address", "line.width_height_sqm", "line.linear_meter", "line.brand_model", "module.job_register"],
    ),
    IndustryPreset(
        key="construction_civil",
        label_en="Construction / Civil",
        label_ar="إنشاءات / مدنية",
        description="BOQ-style items with area/linear units and parts vs labour split.",
        enabled_fields=["header.lpo_no", "header.project_no", "header.site_address", "line.width_height_sqm", "line.linear_meter", "line.parts_labour_split", "module.job_register"],
    ),
    IndustryPreset(
        key="solar_renewable",
        label_en="Solar / Renewable",
        label_ar="الطاقة الشمسية / المتجددة",
        description="System capacity, component lines and warranty for solar installs.",
        enabled_fields=["header.lpo_no", "header.project_no", "header.site_address", "header.warranty_months", "line.capacity_kw", "line.brand_model", "line.warranty_months", "module.job_register"],
    ),
    IndustryPreset(
        key="electronics_mobile",
        label_en="Electronics / Mobile Shop",
        label_ar="إلكترونيات / محل موبايلات",
        description="Serial/IMEI tracking, brand/model and warranty per line.",
        enabled_fields=["line.serial_imei", "line.brand_model", "line.warranty_months"],
    ),
    IndustryPreset(
        key="automotive_garage",
        label_en="Automotive / Garage",
        label_ar="السيارات / الورشة",
        description="Vehicle details with parts vs labour split and hourly billing.",
        enabled_fields=["header.vehicle_plate", "header.vehicle_make_model", "line.parts_labour_split", "line.hourly_rate", "module.job_register"],
    ),
    IndustryPreset(
        key="services_freelance",
        label_en="Services / Freelance",
        label_ar="خدمات / مستقل",
        description="Hourly or project-based billing for service businesses.",
        enabled_fields=["header.project_no", "line.hourly_rate"],
    ),
    IndustryPreset(
        key="custom",
        label_en="General / Custom",
        label_ar="عام / مخصص",
        description="Start minimal and enable any fields you need yourself.",
        enabled_fields=[],
    ),
]

_PRESETS_BY_KEY: dict[str, IndustryPreset] = {preset.key: preset for preset in INDUSTRY_PRESETS}


def resolve_enabled_fields(industry_profile: str, overrides: dict[str, bool] | None = None) -> dict[str, bool]:
    """Resolve the effective enabled/disabled state of every catalog field.

    Starts from the chosen preset's defaults, then applies the tenant's own
    overrides (a key present in ``overrides`` always wins, regardless of
    value). Unknown preset keys behave like "general" (no fields enabled).
    """
    overrides = overrides or {}
    preset = _PRESETS_BY_KEY.get(industry_profile)
    preset_enabled = set(preset.enabled_fields if preset else [])

    return {
        f.id: bool(overrides[f.id]) if f.id in overrides else f.id in preset_enabled
        for f in FIELD_CATALOG
    }
