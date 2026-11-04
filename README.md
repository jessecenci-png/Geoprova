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
