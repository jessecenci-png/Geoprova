# Arquitetura e decisões pendentes

## Fronteira de privacidade

O navegador lê arquivos selecionados via File API, calcula SHA-256 via Web Crypto, normaliza projeções em memória e gera ExcelJS/JSON localmente. A CSP limita os recursos de mapa aos domínios Google. Não há caixinha de ativação: clicar em buscar/abrir, após aviso junto ao botão, inicia a consulta. O Google recebe endereço e dados da conexão; com mapa integrado recebe a área visualizada. Nenhum JSON importado ou relatório é enviado. A entrega inicial dos arquivos estáticos pelo servidor não transmite o conteúdo importado. Downloads dependem do navegador; impressão depende do destino escolhido pelo usuário.

Avisos e metadados precedem os resultados; os alertas individualizados permanecem nos registros. O raio inicial de 20 m é uma escolha ajustável da interface, sem alterar a precisão da fonte.

O suporte atual cobre semanticSegments (visitas e timelinePath), rawSignals de posição e preservação de userLocationProfile. Outros conteúdos são mantidos no original, não interpretados como presença. Distância usa Haversine; perímetro usa teste de ponto em polígono (áreas locais; não adequado a polígonos que cruzem antimeridiano). Precisão não é confundida com probabilidade. Sem precisão informada, o campo permanece nulo. Não são inferidos nomes/endereço.

Regras `experimental-2026-11-04.1`: booleano false presente em isTimelessVisit; zero no topCandidate como fundamento adicional; segmento estritamente composto de horários/fuso como possível remoção. Origem: observações experimentais descritas pelo solicitante, sem validação universal. Campos desconhecidos em um segmento impedem classificá-lo como composto apenas de horários. Horários inválidos são inconsistências; registros sem intervalo válido não sustentam presença.

## Aquisição Android

Esta implementação é web e usa seleção de arquivo. Não invoca ou atesta o exportador do Google. Mecanismos Android como ACTION_OPEN_DOCUMENT e ACTION_SEND podem fornecer bytes/URIs; o recebimento isolado não comprova qual aplicativo originalmente produziu o conteúdo. Não há contrato de API de exportação autenticada do Google Maps validado neste projeto. Sua existência/disponibilidade deve ser verificada com documentação e testes das versões de Maps/Android antes de prometer integração direta.

Uma implementação nativa futura poderá ler o URI recebido sem modificar os bytes, calcular hash, copiar para armazenamento privado e registrar Build.MANUFACTURER, MODEL, VERSION.RELEASE, SDK_INT e DISPLAY, versão do app, instante, fuso e mecanismo real. Não coletar IMEI, serial ou identificadores persistentes. Horário do aparelho não é carimbo de tempo independente. Esses dados identificam o aparelho de aquisição; não demonstram que ele gerou todo o histórico. Mesmo ACTION_SEND recebido do Maps não elimina a possibilidade de histórico previamente editado.

## Origem de relatórios e verificador oficial

Não há domínio oficial nem autoridade/chave de emissão fornecidos. Por isso o produto não produz QR Code que pareça autenticar documentos. O identificador UUID serve para associação, não para autenticação. Um manifesto editável demonstra correspondência somente ao manifesto apresentado.

Antes de implementar assinatura, definir quem é a autoridade, como autentica o emissor, onde guarda chaves (HSM/KMS ou chave individual protegida), como revoga certificados e quais evidências autorizam cada emissão. Uma chave privada compartilhada no JavaScript ou um endpoint que assina hashes arbitrários não prova geração pelo aplicativo. Um modelo de assinatura pelo usuário pode provar a identidade do signatário, mas deve ser descrito assim.

Cada formato exige proteção própria: PDF com assinatura apropriada (por exemplo PAdES) ou assinatura destacada sobre os bytes finais; XLSX com assinatura apropriada ao pacote OOXML ou assinatura destacada sobre os bytes finais. Incluir no conteúdo protegido o hash da fonte, parâmetros, critérios, aquisição e resultados. O verificador deve receber o documento digital localmente e verificar todos os bytes, cadeia de confiança e eventual revogação; QR/UUID isolados não bastam. Uma página pública de consulta não deve publicar dados pessoais ou localizações. Impressões precisam ser comparadas ao digital verificado.

