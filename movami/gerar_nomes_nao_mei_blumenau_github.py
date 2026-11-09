#!/usr/bin/env python3
"""MOVAMI: exporta nomes de CNPJs ativos nao-MEI em Blumenau/SC a partir dos dados publicos da Receita (2026-10).
Roda em ambiente GitHub Actions, sem instalar aplicativos no computador do usuario.
"""
from pathlib import Path
import csv
import os
import time
import sys
import duckdb

BASE = "hf://datasets/andrelacerda23/cnpj-dados-receita-brasil-2026-10"
OUT = Path("movami/dados-blumenau")
OUT.mkdir(parents=True, exist_ok=True)
conn = duckdb.connect("movami_blumenau.duckdb")
conn.execute("SET memory_limit='5GB'")
conn.execute("SET threads=3")
conn.execute("SET preserve_insertion_order=false")
conn.execute("INSTALL httpfs")
conn.execute("LOAD httpfs")
print("Iniciando consulta da Receita Federal 2026-10...", flush=True)

start=time.time()
conn.execute(f"""
CREATE OR REPLACE TABLE cidades AS
SELECT cnpj_basico, cnpj_ordem, cnpj_dv, nome_fantasia, data_inicio_atividade
FROM read_parquet('{BASE}/estabelecimentos/*.parquet')
WHERE uf = 'SC' AND municipio = '8047' AND situacao_cadastral = '02'
""")
n=conn.execute("SELECT COUNT(*) FROM cidades").fetchone()[0]
print(f"Estabelecimentos ativos em Blumenau encontrados: {n}",flush=True)

# MEI e marcado pelo indicador oficial 'S' na tabela Simples.
conn.execute(f"""
CREATE OR REPLACE TABLE mei_basicos AS
SELECT DISTINCT s.cnpj_basico
FROM read_parquet('{BASE}/simples/*.parquet') s
INNER JOIN cidades c USING (cnpj_basico)
WHERE s.opcao_mei = 'S'
""")
nmei=conn.execute("SELECT COUNT(*) FROM mei_basicos").fetchone()[0]
print(f"CNPJs basicos marcados como MEI: {nmei}", flush=True)

conn.execute(f"""
CREATE OR REPLACE TABLE firmas AS
SELECT c.cnpj_basico || c.cnpj_ordem || c.cnpj_dv AS cnpj,
       TRIM(e.razao_social) AS empresa,
       c.nome_fantasia AS fantasia,
       c.data_inicio_atividade AS data_inicio,
       e.natureza_juridica AS natureza
FROM cidades c
JOIN read_parquet('{BASE}/empresas/*.parquet') e USING(cnpj_basico)
LEFT JOIN mei_basicos m USING(cnpj_basico)
WHERE m.cnpj_basico IS NULL
  AND e.razao_social IS NOT NULL
  AND LENGTH(TRIM(e.razao_social))>0
""")
tot=conn.execute("SELECT COUNT(*) FROM firmas").fetchone()[0]
unicos=conn.execute("SELECT COUNT(DISTINCT empresa) FROM firmas").fetchone()[0]
print(f"CNPJs ativos nao-MEI = {tot}; nomes distintos = {unicos}", flush=True)

# Arquivo simples pedido: somente os nomes, um por linha.
nomes = OUT / "MOVAMI_BLUMENAU_NOMES_NAO_MEI_2026-10.csv"
conn.execute(f"""
COPY (SELECT DISTINCT empresa AS "Empresa"
      FROM firmas ORDER BY empresa)
TO '{nomes}' (HEADER TRUE, DELIMITER ';', ENCODING 'UTF-8')
""")

# Arquivo opcional importavel no painel MOVAMI; o CNPJ distingue filiais e homonimos.
painel = OUT / "MOVAMI_BLUMENAU_IMPORTAR_NAO_MEI_2026-10.csv"
conn.execute(f"""
COPY (SELECT empresa AS "Empresa", cnpj AS "CNPJ", 'Blumenau' AS "Cidade",
             CASE WHEN LENGTH(data_inicio)=8
                  THEN SUBSTR(data_inicio,1,4)||'-'||SUBSTR(data_inicio,5,2)||'-'||SUBSTR(data_inicio,7,2)
                  ELSE '' END AS "Abertura",
             COALESCE(fantasia,'') AS "Nome Fantasia",
             'Receita Federal CNPJ 2026-10' AS "Fonte"
      FROM firmas ORDER BY empresa, cnpj)
TO '{painel}' (HEADER TRUE, DELIMITER ';', ENCODING 'UTF-8')
""")
summary=OUT/"LEIA-ME.txt"
summary.write_text(
 f"Fonte: Receita Federal, CNPJ 2026-10, via andrelacerda23 no Hugging Face\n"
 f"Recorte: Blumenau/SC, estabelecimentos ativos (02), sem opcao MEI (S).\n"
 f"CNPJs nao-MEI: {tot}\nNomes empresariais distintos: {unicos}\n"
 "Nao foram aplicados filtros de capital social ou antiguidade.\n"
 "Empresarios individuais que NAO sao MEI podem constar.\n"
 "Consulte a situacao cadastral antes da abordagem; os registros retratam outubro de 2026.\n",
 encoding="utf-8")
print(f"CONCLUIDO em {time.time()-start:.1f}s. CSVs: {nomes}, {painel}",flush=True)
