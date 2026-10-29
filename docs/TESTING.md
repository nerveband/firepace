# Checks on real hardware

Checked on October 29, 2026, using a silver Kindle 4 Non-Touch (firmware 4.1.4) and a Mac. The physical screen was inspected through an iPhone Continuity Camera preview. Clean Kindle images in this folder come from the device framebuffer, not an emulator or generated mockup.

| Check | Result |
| --- | --- |
| USB connection | Passed |
| Wi-Fi connection | Passed |
| One-click pairing over trusted USB | Passed without typing on the Kindle |
| Find a device after a stale Wi-Fi address | Passed; the saved host key was checked |
| Browser helper tests | 3 passed |
| Wake from screensaver | Wake command and Active power state checked; writer verified through camera |
| JavaScript and Python syntax | Passed |

| Timer check | Result |
| --- | --- |
| Countdown | Ran on the device |
| Short focus/break cycle | Switched phases; both screens inspected |
| Count up | Ran on the device without a countdown label |
| App disconnected | Device elapsed time advanced from 80 to 83 seconds while the app was disconnected |
| Pause and menu | Tested by injecting events through the actual input devices |
| Saved presets | Synced four timers; selected a saved timer with injected button events |
| Preset starts a new session | Selected the 50-minute timer; device state reported preset 1 and a new session |
| Orientation | Changed from the browser and Kindle controls; portrait reflow inspected |
| Home exits | Device reported the session stopped |
| Sound | Browser audio context ran after Test sound; speaker loudness was not measured |

Button injection tests the input handling path. It does not test the physical switches themselves. The KUAL launcher is installed; its launch command was tested through the same device shell, rather than by navigating KUAL's book list.

## Limits

Other e-reader models, Windows helpers, physical cable removal during a session, and long battery-life runs were not tested. Browser screenshots show sample text. No personal draft, serial number, connection key, or known-host file is included.
