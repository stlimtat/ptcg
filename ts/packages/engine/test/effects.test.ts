import { describe, it, expect } from "vitest";
import { executeEffect } from "../src/effects/interpreter";

describe("Effect interpreter", () => {
  it("executes dealDamage effect", () => {
    const effect = [{ op: "dealDamage", amount: 20, target: "defender" }];
    const result = executeEffect(effect, {
      currentDamage: 0,
      player: "p1",
      defender: "p2",
    });

    expect(result.currentDamage).toBe(20);
  });

  it("executes flipCoin effect with heads branch", () => {
    const rng = () => 0.5; // always heads
    const effect = [
      {
        op: "flipCoin",
        onHeads: [{ op: "dealDamage", amount: 50, target: "defender" }],
        onTails: [{ op: "dealDamage", amount: 0, target: "defender" }],
      },
    ];
    const result = executeEffect(effect, {
      currentDamage: 0,
      player: "p1",
      defender: "p2",
      rng,
    });

    expect(result.currentDamage).toBe(50);
  });

  it("chains multiple effects", () => {
    const effect = [
      { op: "dealDamage", amount: 30, target: "defender" },
      { op: "dealDamage", amount: 20, target: "defender" },
    ];
    const result = executeEffect(effect, {
      currentDamage: 0,
      player: "p1",
      defender: "p2",
    });

    expect(result.currentDamage).toBe(50);
  });
});
