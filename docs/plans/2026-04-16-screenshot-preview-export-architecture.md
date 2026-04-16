# Screenshot Preview/Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make screenshot invocation fast again while keeping both the selection preview and the final exported image sharp across macOS, Windows, and Linux.

**Architecture:** Split screenshot handling into two pipelines. The selection phase uses a fast full-screen preview image that is allowed to be platform-specific and optimized for latency. The edit/export phase uses a high-quality crop derived from the original captured frame that stays in Rust-side memory until the screenshot flow ends. The frontend sees one shared flow and never branches on platform.

**Tech Stack:** Tauri 2, Rust (`xcap`, Core Graphics / platform-native capture where available, `image`), React, TypeScript, existing screenshot/editor flow.

---

### Task 1: Remove the Architectural Coupling

**Files:**
- Modify: `src-tauri/src/screenshot.rs`
- Modify: `src/pages/Screenshot/index.tsx`
- Modify: `src/pages/Screenshot/hooks/useScreenshot.ts`
- Modify: `src/pages/Screenshot/components/Editor/index.tsx`

**Step 1: Write a short design note inside the plan implementation branch**

Document the invariant in code comments near the Rust store:

- preview path must not define final export quality
- final export must never depend on full-screen preview encoding

**Step 2: Write the failing test or pure helper check**

If the code change introduces new deterministic helpers, add targeted tests in `src/utils/*.test.ts`.

If the logic cannot be exercised as a pure helper yet, create the helper first before touching the screenshot flow.

**Step 3: Run the targeted test to verify it fails**

Run:

```bash
cd /Volumes/OuterHD/OuterIdeaProjects/EcoPaste && pnpm test
```

Expected:

- existing suite passes
- any new test added for the helper fails for the expected reason before implementation

**Step 4: Add new Rust session fields**

Extend the screenshot store data to distinguish:

- preview payload
- original capture payload

Do not reuse the current single `image_data_url` field for both roles.

**Step 5: Add new frontend types**

Introduce types that make the split obvious:

- `previewImageDataUrl`
- `selectionSource`
- `cropImageDataUrl`

**Step 6: Run compile verification**

Run:

```bash
cd /Volumes/OuterHD/OuterIdeaProjects/EcoPaste/src-tauri && cargo check
cd /Volumes/OuterHD/OuterIdeaProjects/EcoPaste && pnpm build:vite
```

Expected:

- both commands pass

---

### Task 2: Restore a Fast Full-Screen Preview Path

**Files:**
- Modify: `src-tauri/src/screenshot.rs`
- Test/inspect: existing screenshot logs

**Step 1: Write the failing behavior check**

Use the existing perf logs as the regression signal. Capture the current bad baseline before changing code.

Record:

- `trigger:screenshot_window_ready`
- Rust preview/capture timings

**Step 2: Reintroduce platform-specific preview encoding**

Preview path rules:

- macOS: restore native fast full-screen preview path instead of Rust-side full-screen PNG encode
- Windows/Linux: keep a fast preview path suitable for those platforms, even if implementation differs

The contract is:

- output only needs to be good enough for selection
- output must be fast enough to avoid blocking window show

**Step 3: Keep preview path isolated**

Do not let this preview image be reused by final copy/save/send.

**Step 4: Keep the current timing logs**

Retain logs around:

- capture
- preview encode
- window show

These logs are now part of the regression guardrail.

**Step 5: Verify behavior with logs**

Run the app and capture one screenshot.

Expected:

- `trigger:screenshot_window_ready` drops substantially from the current ~2.7s
- Rust logs show preview generation no longer dominated by full-screen PNG encode

---

### Task 3: Add High-Quality Crop Retrieval After Selection

**Files:**
- Modify: `src-tauri/src/screenshot.rs`
- Modify: `src/pages/Screenshot/hooks/useScreenshot.ts`
- Modify: `src/pages/Screenshot/index.tsx`
- Modify: `src/pages/Screenshot/components/SelectionOverlay/index.tsx`

**Step 1: Add a new Tauri command**

Add a command like:

```rust
get_screenshot_crop(label, x, y, w, h) -> Result<String, String>
```

The returned payload should be a high-quality crop image for the selected region.

**Step 2: Run the narrowest verification you can before wiring UI**

If crop logic is extracted into a pure helper, add a failing test and run it before implementing the crop.

**Step 3: Crop from the original stored frame**

Do not crop from the preview asset.

**Step 4: Trigger crop fetch when selection is confirmed**

Flow:

1. selection confirmed in `SelectionOverlay`
2. frontend calls crop command
3. crop is loaded into editor background
4. editor only starts after crop is ready

**Step 5: Add loading state**

The UI should briefly show a loading transition between selection confirmation and editor readiness if crop generation is not instantaneous.

**Step 6: Verify manually**

Expected:

- selection UI appears quickly
- editor background remains sharp after entering edit mode

---

### Task 4: Make the Editor Operate on the High-Quality Crop Only

**Files:**
- Modify: `src/pages/Screenshot/components/Editor/index.tsx`
- Modify: `src/pages/Screenshot/components/Editor/useDrawing.ts`
- Modify: `src/pages/Screenshot/index.tsx`

**Step 1: Write the failing helper test if any editor source-selection helper is introduced**

Only add tests for deterministic mapping helpers. Do not invent browser-heavy tests if the codebase does not already use them.

**Step 2: Remove any dependency on full-screen preview in edit mode**

