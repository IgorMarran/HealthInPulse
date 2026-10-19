# Pitch: HealthInPulse v8 na feira (sáb 24/10/2026)

Dois tamanhos: **30 segundos** para quem passa pelo stand e **3 minutos** para a banca ou para quem parou para ouvir.
Números conferidos com `Docs/base-clinica-oncologia.md` (fonte de cada um lá). Os resultados dos pacientes vêm do
motor (`riskEngine`) com os dados atuais e podem mudar um pouco se a base for ajustada: confira na tela antes de citar.

Regras para quem fala:
- Nunca diga "a IA diagnostica" ou "a IA detecta câncer". Diga **"estima o risco"**, **"indica o exame"**, **"mostra o porquê"**.
- Para o visitante, fale em **categoria** e em **"quantas vezes a média"** ou **"tantas em cada 1.000 pessoas"**, não só em porcentagem.
- Se alguém ficar preocupado com o resultado, siga o acolhimento do `checklist-stand.md`.

---

## 30 segundos (visitante)

> Você sabe qual exame de câncer deveria fazer, e a partir de que idade? Quase ninguém sabe.
>
> O HealthInPulse é um app de saúde ligado à pulseira e à balança da Care Plus. Agora ele estima o risco de **cinco
> cânceres frequentes no Brasil**: mama, próstata, intestino, pulmão e colo do útero.
>
> Ele começa pela média brasileira da sua idade e sexo, ajusta com cada resposta, e te mostra **o porquê** de cada
> número, com a fonte, e **qual exame de rastreamento** faz sentido para você.
>
> Não é diagnóstico. É para saber o que perguntar ao médico. Aponta a câmera aqui no QR: são dois minutos e **nada é
> gravado**.

---

## 3 minutos (banca)

Marcação de tempo aproximada. Quem demonstra fica no notebook; quem fala, de frente para a banca.

### 0:00 a 0:25 · O problema

> Câncer achado cedo tem outro desfecho, e existem exames de rastreamento para isso. Mas cada exame tem idade e
> público certos, e essas regras mudaram agora: em 2025 o Ministério da Saúde ampliou a mamografia para 50 a 74 anos
> e fez do teste de DNA-HPV o exame principal do colo do útero; em 2026 o SUS passou a rastrear câncer de intestino com o teste de
> sangue oculto nas fezes, dos 50 aos 75. A maioria das pessoas não sabe qual é o seu.

### 0:25 a 1:00 · O que fizemos

> O HealthInPulse já acompanhava 8 doenças crônicas com a pulseira Care Plus. Nesta versão, ele estima o risco de 5
> cânceres e faz três coisas:
> 1. **estima o risco** em 2 anos, comparado com a média da mesma idade e sexo;
> 2. **explica o porquê**, fator a fator, com a fonte de cada número;
> 3. **indica o próximo passo**: o exame de rastreamento da diretriz brasileira, ou procurar avaliação médica.
>
> E todos os números saíram do código e foram para o **banco de dados**, com fonte, onde a médica pode editar.

### 1:00 a 1:40 · Como a IA pensa

> É raciocínio bayesiano: a mesma lógica de um médico, só que com a conta à mostra.
> - **Ponto de partida:** a chance de alguém da sua idade e sexo receber o diagnóstico em 2 anos. Vem do INCA
>   (Estimativa 2026) e do GLOBOCAN 2022 para o Brasil.
> - **Cada pista multiplica a chance.** A força de cada sintoma ou exame vem de estudos publicados, como os estudos
>   CAPER, do Reino Unido, que embasam a diretriz do NICE.
> - **Limites claros:** a partir de **3%** de chance a recomendação é investigar. Esse corte é o da diretriz
>   NICE NG12.
>
> E a próxima pergunta não é fixa: a IA escolhe a que mais muda o resultado. Por isso o teste é curto.

### 1:40 a 2:25 · Demonstração: o Sr. Roberto

*(no notebook: login da médica → paciente Roberto → painel de riscos)*

> O Roberto tem 63 anos e é ex-fumante. Para um homem da idade dele, a chance de câncer de intestino em 2 anos é de
> cerca de **2 em 1.000**. Mas a balança Care Plus registrou que ele perdeu peso, de 84 para 76 kg em 3 meses; o
> hemograma mostra anemia; o exame de sangue oculto nas fezes deu positivo; e ele contou que o intestino mudou.
>
> Cada pista multiplica a chance, e o risco passa de **20%**. A categoria é **INVESTIGAR**: o próximo passo é a
> avaliação médica, com colonoscopia. E como ele fumou 35 maços-ano e parou há 8 anos, a IA também indica a
> **tomografia de pulmão de baixa dose**, pelo consenso brasileiro de 2024.

### 2:25 a 2:45 · A base é editável

*(Base da IA → Simular em paciente: Roberto → LR+ do FIT de 13,17 para 2: o risco cai de 44,8% para 11,0% → Histórico → "Restaurar padrão")*

> Se a médica discordar de um número, ela muda aqui. O resultado do Roberto muda na hora, e o sistema guarda quem
> mudou, quando e de quanto para quanto. É a mesma ideia do Git, aplicada aos dados da IA.

### 2:45 a 3:00 · Limites e fecho

> Não é diagnóstico e não foi calibrado com pacientes brasileiros: é uma triagem com números da literatura, e a gente
> declara os limites na tela. O próximo passo seria validar com dados reais. Se quiserem testar, o QR está no
> banner: dois minutos, e nada é gravado.

---

## Se perguntarem "e a Marina e o João?" (30 s extras)

> **Marina**, 34 anos: a mãe teve câncer de mama aos 41. O risco dela ainda é baixo, cerca de **1 em 1.000**, mas é
> **2,2 vezes** a média da idade dela, então a categoria é **ATENÇÃO** e o rastreamento de mama pode começar mais
> cedo, a partir dos 31 (10 anos antes da idade da mãe), se a médica confirmar o risco alto. O preventivo está
> atrasado, então ela também recebe a indicação do teste de DNA-HPV.
>
> **João**, 58 anos: nenhum sinal de câncer nos dados, categoria **ROTINA**. A IA indica o rastreamento de intestino
> pela idade e, sobre o PSA, conversar com o médico, porque o Ministério da Saúde não recomenda o exame para todos os
> homens sem sintomas. A IA também sabe dizer quando não há motivo para alarme de câncer.
