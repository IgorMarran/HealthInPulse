# FAQ da banca: HealthInPulse v8

Perguntas que a banca (ou um visitante da área de saúde) deve fazer, com a resposta curta para falar e o detalhe
para quem insistir. Todo número daqui está em `Docs/base-clinica-oncologia.md`, com a fonte, a população e o grau de
confiança (A, B ou C). Se não souber responder, diga "esse número está na base com a fonte, posso te mostrar" e abra a
tela **Base da IA**.

Sumário: [A IA](#a-ia) · [Os números](#os-números) · [Limitações](#limitações) ·
[Ética, LGPD e ANVISA](#ética-lgpd-e-anvisa) · [Engenharia](#engenharia) · [Próximos passos](#próximos-passos)

---

## A IA

### 1. Onde está a IA?

**Curta:** num motor de raciocínio probabilístico (bayesiano). Ele parte da chance média, atualiza com cada pista e
escolhe sozinho a próxima pergunta que mais muda o resultado.

**Detalhe:** é IA no sentido de sistema especialista probabilístico, não de rede neural. Para cada câncer:
`logit(chance final) = logit(chance de partida) + Σ ln(força de cada pista)`. O motor devolve, junto com o risco, a
lista de contribuições fator a fator, e um teste automático confere que a soma das partes bate com o resultado.
A escolha da pergunta usa `Σ |ln LR+| / custo` somado sobre os cânceres que valem para a pessoa (idade e sexo).
Nas 8 doenças crônicas, a escolha é por entropia (ganho de informação), como na versão anterior.

### 2. Por que não treinaram um modelo de machine learning?

**Curta:** porque não temos dados de pacientes brasileiros com desfecho, e porque em saúde o modelo precisa
explicar cada resultado.

**Detalhe:** treinar exigiria milhares de prontuários com o diagnóstico confirmado depois, autorização ética e
tratamento de dado sensível pela LGPD. Um modelo treinado com dados de outro país seria uma caixa-preta difícil de
validar. Escolhemos parâmetros publicados, com fonte, e um modelo em que cada número pode ser conferido e editado.
Calibrar com dados reais é o próximo passo (pergunta 21).

### 3. É o ChatGPT?

Não. O risco de câncer é calculado pelo motor bayesiano, local, sem internet e sem modelo de linguagem. O app tem
uma integração opcional com o GPT-4o para gerar relatórios em texto (triagem, exames). Na feira ela fica sem chave,
e o app usa o simulador local no lugar.

### 4. Como a IA escolhe a próxima pergunta?

Pela força da pergunta: quanto uma resposta "sim" tipicamente mudaria o risco dos cânceres que valem para aquela pessoa,
dividido pelo "custo" da pergunta. Ex.: para um homem de 60 anos, "sangue nas fezes" (LR ≈ 10 para colorretal) vem
antes de "rouquidão" (LR ≈ 2,6 para pulmão). Pergunta sobre mama não aparece para homem, e próstata não aparece para
mulher. Cada pergunta vem com o "por que estamos perguntando", em linguagem calma.

---

## Os números

### 5. De onde vem o ponto de partida (o "prior")?

É a chance de alguém da mesma idade e sexo receber o diagnóstico nos próximos **2 anos**, calculada como 2 × a
incidência anual. A forma por idade vem do **GLOBOCAN 2022 para o Brasil** (IARC); o total é calibrado para a taxa
bruta oficial do **INCA, Estimativa 2026** (triênio 2026–2028). Ex.: colorretal em homem de 60–64 anos = 0,157% em 2
anos, cerca de 2 em 1.000.

### 6. Por que 2 anos?

É a mesma janela dos estudos **CAPER** (Hamilton, Reino Unido), que mediram quanto cada sintoma aumenta a chance de
câncer e embasam a diretriz **NICE NG12**. Usar a mesma definição deixa o prior e a força das pistas na mesma
escala.

### 7. De onde vem a força de cada sintoma ou exame?

É a razão de verossimilhança (LR): quantas vezes o achado é mais comum em quem tem o câncer do que em quem não tem.
Nos estudos caso-controle, LR+ = (fração de casos com o achado) ÷ (fração de controles com o achado). Quando o estudo
só publica o valor preditivo positivo (VPP), `LR = odds(VPP) / odds(prior do estudo)`.

Exemplo para conferir de cabeça: sangramento retal tem VPP de 2,4% sobre um prior de 0,25% no CAPER, então
0,0246 / 0,0025 ≈ **9,8**, igual ao LR de 10 publicado (Hamilton 2005).

Outros exemplos: FIT positivo LR ≈ 13 (Lee 2014, 19 estudos); nódulo na mama LR ≈ 55 (Walker 2014, CPRD);
BI-RADS 4–5 LR ≈ 67 (Lehman 2017, 1,7 milhão de mamografias).

### 8. E os fatores de risco, como família e cigarro?

Multiplicam o ponto de partida, cada um com um risco relativo publicado. Ex.: parente de 1º grau com câncer
colorretal × 2,24 (Butterworth 2006, meta-análise de 47 estudos); mãe, irmã ou filha com câncer de mama, em mulher
com menos de 50 anos, × 2,2 (Collaborative Group 2001, 52 estudos); preventivo atrasado × 1,96 para colo do útero
(Andrae 2008, com a cobertura brasileira da PNS 2019).

Regra de projeto: **perfil (idade, sexo, IMC, fumo, família) entra só no ponto de partida; sintomas, exames e
balança entram só como pistas.** Assim nada é contado duas vezes, e um teste automático garante isso.

### 9. Por que o limite de 3% para "investigar"?

É o limiar de valor preditivo positivo que o **NICE NG12** (Reino Unido, atualizado em 2025) usa para encaminhar
por suspeita de câncer. As categorias são:
- **INVESTIGAR:** chance ≥ 3%;
- **ATENÇÃO:** chance ≥ 1% **ou** pelo menos 2 vezes a média da mesma idade e sexo;
- **ROTINA:** o resto.

### 10. Por que "2 vezes a média" já dá ATENÇÃO, mesmo com risco baixo?

Porque é isso que muda o plano de exames. A Marina tem 34 anos e chance de mama de cerca de 1 em 1.000, mas a mãe
teve câncer de mama aos 41: o risco dela é 2,2 vezes a média, e as sociedades brasileiras (CBR/SBM/Febrasgo 2023)
recomendam começar o rastreamento 10 anos antes do caso mais jovem da família, se o risco alto for confirmado.

### 11. As recomendações de exame seguem qual diretriz?

As brasileiras vigentes em outubro de 2026, com o ano na tela:
- **colorretal:** FIT a cada 2 anos dos 50 aos 75 no SUS (INCA, 2026); 45–49 como decisão compartilhada;
- **mama:** mamografia a cada 2 anos dos 50 aos 74 (Ministério da Saúde, 2025); 40–49 sob demanda;
- **colo do útero:** DNA-HPV a cada 5 anos dos 25 aos 64 (Portaria Conjunta SAES/SECTICS nº 13, 2025);
- **pulmão:** TC de baixa dose anual para 50–80 anos, ≥ 20 maços-ano, parou há menos de 15 anos (consenso
  SBCT/SBPT/CBR, 2024; ainda não é programa do SUS);
- **próstata:** o Ministério da Saúde e o INCA **não** recomendam rastrear todos os homens (Nota Técnica nº 9/2023);
  a IA indica conversa com o médico (decisão compartilhada).

---

## Limitações

### 12. O Roberto aparece com "≥ 20%". Por que não o número exato?

Porque o número exato engana. O modelo é um **Naive Bayes**: supõe que as pistas são independentes. FIT positivo e
anemia, por exemplo, andam juntos (os dois vêm de sangramento do tumor), então multiplicar as duas forças superestima
o risco. Pela conta pura, o Roberto daria entre 45% e 68%, conforme as respostas sobre sangue nas fezes e dor
abdominal. Acima de 20%, a tela mostra "≥ 20%" e a categoria, que é o que importa para a decisão: investigar.

### 13. Quais são as limitações do modelo?

- **Não é diagnóstico** e **não foi calibrado com dados reais** brasileiros.
- **Pistas correlacionadas** inflam o risco (pergunta 12).
- **Boa parte dos LRs vem de estudos de atenção primária** (CAPER e CPRD, Reino Unido) e de meta-análises. Num
  visitante de feira, um "sim" tende a pesar um pouco mais do que deveria.
- **HPV e Papanicolau** foram validados para lesão precursora (CIN2+), não só para câncer invasivo.
- **Próstata:** o PSA acha tumores que nunca dariam sintoma, o que infla tanto a incidência (o prior) quanto a força
  do sintoma urinário. Por isso a recomendação para esse caso é **conversar sobre o PSA**, não "câncer provável".
- **Valores de confiança C** (tosse, falta de ar, rouquidão, pele da mama, sangramentos do colo, o fator "nunca
  fumou") têm poucos casos ou são estimativa da equipe: estão marcados para a médica revisar.

### 14. Os números de estudos estrangeiros servem para brasileiros?

Em parte. O **ponto de partida** é brasileiro (INCA 2026 + GLOBOCAN Brasil), e é ele que mais pesa para quem não tem
sintomas. A **força das pistas** (LR) tende a ser mais estável entre populações do que a incidência, porque compara doentes
com não doentes, mas ainda assim vem de outro sistema de saúde. É a primeira coisa a recalibrar com dados reais.

### 15. Exame normal diminui o risco?

Sim. Cada pista tem o "sim" (LR+) e o "não" (LR−). Um FIT negativo, por exemplo, divide a chance de câncer
colorretal (LR− = (1 − 0,79) / (1 − 0,06) ≈ 0,22). Um "não" em pergunta também conta, só que menos.

---

## Ética, LGPD e ANVISA

### 16. Vocês guardam os dados de quem faz o teste no stand?

**Não.** O teste público (`/teste`) não tem cadastro, não grava no banco e não entra no log de requisições (o
servidor ignora `/api/public/`): o celular manda as respostas, o servidor calcula e devolve o resultado, e nada fica. Dado de saúde é **dado pessoal
sensível** pela LGPD (Lei 13.709/2018), então a decisão foi não coletar. As perguntas mais íntimas podem ser
respondidas no próprio celular, pelo QR, sem ninguém do lado.

### 17. E os pacientes do app com login?

São **fictícios** (Roberto, Marina, João e a Dra. Ana). Num produto real, os dados do paciente exigiriam base legal
para dado sensível, consentimento, controle de acesso (já existe: a médica só vê pacientes vinculados) e registro de
quem acessou.

### 18. O que acontece se o visitante tirar "INVESTIGAR"?

A tela não usa vermelho (oncologia é verde, âmbar e laranja) e diz "não é diagnóstico". A mensagem para o visitante
é: **é uma estimativa, não um diagnóstico; só uma avaliação médica diz o que é.** Na faixa de ATENÇÃO, e em muitos
casos de INVESTIGAR, a causa não é câncer, mas só o médico confirma. O próximo passo é procurar avaliação médica, sem
urgência inventada. A equipe tem um roteiro de acolhimento (`checklist-stand.md`): ouvir, explicar o que é risco, não
interpretar o caso pessoal.

### 19. Isso precisaria de registro na ANVISA?

Para virar produto, provavelmente sim. A **RDC 657/2022** da ANVISA trata do **software como dispositivo médico**
(SaMD): software que estima risco de doença e orienta conduta tem finalidade médica. O registro exigiria definir o
uso pretendido, classificar o risco, ter validação clínica, gestão de risco e controle de versões. Hoje é um projeto
acadêmico, com aviso explícito de que não é diagnóstico.

### 20. Se a médica pode editar os números, alguém não pode estragar o modelo?

No app, só o perfil **médico** edita, e toda edição vira uma versão com autor, data, valor antigo e novo. Existe
"Restaurar padrão". A edição é **fechada por padrão**: só liga com `KB_EDIT=true` explícito (aceita também 1, yes, on). No site público (Render) fica **desligada** (`KB_EDIT=false`) e a tela mostra "só leitura"; só no notebook do stand (`npm run stand` liga) ela
está ativa para a demonstração. Num produto, a mudança passaria por revisão (dois médicos) antes de valer.

---

## Engenharia

### 21. Como vocês garantem que não quebrou nada?

- **Teste de regressão (golden master):** antes de mexer no motor, gravamos as respostas da versão anterior (priors
  numa grade de perfis, cerca de 80 cálculos com evidências sorteadas, 25 triagens simuladas e os alertas). Depois da
  reforma, as 8 doenças crônicas respondem igual, com tolerância de 10⁻¹².
- **Testes de matemática:** um caso calculado à mão e a invariante "prior + soma das contribuições = resultado" em 400
  perfis aleatórios.
- **Personas como teste:** Roberto em INVESTIGAR, uma mulher de 22 anos com tudo em ROTINA, e nunca próstata para
  mulher.
- **CI:** cada mudança roda os testes em Windows, macOS e Linux antes de entrar.

### 22. Por que os números estão no banco e não no código?

Separar **dados** (mudam com a ciência) de **lógica** (como calcular, coberta por testes). Com os números numa
tabela, com a fonte ao lado, a médica ajusta sem programador e sem publicar uma nova versão, e o histórico mostra de
onde veio cada resultado.

### 23. Como a pulseira e a balança entram?

A balança Care Plus mede o peso ao longo do tempo. Uma queda de 5% ou mais em até 180 dias vira a pista "perda de
peso medida", com a força da perda de peso do CAPER (LR ≈ 5 para colorretal, ≈ 6 para pulmão). Quando existe a
medida, a perda de peso só "relatada" é ignorada, para não contar a mesma coisa duas vezes.

---

## Próximos passos

### 24. O que falta para isso virar produto?

1. **Calibração com dados reais:** estudo retrospectivo com prontuários anonimizados de uma operadora ou hospital,
   aprovado em comitê de ética. Comparar o risco previsto com o diagnóstico em 2 anos (curva de calibração e
   discriminação), e recalibrar os pontos de partida e as forças.
2. **Modelar pistas correlacionadas** (ex.: FIT e anemia juntos) em vez de supor independência.
3. **Validação clínica prospectiva** e o caminho regulatório da ANVISA (pergunta 19).
4. **Revisão médica** dos parâmetros de confiança C, e governança para editar a base.
5. Mais cânceres (pele está na lista) e lembrete de rastreamento em dia ou atrasado.

### 25. Por que esses cinco cânceres?

Estão entre os mais frequentes no Brasil (INCA 2026: próstata 74,6 e mama 71,6 casos novos por 100 mil por ano;
colorretal cerca de 25; pulmão 15 a 18; colo do útero 17,6) e todos têm exame de rastreamento ou sinais de alerta
estudados em atenção primária. Câncer de pele ficou para depois por prazo.
