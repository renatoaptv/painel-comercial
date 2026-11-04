# Painel de Vendas de Usados — Módulo Independente

Cópia isolada do módulo Vendas de Usados, sem alterações no CRM MOVAMI.

## Acesso
Use o arquivo `index.html` ou a página hospedada em `/painel-comercial/vendas-usados/`.

## Funcionalidades
- Funil: NOVO CONTATO, EM NEGOCIAÇÃO, VENDIDO
- Cadastro e situação dos veículos em estoque
- Clientes, acompanhamento, histórico e observações
- Anexos de documentos por cliente no IndexedDB local
- Resumo de vendas e declarações com geração de pacote ZIP de arquivos ODT (LibreOffice Writer)
- Prévia e emissão de segunda via

## Isolamento e dados
O módulo usa chaves próprias de localStorage e IndexedDB. Os dados cadastrados no CRM MOVAMI **não são importados** e a versão original permanece intacta. Este painel não usa banco de dados, autenticação ou sincronização online. Os dados ficam no navegador que os cadastrou; não use em computador público.

## Documentos e responsabilidade
Os modelos ODT foram copiados da versão existente. Alguns contêm o nome de uma empresa específica e disposições contratuais; revise sua adequação jurídica e os dados da vendedora antes de utilizá-los. A declaração de ausência de troca só deve ser assinada quando de fato não houve troca.

## Arquivos
- `index.html`: aplicativo independente
- `usados.js`: estoque, clientes, anexos e funil
- `ficha-venda.js`: formulário complementar da ficha
- `ficha-odt.js`: preenchimento dos documentos e ZIP
- `modelo-*.odt`: os quatro modelos editáveis originais
