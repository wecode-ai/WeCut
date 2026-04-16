# Screenshot Preview/Export Design

**Decision:** Use `方案 A`:

- Rust keeps a full-resolution screenshot session in memory.
- The selection UI uses a fast preview representation.
- The editor and final output use a crop derived from the original captured frame, never from the preview.

## Goals

1. Screenshot invocation must feel immediate on low-end machines.
2. The selection overlay must remain sharp enough for precise selection on HiDPI displays.
3. Final copy/save/send output must remain sharp and must not inherit preview compression artifacts.
4. The design must work across macOS, Windows, and Linux without frontend platform branching.

## Non-Goals

1. Reworking OCR beyond adapting it to the new image source split.
2. Redesigning the screenshot toolbar or pin window UX.
3. Forcing every platform to use the same backend capture API.

## Core Problem

The current architecture blocks screenshot window presentation on:

1. full-screen capture
2. full-screen image encoding
3. base64 data URL generation
4. window show

That is the wrong dependency chain. Window presentation should depend on "preview is ready", not on "final-quality full-screen encoding is complete".

## Approved Architecture

### 1. Screenshot Session

Each screenshot window label owns one Rust-side session:

- `preview_image_data_url`: fast full-screen preview for selection only
- `original_capture`: original full-resolution capture kept in memory
- monitor metadata
- timestamps/logging fields

The session lives until the screenshot window closes or transitions into a completed flow.

### 2. Two Distinct Image Pipelines

#### Preview pipeline

Used only for:

- initial screenshot window display
- selection overlay
- quick visual freeze of the desktop

Requirements:

- low latency
- acceptable visual sharpness for selection
- may use platform-specific fast encoding or representation

#### Final pipeline

Used only for:

- entering the editor after selection
- copy
- save
- send
- OCR if it should operate on the selected result

Requirements:

- derived from the original full-resolution frame
- cropped after selection confirmation
- high-quality output

### 3. Selection-to-Editor Transition

Flow:

1. User triggers screenshot.
2. Rust captures one full-resolution frame and stores it in the session.
3. Rust also produces a fast preview image for the full display.
4. Frontend shows `SelectionOverlay` using the preview.
5. User confirms a rectangle.
6. Frontend requests `get_screenshot_crop(label, x, y, w, h)`.
7. Rust crops the original stored frame and returns a high-quality crop.
8. Frontend launches `Editor` with the crop image as background.

This allows the expensive quality-sensitive work to happen after the screenshot window is already visible.

## Platform Strategy

Frontend behavior is shared across all platforms. Backend capture internals are platform-specific.

### macOS

- Use the fastest available native preview path.
- Do not block window show on full-screen PNG generation.
- Preserve the original frame for final crop and export.

### Windows

- Use the fastest practical preview path for the current backend.
- Preserve the original frame for final crop and export.

### Linux

- Keep the same contract.
- Use the available backend/portal-compatible capture path for preview.
- Preserve the original frame for final crop and export.

The contract is shared. The implementation is allowed to differ by platform.

## Quality Guarantees

### Preview clarity

Preview clarity comes from:

1. fast preview source that is good enough for selection
2. HiDPI canvas rendering in `SelectionOverlay`

Preview does not define final export quality.

### Final clarity

Final clarity comes from:

1. crop generated from the original full-resolution frame
2. HiDPI editor canvas
3. final image export based on the crop plus annotation layers

The final image must not be generated from the preview.

## Performance Guarantees

The system should optimize for:

1. screenshot window first visibility
2. first interactive selection frame
3. selection confirmation to editor readiness

The design intentionally shifts quality-sensitive work out of the invocation path.

## Memory Tradeoff

This design keeps one full-resolution capture in Rust memory per active screenshot session.

That cost is acceptable because:

1. only one screenshot session is typically active
2. the session lifetime is short
3. it avoids synchronous full-screen encoding in the critical path

Session cleanup on close is mandatory.

## Validation Criteria

The implementation is correct only if all of these hold:

1. The screenshot window appears quickly again.
2. The selection overlay looks sharp enough for precise work.
3. Entering the editor after selection yields a sharp crop.
4. Copy/save/send output remains sharp.
5. Performance logs show invocation is no longer dominated by full-screen final encoding.
