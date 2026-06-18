--- INTENDED STEPS FOR RUNNING audit-clean-linker-db.py

** Used to audit and clean our MySQL DB


1) Run first before csv-to-mysql-db.py and preprocess-mof-linkers-with-aliases.py

2) python audit-clean-linkers-db.py \
    --create-alias-table \
    --out-dir linker-audit

3) Inspect generated files in linker-audit
    > check to ensure everything looks reasonable

4) python audit-clean-linker-db.py \
    --create-alias-table \
    --rebuild-alias-table \
    --out-dir linker-audit-after-rebuild

5) For future linker refreshes, use the preprocessing script.
    > Use this script as a fallback.

6) Note, --out-dir argument is optional; used for debugging.



--- INTENDED STEPS FOR RUNNING csv-to-mysql-db.py

** Used to upload mofs in `mofs.csv` into our DB


1) Run as is.



--- INTENDED STEPS FOR RUNNING preprocess-mof-linkers-with-aliases.py

** Used to upload linkers, names, and canonical smiles to our DB


MYSQL-BACKFILL:
1. python preprocess-mof-linkers-with-aliases.py \
    --source mysql \
    --create-tables \
    --out-dir linker-build-debug
2. Note, --out-dir argument is optional; used for debugging.


RAW-CSV-DRIVEN-RUN:
1. python preprocess-mof-linkers-with-aliases.py \
    --source csv \
    --source-csv /home/zhenglab/preprocess/mofs.csv \
    --create-tables \
    --out-dir linker-build-debug
2. Note, --out-dir argument is optional; used for debugging.



--- INTENDED STEPS FOR RUNNING openvpn-setup.sh

** Used to create unique OpenVPN files to give to others wanting to access the VPN


1) <incomplete>



--- ABOUT deploy.sh

** Attempts to deploy NextJS application after a github main branch commit.