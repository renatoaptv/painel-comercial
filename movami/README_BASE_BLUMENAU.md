# MOVAMI — Base de prospecção de Blumenau

Gera CSV real filtrado a partir dos dados abertos do CNPJ, compatível com MOVAMI > Prospecção > Base de empresas em massa.

Critérios: Blumenau (código Receita 8047), situação cadastral ativa (02), data de abertura anterior a dois anos da data da execução, capital social maior que R$ 30.000. Inclui matrizes e filiais localizadas na cidade, registros únicos pelo CNPJ completo.

Fonte: Receita Federal (2026-10), espelho https://huggingface.co/datasets/cnpjaberto/cnpj-dados-receita-brasil-2026-10

## Gerar no Windows

1. Instale Python 3 em https://www.python.org/downloads/ e marque Add Python to PATH.
2. Coloque gerar_base_blumenau.py e GERAR_BASE_BLUMENAU.bat na mesma pasta.
3. Dê dois cliques no arquivo BAT; ao finalizar, aparecerá MOVAMI_BLUMENAU_FILTRADAS.csv.
4. Abra https://renatoaptv.github.io/painel-comercial/movami/ > Prospecção > Base de empresas em massa > Importar CSV.

O processamento usa DuckDB e arquivos Parquet remotos. Exige acesso à internet e pode transferir vários gigabytes. A extração ocorre no seu computador, não no GitHub Pages. Não publique arquivos de contato comercial no repositório público.

O CSV reúne possíveis clientes, não aprovação de crédito. Capital declarado não comprova solvência. Contatos podem estar desatualizados; respeite LGPD e boas práticas de abordagem.
