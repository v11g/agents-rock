# ColdWatch — client features

- F1: Temperature excursion alert — a store manager gets an SMS within two minutes when a fridge stays above its threshold for ten minutes, with no one watching a screen.
- F2: Technician onboarding — a field technician scans the gateway QR in the installer app, and the fridge appears in the console already assigned to the right store and asset tag.
- F3: Remote sampling and threshold change — an ops engineer changes the sampling interval and alert thresholds for all freezers in a region, and every gateway applies it, including those offline at the time.
- F4: Staged firmware release — an ops engineer releases new firmware to a 5% canary group first, with automatic halt if more than 2% of installs fail, then promotes it to the whole fleet.
- F5: Gap-free 90-day history — a store manager views 90 days of temperature history for a fridge, including readings captured while the gateway had no connection.
- F6: Gateway retirement — an ops engineer retires a gateway so it can never reconnect, its certificate is revoked, and its device data is erased after the retention period.
