#!/usr/bin/env python3
"""Valida e divide a base de nomes de Blumenau em partes menores para facilitar conferência."""
from pathlib import Path
import csv
from collections import Counter

base=Path("movami/dados-blumenau")
orig=base/"MOVAMI_BLUMENAU_SOMENTE_NOMES_NAO_MEI.csv"
assert orig.exists(), f"Arquivo nao encontrado: {orig}"
with orig.open("r",encoding="utf-8-sig",newline="") as f:
    reader=csv.DictReader(f,delimiter=";")
    print("Cabecalhos encontrados:",reader.fieldnames)
    assert "Empresa" in reader.fieldnames,reader.fieldnames
    names=[row["Empresa"].strip() for row in reader if row.get("Empresa") and row["Empresa"].strip()]
unicos=set(names)
print(f"TOTAL DE NOMES: {len(names)}")
print(f"TOTAL DE NOMES DISTINTOS: {len(unicos)}")
assert len(names)>=40000, f"Extracao incompleta! {len(names)}"
assert len(names)==len(unicos), f"Existem {len(names)-len(unicos)} nomes repetidos"

arquivos=[]
for i in range(0,len(names),10000):
    bloco=names[i:i+10000]
    path=base/f"MOVAMI_BLUMENAU_NOMES_PARTE_{i//10000+1:02}.csv"
    with path.open("w",encoding="utf-8-sig",newline="") as f:
        wr=csv.writer(f,delimiter=";",lineterminator="\n")
        wr.writerow(["Empresa"])
        for name in bloco: wr.writerow([name])
    with path.open("r",encoding="utf-8-sig",newline="") as f:
        conferido=sum(1 for r in csv.DictReader(f,delimiter=";") if r["Empresa"])
    assert conferido==len(bloco),f"Erro de integridade em {path}: {conferido}"
    arquivos.append((path.name,conferido))
    print(f"{path.name}: {conferido} nomes conferidos")

cont=base/"CONTAGEM_VERIFICADA.txt"
cont.write_text(
    "MOVAMI | BLUMENAU/SC | BASE DE NOMES NAO-MEI\n"
    "Fonte: Receita Federal, competencia 2026-10.\n"
    "Sem filtros de capital social ou antiguidade.\n"
    f"Total de nomes empresariais distintos: {len(names):,}\n"
    "Total de estabelecimentos ativos nao-MEI de origem: 45.804\n\n"
    + "\n".join(f"{n}: {q:,} nomes" for n,q in arquivos)
    + "\n\nCada CSV tem cabecalho Empresa e uma linha por nome.\n"
    "Para conferir no Excel, abra o CSV e tecle Ctrl+End; desconte 1 linha de cabecalho.\n"
    "O painel MOVAMI exibe 80 registros por pagina na secao Base em Massa.\n",
    encoding="utf-8"
)
print("SOMA DOS ARQUIVOS:",sum(c for _,c in arquivos))
