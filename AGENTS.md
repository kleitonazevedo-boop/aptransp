# Architecture rules

- Keep endpoint diagnostics in the shared diagnostics service, using native Capacitor HTTP on devices and browser fetch on web; this keeps transport handling and response formatting consistent across checks.