# Offiz

A local office planning studio. The room, furniture, materials, layout alternatives
and camera bookmarks stay in this browser. No accounts or uploads.

## Run and verify

```bash
npm install
npm run dev
npm test
npm run build
```

Open http://localhost:5173. `npm run preview` serves the production build.

## Design a layout

- Search or filter the furniture library. Click a thumbnail to preview it, then
  click inside the room to place it. **R / Shift R** rotates the preview;
  **Esc** cancels it.
- Drag pieces in either 3D or Plan. Snapping combines a 5 cm grid with nearby
  furniture edge/centre guides. Invalid moves slide along the available axis.
- **Shift-click** pieces (or their entries in the Object panel) to select more.
  Group a workstation with **⌘/Ctrl G**; ungroup with **Shift ⌘/Ctrl G**.
  Selecting one member selects its group. Groups move, rotate and duplicate together.
- **R / Shift R** rotates 15°, **arrows** nudge 5 cm (**Shift**: 25 cm), **D**
  duplicates, **Delete / Backspace** deletes. X/Z alignment is available for
  multiple selections in the Object panel.
- **⌘/Ctrl Z** undoes; **Shift ⌘/Ctrl Z** or **Ctrl Y** redoes. History keeps
  up to 100 snapshots for this session, including furniture, room settings,
  finishes, lighting, camera bookmarks, imports and resets. One drag is one step.
- The contextual inspector has **Object / Room / Materials / Lighting** tabs.
  Collapse sections or hide either side panel for more drawing space. Dimensions
  explicitly state cm, metres or degrees.

## Plan and placement checks

Plan is an editable vector drawing with flat furniture footprints, a half-metre
grid, metre rulers, dimension lines and door swings. Select one object to see its
clearance to surrounding walls. Scroll to zoom, drag empty space to pan, or use
**Fit** to frame the room. The Dimensions toggle also hides rulers and clearances.

All edits—dragging, typing, resizing, rotation, duplication and placement—check
room boundaries and ceiling height. Room changes reject newly stranded furniture.
Existing imported problems remain visible so they can be corrected.

The Layout checks panel highlights footprint overlaps and blocked door swings in
both views. Click a check to select the affected pieces. Checks use bounding
footprints, so furniture with recesses or tuck-under seating may need judgement;
rugs and objects at separate heights are excluded from overlap warnings.

## Alternatives and presentation

- **Layouts** saves named alternatives, opens them, updates a saved version, or
  compares a saved plan with the current plan side by side. Up to 30 alternatives
  are stored separately from the current layout. Opening one is undoable.
- **Materials** provides floor thumbnails, paint swatches and custom colours.
  Click a wall in 3D to paint only that wall.
- **3D studio** supports orbit, pan and zoom, with Cutaway, Fade and Solid wall modes.
  **From door** positions the camera at eye level.
- **Walkthrough**: drag to look; **W A S D** moves; **up/down** moves forward/back;
  **left/right** turns; **Shift** moves faster; **Esc** exits. Movement respects
  room walls, door openings and furniture footprints.
- **Cameras** saves up to 30 named angles or plan framings. Bookmarks travel with
  the current layout's JSON file.
- **Photo** progressively path traces the current 3D view. Wait for samples to
  accumulate, then Save PNG. Camera movement restarts refinement. The path tracer
  loads only when Photo is first used and requires a capable WebGL GPU.
- **Export** offers a dimensioned SVG, a 2000-pixel-wide floor-plan PNG, a PNG of
  the current camera, and editable JSON. View images omit editing outlines.
- **•••** contains JSON import, an undoable reset, and keyboard help. JSON exports
  contain the current layout and its camera bookmarks, not the whole alternatives
  library. Save exports as backups; browser storage is local to each site origin.

## The measured room

The default room is 6.70 m × 9.50 m with a 3.50 m × 2.30 m notch at the
bottom-right. The notch contains a kitchen and bathroom. The entrance is on the
remaining 3.20 m wall. The window spans the top wall, starting 1.50 m above the
floor. All of these measurements are editable.

X runs along the window wall; Z runs from the window toward the entrance. Daylight
is an illustrative time-of-day simulation, not a location/date-based sun study.

## Code

| Module | Responsibility |
| --- | --- |
| `main.js` | Scene, history wiring, views, walkthrough, layouts, cameras, exports |
| `editor.js` | Selection, groups, placement preview, dragging and edit validation |
| `geometry.js` | Shared footprint containment, overlap and door-swing checks |
| `history.js` | Bounded, branching undo/redo snapshots |
| `plan.js` | Interactive SVG plan, dimensions, rulers and SVG/PNG exports |
| `ui.js`, `style.css` | Library, contextual inspector, dialogs and responsive layout |
| `thumbnails.js` | Local 3D catalog thumbnails |
| `store.js` | Defaults, validated imports, autosave and saved alternatives |
| `room.js`, `catalog.js` | Parametric room and furniture geometry |
| `lighting.js`, `textures.js`, `photo.js` | Lighting, procedural materials and photo rendering |

`tests/planner.test.js` covers history branching, concave containment, rotation,
group operations, drag transactions, wall sliding, overlap exceptions, door
conflicts, import validation and standalone SVG output.

## About

Offiz started as one evening's conversation: a hand-drawn sketch of a real
office, measured on site, turned into a planner for that exact room. It was
built with AI coding assistants (Claude Code and Codex) and runs entirely on
your own machine — no accounts, no uploads, nothing phones home.

Measurements of the default room are real; the furniture is parametric
geometry rather than product models, which is enough to answer "does this
layout work?" before anything gets bought or moved.

## License

MIT — see [LICENSE](LICENSE).
