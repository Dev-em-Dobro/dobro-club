import { describe, it, expect } from "vitest";
import { ingressoCopy } from "@/lib/copy/ingresso";

const classico = ingressoCopy({ eventName: "Semana do Zero ao Programador Contratado" });
const pago = ingressoCopy({ eventName: "Imersão", ticketOnly: true });

describe("copy do Mestre — lançamento clássico", () => {
  it("anuncia a primeira aula em 10/08 às 20h e o grupo de WhatsApp", () => {
    const fecho = classico.finish.join(" ");
    expect(fecho).toMatch(/10\/08 às 20h/i);
    expect(fecho).toMatch(/grupo de whatsapp/i);
  });

  it("quem já tem ingresso ouve que a vaga está garantida (sem regerar nada)", () => {
    expect(classico.alreadyHasTicket.join(" ")).toMatch(
      /já garantiu o seu ingresso.*vaga já está garantida/is,
    );
    expect(classico.alreadyHasTicket.join(" ")).toMatch(/10\/08 às 20h/i);
  });

  it("usa o nome do evento na saudação", () => {
    expect(classico.greet.join(" ")).toContain("Semana do Zero ao Programador Contratado");
  });

  it("não usa travessão (—) nos textos do chat", () => {
    const all = [
      ...classico.greet,
      ...classico.finish,
      ...classico.alreadyHasTicket,
      ...classico.photoRejected,
      ...classico.photoFailed,
      ...classico.reissuedWithoutPhoto,
    ].join(" ");
    expect(all).not.toContain("—");
  });

  it("explica o formato internacional do WhatsApp (não só BR 55)", () => {
    expect(classico.askPhone.join(" ")).toMatch(/DDI/i);
    expect(classico.askPhone.join(" ")).not.toMatch(/Formato: 55 \+/);
    expect(classico.invalidPhone.join(" ")).toMatch(/34687073411/);
  });
});

describe("copy do Mestre — foto do participante", () => {
  it("foto grande demais avisa o limite e não desiste da foto", () => {
    const aviso = classico.photoTooBig.join(" ");
    expect(aviso).toMatch(/5MB/i);
    expect(aviso).not.toMatch(/avatar padrão/i);
  });

  it("problema que a pessoa resolve oferece reenviar OU seguir sem foto", () => {
    for (const linhas of [classico.photoStillTooBig, classico.photoRejected]) {
      const texto = linhas.join(" ");
      expect(texto).toMatch(/outra/i);
      expect(texto).toMatch(/avatar padrão/i);
    }
  });
});

describe("copy do Mestre — evento pago (ticket-only)", () => {
  it("o fecho não promete aula nem grupo: entrega o ingresso", () => {
    const fecho = pago.finish.join(" ");
    expect(fecho).not.toMatch(/aula|grupo de whatsapp/i);
    expect(fecho).toMatch(/ingresso/i);
  });

  it("não oferece recuperação de acesso ao pedir o WhatsApp", () => {
    expect(pago.askPhone.join(" ")).not.toMatch(/recupera/i);
    expect(classico.askPhone.join(" ")).toMatch(/recupera/i);
  });
});
