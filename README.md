# Eli Castenson · Engineering Portfolio

A static site (plain HTML/CSS, no build step) for GitHub Pages.

```
portfolio/
├── index.html      Home: intro, project cards, skills, about, contact
├── paddle.html     Pickleball paddle build log
├── rc-car.html     RC car build log
├── style.css       All styling (colors are at the top in :root)
├── script.js       Photo placeholders, Now printing panel, footer year
├── hero-printer.js The animated printer at the top of the home page
├── compare.js      Drag-to-compare overlays on the project pages
└── images/
    ├── site/       hero.jpg
    ├── paddle/     project photos
    └── rc-car/     project photos
```

## Put it online (GitHub web, no command line)

1. Sign in to GitHub and click **New repository**.
   - Name it `portfolio` → site lives at `https://<your-username>.github.io/portfolio/`
   - Or name it `<your-username>.github.io` → site lives at `https://<your-username>.github.io/`
2. Make it **Public**, then create it.
3. Click **Add file → Upload files** and drag in everything inside this folder
   (the files *and* the `images` folder). Commit.
4. Go to **Settings → Pages**. Under *Build and deployment*, choose
   **Deploy from a branch**, branch **main**, folder **/ (root)**. Save.
5. Wait a minute or two, refresh the Pages settings, and the link appears at the top.

To update later, edit a file on GitHub (pencil icon) or upload a new version. The site redeploys on its own.

## Preview on your computer

Just double-click `index.html` to open it in your browser.

## Fill in the placeholders

Anything highlighted with an **orange dashed box** on the page still needs your info.
In the HTML they're wrapped in `<span class="todo">…</span>`. Search for `todo`,
replace the text, and delete the span tags around it.

- Home: the Formula RC league step's plan in Now printing

## Update "Now printing"

The cards in the **Now printing** section on `index.html` get their progress from their step lists.
Give each step `class="done"` (finished) or `class="now"` (what you're on), or no class (not started):

```html
<li class="done">Two v1 paddles finished</li>
<li class="now">TPU core thickness test</li>
<li>ABS plates (stiffer)</li>
```

The progress bar, percentage, and "Layer 2/5" counter update themselves.

Each step is clickable. What appears in the detail panel lives in that step's `<template>`:
photos and videos go in `<div class="insp-media">`, followed by paragraphs. `data-material`
(PETG, TPU, ABS, PETG-CF) sets the temperatures shown in the print animation.
To retire a job, delete its whole `<article class="job">…</article>` block.

## Photos

All photos are in `images/`, already cropped, compressed (under ~400 KB each), and stripped of
location data from your phone.

- `images/paddle/`: hero, card (home page), sketches, parts, plate-flat, core, rim, handle, plate, glue, finished, profile
- `images/rc-car/`: hero, card (home page), electronics, notes-redesign, notes-hardware, sketch, notes-math, notes-steering, notes-parts-1, notes-parts-2, notes-washer, rear, shock, shredded-gear, sleeve-calcs, grub-screw, motor

To swap a photo, save the new one under the same filename. **Filenames are case-sensitive on GitHub Pages**
(`Hero.JPG` ≠ `hero.jpg`). iPhone photos are .HEIC, which browsers can't show, so export them as JPG first.
If a photo is missing, the page shows a dashed box with the filename it expects.

## Videos

The site's videos are in `videos/`, compressed for the web (about 12 MB total instead of 90 MB) with location
data removed: `rc-first-drive`, `steering-demo`, `pickle-game`, `pickle-slowmo`, each with a `-poster.jpg` cover frame.

**Don't upload your original phone videos.** GitHub's website won't accept files over 25 MB, and the site doesn't use them.

## Comparison overlays

`paddle.html` and `rc-car.html` each have a drag-to-compare section (`compare.js`). The reference photos
load straight from Wikimedia Commons (credited under each one) and are cut out of their backgrounds in
the browser. Settings live in each `.cmp` element's `data-config`: real sizes in inches for the paddle,
and part-marker positions (percent of each photo) for the RC car.

The gear diagrams in the AP Research step get a "turn the input" slider when the site is served online.
If you open the files straight from your computer, they still animate but the slider doesn't appear.

## Adding another project

1. Copy `paddle.html`, rename it (e.g. `drone.html`), and replace the content.
2. In `index.html`, copy one `<a class="card">…</a>` block inside `.cards` and point it at the new page.
3. Add a link to the new page in each page's `<nav>`.

## After editing style.css or a .js file

Browsers keep old copies of these files. When you change one, bump the number after `?v=` in the
`<link>` and `<script>` tags at the top and bottom of each page (e.g. `style.css?v=12` to `style.css?v=13`)
so visitors get the new version.

## The printer at the top of the home page

`hero-printer.js` prints five parts in a loop: the paddle face plate and TPU core, the RC car's bevel gear
and pull arm, and the AP Research cycloidal disk. Each part's name, project, link, filament, nozzle
temperature, and color are in the `PARTS` list near the top of the file.
