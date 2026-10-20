// ─── Gerador dos slides da feira ────────────────────────────────────
// Gera Docs/feira/slides.pptx (7 slides, 16:9) com pptxgenjs. O texto dos
// slides e as notas do apresentador estão aqui: mude aqui e rode de novo,
// em vez de editar o .pptx à mão.
//
// O pptxgenjs NÃO é dependência do projeto. Para rodar, na raiz do repo:
//
//   npm install --no-save pptxgenjs          (não mexe no package.json nem no lock)
//   node Docs/feira/gerador-slides.cjs                       URL padrão do QR
//   node Docs/feira/gerador-slides.cjs https://REAL/teste    quando a URL do Render chegar
//   node Docs/feira/gerador-slides.cjs URL saida.pptx        outro arquivo de saída
//
// Alternativa sem tocar no node_modules da raiz: instalar o pptxgenjs numa
// pasta qualquer (npm install pptxgenjs) e rodar com NODE_PATH=<pasta>/node_modules.
//
// O `qrcode` já está nas devDependencies da raiz (npm run setup instala).
// Depois de gerar: abrir o .pptx e conferir slide a slide (principalmente o 7, com o QR).
// Números: Docs/base-clinica-oncologia.md e o riskEngine; se as personas mudarem, revise os slides 4 e 5.

const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');
const QRCode = require('qrcode');

const URL = process.argv[2] || 'https://healthinpulse.onrender.com/teste';
const OUT = process.argv[3] || path.join(__dirname, 'slides.pptx');

