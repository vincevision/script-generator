#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# EPIC WEAR image pipeline (dev-time, needs ImageMagick 6.9+ with WebP/AVIF).
#
#   tools/process-images.sh <raw.jpg> <slug> [crops...]
#
# Produces public/assets/img/products/<slug>/<n>-{480,960}.{avif,webp}
#   n=1 is the full shot; every extra crop "cx,cy,size" (fractions of the
#   source, size = crop width/height fraction) becomes a zoomed detail shot.
# Example:
#   tools/process-images.sh raw/signature-hoodie.jpg signature-hoodie 0.5,0.45,0.42
# ---------------------------------------------------------------------------
set -euo pipefail
src="$1"; slug="$2"; shift 2
out="$(dirname "$0")/../public/assets/img/products/$slug"
mkdir -p "$out"
W=$(identify -format '%w' "$src"); H=$(identify -format '%h' "$src")

emit () { # $1=input $2=index
  for w in 480 960; do
    convert "$1" -resize "${w}x" -strip -quality 72 -define webp:method=6 "$out/$2-$w.webp"
    convert "$1" -resize "${w}x" -strip -quality 55 "$out/$2-$w.avif"
  done
}

# 1 — full frame, normalised to 4:5
tmp=$(mktemp --suffix=.png)
convert "$src" -gravity center -crop "$(( H * 4 / 5 < W ? H * 4 / 5 : W ))x$(( H * 4 / 5 < W ? H : W * 5 / 4 ))+0+0" +repage "$tmp"
emit "$tmp" 1

i=2
for c in "$@"; do
  IFS=, read -r cx cy s <<< "$c"
  cw=$(python3 -c "print(int($W*$s))"); ch=$(python3 -c "print(int($W*$s*5/4))")
  x=$(python3 -c "print(max(0,min($W-$cw,int($W*$cx-$cw/2))))")
  y=$(python3 -c "print(max(0,min($H-$ch,int($H*$cy-$ch/2))))")
  convert "$src" -crop "${cw}x${ch}+${x}+${y}" +repage "$tmp"
  emit "$tmp" "$i"; i=$((i+1))
done
rm -f "$tmp"
echo "✓ $slug ($((i-1)) images)"
