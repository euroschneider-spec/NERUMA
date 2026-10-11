# Reading, optional speech and sound-independent access

This implementation concerns access to VIANORAE itself. Venue noise levels remain descriptive environmental information; they are not a substitute for making the website understandable without hearing.

The current site contains no audio/video media and no essential audio-only instructions or notifications. Guide instructions, step counts, navigation, sensory levels, confirmation and error messages are written on screen. Messages do not disappear on an automatic timer. The public/demo guide additionally offers a complete text view containing every step, useful note, next instruction, sensory label, arrival information and provenance without images, playback or time limits. Switching back retains the current step. Saved local drafts feed both guide views; this is not a new dataset or translation.

A single fixed, labeled launcher opens a native nonmodal reading popup. There is no second header control or permanent media sidebar. The compact icon tab is docked to the left screen edge and vertically centered on desktop and mobile, independently of page images. Its accessible name and tooltip identify reading and audio settings. The popup opens beside the tab and is clamped to the screen. Both keep their screen position while the page scrolls; no scroll handler reanchors them.

The background remains usable and scrolling is not locked. Opening focuses the text-size selector. Tab can leave the popup; Escape works inside or outside, and explicit close returns focus to the launcher. Outside clicks close without stealing focus from the clicked control. Changing routes closes the popup. Its own content scrolls at enlarged text sizes.

The handle supports pointer dragging, arrow-key movement and Home to reset. Clicking the handle reveals four single-click movement buttons and reset, providing a pointer alternative to dragging. Positions are clamped on move, resize and popup-content resize. Text size, spacing and appearance retain the existing local preference key; no disability profile is collected.

## Optional read aloud

The reading dialog offers page narration and the public/demo guide offers current-step narration or the complete guide in text mode. Private online previews narrate their saved draft content, never the fictional example. Speech includes descriptions, photo alternative text, sensory labels, notes and next instructions. The page reader excludes controls and input values. This supplements semantic HTML and screen-reader access.

Speech uses the browser Web Speech API, starts only on explicit request, and supports pause/resume, stop and speed selected before playback. Short chunks avoid long-utterance limits. Moving steps, switching text mode or language, closing the page-reading dialog or leaving the page cancels the relevant speech. Starting another reader cancels the previous one. Cancellation and failure callbacks cannot restart stopped speech.

Voices must match EN/RO/DE; the reader never falls back to a different language. Missing voices, unsupported browsers and playback failures have visible status messages and screen-reader alternatives. Voice quality and availability depend on the device/browser; some system voices need internet. VIANORAE does not use a hosted TTS API or store generated audio. No recorded audio files, new secrets, paid service or database migration are added.

Automated speech tests use a simulated browser speech engine to verify orchestration, language selection, chunk content, cancellation and errors. They do not prove audible voice quality or physical-device support. Manual testing with installed EN/RO/DE voices and NVDA/VoiceOver/TalkBack remains necessary before the pilot.

## Requirements for future media

- Prerecorded audio must have an adjacent, complete text transcript.
- Video containing audio must have accurate synchronized captions, including spoken content, meaningful sounds and speaker identification. A transcript alone does not replace captions for video.
- Provide a readable transcript alongside the player and accessible keyboard playback controls. No autoplay or required audio.
- Auto-generated captions require review before publication. Do not label captions as available until they are present and usable.
- Status/error messages must remain visible as text. An optional sound may supplement a visual message but never be its only form.

References: WCAG 2.2 [1.2.1 Audio-only and Video-only](https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html) and [1.2.2 Captions](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html). No captioning service or media pipeline is activated by this change.

Automated tests cover EN/RO/DE dialog keyboard focus, Escape and return focus, axe WCAG A/AA rules, viewport resize at 320px with 200% text, complete guide content without media/images, saved-draft use and retained step position. User testing with deaf/hard-of-hearing people and manual assistive-technology review remain part of pilot readiness; the controls do not establish full WCAG conformance.
