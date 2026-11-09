# Geoprova 0.5

Aplicativo em português para analisar localmente JSONs da Linha do Tempo do Google. Não certifica prova, autenticidade, admissibilidade judicial ou jornada de trabalho.

## Executar como site (recomendado)

Node.js 24 e npm 11. Não são necessários chave de API, cartão ou Google Cloud.

```sh
cd /workspace/Geoprova
npm ci
npm test
npm run build
npm start
```

O servidor usa a porta 3000; `PORT` permite alterar. Em hospedagem, disponibilize HTTPS. `npm run dev` e `npm run preview` também incluem a rota local de sugestões. A CSP bloqueia HMR: atualize a página após editar. Node é iniciado com `--use-env-proxy`, preservando proxy e verificação TLS.

### Fluxo da localização

Digite pelo menos três caracteres de um endereço ou nome do estabelecimento, de preferência incluindo a cidade. Após uma pausa de 700 ms, aparecem sugestões Photon/komoot. Escolha um resultado: latitude/longitude são aplicadas automaticamente, e o Leaflet mostra o ponto e o raio de 20 m sobre OpenStreetMap. O marcador pode ser arrastado ou reposicionado por clique. Confirme a área antes de analisar. Editar o texto invalida a seleção anterior.

Não há caixinha de ativação, chave de API ou cópia de coordenadas no fluxo principal. Uma alternativa manual fica recolhida para indisponibilidade do serviço. A busca não escolhe arbitrariamente a primeira sugestão; o botão Buscar/Enter aplica automaticamente quando há um único resultado.

### Por que um servidor pequeno?

Na versão de site, o navegador consulta apenas `/api/places?q=...` no próprio site. O servidor encaminha a consulta a um host fixo Photon. Isso evita CORS entre o navegador e o provedor, mas não resolve indisponibilidade nem bloqueios de saída do servidor. Ele **não recebe o JSON da Linha do Tempo nem os relatórios** e não possui rota de upload. Somente a consulta de endereço/nome passa por ele.

O servidor aceita apenas GET/HEAD, limita a uma consulta externa por segundo, limita o tamanho da consulta e mantém até 256 respostas em cache de memória por até 24 h. Não grava arquivos de consulta nem imprime endereços nos logs do aplicativo. Ao hospedar, desative/redija logs de query string na infraestrutura. Restrições de proxy/TLS são mantidas. Permita `photon.komoot.io` para o servidor e `tile.openstreetmap.org` para imagens no navegador.

Photon e o servidor público de imagens OSM são gratuitos, com limites, cobertura variável e sem SLA. Não prometemos disponibilidade ou serviço ilimitado. Uso público em escala requer avaliar políticas dos provedores e infraestrutura própria/alternativa; isso pode ter custo. Leaflet é uma biblioteca local, sem CDN. Atribuição OSM permanece visível no mapa.

## HTML único

```sh
npm run bundle
```

Gera `artifacts/Geoprova-0.5.html`, com código, estilos, mapa Leaflet e gerador XLSX incorporados. A análise e a exportação dispensam servidor. Nesse formato, a consulta Photon é **direta**, podendo ser bloqueada por CORS/arquivo local ou pelo provedor. O HTML único não pode incorporar o servidor Node; por isso o site é o caminho recomendado para eliminar essa classe de bloqueio. O bundle também precisa de Internet para sugestões e imagens do mapa.

## Análise e exportação

1. Importe o JSON exportado pelo celular. SHA-256 é calculado nos bytes exatos antes do parse. Salve a cópia original se necessário.
2. Escolha e confirme o estabelecimento e a área.
3. Selecione datas inclusivas e fuso IANA. O diagnóstico informa leitura, pontos reconhecidos e distância mínima da área, sem aumentar o raio automaticamente.
4. Examine a tabela: data, chegada, saída e permanência, com cada visita/retorno separado; subtotais semanais (segunda a domingo) e mensais.
5. Exporte XLSX, JSON e manifesto separado. Imprima/salve PDF pelo navegador. Downloads múltiplos podem exigir autorização do navegador.

Os totais usam união dos intervalos diários recortados no período, sem dupla contagem de sobreposições. Dias não apuráveis ficam nulos, não zero. Totais parciais e dias sem duração são indicados. Precisão não aparece na tabela principal, mas permanece nos registros de suporte, sem confusão com probabilidade semântica. Datas/durações XLSX são valores próprios; `[h]:mm:ss` suporta mais de 24 h. Fuso é registrado separadamente, pois células de planilha não têm fuso.

A planilha contém metodologia/integridade antes dos resultados, resumo diário com subtotais semanais, totais mensais, entradas/saídas detalhadas e registros de suporte. Alertas individuais permanecem por registro e resultado afetado. O PDF de impressão não é assinado e não está no manifesto XLSX/JSON. O manifesto verifica identidade dos bytes em relação ao manifesto fornecido, não autoria.

## Privacidade e limites

