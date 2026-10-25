import { CATALOG, CATEGORIES, sizeLabel } from "./catalog.js";
import { FLOORS, getFloorTexture } from "./textures.js";
import { WALL_NAMES } from "./room.js";
import { makeThumbnails } from "./thumbnails.js";
export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) e.append(c);
  return e;
}
export function button(label, fn, cls = "") {
  const b = el("button", { class: cls }, [label]);
  b.addEventListener("click", fn);
  return b;
}
let fieldId = 0;
function field(label, input) {
  const id = `field-${++fieldId}`;
  input.id = id;
  if (!input.getAttribute("aria-label"))
    input.setAttribute("aria-label", label);
  return el("div", { class: "field" }, [
    el("label", { for: id }, [label]),
    input,
  ]);
}
function num(v, { min = 0, max = 50, step = 0.05 } = {}, change) {
  const input = el("input", { type: "number", min, max, step });
  input.value = Number(v.toFixed(3));
  input.addEventListener("change", () => {
    if (input.value !== "" && input.checkValidity()) change(+input.value);
    else {
      input.reportValidity();
      input.value = v;
    }
  });
  return input;
}
function color(value, change) {
  const input = el("input", { type: "color", value });
  input.addEventListener("change", () => change(input.value));
  return input;
}
function section(title, children, open = true) {
  const d = el("details", { class: "section", ...(open ? { open: "" } : {}) }, [
    el("summary", {}, [title]),
    ...children,
  ]);
  return d;
}
export function openDialog(title, children) {
  document.getElementById("dialogTitle").textContent = title;
  document.getElementById("dialogBody").replaceChildren(...children);
  const d = document.getElementById("workspaceDialog");
  if (!d.open) d.showModal();
}
export const closeDialog = () =>
  document.getElementById("workspaceDialog").close();
