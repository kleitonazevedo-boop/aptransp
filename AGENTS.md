# Architecture rules

- Keep endpoint diagnostics in the shared diagnostics service, using native Capacitor HTTP on devices and browser fetch on web; this keeps transport handling and response formatting consistent across checks.
- Handle the main header and portaled side menu with CSS safe-area insets and viewport-fit=cover; this keeps their controls clear of iOS system areas without fixed device offsets.