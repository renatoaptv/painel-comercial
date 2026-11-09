#!/usr/bin/env python3
"""Geracao de lista nao-MEI de Blumenau. A execucao ocorre no GitHub Actions, nao no computador pessoal."""
import subprocess,sys,time,os
from pathlib import Path
print("Preparando acesso ao espelho oficial de dados CNPJ 2026-10",flush=True)
subprocess.check_call([sys.executable,"-m","pip","install","--quiet","huggingface_hub>=0.35.0","hf_xet"])
from huggingface_hub import snapshot_download
import duckdb

DATASET="andrelacerda23/cnpj-dados-receita-brasil-2026-10"
os.environ["HF_XET_HIGH_PERFORMANCE"]="0"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"]="1"
t=time.time()
root=snapshot_download(
    repo_id=DATASET,repo_type="dataset",
    allow_patterns=["estabelecimentos/*.parquet","empresas/*.parquet","simples/*.parquet"],
    local_dir="rfb-2026-10",
    max_workers=2
)
print("Arquivos publicos obtidos em",round(time.time()-t,1),"s",flush=True)
p=Path(root)
est=str(p/"estabelecimentos"/"*.parquet")
emp=str(p/"empresas"/"*.parquet")
sim=str(p/"simples"/"*.parquet")
con=duckdb.connect("movami_blumenau.duckdb")
con.execute("SET threads=3")
con.execute("SET memory_limit='5GB'")
con.execute("SET preserve_insertion_order=false")
print("Filtrando apenas CNPJs ativos em Blumenau/SC...",flush=True)
con.execute(f"""
CREATE TABLE cidade AS SELECT cnpj_basico,cnpj_ordem,cnpj_dv,nome_fantasia,data_inicio_atividade
FROM read_parquet('{est}')
WHERE uf='SC' AND municipio='8047' AND situacao_cadastral='02'
""")
na=con.execute("SELECT count(*) FROM cidade").fetchone()[0]
print("CNPJs ativos em Blumenau:",na,flush=True)
con.execute(f"""
CREATE TABLE mei AS SELECT DISTINCT s.cnpj_basico
FROM read_parquet('{sim}') s
INNER JOIN cidade c USING(cnpj_basico)
WHERE s.opcao_mei='S'
""")
print("CNPJ basicos MEI:",con.execute("SELECT count(*) FROM mei").fetchone()[0],flush=True)
con.execute(f"""
CREATE TABLE firmas AS
SELECT c.cnpj_basico||c.cnpj_ordem||c.cnpj_dv AS cnpj,
TRIM(e.razao_social) AS empresa, c.nome_fantasia AS fantasia,
c.data_inicio_atividade AS data_inicio
FROM cidade c
JOIN read_parquet('{emp}') e USING(cnpj_basico)
LEFT JOIN mei m USING(cnpj_basico)
WHERE m.cnpj_basico IS NULL
AND e.razao_social IS NOT NULL AND LENGTH(TRIM(e.razao_social))>0
""")
total=con.execute("SELECT count(*) FROM firmas").fetchone()[0]
n=con.execute("SELECT count(DISTINCT empresa) FROM firmas").fetchone()[0]
out=Path("movami/dados-blumenau");out.mkdir(parents=True,exist_ok=True)
nomes=out/"MOVAMI_BLUMENAU_SOMENTE_NOMES_NAO_MEI.csv"
painel=out/"MOVAMI_BLUMENAU_IMPORTAR_NAO_MEI.csv"
con.execute(f"""
COPY (SELECT DISTINCT empresa AS "Empresa" FROM firmas ORDER BY empresa)
TO '{nomes}' (HEADER TRUE,DELIMITER ';')
""")
con.execute(f"""
COPY (SELECT empresa AS "Empresa",cnpj AS "CNPJ",
'Blumenau' AS "Cidade",
CASE WHEN LENGTH(data_inicio)=8 THEN
SUBSTR(data_inicio,1,4)||'-'||SUBSTR(data_inicio,5,2)||'-'||SUBSTR(data_inicio,7,2)
ELSE '' END AS "Abertura",
'Receita Federal CNPJ 2026-10' AS "Fonte"
FROM firmas ORDER BY empresa,cnpj)
TO '{painel}' (HEADER TRUE,DELIMITER ';')
""")
(out/"LEIA-ME.txt").write_text(
f"Fonte: Receita Federal, competencia 2026-10, espelho publico Hugging Face.\n"
f"Municipio Blumenau (Receita 8047), situacao ativa (02), opcao MEI diferente de S.\n"
f"CNPJs nao-MEI: {total}\nNomes distintos: {n}\n"
"Sem filtro de capital social ou data de abertura.\n"
"Empresarios individuais nao-MEI podem constar.\n",encoding="utf-8")
print(f"PRONTO: {total} CNPJs nao-MEI, {n} nomes distintos. Resultado em {out}",flush=True)
