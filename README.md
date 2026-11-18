# MoeGPT

A small browser lounge for AI-inspired desktop pets. An unofficial fan project.

[Play the public demo](https://kaze-neural.github.io/MoeGPT/). The repository includes the character illustrations, animation frames and stickers used in the demo.

## Run locally

Requires Node.js 22.

```sh
npm ci
npm run dev
```

Open the local URL shown by Vite. Append `?draft=1` to preview draft dialogue. Drag a character to move her, click to trigger her action, and double-click to open her profile.

```sh
npm run build
npm test
npm run preview
```

The static output is in `dist/`.

## Contribute

- Character data, dialogue and review flags live in `src/data/`.
- To add an action, add its PNG frames under `assets/animations/actions/<folder>/` and register per-frame durations in `src/data/actions.json`.
- Phaser movement and interactions live in `src/scenes/Lounge.ts`.
- When sharing new art, include its license and keep draft content marked as draft until reviewed.

The source code is released under the MIT License. The included fan art is publicly available to view and download. Product and company names identify their respective owners. This project is not affiliated with those companies.
