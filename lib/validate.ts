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

export function validateLeadInput(body: unknown): ValidateResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";

  if (!email && !phone) errors.push("email ou phone é obrigatório");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    errors.push("email inválido");

  return {
    ok: errors.length === 0,
    errors,
    value: { name: name || null, email: email || null, phone: phone || null },
  };
}
