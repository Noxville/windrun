#!/bin/bash
set -e
npm run build
scp -r dist connect.datdota.com:/var/www/windrun/
