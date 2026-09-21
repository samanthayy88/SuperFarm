"use client";

import { Select } from "./ui";
import { Variety } from "@/lib/types";

/**
 * Variety picker scoped to one crop, backed by Settings → Crop & Variety.
 * If the current value doesn't match a registered variety (e.g. it was
 * typed before this list existed), it's kept as an extra option instead of
 * silently discarded — nothing changes until the user picks a new one.
 */
export default function VarietySelect({
  cropId,
  varieties,
  value,
  onChange,
  anyLabel = "Any variety",
  ariaLabel,
}: {
  /** Scopes options to one crop's varieties; omit (or "") to list every variety, e.g. in an "all crops" filter. */
  cropId?: string;
  varieties: Variety[];
  value: string;
  onChange: (v: string) => void;
  anyLabel?: string;
  ariaLabel?: string;
}) {
  const options = varieties.filter((v) => !cropId || v.cropId === cropId);
  const hasCurrent = !value || options.some((v) => v.name === value);

  return (
    <Select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{anyLabel}</option>
      {!hasCurrent && <option value={value}>{value} (not in list)</option>}
      {options.map((v) => (
        <option key={v.id} value={v.name}>
          {v.name}
        </option>
      ))}
    </Select>
  );
}
