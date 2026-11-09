#!/usr/bin/env python3
# MOVAMI - gera CSV para a Base de Empresas em Massa
# Fonte: dados abertos CNPJ Receita Federal, competencia 2026-10
import calendar
from datetime import date
from pathlib import Path
import sys
try:
    import duckdb
except ImportError:
    print("DuckDB nao instalado. Execute: python -m pip install duckdb")
    sys.exit(1)

def dois_anos_atras(hoje):
    ano = hoje.year - 2
    return date(ano, hoje.month, min(hoje.day, calendar.monthrange(ano, hoje.month)[1]))

def main():
    competencia = "2026-10"
    corte = dois_anos_atras(date.today()).isoformat()
    base = f"hf://datasets/cnpjaberto/cnpj-dados-receita-brasil-{competencia}"
    arquivo = Path(__file__).resolve().parent / "MOVAMI_BLUMENAU_FILTRADAS.csv"
    caminho_sql = str(arquivo).replace("\\", "/").replace("'", "''")
    print("MOVAMI | Preparando base de empresas de Blumenau...")
    print(f"Receita Federal: {competencia} | Abertura anterior a {corte} | Capital > R$ 30.000")
    print("Consulta remota: exige internet e pode transferir varios GB.")
    con = duckdb.connect()
    con.execute("SET memory_limit='3GB'")
    con.execute("SET threads=4")
    try:
        con.execute("INSTALL httpfs")
        con.execute("LOAD httpfs")
        sql = f"""
COPY (
    WITH estabelecimentos_blumenau AS (
        SELECT cnpj_basico, cnpj_ordem, cnpj_dv, data_inicio_atividade,
               ddd1, telefone1, correio_eletronico, cnae_fiscal_principal
        FROM read_parquet('{base}/estabelecimentos/*.parquet')
        WHERE uf = 'SC'
          AND municipio = '8047'
          AND situacao_cadastral = '02'
          AND try_strptime(data_inicio_atividade, '%Y%m%d') < DATE '{corte}'
    ),
    empresas_capital AS (
        SELECT cnpj_basico, razao_social, capital_social
        FROM read_parquet('{base}/empresas/*.parquet')
        WHERE try_cast(replace(capital_social, ',', '.') AS DOUBLE) > 30000
    )
    SELECT e.razao_social AS "Empresa",
           (s.cnpj_basico || s.cnpj_ordem || s.cnpj_dv) AS "CNPJ",
           'Blumenau' AS "Cidade",
           (substr(s.data_inicio_atividade,1,4) || '-' ||
            substr(s.data_inicio_atividade,5,2) || '-' ||
            substr(s.data_inicio_atividade,7,2)) AS "Abertura",
           replace(e.capital_social, ',', '.') AS "Capital Social",
           (coalesce(s.ddd1, '') || coalesce(s.telefone1, '')) AS "Telefone",
           coalesce(s.correio_eletronico, '') AS "Email",
           s.cnae_fiscal_principal AS "CNAE",
           'ATIVA' AS "Situacao",
           'Receita Federal CNPJ {competencia}' AS "Fonte"
    FROM estabelecimentos_blumenau s
    JOIN empresas_capital e USING (cnpj_basico)
    ORDER BY e.razao_social, s.cnpj_basico, s.cnpj_ordem
) TO '{caminho_sql}' (FORMAT CSV, HEADER TRUE, DELIMITER ';');
"""
        con.execute(sql)
        total = con.execute(f"SELECT count(*) FROM read_csv_auto('{caminho_sql}', delim=';', header=true, all_varchar=true)").fetchone()[0]
        print(f"\nConcluido: {total:,} CNPJs exportados para: {arquivo}")
        print("Abra o painel MOVAMI > Prospecção > Base de empresas em massa > Importar CSV.")
        print("Verifique a atualidade dos contatos e a finalidade comercial (LGPD).")
    except Exception as ex:
        print(f"\nNao foi possivel consultar ou exportar a base: {ex}")
        print("Confira sua rede e a disponibilidade do espelho Hugging Face.")
        sys.exit(2)
    finally:
        con.close()

if __name__ == "__main__":
    main()
