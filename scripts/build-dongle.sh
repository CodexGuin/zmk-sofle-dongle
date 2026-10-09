#!/bin/sh
# Build the Sofle dongle firmware locally, mirroring zmk build-user-config.yml@v0.3.0.
# usage: build-dongle.sh <out-name>
set -e
OUT=$1
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/ws/.home \
  -v "$HOME/.cache/zmk-sofle-ws:/ws" -v "$HOME/Projects/zmk-sofle-dongle:/repo:ro" -w /ws \
  zmkfirmware/zmk-build-arm:stable sh -c '
    set -e
    cp -rT /repo/config /ws/config
    [ -d .west ] || west init -l config
    west update --fetch-opt=--filter=tree:0 >/ws/west-update.log 2>&1 || { tail -30 /ws/west-update.log; exit 1; }
    west zephyr-export >/dev/null
    west build -p -s zmk/app -d build/dongle -b nice_nano_v2 -S studio-rpc-usb-uart -- \
      -DZMK_CONFIG=/ws/config "-DSHIELD=eyelash_sofle_central_dongle dongle_display" \
      -DZMK_EXTRA_MODULES=/repo -DCONFIG_ZMK_STUDIO=y -DCONFIG_ZMK_STUDIO_LOCKING=n'
cp "$HOME/.cache/zmk-sofle-ws/build/dongle/zephyr/zmk.uf2" "$HOME/.cache/zmk-sofle-ws/$OUT.uf2"
echo "built $HOME/.cache/zmk-sofle-ws/$OUT.uf2"
