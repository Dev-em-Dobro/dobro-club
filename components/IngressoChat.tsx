"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";
const DEFAULT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";
const WHATSAPP_GROUP =
  process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL || "https://chat.whatsapp.com/";

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
  | "ticketProblem"
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
  magicLink: string;
  ticket: { imageUrl: string; qrValue: string; shareUrl: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function IngressoChat({
  slug = DEFAULT_SLUG,
}: {
  slug?: string;
}) {
  const params = useSearchParams();
  const ref = params.get("ref");

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

  const idRef = useRef(0);
  const mounted = useRef(true);
  const logRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const started = useRef(false);

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
    void botSay([
      "Opa! Seja bem-vindo(a) à Semana do Zero ao Programador Contratado 🎮",
      "Digite INGRESSO para começar 🎟️",
    ]);
  }, [botSay]);

  // ---- transições -------------------------------------------------------

  async function startFlow() {
    setStep("prepared");
    await botSay([
      "Chegou a hora de receber seu Ingresso individual e personalizado pra participar da Semana do Zero ao Programador Contratado!",
      "Preparado(a)? 🚀",
    ]);
  }

  async function goAskName() {
    setStep("askName");
    await botSay([
      "Agora, digite o seu NOME e um SOBRENOME pra colocarmos no seu ingresso.",
      "Exemplo: Fulano de Tal",
    ]);
  }

  async function goConfirmName(value: string) {
    setStep("confirmName");
    await botSay([value.toUpperCase(), "Confirma pra mim se seu nome está correto 👇"]);
  }

  async function goAskPhoto() {
    setStep("askPhoto");
    await botSay([
      "Preciso de uma foto sua para gerar seu ingresso pessoal.",
      "Você prefere enviar uma foto sua aqui ou continuar sem foto mesmo?",
    ]);
  }

  async function goUploadPhoto() {
    setStep("uploadPhoto");
    await botSay([
      "Boa! Me envie uma foto quadrada (formato 1:1), com o seu rosto bem centralizado.",
      { text: "Assim aqui 👇", imageUrl: "/sprites/happy-mage.png", example: true },
    ]);
  }

  async function goAskEmail() {
    setStep("askEmail");
    await botSay([
      "Maravilha, seu ingresso já está sendo emitido…",
      "Enquanto isso, me fala qual o seu melhor e-mail 👇",
    ]);
  }

  async function goConfirmEmail(value: string) {
    setStep("confirmEmail");
    await botSay(["É este e-mail mesmo?", `👉 ${value}`]);
  }

  async function goAskPhone() {
    setStep("askPhone");
    await botSay([
      "Por último, me passa seu WhatsApp com DDI + DDD 📱",
      "É por ele que você recupera seu acesso depois. Formato: 55 + DDD + número. Ex.: 5511999999999",
    ]);
  }

  async function goConfirmPhone(value: string) {
    setStep("confirmPhone");
    await botSay(["É esse número mesmo?", `👉 ${value}`]);
  }

  async function generate() {
    setStep("generating");
    await botSay([
      "⚠️ Aguarde enquanto estamos produzindo o seu ingresso…",
      "(Pode demorar um pouquinho, pois temos muitas requisições ao mesmo tempo.)",
    ]);
    try {
      const res = await fetch(`/api/e/${encodeURIComponent(slug)}/ingresso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone || undefined,
          photoUrl: photoUrl || undefined,
          ref: ref || undefined,
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
            "Ops, algo deu errado ao gerar seu ingresso.",
          "Vamos tentar de novo? Confirme seu e-mail 👇",
        ]);
        setStep("confirmEmail");
        return;
      }
      if (!mounted.current) return;
      setResult(data);
      setStep("confirmTicket");
      await botSay([
        { imageUrl: data.ticket.imageUrl },
        "Seu ingresso foi emitido corretamente?",
      ]);
    } catch {
      await botSay([
        "Falha de conexão ao gerar o ingresso 😕",
        "Confirme seu e-mail para tentarmos de novo 👇",
      ]);
      setStep("confirmEmail");
    }
  }

  async function finish() {
    setStep("done");
    await botSay([
      "Maravilha! Te esperamos na primeira aula do evento, na terça-feira, às 20h (horário de Brasília). ✨",
      "No dia, você receberá o link da aula com antecedência, no grupo de WhatsApp.",
    ]);
  }

  async function ticketProblem() {
    setStep("ticketProblem");
    await botSay([
      "Sem problema! Vamos gerar de novo pra você 👇",
    ]);
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
        void botSay(["Preciso do NOME e do SOBRENOME 🙂 Ex.: Fulano de Tal"]);
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
        void botSay(["Hmm, esse e-mail não parece válido. Pode digitar de novo? 👇"]);
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
        void botSay([
          "Hmm, esse número não parece certo. Use DDI + DDD + número (só números). Ex.: 5511999999999 👇",
        ]);
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
      await botSay([
        "Esse formato não rola (use JPEG, PNG ou WebP). Vou seguir com o avatar padrão 👍",
      ]);
      setPhotoUrl(null);
      void goAskEmail();
      return;
    }
    if (file.size > MAX_BYTES) {
      pushMsg({ from: "user", text: "📎 (foto)" });
      await botSay([
        "Essa imagem passou de 5MB. Vou seguir com o avatar padrão 👍",
      ]);
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
      await botSay(["Não consegui enviar sua foto agora — seguimos com o avatar padrão 👍"]);
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
                label: "CONTINUAR SEM FOTO",
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

      case "ticketProblem":
        return <QuickReplies options={[{ label: "GERAR DE NOVO 🔄", onClick: () => void generate() }]} />;

      case "done":
        return (
          <div className="chat-quick chat-quick--stack">
            <a className="btn chat-cta" href={WHATSAPP_GROUP} target="_blank" rel="noreferrer">
              Entrar no grupo de WhatsApp 💬
            </a>
            {result && (
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
