export async function fireInscriptionWebhook(event, lead, magicLink) {
  if (!event?.webhookUrl) return { sent: false, reason: 'no-url' };
  const payload = {
    type: 'lead.created',
    event: { id: event.id, slug: event.slug },
    lead: { id: lead.id, name: lead.name, email: lead.email, phone: lead.phone },
    magicLink
  };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(event.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      if (res.ok) return { sent: true };
    } catch {
      // retry once
    } finally {
      clearTimeout(timer);
    }
  }
  return { sent: false, reason: 'failed' };
}
