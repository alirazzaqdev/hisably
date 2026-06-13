/**
 * Industry profile registry: a data-driven catalog of optional invoice
 * fields plus a set of named presets that turn a curated subset of them on
 * by default. Tenants pick a preset (`industry_profile`) and may further
 * toggle individual fields (`enabled_fields` overrides) and rename labels
 * (`field_labels`). Resolution is pure data + pure functions so the same
 * logic can be mirrored in the backend (app/catalog/industry_profiles.py).
 */

export type FieldScope = "header" | "line" | "module";

export type FieldDataType = "string" | "number" | "boolean" | "enum";

export interface FieldDefinition {
  /** Namespaced id, e.g. "header.lpo_no" or "line.serial_imei". */
  id: string;
  scope: FieldScope;
  labelEn: string;
  labelAr: string;
  dataType: FieldDataType;
  /** Only present when dataType === "enum". */
  enumOptions?: string[];
}

export interface IndustryPreset {
  key: string;
  labelEn: string;
  labelAr: string;
  description: string;
  /** Field ids enabled by default for this preset. */
  enabledFields: string[];
}

export const FIELD_CATALOG: FieldDefinition[] = [
  // Header-scope fields
  { id: "header.lpo_no", scope: "header", labelEn: "LPO / PO No.", labelAr: "رقم أمر الشراء", dataType: "string" },
  { id: "header.project_no", scope: "header", labelEn: "Project No.", labelAr: "رقم المشروع", dataType: "string" },
  { id: "header.villa_no", scope: "header", labelEn: "Villa / Unit No.", labelAr: "رقم الفيلا / الوحدة", dataType: "string" },
  { id: "header.site_address", scope: "header", labelEn: "Site / Delivery Address", labelAr: "عنوان الموقع / التسليم", dataType: "string" },
  { id: "header.vehicle_plate", scope: "header", labelEn: "Vehicle Plate No.", labelAr: "رقم لوحة المركبة", dataType: "string" },
  { id: "header.vehicle_make_model", scope: "header", labelEn: "Vehicle Make / Model", labelAr: "نوع وموديل المركبة", dataType: "string" },
  { id: "header.both_party_trn", scope: "header", labelEn: "Show Both Parties' TRN", labelAr: "إظهار الرقم الضريبي للطرفين", dataType: "boolean" },
  { id: "header.warranty_months", scope: "header", labelEn: "Warranty (months)", labelAr: "الضمان (أشهر)", dataType: "number" },

  // Line-scope fields
  { id: "line.width_height_sqm", scope: "line", labelEn: "Width x Height (SQM)", labelAr: "العرض × الارتفاع (متر مربع)", dataType: "boolean" },
  { id: "line.linear_meter", scope: "line", labelEn: "Linear Meter", labelAr: "المتر الخطي", dataType: "boolean" },
  { id: "line.serial_imei", scope: "line", labelEn: "Serial / IMEI No.", labelAr: "الرقم التسلسلي / IMEI", dataType: "string" },
  { id: "line.brand_model", scope: "line", labelEn: "Brand / Model", labelAr: "العلامة التجارية / الموديل", dataType: "string" },
  { id: "line.capacity_kw", scope: "line", labelEn: "Capacity (kW)", labelAr: "السعة (كيلوواط)", dataType: "number" },
  { id: "line.parts_labour_split", scope: "line", labelEn: "Parts vs Labour", labelAr: "قطع غيار / أجرة", dataType: "enum", enumOptions: ["parts", "labour"] },
  { id: "line.hourly_rate", scope: "line", labelEn: "Hours x Rate", labelAr: "الساعات × السعر", dataType: "boolean" },
  { id: "line.warranty_months", scope: "line", labelEn: "Warranty (months)", labelAr: "الضمان (أشهر)", dataType: "number" },

  // Module-scope fields (toggle whole optional modules on/off)
  { id: "module.job_register", scope: "module", labelEn: "Job / Project Register", labelAr: "سجل المشاريع", dataType: "boolean" },
];

export const INDUSTRY_PRESETS: IndustryPreset[] = [
  {
    key: "general",
    labelEn: "General Retail / Shop",
    labelAr: "تجارة عامة / محل",
    description: "Simple quantity x rate invoicing. The default for every business.",
    enabledFields: [],
  },
  {
    key: "glass_aluminium",
    labelEn: "Glass & Aluminium / Fit-out Contracting",
    labelAr: "زجاج وألمنيوم / تشطيبات",
    description: "Area and linear-meter pricing, LPO/Villa references for contracting work.",
    enabledFields: ["header.lpo_no", "header.villa_no", "header.site_address", "line.width_height_sqm", "line.linear_meter", "line.brand_model", "module.job_register"],
  },
  {
    key: "construction_civil",
    labelEn: "Construction / Civil",
    labelAr: "إنشاءات / مدنية",
    description: "BOQ-style items with area/linear units and parts vs labour split.",
    enabledFields: ["header.lpo_no", "header.project_no", "header.site_address", "line.width_height_sqm", "line.linear_meter", "line.parts_labour_split", "module.job_register"],
  },
  {
    key: "solar_renewable",
    labelEn: "Solar / Renewable",
    labelAr: "الطاقة الشمسية / المتجددة",
    description: "System capacity, component lines and warranty for solar installs.",
    enabledFields: ["header.lpo_no", "header.project_no", "header.site_address", "header.warranty_months", "line.capacity_kw", "line.brand_model", "line.warranty_months", "module.job_register"],
  },
  {
    key: "electronics_mobile",
    labelEn: "Electronics / Mobile Shop",
    labelAr: "إلكترونيات / محل موبايلات",
    description: "Serial/IMEI tracking, brand/model and warranty per line.",
    enabledFields: ["line.serial_imei", "line.brand_model", "line.warranty_months"],
  },
  {
    key: "automotive_garage",
    labelEn: "Automotive / Garage",
    labelAr: "السيارات / الورشة",
    description: "Vehicle details with parts vs labour split and hourly billing.",
    enabledFields: ["header.vehicle_plate", "header.vehicle_make_model", "line.parts_labour_split", "line.hourly_rate", "module.job_register"],
  },
  {
    key: "services_freelance",
    labelEn: "Services / Freelance",
    labelAr: "خدمات / مستقل",
    description: "Hourly or project-based billing for service businesses.",
    enabledFields: ["header.project_no", "line.hourly_rate"],
  },
  {
    key: "custom",
    labelEn: "General / Custom",
    labelAr: "عام / مخصص",
    description: "Start minimal and enable any fields you need yourself.",
    enabledFields: [],
  },
];

const PRESETS_BY_KEY: Record<string, IndustryPreset> = Object.fromEntries(
  INDUSTRY_PRESETS.map((preset) => [preset.key, preset])
);

/**
 * Resolve the effective enabled/disabled state of every catalog field for a
 * tenant: start from the chosen preset's defaults, then apply the tenant's
 * own overrides (a key present in `overrides` always wins, regardless of
 * value). Unknown preset keys behave like "general" (no fields enabled).
 */
export function resolveEnabledFields(
  industryProfile: string,
  overrides: Record<string, boolean> = {}
): Record<string, boolean> {
  const preset = PRESETS_BY_KEY[industryProfile];
  const presetEnabled = new Set(preset?.enabledFields ?? []);

  const resolved: Record<string, boolean> = {};
  for (const field of FIELD_CATALOG) {
    resolved[field.id] = Object.prototype.hasOwnProperty.call(overrides, field.id)
      ? Boolean(overrides[field.id])
      : presetEnabled.has(field.id);
  }
  return resolved;
}
