import { describe, it, expect } from "vitest";
import { ingressoCopy } from "@/lib/copy/ingresso";

const classico = ingressoCopy({ eventName: "Semana do Zero ao Programador Contratado" });
const pago = ingressoCopy({ eventName: "Imersão", ticketOnly: true });

describe("copy do Mestre — lançamento clássico", () => {
  it("anuncia a primeira aula na segunda-feira, 20h, e o grupo de WhatsApp", () => {
    const fecho = classico.finish.join(" ");
    expect(fecho).toMatch(/próxima segunda-feira, 20h/i);
    expect(fecho).toMatch(/grupo de whatsapp/i);
  });

  it("quem já tem ingresso ouve que a vaga está garantida (sem regerar nada)", () => {
    expect(classico.alreadyHasTicket.join(" ")).toMatch(
      /já garantiu o seu ingresso.*vaga já está garantida/is,
    );
  });

  it("usa o nome do evento na saudação e na abertura", () => {
    expect(classico.greet.join(" ")).toContain("Semana do Zero ao Programador Contratado");
    expect(classico.start.join(" ")).toContain("Semana do Zero ao Programador Contratado");
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
