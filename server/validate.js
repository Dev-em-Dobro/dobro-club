export function validateLeadInput(body) {
  const errors = [];
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';

  if (!email && !phone) errors.push('email ou phone é obrigatório');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('email inválido');

  return {
    ok: errors.length === 0,
    errors,
    value: { name: name || null, email: email || null, phone: phone || null }
  };
}
