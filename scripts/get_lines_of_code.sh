#!/bin/bash

# Count the total lines of JavaScript code in the project, excluding node_modules, github, and dist directories.
for file in `find . -name \*.js | grep -v node_modules | grep -v github/ | grep -v dist/`; do cat $file; done > out && cat out | wc -l && rm out
