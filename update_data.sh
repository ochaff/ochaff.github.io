#!/usr/bin/env bash
set -euo pipefail

gh release download --repo MSCA-DN-Digital-Finance/stablecoin-onchain-data --pattern '*_data.zip' --dir ./ --clobber
for type in aave curve eth_blocks uniswap

do 
unzip -o "${type}_data.zip"
rm "${type}_data.zip"

done;
