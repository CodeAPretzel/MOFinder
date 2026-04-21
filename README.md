# Docs Branch

This branch should be used for documenting the location of configurations and third-party applications being used for the MOFinder app.
* See the `script` directory for preprocessing data on the DB.


## Frontend Third-Party Applications
1. [RDkit](https://github.com/rdkit/rdkit-js)
2. [JSME](https://jsme-editor.github.io/)


## Backend Third-Party Applications
1. pm2
	- config: /var/www/mofinder/shared/ecosystem.config.js
2. nginx
	- configs: /etc/nginx/nginx.config  |  /etc/nginx/sites-available/mofinder.conf
3. OpenVPN
	- config: $HOME


## Workflows
1. GitHub actions
	- can be found at /var/www/actions-runner
	- in **main** branch, checkout .github/workflows/deploy.yml
	- used to automatically deploy the app when uploading to the **main** repo.
2. Processing files
	- can be found at /home/$USER/scripts
	- for more info, checkout the README in scripts for this branch


## Project
1. Config
	- /var/www/mofinder/shared/.env
