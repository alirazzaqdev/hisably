from app.catalog.industry_profiles import resolve_enabled_fields


def test_fixture_cases(industry_profile_fixtures):
    """Cross-validated against packages/shared/test-fixtures/industry-profile-cases.json
    so the TS (offline frontend) and Python (backend) resolvers agree."""
    for case in industry_profile_fixtures["cases"]:
        resolved = resolve_enabled_fields(case["industry_profile"], case["overrides"])
        enabled = sorted(field_id for field_id, value in resolved.items() if value)

        assert enabled == sorted(case["expected_enabled"]), case["name"]


def test_general_profile_has_no_fields_enabled():
    resolved = resolve_enabled_fields("general", {})
    assert all(value is False for value in resolved.values())
