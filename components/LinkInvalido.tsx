export default function LinkInvalido() {
  const supportUrl =
    process.env.NEXT_PUBLIC_SUPPORT_WA_URL || "https://wa.me/";
  return (
    <main className="screen">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sprite scroll-mage" src="/sprites/happy-mage.png" alt="" />
      <div className="scroll-card">
        <h1 className="scroll-title">Esse link não está mais válido</h1>
        <p className="scroll-text">
          Peça um novo link de acesso para retomar sua jornada no evento.
        </p>
      </div>
      <a className="btn" href={supportUrl}>
        Pedir novo link
      </a>
    </main>
  );
}
