import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveEnabledFields } from "./index.js";

interface FixtureCase {
  name: string;
  industry_profile: string;
  overrides: Record<string, boolean>;
  expected_enabled: string[];
}

const fixturesPath = fileURLToPath(
  new URL("../../test-fixtures/industry-profile-cases.json", import.meta.url)
);
const fixtures = JSON.parse(readFileSync(fixturesPath, "utf-8")) as {
  cases: FixtureCase[];
};

describe("industry profile resolver fixtures (cross-validated with apps/api)", () => {
  for (const { name, industry_profile, overrides, expected_enabled } of fixtures.cases) {
    it(name, () => {
      const resolved = resolveEnabledFields(industry_profile, overrides);
      const enabled = Object.entries(resolved)
        .filter(([, value]) => value)
        .map(([id]) => id);

      expect(enabled.sort()).toEqual([...expected_enabled].sort());
    });
  }
});
