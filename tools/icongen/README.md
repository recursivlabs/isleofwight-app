# icongen

Renders the app icon natively at every size Apple asks for, using Core Graphics
— the same rasteriser that draws on device.

## Why

Shipping one 1024 master and letting something downscale it is what makes icons
look soft. Expo's `ios.icon` writes a single-size asset catalogue, so iOS has
to resample at display time. On an @3x phone the home screen wants 180px; with
only a 120 and a 1024 available it upscales, giving a 2px edge transition with
Lanczos ringing instead of a clean 1px edge.

Measured on this mark:

```
native 180 (Core Graphics)            transition 1 px   245,184,0 -> 153,115,0 -> 0,0,0
120 upscaled to 180 (what iOS did)    transition 2 px   255,197,0 -> 175,131,0 -> 53,40,0 -> 2,1,0
                                                        ^ 255 overshoots the real ground (245): ringing
```

## Output

Conforms to Apple's app icon requirements: PNG, sRGB, no alpha channel, no
layers, square corners (the system applies the squircle mask).

Sizes cover iPhone, iPad and marketing — 20/29/40/58/60/80/87/120/152/167/180
/1024 — plus Android adaptive foregrounds and web favicons.

## Use

```
swiftc -O -o icongen icongen.swift
node build.mjs
```

Writes `assets/AppIcon.appiconset`, which `plugins/withAppIconSet.js` copies
into the Xcode project during prebuild.
