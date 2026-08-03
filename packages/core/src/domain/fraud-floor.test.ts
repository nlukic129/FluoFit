import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertFraudFloor,
  canEarnAnotherScan,
  FraudFloorError,
  maxEarningScans,
} from "./fraud-floor.ts";
import { scanDateLocal, clampScanTimestamp } from "./streak.ts";

test("supply = 28 × activated Boxes", () => {
  assert.equal(maxEarningScans(0), 0);
  assert.equal(maxEarningScans(1), 28);
  assert.equal(maxEarningScans(3), 84);
});

test("can earn until supply is exhausted", () => {
  assert.equal(canEarnAnotherScan(27, 1), true); // 28th scan on one Box is allowed
  assert.equal(canEarnAnotherScan(28, 1), false); // 29th is not
});

test("assertFraudFloor throws only above the ceiling", () => {
  assert.doesNotThrow(() => assertFraudFloor(28, 1));
  assert.throws(() => assertFraudFloor(29, 1), FraudFloorError);
});

test("scan_date_local uses the account timezone, not UTC", () => {
  // 2026-01-01T23:30Z is already 2026-01-02 in Belgrade (+01), but still 01-01 in UTC.
  const t = new Date("2026-01-01T23:30:00Z");
  assert.equal(scanDateLocal(t, "Europe/Belgrade"), "2026-01-02");
  assert.equal(scanDateLocal(t, "UTC"), "2026-01-01");
});

test("future scans are clamped to receipt time", () => {
  const received = new Date("2026-01-01T12:00:00Z");
  const future = new Date("2026-06-01T12:00:00Z");
  assert.equal(clampScanTimestamp(future, received).toISOString(), received.toISOString());
  const past = new Date("2025-12-01T12:00:00Z");
  assert.equal(clampScanTimestamp(past, received).toISOString(), past.toISOString());
});