JSON, coordenadas do histórico e relatórios são processados no navegador. Não há telemetria. Ao digitar a busca, a consulta é enviada ao Photon e, no site, também ao servidor Geoprova; isso é informado junto ao campo. O provedor do mapa recebe a área visualizada e dados da conexão. Selecionar um estabelecimento não envia o histórico importado. Os arquivos permanecem na memória da aba; salve as exportações antes de fechá-la.

A origem suporta semanticSegments, rawSignals de posição e preserva userLocationProfile. Coordenadas Android com graus são reconhecidas. Campos desconhecidos permanecem no original, sem invenção de valores. Cobertura por extremos não significa coleta contínua. Posições isoladas não viram permanência contínua. Fim do último segmento não comprova saída. Ponto de trajeto fora do pequeno raio não gera inconsistência por esse fato isolado.

Critérios experimentais versionados alertam sobre isTimelessVisit booleano false e segmentos estritamente compostos por horários/fuso; zero na probabilidade é fundamento adicional, não requisito. Correções podem ser legítimas. Os critérios não detectam toda edição ou exclusão e não qualificam fraude. Hash não comprova origem Google nem alterações anteriores à importação. Não há aquisição Android, assinatura institucional ou QR/verificador oficial implementados.

## Validação

`npm test`: análise, alertas, coordenadas com graus, datas/fusos/DST, sobreposições, recortes, precisão preservada, totais, XLSX, reprodução, parsing das sugestões, cache e restrições da rota. Chromium: digitação, seleção automática, Leaflet, invalidação ao editar, análise e exportação; serviços de localização foram simulados nesses testes.

A consulta real a Photon e OSM neste ambiente retornou `CONNECT 403` do proxy antes de alcançar os provedores. Os domínios foram salvos no rascunho de rede para revisão; a conectividade real continua pendente de aplicação dessa configuração. Publicação do ambiente e implantação de um site não foram realizadas. Os JSONs originais dos testes do pedido não foram fornecidos: sua validação permanece pendente.

## Testar pelo GitHub Pages

O aplicativo completo está em `docs/index.html`, sem servidor Node ou instalação no computador. No GitHub, acesse Settings → Pages → Source: Deploy from a branch → Branch: entrega-geoprova → Folder: /docs → Save. O endereço esperado após a publicação é https://jessecenci-png.github.io/Geoprova/ . A publicação depende das configurações e da disponibilidade do GitHub Pages para este repositório. O arquivo .nojekyll evita processamento do HTML compilado.

Essa edição é estática e consulta o Photon diretamente. O histórico e os relatórios continuam no navegador; busca e imagens dependem dos provedores externos. Preparar os arquivos não confirma que o Pages foi ativado ou que as consultas reais funcionam. A tentativa de consultar/configurar o Pages pela API deste ambiente retornou Forbidden.

## Correção 0.5.1 — posições sem visita e datas

As datas de entrada e apresentação usam DD-MM-AAAA (meses, MM-AAAA). O JSON reproduzível e os dados técnicos preservam ISO; células XLSX continuam como datas com formato dd-mm-yyyy. Datas inválidas são rejeitadas.

Posições dentro da área que não estejam cobertas por uma visita agora aparecem no resumo como primeira/última posição registrada, inclusive quando existem outras visitas naquele dia. Separações por ponto externo ou lacuna acima do limite produzem linhas diferentes. Esses horários não são tratados como chegada/saída exatas e não viram duração contínua. Os totais mantêm apenas intervalos de visitas apuráveis e indicam parcialidade quando restam posições sem duração.

Caso reproduzido: visita mais próxima a 70,8 m, posições a 3 m e raio 50 m. A visita fica fora da área, mas as posições devem continuar visíveis. O programa não amplia o raio nem conclui ausência. A correção foi validada com dados sintéticos equivalentes, sem acesso ao histórico do usuário.

## Relatório diário 0.6

Cada dia ocupa uma única linha, com data DD-MM-AAAA, dia da semana, Entrada 1, Saída 1, Entrada 2, Saída 2 e permanência. Se houver mais intervalos, novos pares são acrescentados; retornos não são omitidos. Posições sem visita continuam explicitamente identificadas e não ganham duração contínua.

Os segundos são descartados em cada extremo antes do cálculo (sem arredondar para o minuto mais próximo). A mesma regra é usada na duração por intervalo, união diária e totais semanais/mensais, com exibição HH:MM e duração h/min. Os horários completos originais permanecem nos dados de suporte/ISO para rastreabilidade. A versão dos critérios foi atualizada.

## Apresentação simplificada 0.6.1

Raio inicial: 100 m, ajustável. Removido o texto sobre cache, servidor e funcionamento interno do provedor do formulário. Mantidos um aviso curto de privacidade e uma indicação de que a busca/mapa consultam serviços externos; informações complementares ficam recolhidas. A orientação de exportação pelo Android é preservada.

