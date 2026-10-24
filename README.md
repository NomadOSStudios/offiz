# Offiz

A local 3D planner for the new office space. Runs entirely in the browser on
this Mac — no accounts, no uploads. Everything you place is autosaved in the
browser and can be exported/imported as JSON.

## Run

```bash
npm run dev
```

Then open http://localhost:5173.

## The room

The shape comes from the measured sketch: 6.70 m × 9.50 m with a 3.50 m ×
2.30 m notch in the bottom-right corner, leaving a 3.20 m wide wall for the
entrance door. The notch is split left/right: kitchen next to the office
(door from the office), small bathroom in the far corner (door from the
kitchen). The whole top
wall is a window from 1.50 m up. Every one of those numbers is editable in
the Room panel on the right, including door positions and the window sill.

Plan orientation: x runs along the window wall, z runs from the window (z = 0)
towards the entrance (z = 9.5).

## Using it

- **Add** items from the catalog on the left. They appear in the middle of the office.
- **Drag** an item to move it. Items can't leave the room; they slide along walls.
- **R / ⇧R** rotate 15°, **arrows** nudge 5 cm (⇧ for 25 cm), **D** duplicate, **⌫** delete.
- **Click a wall** to paint just that wall. "Wall paint" in the Room panel paints all of them.
- **Floors**: pick a finish for the office and kitchen separately.
- **Daylight**: drag the time slider to see where the sun falls through the window.
- **Views**: 3D orbit (left-drag rotates, right-drag pans, scroll zooms), Plan (top-down), From the door (eye level).
- **Photo**: path-traces the current view on the GPU (three-gpu-pathtracer). It keeps
  refining while you wait; give an interior view 30–60 s, then Save PNG. Dragging
  restarts the render. Walls faded out in the dollhouse view are removed for the photo.

The real-time view uses an environment map, GTAO ambient occlusion, a light bloom
and SMAA. The office floor defaults to the grey carpet-tile mix going into the real room.

## Code

| File | What it does |
| --- | --- |
| `src/store.js` | Room config defaults, starter layout, localStorage + JSON import/export |
| `src/room.js` | Builds walls with openings, doors, window, floors, ceiling, dimension labels |
| `src/catalog.js` | Parametric furniture (all primitives, no model files) |
| `src/editor.js` | Selection, drag, keyboard editing, wall snapping, keep-inside-room |
| `src/lighting.js` | Sun through the window by time of day, sky, ceiling lights |
| `src/textures.js` | Procedural wood / carpet / tile / concrete textures |
| `src/ui.js` | Catalog and inspector panels |
| `src/main.js` | Scene, cameras, views, wiring |
