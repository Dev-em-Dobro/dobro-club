import { describe, it, expect } from "vitest";
import { isValidPhone, normalizePhone, validateLeadInput } from "@/lib/validate";

describe("isValidPhone (E.164 só dígitos)", () => {
  it("aceita celular BR (13) e fixo BR (12)", () => {
    expect(isValidPhone("5511999999999")).toBe(true);
    expect(isValidPhone("551133334444")).toBe(true);
  });

  it("aceita DDI de outros países (ex.: Espanha 34)", () => {
    expect(isValidPhone("34687073411")).toBe(true);
  });

  it("rejeita curto demais ou longo demais", () => {
    expect(isValidPhone("5511999")).toBe(false);
    expect(isValidPhone("1234567890123456")).toBe(false);
  });
});

describe("validateLeadInput — telefone internacional", () => {
  it("normaliza e aceita número ES com +", () => {
    const r = validateLeadInput({ phone: "+34 687 073 411" });
    expect(r.ok).toBe(true);
    expect(r.value.phone).toBe("34687073411");
  });

  it("normalizePhone remove máscara", () => {
    expect(normalizePhone("+55 (11) 99999-8888")).toBe("5511999998888");
  });
});
