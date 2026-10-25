# Draw the room in Plan mode — design brief

Goal: replace the fixed "L-shape with parameters" room with a room the user
draws in Plan mode, so Offiz works for any office, not just the measured one.
The measured room stays as the default template. Everything remains local.

## Data model

Replace the parametric room (`width/length/notch/bathroom/window/*Door`) with:

```js
room = {
  ceiling: 2.7,
  wallThickness: 0.15,          // outer walls
  partitionThickness: 0.1,
  outline: [[x, z], ...],       // metres, clockwise, closed implicitly
  partitions: [                 // inner walls, polylines
    { id, points: [[x, z], ...] },
  ],
  openings: [                   // attached to one wall segment
    { id, kind: 'door' | 'window', wall: { outline: edgeIndex } | { partition: id, edge: i },
      from: 1.2, width: 0.9, sill: 0, top: 2.1, hinge: 'start' | 'end', swing: 'in' | 'out' },
  ],
  areas: [                      // named enclosed regions with their own floor
    { id, name: 'Kitchen', polygon: [[x, z], ...], floor: 'tile' },
  ],
  wallColor, wallColors: { [wallKey]: color }, floor: 'carpetTiles',
};
```

- `from` is measured along the wall from its first point. Keep it in metres.
- `areas` can be derived from `outline` + `partitions` (planar faces) and
  cached; the office is the face that is not named. Derive on change, store the
  result so renders and checks never recompute geometry from scratch.
- Migration: `roomPolygons(cfg)` already produces the office, kitchen and
  bathroom polygons and the partition lines from today's parameters. Use it to
  convert any saved parametric room into this model on load (`mergeRoom` in
  `store.js`), so existing layouts and the default room open unchanged.

## Builder (`room.js`)

- `buildWall({ a, b, openings, offset, thickness })` already draws any
  segment with holes. Loop over `outline` edges (offset outward by
  `wallThickness / 2`) and partition edges (centred), passing each wall's
  openings. Keep the start-extension trick so outer corners close.
- Openings keep the frame, glass, leaf, handle and swing-arc code. Honour
  `hinge` and `swing`.
- One floor mesh per area plus one for the office face; one ceiling each.
- Labels: a length label at each outline edge midpoint (offset outward), an
  area label at each face centroid. Replace the five fixed dimension labels.
- Auto-fade: outer walls use their outward normal as now; partitions use the
  normal pointing away from the office face.

## Editor (`editor.js`, `geometry.js`)

- `isInside` and `snapToWall` already iterate polygons; feed them the office
  face plus `areas`. Nothing else should need to know the room shape.
- Layout checks: door swings come from `openings`, not hard-coded doors.

## Plan drawing tool (`plan.js`)

New toolbar in Plan: **Select · Draw walls · Draw partition · Add door · Add window**.

- **Draw walls**: click to place corners; snap to the 5 cm grid and to 0/90°
  from the previous point (hold Alt for free angles); close by clicking the
  first corner or pressing Enter. Esc cancels. Live length label on the
  segment being drawn.
- **Type-to-measure**: after the first click, typing digits opens a small
  length box; Enter places the next corner at that distance in the current
  pointer direction (snapped to the axis). This is how numbers from a paper
  sketch become walls.
- **Edit afterwards**: drag a corner (adjacent walls follow), drag a wall to
  move it parallel, select a wall and type its length in the inspector (the
  far corner moves). Double-click a wall to insert a corner.
- **Partitions**: same drawing, but as open polylines; endpoints snap to walls
  and other partitions. A partition that encloses a face creates a new area;
  the inspector names it and picks its floor.
- **Openings**: pick the tool, hover a wall, click to drop a default-size
  door/window; drag along the wall to move; inspector edits width, sill, top,
  hinge side, swing. Windows default to sill 1.5 / top 2.6; doors to 0.9 wide,
  2.1 high.
- Validation on every edit (`validateRoom`): simple polygon (no self-
  intersections), no wall shorter than 0.3 m, openings within their wall and
  not overlapping, furniture that ends up outside is reported, not deleted.
- Undo/redo: every drawing action is one history step; a corner drag is one.

## Inspector (`ui.js`)

- Room tab: ceiling, wall thickness, paint; a wall list with lengths (editable);
  an openings list; an areas list with name + floor. The old numeric fields
  for notch/bathroom/doors go away once the migration is in.
- Keep "Reset to the measured room" as a one-click template.

## Tests (`tests/planner.test.js`)

- Parametric → polygon migration produces today's exact polygons.
- Opening positions survive a wall length edit (clamped if the wall shrinks).
- Partition enclosing a face yields an area; removing it merges back.
- Validation rejects self-intersecting outlines and overlapping openings.

## Phasing

1. Data model + migration + builder on the new model, with the current UI
   still driving it through the migration. No visible change; tests prove it.
2. Plan tool: draw walls, type-to-measure, corner/wall editing, inspector lists.
3. Partitions and areas.
4. Openings tool; remove the old door/window fields.

Non-goals for now: curved walls, multiple floors, scanning paper sketches
(this tool is what a future scan would pre-fill).
