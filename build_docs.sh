#!/bin/bash
# Build all documentation files. To avoid relative path errors (and ensure this is run from root of the package),
#   run this using `npm run docs`

# Stop execution if anything fails
set -e
set -x

if ! command -v pandoc &> /dev/null
then
    echo "pandoc must be installed in order to build documentation"
    exit
fi
echo ls docs
rm -rf docs/guides/
rm -rf docs/api/
mkdir docs/guides
mkdir docs/api

find ./assets/docs -iname "*.md" -type f -exec sh -c 'pandoc -s --toc --css ../css/pandoc.css "${0}" -o "./docs/guides/$(basename ${0%.md}).html"' {} \;
jsdoc --verbose --recurse -c jsdoc.conf.json --readme ./README.md --destination ./docs/api/ esm/
