"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { ingressoCopy } from "@/lib/copy/ingresso";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";
const DEFAULT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";
const DEFAULT_EVENT_NAME = "Semana do Zero ao Programador Contratado";
const WHATSAPP_GROUP =
  process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL || "https://chat.whatsapp.com/";

// Silêncio tolerado numa etapa antes do Mestre cutucar ("vamos continuar?").
const IDLE_NUDGE_MS = 60_000;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB (FR-015)
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"]; // FR-015
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Só dígitos; DDI+DD+número tem 12–13 dígitos (fixo/celular BR).
const onlyDigits = (v: string) => v.replace(/\D/g, "");
const isValidPhone = (v: string) => /^\d{12,13}$/.test(v);

// Etapas do fluxo conversacional (roteiro do RPG).
type Step =
  | "greet"
  | "prepared"
  | "askName"
  | "confirmName"
  | "askPhoto"
  | "uploadPhoto"
  | "askEmail"
  | "confirmEmail"
  | "askPhone"
  | "confirmPhone"
  | "generating"
  | "confirmTicket"
  | "done";

interface Msg {
  id: number;
  from: "bot" | "user";
  text?: string;
  imageUrl?: string;
  example?: boolean;
}

interface TicketResult {
  leadId: string;
  isNew: boolean;
  /** Ausente no evento `ticket-only`: lá não existe acesso a entregar. */
  magicLink?: string;
  ticket: {
    imageUrl: string;
    downloadUrl: string;
    qrValue: string;
    shareUrl: string;
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `ticketOnly` (evento pago): o fluxo termina no próprio ingresso — baixar e
 * compartilhar. Sem link de acesso, sem grupo de WhatsApp, sem recuperação.
 */
export default function IngressoChat({
  slug = DEFAULT_SLUG,
  eventName,
  ticketOnly = false,
}: {
  slug?: string;
  eventName?: string | null;
  ticketOnly?: boolean;
}) {
  const params = useSearchParams();
  const ref = params.get("ref");
  const event = eventName || DEFAULT_EVENT_NAME;
  const copy = useMemo(
    () => ingressoCopy({ eventName: event, ticketOnly }),
    [event, ticketOnly],
  );

  const [messages, setMessages] = useState<Msg[]>([]);
  const [step, setStep] = useState<Step>("greet");
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<TicketResult | null>(null);
  const [shared, setShared] = useState(false);

  const idRef = useRef(0);
  const mounted = useRef(true);
  const logRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  /** Etapas onde a cutucada de inatividade já foi dada (não repete). */
  const nudged = useRef(new Set<Step>());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const pushMsg = useCallback((m: Omit<Msg, "id">) => {
    setMessages((prev) => [...prev, { id: idRef.current++, ...m }]);
  }, []);

  // Fala do bot com "digitando…" para dar o tom de conversa (RPG).
  const botSay = useCallback(
    async (lines: Array<string | Omit<Msg, "id" | "from">>) => {
      for (const line of lines) {
        setTyping(true);
        await sleep(650);
        if (!mounted.current) return;
        setTyping(false);
        if (typeof line === "string") pushMsg({ from: "bot", text: line });
        else pushMsg({ from: "bot", ...line });
        await sleep(180);
      }
    },
    [pushMsg],
  );

  // Auto-scroll para a última mensagem.
  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  // Saudação inicial (uma vez).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void botSay(copy.greet);
  }, [botSay, copy]);

  // Cutucada de inatividade: a pessoa parou no meio do funil (roteiro do
  // lançamento clássico). Dispara UMA vez por etapa de espera, nunca no fim.
  useEffect(() => {
    if (typing || step === "generating" || step === "done") return;
    if (nudged.current.has(step)) return;

    const timer = setTimeout(() => {
      if (!mounted.current) return;
      nudged.current.add(step);
      void botSay(copy.idleNudge);
    }, IDLE_NUDGE_MS);

    return () => clearTimeout(timer);
  }, [step, typing, botSay, copy]);

  // ---- transições -------------------------------------------------------

  async function startFlow() {
    setStep("prepared");
    await botSay(copy.start);
  }

  async function goAskName() {
    setStep("askName");
    await botSay(copy.askName);
  }

  async function goConfirmName(value: string) {
    setStep("confirmName");
    await botSay(copy.confirmName(value));
  }

  async function goAskPhoto() {
    setStep("askPhoto");
    await botSay(copy.askPhoto);
  }

  async function goUploadPhoto() {
    setStep("uploadPhoto");
    await botSay([
      ...copy.uploadPhoto,
      { text: "Assim aqui 👇", imageUrl: "/sprites/happy-mage.png", example: true },
    ]);
  }

  async function goAskEmail() {
    setStep("askEmail");
    await botSay(copy.askEmail);
  }

