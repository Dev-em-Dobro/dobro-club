export default function LinkInvalido() {
  const supportUrl = import.meta.env.VITE_SUPPORT_WA_URL || 'https://wa.me/';
  return (
    <main className="screen">
      <div className="card">
        <h1>Esse link não está mais válido</h1>
        <p>Peça um novo link de acesso para entrar no evento.</p>
        <a className="btn" href={supportUrl}>Pedir novo link</a>
      </div>
    </main>
  );
}
