# Demo / UAT sample data

A ready-made plan you can load to demo sprintplan or to give UAT testers
something to drive, without keying data by hand.

It is a realistic ~3-month **software-development** project — 8 epics, 34
stories (124 points), every story sitting in the **backlog** with a summary and
relevant points. Nothing is placed into a sprint, so during a demo you drag the
stories into the sprint containers yourself, as if you had already keyed them.

The plan presets the settings to **3 months / 2-week sprints / velocity 20 /
10% buffer** (~6 sprints, ~108 points of capacity). The backlog deliberately
holds a little more than fits, so prioritisation is part of the story.

## Load it

The file is `public/samples/sample-plan.json`. On a running instance it is also
served at **`/samples/sample-plan.json`** (e.g. `https://sprintplan.uk/samples/sample-plan.json`),
so testers can download it.

1. Click **Import board** in the top bar.
2. Choose `sample-plan.json`.

The board is replaced with the sample and autosaves, exactly like importing any
exported board.

## Clear it (back to a real, empty plan)

The sample is just a normal board, so use the built-in "start fresh" path:

1. **Reload the page.**
2. In the resume prompt, choose **Start new plan** (it asks you to confirm, so
   you can't wipe real work by accident).

That leaves you on a clean, empty plan ready to key real data. (Re-importing the
sample, or importing your own exported board, also replaces whatever is on the
board.)

## Regenerate it

The file is generated from the real reducers, so it always matches the current
schema and passes the Import boundary:

```
node samples/build-sample-plan.mjs
```

Edit the epics/stories in `samples/build-sample-plan.mjs` and re-run to refresh
`public/samples/sample-plan.json`.
