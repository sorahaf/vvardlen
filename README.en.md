# Wardlen: a sketchbook where lines wiggle

[ภาษาไทย](README.md) | **English**

A drawing website where your lines keep moving on their own. It works on computers, tablets and phones. Draw alone, open a room to draw with a friend, and share your drawings to the gallery. No sign-up needed.

👉 **Try it at [sorahaf.github.io/vvardlen](https://sorahaf.github.io/vvardlen/)**

"Wardlen" is the Thai name วาดเล่น ("just drawing for fun"), and read backwards it almost says *draw*.

## Features

- **Brushes:** wiggle pencil, pixel line, wave line (zigzag, wave, coil), oil paint, and an outline pen with a sticker-like border (pointed or round tips)
- **Opacity** for pencil, pixel and wave lines. Layer strokes to build up color
- **Eraser** that removes lines, not the paper
- **8 papers:** plain, lined, grid, dots, kraft, old paper, chalkboard, blueprint
- **Layers** (solo mode): add, delete, rename, reorder, hide, opacity, merge down
- **Color picker** with a color wheel, perceptual brightness, HEX code, recent and saved colors, and an eyedropper
- **Grayscale preview** and **whole-layer color adjust**
- Zoom and pan, undo and redo, pause or play the wiggle
- **Save** as PNG or as an animated, looping GIF
- **Draw with a friend:** live rooms for 2 people, public or private with a password. Rooms delete themselves after 3 days
- **Gallery:** share a drawing with its title, artist names and contacts (up to 2 artists), either listed publicly or link only. Viewers can give hearts and report drawings. The owner can delete a drawing or keep drawing on it. Drawings are stored as lines, so they still wiggle in the gallery
- **Thai and English** interface (TH / EN switch)

Drawing alone works without Firebase. Rooms and the gallery need Firebase.

## Run your own copy

1. Fork this repository
2. In **Settings > Pages**, set **Source** to **GitHub Actions**. Every push builds the TypeScript and deploys the site
3. For rooms and the gallery, create your **own** Firebase project on the free Spark plan. Don't use the values from this site:
   - Turn on **Authentication > Anonymous**
   - Create a **Realtime Database** in locked mode
   - Paste `database.rules.json` into the database **Rules** tab and click **Publish**. Do this again every time the rules file changes
   - Copy your web app config into `firebase-config.js`
   - Add your domain under **Authentication > Settings > Authorized domains**

The Thai README walks through each step in more detail.

## Develop locally

```
npm install
npm run dev      # compile TypeScript on save
npx serve .      # open the printed link
```

`npm run check` type-checks only. `npm run build` compiles once to `dist/`.

Built with TypeScript, HTML, CSS and Canvas. No frameworks. External loads are only the Mali font and the Firebase JS SDK.

## Project layout

- `index.html`, `draw.html`, `gallery.html`, `art.html`: the pages
- `src/draw/`: drawing board (brushes, layers, rooms, saving, sharing)
- `src/lobby/`, `src/gallery/`, `src/art/`: the other pages
- `src/shared/`: Firebase and gallery data access
- `src/i18n/en.ts`: English translations. The page text is written in Thai and translated at runtime, so add an entry here for every new Thai string
- `database.rules.json`: Realtime Database security rules

## Contributing

- **Bugs and ideas:** open an [issue](https://github.com/sorahaf/vvardlen/issues). Say what you did, what happened, and which device and browser you used. Screenshots help a lot
- **Code:** fork, make your change, make sure `npm run check` passes, and open a pull request
- If you change `database.rules.json`, mention it in the pull request, because the rules have to be published in Firebase by hand

## License

[MIT](LICENSE). Use it, change it, share it, or sell it. Just keep the copyright and license notice.
