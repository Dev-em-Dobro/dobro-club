export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Duração do "digitando…" proporcional ao tamanho da linha, com piso/teto e um
// jitter aleatório pra não soar robótico. Imagens (texto vazio) caem no piso.
export function typingDelay(text: string): number {
  const base = 450;
  const perChar = 32; // ms por caractere
  const jitter = Math.random() * 400;
  return Math.min(2600, base + text.length * perChar + jitter);
}
