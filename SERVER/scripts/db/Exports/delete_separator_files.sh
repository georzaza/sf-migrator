#!/bin/bash
echo "Enter delimiter"
read delimiter
find -name \*_with_sep$.csv | xargs rm