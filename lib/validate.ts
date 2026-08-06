export interface LeadInput {
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface ValidateResult {
  ok: boolean;
  errors: string[];
  value: LeadInput;
}

/** Só dígitos — descarta `+`, espaços, `()` e `-` do telefone digitado. */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Telefone internacional em E.164 (só dígitos, sem `+`): DDI + número nacional.
 * 10–15 dígitos cobre BR (12–13), ES (11), PT (12), US (11) e a maioria dos DDIs.
 */
export function isValidPhone(phone: string): boolean {
  return /^\d{10,15}$/.test(phone);
}

export function validateLeadInput(body: unknown): ValidateResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const phone = normalizePhone(typeof b.phone === "string" ? b.phone : "");

  if (!email && !phone) errors.push("email ou phone é obrigatório");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    errors.push("email inválido");
  if (phone && !isValidPhone(phone)) errors.push("telefone inválido");

  return {
    ok: errors.length === 0,
    errors,
    value: { name: name || null, email: email || null, phone: phone || null },
  };
}
