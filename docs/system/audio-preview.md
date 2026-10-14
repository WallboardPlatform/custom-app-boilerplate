# Audio preview verification

The preview simulates the host audio contract. Each render gets a fresh opaque token and a separate source registry. Teardown invalidates the token, removes listeners and pauses registered elements. `platform.audio.calls` records each command and its acceptance result. Acceptance is not proof of playback.

Configure a supported preview with:

```ts
platform: {
    isDisplayer: true,
    audio: {
        supported: true,
        globallyMuted: false,
        muted: false,
        otherSourceActive: true,
        ducking: { enabled: true, duckingLevel: 25, fadeDurationMS: 400 }
    }
}
```

Use `supported: false` for an unsupported host. Editor previews (`isDisplayer: false`) always reject audio commands. Global mute and inherited `muted` can be tested independently; the emitted `muted` combines both. Omit `ducking` for unducked/100%/0ms. `otherSourceActive` simulates activity from another host source, including when duck percentage is zero. Multiple sessions in a single `PreviewAudioHost` also contribute activity to one another while excluding their own sources. Separate installed mocks do not share registries.

From the preview console, `window.__wallboardPreview.pushAudio({ muted: true })` injects `audioDuckState` synchronously. Ordinary `pushConfiguration` preserves registrations. To test support changes, create a new render; support belongs to the render lifetime.

## Test a local SDK build

The checked-in SDK dependency remains pinned. Build `wb-apps-sdk`, then point this preview at its `dist` directory without installing or publishing a package:

```powershell
$env:WALLBOARD_PREVIEW_SDK_PATH = (Resolve-Path ..\wb-apps-sdk\dist).Path
npx playwright test --config preview/playwright.config.ts preview/audio.spec.ts preview/audio-sdk.spec.ts
```

`audio.spec.ts` verifies host behavior in Chrome using offline native media. `audio-sdk.spec.ts` additionally uses the built SDK and real offline WebAudio rendering to assert zero output while muted, restored output on unmute, and fades calculated from a stable baseline. It is explicitly skipped when no local SDK path is supplied. This option also applies to `npm run dev:preview` for manual review.

Use native video/audio events for ordinary and HLS media. Manual sources must silence their actual output and report start/stop/onended; downloaded fragments are not playback. Background audio consumes `duck$` without registering as a foreground trigger.

These tests cover the SDK and browser preview. The separate `wb-apps-harness` integration and real displayer direct/campaign/playlist/embedded/iframe tests remain deployment verification steps, including placement and global mute. Do not treat the mock as evidence of native-engine behavior.
