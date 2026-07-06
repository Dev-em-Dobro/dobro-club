"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";
const DEFAULT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB (FR-015)
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"]; // FR-015

// Chave usada para entregar o resultado à tela /ingresso/pronto na mesma sessão
// (FR-005 — magic link nunca vai pela URL).
export const RESULT_KEY = "dc_ingresso_result";

type PhotoState =
  | { kind: "avatar" }
  | { kind: "uploading"; preview: string }
  | { kind: "ready"; url: string; preview: string };

export default function IngressoForm({ slug = DEFAULT_SLUG }: { slug?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const ref = params.get("ref");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState<PhotoState>({ kind: "avatar" });
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const onPickPhoto = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setPhotoNote(null);

      if (!ACCEPTED.includes(file.type)) {
        setPhoto({ kind: "avatar" });
        setPhotoNote("Formato não aceito (use JPEG, PNG ou WebP). Seguimos com o avatar padrão.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setPhoto({ kind: "avatar" });
        setPhotoNote("Imagem acima de 5MB. Seguimos com o avatar padrão.");
        return;
      }

      const preview = URL.createObjectURL(file);
      setPhoto({ kind: "uploading", preview });

      // Upload não assinado direto do cliente → Cloudinary (best-effort).
      try {
        if (!CLOUD || !PRESET) throw new Error("cloudinary não configurado");
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", PRESET);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`,
          { method: "POST", body: fd },
        );
        if (!res.ok) throw new Error(`upload falhou (${res.status})`);
        const data = (await res.json()) as { secure_url?: string };
        if (!data.secure_url) throw new Error("resposta sem secure_url");
        setPhoto({ kind: "ready", url: data.secure_url, preview });
      } catch {
        setPhoto({ kind: "avatar" });
        setPhotoNote("Não deu para enviar sua foto agora. Seguimos com o avatar padrão.");
      }
    },
    [],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!consent) {
      setError("Você precisa aceitar para receber seu ingresso.");
      return;
    }
    if (!name.trim()) {
      setError("Conte seu nome para estampar no ingresso.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Informe e-mail ou telefone para receber o acesso.");
      return;
    }

    setSubmitting(true);
    try {
      const photoUrl = photo.kind === "ready" ? photo.url : undefined;
      const res = await fetch(`/api/e/${encodeURIComponent(slug)}/ingresso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          photoUrl,
          ref: ref || undefined,
          consent: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          (Array.isArray(data.errors) && data.errors.join(", ")) ||
            data.error ||
            "Não foi possível gerar seu ingresso. Tente de novo.",
        );
        setSubmitting(false);
        return;
      }
      sessionStorage.setItem(RESULT_KEY, JSON.stringify(data));
      router.push("/ingresso/pronto");
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  const previewSrc =
    photo.kind === "avatar" ? "/sprites/happy-mage.png" : photo.preview;

  return (
    <form className="ticket-form" onSubmit={onSubmit} noValidate>
      <div className="tf-photo">
        <div className="tf-avatar" data-uploading={photo.kind === "uploading"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="sprite" src={previewSrc} alt="Prévia do seu ingresso" />
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => onPickPhoto(e.target.files?.[0])}
        />
        <button
          type="button"
          className="tf-photo-btn"
          onClick={() => fileInput.current?.click()}
          disabled={photo.kind === "uploading"}
        >
          {photo.kind === "uploading"
            ? "Enviando…"
            : photo.kind === "ready"
              ? "Trocar foto"
              : "Escolher foto"}
        </button>
        {photoNote && <p className="tf-note">{photoNote}</p>}
      </div>

      <label className="tf-field">
        <span>Seu nome</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como aparece no ingresso"
          autoComplete="name"
          required
        />
      </label>

      <label className="tf-field">
        <span>E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
          autoComplete="email"
          inputMode="email"
        />
      </label>

      <label className="tf-field">
        <span>Telefone</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(11) 99999-8888"
          autoComplete="tel"
          inputMode="tel"
        />
      </label>

      <label className="tf-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          Aceito receber meu acesso e novidades do evento por e-mail/WhatsApp.
        </span>
      </label>

      {error && (
        <p className="tf-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn tf-submit" disabled={submitting}>
        {submitting ? "Gerando…" : "Gerar meu ingresso 🎟️"}
      </button>

      <p className="tf-recover">
        Já se inscreveu? <a href="/recuperar-ingresso">Recuperar meu ingresso</a>
      </p>
    </form>
  );
}