// pptxgenjs escreve a paleta padrão do Office no tema; aqui trocamos pelas
// cores do app (frontend/tailwind.config.js). O jszip vem junto do pptxgenjs.
const SLOTS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
const applyTheme = async (deck, theme) => {
  const JSZip = require(require.resolve('jszip', { paths: [require.resolve('pptxgenjs')] }));
  const zip = await JSZip.loadAsync(fs.readFileSync(deck));
  const part = 'ppt/theme/theme1.xml';
  const scheme = `<a:clrScheme name="${theme.name}">`
    + SLOTS.map((k) => `<a:${k}><a:srgbClr val="${theme.colors[k]}"/></a:${k}>`).join('') + '</a:clrScheme>';
  const xml = (await zip.file(part).async('string'))
    .replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, () => scheme)
    .replace(/(<a:(?:theme|fontScheme)\b[^>]*?\bname=")[^"]*"/g, (_, head) => `${head}${theme.name}"`);
  if (!xml.includes(scheme)) throw new Error(`${part} sem <a:clrScheme>`);
  zip.file(part, xml);
  // cor de esquema passada onde só vale hex vira val="bg2": falha aqui em vez de gerar arquivo quebrado
  for (const name of Object.keys(zip.files)) {
    if (!name.endsWith('.xml')) continue;
    const bad = (await zip.file(name).async('string')).match(/<a:srgbClr val="((?![0-9A-Fa-f]{6}")[^"]*)"/);
    if (bad) throw new Error(`${name}: <a:srgbClr val="${bad[1]}"> não é hex de 6 dígitos`);
  }
  fs.writeFileSync(deck, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
};

const THEME = {
  name: 'HealthInPulse',
  headFontFace: 'Arial',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '0F172A', lt1: 'FFFFFF', dk2: '003F7E', lt2: 'F7F9FC',
    accent1: '00A0DC', accent2: '16A34A', accent3: 'B45309', accent4: 'C2410C',
    accent5: '475569', accent6: 'D4E3F1', hlink: '0E5193', folHlink: '5388BE',
  },
};
const HEX = THEME.colors;

let QR_DATA;
(async () => {
  QR_DATA = 'image/png;base64,' + (await QRCode.toBuffer(URL, { errorCorrectionLevel: 'Q', margin: 4, width: 800,
    color: { dark: '#002a55', light: '#ffffff' } })).toString('base64');
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
  pres.title = 'HealthInPulse v8 · feira 24/10/2026';
  pres.author = 'Equipe HealthInPulse';
  pres.company = 'FIAP x Care Plus';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  // ─── Layouts ─────────────────────────────────────────────
  const FOOT = 'HealthInPulse v8 · FIAP × Care Plus · projeto acadêmico, não é diagnóstico';
  pres.defineSlideMaster({
    title: 'TITULO_ESCURO',
    background: { color: HEX.dk2 },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 2.0, w: 11.7, h: 1.3,
        fontSize: 60, bold: true, color: C.background1, valign: 'bottom', align: 'left', margin: 0 }, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: 0.8, y: 3.45, w: 10.6, h: 1.2,
        fontSize: 24, color: C.accent6, valign: 'top', align: 'left', margin: 0 }, text: '' } },
    ],
  });
  pres.defineSlideMaster({
    title: 'CONTEUDO',
    background: { color: HEX.lt1 },
    margin: [0.5, 0.5, 0.6, 0.5],
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.35, w: 12.3, h: 0.85,
        fontSize: 34, bold: true, color: C.text2, valign: 'middle', align: 'left', margin: 0 }, text: '' } },
      { text: { text: FOOT, options: { x: 0.5, y: 7.0, w: 9, h: 0.3, fontSize: 10, color: C.accent5, margin: 0 } } },
    ],
    slideNumber: { x: 12.3, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: HEX.accent5, align: 'right' },
  });
  pres.defineSlideMaster({
    title: 'FECHO_ESCURO',
    background: { color: HEX.dk2 },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.35, w: 12.3, h: 0.85,
        fontSize: 34, bold: true, color: C.background1, valign: 'middle', align: 'left', margin: 0 }, text: '' } },
      { text: { text: FOOT, options: { x: 0.5, y: 7.0, w: 9, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
    ],
    slideNumber: { x: 12.3, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: HEX.accent6, align: 'right' },
  });

  // helpers ---------------------------------------------------
  const circleNum = (slide, n, x, y, d = 0.5, name) => {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: name });
    slide.addText(String(n), { x, y, w: d, h: d, fontSize: 18, bold: true, color: C.background1, align: 'center',
      valign: 'middle', margin: 0, isTextBox: true, fontFace: THEME.headFontFace });
  };
  const pill = (slide, text, x, y, w, fill, color, name) => {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.42, rectRadius: 0.21, fill: { color: fill }, line: { type: 'none' }, objectName: name });
    slide.addText(text, { x, y, w, h: 0.42, fontSize: 14, bold: true, color, align: 'center', valign: 'middle',
      margin: 0, isTextBox: true, charSpacing: 1 });
  };
  const card = (slide, x, y, w, h, name, fill = C.background2) =>
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill },
      line: { color: C.accent6, width: 1 }, objectName: name });

  const LVL = {
    ROTINA:     { fill: 'DCFCE7', color: '15803D' },
    ATENCAO:    { fill: 'FEF3C7', color: 'B45309' },
    INVESTIGAR: { fill: 'FFEDD5', color: 'C2410C' },
  };

  // ─── 1. Capa ─────────────────────────────────────────────
  pres.addSection({ title: 'Abertura' });
  {
    const s = pres.addSlide({ masterName: 'TITULO_ESCURO', sectionTitle: 'Abertura' });
    s.addText('FEIRA · SÁBADO, 24/10/2026', { x: 0.8, y: 1.3, w: 8, h: 0.4, fontSize: 14, bold: true,
      color: C.accent6, charSpacing: 3, margin: 0, isTextBox: true });
    s.addText('HealthInPulse v8', { placeholder: 'title' });
    s.addText('Uma IA que estima o risco de 5 cânceres, mostra o porquê de cada número e indica o exame certo para a sua idade',
      { placeholder: 'body' });
    const facts = [
      ['13', 'condições: 5 cânceres e 8 doenças crônicas'],
      ['3%', 'limite para "investigar" (diretriz NICE NG12)'],
      ['0', 'dados gravados no teste do visitante'],
    ];
    facts.forEach(([big, small], i) => {
      const x = 0.8 + i * 4.0;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.15, w: 3.7, h: 1.5, rectRadius: 0.12,
        fill: { color: C.background1, transparency: 88 }, line: { type: 'none' }, objectName: `fato-${i + 1}` });
      s.addText(big, { x: x + 0.3, y: 5.25, w: 1.3, h: 1.3, fontSize: 44, bold: true, color: C.background1,
        valign: 'middle', margin: 0, isTextBox: true, fontFace: THEME.headFontFace });
      s.addText(small, { x: x + 1.55, y: 5.25, w: 2.0, h: 1.3, fontSize: 14, color: C.accent6, valign: 'middle',
        margin: 0, isTextBox: true });
    });
    s.addNotes('Pitch de 30 s: Você sabe qual exame de câncer deveria fazer, e a partir de que idade? Quase ninguém sabe. '
      + 'O HealthInPulse estima o risco de cinco cânceres frequentes no Brasil, mostra o porquê de cada número, com a fonte, '
      + 'e indica o exame de rastreamento. Não é diagnóstico. O teste leva dois minutos e nada é gravado.');
  }

  // ─── 2. O problema ───────────────────────────────────────
  pres.addSection({ title: 'Problema' });
  {
    const s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Problema' });
    s.addText('Cada exame tem idade e público certos', { placeholder: 'title' });
    s.addText('E três dessas regras mudaram em 2025 e 2026. A maioria das pessoas não sabe qual é a sua.',
      { x: 0.5, y: 1.2, w: 12.3, h: 0.5, fontSize: 18, color: C.accent5, margin: 0, isTextBox: true });
    const cards = [
      ['Mama', 'Mamografia a cada 2 anos', '50–74', 'Ministério da Saúde, 2025', 'NOVO EM 2025'],
      ['Colo do útero', 'Teste de DNA-HPV a cada 5 anos', '25–64', 'Portaria SAES/SECTICS nº 13, 2025', 'NOVO EM 2025'],
      ['Intestino', 'Sangue oculto nas fezes (FIT) a cada 2 anos', '50–75', 'INCA, 2026 (SUS)', 'NOVO EM 2026'],
      ['Pulmão', 'TC de baixa dose anual, ≥ 20 maços-ano', '50–80', 'Consenso SBCT/SBPT/CBR, 2024', null],
      ['Próstata', 'PSA: conversar com o médico', 'decisão', 'MS/INCA, Nota Técnica 9/2023', null],
    ];
    const w = 2.3, gap = 0.2, y = 1.95, h = 4.75;
    cards.forEach(([name, exam, ages, src, badge], i) => {
      const x = 0.5 + i * (w + gap);
      card(s, x, y, w, h, `card-${i + 1}`);
      s.addText(name, { x: x + 0.2, y: y + 0.25, w: w - 0.4, h: 0.45, fontSize: 20, bold: true, color: C.text1,
        margin: 0, isTextBox: true, fontFace: THEME.headFontFace });
      s.addText(ages, { x: x + 0.2, y: y + 0.85, w: w - 0.4, h: 0.75, fontSize: ages.length > 6 ? 28 : 34, bold: true,
        color: C.text2, margin: 0, isTextBox: true, fontFace: THEME.headFontFace, valign: 'middle' });
      s.addText(ages.length > 6 ? 'compartilhada' : 'anos', { x: x + 0.2, y: y + 1.6, w: w - 0.4, h: 0.35,
        fontSize: 14, color: C.accent5, margin: 0, isTextBox: true });
      s.addText(exam, { x: x + 0.2, y: y + 2.1, w: w - 0.4, h: 1.0, fontSize: 15, color: C.text1, margin: 0,
        valign: 'top', isTextBox: true });
      s.addText(src, { x: x + 0.2, y: y + 3.15, w: w - 0.4, h: 0.7, fontSize: 11, color: C.accent5, margin: 0,
        valign: 'top', isTextBox: true });
      if (badge) {
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.2, y: y + h - 0.65, w: 1.6, h: 0.38, rectRadius: 0.19,
          fill: { color: 'E6F7FD' }, line: { type: 'none' }, objectName: `selo-${i + 1}` });
        s.addText(badge, { x: x + 0.2, y: y + h - 0.65, w: 1.6, h: 0.38, fontSize: 11, bold: true, color: C.hlink,
          align: 'center', valign: 'middle', margin: 0, isTextBox: true, charSpacing: 1 });
      }
    });
    s.addNotes('Câncer achado cedo tem outro desfecho e existem exames de rastreamento. Mas cada exame tem idade e público, '
      + 'e as regras mudaram: em 2025 a mamografia foi ampliada para 50 a 74 anos e o DNA-HPV virou o exame principal do colo do útero; '
      + 'em 2026 o SUS passou a rastrear câncer de intestino com o FIT. Pulmão é recomendação do consenso de 2024, ainda fora do SUS. '
      + 'Próstata: o Ministério da Saúde não recomenda rastrear todos os homens; é decisão compartilhada. Fonte: Docs/base-clinica-oncologia.md.');
  }

  // ─── 3. Como a IA pensa ──────────────────────────────────
  pres.addSection({ title: 'Como funciona' });
  {
    const s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Como funciona' });
    s.addText('Como a IA pensa', { placeholder: 'title' });
    const steps = [
      ['Começa pela média', 'Chance de alguém da mesma idade e sexo receber o diagnóstico em 2 anos. INCA (Estimativa 2026) e GLOBOCAN 2022 Brasil.'],
      ['Cada pista multiplica', 'Sintomas, exames e a balança mudam a chance. A força (LR) vem de estudos: FIT positivo ×13, nódulo na mama ×55.'],
      ['Compara com limites', 'O resultado vira uma categoria. O limite de 3% para investigar é o da diretriz NICE NG12.'],
    ];
    const w = 3.85, gap = 0.375, y = 1.45, h = 2.55;
    steps.forEach(([t, d], i) => {
      const x = 0.5 + i * (w + gap);
      card(s, x, y, w, h, `passo-${i + 1}`);
      circleNum(s, i + 1, x + 0.25, y + 0.25, 0.5, `num-${i + 1}`);
      s.addText(t, { x: x + 0.25, y: y + 0.9, w: w - 0.5, h: 0.45, fontSize: 20, bold: true, color: C.text1, margin: 0,
        isTextBox: true, fontFace: THEME.headFontFace });
      s.addText(d, { x: x + 0.25, y: y + 1.4, w: w - 0.5, h: 1.05, fontSize: 14, color: C.accent5, margin: 0,
        valign: 'top', isTextBox: true });
    });
    // escala de categorias
    s.addText('Categorias (oncologia nunca em vermelho)', { x: 0.5, y: 4.3, w: 8, h: 0.35, fontSize: 14, bold: true,
      color: C.text2, margin: 0, isTextBox: true });
    const lv = [
      ['ROTINA', 'o resto: < 1% e < 2× a média', LVL.ROTINA],
      ['ATENÇÃO', '≥ 1% ou 2× a média da idade', LVL.ATENCAO],
      ['INVESTIGAR', '≥ 3%: procure avaliação', LVL.INVESTIGAR],
    ];
    lv.forEach(([name, rule, c], i) => {
      const x = 0.5 + i * (w + gap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.75, w, h: 0.95, rectRadius: 0.1, fill: { color: c.fill },
        line: { type: 'none' }, objectName: `nivel-${i + 1}` });
      s.addText([
        { text: name, options: { bold: true, color: c.color, fontSize: 18, breakLine: true } },
        { text: rule, options: { color: HEX.dk1, fontSize: 14 } },
      ], { x: x + 0.25, y: 4.75, w: w - 0.5, h: 0.95, valign: 'middle', margin: 0, isTextBox: true });
    });
    s.addText([
      { text: 'A conta: ', options: { bold: true, color: HEX.dk2 } },
      { text: 'logit(chance final) = logit(chance de partida) + Σ ln(LR de cada pista).  ', options: { color: HEX.dk1 } },
      { text: 'Próxima pergunta: ', options: { bold: true, color: HEX.dk2 } },
      { text: 'a que mais muda o risco (Σ |ln LR| ÷ custo).', options: { color: HEX.dk1 } },
    ], { x: 0.5, y: 5.95, w: 12.3, h: 0.7, fontSize: 14, margin: 0, valign: 'top', isTextBox: true });
    s.addNotes('Raciocínio bayesiano: a mesma lógica de um médico, com a conta à mostra. Ponto de partida: chance em 2 anos para a '
      + 'idade e o sexo, a mesma definição dos estudos CAPER que embasam o NICE. Cada pista multiplica a chance; a força vem de '
      + 'estudos publicados. Limites: 3% investigar (NICE NG12); 1% ou 2 vezes a média, atenção. A próxima pergunta é a que mais '
      + 'muda o resultado, por isso o teste é curto.');
  }

  // ─── 4. Roberto ──────────────────────────────────────────
  pres.addSection({ title: 'Demonstração' });
  {
    const s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Demonstração' });
    s.addText('Sr. Roberto, 63: de 2 em 1.000 para INVESTIGAR', { placeholder: 'title' });
    s.addText('Ex-fumante (35 maços-ano, parou há 8 anos). Contou que o intestino mudou e anda cansado.',
      { x: 0.5, y: 1.2, w: 12.3, h: 0.45, fontSize: 16, color: C.accent5, margin: 0, isTextBox: true });
    // números grandes
    card(s, 0.5, 1.9, 4.6, 3.75, 'card-numeros');
    s.addText('0,16%', { x: 0.8, y: 2.05, w: 4.0, h: 0.8, fontSize: 44, bold: true, color: C.text2, margin: 0,
      isTextBox: true, fontFace: THEME.headFontFace });
    s.addText('média de homens de 60–64 anos em 2 anos (~2 em 1.000)', { x: 0.8, y: 2.85, w: 4.0, h: 0.6,
      fontSize: 14, color: C.accent5, margin: 0, valign: 'top', isTextBox: true });
    s.addText('≥ 20%', { x: 0.8, y: 3.6, w: 4.0, h: 0.8, fontSize: 44, bold: true, color: 'C2410C', margin: 0,
      isTextBox: true, fontFace: THEME.headFontFace });
    s.addText('com as pistas: mais de 1 em 5', { x: 0.8, y: 4.4, w: 4.0, h: 0.4, fontSize: 14, color: C.accent5,
      margin: 0, isTextBox: true });
    pill(s, 'COLORRETAL · INVESTIGAR', 0.8, 4.95, 3.2, LVL.INVESTIGAR.fill, LVL.INVESTIGAR.color, 'selo-roberto');
    // gráfico das pistas (LR+)
    s.addChart(pres.charts.BAR, [{
      name: 'LR+',
      labels: ['Mudança do hábito intestinal', 'Perda de 9,5% do peso (balança)', 'Anemia, Hb 10,9 g/dL', 'Sangue oculto nas fezes (FIT)'],
      values: [3.9, 5.1, 5.2, 13.2],
    }], {
      x: 5.4, y: 1.9, w: 7.4, h: 3.35, barDir: 'bar',
      showTitle: true, title: 'Quanto cada pista multiplica a chance (LR+)', titleFontSize: 14, titleColor: HEX.dk2,
      titleFontFace: '+mn-lt',
      chartColors: [HEX.accent1], showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '"×"0.0',
      dataLabelFontSize: 14, dataLabelColor: HEX.dk1, dataLabelFontFace: '+mn-lt',
      catAxisLabelColor: HEX.dk1, catAxisLabelFontSize: 13, catAxisLabelFontFace: '+mn-lt',
      valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
      valAxisMaxVal: 16, showLegend: false, barGapWidthPct: 60,
    });
    s.addText('Fontes: Lee 2014 (FIT, 19 estudos); Hamilton 2005 (CAPER colorretal, 349 casos). Prior: GLOBOCAN 2022 calibrado pelo INCA 2026.',
      { x: 5.4, y: 5.3, w: 7.4, h: 0.4, fontSize: 11, color: C.accent5, margin: 0, isTextBox: true });
    s.addText([
      { text: 'Próximo passo: ', options: { bold: true, color: HEX.dk2 } },
      { text: 'avaliação médica com colonoscopia. Como ex-fumante, também a TC de pulmão de baixa dose (consenso 2024).', options: { color: HEX.dk1 } },
    ], { x: 0.5, y: 6.1, w: 12.3, h: 0.7, fontSize: 14, margin: 0, valign: 'top', isTextBox: true });
    s.addNotes('Demo: login da médica, paciente Roberto, painel de riscos. Para a idade dele, a chance de câncer de intestino em 2 '
      + 'anos é cerca de 2 em 1.000 (0,157%). A balança registrou 84 para 76 kg em 90 dias, o hemograma tem anemia (Hb 10,9), '
      + 'o FIT deu positivo e ele contou que o intestino mudou. O risco passa de 20%: INVESTIGAR. Com 35 maços-ano e 8 anos sem '
      + 'fumar, também a TC de pulmão de baixa dose. Se perguntarem pelo número: a conta pura passa de 40% (45 a 68%, conforme '
      + 'as respostas), mas a tela mostra "≥ 20%" porque FIT e anemia andam juntos e o Naive Bayes superestima pistas '
      + 'correlacionadas. Conferir os números na tela antes da apresentação.');
  }

  // ─── 5. Três pacientes ───────────────────────────────────
  {
    const s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Demonstração' });
    s.addText('Três pacientes, três histórias', { placeholder: 'title' });
    const ps = [
      ['Roberto Alves, 63', 'COLORRETAL · INVESTIGAR', LVL.INVESTIGAR,
        'Balança: −9,5% do peso em 90 dias. Anemia (Hb 10,9). FIT positivo.',
        'Colonoscopia e consulta. TC de pulmão de baixa dose.',
        'Pulseira, exames e sintomas somando evidência.'],
      ['Marina Azevedo, 34', 'MAMA · ATENÇÃO', LVL.ATENCAO,
        'Mãe teve câncer de mama aos 41. Preventivo atrasado.',
        '2,2× a média (~1 em 1.000): mamografia a partir dos 31, se o risco alto for confirmado. Teste de DNA-HPV.',
        'O plano de exames muda pela família, mesmo com risco baixo.'],
      ['João Carlos, 58', 'CÂNCER · ROTINA', LVL.ROTINA,
        'Diabetes e pressão alta, que o app já acompanha. Nenhum sinal de câncer.',
        'FIT pela idade (50–75). PSA: conversar com o médico.',
        'A IA também diz quando não há motivo para alarme de câncer.'],
    ];
    const w = 3.85, gap = 0.375, y = 1.4, h = 5.35;
    ps.forEach(([who, lvl, c, data, rec, shows], i) => {
      const x = 0.5 + i * (w + gap);
      card(s, x, y, w, h, `paciente-${i + 1}`);
      s.addText(who, { x: x + 0.25, y: y + 0.25, w: w - 0.5, h: 0.45, fontSize: 20, bold: true, color: C.text1,
        margin: 0, isTextBox: true, fontFace: THEME.headFontFace });
      pill(s, lvl, x + 0.25, y + 0.8, w - 0.5, c.fill, c.color, `nivel-paciente-${i + 1}`);
      const block = (label, text, yy, hh) => s.addText([
        { text: label, options: { bold: true, color: HEX.accent5, fontSize: 11, charSpacing: 1, breakLine: true } },
        { text, options: { color: HEX.dk1, fontSize: 14 } },
      ], { x: x + 0.25, y: yy, w: w - 0.5, h: hh, margin: 0, valign: 'top', isTextBox: true, paraSpaceAfter: 2 });
      block('OS DADOS', data, y + 1.45, 1.1);
      block('A IA RECOMENDA', rec, y + 2.6, 1.45);
      block('O QUE DEMONSTRA', shows, y + 4.1, 1.05);
    });
    s.addNotes('Pacientes fictícios do seed. Marina: 2,2 vezes a média pela mãe (Collaborative Group 2001); rastreamento de alto risco '
      + 'a partir de 10 anos antes do caso mais jovem (CBR/SBM/Febrasgo 2023). João: FIT a cada 2 anos dos 50 aos 75 (INCA 2026); '
      + 'PSA em decisão compartilhada (Nota Técnica 9/2023). Cada persona é também um teste automático.');
  }

  // ─── 6. Base da IA ───────────────────────────────────────
  pres.addSection({ title: 'Base da IA' });
  {
    const s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Base da IA' });
    s.addText('Base da IA: os números foram para o banco', { placeholder: 'title' });
    const head = (t) => ({ text: t, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 }, fontSize: 13 } });
    const rows = [
      [head('Pista'), head('Câncer'), head('LR+'), head('Fonte'), head('Conf.')],
      ['Sangue oculto nas fezes (FIT)', 'Colorretal', '13,2', 'Lee 2014', 'A'],
      ['Sangramento retal', 'Colorretal', '10,1', 'Hamilton 2005', 'A'],
      ['Nódulo na mama', 'Mama', '55,1', 'Walker 2014', 'A'],
      ['Hemoptise', 'Pulmão', '13,3', 'Hamilton 2009', 'B'],
      ['Tosse > 3 semanas', 'Pulmão', '1,6', 'Haastrup 2020', 'C'],
    ];
    s.addTable(rows, { x: 0.5, y: 1.45, w: 7.3, colW: [2.65, 1.3, 0.8, 1.85, 0.7], fontSize: 13, color: HEX.dk1,
      border: { type: 'solid', pt: 0.75, color: HEX.accent6 }, rowH: 0.55, valign: 'middle', margin: [0, 0.08, 0, 0.08] });
    s.addText('Cada número tem fonte, população e grau de confiança (A, B ou C). Os de grau C ficam marcados para a médica revisar.',
      { x: 0.5, y: 4.95, w: 7.3, h: 0.7, fontSize: 14, color: C.accent5, margin: 0, valign: 'top', isTextBox: true });
    // fluxo da edição
    const flow = ['A médica edita um valor', 'O resultado muda na hora', 'Histórico: quem, quando, de → para', '"Restaurar padrão" desfaz'];
    flow.forEach((t, i) => {
      const y = 1.45 + i * 0.98;
      card(s, 8.3, y, 4.5, 0.78, `fluxo-${i + 1}`);
      circleNum(s, i + 1, 8.45, y + 0.17, 0.44, `fluxo-num-${i + 1}`);
      s.addText(t, { x: 9.05, y, w: 3.65, h: 0.78, fontSize: 15, color: C.text1, valign: 'middle', margin: 0, isTextBox: true });
    });
    s.addText([
      { text: 'Qualidade: ', options: { bold: true, color: HEX.dk2 } },
      { text: 'as 8 crônicas respondem igual à versão anterior (golden master); a soma das contribuições é testada em 400 perfis; os testes rodam em Windows, macOS e Linux a cada mudança.', options: { color: HEX.dk1 } },
    ], { x: 0.5, y: 5.95, w: 12.3, h: 0.8, fontSize: 14, margin: 0, valign: 'top', isTextBox: true });
    s.addNotes('Separar dados (mudam com a ciência) de lógica (como calcular, coberta por testes). Demo: Base da IA, FIT positivo, '
      + 'mudar o valor, voltar ao Roberto e ver o risco mudar, depois Restaurar padrão. No site público a edição fica desligada (KB_EDIT=false).');
  }

  // ─── 7. Limites, próximos passos e QR ────────────────────
  pres.addSection({ title: 'Fecho' });
  {
    const s = pres.addSlide({ masterName: 'FECHO_ESCURO', sectionTitle: 'Fecho' });
    s.addText('O que ele não faz, e o que vem depois', { placeholder: 'title' });
    const col = (title, items, x, w, name) => {
      s.addText(title, { x, y: 1.45, w, h: 0.45, fontSize: 18, bold: true, color: C.accent6, margin: 0, isTextBox: true,
        objectName: name });
      s.addText(items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })),
        { x, y: 2.0, w, h: 4.6, fontSize: 15, color: C.background1, margin: 0, valign: 'top', paraSpaceAfter: 9,
          isTextBox: true });
    };
    col('Limites e ética', [
      'Não é diagnóstico, e não foi calibrado com dados brasileiros.',
      'Naive Bayes supõe pistas independentes: com pistas que andam juntas, a tela mostra "≥ 20%".',
      'Boa parte das pistas vem de estudos de atenção primária (CAPER, Reino Unido) e de meta-análises.',
      'LGPD: o teste público não grava nada. Dado de saúde é sensível.',
      'Produto exigiria registro na ANVISA como software dispositivo médico (RDC 657/2022).',
    ], 0.5, 4.6, 'col-limites');
    col('Próximos passos', [
      'Calibrar com prontuários anonimizados, com aprovação ética.',
      'Modelar pistas correlacionadas.',
      'Validação clínica prospectiva.',
      'Revisão médica dos valores de confiança C.',
    ], 5.4, 3.6, 'col-proximos');
    // QR
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.45, y: 1.45, w: 3.35, h: 5.15, rectRadius: 0.15,
      fill: { color: C.background1 }, line: { type: 'none' }, objectName: 'cartao-qr' });
    s.addImage({ data: QR_DATA, x: 9.7, y: 1.65, w: 2.85, h: 2.85, altText: `QR code para ${URL}` });
    s.addText('Faça o teste', { x: 9.7, y: 4.6, w: 2.85, h: 0.5, fontSize: 22, bold: true, color: C.text2, align: 'center',
      margin: 0, isTextBox: true, fontFace: THEME.headFontFace });
    s.addText('2 minutos · sem cadastro · nada é gravado', { x: 9.7, y: 5.1, w: 2.85, h: 0.6, fontSize: 13, color: C.text1,
      align: 'center', margin: 0, isTextBox: true });
    s.addText(URL.replace('https://', ''), { x: 9.6, y: 5.75, w: 3.05, h: 0.5, fontSize: 11, color: C.hlink, align: 'center',
      margin: 0, isTextBox: true, fontFace: 'Courier New' });
    s.addNotes('Fecho: não é diagnóstico e não foi calibrado com dados reais; declaramos os limites na tela. O próximo passo seria validar '
      + 'com dados reais. Se quiserem testar, o QR está aqui e no banner: dois minutos, nada é gravado.');
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log(`Slides gravados: ${path.resolve(OUT)}`);
  console.log(`  QR do slide 7 aponta para ${URL}`);
})().catch((e) => { console.error(e); process.exit(1); });

