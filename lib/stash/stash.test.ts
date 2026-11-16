import assert from "node:assert/strict";
import test from "node:test";
import { colorFamilyOf, isLowStock, describeStock, familiesFor, fromBase, normalizeCode, toBase, totalLengthCm, totalMassDg } from "./catalog.ts";

const empty = { full_units: 0, partial_units: 0, has_unknown_partials: false, loose_mass_dg: 0, loose_length_cm: 0, pieces: 0, reserved_total: 0, quantity_total: 0 };

test("units convert to exact integers and back in the user's unit", () => {
  assert.deepEqual(toBase(38, "g"), { measure: "mass", quantity: 380 });
  assert.deepEqual(toBase(850, "yd"), { measure: "length", quantity: 77724 });
  assert.deepEqual(toBase(1.5, "oz"), { measure: "mass", quantity: 425 });
  assert.equal(fromBase(77724, "length", "yd"), "850 yd");
  assert.equal(fromBase(380, "mass", "g"), "38 g");
  assert.equal(fromBase(3, "count", "unit", "skein"), "3 skeins");
});

test("no drift: repeated small deductions sum exactly", () => {
  let q = toBase(100, "g").quantity;
  for (let i = 0; i < 10; i++) q -= toBase(0.1, "g").quantity;
  assert.equal(q, 990);
  assert.equal(fromBase(q, "mass", "g"), "99 g");
});

test("stock descriptions never invent precision", () => {
  assert.equal(describeStock({ ...empty, full_units: 2, loose_mass_dg: 380 }, "skein"), "2 skeins + 38 g");
  assert.equal(describeStock({ ...empty, partial_units: 1, has_unknown_partials: true }, "ball"), "1 partial (amount unknown)");
  assert.equal(describeStock({ ...empty, loose_length_cm: 77724 }, "skein", { length: "yd" }), "850 yd");
  assert.equal(describeStock(empty), "None in stock");
});

test("totals only when every bucket is convertible", () => {
  assert.equal(totalLengthCm({ ...empty, full_units: 4 }, null), null, "unknown per-skein length → unknown total");
  assert.deepEqual(totalLengthCm({ ...empty, full_units: 4 }, 18288), { cm: 73152, exact: true });
  assert.deepEqual(totalLengthCm({ ...empty, full_units: 2, partial_units: 1 }, 18288), { cm: 36576, exact: false }, "partials make it a minimum");
  assert.deepEqual(totalMassDg({ ...empty, full_units: 2, loose_mass_dg: 380 }, 1000), { dg: 2380, exact: true });
});

test("colour codes stay strings; colour families are approximate", () => {
  assert.equal(normalizeCode(" 0310 "), "0310");
  assert.equal(normalizeCode("b5200"), "B5200");
  assert.equal(colorFamilyOf("#3b6fe0"), "blue");
  assert.equal(colorFamilyOf("#111111"), "black");
  assert.equal(colorFamilyOf("#f7f5ef"), "white");
  assert.equal(colorFamilyOf("#ec6fb4"), "pink");
  assert.ok(familiesFor(["#d63a3a", "#3b6fe0", "#4caf50"]).includes("multi"));
});

test("low stock counts whole units only", () => {
  assert.equal(isLowStock({ low_stock_threshold: 1, full_units: 1, partial_units: 0, reserved_units: 0 }), true);
  assert.equal(isLowStock({ low_stock_threshold: 1, full_units: 4, partial_units: 0, reserved_units: 3 }), true, "reserved units aren't available");
  assert.equal(isLowStock({ low_stock_threshold: 1, full_units: 3, partial_units: 0, reserved_units: 0 }), false);
  assert.equal(isLowStock({ low_stock_threshold: null, full_units: 0, partial_units: 0, reserved_units: 0 }), false);
});