Se um serviço de emissão for escolhido, especificar exatamente o que recebe (hashes, metadados, atestação etc.), obter ação expressa para esse envio e revisar a promessa de privacidade antes de ativá-lo. Não há esse envio no aplicativo atual.

Conferência independente atual: verifica hash do JSON completo, exige versões compatíveis, refaz a apuração e compara a projeção determinística integral com o relatório JSON fornecido. Demonstra correspondência computacional ao arquivo recebido; não autentica dados pré-importação nem autoria do relatório. A mesma lógica publicada permite auditoria, mas não constitui implementação independente por outra entidade.

## Google Maps (0.3.0)

Nominatim, Photon e o mapa OSM foram removidos do fluxo. A abertura sem chave usa o formato oficial Maps URLs com api=1 e query codificada. Não há extração de dados da página externa ou inferência de coordenadas a partir de um endereço. O usuário copia o ponto exato; links encurtados e coordenadas de centro da câmera não são tratados como localização do estabelecimento. A confirmação da área permanece obrigatória.

A integração dentro da página usa Maps JavaScript API, Geocoder, marcador ajustável e Circle. Requer projeto Google Cloud com faturamento, APIs e chave de navegador restrita por domínio. Um HTML file:// não fornece origem HTTP para essas restrições; o carregador orienta usar a abertura externa, sem recomendar chave irrestrita. A ausência de projeto/chave é um bloqueio externo para validar a API real. Testes simulados não comprovam acesso aos serviços Google.

## Totais e sugestões (0.4.0)

Os totais semanais e mensais usam a duração da união dos intervalos de cada dia, já cortados pelo fuso e pela seleção, não a soma ingênua das linhas individuais sobrepostas. Subtotais nulos representam insuficiência de dados; dias não quantificáveis são contados no cabeçalho do total. A precisão da visita é lida apenas de accuracyMeters/horizontalAccuracyMeters em placeLocation ou accuracyMeters em visit; dados desconhecidos permanecem preservados no original. Faixas das posições de apoio têm suas referências explícitas e não certificam precisão do horário ou de todo o intervalo.

Sugestões integradas usam a classe Places New PlaceAutocompleteElement e o evento gmp-select. fetchFields solicita somente displayName, formattedAddress e location; não solicita histórico do usuário. Antes da conexão há aviso de consulta externa ao Google ao digitar. A chave continua somente em memória; não há projeto/chave disponível para validação real.

## Arquitetura vigente 0.5: busca gratuita e mapa livre

Esta seção substitui os fluxos Google descritos historicamente acima. O frontend usa Leaflet incorporado e Photon para sugestões de endereço/estabelecimento. Não há chaves, cobrança Google, scripts Google ou leitura de página externa. Debounce de 700 ms, mínimo de 3 caracteres, intervalo de 1 s entre consultas, cache de 100 consultas no cliente e cancelamento/numeração das respostas impedem aplicar sugestões antigas. Editar a consulta limpa coordenadas e confirmação. Selecionar uma sugestão aplica o ponto automaticamente; nunca inferir o estabelecimento a partir de uma sugestão não escolhida. Busca explícita com um único resultado pode selecionar esse resultado, mantendo confirmação de área.

No site, GET /api/places é uma rota de leitura para host Photon fixo, sem URL arbitrária ou rota de upload. Recebe apenas consulta q (3–200 caracteres). O servidor usa TLS/proxy padrão, timeout, limite global de uma consulta por segundo e cache em memória (256 itens, 24 h), sem logging do endereço no aplicativo. Hospedagem precisa proteger seus próprios logs de URL. A rota evita CORS para o navegador, não bloqueios de egress do servidor. O HTML único usa consulta direta, portanto continua sujeito a políticas de origens locais. Não se promete que o HTML único resolverá os bloqueios anteriores.

Mapa: tiles diretos OpenStreetMap somente após escolha de ponto, com atribuição visível. Mover o mapa pode comunicar a área visualizada ao provedor; histórico/JSON/relatórios não são transmitidos. A confirmação final do estabelecimento segue obrigatória. Precisão não volta à tabela principal. Relatórios e apuração permanecem locais.

Photon/OSM públicos são gratuitos e limitados; o software é aberto, mas operação de instância própria/hospedagem pode ter custos. Não oferecer garantia de disponibilidade nem consumo ilimitado. A validação real neste ambiente foi impedida por CONNECT 403; não confundir os testes com serviço simulado com validação dos provedores reais.