The editor background should come from the selected crop image only.

**Step 3: Keep HiDPI canvas behavior**

Retain the recent HiDPI fixes in:

- `src/pages/Screenshot/components/Editor/index.tsx`
- `src/pages/Screenshot/components/Editor/useDrawing.ts`
- `src/pages/Screenshot/components/SelectionOverlay/index.tsx`

These fixes address display sharpness and should remain.

**Step 4: Confirm export source**

`toDataURL("image/png")` for final output must operate on:

- high-quality crop background
- annotation layers

Not on:

- full-screen preview JPEG

**Step 5: Verify manually**

Expected:

- final saved image is sharp
- text edges and UI boundaries are not visibly degraded by preview compression

---

### Task 5: Keep Multi-Platform Behavior Behind One Interface

**Files:**
- Modify: `src-tauri/src/screenshot.rs`
- Optional create: `src-tauri/src/screenshot_platform/` if split becomes necessary

**Step 1: Define one shared Rust-side contract**

The shared contract should expose:

- `capture preview`
- `store original frame`
- `crop original frame`
- `dispose session`

**Step 2: Use platform-specific internals**

Rules:

- macOS may use Core Graphics / native APIs for preview speed
- Windows may use its best available capture/encode path
- Linux may use the current backend or portal-compatible path

Do not force all platforms into one identical encode strategy if that strategy harms latency.

**Step 3: Avoid platform bleed into frontend**

Frontend should not need `if macOS` / `if Windows` logic for screenshot quality.

**Step 4: Verify compile on current platform**

Run:

```bash
cd /Volumes/OuterHD/OuterIdeaProjects/EcoPaste/src-tauri && cargo check
```

Expected:

- current target passes

---

### Task 6: Add Regression Tests for the Pure Helpers

**Files:**
- Existing: `src/utils/canvas-hidpi.ts`
- Existing: `src/utils/canvas-hidpi.test.ts`
- Create if needed: `src/pages/Screenshot/*.test.ts`

**Step 1: Keep current HiDPI helper tests green**

Run:

```bash
cd /Volumes/OuterHD/OuterIdeaProjects/EcoPaste && pnpm test src/utils/canvas-hidpi.test.ts
```

Expected:

- all tests pass

**Step 2: Add any new pure helper tests**

Only for logic that is deterministic, such as:

- selection to crop request shaping
- logical/physical coordinate transforms
- session payload mapping

**Step 3: Run the targeted test suite**

Run:

```bash
cd /Volumes/OuterHD/OuterIdeaProjects/EcoPaste && pnpm test
```

Expected:

- tests pass

---

### Task 7: Add Performance Acceptance Criteria

**Files:**
- Modify: `src/utils/perf-log.ts`
- Modify: `src/utils/screenshot-trigger.ts`
- Modify: `src/pages/Screenshot/index.tsx`
- Modify: `src/pages/Screenshot/components/SelectionOverlay/index.tsx`
- Modify: `src-tauri/src/screenshot.rs`

**Step 1: Keep current logs until rollout is complete**

The current timing logs are necessary for verification.

**Step 2: Define the metrics that matter**

Primary:

- `trigger:start -> trigger:screenshot_window_ready`

Secondary:

- preview encode time
- `event:screenshot_ready -> overlay:first_frame_drawn`
- selection confirm -> editor ready

**Step 3: Define acceptance targets**

Initial practical target:

- screenshot window ready in clearly sub-second time on current hardware
- first visible frame shortly after ready event
- no measurable quality regression in final saved screenshot

Do not remove logs before these numbers are verified.

---

### Task 8: Manual Verification Matrix

**Files:**
- No file changes required

**Step 1: Verify selection speed**

Check:

- trigger screenshot
- frozen preview appears quickly
- drag selection feels immediate

**Step 2: Verify edit quality**

Check:

- enter editor after selection
- crop background is sharp
- text and thin borders remain clear

**Step 3: Verify export quality**

Check:

- copy to clipboard
- save to file
- send flow if relevant

Compare against:

- original on-screen content
- previous blurry output

**Step 4: Verify cleanup**

Check:

- closing screenshot removes session data
- repeated screenshots do not accumulate stale buffers

---

## Risk Notes

1. Keeping original full-resolution frames in Rust memory increases session memory pressure.
   Mitigation: store only one active frame per screenshot label and release aggressively on close.

2. macOS preview speed and crop fidelity may use different APIs or representations.
   Mitigation: keep the separation explicit in code and logs.

3. Editor transition may add a small delay after selection.
   Mitigation: accept a brief selection-to-editor load if it preserves overall fast invocation and final quality.

## Out of Scope

These should not be bundled into the same change:

- OCR refactors unrelated to image source split
- pin-window redesign
- screenshot toolbar redesign
- cross-platform backend rewrites beyond what is needed for preview/crop separation

## Final Verification Commands

```bash
cd /Volumes/OuterHD/OuterIdeaProjects/EcoPaste && pnpm test
cd /Volumes/OuterHD/OuterIdeaProjects/EcoPaste && pnpm build:vite
cd /Volumes/OuterHD/OuterIdeaProjects/EcoPaste/src-tauri && cargo check
```

## Acceptance Criteria

1. Screenshot UI appears quickly again.
2. Selection overlay remains sharp on HiDPI displays.
3. Final copied/saved screenshot is sharp.
4. Quality no longer depends on the preview encoding path.
5. Architecture supports different fast paths per platform without frontend branching.