export function nameForm(label, placeholder, submit, initial = "") {
  const form = el("form", { class: "name-form" }),
    input = el("input", {
      type: "text",
      placeholder,
      required: "",
      maxlength: 60,
      "aria-label": label,
    });
  input.value = initial;
  const b = el("button", { type: "submit", class: "primary" }, [label]);
  form.append(input, b);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (v) submit(v, input);
  });
  return form;
}
export function createUI(h) {
  document.getElementById("dialogClose").onclick = closeDialog;
  const catalog = document.getElementById("catalog"),
    inspector = document.getElementById("inspector");
  const search = el("input", {
      type: "search",
      placeholder: "Find furniture…",
      "aria-label": "Search furniture",
    }),
    filter = el("select", { "aria-label": "Furniture category" });
  for (const cat of ["All categories", ...CATEGORIES])
    filter.append(el("option", { value: cat }, [cat]));
  const grid = el("div", { class: "catalog-content" });
  catalog.append(
    el("div", { class: "panel-heading" }, [
      el("span", { class: "eyebrow" }, ["MAKE ROOM FOR IDEAS"]),
      el("h2", {}, ["Furniture"]),
      el("p", { class: "hint" }, ["Choose a piece, then click to place it."]),
      el(
        "a",
        {
          class: "model-viewer-link",
          href: "./models.html",
          target: "_blank",
          rel: "noopener",
          "aria-label": "Open model viewer (new tab)",
        },
        ["Model viewer", el("span", { "aria-hidden": "true" }, ["↗"])],
      ),
    ]),
    el("div", { class: "catalog-search" }, [search, filter]),
    grid,
  );
  const thumbs = makeThumbnails(CATALOG);
  function renderCatalog() {
    grid.replaceChildren();
    let count = 0;
    for (const cat of CATEGORIES) {
      if (filter.value !== "All categories" && filter.value !== cat) continue;
      const defs = CATALOG.filter(
        (d) =>
          d.cat === cat &&
          `${d.name} ${d.size} ${d.cat}`
            .toLowerCase()
            .includes(search.value.toLowerCase()),
      );
      if (!defs.length) continue;
      count += defs.length;
      const cards = el("div", { class: "cat-grid" });
      for (const d of defs) {
        const b = button("", () => h.onSpawn(d), "cat-item");
        b.title = `Place ${d.name}, ${d.size} cm`;
        b.setAttribute("aria-label", `Place ${d.name} ${d.size}`);
        if (thumbs.has(d.type))
          b.append(
            el("img", { src: thumbs.get(d.type), alt: "", draggable: "false" }),
          );
        b.append(
          el("strong", {}, [d.name]),
          el("small", {}, [`${d.size}${d.size.includes('"') ? "" : " cm"}`]),
        );
        cards.append(b);
      }
      grid.append(el("h3", {}, [cat]), cards);
    }
    if (!count)
      grid.append(
        el("div", { class: "empty" }, [
          "No matches. Try another name or category.",
        ]),
      );
  }
  search.oninput = renderCatalog;
  filter.onchange = renderCatalog;
  renderCatalog();
  const tabs = el("div", {
      class: "inspector-tabs",
      role: "tablist",
      "aria-label": "Property categories",
    }),
    panels = {};
  let active = "Object",
    selectedWall = null,
    currentRoom = null;
  for (const name of ["Object", "Room", "Materials", "Lighting"]) {
    const p = el("div", {
      class: "inspector-panel",
      role: "tabpanel",
      id: `panel-${name}`,
      "aria-label": name,
    });
    panels[name] = p;
    const b = button(name, () => setTab(name));
    b.setAttribute("role", "tab");
    b.id = `tab-${name}`;
    b.setAttribute("aria-controls", p.id);
    tabs.append(b);
  }
  function setTab(name) {
    active = name;
    for (const [key, p] of Object.entries(panels)) p.hidden = key !== name;
    for (const b of tabs.children) {
      const on = b.textContent === name;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    }
  }
  tabs.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    const names = Object.keys(panels),
      i = names.indexOf(active);
    setTab(names[(i + (e.key === "ArrowRight" ? 1 : 3)) % 4]);
    tabs.querySelector('[aria-selected="true"]').focus();
  });
  inspector.append(tabs, ...Object.values(panels));
  const selectionContent = el("div"),
    itemList = el("div", { class: "item-list" }),
    checks = el("div", { id: "layoutChecks" });
  panels.Object.append(
    selectionContent,
    section("Objects in this layout", [itemList]),
    section("Layout checks", [
      el("p", { class: "hint" }, [
        "Footprint checks flag overlaps and door swings. Rugs and objects at different heights are allowed.",
      ]),
      checks,
    ]),
  );
  const action = (label, a, cls = "") =>
    button(label, () => h.onItemAction(a), cls);
  function showItem(item, def, items = []) {
    const focused = selectionContent.contains(document.activeElement)
      ? document.activeElement.getAttribute("aria-label")
      : null;
    const n = items.length || Number(!!item),
      body = [];
    selectionContent.replaceChildren();
    if (!item) {
      selectionContent.append(
        el("div", { class: "empty selection-empty" }, [
          el("div", { class: "empty-icon" }, ["⌖"]),
          el("strong", {}, ["Give an idea some space."]),
          el("p", {}, [
            "Select a piece to adjust it, or choose furniture from the library.",
          ]),
          el("p", { class: "hint" }, [
            "Shift-click to select multiple pieces. Group a desk, screen and chair into a workstation.",
          ]),
        ]),
      );
    } else {
      setTab("Object");
      selectedWall = null;
      body.push(
        el("div", { class: "selection-heading" }, [
          el("span", { class: "eyebrow" }, [
            n > 1 ? "MULTIPLE SELECTION" : "SELECTED OBJECT",
          ]),
          el("h2", {}, [n > 1 ? `${n} pieces selected` : def.name]),
          el("p", { class: "hint" }, [
            n > 1
              ? "Move, rotate and duplicate these pieces together."
              : sizeLabel(def),
          ]),
        ]),
      );
      if (n === 1 && !def.fixedSize) {
        body.push(
          section("Size", [
            ...["w", "d", "h"].map((k, i) =>
              field(
                ["Width · cm", "Depth · cm", "Height · cm"][i],
                num(def[k] * 100, { min: 10, max: 5000, step: 5 }, (v) =>
                  h.onItemChange({ [k]: v / 100 }),
                ),
              ),
            ),
            button(
              "Reset size",
              () => h.onItemChange({ w: null, d: null, h: null }),
              "text-button",
            ),
          ]),
        );
      }
      if (n === 1)
        body.push(
          section("Position & rotation", [
            field(
              "X · m",
              num(item.x, { step: 0.05 }, (v) => h.onItemChange({ x: v })),
            ),
            field(
              "Z · m",
              num(item.z, { step: 0.05 }, (v) => h.onItemChange({ z: v })),
            ),
            field(
              "Rotation · °",
              num(item.rot || 0, { min: -360, max: 360, step: 15 }, (v) =>
                h.onItemChange({ rot: v }),
              ),
            ),
            field(
              "Elevation · m",
              num(item.elevation || 0, {}, (v) =>
                h.onItemChange({ elevation: v }),
              ),
            ),
            field(
              "Colour",
              color(item.color || def.color, (c) =>
                h.onItemChange({ color: c }),
              ),
            ),
          ]),
        );
      body.push(
        el("div", { class: "row" }, [
          action("↶ 15°", "rotateLeft"),
          action("↷ 15°", "rotateRight"),
        ]),
        el("div", { class: "row" }, [
          action("Duplicate", "duplicate"),
          action("Delete", "delete", "danger"),
        ]),
      );
      if (n > 1)
        body.push(
          el("div", { class: "row" }, [
            action("Group", "group"),
            action("Ungroup", "ungroup"),
          ]),
          el("div", { class: "row" }, [
            action("Align X", "alignX"),
            action("Align Z", "alignZ"),
          ]),
        );
      else if (item.group) body.push(action("Ungroup", "ungroup"));
      selectionContent.append(...body);
    }
    if (focused)
      [...selectionContent.querySelectorAll("input")]
        .find((i) => i.getAttribute("aria-label") === focused)
        ?.focus();
    const bar = document.getElementById("selectionBar");
    bar.hidden = !item;
    bar.replaceChildren();
    if (item)
      bar.append(
        el("span", {}, [n > 1 ? `${n} selected` : def.name]),
        action("↶", "rotateLeft"),
        action("↷", "rotateRight"),
        action("Duplicate", "duplicate"),
        action("Delete", "delete"),
      );
  }
  function showWall(id, room) {
    selectedWall = id;
    if (id) {
      currentRoom = room;
      renderMaterials();
      setTab("Materials");
    }
  }
  function renderMaterials() {
    const r = currentRoom;
    if (!r) return;
    const target = selectedWall
        ? WALL_NAMES[selectedWall] || "Selected wall"
        : "All walls",
      value = selectedWall
        ? r.wallColors[selectedWall] || r.wallColor
        : r.wallColor;
    const paints = el("div", { class: "paint-swatches" });
    for (const c of [
      "#f2efe8",
      "#ffffff",
      "#d7d9d2",
      "#b7c4b0",
      "#82918d",
      "#33464b",
      "#b6a08c",
      "#c6a19c",
    ]) {
      const b = button(
        "",
        () => h.onWallColor(selectedWall, c),
        "paint-swatch",
      );
      b.style.background = c;
      b.title = c;
      b.setAttribute("aria-label", `Paint ${target.toLowerCase()} ${c}`);
      paints.append(b);
    }
    const paintChildren = [
      el("p", { class: "hint" }, [target]),
      paints,
      field(
        "Custom paint",
        color(value, (c) => h.onWallColor(selectedWall, c)),
      ),
    ];
    if (selectedWall)
      paintChildren.push(
        button("Use room colour", () => h.onWallColor(selectedWall, null)),
        button(
          "Edit all walls",
          () => {
            selectedWall = null;
            renderMaterials();
          },
          "text-button",
        ),
      );
    const sections = [section("Wall paint", paintChildren)];
    const floors = r.floorPlan
      ? r.floorPlan.rooms.map((room) => [
          `${room.name} floor`,
          room.id,
          room.floor,
        ])
      : [
          ["Office floor", "floor", r.floor],
          ["Kitchen floor", "kitchenFloor", r.kitchenFloor],
          ["Bathroom floor", "bathroom", r.bathroom.floor],
        ];
    for (const [label, key, value] of floors) {
      const grid = el("div", { class: "material-grid" });
      for (const [k, f] of Object.entries(FLOORS)) {
        const b = button(
          "",
          () =>
            h.onRoomChange((m) => {
              if (m.floorPlan)
                m.floorPlan.rooms.find((room) => room.id === key).floor = k;
              else if (key === "bathroom") m.bathroom.floor = k;
              else m[key] = k;
            }),
          "material-card" + (k === value ? " active" : ""),
        );
        b.title = f.name;
        b.setAttribute("aria-label", `${label}: ${f.name}`);
        b.setAttribute("aria-pressed", String(k === value));
        b.append(
          el("img", { src: getFloorTexture(k).image.toDataURL(), alt: "" }),
          el("span", {}, [f.name.replace(" (ours)", "")]),
        );
        grid.append(b);
      }
      sections.push(section(label, [grid], label === "Office floor"));
    }
    panels.Materials.replaceChildren(...sections);
  }
  function renderRoom(r, lighting) {
    const openSections = new Map(
      [...inspector.querySelectorAll("details")].map((d) => [
        d.querySelector("summary").textContent,
        d.open,
      ]),
    );
    const scrollTop = inspector.scrollTop;
    currentRoom = r;
    const change = (path) => (v) =>
      h.onRoomChange((room) => {
        let o = room;
        for (const key of path.slice(0, -1)) o = o[key];
        o[path.at(-1)] = v;
      });
    const f = (label, path, value, opts) =>
      field(label, num(value, opts, change(path)));
    if (r.floorPlan) {
      panels.Room.replaceChildren(
        el("div", { class: "panel-heading" }, [
          el("span", { class: "eyebrow" }, ["YOUR FLOOR PLAN"]),
          el("h2", {}, ["Rooms & walls"]),
          el("p", { class: "hint" }, [
            `${r.floorPlan.rooms.length} rooms · ${r.floorPlan.openings.length} openings`,
          ]),
          button("Edit floor plan", () => h.onFloorPlan(), "primary"),
        ]),
        section("Building", [
          f("Ceiling · m", ["ceiling"], r.ceiling, { min: 2.1, max: 10 }),
          f("Wall thickness · m", ["wallThickness"], r.wallThickness, {
            min: 0.05,
            max: 0.5,
            step: 0.01,
          }),
        ]),
        section(
          "Rooms",
          r.floorPlan.rooms.map((room) => el("p", {}, [room.name])),
        ),
      );
    } else {
      panels.Room.replaceChildren(
        el("div", { class: "panel-heading" }, [
          el("span", { class: "eyebrow" }, ["THE FOUNDATIONS"]),
          el("h2", {}, ["Room dimensions"]),
          el("p", { class: "hint" }, ["All measurements are in metres."]),
          button("Draw your own floor plan", () => h.onFloorPlan(), "primary"),
        ]),
        section("Room envelope", [
          f("Width · m", ["width"], r.width, { min: 2 }),
          f("Length · m", ["length"], r.length, { min: 2 }),
          f("Ceiling · m", ["ceiling"], r.ceiling, { min: 2.1, max: 10 }),
          f("Notch width · m", ["notch", "width"], r.notch.width, { min: 0.8 }),
          f("Notch depth · m", ["notch", "depth"], r.notch.depth, { min: 1 }),
        ]),
        section(
          "Window wall",
          [
            f("Sill · m", ["window", "sill"], r.window.sill),
            f("Top · m", ["window", "top"], r.window.top),
          ],
          false,
        ),
        section(
          "Entrance door",
          [
            f("From left · m", ["entranceDoor", "from"], r.entranceDoor.from),
            f("Width · m", ["entranceDoor", "width"], r.entranceDoor.width, {
              min: 0.6,
            }),
          ],
          false,
        ),
        section(
          "Kitchen door",
          [
            f("From corner · m", ["kitchenDoor", "from"], r.kitchenDoor.from, {
              min: 0.1,
            }),
            f("Width · m", ["kitchenDoor", "width"], r.kitchenDoor.width, {
              min: 0.6,
            }),
          ],
          false,
        ),
        section(
          "Bathroom",
          [
            f("Width · m", ["bathroom", "width"], r.bathroom.width),
            f(
              "Door offset · m",
              ["bathroom", "door", "from"],
              r.bathroom.door.from,
            ),
            f(
              "Door width · m",
              ["bathroom", "door", "width"],
              r.bathroom.door.width,
              { min: 0.6 },
            ),
            el("p", { class: "hint" }, [
              "Set bathroom width to 0 to remove it.",
            ]),
          ],
          false,
        ),
      );
    }
    renderMaterials();
    const time = el("output", { class: "time-output" }),
      slider = el("input", {
        type: "range",
        min: 6,
        max: 20,
        step: 0.25,
        "aria-label": "Daylight time",
      });
    slider.value = lighting.hour;
    const fmt = (v) =>
      `${String(Math.floor(v)).padStart(2, "0")}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}`;
    time.textContent = fmt(lighting.hour);
    slider.addEventListener("input", () => {
      time.textContent = fmt(+slider.value);
      h.onLightingChange({ hour: +slider.value }, false);
    });
    slider.addEventListener("change", () =>
      h.onLightingChange({ hour: +slider.value }, true),
    );
    const light = el("input", { type: "checkbox" });
    light.checked = lighting.ceilingLights;
    light.onchange = () =>
      h.onLightingChange({ ceilingLights: light.checked }, true);
    panels.Lighting.replaceChildren(
      el("div", { class: "panel-heading" }, [
        el("span", { class: "eyebrow" }, ["SET THE MOOD"]),
        el("h2", {}, ["Light & atmosphere"]),
      ]),
      section("Daylight", [
        time,
        slider,
        el("div", { class: "range-labels" }, [
          "06:00",
          el("span", {}, ["20:00"]),
        ]),
        el("p", { class: "hint" }, [
          "Explore a simulated day through your windows.",
        ]),
      ]),
      section("Interior lights", [
        el("label", { class: "toggle" }, [light, " Ceiling lights"]),
      ]),
      el("p", { class: "hint" }, [
        "Use From door or Walkthrough to see the room at eye level. Photo mode refines the current view with natural light bounces.",
      ]),
    );
    for (const d of inspector.querySelectorAll("details")) {
      const key = d.querySelector("summary").textContent;
      if (openSections.has(key)) d.open = openSections.get(key);
    }
    inspector.scrollTop = scrollTop;
    setTab(active);
  }
  function renderItems(items, selected) {
    itemList.replaceChildren();
    for (const it of items) {
      const def = CATALOG.find((d) => d.type === it.type);
      const b = button(
        `${it.group ? "▣" : "○"} ${def?.name || it.type}`,
        () => {},
        "object-row" + (selected.has(it.id) ? " active" : ""),
      );
      b.onclick = (e) => h.onSelectId(it.id, e.shiftKey);
      b.setAttribute("aria-pressed", String(selected.has(it.id)));
      itemList.append(b);
    }
    if (!items.length)
      itemList.append(
        el("p", { class: "hint" }, ["Your room is ready for its first piece."]),
      );
  }
  function showWarnings(warnings) {
    checks.replaceChildren();
    if (!warnings.length)
      checks.append(
        el("p", { class: "check-good" }, [
          "✓ No overlaps or blocked door swings detected.",
        ]),
      );
    for (const w of warnings)
      checks.append(
        button(w.message, () => h.onSelectIds(w.ids), "warning-row"),
      );
    document.getElementById("checksStatus").textContent = warnings.length
      ? `${warnings.length} layout ${warnings.length === 1 ? "check" : "checks"}`
      : "✓ Layout clear";
    document
      .getElementById("checksBtn")
      .classList.toggle("has-warnings", !!warnings.length);
  }
  document.getElementById("checksBtn").onclick = () => {
    setTab("Object");
    checks.parentElement.open = true;
    checks.scrollIntoView({ behavior: "smooth" });
  };
  showItem(null);
  setTab("Object");
  return {
    showItem,
    showWall,
    renderRoom,
    renderItems,
    showWarnings,
    setTab,
    getTab: () => active,
    setSaveStatus: (t) =>
      (document.getElementById("saveStatus").textContent = t),
  };
}
