"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

const DEFAULT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const onlyDigits = (v: string) => v.replace(/\D/g, "");
const isValidPhone = (v: string) => /^\d{12,13}$/.test(v);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Step = "greet" | "askName" | "askEmail" | "askPhone" | "saving" | "done";

interface Msg {
  id: number;
  from: "bot" | "user";
  text: string;
}

/**
 * Mestre do Evento — captação em chat (Story 8.13). Capta nome/e-mail/WhatsApp,
 * cria o lead e loga a sessão (POST /api/evento/mestre), então segue para a
 * pesquisa preservando a intenção (`?next`, `?quero`). Sem foto/ingresso (8.3).
 */
export default function MestreCaptura() {
  const router = useRouter();
  const params = useSearchParams();
  // Só aceita destino interno (evita open redirect via ?next=https://evil.com).
  const rawNext = params.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/evento/conteudo";
  const quero = params.get("quero");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [step, setStep] = useState<Step>("greet");
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const idRef = useRef(0);
  const mounted = useRef(true);
  const started = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const pushMsg = useCallback((m: Omit<Msg, "id">) => {
    setMessages((prev) => [...prev, { id: idRef.current++, ...m }]);
  }, []);

  const botSay = useCallback(
    async (lines: string[]) => {
      for (const line of lines) {
        setTyping(true);
        await sleep(600);
        if (!mounted.current) return;
        setTyping(false);
        pushMsg({ from: "bot", text: line });
        await sleep(160);
      }
    },
    [pushMsg],
  );

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const intro = quero
      ? `Você quer "${quero}"! 🎁 Mas antes o Mestre precisa te conhecer.`
      : "Opa! Eu sou o Mestre do Evento. Antes de liberar o conteúdo, deixa eu te conhecer.";
    void (async () => {
      await botSay([intro, "Como é o seu nome?"]);
      setStep("askName");
    })();
  }, [botSay, quero]);

  async function submit(finalName: string, finalEmail: string, phone: string) {
    setStep("saving");
    await botSay(["Perfeito! Preparando seu acesso… 🪄"]);
    try {
      const res = await fetch("/api/evento/mestre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: DEFAULT_SLUG,
          name: finalName,
          email: finalEmail,
          phone,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { errors?: string[] };
        await botSay([
          data.errors?.join(", ") || "Ops, algo deu errado. Vamos tentar o e-mail de novo?",
        ]);
        setStep("askEmail");
        return;
      }
      if (!mounted.current) return;
      setStep("done");
      await botSay(["Prontinho! Agora só falta uma pesquisa rápida. ✨"]);
      await sleep(500);
      router.push(`/evento/pesquisa?next=${encodeURIComponent(next)}`);
    } catch {
      await botSay(["Falha de conexão 😕 Confirme seu e-mail para tentar de novo."]);
      setStep("askEmail");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value || typing) return;

    if (step === "askName") {
      pushMsg({ from: "user", text: value });
      setInput("");
      setName(value);
      void (async () => {
        await botSay([`Prazer, ${value.split(" ")[0]}! Qual o seu melhor e-mail?`]);
        setStep("askEmail");
      })();
      return;
    }

    if (step === "askEmail") {
      if (!EMAIL_RE.test(value)) {
        pushMsg({ from: "user", text: value });
        setInput("");
        void botSay(["Esse e-mail não parece válido. Pode digitar de novo?"]);
        return;
      }
      pushMsg({ from: "user", text: value });
      setInput("");
      setEmail(value);
      void (async () => {
        await botSay(["E o seu WhatsApp com DDD? Ex.: 5511999999999"]);
        setStep("askPhone");
      })();
      return;
    }

    if (step === "askPhone") {
      const digits = onlyDigits(value);
      if (!isValidPhone(digits)) {
        pushMsg({ from: "user", text: value });
        setInput("");
        void botSay(["Número estranho 🤔 Use DDI+DDD+número (só dígitos). Ex.: 5511999999999"]);
        return;
      }
      pushMsg({ from: "user", text: digits });
      setInput("");
      void submit(name, email, digits);
      return;
    }
  }

  const showInput = step === "askName" || step === "askEmail" || step === "askPhone";

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
            <div className="bubble">
              <p>{m.text}</p>
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

      <footer className="chat-footer">
        {showInput && !typing && (
          <form className="chat-input" onSubmit={onSubmit}>
            <input
              type={step === "askEmail" ? "email" : step === "askPhone" ? "tel" : "text"}
              inputMode={step === "askPhone" ? "numeric" : step === "askEmail" ? "email" : "text"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                step === "askName"
                  ? "Seu nome"
                  : step === "askPhone"
                    ? "5511999999999"
                    : "voce@exemplo.com"
              }
              aria-label="Sua mensagem"
              autoFocus
            />
            <button type="submit" className="chat-send" aria-label="Enviar">
              ➤
            </button>
          </form>
        )}
      </footer>
    </div>
  );
}
