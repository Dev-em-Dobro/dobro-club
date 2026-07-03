// Gera public/dicionario-tags-html.pdf — presente inicial da Story 8.14.
// Self-contained: monta um PDF 1.4 válido à mão (Helvetica/WinAnsi), sem deps.
// Rode com: node scripts/gen-dicionario-pdf.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "dicionario-tags-html.pdf");

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const LEAD = 15;

/** [tag, descrição] — presente inicial; expandir depois. */
const GROUPS = [
  ["Estrutura do documento", [
    ["<!DOCTYPE html>", "Declara o documento como HTML5."],
    ["<html>", "Elemento raiz que envolve toda a pagina."],
    ["<head>", "Metadados: titulo, links, scripts, charset."],
    ["<body>", "Conteudo visivel da pagina."],
    ["<title>", "Titulo mostrado na aba do navegador."],
    ["<meta>", "Metadado (charset, viewport, descricao)."],
    ["<link>", "Liga recursos externos, como folhas de estilo."],
    ["<script>", "Insere ou referencia codigo JavaScript."],
    ["<style>", "CSS embutido no proprio documento."],
  ]],
  ["Texto e conteudo", [
    ["<h1> a <h6>", "Titulos, do mais importante ao menos."],
    ["<p>", "Paragrafo de texto."],
    ["<br>", "Quebra de linha simples."],
    ["<hr>", "Linha divisoria (separador tematico)."],
    ["<strong>", "Texto com forte importancia (negrito)."],
    ["<em>", "Enfase no texto (italico)."],
    ["<span>", "Container em linha, sem significado proprio."],
    ["<blockquote>", "Citacao em bloco."],
    ["<code>", "Trecho de codigo em linha."],
    ["<pre>", "Texto pre-formatado, preserva espacos."],
  ]],
  ["Listas", [
    ["<ul>", "Lista nao ordenada (marcadores)."],
    ["<ol>", "Lista ordenada (numeros)."],
    ["<li>", "Item de uma lista."],
    ["<dl>", "Lista de definicoes."],
    ["<dt>", "Termo em uma lista de definicoes."],
    ["<dd>", "Descricao do termo."],
  ]],
  ["Links e midia", [
    ["<a>", "Link (ancora) para outra pagina ou secao."],
    ["<img>", "Imagem."],
    ["<video>", "Video incorporado."],
    ["<audio>", "Audio incorporado."],
    ["<iframe>", "Incorpora outra pagina dentro desta."],
    ["<figure>", "Agrupa uma midia com sua legenda."],
    ["<figcaption>", "Legenda de uma figure."],
  ]],
  ["Formularios", [
    ["<form>", "Formulario para enviar dados."],
    ["<input>", "Campo de entrada (texto, email, checkbox...)."],
    ["<label>", "Rotulo associado a um campo."],
    ["<textarea>", "Campo de texto de multiplas linhas."],
    ["<select>", "Lista suspensa de opcoes."],
    ["<option>", "Opcao dentro de um select."],
    ["<button>", "Botao clicavel."],
  ]],
  ["Tabelas", [
    ["<table>", "Tabela de dados."],
    ["<tr>", "Linha da tabela."],
    ["<th>", "Celula de cabecalho."],
    ["<td>", "Celula de dados."],
    ["<thead> <tbody> <tfoot>", "Agrupam cabecalho, corpo e rodape."],
  ]],
  ["Semantica (HTML5)", [
    ["<header>", "Cabecalho de uma pagina ou secao."],
    ["<nav>", "Bloco de navegacao/menu."],
    ["<main>", "Conteudo principal da pagina."],
    ["<section>", "Secao tematica do conteudo."],
    ["<article>", "Conteudo independente e autossuficiente."],
    ["<aside>", "Conteudo lateral/complementar."],
    ["<footer>", "Rodape de uma pagina ou secao."],
  ]],
];

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// Larguras aproximadas (Helvetica) só para quebrar a descrição em linhas.
function wrap(text, size, maxWidth) {
  const charW = size * 0.52;
  const max = Math.floor(maxWidth / charW);
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur ? cur + " " : "") + w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Monta as instruções de texto por página (posicionamento absoluto via Tm).
const pages = [];
let ops = [];
let y = PAGE_H - MARGIN;

function newPage() {
  if (ops.length) pages.push(ops);
  ops = [];
  y = PAGE_H - MARGIN;
}
function line(text, font, size, indent = 0) {
  if (y < MARGIN + LEAD) newPage();
  ops.push(
    `BT /${font} ${size} Tf 1 0 0 1 ${MARGIN + indent} ${y.toFixed(2)} Tm (${esc(text)}) Tj ET`,
  );
  y -= LEAD;
}

// Capa/título
line("Dicionario de Tags HTML", "F2", 22);
y -= 6;
line("Presente Dobro Club - guia rapido das tags mais usadas", "F1", 11);
y -= 14;

for (const [group, items] of GROUPS) {
  if (y < MARGIN + LEAD * 3) newPage();
  y -= 4;
  line(group, "F2", 14);
  y -= 2;
  for (const [tag, desc] of items) {
    line(tag, "F2", 11);
    for (const wl of wrap(desc, 11, PAGE_W - MARGIN * 2 - 16)) {
      line(wl, "F1", 11, 16);
    }
    y -= 2;
  }
}
newPage();

// ---- Serialização do PDF ----
const objects = []; // strings "N 0 obj ... endobj"
const fontF1 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
const fontF2 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

const nPages = pages.length;
const pageObjNums = pages.map((_, i) => 5 + i * 2);
const contentObjNums = pages.map((_, i) => 6 + i * 2);

objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
objects[2] = `<< /Type /Pages /Kids [ ${pageObjNums.map((n) => `${n} 0 R`).join(" ")} ] /Count ${nPages} >>`;
objects[3] = fontF1;
objects[4] = fontF2;
pages.forEach((pageOps, i) => {
  const pageNum = pageObjNums[i];
  const contentNum = contentObjNums[i];
  objects[pageNum] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
    `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>`;
  const stream = pageOps.join("\n");
  const len = Buffer.byteLength(stream, "latin1");
  objects[contentNum] = `<< /Length ${len} >>\nstream\n${stream}\nendstream`;
});

let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
const offsets = [];
const maxObj = 4 + nPages * 2;
for (let n = 1; n <= maxObj; n++) {
  offsets[n] = Buffer.byteLength(pdf, "latin1");
  pdf += `${n} 0 obj\n${objects[n]}\nendobj\n`;
}
const xrefOffset = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${maxObj + 1}\n`;
pdf += "0000000000 65535 f \n";
for (let n = 1; n <= maxObj; n++) {
  pdf += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

writeFileSync(OUT, Buffer.from(pdf, "latin1"));
console.log(`OK: ${OUT} (${nPages} paginas, ${Buffer.byteLength(pdf, "latin1")} bytes)`);