  async function goConfirmEmail(value: string) {
    setStep("confirmEmail");
    await botSay(copy.confirmEmail(value));
  }

  async function goAskPhone() {
    setStep("askPhone");
    await botSay(copy.askPhone);
  }

  async function goConfirmPhone(value: string) {
    setStep("confirmPhone");
    await botSay(copy.confirmPhone(value));
  }

  /**
   * `reissue` = o participante disse que o ingresso saiu errado. A reemissão manda
   * a foto que sobrou da verificação (ou nenhuma) e o servidor regrava, mesmo o
   * lead já existindo — por isso não pode cair na fala de "você já tem ingresso".
   */
  async function generate(
    opts: { reissue?: boolean; photoUrl?: string | null } = {},
  ) {
    const reissue = opts.reissue === true;
    const photo = "photoUrl" in opts ? opts.photoUrl : photoUrl;

    setStep("generating");
    if (!reissue) await botSay(copy.generating);
    try {
      const res = await fetch(`/api/e/${encodeURIComponent(slug)}/ingresso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone || undefined,
          photoUrl: photo || undefined,
          ref: ref || undefined,
          reissue: reissue || undefined,
          consent: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as TicketResult & {
        error?: string;
        errors?: string[];
      };
      if (!res.ok) {
        await botSay([
          (Array.isArray(data.errors) && data.errors.join(", ")) ||
            data.error ||
            copy.genericError,
          copy.retryAfterError,
        ]);
        setStep("confirmEmail");
        return;
      }
      if (!mounted.current) return;
      setResult(data);

      // Quem já tinha ingresso (mesmo e-mail/telefone) não reconfirma nada: a vaga
      // já é dela — entrega o ingresso e vai direto pro fecho.
      if (!data.isNew && !reissue) {
        setStep("done");
        await botSay([
          { imageUrl: data.ticket.imageUrl },
          ...copy.alreadyHasTicket,
        ]);
        return;
      }

      setStep("confirmTicket");
      await botSay([{ imageUrl: data.ticket.imageUrl }, copy.askTicketOk]);
    } catch {
      await botSay([
        "Falha de conexão ao gerar o ingresso 😕",
        copy.retryAfterError,
      ]);
      setStep("confirmEmail");
    }
  }

  async function finish() {
    setStep("done");
    await botSay(copy.finish);
  }

  // ---- baixar / compartilhar (fim do fluxo ticket-only) ------------------

  function downloadTicket() {
    if (!result) return;
    // `downloadUrl` já responde como anexo (fl_attachment); o atributo `download`
    // cobre o fallback local, que é da mesma origem.
    const a = document.createElement("a");
    a.href = result.ticket.downloadUrl;
    a.download = "meu-ingresso.png";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /**
   * WhatsApp é o único canal com compartilhamento pré-preenchido pela web
   * (`wa.me?text=`): abre a conversa com a mensagem e o link já escritos. O link
   * leva ao gerador com `?ref=`, e o preview do WhatsApp mostra o ingresso —
   * a `og:image` da página é montada a partir do `ref` (ver a page do gerador).
   */
  function shareOnWhatsApp() {
    if (!result) return;
    const msg = `${shareText()}\n${result.ticket.shareUrl}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener",
    );
  }

  /**
   * O Instagram NÃO aceita post pré-preenchido pela web (não existe URL que abra
   * o app já com imagem/legenda — só o SDK nativo faz isso). O caminho possível é
   * o do próprio Instagram: a imagem no rolo da câmera e o post feito no app.
   * Então baixamos o ingresso e abrimos o Stories; no celular, a folha nativa do
   * botão "Compartilhar" também lista o Instagram já com a imagem anexada.
   */
  async function shareOnInstagram() {
    if (!result) return;
    // No mobile, o share nativo com arquivo entrega o ingresso direto ao app.
    const file = await ticketAsFile();
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ text: shareText(), files: [file] });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        // segue para o caminho baixar + abrir o app
      }
    }
    downloadTicket();
    await botSay([
      "Salvei seu ingresso na galeria 📲 Agora é só abrir o Instagram e postar nos Stories!",
    ]);
    window.open("https://www.instagram.com/", "_blank", "noopener");
  }

  function shareText(): string {
    return `Garanti meu ingresso pra ${event}! 🎟️`;
  }

  /** A imagem como File, quando o navegador aceita compartilhar arquivos (mobile). */
  async function ticketAsFile(): Promise<File | null> {
    if (!result) return null;
    try {
      const res = await fetch(result.ticket.imageUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new File([blob], "meu-ingresso.png", {
        type: blob.type || "image/png",
      });
    } catch {
      return null; // CORS/rede — cai no compartilhamento por link
    }
  }

  /** "Mais opções": folha nativa do sistema (Stories, Telegram, X…) ou copiar o link. */
  async function shareTicket() {
    if (!result) return;
    const text = shareText();
    const url = result.ticket.shareUrl;

    try {
      const file = await ticketAsFile();
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ text, files: [file] });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: event, text, url });
        return;
      }
    } catch (e) {
      // Cancelar a folha de compartilhamento não é erro — não vira "copiado".
      if ((e as Error).name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      await botSay([`Copie e compartilhe este link 👉 ${url}`]);
    }
  }

  /** A URL do ingresso (Cloudinary) renderiza mesmo? É o "verifica o Cloudinary". */
  function imageLoads(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  /**
   * "Não, saiu errado": o sistema verifica a imagem no Cloudinary e reemite sem
   * perguntar mais nada. Quando a imagem não carrega, o suspeito é o overlay da
   * foto (formato/URL que a transformação não aceita) — reemite com o avatar
   * padrão, que sempre renderiza, em vez de repetir o mesmo erro.
   */
  async function ticketProblem() {
    setStep("generating");
    await botSay(copy.ticketProblem);

    const rendered = result ? await imageLoads(result.ticket.imageUrl) : false;
    const dropPhoto = !rendered && !!photoUrl;

    if (dropPhoto) {
      setPhotoUrl(null);
      await botSay(copy.reissuedWithoutPhoto);
    }

    await generate({ reissue: true, photoUrl: dropPhoto ? null : photoUrl });
  }

  // ---- handlers de input ------------------------------------------------

  function onTextSubmit(e: FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value || typing) return;

    if (step === "greet") {
      pushMsg({ from: "user", text: value });
      setInput("");
      if (/^ingresso$/i.test(value)) void startFlow();
      else void botSay(["É só digitar INGRESSO pra gente começar 🎟️"]);
      return;
    }

    if (step === "askName") {
      if (value.split(/\s+/).length < 2) {
        pushMsg({ from: "user", text: value });
        setInput("");
        void botSay(copy.nameIncomplete);
        return;
      }
      pushMsg({ from: "user", text: value });
      setInput("");
      setName(value);
      void goConfirmName(value);
      return;
    }

    if (step === "askEmail") {
      if (!EMAIL_RE.test(value)) {
        pushMsg({ from: "user", text: value });
        setInput("");
        void botSay(copy.invalidEmail);
        return;
      }
      pushMsg({ from: "user", text: value });
      setInput("");
      setEmail(value);
      void goConfirmEmail(value);
      return;
    }

    if (step === "askPhone") {
      const digits = onlyDigits(value);
      if (!isValidPhone(digits)) {
        pushMsg({ from: "user", text: value });
        setInput("");
        void botSay(copy.invalidPhone);
        return;
      }
      pushMsg({ from: "user", text: digits });
      setInput("");
      setPhone(digits);
      void goConfirmPhone(digits);
      return;
    }
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      pushMsg({ from: "user", text: "📎 (foto)" });
      await botSay(copy.photoRejected);
      setPhotoUrl(null);
      void goAskEmail();
      return;
    }
    if (file.size > MAX_BYTES) {
      pushMsg({ from: "user", text: "📎 (foto)" });
      await botSay(copy.photoTooBig);
      setPhotoUrl(null);
      void goAskEmail();
      return;
    }

    const preview = URL.createObjectURL(file);
    pushMsg({ from: "user", imageUrl: preview });
    setUploading(true);
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
      if (!data.secure_url) throw new Error("sem secure_url");
      setPhotoUrl(data.secure_url);
    } catch {
      setPhotoUrl(null);
      await botSay(copy.photoFailed);
    } finally {
      if (mounted.current) setUploading(false);
    }
    void goAskEmail();
  }

  // ---- footer (entrada por etapa) ---------------------------------------

  function QuickReplies({
    options,
  }: {
    options: Array<{ label: string; onClick: () => void; variant?: "ghost" }>;
  }) {
    return (
      <div className="chat-quick">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            className={o.variant === "ghost" ? "quick-btn quick-btn--ghost" : "quick-btn"}
            onClick={o.onClick}
            disabled={typing}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  function renderFooter() {
    if (typing) return null;

    switch (step) {
      case "greet":
      case "askName":
      case "askEmail":
      case "askPhone":
        return (
          <form className="chat-input" onSubmit={onTextSubmit}>
            <input
              type={
                step === "askEmail" ? "email" : step === "askPhone" ? "tel" : "text"
              }
              inputMode={
                step === "askEmail"
                  ? "email"
                  : step === "askPhone"
                    ? "numeric"
                    : "text"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                step === "greet"
                  ? "Digite INGRESSO"
                  : step === "askName"
                    ? "Seu nome e sobrenome"
                    : step === "askPhone"
                      ? "5511999999999"
                      : "voce@exemplo.com"
              }
              autoComplete={
                step === "askEmail" ? "email" : step === "askPhone" ? "tel" : "off"
              }
              aria-label="Sua mensagem"
            />
            <button type="submit" className="chat-send" aria-label="Enviar">
              ➤
            </button>
          </form>
        );

      case "prepared":
        return <QuickReplies options={[{ label: "ESTOU PREPARADO 🚀", onClick: () => void goAskName() }]} />;

      case "confirmName":
        return (
          <QuickReplies
            options={[
              { label: "ESTÁ CERTO ✓", onClick: () => void goAskPhoto() },
              { label: "QUERO CORRIGIR", variant: "ghost", onClick: () => void goAskName() },
            ]}
          />
        );

      case "askPhoto":
        return (
          <QuickReplies
            options={[
              { label: "ENVIAR MINHA FOTO 📸", onClick: () => void goUploadPhoto() },
              {
                label: "MANTER AVATAR PADRÃO",
                variant: "ghost",
                onClick: () => {
                  setPhotoUrl(null);
                  void goAskEmail();
                },
              },
            ]}
          />
        );

      case "uploadPhoto":
        return (
          <div className="chat-quick">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => void onPickPhoto(e.target.files?.[0])}
            />
            <button
              type="button"
              className="quick-btn"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Enviando…" : "Escolher foto 📎"}
            </button>
            <button
              type="button"
              className="quick-btn quick-btn--ghost"
              onClick={() => {
                setPhotoUrl(null);
                void goAskEmail();
              }}
              disabled={uploading}
            >
              Continuar sem foto
            </button>
          </div>
        );

      case "confirmEmail":
        return (
          <QuickReplies
            options={[
              { label: "SIM ✓", onClick: () => void goAskPhone() },
              { label: "NÃO", variant: "ghost", onClick: () => void goAskEmail() },
            ]}
          />
        );

      case "confirmPhone":
        return (
          <QuickReplies
            options={[
              { label: "SIM ✓", onClick: () => void generate() },
              { label: "NÃO", variant: "ghost", onClick: () => void goAskPhone() },
            ]}
          />
        );

      case "confirmTicket":
        return (
          <QuickReplies
            options={[
              { label: "SIM ✓", onClick: () => void finish() },
              { label: "NÃO", variant: "ghost", onClick: () => void ticketProblem() },
            ]}
          />
        );

      // Fim do funil: os dois eventos entregam o ingresso (baixar/compartilhar).
      // O clássico soma o grupo de WhatsApp e o link de acesso ao ambiente.
      case "done":
        return (
          <div className="chat-quick chat-quick--stack">
            {!ticketOnly && (
              <a className="btn chat-cta" href={WHATSAPP_GROUP} target="_blank" rel="noreferrer">
                Entrar no grupo de WhatsApp 💬
              </a>
            )}
            <button type="button" className="quick-btn" onClick={shareOnWhatsApp}>
              CHAMAR A GALERA NO WHATSAPP 💬
            </button>
            <button
              type="button"
              className="quick-btn"
              onClick={() => void shareOnInstagram()}
            >
              POSTAR NO INSTAGRAM 📸
            </button>
            <button
              type="button"
              className="quick-btn quick-btn--ghost"
              onClick={downloadTicket}
            >
              Baixar meu ingresso ⬇️
            </button>
            <button
              type="button"
              className="quick-btn quick-btn--ghost"
              onClick={() => void shareTicket()}
            >
              {shared ? "Link copiado! ✓" : "Mais opções 🔗"}
            </button>
            {!ticketOnly && result?.magicLink && (
              <a className="chat-access" href={result.magicLink}>
                Guarde seu link de acesso ao evento →
              </a>
            )}
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="chat-screen">
      <header className="chat-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="sprite chat-mage" src="/sprites/happy-mage.png" alt="" />
        <div>
          <p className="chat-name px">Mestre do Evento</p>
          <p className="chat-status">
            <span className="chat-dot" /> online
          </p>
        </div>
      </header>

      <div className="chat-log" ref={logRef}>
        {messages.map((m) => (
          <div key={m.id} className={`msg msg--${m.from}`}>
            {m.from === "bot" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="sprite msg-avatar" src="/sprites/happy-mage.png" alt="" />
            )}
            <div className={`bubble${m.imageUrl ? " bubble--media" : ""}`}>
              {m.text && <p>{m.text}</p>}
              {m.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={m.example ? "bubble-img bubble-img--example" : "bubble-img"}
                  src={m.imageUrl}
                  alt={m.example ? "Exemplo de foto" : "Seu ingresso"}
                />
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div className="msg msg--bot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="sprite msg-avatar" src="/sprites/happy-mage.png" alt="" />
            <div className="bubble bubble--typing" aria-label="digitando">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      <footer className="chat-footer">{renderFooter()}</footer>
    </div>
  );
}