O relatório principal começa pela identificação do local, período, tabela diária e totais. Metodologia, diagnóstico, aquisição e JSON de parâmetros ficam em uma seção recolhida e não são incluídos na impressão. A identificação do arquivo e seu hash ficam em rodapé discreto. Alertas específicos continuam associados aos registros, com descrição resumida na tela e fundamentos completos no suporte.

A planilha abre em Resumo diário, seguida de Totais mensais e Informações do relatório. Entradas e saídas, Metodologia e integridade e Registros de suporte ficam ocultas, podendo ser reexibidas pelo leitor. Dados e rastreabilidade não foram excluídos.

## Apresentação 0.6.2

Confirmação do local com área clicável e checkbox maiores. Alertas resumidos: Possível alteração do registro e Possível remoção do registro, com fundamentos preservados no suporte, sem conclusões automáticas de validade jurídica.

Posições isoladas deixam de ser duplicadas em Entrada/Saída. Cada horário em minutos aparece uma vez por dia na coluna Posições registradas; múltiplas fontes ou segundos diferentes no mesmo minuto permanecem nos registros de suporte. Somente visitas com intervalo usam pares Entrada/Saída. Isso evita dezenas de colunas vazias e mantém o total diário à vista. A tabela inclui subtotais semanais e há tabelas/abas próprias de totais semanais e mensais. Duração não apurável permanece nula quando só há posições esparsas.

## Cartão de permanência 0.7

Uma linha por data, com Entrada 1/Saída 1, Entrada 2/Saída 2 e total do dia; subtotal semanal imediatamente depois do último dia de cada semana. Ao final do relatório principal fica apenas o resumo mensal. A aba semanal auxiliar é oculta; o resumo diário do XLSX já contém os subtotais locais.

O usuário autorizou o modo de pares estimados: por padrão no formulário, visitas e pares consecutivos de posições, identificado por † nos horários e totais e registrado em positionPairing=consecutive. A opção Somente intervalos de visitas desativa a estimativa. Os pontos são ordenados por dia no fuso escolhido, os segundos são descartados e agrupam-se marcas a até um minuto da primeira marca do grupo, preservando a primeira como representante e todas as referências de origem. Os grupos são pareados 1–2, 3–4 etc. Um número ímpar mantém o último horário sem saída e o total parcial. Não são criados horários finais nem pares entre dias diferentes.

Posições no mesmo minuto ou até um minuto do limite de uma visita ficam apenas como apoio e não alteram a visita. Visitas sobrepostas são unidas apenas na apresentação, preservando os registros e alertas de origem. Retornos reais não sobrepostos a um minuto de distância não são apagados. Totais usam a união dos intervalos de visita e dos pares estimados completos, sem dupla contagem. O arquivo original nunca é modificado. Esses pares são uma hipótese de apuração autorizada pelo usuário, não comprovação de entrada/saída ou permanência contínua.

## Apuração espacial 0.8 — substitui o pareamento da 0.7

O padrão passa a ser Posições: chegada e saída por transições. Chegada é a janela entre a posição externa anterior e a primeira posição interna; saída é a janela entre a última posição interna e a externa seguinte. Não se usam pares de pontos internos para presumir entrada/saída. Sem apoio externo próximo no tempo, o limite fica Não determinado, acompanhado da primeira/última presença efetivamente registrada. A opção Somente intervalos de visitas continua separada; no modo espacial, as visitas Google são preservadas em semanticPeriods e nos registros de suporte, sem se transformarem em transições físicas. O modo consecutive anterior é rejeitado.

Sessões são interrompidas por ponto fora, amostras contraditórias no mesmo instante ou lacunas acima do limite configurado. O padrão de 30 minutos é um parâmetro de hipótese, não garantia de continuidade. Os totais são faixas estimadas: limites internos e externos das sessões completas, sob continuidade entre suas amostras; não comprovam permanência ininterrupta. Quando falta um limite, não se quantifica essa sessão. Os totais disponíveis são parciais se houver sessões não quantificáveis. Os limites em minutos são arredondados para fora, para preservar a incerteza. As durações são recortadas ao dia e período escolhidos.

O programa pode usar a amostra imediatamente anterior/posterior ao período, quando próxima, apenas como contexto de transição. Essas referências ficam preservadas e identificadas; as contagens do período não incluem as amostras de contexto. Não são criadas saídas no final da exportação.

XLSX: intervalos de chegada/saída ficam identificados como texto, sem fingir uma data exata. Limites de duração mínimos/máximos são números em colunas ocultas; a aba técnica Apuração espacial preserva limites temporais em células de data, posições e referências da fonte. O JSON preserva as janelas e os registros utilizados.

Antes de enviar ao GitHub, executar npm run build, npm run bundle, copiar o HTML para docs/index.html e publicacao/index.html, atualizar o ZIP e executar npm run check:publication. A publicação 0.7.0 foi marcada como falha pelo GitHub Pages com anotação Internal server error; o commit foi enviado corretamente. A disponibilidade da nova publicação deve ser confirmada nas execuções do Pages, separadamente dos testes locais.
