# src/

The app used to be one 560 KB `index.html`. It is the same program; the
files are where it lives now.

```
index.html          the shell: markup, and the script tags, in order
src/styles/app.css  the whole stylesheet
src/01-… 22-…       the application, split at the section banners it
                    already had
src/99-run-boot.js  drains the boot queue; always last
```

## No build step

These are plain `<script>` tags, not modules. They share one scope exactly
as they did when this was a single file, so the split changed where the
code lives and nothing about how it runs. The browser loads the files as
they are: push, and it is live on GitHub Pages. There is no npm, no
bundler and nothing to run before deploying.

## The one thing the split changed

Function declarations hoist within a script, not across scripts. A line at
the top level of `04` calling a function declared in `19` used to work and
now throws — and if that line sits in a `try/catch`, as the Locations boot
line did, nothing is printed and a card simply comes up empty.

So anything that runs at load and may reach across files is queued:

```js
onBoot(() => { drawLocSets(); drawTargets(); });
```

`src/99-run-boot.js` runs the queue once everything is defined.
`t/split.js` fails the build if a top-level call reaches forward, and
proves it can fail by catching a planted one.

## Adding a file

Create it under `src/`, add the `<script src>` to `index.html` in the
right place, and keep `99-run-boot.js` last. `t/split.js` checks that every
file on disk is loaded and that none was cut mid-statement.
